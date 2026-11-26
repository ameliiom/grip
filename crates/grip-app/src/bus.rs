use crate::settings::{grip_config_dir, normalize_theme, set_autostart, AppSettings};
use crate::win_host::{self, RunningApp};
use secbird_core::actions;
use secbird_core::buttons::{button_name, Layer};
use secbird_core::db::{Db, Kind, Polling};
use secbird_core::features::DpiStages;
use secbird_core::macros::Script;
use secbird_core::scroll::parse_modes;
use secbird_core::{discover, hidapi::HidApi, Device, Store};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::path::PathBuf;
use std::str::FromStr;
use std::sync::Mutex;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LayerName {
    Normal,
    Hypershift,
}

impl LayerName {
    fn to_core(self) -> Layer {
        match self {
            LayerName::Normal => Layer::Normal,
            LayerName::Hypershift => Layer::HyperShift,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceCapabilities {
    pub has_buttons: bool,
    pub has_side_grid_12: bool,
    pub has_side_hex_6: bool,
    pub has_dpi: bool,
    pub dpi_min: u16,
    pub dpi_max: u16,
    pub dpi_step: u16,
    pub polling_options: Vec<u32>,
    pub sleep_max_minutes: Option<u16>,
    pub has_auto_sleep: bool,
    pub has_scroll: bool,
    pub has_macros: bool,
    pub has_lighting: bool,
    pub has_game_mode: bool,
    pub has_power: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ButtonEntry {
    pub id: String,
    pub normal: String,
    pub hypershift: Option<String>,
    pub remapped_normal: bool,
    pub remapped_hypershift: bool,
    pub saved_normal: String,
    pub saved_hypershift: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OnboardStatus {
    pub slot: u8,
    pub profile: String,
    pub count: usize,
    pub changed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DpiState {
    pub active_stage: u8,
    pub stages: Vec<[u16; 2]>,
    pub max_stages: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScrollState {
    pub mode: String,
    pub precision: bool,
    pub disabled: Vec<String>,
    pub acceleration: String,
    pub smart_reel: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LightingZoneState {
    pub id: u8,
    pub name: String,
    pub color: String,
    pub effect: String,
    pub brightness: u8,
    pub off: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LightingState {
    pub enabled: bool,
    pub zones: Vec<LightingZoneState>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileSummary {
    pub name: String,
    pub apps: Vec<String>,
    pub custom_buttons_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MacroSummary {
    pub id: u16,
    pub name: String,
    pub steps: String,
    pub size_bytes: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceSummary {
    pub device_key: String,
    pub name: String,
    pub kind: String,
    pub pid_hex: String,
    pub battery_percent: Option<u8>,
    pub charging: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceSnapshot {
    pub mode: String,
    pub device_key: String,
    pub name: String,
    pub kind: String,
    pub pid_hex: String,
    pub serial: String,
    pub firmware: String,
    pub battery_percent: Option<u8>,
    pub charging: Option<bool>,
    pub capabilities: DeviceCapabilities,
    pub buttons: Vec<ButtonEntry>,
    pub onboard: Option<OnboardStatus>,
    pub dpi: DpiState,
    pub polling_hz: Option<u32>,
    pub sleep_minutes: Option<u16>,
    pub auto_sleep: Option<bool>,
    pub scroll: Option<ScrollState>,
    pub lighting: LightingState,
    pub active_profile: String,
    pub profiles: Vec<ProfileSummary>,
    pub macros: Vec<MacroSummary>,
    pub macro_free_bytes: u32,
    pub macro_max_bytes: u32,
    pub can_undo: bool,
    pub can_redo: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceSnapshot {
    pub devices: Vec<DeviceSummary>,
    pub active_device: Option<DeviceSnapshot>,
    pub synapse_running: Vec<String>,
    pub running_apps: Vec<RunningApp>,
    pub settings: AppSettings,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FirmwareCheckResult {
    pub state: String,
    pub current: String,
    pub latest_version: Option<String>,
    pub url: Option<String>,
    pub guide: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BusResponse {
    pub workspace: WorkspaceSnapshot,
    pub firmware_check: Option<FirmwareCheckResult>,
    pub diagnostic_report: Option<String>,
    pub exported_json: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum BusCommand {
    #[serde(rename_all = "camelCase")]
    GetWorkspace {
        device_key: Option<String>,
    },
    #[serde(rename_all = "camelCase")]
    SelectDevice {
        device_key: String,
    },
    Rescan,
    #[serde(rename_all = "camelCase")]
    SetButton {
        device_key: String,
        button: String,
        layer: LayerName,
        action: String,
    },
    #[serde(rename_all = "camelCase")]
    ResetButton {
        device_key: String,
        button: String,
        layer: LayerName,
    },
    #[serde(rename_all = "camelCase")]
    RestoreAllButtons {
        device_key: String,
    },
    #[serde(rename_all = "camelCase")]
    SaveOnboard {
        device_key: String,
    },
    #[serde(rename_all = "camelCase")]
    PutBackOnboard {
        device_key: String,
    },
    #[serde(rename_all = "camelCase")]
    SetDpiStage {
        device_key: String,
        stage: u8,
    },
    #[serde(rename_all = "camelCase")]
    SetDpiStages {
        device_key: String,
        active_stage: u8,
        stages: Vec<[u16; 2]>,
    },
    #[serde(rename_all = "camelCase")]
    SetPolling {
        device_key: String,
        hz: u32,
    },
    #[serde(rename_all = "camelCase")]
    SetSleep {
        device_key: String,
        minutes: Option<u16>,
        auto_sleep: Option<bool>,
    },
    #[serde(rename_all = "camelCase")]
    SetScroll {
        device_key: String,
        mode: Option<String>,
        disabled: Option<String>,
        acceleration: Option<String>,
        smart_reel: Option<String>,
    },
    #[serde(rename_all = "camelCase")]
    SelectProfile {
        device_key: String,
        name: String,
    },
    #[serde(rename_all = "camelCase")]
    CreateProfile {
        device_key: String,
        name: String,
    },
    #[serde(rename_all = "camelCase")]
    RenameProfile {
        device_key: String,
        old_name: String,
        new_name: String,
    },
    #[serde(rename_all = "camelCase")]
    DeleteProfile {
        device_key: String,
        name: String,
    },
    #[serde(rename_all = "camelCase")]
    SetProfileApps {
        device_key: String,
        name: String,
        apps: Vec<String>,
    },
    ExportProfiles,
    #[serde(rename_all = "camelCase")]
    ImportProfiles {
        json: String,
    },
    #[serde(rename_all = "camelCase")]
    CreateMacro {
        device_key: String,
        name: String,
        steps: String,
    },
    #[serde(rename_all = "camelCase")]
    DeleteMacro {
        device_key: String,
        macro_id: u16,
    },
    #[serde(rename_all = "camelCase")]
    SetLightingControl {
        device_key: String,
        enabled: bool,
    },
    #[serde(rename_all = "camelCase")]
    SetLightingColor {
        device_key: String,
        zone: String,
        color: String,
    },
    #[serde(rename_all = "camelCase")]
    SetLightingBrightness {
        device_key: String,
        zone: String,
        percent: u8,
    },
    #[serde(rename_all = "camelCase")]
    SetLightingEffect {
        device_key: String,
        zone: String,
        effect: String,
    },
    #[serde(rename_all = "camelCase")]
    SetLightingOff {
        device_key: String,
        zone: String,
    },
    #[serde(rename_all = "camelCase")]
    SyncLighting {
        color: Option<String>,
        effect: Option<String>,
    },
    #[serde(rename_all = "camelCase")]
    UpdateSettings {
        settings: AppSettings,
    },
    #[serde(rename_all = "camelCase")]
    CheckFirmware {
        device_key: String,
    },
    GenerateReport,
    OpenConfigFolder,
    #[serde(rename_all = "camelCase")]
    Undo {
        device_key: String,
    },
    #[serde(rename_all = "camelCase")]
    Redo {
        device_key: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CommandError {
    pub code: String,
    pub user_message_ar: String,
    pub user_message_en: String,
    pub recovery_action: String,
}

impl CommandError {
    fn new(code: &str, ar: &str, en: &str, recovery: &str) -> Self {
        Self {
            code: code.to_string(),
            user_message_ar: ar.to_string(),
            user_message_en: en.to_string(),
            recovery_action: recovery.to_string(),
        }
    }

    fn from_core(err: secbird_core::Error) -> Self {
        let msg = err.to_string();
        if msg.contains("left click") {
            return Self::new(
                "PROTECTED_LEFT_CLICK",
                "زر النقر الأيسر محمي ولا يمكن إزالته إلا بعد تعيين النقر الأيسر لزر آخر.",
                "Primary left click stays protected so you never lose mouse control.",
                "Assign left click to another button first",
            );
        }
        Self::new(
            "DEVICE_ERROR",
            &format!("تعذر تنفيذ الإجراء على الماوس ({msg})."),
            &format!("Device update could not be completed ({msg})."),
            "Retry or rescan",
        )
    }
}

#[derive(Debug, Clone)]
enum HistoryOp {
    Button {
        button: String,
        layer: LayerName,
        before: Option<String>,
        after: Option<String>,
    },
    DpiStages {
        before: DpiStages,
        after: DpiStages,
    },
    Polling {
        before: u32,
        after: u32,
    },
    Sleep {
        before: u16,
        after: u16,
    },
}

pub struct TraySummary {
    pub locale: String,
    pub tooltip: String,
    pub active_profile: Option<String>,
    pub profiles: Vec<String>,
}

pub struct BusEngine {
    devices: Vec<Device>,
    active_key: Option<String>,
    store: Store,
    settings: AppSettings,
    settings_path: PathBuf,
    simulated: bool,
    undo_stacks: BTreeMap<String, Vec<HistoryOp>>,
    redo_stacks: BTreeMap<String, Vec<HistoryOp>>,
    foreground_applied: BTreeMap<String, String>,
    low_battery_notified: BTreeMap<String, bool>,
}

pub struct AppBus(pub Mutex<BusEngine>);

impl Default for AppBus {
    fn default() -> Self {
        Self::new()
    }
}

impl AppBus {
    pub fn new() -> Self {
        let dir = grip_config_dir();
        let store_path = dir.join("profiles.json");
        let settings_path = dir.join("settings.json");
        let store = Store::load(&store_path).unwrap_or_default();
        let settings = AppSettings::load(&settings_path);
        let simulated = std::env::var("GRIP_SIM").is_ok_and(|v| v == "1" || v == "true")
            || std::env::var("SECBIRD_SIM").is_ok_and(|v| !v.trim().is_empty());
        let mut engine = BusEngine {
            devices: Vec::new(),
            active_key: None,
            store,
            settings,
            settings_path,
            simulated,
            undo_stacks: BTreeMap::new(),
            redo_stacks: BTreeMap::new(),
            foreground_applied: BTreeMap::new(),
            low_battery_notified: BTreeMap::new(),
        };
        let _ = engine.rescan();
        Self(Mutex::new(engine))
    }

    pub fn execute(&self, cmd: BusCommand) -> Result<BusResponse, CommandError> {
        let mut guard = self.0.lock().unwrap_or_else(|p| p.into_inner());
        guard.execute(cmd)
    }

    pub fn handle_foreground_app(&self, exe: &str) -> bool {
        let mut guard = self.0.lock().unwrap_or_else(|p| p.into_inner());
        guard.handle_foreground_app(exe)
    }

    pub fn reapply_active(&self) {
        let mut guard = self.0.lock().unwrap_or_else(|p| p.into_inner());
        guard.reapply_active();
    }

    pub fn rescan_and_reapply(&self) -> bool {
        let mut guard = self.0.lock().unwrap_or_else(|p| p.into_inner());
        guard.rescan_and_reapply()
    }

    pub fn check_battery_alerts(&self) -> Vec<String> {
        let mut guard = self.0.lock().unwrap_or_else(|p| p.into_inner());
        guard.check_battery_alerts()
    }

    pub fn tray_summary(&self) -> TraySummary {
        let mut guard = self.0.lock().unwrap_or_else(|p| p.into_inner());
        guard.tray_summary()
    }

    pub fn select_profile_from_tray(&self, name: &str) -> bool {
        let mut guard = self.0.lock().unwrap_or_else(|p| p.into_inner());
        let Some(key) = guard.active_key.clone().or_else(|| guard.devices.first().map(Device::key)) else {
            return false;
        };
        guard
            .execute(BusCommand::SelectProfile {
                device_key: key,
                name: name.to_string(),
            })
            .is_ok()
    }

    pub fn is_dark_theme(&self) -> bool {
        let guard = self.0.lock().unwrap_or_else(|p| p.into_inner());
        match guard.settings.theme.as_str() {
            "dark" => true,
            "light" => false,
            _ => win_host::windows_prefers_dark(),
        }
    }

    pub fn close_to_tray(&self) -> bool {
        let guard = self.0.lock().unwrap_or_else(|p| p.into_inner());
        guard.settings.close_to_tray
    }
}

fn kind_label(kind: Option<Kind>) -> String {
    match kind {
        Some(Kind::Mouse) => "mouse",
        Some(Kind::Keyboard) => "keyboard",
        Some(Kind::Headset) => "headset",
        Some(Kind::Mousepad) => "mousepad",
        Some(Kind::Keypad) => "keypad",
        Some(Kind::Laptop) => "laptop",
        Some(Kind::Accessory) => "accessory",
        None => "unknown",
    }
    .into()
}

fn macro_of_action(action: &str) -> Option<u16> {
    action.strip_prefix("macro:")?.split('@').next()?.parse().ok()
}

fn clean_device_title(name: &str) -> String {
    let mut s = name.trim();
    for suffix in [" (Receiver)", " (Wireless)", " (Wired)", " (Dongle)", " (Bluetooth)"] {
        if let Some(stripped) = s.strip_suffix(suffix) {
            s = stripped.trim();
        }
    }
    if s.is_empty() {
        name.to_string()
    } else {
        s.to_string()
    }
}

impl BusEngine {
    #[cfg(test)]
    pub fn new_with_devices(devices: Vec<Device>, store_path: PathBuf, simulated: bool) -> Self {
        let store = Store::load(&store_path).unwrap_or_default();
        let settings_path = store_path.with_file_name("settings.json");
        let active_key = devices.first().map(Device::key);
        Self {
            devices,
            active_key,
            store,
            settings: AppSettings::default(),
            settings_path,
            simulated,
            undo_stacks: BTreeMap::new(),
            redo_stacks: BTreeMap::new(),
            foreground_applied: BTreeMap::new(),
            low_battery_notified: BTreeMap::new(),
        }
    }

    pub fn rescan(&mut self) -> Result<(), CommandError> {
        let db = Db::load(Some(&grip_config_dir().join("devices.json")))
            .or_else(|_| Db::builtin())
            .map_err(CommandError::from_core)?;
        if std::env::var("GRIP_SIM").is_ok_and(|v| v == "1" || v == "true") {
            self.devices = secbird_core::sim::open_preset("naga", &db).into_iter().collect();
            self.simulated = true;
        } else {
            let api = HidApi::new().map_err(|e| CommandError::from_core(e.into()))?;
            self.devices = discover(&api, &db);
            self.simulated = std::env::var("SECBIRD_SIM").is_ok_and(|v| !v.trim().is_empty());
        }
        if !self.devices.is_empty()
            && self
                .active_key
                .as_ref()
                .is_none_or(|k| !self.devices.iter().any(|d| d.key() == *k))
        {
            self.active_key = Some(self.devices[0].key());
        }
        Ok(())
    }

    pub fn reapply_active(&mut self) {
        for dev in &self.devices {
            let dp = self.store.for_device(dev);
            let active = dp.active.clone();
            let _ = dp.apply(&active, dev);
        }
    }

    pub fn rescan_and_reapply(&mut self) -> bool {
        let before: Vec<String> = self.devices.iter().map(Device::key).collect();
        if self.rescan().is_err() {
            return false;
        }
        self.reapply_active();
        let after: Vec<String> = self.devices.iter().map(Device::key).collect();
        before != after || !after.is_empty()
    }

    pub fn check_battery_alerts(&mut self) -> Vec<String> {
        if !self.settings.battery_warning {
            self.low_battery_notified.clear();
            return Vec::new();
        }
        let threshold = self.settings.battery_warning_at;
        let is_ar = self.settings.locale == "ar";
        let mut fired = Vec::new();
        for dev in &self.devices {
            let key = dev.key();
            let Some(pct) = dev.battery().ok().flatten() else {
                continue;
            };
            let charging = dev.charging().ok().unwrap_or(false);
            if charging || pct >= threshold.saturating_add(5) {
                self.low_battery_notified.insert(key, false);
                continue;
            }
            if pct <= threshold && !self.low_battery_notified.get(&key).copied().unwrap_or(false) {
                self.low_battery_notified.insert(key, true);
                let msg = if is_ar {
                    format!("البطارية منخفضة: {pct}%")
                } else {
                    format!("Low battery: {pct}%")
                };
                win_host::show_osd(&msg);
                fired.push(msg);
            }
        }
        fired
    }

    pub fn tray_summary(&mut self) -> TraySummary {
        let locale = self.settings.locale.clone();
        if let Ok(idx) = self.find_device(None) {
            let dev = &self.devices[idx];
            let title = clean_device_title(&dev.name());
            let bat = dev.battery().ok().flatten();
            let dp = self.store.for_device(dev);
            let active = dp.active.clone();
            let profiles: Vec<String> = dp.profiles.keys().cloned().collect();
            let tooltip = match bat {
                Some(pct) => format!("Grip — {title} · {pct}% · {active}"),
                None => format!("Grip — {title} · {active}"),
            };
            TraySummary {
                locale,
                tooltip,
                active_profile: Some(active),
                profiles,
            }
        } else {
            let tooltip = if locale == "ar" {
                "Grip — بانتظار توصيل الماوس".to_string()
            } else {
                "Grip — Waiting for mouse".to_string()
            };
            TraySummary {
                locale,
                tooltip,
                active_profile: None,
                profiles: Vec::new(),
            }
        }
    }

    pub fn handle_foreground_app(&mut self, exe: &str) -> bool {
        if !self.settings.auto_switch {
            return false;
        }
        let norm = secbird_core::profile::normalize_app(exe);
        if norm.is_empty() {
            return false;
        }
        let is_ar = self.settings.locale == "ar";
        let mut changed = false;
        for dev in &self.devices {
            let key = dev.key();
            let dp = self.store.for_device(dev);
            let want = dp.effective(Some(&norm)).to_string();
            let prev = self.foreground_applied.get(&key).cloned().unwrap_or_else(|| dp.active.clone());
            if want != prev {
                let _ = dp.apply(&want, dev);
                self.foreground_applied.insert(key, want.clone());
                changed = true;
                if self.settings.popups {
                    let msg = if is_ar {
                        format!("البروفايل: {want}")
                    } else {
                        format!("Profile: {want}")
                    };
                    win_host::show_osd(&msg);
                }
            }
        }
        changed
    }

    fn find_device(&self, device_key: Option<&str>) -> Result<usize, CommandError> {
        if self.devices.is_empty() {
            return Err(CommandError::new(
                "NO_DEVICE",
                "لم يتم العثور على أي جهاز متصل حالياً.",
                "No connected device found.",
                "Connect your mouse and rescan",
            ));
        }
        let wanted = device_key.filter(|k| !k.is_empty()).or(self.active_key.as_deref());
        if let Some(key) = wanted {
            if let Some(idx) = self.devices.iter().position(|d| d.key() == key) {
                return Ok(idx);
            }
        }
        Ok(0)
    }

    fn push_undo(&mut self, key: &str, op: HistoryOp) {
        self.undo_stacks.entry(key.to_string()).or_default().push(op);
        self.redo_stacks.remove(key);
    }

    fn apply_history_op(&mut self, idx: usize, op: &HistoryOp, reverse: bool) -> Result<(), CommandError> {
        let dev = &self.devices[idx];
        match op {
            HistoryOp::Button { button, layer, before, after } => {
                let target = if reverse { before } else { after };
                let parsed = match target {
                    Some(text) => Some(text.parse().map_err(CommandError::from_core)?),
                    None => None,
                };
                actions::set_button(dev, &mut self.store, button, layer.to_core(), parsed)
                    .map_err(CommandError::from_core)?;
            }
            HistoryOp::DpiStages { before, after } => {
                let target = if reverse { before } else { after };
                actions::set_dpi_stages(dev, &mut self.store, target).map_err(CommandError::from_core)?;
            }
            HistoryOp::Polling { before, after } => {
                let hz = if reverse { *before } else { *after };
                actions::set_polling(dev, &mut self.store, hz).map_err(CommandError::from_core)?;
            }
            HistoryOp::Sleep { before, after } => {
                let minutes = if reverse { *before } else { *after };
                actions::set_sleep_minutes(dev, &mut self.store, minutes).map_err(CommandError::from_core)?;
            }
        }
        Ok(())
    }

    fn osd_if_enabled(&self, text: String) {
        if self.settings.popups {
            win_host::show_osd(&text);
        }
    }

    pub fn execute(&mut self, cmd: BusCommand) -> Result<BusResponse, CommandError> {
        let mut firmware_check = None;
        let mut diagnostic_report = None;
        let mut exported_json = None;

        match cmd {
            BusCommand::GetWorkspace { device_key } => {
                if let Some(k) = device_key.filter(|s| !s.is_empty()) {
                    if self.devices.iter().any(|d| d.key() == k) {
                        self.active_key = Some(k);
                    }
                }
            }
            BusCommand::SelectDevice { device_key } => {
                let idx = self.find_device(Some(&device_key))?;
                self.active_key = Some(self.devices[idx].key());
            }
            BusCommand::Rescan => {
                self.rescan()?;
            }
            BusCommand::SetButton { device_key, button, layer, action } => {
                let idx = self.find_device(Some(&device_key))?;
                let parsed = action.parse().map_err(CommandError::from_core)?;
                let key = self.devices[idx].key();
                let setting_key = secbird_core::buttons::setting_key(&button, layer.to_core());
                let prev_profile = self
                    .store
                    .for_device(&self.devices[idx])
                    .active()
                    .buttons
                    .get(&setting_key)
                    .cloned();
                let before = if prev_profile.is_none() {
                    secbird_core::buttons::button_id(&button)
                        .and_then(|id| self.devices[idx].button(id, layer.to_core()).ok())
                        .map(|a| a.to_string())
                } else {
                    prev_profile
                };
                actions::set_button(&self.devices[idx], &mut self.store, &button, layer.to_core(), Some(parsed))
                    .map_err(CommandError::from_core)?;
                self.push_undo(
                    &key,
                    HistoryOp::Button {
                        button,
                        layer,
                        before,
                        after: Some(action),
                    },
                );
            }
            BusCommand::ResetButton { device_key, button, layer } => {
                let idx = self.find_device(Some(&device_key))?;
                let key = self.devices[idx].key();
                let setting_key = secbird_core::buttons::setting_key(&button, layer.to_core());
                let before = self
                    .store
                    .for_device(&self.devices[idx])
                    .active()
                    .buttons
                    .get(&setting_key)
                    .cloned();
                actions::set_button(&self.devices[idx], &mut self.store, &button, layer.to_core(), None)
                    .map_err(CommandError::from_core)?;
                self.push_undo(
                    &key,
                    HistoryOp::Button {
                        button,
                        layer,
                        before,
                        after: None,
                    },
                );
            }
            BusCommand::RestoreAllButtons { device_key } => {
                let idx = self.find_device(Some(&device_key))?;
                let key = self.devices[idx].key();
                actions::restore_all_buttons(&self.devices[idx], &mut self.store)
                    .map_err(CommandError::from_core)?;
                self.undo_stacks.remove(&key);
                self.redo_stacks.remove(&key);
            }
            BusCommand::SaveOnboard { device_key } => {
                let idx = self.find_device(Some(&device_key))?;
                actions::save_buttons_to_mouse(&self.devices[idx], &mut self.store)
                    .map_err(CommandError::from_core)?;
            }
            BusCommand::PutBackOnboard { device_key } => {
                let idx = self.find_device(Some(&device_key))?;
                actions::put_back_onboard(&self.devices[idx], &mut self.store)
                    .map_err(CommandError::from_core)?;
            }
            BusCommand::SetDpiStage { device_key, stage } => {
                let idx = self.find_device(Some(&device_key))?;
                let key = self.devices[idx].key();
                let before = self.devices[idx].dpi_stages().map_err(CommandError::from_core)?;
                if stage == 0 || usize::from(stage) > before.stages.len() {
                    return Err(CommandError::new(
                        "INVALID_STAGE",
                        "رقم المرحلة غير صالح.",
                        "Invalid DPI stage.",
                        "Choose a valid stage",
                    ));
                }
                let mut after = before.clone();
                after.active = stage;
                actions::set_dpi_stages(&self.devices[idx], &mut self.store, &after)
                    .map_err(CommandError::from_core)?;
                let xy = after.stages[usize::from(stage - 1)];
                self.push_undo(&key, HistoryOp::DpiStages { before, after });
                let label = if xy.0 == xy.1 {
                    format!("{} DPI", xy.0)
                } else {
                    format!("{}×{} DPI", xy.0, xy.1)
                };
                self.osd_if_enabled(label);
            }
            BusCommand::SetDpiStages { device_key, active_stage, stages } => {
                let idx = self.find_device(Some(&device_key))?;
                let key = self.devices[idx].key();
                if stages.is_empty() || usize::from(active_stage) > stages.len() || active_stage == 0 {
                    return Err(CommandError::new(
                        "INVALID_STAGES",
                        "مراحل السرعة غير مكتملة.",
                        "DPI stages cannot be empty.",
                        "Provide 1..5 stages",
                    ));
                }
                let before = self.devices[idx].dpi_stages().map_err(CommandError::from_core)?;
                let want = DpiStages {
                    active: active_stage,
                    stages: stages.into_iter().map(|[x, y]| (x, y)).collect(),
                };
                let applied = actions::set_dpi_stages(&self.devices[idx], &mut self.store, &want)
                    .map_err(CommandError::from_core)?;
                self.push_undo(&key, HistoryOp::DpiStages { before, after: applied });
            }
            BusCommand::SetPolling { device_key, hz } => {
                let idx = self.find_device(Some(&device_key))?;
                let key = self.devices[idx].key();
                let before = self.devices[idx].polling_rate().map_err(CommandError::from_core)?;
                actions::set_polling(&self.devices[idx], &mut self.store, hz)
                    .map_err(CommandError::from_core)?;
                self.push_undo(&key, HistoryOp::Polling { before, after: hz });
            }
            BusCommand::SetSleep { device_key, minutes, auto_sleep } => {
                let idx = self.find_device(Some(&device_key))?;
                let key = self.devices[idx].key();
                if let Some(on) = auto_sleep {
                    actions::set_auto_sleep(&self.devices[idx], &mut self.store, on)
                        .map_err(CommandError::from_core)?;
                }
                if let Some(mins) = minutes {
                    let before = self.devices[idx]
                        .sleep_timer()
                        .map_err(CommandError::from_core)?
                        .map_or(5, |s| s.minutes);
                    actions::set_sleep_minutes(&self.devices[idx], &mut self.store, mins)
                        .map_err(CommandError::from_core)?;
                    self.push_undo(&key, HistoryOp::Sleep { before, after: mins });
                }
            }
            BusCommand::SetScroll { device_key, mode, disabled, acceleration, smart_reel } => {
                let idx = self.find_device(Some(&device_key))?;
                if let Some(d) = disabled {
                    let list = parse_modes(&d).map_err(CommandError::from_core)?;
                    actions::set_scroll_disabled(&self.devices[idx], &mut self.store, list)
                        .map_err(CommandError::from_core)?;
                }
                if let Some(m) = mode.filter(|s| !s.is_empty()) {
                    let parsed = m.parse().map_err(CommandError::from_core)?;
                    actions::set_scroll_mode(&self.devices[idx], &mut self.store, parsed)
                        .map_err(CommandError::from_core)?;
                }
                if let Some(a) = acceleration.filter(|s| !s.is_empty()) {
                    let parsed = a.parse().map_err(CommandError::from_core)?;
                    actions::set_scroll_acceleration(&self.devices[idx], &mut self.store, parsed)
                        .map_err(CommandError::from_core)?;
                }
                if let Some(sr) = smart_reel.filter(|s| !s.is_empty()) {
                    let parsed = sr.parse().map_err(CommandError::from_core)?;
                    actions::set_smart_reel(&self.devices[idx], &mut self.store, parsed)
                        .map_err(CommandError::from_core)?;
                }
            }
            BusCommand::SelectProfile { device_key, name } => {
                let idx = self.find_device(Some(&device_key))?;
                {
                    let dp = self.store.for_device(&self.devices[idx]);
                    dp.switch(&name).map_err(CommandError::from_core)?;
                    let _ = dp.apply(&name, &self.devices[idx]);
                }
                self.store.save().map_err(CommandError::from_core)?;
                self.foreground_applied.insert(self.devices[idx].key(), name.clone());
                let msg = if self.settings.locale == "ar" {
                    format!("البروفايل: {name}")
                } else {
                    format!("Profile: {name}")
                };
                self.osd_if_enabled(msg);
            }
            BusCommand::CreateProfile { device_key, name } => {
                let idx = self.find_device(Some(&device_key))?;
                let clean = name.trim().to_string();
                if clean.is_empty() {
                    return Err(CommandError::new(
                        "EMPTY_NAME",
                        "اكتب اسماً للبروفايل أولاً.",
                        "Profile name cannot be empty.",
                        "Provide a profile name",
                    ));
                }
                {
                    let dp = self.store.for_device(&self.devices[idx]);
                    dp.create(&clean).map_err(CommandError::from_core)?;
                    dp.switch(&clean).map_err(CommandError::from_core)?;
                }
                self.store.save().map_err(CommandError::from_core)?;
            }
            BusCommand::RenameProfile { device_key, old_name, new_name } => {
                let idx = self.find_device(Some(&device_key))?;
                let clean = new_name.trim().to_string();
                if clean.is_empty() {
                    return Err(CommandError::new(
                        "EMPTY_NAME",
                        "الاسم الجديد لا يمكن أن يكون فارغاً.",
                        "New profile name cannot be empty.",
                        "Provide a non-empty name",
                    ));
                }
                if clean != old_name {
                    let dp = self.store.for_device(&self.devices[idx]);
                    if dp.profiles.contains_key(&clean) {
                        return Err(CommandError::new(
                            "DUPLICATE_PROFILE",
                            "يوجد بروفايل بهذا الاسم بالفعل.",
                            "A profile with this name already exists.",
                            "Pick a unique name",
                        ));
                    }
                    let prof = dp.profiles.remove(&old_name).ok_or_else(|| {
                        CommandError::new(
                            "MISSING_PROFILE",
                            "لم يتم العثور على البروفايل المطلوب.",
                            "Profile not found.",
                            "Select an existing profile",
                        )
                    })?;
                    dp.profiles.insert(clean.clone(), prof);
                    if dp.active == old_name {
                        dp.active = clean.clone();
                    }
                    if let Some(onboard) = dp.onboard.as_mut() {
                        if onboard.profile == old_name {
                            onboard.profile = clean;
                        }
                    }
                    self.store.save().map_err(CommandError::from_core)?;
                }
            }
            BusCommand::DeleteProfile { device_key, name } => {
                let idx = self.find_device(Some(&device_key))?;
                self.store
                    .for_device(&self.devices[idx])
                    .delete(&name)
                    .map_err(CommandError::from_core)?;
                self.store.save().map_err(CommandError::from_core)?;
            }
            BusCommand::SetProfileApps { device_key, name, apps } => {
                let idx = self.find_device(Some(&device_key))?;
                self.store
                    .for_device(&self.devices[idx])
                    .set_apps(&name, &apps)
                    .map_err(CommandError::from_core)?;
                self.store.save().map_err(CommandError::from_core)?;
            }
            BusCommand::ExportProfiles => {
                exported_json = Some(
                    serde_json::to_string_pretty(&self.store)
                        .map_err(|e| CommandError::from_core(secbird_core::Error::Db(e.to_string())))?,
                );
            }
            BusCommand::ImportProfiles { json } => {
                let incoming: Store = serde_json::from_str(&json).map_err(|_| {
                    CommandError::new(
                        "INVALID_BACKUP",
                        "ملف النسخة الاحتياطية غير صالح.",
                        "Invalid profile backup file.",
                        "Select a valid JSON backup",
                    )
                })?;
                let connected: Vec<String> = self.devices.iter().map(Device::key).collect();
                self.store.import_for(incoming, &connected);
                self.store.save().map_err(CommandError::from_core)?;
                self.reapply_active();
            }
            BusCommand::CreateMacro { device_key, name, steps } => {
                let idx = self.find_device(Some(&device_key))?;
                let script = Script::from_str(&steps).map_err(CommandError::from_core)?;
                self.devices[idx]
                    .create_macro(&name, &script.0)
                    .map_err(CommandError::from_core)?;
            }
            BusCommand::DeleteMacro { device_key, macro_id } => {
                let idx = self.find_device(Some(&device_key))?;
                let in_use = self
                    .store
                    .for_device(&self.devices[idx])
                    .profiles
                    .values()
                    .any(|p| p.buttons.values().any(|a| macro_of_action(a) == Some(macro_id)));
                if in_use {
                    return Err(CommandError::new(
                        "MACRO_IN_USE",
                        "الماكرو مستخدم حالياً في أحد الأزرار، أزل تعيينه أولاً.",
                        "This macro is assigned to a button; unassign it first.",
                        "Reassign the button first",
                    ));
                }
                self.devices[idx].delete_macro(macro_id).map_err(CommandError::from_core)?;
            }
            BusCommand::SetLightingControl { device_key, enabled } => {
                let idx = self.find_device(Some(&device_key))?;
                actions::set_lighting_control(&self.devices[idx], &mut self.store, enabled)
                    .map_err(CommandError::from_core)?;
            }
            BusCommand::SetLightingColor { device_key, zone, color } => {
                let idx = self.find_device(Some(&device_key))?;
                let rgb = color.parse().map_err(CommandError::from_core)?;
                actions::set_color(&self.devices[idx], &mut self.store, &zone, rgb)
                    .map_err(CommandError::from_core)?;
            }
            BusCommand::SetLightingBrightness { device_key, zone, percent } => {
                let idx = self.find_device(Some(&device_key))?;
                actions::set_brightness(&self.devices[idx], &mut self.store, &zone, percent)
                    .map_err(CommandError::from_core)?;
            }
            BusCommand::SetLightingEffect { device_key, zone, effect } => {
                let idx = self.find_device(Some(&device_key))?;
                let parsed = effect.parse().map_err(CommandError::from_core)?;
                actions::set_effect(&self.devices[idx], &mut self.store, &zone, parsed)
                    .map_err(CommandError::from_core)?;
            }
            BusCommand::SetLightingOff { device_key, zone } => {
                let idx = self.find_device(Some(&device_key))?;
                actions::lights_off(&self.devices[idx], &mut self.store, &zone)
                    .map_err(CommandError::from_core)?;
            }
            BusCommand::SyncLighting { color, effect } => {
                if let Some(eff) = effect.filter(|s| !s.is_empty()) {
                    let parsed = eff.parse().map_err(CommandError::from_core)?;
                    let _ = actions::sync_effect(&self.devices, &mut self.store, &parsed);
                } else if let Some(col) = color.filter(|s| !s.is_empty()) {
                    let rgb = col.parse().map_err(CommandError::from_core)?;
                    let _ = actions::sync_color(&self.devices, &mut self.store, rgb);
                }
            }
            BusCommand::UpdateSettings { mut settings } => {
                settings.battery_warning_at = settings.battery_warning_at.clamp(5, 95);
                settings.theme = normalize_theme(&settings.theme);
                if settings.battery_warning_at != self.settings.battery_warning_at
                    || settings.battery_warning != self.settings.battery_warning
                {
                    self.low_battery_notified.clear();
                }
                if settings.autostart != self.settings.autostart {
                    set_autostart(settings.autostart);
                    settings.autostart = crate::settings::autostart_enabled();
                }
                self.settings = settings;
                self.settings.save(&self.settings_path);
            }
            BusCommand::CheckFirmware { device_key } => {
                let idx = self.find_device(Some(&device_key))?;
                let connected: Vec<u16> = self.devices.iter().map(|d| d.pid).collect();
                let res = secbird_core::firmware::check(&self.devices[idx], &connected)
                    .map_err(CommandError::from_core)?;
                firmware_check = Some(match res {
                    secbird_core::firmware::Status::UpToDate { current } => FirmwareCheckResult {
                        state: "current".into(),
                        current,
                        latest_version: None,
                        url: None,
                        guide: None,
                    },
                    secbird_core::firmware::Status::NoneListed { current } => FirmwareCheckResult {
                        state: "none".into(),
                        current,
                        latest_version: None,
                        url: None,
                        guide: None,
                    },
                    secbird_core::firmware::Status::Update { current, latest } => FirmwareCheckResult {
                        state: "update".into(),
                        current,
                        latest_version: Some(latest.version),
                        url: Some(latest.url),
                        guide: latest.guide,
                    },
                });
            }
            BusCommand::GenerateReport => {
                let db = Db::load(Some(&grip_config_dir().join("devices.json")))
                    .or_else(|_| Db::builtin())
                    .map_err(CommandError::from_core)?;
                if self.simulated {
                    diagnostic_report = Some("Simulated device workspace".into());
                } else {
                    let api = HidApi::new().map_err(|e| CommandError::from_core(e.into()))?;
                    diagnostic_report = Some(secbird_core::report::build(&api, &db).to_string());
                }
            }
            BusCommand::OpenConfigFolder => {
                win_host::open_folder(&grip_config_dir());
            }
            BusCommand::Undo { device_key } => {
                let idx = self.find_device(Some(&device_key))?;
                let key = self.devices[idx].key();
                if let Some(op) = self.undo_stacks.get_mut(&key).and_then(Vec::pop) {
                    self.apply_history_op(idx, &op, true)?;
                    self.redo_stacks.entry(key).or_default().push(op);
                }
            }
            BusCommand::Redo { device_key } => {
                let idx = self.find_device(Some(&device_key))?;
                let key = self.devices[idx].key();
                if let Some(op) = self.redo_stacks.get_mut(&key).and_then(Vec::pop) {
                    self.apply_history_op(idx, &op, false)?;
                    self.undo_stacks.entry(key).or_default().push(op);
                }
            }
        }

        let workspace = self.workspace_snapshot();
        Ok(BusResponse {
            workspace,
            firmware_check,
            diagnostic_report,
            exported_json,
        })
    }

    fn workspace_snapshot(&mut self) -> WorkspaceSnapshot {
        let summaries: Vec<DeviceSummary> = self
            .devices
            .iter()
            .map(|d| DeviceSummary {
                device_key: d.key(),
                name: d.name(),
                kind: kind_label(d.spec.as_ref().map(|s| s.kind)),
                pid_hex: format!("{:04X}", d.pid),
                battery_percent: d.battery().ok().flatten(),
                charging: d.charging().ok(),
            })
            .collect();

        let active_idx = if self.devices.is_empty() {
            None
        } else {
            self.active_key
                .as_ref()
                .and_then(|k| self.devices.iter().position(|d| d.key() == *k))
                .or(Some(0))
        };

        let active_device = active_idx.map(|i| self.snapshot_for(i));

        #[cfg(windows)]
        let synapse_running = secbird_core::debloat::synapse_running();
        #[cfg(not(windows))]
        let synapse_running = Vec::new();

        WorkspaceSnapshot {
            devices: summaries,
            active_device,
            synapse_running,
            running_apps: win_host::running_apps(),
            settings: self.settings.clone(),
        }
    }

    fn snapshot_for(&mut self, idx: usize) -> DeviceSnapshot {
        let dev = &self.devices[idx];
        let key = dev.key();
        let firmware = dev.firmware_version().unwrap_or_else(|_| "—".into());
        let battery_percent = dev.battery().ok().flatten();
        let charging = dev.charging().ok();
        let normal_list = dev.buttons();

        let button_ids: Vec<u8> = normal_list.iter().map(|(id, _)| *id).collect();
        let has_side_grid_12 =
            dev.name().contains("Naga") || button_ids.iter().any(|id| (64..=75).contains(id));
        let has_side_hex_6 = button_ids.iter().any(|id| (80..=86).contains(id));

        let spec = dev.spec.as_ref();
        let dpi_range = spec.and_then(|s| s.dpi.as_ref());
        let dpi_stages = dev.dpi_stages().ok();
        let fallback_dpi = dev.dpi().ok().unwrap_or((1600, 1600));
        let dpi = match dpi_stages {
            Some(st) if !st.stages.is_empty() => DpiState {
                active_stage: st.active,
                stages: st.stages.into_iter().map(|(x, y)| [x, y]).collect(),
                max_stages: secbird_core::commands::MAX_DPI_STAGES as u8,
            },
            _ => DpiState {
                active_stage: 1,
                stages: vec![[fallback_dpi.0, fallback_dpi.1]],
                max_stages: secbird_core::commands::MAX_DPI_STAGES as u8,
            },
        };

        let polling_options = match spec.and_then(|s| s.polling) {
            Some(Polling::High) => vec![125, 250, 500, 1000, 2000, 4000, 8000],
            _ => vec![125, 500, 1000],
        };
        let polling_hz = dev.polling_rate().ok();
        let sleep = dev.sleep_timer().ok().flatten();
        let sleep_minutes = sleep.map(|s| s.minutes);
        let sleep_max_minutes = sleep.map(|s| s.max_minutes);
        let auto_sleep = sleep.and_then(|s| s.auto_sleep);
        let has_auto_sleep = auto_sleep.is_some();

        let scroll_hw = dev.scroll_wheel().ok().flatten();
        let has_scroll = scroll_hw.is_some();
        let scroll = scroll_hw.map(|w| ScrollState {
            mode: w.mode.to_string(),
            precision: w.precision,
            disabled: w.disabled.into_iter().map(|m| m.to_string()).collect(),
            acceleration: w.acceleration.to_string(),
            smart_reel: w.smart_reel.to_string(),
        });

        let (has_macros, macros, macro_free_bytes, macro_max_bytes) = match dev.macro_storage() {
            Ok(storage) => {
                let list = dev
                    .macros()
                    .unwrap_or_default()
                    .into_iter()
                    .map(|m| {
                        let steps = dev.macro_steps(m.id).map(|s| Script(s).to_string()).unwrap_or_default();
                        MacroSummary {
                            id: m.id,
                            name: m.name,
                            steps,
                            size_bytes: m.size as usize,
                        }
                    })
                    .collect();
                (true, list, storage.free_bytes, storage.max_bytes)
            }
            Err(_) => (false, Vec::new(), 0, 0),
        };

        let leds = spec.map(|s| s.leds.clone()).unwrap_or_default();
        let has_lighting = !leds.is_empty();
        let has_game_mode = dev.game_mode().ok().flatten().is_some();
        let has_power = dev.power().ok().flatten().is_some();

        let capabilities = DeviceCapabilities {
            has_buttons: !normal_list.is_empty(),
            has_side_grid_12,
            has_side_hex_6,
            has_dpi: dpi_range.is_some() || polling_hz.is_some(),
            dpi_min: dpi_range.map_or(100, |r| r.min),
            dpi_max: dpi_range.map_or(30000, |r| r.max),
            dpi_step: dpi_range.map_or(50, |r| r.step),
            polling_options,
            sleep_max_minutes,
            has_auto_sleep,
            has_scroll,
            has_macros,
            has_lighting,
            has_game_mode,
            has_power,
        };

        // Gather brightness outside store borrow first
        let led_brightness: Vec<(u8, String, u8)> = leds
            .iter()
            .map(|l| (l.id, l.name.clone(), dev.brightness(l.id).unwrap_or(100)))
            .collect();

        // Read all button live & saved state cleanly before mutably borrowing self.store
        let raw_buttons: Vec<(String, String, Option<String>, Option<String>, Option<String>)> = normal_list
            .into_iter()
            .map(|(id, normal)| {
                let bname = button_name(id);
                let input = secbird_core::buttons::Input::Button(id);
                let hyper = dev.input(input, Layer::HyperShift).ok().map(|a| a.to_string());
                let saved_n = dev.saved_input(input, Layer::Normal).ok().map(|a| a.to_string());
                let saved_h = dev.saved_input(input, Layer::HyperShift).ok().map(|a| a.to_string());
                (bname, normal.to_string(), hyper, saved_n, saved_h)
            })
            .collect();

        let dp = self.store.for_device(dev);
        let active_profile = dp.active.clone();
        let remapped_map = &dp.active().buttons;

        let buttons: Vec<ButtonEntry> = raw_buttons
            .into_iter()
            .map(|(id, normal, hypershift, hw_saved_n, hw_saved_h)| {
                let k_n = secbird_core::buttons::setting_key(&id, Layer::Normal);
                let k_h = secbird_core::buttons::setting_key(&id, Layer::HyperShift);
                let remapped_normal = remapped_map.contains_key(&k_n);
                let remapped_hypershift = remapped_map.contains_key(&k_h);
                let saved_normal = if remapped_normal {
                    dp.onboard
                        .as_ref()
                        .and_then(|o| o.before.get(&k_n).cloned())
                        .or(hw_saved_n)
                        .unwrap_or_else(|| normal.clone())
                } else {
                    normal.clone()
                };
                let saved_hypershift = if remapped_hypershift {
                    dp.onboard
                        .as_ref()
                        .and_then(|o| o.before.get(&k_h).cloned())
                        .or(hw_saved_h)
                        .or_else(|| hypershift.clone())
                } else {
                    hypershift.clone()
                };
                ButtonEntry {
                    id,
                    normal,
                    hypershift,
                    remapped_normal,
                    remapped_hypershift,
                    saved_normal,
                    saved_hypershift,
                }
            })
            .collect();

        let onboard = dp.onboard.as_ref().map(|o| {
            let changed = dp.profiles.get(&o.profile).map(|p| &p.buttons) != Some(&o.buttons);
            OnboardStatus {
                slot: o.slot,
                profile: o.profile.clone(),
                count: o.buttons.len(),
                changed,
            }
        });

        let zones: Vec<LightingZoneState> = led_brightness
            .into_iter()
            .map(|(id, name, hw_bright)| {
                let z = dp.active().lighting.get(&name);
                LightingZoneState {
                    id,
                    name,
                    color: z.and_then(|s| s.color).map_or_else(|| "#d4af37".into(), |c| c.to_string()),
                    effect: z
                        .and_then(|s| s.effect.as_ref())
                        .map_or_else(|| "static".into(), ToString::to_string),
                    brightness: z.and_then(|s| s.brightness).unwrap_or(hw_bright),
                    off: z.is_some_and(|s| s.off),
                }
            })
            .collect();

        let lighting = LightingState {
            enabled: !dp.lighting_off,
            zones,
        };

        let profiles = dp
            .profiles
            .iter()
            .map(|(name, prof)| ProfileSummary {
                name: name.clone(),
                apps: prof.apps.clone(),
                custom_buttons_count: prof.buttons.len(),
            })
            .collect();

        DeviceSnapshot {
            mode: if self.simulated { "simulated".into() } else { "live".into() },
            device_key: key.clone(),
            name: dev.name(),
            kind: kind_label(spec.map(|s| s.kind)),
            pid_hex: format!("{:04X}", dev.pid),
            serial: dev.serial.clone(),
            firmware,
            battery_percent,
            charging,
            capabilities,
            buttons,
            onboard,
            dpi,
            polling_hz,
            sleep_minutes,
            auto_sleep,
            scroll,
            lighting,
            active_profile,
            profiles,
            macros,
            macro_free_bytes,
            macro_max_bytes,
            can_undo: self.undo_stacks.get(&key).is_some_and(|v| !v.is_empty()),
            can_redo: self.redo_stacks.get(&key).is_some_and(|v| !v.is_empty()),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use secbird_core::sim;

    fn test_bus() -> (BusEngine, PathBuf) {
        let db = Db::builtin().unwrap();
        let dev = sim::open_preset("naga", &db).expect("simulated naga");
        let path = std::env::temp_dir().join(format!(
            "grip-bus-v2-{}-{}.json",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map_or(0, |d| d.as_nanos())
        ));
        (BusEngine::new_with_devices(vec![dev], path.clone(), true), path)
    }

    #[test]
    fn left_click_stays_protected_on_normal_layer() {
        let (mut bus, path) = test_bus();
        let ws = bus.execute(BusCommand::GetWorkspace { device_key: None }).unwrap().workspace;
        let snap = ws.active_device.unwrap();
        let err = bus
            .execute(BusCommand::SetButton {
                device_key: snap.device_key,
                button: "left".into(),
                layer: LayerName::Normal,
                action: "key:q".into(),
            })
            .unwrap_err();
        assert_eq!(err.code, "PROTECTED_LEFT_CLICK");
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn exposes_all_21_naga_inputs_turbo_clutch_and_undo_redo() {
        let (mut bus, path) = test_bus();
        let snap = bus
            .execute(BusCommand::GetWorkspace { device_key: None })
            .unwrap()
            .workspace
            .active_device
            .unwrap();
        assert!(snap.capabilities.has_side_grid_12);
        assert!(snap.buttons.iter().any(|b| b.id == "dpi-up" || b.id == "dpi"));
        assert!(snap.buttons.iter().any(|b| b.id == "tilt-left"));
        assert!(snap.buttons.len() >= 19);

        let key = snap.device_key;
        let orig = snap.buttons.iter().find(|b| b.id == "grid-5").unwrap().normal.clone();

        let s1 = bus
            .execute(BusCommand::SetButton {
                device_key: key.clone(),
                button: "grid-5".into(),
                layer: LayerName::Normal,
                action: "turbo:left@25".into(),
            })
            .unwrap()
            .workspace
            .active_device
            .unwrap();
        let g5 = s1.buttons.iter().find(|b| b.id == "grid-5").unwrap();
        assert_eq!(g5.normal, "turbo:left@25");
        assert!(g5.remapped_normal);
        assert!(s1.can_undo);

        let s2 = bus
            .execute(BusCommand::SetButton {
                device_key: key.clone(),
                button: "grid-6".into(),
                layer: LayerName::Hypershift,
                action: "dpi-clutch:400".into(),
            })
            .unwrap()
            .workspace
            .active_device
            .unwrap();
        assert_eq!(
            s2.buttons.iter().find(|b| b.id == "grid-6").unwrap().hypershift.as_deref(),
            Some("dpi-clutch:400")
        );

        let undo = bus
            .execute(BusCommand::Undo { device_key: key.clone() })
            .unwrap()
            .workspace
            .active_device
            .unwrap();
        assert!(undo.can_redo);

        let _ = bus.execute(BusCommand::Undo { device_key: key.clone() }).unwrap();
        let after = bus
            .execute(BusCommand::GetWorkspace { device_key: None })
            .unwrap()
            .workspace
            .active_device
            .unwrap();
        assert_eq!(after.buttons.iter().find(|b| b.id == "grid-5").unwrap().normal, orig);

        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn xy_dpi_stages_onboard_save_put_back_and_profiles_work() {
        let (mut bus, path) = test_bus();
        let key = bus
            .execute(BusCommand::GetWorkspace { device_key: None })
            .unwrap()
            .workspace
            .active_device
            .unwrap()
            .device_key;

        let dpi_res = bus
            .execute(BusCommand::SetDpiStages {
                device_key: key.clone(),
                active_stage: 2,
                stages: vec![[800, 800], [1600, 1200], [3200, 3200]],
            })
            .unwrap()
            .workspace
            .active_device
            .unwrap();
        assert_eq!(dpi_res.dpi.active_stage, 2);
        assert_eq!(dpi_res.dpi.stages, vec![[800, 800], [1600, 1200], [3200, 3200]]);

        let saved = bus
            .execute(BusCommand::SaveOnboard { device_key: key.clone() })
            .unwrap()
            .workspace
            .active_device
            .unwrap();
        assert!(saved.onboard.is_some());

        let put_back = bus
            .execute(BusCommand::PutBackOnboard { device_key: key.clone() })
            .unwrap()
            .workspace
            .active_device
            .unwrap();
        assert!(put_back.onboard.is_none());

        let renamed = bus
            .execute(BusCommand::CreateProfile { device_key: key.clone(), name: "MMO".into() })
            .and_then(|_| {
                bus.execute(BusCommand::RenameProfile {
                    device_key: key.clone(),
                    old_name: "MMO".into(),
                    new_name: "Raids".into(),
                })
            })
            .unwrap()
            .workspace
            .active_device
            .unwrap();
        assert_eq!(renamed.active_profile, "Raids");

        let export = bus.execute(BusCommand::ExportProfiles).unwrap().exported_json.unwrap();
        assert!(export.contains("Raids"));
        let _ = bus.execute(BusCommand::ImportProfiles { json: export }).unwrap();

        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn settings_macro_and_missing_device_paths() {
        let (mut bus, path) = test_bus();
        let key = bus
            .execute(BusCommand::GetWorkspace { device_key: None })
            .unwrap()
            .workspace
            .active_device
            .unwrap()
            .device_key;

        let macro_resp = bus
            .execute(BusCommand::CreateMacro {
                device_key: key.clone(),
                name: "Burst".into(),
                steps: "tap:ctrl+c wait:25".into(),
            })
            .unwrap()
            .workspace
            .active_device
            .unwrap();
        assert_eq!(macro_resp.macros.len(), 1);
        let mid = macro_resp.macros[0].id;

        let _ = bus
            .execute(BusCommand::SetButton {
                device_key: key.clone(),
                button: "grid-1".into(),
                layer: LayerName::Normal,
                action: format!("macro:{mid}"),
            })
            .unwrap();
        let err_in_use = bus
            .execute(BusCommand::DeleteMacro { device_key: key.clone(), macro_id: mid })
            .unwrap_err();
        assert_eq!(err_in_use.code, "MACRO_IN_USE");

        let _ = bus.execute(BusCommand::ResetButton {
            device_key: key.clone(),
            button: "grid-1".into(),
            layer: LayerName::Normal,
        });
        let after_del = bus
            .execute(BusCommand::DeleteMacro { device_key: key, macro_id: mid })
            .unwrap()
            .workspace
            .active_device
            .unwrap();
        assert!(after_del.macros.is_empty());

        let mut next_settings = AppSettings::default();
        next_settings.battery_warning_at = 99;
        let ws = bus
            .execute(BusCommand::UpdateSettings { settings: next_settings })
            .unwrap()
            .workspace;
        assert_eq!(ws.settings.battery_warning_at, 95);

        let _ = std::fs::remove_file(&path);
        let _ = std::fs::remove_file(path.with_file_name("settings.json"));

        let empty_path = std::env::temp_dir().join("grip-empty-v2.json");
        let mut empty = BusEngine::new_with_devices(Vec::new(), empty_path.clone(), false);
        let err = empty
            .execute(BusCommand::CheckFirmware { device_key: "missing".into() })
            .unwrap_err();
        assert_eq!(err.code, "NO_DEVICE");
        let _ = std::fs::remove_file(empty_path);
    }

    #[test]
    fn low_battery_alert_and_tray_summary_work() {
        let (mut bus, path) = test_bus();
        let tray = bus.tray_summary();
        assert!(tray.tooltip.starts_with("Grip — "));
        assert!(tray.active_profile.is_some());

        let mut high_thresh = AppSettings::default();
        high_thresh.battery_warning = true;
        high_thresh.battery_warning_at = 95;
        let _ = bus.execute(BusCommand::UpdateSettings { settings: high_thresh }).unwrap();

        let first = bus.check_battery_alerts();
        assert_eq!(first.len(), 1);
        let second = bus.check_battery_alerts();
        assert!(second.is_empty());

        let mut low_thresh = AppSettings::default();
        low_thresh.battery_warning = true;
        low_thresh.battery_warning_at = 10;
        let _ = bus.execute(BusCommand::UpdateSettings { settings: low_thresh }).unwrap();
        assert!(bus.check_battery_alerts().is_empty());

        let _ = std::fs::remove_file(&path);
        let _ = std::fs::remove_file(path.with_file_name("settings.json"));
    }

    #[test]
    fn settings_theme_and_close_to_tray_defaults_and_normalization() {
        let (mut bus, path) = test_bus();
        let initial = bus
            .execute(BusCommand::GetWorkspace { device_key: None })
            .unwrap()
            .workspace
            .settings;
        assert_eq!(initial.theme, "system");
        assert!(initial.close_to_tray);

        let mut next = initial;
        next.theme = "light".into();
        next.close_to_tray = false;
        let updated = bus
            .execute(BusCommand::UpdateSettings { settings: next })
            .unwrap()
            .workspace
            .settings;
        assert_eq!(updated.theme, "light");
        assert!(!updated.close_to_tray);

        let mut invalid_theme = updated;
        invalid_theme.theme = "neon-invalid".into();
        let normalized = bus
            .execute(BusCommand::UpdateSettings { settings: invalid_theme })
            .unwrap()
            .workspace
            .settings;
        assert_eq!(normalized.theme, "system");

        let engine_wrap = AppBus(Mutex::new(bus));
        assert!(!engine_wrap.close_to_tray());

        let _ = std::fs::remove_file(&path);
        let _ = std::fs::remove_file(path.with_file_name("settings.json"));
    }
}
