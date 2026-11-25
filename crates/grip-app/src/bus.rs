use secbird_core::actions;
use secbird_core::buttons::{button_name, Layer};
use secbird_core::db::{Db, Polling};
use secbird_core::features::DpiStages;
use secbird_core::macros::Script;
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
    pub has_dpi: bool,
    pub dpi_min: u16,
    pub dpi_max: u16,
    pub dpi_step: u16,
    pub polling_options: Vec<u32>,
    pub sleep_max_minutes: Option<u16>,
    pub has_macros: bool,
    pub has_lighting: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DpiState {
    pub active_stage: u8,
    pub stages: Vec<u16>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileSummary {
    pub name: String,
    pub apps: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MacroSummary {
    pub id: u16,
    pub name: String,
    pub steps: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceSnapshot {
    pub mode: String,
    pub device_key: String,
    pub name: String,
    pub pid_hex: String,
    pub serial: String,
    pub firmware: String,
    pub battery_percent: Option<u8>,
    pub charging: Option<bool>,
    pub capabilities: DeviceCapabilities,
    pub dpi: DpiState,
    pub polling_hz: Option<u32>,
    pub sleep_minutes: Option<u16>,
    pub active_profile: String,
    pub profiles: Vec<ProfileSummary>,
    pub buttons_normal: BTreeMap<String, String>,
    pub buttons_hyper_shift: BTreeMap<String, String>,
    pub macros: Vec<MacroSummary>,
    pub onboard_saved_at: Option<String>,
    pub can_undo: bool,
    pub can_redo: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum BusCommand {
    GetSnapshot {
        device_key: Option<String>,
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
    SetDpiStage {
        device_key: String,
        stage: u8,
    },
    #[serde(rename_all = "camelCase")]
    SetDpiStages {
        device_key: String,
        active_stage: u8,
        stages: Vec<u16>,
    },
    #[serde(rename_all = "camelCase")]
    SetPolling {
        device_key: String,
        hz: u32,
    },
    #[serde(rename_all = "camelCase")]
    SetSleep {
        device_key: String,
        minutes: u16,
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
    SetProfileApps {
        device_key: String,
        name: String,
        apps: Vec<String>,
    },
    #[serde(rename_all = "camelCase")]
    CreateMacro {
        device_key: String,
        name: String,
        steps: String,
    },
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
                "زر النقر الأيسر محمي ولا يمكن تغييره حتى لا تفقد التحكم بالماوس.",
                "Left click stays protected so you never lose mouse control.",
                "Select another button",
            );
        }
        Self::new(
            "DEVICE_ERROR",
            &format!("تعذر تنفيذ الأمر على الماوس: {msg}"),
            &format!("Device command failed: {msg}"),
            "Retry or rescan the device",
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

pub struct BusEngine {
    devices: Vec<Device>,
    store: Store,
    simulated: bool,
    undo_stacks: BTreeMap<String, Vec<HistoryOp>>,
    redo_stacks: BTreeMap<String, Vec<HistoryOp>>,
    onboard_saved_at: BTreeMap<String, String>,
}

pub struct AppBus(pub Mutex<BusEngine>);

impl Default for AppBus {
    fn default() -> Self {
        Self::new()
    }
}

fn grip_config_dir() -> PathBuf {
    #[cfg(windows)]
    {
        std::env::var_os("APPDATA")
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from("."))
            .join("Grip")
    }
    #[cfg(not(windows))]
    {
        secbird_core::config_dir()
    }
}

impl AppBus {
    pub fn new() -> Self {
        let dir = grip_config_dir();
        let store_path = dir.join("profiles.json");
        let store = Store::load(&store_path).unwrap_or_default();
        let simulated = std::env::var("GRIP_SIM").is_ok_and(|v| v == "1" || v == "true")
            || std::env::var("SECBIRD_SIM").is_ok_and(|v| !v.trim().is_empty());
        let mut engine = BusEngine {
            devices: Vec::new(),
            store,
            simulated,
            undo_stacks: BTreeMap::new(),
            redo_stacks: BTreeMap::new(),
            onboard_saved_at: BTreeMap::new(),
        };
        let _ = engine.rescan();
        Self(Mutex::new(engine))
    }

    pub fn execute(&self, cmd: BusCommand) -> Result<DeviceSnapshot, CommandError> {
        let mut guard = self.0.lock().unwrap_or_else(|p| p.into_inner());
        guard.execute(cmd)
    }
}

impl BusEngine {
    pub fn new_with_devices(devices: Vec<Device>, store_path: PathBuf, simulated: bool) -> Self {
        let store = Store::load(&store_path).unwrap_or_default();
        Self {
            devices,
            store,
            simulated,
            undo_stacks: BTreeMap::new(),
            redo_stacks: BTreeMap::new(),
            onboard_saved_at: BTreeMap::new(),
        }
    }

    pub fn rescan(&mut self) -> Result<(), CommandError> {
        let db = Db::load(Some(&grip_config_dir().join("devices.json")))
            .or_else(|_| Db::builtin())
            .map_err(CommandError::from_core)?;
        if std::env::var("GRIP_SIM").is_ok_and(|v| v == "1" || v == "true") {
            self.devices = secbird_core::sim::open_preset("naga", &db).into_iter().collect();
            self.simulated = true;
            return Ok(());
        }
        let api = HidApi::new().map_err(|e| CommandError::from_core(e.into()))?;
        self.devices = discover(&api, &db);
        self.simulated = std::env::var("SECBIRD_SIM").is_ok_and(|v| !v.trim().is_empty());
        Ok(())
    }

    fn find_device(&self, device_key: Option<&str>) -> Result<usize, CommandError> {
        if self.devices.is_empty() {
            return Err(CommandError::new(
                "NO_DEVICE",
                "لم يتم العثور على أي جهاز ريزر متصل.",
                "No connected Razer device found.",
                "Connect the device and click Rescan",
            ));
        }
        if let Some(key) = device_key.filter(|k| !k.is_empty()) {
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

    pub fn execute(&mut self, cmd: BusCommand) -> Result<DeviceSnapshot, CommandError> {
        match cmd {
            BusCommand::GetSnapshot { device_key } => {
                let idx = self.find_device(device_key.as_deref())?;
                Ok(self.snapshot_for(idx))
            }
            BusCommand::Rescan => {
                self.rescan()?;
                let idx = self.find_device(None)?;
                Ok(self.snapshot_for(idx))
            }
            BusCommand::SetButton { device_key, button, layer, action } => {
                let idx = self.find_device(Some(&device_key))?;
                let parsed = action.parse().map_err(CommandError::from_core)?;
                let key = self.devices[idx].key();
                let setting_key = secbird_core::buttons::setting_key(&button, layer.to_core());
                let prev_profile_val = self.store.for_device(&self.devices[idx]).active().buttons.get(&setting_key).cloned();
                let prev_hw = if prev_profile_val.is_none() {
                    secbird_core::buttons::button_id(&button)
                        .and_then(|id| self.devices[idx].button(id, layer.to_core()).ok())
                        .map(|a| a.to_string())
                } else {
                    prev_profile_val
                };
                actions::set_button(&self.devices[idx], &mut self.store, &button, layer.to_core(), Some(parsed))
                    .map_err(CommandError::from_core)?;
                self.push_undo(
                    &key,
                    HistoryOp::Button {
                        button,
                        layer,
                        before: prev_hw,
                        after: Some(action),
                    },
                );
                Ok(self.snapshot_for(idx))
            }
            BusCommand::ResetButton { device_key, button, layer } => {
                let idx = self.find_device(Some(&device_key))?;
                let key = self.devices[idx].key();
                let setting_key = secbird_core::buttons::setting_key(&button, layer.to_core());
                let before = self.store.for_device(&self.devices[idx]).active().buttons.get(&setting_key).cloned();
                actions::set_button(&self.devices[idx], &mut self.store, &button, layer.to_core(), None)
                    .map_err(CommandError::from_core)?;
                self.push_undo(
                    &key,
                    HistoryOp::Button { button, layer, before, after: None },
                );
                Ok(self.snapshot_for(idx))
            }
            BusCommand::RestoreAllButtons { device_key } => {
                let idx = self.find_device(Some(&device_key))?;
                let key = self.devices[idx].key();
                actions::restore_all_buttons(&self.devices[idx], &mut self.store)
                    .map_err(CommandError::from_core)?;
                self.onboard_saved_at.remove(&key);
                self.undo_stacks.remove(&key);
                self.redo_stacks.remove(&key);
                Ok(self.snapshot_for(idx))
            }
            BusCommand::SaveOnboard { device_key } => {
                let idx = self.find_device(Some(&device_key))?;
                let key = self.devices[idx].key();
                let slot = actions::save_buttons_to_mouse(&self.devices[idx], &mut self.store)
                    .map_err(CommandError::from_core)?;
                self.onboard_saved_at.insert(key, format!("slot {slot}"));
                Ok(self.snapshot_for(idx))
            }
            BusCommand::SetDpiStage { device_key, stage } => {
                let idx = self.find_device(Some(&device_key))?;
                let key = self.devices[idx].key();
                let before = self.devices[idx].dpi_stages().map_err(CommandError::from_core)?;
                let mut after = before.clone();
                if stage == 0 || usize::from(stage) > after.stages.len() {
                    return Err(CommandError::new(
                        "INVALID_STAGE",
                        "رقم مرحلة السرعة غير صالح.",
                        "Invalid DPI stage index.",
                        "Choose stage 1..5",
                    ));
                }
                after.active = stage;
                actions::set_dpi_stages(&self.devices[idx], &mut self.store, &after)
                    .map_err(CommandError::from_core)?;
                self.push_undo(&key, HistoryOp::DpiStages { before, after });
                Ok(self.snapshot_for(idx))
            }
            BusCommand::SetDpiStages { device_key, active_stage, stages } => {
                let idx = self.find_device(Some(&device_key))?;
                let key = self.devices[idx].key();
                let before = self.devices[idx].dpi_stages().map_err(CommandError::from_core)?;
                let after = DpiStages {
                    active: active_stage,
                    stages: stages.into_iter().map(|v| (v, v)).collect(),
                };
                let applied = actions::set_dpi_stages(&self.devices[idx], &mut self.store, &after)
                    .map_err(CommandError::from_core)?;
                self.push_undo(&key, HistoryOp::DpiStages { before, after: applied });
                Ok(self.snapshot_for(idx))
            }
            BusCommand::SetPolling { device_key, hz } => {
                let idx = self.find_device(Some(&device_key))?;
                let key = self.devices[idx].key();
                let before = self.devices[idx].polling_rate().map_err(CommandError::from_core)?;
                actions::set_polling(&self.devices[idx], &mut self.store, hz)
                    .map_err(CommandError::from_core)?;
                self.push_undo(&key, HistoryOp::Polling { before, after: hz });
                Ok(self.snapshot_for(idx))
            }
            BusCommand::SetSleep { device_key, minutes } => {
                let idx = self.find_device(Some(&device_key))?;
                let key = self.devices[idx].key();
                let before = self.devices[idx]
                    .sleep_timer()
                    .map_err(CommandError::from_core)?
                    .map_or(5, |s| s.minutes);
                actions::set_sleep_minutes(&self.devices[idx], &mut self.store, minutes)
                    .map_err(CommandError::from_core)?;
                self.push_undo(&key, HistoryOp::Sleep { before, after: minutes });
                Ok(self.snapshot_for(idx))
            }
            BusCommand::SelectProfile { device_key, name } => {
                let idx = self.find_device(Some(&device_key))?;
                {
                    let dp = self.store.for_device(&self.devices[idx]);
                    dp.switch(&name).map_err(CommandError::from_core)?;
                    let _ = dp.apply(&name, &self.devices[idx]);
                }
                self.store.save().map_err(CommandError::from_core)?;
                Ok(self.snapshot_for(idx))
            }
            BusCommand::CreateProfile { device_key, name } => {
                let idx = self.find_device(Some(&device_key))?;
                let clean = name.trim().to_string();
                if clean.is_empty() {
                    return Err(CommandError::new(
                        "EMPTY_NAME",
                        "اكتب اسماً للبروفايل أولاً.",
                        "Profile name cannot be empty.",
                        "Provide a non-empty name",
                    ));
                }
                {
                    let dp = self.store.for_device(&self.devices[idx]);
                    dp.create(&clean).map_err(CommandError::from_core)?;
                    dp.switch(&clean).map_err(CommandError::from_core)?;
                }
                self.store.save().map_err(CommandError::from_core)?;
                Ok(self.snapshot_for(idx))
            }
            BusCommand::SetProfileApps { device_key, name, apps } => {
                let idx = self.find_device(Some(&device_key))?;
                self.store
                    .for_device(&self.devices[idx])
                    .set_apps(&name, &apps)
                    .map_err(CommandError::from_core)?;
                self.store.save().map_err(CommandError::from_core)?;
                Ok(self.snapshot_for(idx))
            }
            BusCommand::CreateMacro { device_key, name, steps } => {
                let idx = self.find_device(Some(&device_key))?;
                let script = Script::from_str(&steps).map_err(CommandError::from_core)?;
                self.devices[idx]
                    .create_macro(&name, &script.0)
                    .map_err(CommandError::from_core)?;
                Ok(self.snapshot_for(idx))
            }
            BusCommand::Undo { device_key } => {
                let idx = self.find_device(Some(&device_key))?;
                let key = self.devices[idx].key();
                if let Some(op) = self.undo_stacks.get_mut(&key).and_then(Vec::pop) {
                    self.apply_history_op(idx, &op, true)?;
                    self.redo_stacks.entry(key).or_default().push(op);
                }
                Ok(self.snapshot_for(idx))
            }
            BusCommand::Redo { device_key } => {
                let idx = self.find_device(Some(&device_key))?;
                let key = self.devices[idx].key();
                if let Some(op) = self.redo_stacks.get_mut(&key).and_then(Vec::pop) {
                    self.apply_history_op(idx, &op, false)?;
                    self.undo_stacks.entry(key).or_default().push(op);
                }
                Ok(self.snapshot_for(idx))
            }
        }
    }

    fn snapshot_for(&mut self, idx: usize) -> DeviceSnapshot {
        let dev = &self.devices[idx];
        let key = dev.key();
        let firmware = dev.firmware().map_or_else(|_| "—".into(), |(maj, min)| format!("v{maj}.{min}"));
        let battery_percent = dev.battery().ok().flatten();
        let charging = dev.charging().ok();
        let normal_list = dev.buttons();

        let mut buttons_normal = BTreeMap::new();
        let mut buttons_hyper_shift = BTreeMap::new();
        for (id, action) in &normal_list {
            let name = button_name(*id);
            buttons_normal.insert(name.clone(), action.to_string());
            if let Ok(hs) = dev.button(*id, Layer::HyperShift) {
                buttons_hyper_shift.insert(name, hs.to_string());
            }
        }

        let has_side_grid_12 = dev.name().contains("Naga")
            || normal_list.iter().any(|(id, _)| (64..=75).contains(id));

        let spec = dev.spec.as_ref();
        let dpi_range = spec.and_then(|s| s.dpi.as_ref());
        let dpi_stages = dev.dpi_stages().ok();
        let fallback_dpi = dev.dpi().ok().map_or(1600, |(x, _)| x);
        let dpi = match dpi_stages {
            Some(st) if !st.stages.is_empty() => DpiState {
                active_stage: st.active,
                stages: st.stages.into_iter().map(|(x, _)| x).collect(),
            },
            _ => DpiState {
                active_stage: 1,
                stages: vec![fallback_dpi],
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
        let has_macros = dev.macro_storage().is_ok();
        let macros = if has_macros {
            dev.macros()
                .unwrap_or_default()
                .into_iter()
                .map(|m| {
                    let steps = dev
                        .macro_steps(m.id)
                        .map(|s| Script(s).to_string())
                        .unwrap_or_default();
                    MacroSummary { id: m.id, name: m.name, steps }
                })
                .collect()
        } else {
            Vec::new()
        };

        let capabilities = DeviceCapabilities {
            has_buttons: !normal_list.is_empty(),
            has_side_grid_12,
            has_dpi: dpi_range.is_some() || polling_hz.is_some(),
            dpi_min: dpi_range.map_or(100, |r| r.min),
            dpi_max: dpi_range.map_or(30000, |r| r.max),
            dpi_step: dpi_range.map_or(50, |r| r.step),
            polling_options,
            sleep_max_minutes,
            has_macros,
            has_lighting: spec.is_some_and(|s| !s.leds.is_empty()),
        };

        let dp = self.store.for_device(dev);
        let active_profile = dp.active.clone();
        let profiles = dp
            .profiles
            .iter()
            .map(|(name, prof)| ProfileSummary {
                name: name.clone(),
                apps: prof.apps.clone(),
            })
            .collect();

        DeviceSnapshot {
            mode: if self.simulated { "simulated".into() } else { "live".into() },
            device_key: key.clone(),
            name: dev.name(),
            pid_hex: format!("{:04X}", dev.pid),
            serial: dev.serial.clone(),
            firmware,
            battery_percent,
            charging,
            capabilities,
            dpi,
            polling_hz,
            sleep_minutes,
            active_profile,
            profiles,
            buttons_normal,
            buttons_hyper_shift,
            macros,
            onboard_saved_at: self.onboard_saved_at.get(&key).cloned(),
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
            "grip-bus-test-{}-{}.json",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map_or(0, |d| d.as_nanos())
        ));
        (BusEngine::new_with_devices(vec![dev], path.clone(), true), path)
    }

    #[test]
    fn left_click_cannot_be_removed_on_normal_layer() {
        let (mut bus, path) = test_bus();
        let snap = bus.execute(BusCommand::GetSnapshot { device_key: None }).unwrap();
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
    fn button_remap_and_undo_redo_roundtrip_on_sim_naga() {
        let (mut bus, path) = test_bus();
        let snap = bus.execute(BusCommand::GetSnapshot { device_key: None }).unwrap();
        assert!(snap.capabilities.has_side_grid_12);
        let key = snap.device_key;
        let orig = snap.buttons_normal["grid-5"].clone();

        let after_set = bus
            .execute(BusCommand::SetButton {
                device_key: key.clone(),
                button: "grid-5".into(),
                layer: LayerName::Normal,
                action: "key:ctrl+c".into(),
            })
            .unwrap();
        assert_eq!(after_set.buttons_normal["grid-5"], "key:ctrl+c");
        assert!(after_set.can_undo);

        let after_undo = bus.execute(BusCommand::Undo { device_key: key.clone() }).unwrap();
        assert_eq!(after_undo.buttons_normal["grid-5"], orig);
        assert!(after_undo.can_redo);

        let after_redo = bus.execute(BusCommand::Redo { device_key: key }).unwrap();
        assert_eq!(after_redo.buttons_normal["grid-5"], "key:ctrl+c");
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn dpi_polling_and_sleep_roundtrip() {
        let (mut bus, path) = test_bus();
        let key = bus.execute(BusCommand::GetSnapshot { device_key: None }).unwrap().device_key;

        let s1 = bus.execute(BusCommand::SetDpiStage { device_key: key.clone(), stage: 2 }).unwrap();
        assert_eq!(s1.dpi.active_stage, 2);

        let s2 = bus.execute(BusCommand::SetPolling { device_key: key.clone(), hz: 500 }).unwrap();
        assert_eq!(s2.polling_hz, Some(500));

        let s3 = bus.execute(BusCommand::SetSleep { device_key: key, minutes: 10 }).unwrap();
        assert_eq!(s3.sleep_minutes, Some(10));
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn profile_and_macro_roundtrip() {
        let (mut bus, path) = test_bus();
        let key = bus.execute(BusCommand::GetSnapshot { device_key: None }).unwrap().device_key;

        let s1 = bus
            .execute(BusCommand::CreateProfile { device_key: key.clone(), name: "Gaming".into() })
            .unwrap();
        assert_eq!(s1.active_profile, "Gaming");

        let s2 = bus
            .execute(BusCommand::CreateMacro {
                device_key: key.clone(),
                name: "Copy".into(),
                steps: "tap:ctrl+c wait:30".into(),
            })
            .unwrap();
        assert_eq!(s2.macros.len(), 1);
        assert_eq!(s2.macros[0].name, "Copy");

        let s3 = bus
            .execute(BusCommand::SetButton {
                device_key: key,
                button: "grid-1".into(),
                layer: LayerName::Normal,
                action: format!("macro:{}", s2.macros[0].id),
            })
            .unwrap();
        assert_eq!(s3.buttons_normal["grid-1"], format!("macro:{}", s2.macros[0].id));
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn missing_device_returns_clean_error() {
        let path = std::env::temp_dir().join("grip-empty-test.json");
        let mut bus = BusEngine::new_with_devices(Vec::new(), path.clone(), false);
        let err = bus.execute(BusCommand::GetSnapshot { device_key: None }).unwrap_err();
        assert_eq!(err.code, "NO_DEVICE");
        let _ = std::fs::remove_file(path);
    }
}
