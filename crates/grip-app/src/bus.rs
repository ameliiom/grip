use crate::raw_accel::{self, RawAccelStatus};
use crate::settings::{grip_config_dir, set_autostart, AppSettings, RawAccelSettings, WindowBounds};
use crate::smoother::{self, SmootherStatus};
use crate::win_host::{self, RunningApp};
use secbird_core::actions;
use secbird_core::buttons::{button_name, Layer};
use secbird_core::db::{Db, Kind, Polling};
use secbird_core::features::DpiStages;
use secbird_core::macros::Script;
use secbird_core::scroll::parse_modes;
use secbird_core::{discover, hidapi::HidApi, Device, Store};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashSet};
use std::path::PathBuf;
use std::str::FromStr;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::{Duration, Instant};

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
    pub smoother_status: SmootherStatus,
    pub raw_accel_status: RawAccelStatus,
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
    ApplyRawAccel {
        settings: RawAccelSettings,
    },
    OpenRawAccelDownload,
    RefreshMotionStatus,
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
    pub(crate) fn new(code: &str, ar: &str, en: &str, recovery: &str) -> Self {
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

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TraySummary {
    pub locale: String,
    pub tooltip: String,
    pub active_profile: Option<String>,
    pub profiles: Vec<String>,
}

#[derive(Default, Clone, Copy)]
struct UnsupportedCaps {
    no_scroll: bool,
    no_macros: bool,
    no_game_mode: bool,
    no_power: bool,
}

enum RefreshPlan {
    None { force_raw_accel: bool },
    EnsureActive,
    PatchMetadata(String),
    PatchDpi(String, DpiStages),
    PatchPolling(String, u32),
    PatchSleep(String, Option<u16>, Option<bool>),
    PatchButton(String, String),
    PatchLighting(Option<String>),
    FullActive,
    FullAll,
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
    cached_summaries: Vec<DeviceSummary>,
    cached_snapshots: BTreeMap<String, DeviceSnapshot>,
    unsupported_caps: BTreeMap<String, UnsupportedCaps>,
    cached_running_apps: Vec<RunningApp>,
    running_apps_at: Option<Instant>,
    cached_synapse: Vec<String>,
    synapse_at: Option<Instant>,
    cached_raw_accel: Option<RawAccelStatus>,
    raw_accel_at: Option<Instant>,
}

pub struct AppBus {
    engine: Mutex<BusEngine>,
    dark_theme: AtomicBool,
    close_to_tray_flag: AtomicBool,
    tray_cache: Mutex<TraySummary>,
}

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
            cached_summaries: Vec::new(),
            cached_snapshots: BTreeMap::new(),
            unsupported_caps: BTreeMap::new(),
            cached_running_apps: Vec::new(),
            running_apps_at: None,
            cached_synapse: Vec::new(),
            synapse_at: None,
            cached_raw_accel: None,
            raw_accel_at: None,
        };
        let _ = engine.rescan();
        engine.sync_smoother();
        #[cfg(not(test))]
        if !engine.simulated && engine.settings.raw_accel.enabled {
            let ra_cfg = engine.settings.raw_accel.clone();
            std::thread::spawn(move || {
                if raw_accel::detect_status().driver_running {
                    let _ = raw_accel::apply_settings(&ra_cfg);
                }
            });
        }
        Self::from_engine(engine)
    }

    pub fn from_engine(mut engine: BusEngine) -> Self {
        let dark = engine.is_dark_theme_now();
        let close_tray = engine.settings.close_to_tray;
        let tray = engine.tray_summary();
        Self {
            engine: Mutex::new(engine),
            dark_theme: AtomicBool::new(dark),
            close_to_tray_flag: AtomicBool::new(close_tray),
            tray_cache: Mutex::new(tray),
        }
    }

    fn sync_ui_cache(&self, engine: &mut BusEngine) {
        self.dark_theme.store(engine.is_dark_theme_now(), Ordering::Relaxed);
        self.close_to_tray_flag
            .store(engine.settings.close_to_tray, Ordering::Relaxed);
        let tray = engine.tray_summary();
        let mut guard = self.tray_cache.lock().unwrap_or_else(|p| p.into_inner());
        *guard = tray;
    }

    pub fn execute(&self, cmd: BusCommand) -> Result<BusResponse, CommandError> {
        let mut guard = self.engine.lock().unwrap_or_else(|p| p.into_inner());
        let res = guard.execute(cmd);
        self.sync_ui_cache(&mut guard);
        res
    }

    pub fn handle_foreground_app(&self, exe: &str) -> bool {
        let norm = secbird_core::profile::normalize_app(exe);
        if !norm.is_empty() {
            smoother::notify_foreground_changed(&norm, win_host::is_foreground_fullscreen());
        }
        let mut guard = self.engine.lock().unwrap_or_else(|p| p.into_inner());
        let changed = guard.handle_foreground_app_normalized(&norm);
        if changed {
            self.sync_ui_cache(&mut guard);
        }
        changed
    }

    pub fn reapply_active(&self) {
        let mut guard = self.engine.lock().unwrap_or_else(|p| p.into_inner());
        guard.reapply_active();
        self.sync_ui_cache(&mut guard);
    }

    pub fn rescan_and_reapply(&self) -> bool {
        let mut guard = self.engine.lock().unwrap_or_else(|p| p.into_inner());
        let changed = guard.rescan_and_reapply();
        self.sync_ui_cache(&mut guard);
        changed
    }

    pub fn check_battery_alerts(&self) -> Vec<String> {
        let mut guard = self.engine.lock().unwrap_or_else(|p| p.into_inner());
        let fired = guard.check_battery_alerts();
        self.sync_ui_cache(&mut guard);
        fired
    }

    pub fn tray_summary(&self) -> TraySummary {
        self.tray_cache.lock().unwrap_or_else(|p| p.into_inner()).clone()
    }

    pub fn select_profile_from_tray(&self, name: &str) -> bool {
        let mut guard = self.engine.lock().unwrap_or_else(|p| p.into_inner());
        let Some(key) = guard.active_key.clone().or_else(|| guard.devices.first().map(Device::key)) else {
            return false;
        };
        let ok = guard
            .execute(BusCommand::SelectProfile {
                device_key: key,
                name: name.to_string(),
            })
            .is_ok();
        if ok {
            self.sync_ui_cache(&mut guard);
        }
        ok
    }

    pub fn is_dark_theme(&self) -> bool {
        self.dark_theme.load(Ordering::Relaxed)
    }

    pub fn close_to_tray(&self) -> bool {
        self.close_to_tray_flag.load(Ordering::Relaxed)
    }

    pub fn window_bounds(&self) -> Option<WindowBounds> {
        let guard = self.engine.lock().unwrap_or_else(|p| p.into_inner());
        guard.settings.window_bounds
    }

    pub fn save_window_bounds(&self, bounds: WindowBounds) {
        let mut guard = self.engine.lock().unwrap_or_else(|p| p.into_inner());
        if guard.settings.window_bounds == Some(bounds) {
            return;
        }
        guard.settings.window_bounds = Some(bounds);
        guard.settings.save(&guard.settings_path);
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
            cached_summaries: Vec::new(),
            cached_snapshots: BTreeMap::new(),
            unsupported_caps: BTreeMap::new(),
            cached_running_apps: Vec::new(),
            running_apps_at: None,
            cached_synapse: Vec::new(),
            synapse_at: None,
            cached_raw_accel: None,
            raw_accel_at: None,
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
        self.cached_snapshots.clear();
        self.cached_summaries.clear();
        self.unsupported_caps.clear();
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
        let check_alert = self.settings.battery_warning;
        if !check_alert {
            self.low_battery_notified.clear();
        }
        let threshold = self.settings.battery_warning_at;
        let is_ar = self.settings.locale == "ar";
        let mut fired = Vec::new();
        for dev in &self.devices {
            let key = dev.key();
            let Some(pct) = dev.battery().ok().flatten() else {
                continue;
            };
            let charging = dev.charging().ok();
            if let Some(s) = self.cached_summaries.iter_mut().find(|s| s.device_key == key) {
                s.battery_percent = Some(pct);
                s.charging = charging;
            }
            if let Some(snap) = self.cached_snapshots.get_mut(&key) {
                snap.battery_percent = Some(pct);
                snap.charging = charging;
            }
            if !check_alert {
                continue;
            }
            if charging.unwrap_or(false) || pct >= threshold.saturating_add(5) {
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

    pub fn is_dark_theme_now(&self) -> bool {
        match self.settings.theme.as_str() {
            "dark" => true,
            "light" => false,
            _ => win_host::windows_prefers_dark(),
        }
    }

    pub fn tray_summary(&mut self) -> TraySummary {
        let locale = self.settings.locale.clone();
        if let Ok(idx) = self.find_device(None) {
            let key = self.devices[idx].key();
            let title = clean_device_title(&self.devices[idx].name());
            let bat = self
                .cached_summaries
                .iter()
                .find(|s| s.device_key == key)
                .and_then(|s| s.battery_percent)
                .or_else(|| self.cached_snapshots.get(&key).and_then(|s| s.battery_percent));
            let dp = self.store.for_device(&self.devices[idx]);
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

    pub fn handle_foreground_app_normalized(&mut self, norm: &str) -> bool {
        if !self.settings.auto_switch || norm.is_empty() {
            return false;
        }
        let is_ar = self.settings.locale == "ar";
        let mut changed = false;
        for dev in &self.devices {
            let key = dev.key();
            let dp = self.store.for_device(dev);
            let want = dp.effective(Some(norm)).to_string();
            let prev = self.foreground_applied.get(&key).cloned().unwrap_or_else(|| dp.active.clone());
            if want != prev {
                let _ = dp.apply(&want, dev);
                self.foreground_applied.insert(key.clone(), want.clone());
                self.cached_snapshots.remove(&key);
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
        let plan;

        match cmd {
            BusCommand::GetWorkspace { device_key } => {
                if let Some(k) = device_key.filter(|s| !s.is_empty()) {
                    if self.devices.iter().any(|d| d.key() == k) {
                        self.active_key = Some(k);
                    }
                }
                plan = RefreshPlan::EnsureActive;
            }
            BusCommand::SelectDevice { device_key } => {
                let idx = self.find_device(Some(&device_key))?;
                self.active_key = Some(self.devices[idx].key());
                plan = RefreshPlan::EnsureActive;
            }
            BusCommand::Rescan => {
                self.rescan()?;
                plan = RefreshPlan::FullAll;
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
                        button: button.clone(),
                        layer,
                        before,
                        after: Some(action),
                    },
                );
                plan = RefreshPlan::PatchButton(key, button);
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
                        button: button.clone(),
                        layer,
                        before,
                        after: None,
                    },
                );
                plan = RefreshPlan::PatchButton(key, button);
            }
            BusCommand::RestoreAllButtons { device_key } => {
                let idx = self.find_device(Some(&device_key))?;
                let key = self.devices[idx].key();
                actions::restore_all_buttons(&self.devices[idx], &mut self.store)
                    .map_err(CommandError::from_core)?;
                self.undo_stacks.remove(&key);
                self.redo_stacks.remove(&key);
                plan = RefreshPlan::FullActive;
            }
            BusCommand::SaveOnboard { device_key } => {
                let idx = self.find_device(Some(&device_key))?;
                actions::save_buttons_to_mouse(&self.devices[idx], &mut self.store)
                    .map_err(CommandError::from_core)?;
                plan = RefreshPlan::FullActive;
            }
            BusCommand::PutBackOnboard { device_key } => {
                let idx = self.find_device(Some(&device_key))?;
                actions::put_back_onboard(&self.devices[idx], &mut self.store)
                    .map_err(CommandError::from_core)?;
                plan = RefreshPlan::FullActive;
            }
            BusCommand::SetDpiStage { device_key, stage } => {
                let idx = self.find_device(Some(&device_key))?;
                let key = self.devices[idx].key();
                let before = self
                    .cached_snapshots
                    .get(&key)
                    .filter(|s| !s.dpi.stages.is_empty())
                    .map(|s| DpiStages {
                        active: s.dpi.active_stage,
                        stages: s.dpi.stages.iter().map(|&[x, y]| (x, y)).collect(),
                    })
                    .unwrap_or_else(|| self.devices[idx].dpi_stages().unwrap_or_else(|_| DpiStages {
                        active: 1,
                        stages: vec![(1600, 1600)],
                    }));
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
                self.push_undo(&key, HistoryOp::DpiStages { before, after: after.clone() });
                let label = if xy.0 == xy.1 {
                    format!("{} DPI", xy.0)
                } else {
                    format!("{}×{} DPI", xy.0, xy.1)
                };
                self.osd_if_enabled(label);
                plan = RefreshPlan::PatchDpi(key, after);
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
                let before = self
                    .cached_snapshots
                    .get(&key)
                    .filter(|s| !s.dpi.stages.is_empty())
                    .map(|s| DpiStages {
                        active: s.dpi.active_stage,
                        stages: s.dpi.stages.iter().map(|&[x, y]| (x, y)).collect(),
                    })
                    .unwrap_or_else(|| self.devices[idx].dpi_stages().unwrap_or_else(|_| DpiStages {
                        active: 1,
                        stages: vec![(1600, 1600)],
                    }));
                let want = DpiStages {
                    active: active_stage,
                    stages: stages.into_iter().map(|[x, y]| (x, y)).collect(),
                };
                let applied = actions::set_dpi_stages(&self.devices[idx], &mut self.store, &want)
                    .map_err(CommandError::from_core)?;
                self.push_undo(&key, HistoryOp::DpiStages { before, after: applied.clone() });
                plan = RefreshPlan::PatchDpi(key, applied);
            }
            BusCommand::SetPolling { device_key, hz } => {
                let idx = self.find_device(Some(&device_key))?;
                let key = self.devices[idx].key();
                let before = self
                    .cached_snapshots
                    .get(&key)
                    .and_then(|s| s.polling_hz)
                    .unwrap_or_else(|| self.devices[idx].polling_rate().unwrap_or(1000));
                actions::set_polling(&self.devices[idx], &mut self.store, hz)
                    .map_err(CommandError::from_core)?;
                self.push_undo(&key, HistoryOp::Polling { before, after: hz });
                plan = RefreshPlan::PatchPolling(key, hz);
            }
            BusCommand::SetSleep { device_key, minutes, auto_sleep } => {
                let idx = self.find_device(Some(&device_key))?;
                let key = self.devices[idx].key();
                if let Some(on) = auto_sleep {
                    actions::set_auto_sleep(&self.devices[idx], &mut self.store, on)
                        .map_err(CommandError::from_core)?;
                }
                if let Some(mins) = minutes {
                    let before = self
                        .cached_snapshots
                        .get(&key)
                        .and_then(|s| s.sleep_minutes)
                        .unwrap_or_else(|| {
                            self.devices[idx]
                                .sleep_timer()
                                .ok()
                                .flatten()
                                .map_or(5, |s| s.minutes)
                        });
                    actions::set_sleep_minutes(&self.devices[idx], &mut self.store, mins)
                        .map_err(CommandError::from_core)?;
                    self.push_undo(&key, HistoryOp::Sleep { before, after: mins });
                }
                plan = RefreshPlan::PatchSleep(key, minutes, auto_sleep);
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
                plan = RefreshPlan::FullActive;
            }
            BusCommand::SelectProfile { device_key, name } => {
                let idx = self.find_device(Some(&device_key))?;
                let key = self.devices[idx].key();
                {
                    let dp = self.store.for_device(&self.devices[idx]);
                    dp.switch(&name).map_err(CommandError::from_core)?;
                    let _ = dp.apply(&name, &self.devices[idx]);
                }
                self.store.save().map_err(CommandError::from_core)?;
                self.foreground_applied.insert(key, name.clone());
                let msg = if self.settings.locale == "ar" {
                    format!("البروفايل: {name}")
                } else {
                    format!("Profile: {name}")
                };
                self.osd_if_enabled(msg);
                plan = RefreshPlan::FullActive;
            }
            BusCommand::CreateProfile { device_key, name } => {
                let idx = self.find_device(Some(&device_key))?;
                let key = self.devices[idx].key();
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
                plan = RefreshPlan::PatchMetadata(key);
            }
            BusCommand::RenameProfile { device_key, old_name, new_name } => {
                let idx = self.find_device(Some(&device_key))?;
                let key = self.devices[idx].key();
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
                plan = RefreshPlan::PatchMetadata(key);
            }
            BusCommand::DeleteProfile { device_key, name } => {
                let idx = self.find_device(Some(&device_key))?;
                let key = self.devices[idx].key();
                self.store
                    .for_device(&self.devices[idx])
                    .delete(&name)
                    .map_err(CommandError::from_core)?;
                self.store.save().map_err(CommandError::from_core)?;
                self.sync_smoother();
                plan = RefreshPlan::PatchMetadata(key);
            }
            BusCommand::SetProfileApps { device_key, name, apps } => {
                let idx = self.find_device(Some(&device_key))?;
                let key = self.devices[idx].key();
                self.store
                    .for_device(&self.devices[idx])
                    .set_apps(&name, &apps)
                    .map_err(CommandError::from_core)?;
                self.store.save().map_err(CommandError::from_core)?;
                self.sync_smoother();
                plan = RefreshPlan::PatchMetadata(key);
            }
            BusCommand::ExportProfiles => {
                exported_json = Some(
                    serde_json::to_string_pretty(&self.store)
                        .map_err(|e| CommandError::from_core(secbird_core::Error::Db(e.to_string())))?,
                );
                plan = RefreshPlan::None { force_raw_accel: false };
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
                self.sync_smoother();
                self.cached_snapshots.clear();
                plan = RefreshPlan::FullActive;
            }
            BusCommand::CreateMacro { device_key, name, steps } => {
                let idx = self.find_device(Some(&device_key))?;
                let script = Script::from_str(&steps).map_err(CommandError::from_core)?;
                self.devices[idx]
                    .create_macro(&name, &script.0)
                    .map_err(CommandError::from_core)?;
                plan = RefreshPlan::FullActive;
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
                plan = RefreshPlan::FullActive;
            }
            BusCommand::SetLightingControl { device_key, enabled } => {
                let idx = self.find_device(Some(&device_key))?;
                let key = self.devices[idx].key();
                actions::set_lighting_control(&self.devices[idx], &mut self.store, enabled)
                    .map_err(CommandError::from_core)?;
                plan = RefreshPlan::PatchLighting(Some(key));
            }
            BusCommand::SetLightingColor { device_key, zone, color } => {
                let idx = self.find_device(Some(&device_key))?;
                let key = self.devices[idx].key();
                let rgb = color.parse().map_err(CommandError::from_core)?;
                actions::set_color(&self.devices[idx], &mut self.store, &zone, rgb)
                    .map_err(CommandError::from_core)?;
                plan = RefreshPlan::PatchLighting(Some(key));
            }
            BusCommand::SetLightingBrightness { device_key, zone, percent } => {
                let idx = self.find_device(Some(&device_key))?;
                let key = self.devices[idx].key();
                actions::set_brightness(&self.devices[idx], &mut self.store, &zone, percent)
                    .map_err(CommandError::from_core)?;
                plan = RefreshPlan::PatchLighting(Some(key));
            }
            BusCommand::SetLightingEffect { device_key, zone, effect } => {
                let idx = self.find_device(Some(&device_key))?;
                let key = self.devices[idx].key();
                let parsed = effect.parse().map_err(CommandError::from_core)?;
                actions::set_effect(&self.devices[idx], &mut self.store, &zone, parsed)
                    .map_err(CommandError::from_core)?;
                plan = RefreshPlan::PatchLighting(Some(key));
            }
            BusCommand::SetLightingOff { device_key, zone } => {
                let idx = self.find_device(Some(&device_key))?;
                let key = self.devices[idx].key();
                actions::lights_off(&self.devices[idx], &mut self.store, &zone)
                    .map_err(CommandError::from_core)?;
                plan = RefreshPlan::PatchLighting(Some(key));
            }
            BusCommand::SyncLighting { color, effect } => {
                if let Some(eff) = effect.filter(|s| !s.is_empty()) {
                    let parsed = eff.parse().map_err(CommandError::from_core)?;
                    let _ = actions::sync_effect(&self.devices, &mut self.store, &parsed);
                } else if let Some(col) = color.filter(|s| !s.is_empty()) {
                    let rgb = col.parse().map_err(CommandError::from_core)?;
                    let _ = actions::sync_color(&self.devices, &mut self.store, rgb);
                }
                plan = RefreshPlan::PatchLighting(None);
            }
            BusCommand::UpdateSettings { mut settings } => {
                settings.normalize();
                settings.window_bounds = self.settings.window_bounds;
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
                self.sync_smoother();
                plan = RefreshPlan::None { force_raw_accel: false };
            }
            BusCommand::ApplyRawAccel { mut settings } => {
                settings.normalize();
                self.settings.raw_accel = settings.clone();
                self.settings.save(&self.settings_path);
                raw_accel::apply_settings(&settings).map_err(|msg| {
                    CommandError::new(
                        "RAW_ACCEL_APPLY_FAILED",
                        &format!("تعذّر تطبيق تنعيم الألعاب: {msg}"),
                        &msg,
                        "Install Raw Accel driver first",
                    )
                })?;
                plan = RefreshPlan::None { force_raw_accel: true };
            }
            BusCommand::OpenRawAccelDownload => {
                raw_accel::open_release_page();
                plan = RefreshPlan::None { force_raw_accel: false };
            }
            BusCommand::RefreshMotionStatus => {
                plan = RefreshPlan::None { force_raw_accel: true };
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
                plan = RefreshPlan::None { force_raw_accel: false };
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
                plan = RefreshPlan::None { force_raw_accel: false };
            }
            BusCommand::OpenConfigFolder => {
                win_host::open_folder(&grip_config_dir());
                plan = RefreshPlan::None { force_raw_accel: false };
            }
            BusCommand::Undo { device_key } => {
                let idx = self.find_device(Some(&device_key))?;
                let key = self.devices[idx].key();
                if let Some(op) = self.undo_stacks.get_mut(&key).and_then(Vec::pop) {
                    self.apply_history_op(idx, &op, true)?;
                    self.redo_stacks.entry(key).or_default().push(op);
                }
                plan = RefreshPlan::FullActive;
            }
            BusCommand::Redo { device_key } => {
                let idx = self.find_device(Some(&device_key))?;
                let key = self.devices[idx].key();
                if let Some(op) = self.redo_stacks.get_mut(&key).and_then(Vec::pop) {
                    self.apply_history_op(idx, &op, false)?;
                    self.undo_stacks.entry(key).or_default().push(op);
                }
                plan = RefreshPlan::FullActive;
            }
        }

        let workspace = self.workspace_snapshot(plan);
        Ok(BusResponse {
            workspace,
            firmware_check,
            diagnostic_report,
            exported_json,
        })
    }

    fn build_summaries(&self) -> Vec<DeviceSummary> {
        self.devices
            .iter()
            .map(|d| DeviceSummary {
                device_key: d.key(),
                name: d.name(),
                kind: kind_label(d.spec.as_ref().map(|s| s.kind)),
                pid_hex: format!("{:04X}", d.pid),
                battery_percent: d.battery().ok().flatten(),
                charging: d.charging().ok(),
            })
            .collect()
    }

    fn sync_metadata_into_cache(&mut self, key: &str) {
        let Some(idx) = self.devices.iter().position(|d| d.key() == key) else {
            return;
        };
        let (active_profile, onboard, profiles) = {
            let dp = self.store.for_device(&self.devices[idx]);
            let onboard = dp.onboard.as_ref().map(|o| {
                let changed = dp.profiles.get(&o.profile).map(|p| &p.buttons) != Some(&o.buttons);
                OnboardStatus {
                    slot: o.slot,
                    profile: o.profile.clone(),
                    count: o.buttons.len(),
                    changed,
                }
            });
            let profiles = dp
                .profiles
                .iter()
                .map(|(n, prof)| ProfileSummary {
                    name: n.clone(),
                    apps: prof.apps.clone(),
                    custom_buttons_count: prof.buttons.len(),
                })
                .collect();
            (dp.active.clone(), onboard, profiles)
        };
        if let Some(snap) = self.cached_snapshots.get_mut(key) {
            snap.active_profile = active_profile;
            snap.onboard = onboard;
            snap.profiles = profiles;
        }
    }

    fn sync_lighting_into_cache(&mut self, key: &str) {
        let Some(idx) = self.devices.iter().position(|d| d.key() == key) else {
            return;
        };
        let dp = self.store.for_device(&self.devices[idx]);
        if let Some(snap) = self.cached_snapshots.get_mut(key) {
            snap.lighting.enabled = !dp.lighting_off;
            for zone in &mut snap.lighting.zones {
                if let Some(z) = dp.active().lighting.get(&zone.name) {
                    if let Some(c) = z.color {
                        zone.color = c.to_string();
                    }
                    if let Some(eff) = z.effect.as_ref() {
                        zone.effect = eff.to_string();
                    }
                    if let Some(b) = z.brightness {
                        zone.brightness = b;
                    }
                    zone.off = z.off;
                }
            }
        }
    }

    fn patch_button_in_cache(&mut self, key: &str, button: &str) {
        let Some(idx) = self.devices.iter().position(|d| d.key() == key) else {
            return;
        };
        let Some(id) = secbird_core::buttons::button_id(button) else {
            self.cached_snapshots.remove(key);
            return;
        };
        let k_n = secbird_core::buttons::setting_key(button, Layer::Normal);
        let k_h = secbird_core::buttons::setting_key(button, Layer::HyperShift);
        let (remapped_normal, remapped_hypershift, onboard_n, onboard_h) = {
            let dp = self.store.for_device(&self.devices[idx]);
            let remapped = &dp.active().buttons;
            let ob = dp.onboard.as_ref();
            (
                remapped.contains_key(&k_n),
                remapped.contains_key(&k_h),
                ob.and_then(|o| o.before.get(&k_n).cloned()),
                ob.and_then(|o| o.before.get(&k_h).cloned()),
            )
        };
        let input = secbird_core::buttons::Input::Button(id);
        let dev = &self.devices[idx];
        let Ok(normal_act) = dev.button(id, Layer::Normal) else {
            self.cached_snapshots.remove(key);
            return;
        };
        let normal = normal_act.to_string();
        let hypershift = dev.input(input, Layer::HyperShift).ok().map(|a| a.to_string());
        let saved_normal = if remapped_normal {
            onboard_n
                .or_else(|| dev.saved_input(input, Layer::Normal).ok().map(|a| a.to_string()))
                .unwrap_or_else(|| normal.clone())
        } else {
            normal.clone()
        };
        let saved_hypershift = if remapped_hypershift {
            onboard_h
                .or_else(|| dev.saved_input(input, Layer::HyperShift).ok().map(|a| a.to_string()))
                .or_else(|| hypershift.clone())
        } else {
            hypershift.clone()
        };

        let can_undo = self.undo_stacks.get(key).is_some_and(|v| !v.is_empty());
        let can_redo = self.redo_stacks.get(key).is_some_and(|v| !v.is_empty());
        if let Some(snap) = self.cached_snapshots.get_mut(key) {
            if let Some(entry) = snap.buttons.iter_mut().find(|b| b.id == button) {
                entry.normal = normal;
                entry.hypershift = hypershift;
                entry.remapped_normal = remapped_normal;
                entry.remapped_hypershift = remapped_hypershift;
                entry.saved_normal = saved_normal;
                entry.saved_hypershift = saved_hypershift;
            }
            snap.can_undo = can_undo;
            snap.can_redo = can_redo;
        }
        self.sync_metadata_into_cache(key);
    }

    fn active_device_index(&self) -> Option<usize> {
        if self.devices.is_empty() {
            None
        } else {
            self.active_key
                .as_ref()
                .and_then(|k| self.devices.iter().position(|d| d.key() == *k))
                .or(Some(0))
        }
    }

    fn workspace_snapshot(&mut self, plan: RefreshPlan) -> WorkspaceSnapshot {
        let mut force_os_caches = false;
        let mut force_raw_accel = false;

        if self.cached_summaries.len() != self.devices.len() && !matches!(plan, RefreshPlan::FullAll) {
            self.cached_summaries = self.build_summaries();
        }

        match plan {
            RefreshPlan::None { force_raw_accel: fra } => {
                force_raw_accel = fra;
            }
            RefreshPlan::EnsureActive => {}
            RefreshPlan::PatchMetadata(key) => {
                self.sync_metadata_into_cache(&key);
            }
            RefreshPlan::PatchDpi(key, st) => {
                let can_undo = self.undo_stacks.get(&key).is_some_and(|v| !v.is_empty());
                let can_redo = self.redo_stacks.get(&key).is_some_and(|v| !v.is_empty());
                if let Some(snap) = self.cached_snapshots.get_mut(&key) {
                    snap.dpi = DpiState {
                        active_stage: st.active,
                        stages: st.stages.into_iter().map(|(x, y)| [x, y]).collect(),
                        max_stages: secbird_core::commands::MAX_DPI_STAGES as u8,
                    };
                    snap.can_undo = can_undo;
                    snap.can_redo = can_redo;
                }
            }
            RefreshPlan::PatchPolling(key, hz) => {
                let can_undo = self.undo_stacks.get(&key).is_some_and(|v| !v.is_empty());
                let can_redo = self.redo_stacks.get(&key).is_some_and(|v| !v.is_empty());
                if let Some(snap) = self.cached_snapshots.get_mut(&key) {
                    snap.polling_hz = Some(hz);
                    snap.can_undo = can_undo;
                    snap.can_redo = can_redo;
                }
            }
            RefreshPlan::PatchSleep(key, mins, auto_on) => {
                let can_undo = self.undo_stacks.get(&key).is_some_and(|v| !v.is_empty());
                let can_redo = self.redo_stacks.get(&key).is_some_and(|v| !v.is_empty());
                if let Some(snap) = self.cached_snapshots.get_mut(&key) {
                    if let Some(m) = mins {
                        snap.sleep_minutes = Some(m);
                    }
                    if let Some(on) = auto_on {
                        snap.auto_sleep = Some(on);
                    }
                    snap.can_undo = can_undo;
                    snap.can_redo = can_redo;
                }
            }
            RefreshPlan::PatchButton(key, button) => {
                if self.cached_snapshots.contains_key(&key) {
                    self.patch_button_in_cache(&key, &button);
                }
            }
            RefreshPlan::PatchLighting(maybe_key) => match maybe_key {
                Some(key) => self.sync_lighting_into_cache(&key),
                None => {
                    let keys: Vec<String> = self.cached_snapshots.keys().cloned().collect();
                    for k in keys {
                        self.sync_lighting_into_cache(&k);
                    }
                }
            },
            RefreshPlan::FullActive => {
                if let Some(i) = self.active_device_index() {
                    let key = self.devices[i].key();
                    let snap = self.snapshot_for(i);
                    self.cached_snapshots.insert(key, snap);
                }
            }
            RefreshPlan::FullAll => {
                force_os_caches = true;
                force_raw_accel = true;
                self.cached_summaries = self.build_summaries();
                self.cached_snapshots.clear();
            }
        }

        let active_device = self.active_device_index().map(|i| {
            let key = self.devices[i].key();
            if let Some(cached) = self.cached_snapshots.get(&key) {
                cached.clone()
            } else {
                let fresh = self.snapshot_for(i);
                self.cached_snapshots.insert(key, fresh.clone());
                fresh
            }
        });

        let running_apps_stale = force_os_caches
            || self
                .running_apps_at
                .is_none_or(|t| t.elapsed() >= Duration::from_secs(5));
        if running_apps_stale {
            self.cached_running_apps = win_host::running_apps();
            self.running_apps_at = Some(Instant::now());
        }

        let synapse_stale = force_os_caches
            || self
                .synapse_at
                .is_none_or(|t| t.elapsed() >= Duration::from_secs(15));
        if synapse_stale {
            #[cfg(windows)]
            {
                self.cached_synapse = secbird_core::debloat::synapse_running();
            }
            #[cfg(not(windows))]
            {
                self.cached_synapse = Vec::new();
            }
            self.synapse_at = Some(Instant::now());
        }

        let raw_accel_stale = force_os_caches
            || force_raw_accel
            || self.cached_raw_accel.is_none()
            || self
                .raw_accel_at
                .is_none_or(|t| t.elapsed() >= Duration::from_secs(3));
        if raw_accel_stale {
            self.cached_raw_accel = Some(raw_accel::detect_status());
            self.raw_accel_at = Some(Instant::now());
        }

        WorkspaceSnapshot {
            devices: self.cached_summaries.clone(),
            active_device,
            synapse_running: self.cached_synapse.clone(),
            running_apps: self.cached_running_apps.clone(),
            settings: self.settings.clone(),
            smoother_status: smoother::status(),
            raw_accel_status: self.cached_raw_accel.clone().unwrap_or_default(),
        }
    }

    fn sync_smoother(&self) {
        let mut games: HashSet<String> = self.store.apps();
        games.extend(["overwatch.exe".to_string(), "rumbleverseclient.exe".to_string()]);
        smoother::sync_config(&self.settings.desktop_smooth, &games);
    }

    fn snapshot_for(&mut self, idx: usize) -> DeviceSnapshot {
        let key = self.devices[idx].key();
        let (remapped_keys, onboard_before) = {
            let dp = self.store.for_device(&self.devices[idx]);
            let remapped: HashSet<String> = dp.active().buttons.keys().cloned().collect();
            let before = dp.onboard.as_ref().map(|o| o.before.clone()).unwrap_or_default();
            (remapped, before)
        };
        let mut caps = self.unsupported_caps.get(&key).copied().unwrap_or_default();

        let dev = &self.devices[idx];
        let firmware = dev.firmware_version().unwrap_or_else(|_| "—".into());
        let (battery_percent, charging) = match self.cached_summaries.iter().find(|s| s.device_key == key) {
            Some(s) => (s.battery_percent, s.charging),
            None => (dev.battery().ok().flatten(), dev.charging().ok()),
        };
        let normal_list = dev.buttons();

        let button_ids: Vec<u8> = normal_list.iter().map(|(id, _)| *id).collect();
        let has_side_grid_12 =
            dev.name().contains("Naga") || button_ids.iter().any(|id| (64..=75).contains(id));
        let has_side_hex_6 = button_ids.iter().any(|id| (80..=86).contains(id));

        let spec = dev.spec.as_ref();
        let dpi_range = spec.and_then(|s| s.dpi.as_ref());
        let dpi_stages = dev.dpi_stages().ok();
        let dpi = match dpi_stages {
            Some(st) if !st.stages.is_empty() => DpiState {
                active_stage: st.active,
                stages: st.stages.into_iter().map(|(x, y)| [x, y]).collect(),
                max_stages: secbird_core::commands::MAX_DPI_STAGES as u8,
            },
            _ => {
                let fallback_dpi = dev.dpi().ok().unwrap_or((1600, 1600));
                DpiState {
                    active_stage: 1,
                    stages: vec![[fallback_dpi.0, fallback_dpi.1]],
                    max_stages: secbird_core::commands::MAX_DPI_STAGES as u8,
                }
            }
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

        let scroll_hw = if caps.no_scroll {
            None
        } else {
            match dev.scroll_wheel().ok().flatten() {
                Some(v) => Some(v),
                None => {
                    caps.no_scroll = true;
                    None
                }
            }
        };
        let has_scroll = scroll_hw.is_some();
        let scroll = scroll_hw.map(|w| ScrollState {
            mode: w.mode.to_string(),
            precision: w.precision,
            disabled: w.disabled.into_iter().map(|m| m.to_string()).collect(),
            acceleration: w.acceleration.to_string(),
            smart_reel: w.smart_reel.to_string(),
        });

        let (has_macros, macros, macro_free_bytes, macro_max_bytes) = if caps.no_macros {
            (false, Vec::new(), 0, 0)
        } else {
            match dev.macro_storage() {
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
                Err(_) => {
                    caps.no_macros = true;
                    (false, Vec::new(), 0, 0)
                }
            }
        };

        let leds = spec.map(|s| s.leds.clone()).unwrap_or_default();
        let has_lighting = !leds.is_empty();
        let has_game_mode = if caps.no_game_mode {
            false
        } else {
            let has = dev.game_mode().ok().flatten().is_some();
            if !has {
                caps.no_game_mode = true;
            }
            has
        };
        let has_power = if caps.no_power {
            false
        } else {
            let has = dev.power().ok().flatten().is_some();
            if !has {
                caps.no_power = true;
            }
            has
        };
        self.unsupported_caps.insert(key.clone(), caps);

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

        let led_brightness: Vec<(u8, String, u8)> = leds
            .iter()
            .map(|l| (l.id, l.name.clone(), dev.brightness(l.id).unwrap_or(100)))
            .collect();

        // Only query saved_input when remapped and absent from onboard backup.
        let raw_buttons: Vec<(String, String, Option<String>, Option<String>, Option<String>)> = normal_list
            .into_iter()
            .map(|(id, normal)| {
                let bname = button_name(id);
                let k_n = secbird_core::buttons::setting_key(&bname, Layer::Normal);
                let k_h = secbird_core::buttons::setting_key(&bname, Layer::HyperShift);
                let input = secbird_core::buttons::Input::Button(id);
                let hyper = dev.input(input, Layer::HyperShift).ok().map(|a| a.to_string());
                let saved_n = if remapped_keys.contains(&k_n) && !onboard_before.contains_key(&k_n) {
                    dev.saved_input(input, Layer::Normal).ok().map(|a| a.to_string())
                } else {
                    None
                };
                let saved_h = if remapped_keys.contains(&k_h) && !onboard_before.contains_key(&k_h) {
                    dev.saved_input(input, Layer::HyperShift).ok().map(|a| a.to_string())
                } else {
                    None
                };
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
        static TEST_SEQ: std::sync::atomic::AtomicUsize = std::sync::atomic::AtomicUsize::new(1);
        let db = Db::builtin().unwrap();
        let dev = sim::open_preset("naga", &db).expect("simulated naga");
        let seq = TEST_SEQ.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        let path = std::env::temp_dir().join(format!(
            "grip-bus-v2-{}-{}-{}.json",
            std::process::id(),
            seq,
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
        invalid_theme.desktop_smooth.strength = 250;
        invalid_theme.desktop_smooth.rotation_deg = 80;
        invalid_theme.raw_accel.sens_multiplier_pct = 999;
        let normalized = bus
            .execute(BusCommand::UpdateSettings { settings: invalid_theme })
            .unwrap()
            .workspace
            .settings;
        assert_eq!(normalized.theme, "system");
        assert_eq!(normalized.desktop_smooth.strength, 100);
        assert_eq!(normalized.desktop_smooth.rotation_deg, 30);
        assert_eq!(normalized.raw_accel.sens_multiplier_pct, 200);

        let engine_wrap = AppBus::from_engine(bus);
        assert!(!engine_wrap.close_to_tray());

        let _ = std::fs::remove_file(&path);
        let _ = std::fs::remove_file(path.with_file_name("settings.json"));
    }

    #[test]
    fn cached_snapshot_stays_consistent_across_fast_paths() {
        let (mut bus, path) = test_bus();
        let initial = bus
            .execute(BusCommand::GetWorkspace { device_key: None })
            .unwrap()
            .workspace
            .active_device
            .unwrap();
        let key = initial.device_key;

        let after_dpi = bus
            .execute(BusCommand::SetDpiStages {
                device_key: key.clone(),
                active_stage: 2,
                stages: vec![[800, 800], [1800, 1800]],
            })
            .unwrap()
            .workspace
            .active_device
            .unwrap();
        assert_eq!(after_dpi.dpi.active_stage, 2);
        assert_eq!(after_dpi.dpi.stages, vec![[800, 800], [1800, 1800]]);

        let after_poll = bus
            .execute(BusCommand::SetPolling {
                device_key: key.clone(),
                hz: 500,
            })
            .unwrap()
            .workspace
            .active_device
            .unwrap();
        assert_eq!(after_poll.polling_hz, Some(500));

        let after_sleep = bus
            .execute(BusCommand::SetSleep {
                device_key: key.clone(),
                minutes: Some(10),
                auto_sleep: None,
            })
            .unwrap()
            .workspace
            .active_device
            .unwrap();
        assert_eq!(after_sleep.sleep_minutes, Some(10));

        let after_btn = bus
            .execute(BusCommand::SetButton {
                device_key: key.clone(),
                button: "grid-2".into(),
                layer: LayerName::Normal,
                action: "key:f".into(),
            })
            .unwrap()
            .workspace
            .active_device
            .unwrap();
        let g2 = after_btn.buttons.iter().find(|b| b.id == "grid-2").unwrap();
        assert_eq!(g2.normal, "key:f");
        assert!(g2.remapped_normal);

        let after_reset = bus
            .execute(BusCommand::ResetButton {
                device_key: key.clone(),
                button: "grid-2".into(),
                layer: LayerName::Normal,
            })
            .unwrap()
            .workspace
            .active_device
            .unwrap();
        let g2_reset = after_reset.buttons.iter().find(|b| b.id == "grid-2").unwrap();
        assert!(!g2_reset.remapped_normal);

        let after_prof = bus
            .execute(BusCommand::CreateProfile {
                device_key: key.clone(),
                name: "Arena".into(),
            })
            .and_then(|_| {
                bus.execute(BusCommand::SetProfileApps {
                    device_key: key.clone(),
                    name: "Arena".into(),
                    apps: vec!["overwatch.exe".into()],
                })
            })
            .unwrap()
            .workspace
            .active_device
            .unwrap();
        assert_eq!(after_prof.active_profile, "Arena");
        assert!(after_prof
            .profiles
            .iter()
            .any(|p| p.name == "Arena" && p.apps == vec!["overwatch.exe"]));

        let mut next_settings = AppSettings::default();
        next_settings.desktop_smooth.enabled = true;
        next_settings.desktop_smooth.strength = 80;
        let ws_settings = bus
            .execute(BusCommand::UpdateSettings { settings: next_settings })
            .unwrap()
            .workspace;
        assert!(ws_settings.settings.desktop_smooth.enabled);
        assert_eq!(ws_settings.settings.desktop_smooth.strength, 80);

        let _ = std::fs::remove_file(&path);
        let _ = std::fs::remove_file(path.with_file_name("settings.json"));
    }
}
