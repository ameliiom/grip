use serde::{Deserialize, Serialize};
use std::path::PathBuf;

pub fn grip_config_dir() -> PathBuf {
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

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DesktopSmoothSettings {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default = "default_smooth_preset")]
    pub preset: String,
    #[serde(default = "default_strength")]
    pub strength: u8,
    #[serde(default = "default_responsiveness")]
    pub responsiveness: u8,
    #[serde(default = "default_micro_precision")]
    pub micro_precision: u8,
    #[serde(default)]
    pub rotation_deg: i8,
    #[serde(default = "default_true")]
    pub bypass_in_games: bool,
}

impl Default for DesktopSmoothSettings {
    fn default() -> Self {
        Self {
            enabled: false,
            preset: default_smooth_preset(),
            strength: default_strength(),
            responsiveness: default_responsiveness(),
            micro_precision: default_micro_precision(),
            rotation_deg: 0,
            bypass_in_games: true,
        }
    }
}

impl DesktopSmoothSettings {
    pub fn normalize(&mut self) {
        self.preset = match self.preset.trim() {
            "light" => "light".into(),
            "silk" => "silk".into(),
            "custom" => "custom".into(),
            _ => "balanced".into(),
        };
        self.strength = self.strength.min(100);
        self.responsiveness = self.responsiveness.min(100);
        self.micro_precision = self.micro_precision.min(50);
        self.rotation_deg = self.rotation_deg.clamp(-30, 30);
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RawAccelSettings {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default = "default_rawaccel_mode")]
    pub mode: String,
    #[serde(default)]
    pub output_smoothing_tenths: u16,
    #[serde(default = "default_sens_multiplier_pct")]
    pub sens_multiplier_pct: u16,
    #[serde(default)]
    pub rotation_deg: i8,
    #[serde(default = "default_motivity_pct")]
    pub motivity_pct: u16,
    #[serde(default = "default_sync_speed")]
    pub sync_speed: u16,
}

impl Default for RawAccelSettings {
    fn default() -> Self {
        Self {
            enabled: false,
            mode: default_rawaccel_mode(),
            output_smoothing_tenths: 0,
            sens_multiplier_pct: default_sens_multiplier_pct(),
            rotation_deg: 0,
            motivity_pct: default_motivity_pct(),
            sync_speed: default_sync_speed(),
        }
    }
}

impl RawAccelSettings {
    pub fn normalize(&mut self) {
        self.mode = match self.mode.trim() {
            "natural" => "natural".into(),
            "synchronous" => "synchronous".into(),
            _ => "noaccel".into(),
        };
        self.output_smoothing_tenths = self.output_smoothing_tenths.min(100);
        self.sens_multiplier_pct = self.sens_multiplier_pct.clamp(25, 200);
        self.rotation_deg = self.rotation_deg.clamp(-30, 30);
        self.motivity_pct = self.motivity_pct.clamp(110, 250);
        self.sync_speed = self.sync_speed.clamp(5, 60);
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct WindowBounds {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    #[serde(default)]
    pub maximized: bool,
}

impl WindowBounds {
    pub fn clamp_to_rect(self, left: i32, top: i32, right: i32, bottom: i32) -> Self {
        let avail_w = (right - left).max(360) as u32;
        let avail_h = (bottom - top).max(540) as u32;
        let width = self.width.max(360).min(avail_w);
        let height = self.height.max(540).min(avail_h);
        let max_x = right - width as i32;
        let max_y = bottom - height as i32;
        let x = if max_x >= left { self.x.clamp(left, max_x) } else { left };
        let y = if max_y >= top { self.y.clamp(top, max_y) } else { top };
        Self {
            x,
            y,
            width,
            height,
            maximized: self.maximized,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    #[serde(default)]
    pub autostart: bool,
    #[serde(default = "default_true")]
    pub close_to_tray: bool,
    #[serde(default = "default_true")]
    pub popups: bool,
    #[serde(default = "default_true")]
    pub auto_switch: bool,
    #[serde(default = "default_true")]
    pub battery_warning: bool,
    #[serde(default = "default_battery_warn")]
    pub battery_warning_at: u8,
    #[serde(default = "default_theme")]
    pub theme: String,
    #[serde(default = "default_brand")]
    pub brand_hex: String,
    #[serde(default = "default_locale")]
    pub locale: String,
    #[serde(default)]
    pub desktop_smooth: DesktopSmoothSettings,
    #[serde(default)]
    pub raw_accel: RawAccelSettings,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub window_bounds: Option<WindowBounds>,
}

pub fn normalize_theme(raw: &str) -> String {
    match raw.trim() {
        "dark" => "dark".into(),
        "light" => "light".into(),
        _ => "system".into(),
    }
}

fn default_true() -> bool {
    true
}

fn default_battery_warn() -> u8 {
    15
}

fn default_theme() -> String {
    "system".into()
}

fn default_brand() -> String {
    "#d4af37".into()
}

fn default_locale() -> String {
    "ar".into()
}

fn default_smooth_preset() -> String {
    "balanced".into()
}

fn default_strength() -> u8 {
    55
}

fn default_responsiveness() -> u8 {
    65
}

fn default_micro_precision() -> u8 {
    15
}

fn default_rawaccel_mode() -> String {
    "noaccel".into()
}

fn default_sens_multiplier_pct() -> u16 {
    100
}

fn default_motivity_pct() -> u16 {
    150
}

fn default_sync_speed() -> u16 {
    15
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            autostart: false,
            close_to_tray: true,
            popups: true,
            auto_switch: true,
            battery_warning: true,
            battery_warning_at: 15,
            theme: "system".into(),
            brand_hex: "#d4af37".into(),
            locale: "ar".into(),
            desktop_smooth: DesktopSmoothSettings::default(),
            raw_accel: RawAccelSettings::default(),
            window_bounds: None,
        }
    }
}

impl AppSettings {
    pub fn normalize(&mut self) {
        self.battery_warning_at = self.battery_warning_at.clamp(5, 95);
        self.theme = normalize_theme(&self.theme);
        self.desktop_smooth.normalize();
        self.raw_accel.normalize();
    }

    pub fn load(path: &std::path::Path) -> Self {
        let mut s: Self = std::fs::read_to_string(path)
            .ok()
            .and_then(|raw| serde_json::from_str(raw.trim_start_matches('\u{feff}')).ok())
            .unwrap_or_default();
        s.normalize();
        s.autostart = autostart_enabled();
        s
    }

    pub fn save(&self, path: &std::path::Path) {
        if let Some(parent) = path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        if let Ok(text) = serde_json::to_string_pretty(self) {
            let tmp = path.with_extension("json.tmp");
            if std::fs::write(&tmp, text).is_ok() {
                let _ = std::fs::rename(tmp, path);
            }
        }
    }
}

#[cfg(windows)]
pub fn autostart_enabled() -> bool {
    use std::ptr::{null, null_mut};
    use windows_sys::Win32::Foundation::ERROR_SUCCESS;
    use windows_sys::Win32::System::Registry::{
        RegCloseKey, RegOpenKeyExW, RegQueryValueExW, HKEY, HKEY_CURRENT_USER, KEY_READ,
    };

    let run_key: Vec<u16> = "Software\\Microsoft\\Windows\\CurrentVersion\\Run"
        .encode_utf16()
        .chain(Some(0))
        .collect();
    let val_name: Vec<u16> = "Grip".encode_utf16().chain(Some(0)).collect();
    unsafe {
        let mut key: HKEY = null_mut();
        if RegOpenKeyExW(HKEY_CURRENT_USER, run_key.as_ptr(), 0, KEY_READ, &mut key) != ERROR_SUCCESS {
            return false;
        }
        let exists =
            RegQueryValueExW(key, val_name.as_ptr(), null(), null_mut(), null_mut(), null_mut()) == ERROR_SUCCESS;
        RegCloseKey(key);
        exists
    }
}

#[cfg(windows)]
pub fn set_autostart(enabled: bool) {
    use std::ptr::null_mut;
    use windows_sys::Win32::Foundation::ERROR_SUCCESS;
    use windows_sys::Win32::System::Registry::{
        RegCloseKey, RegDeleteValueW, RegOpenKeyExW, RegSetValueExW, HKEY, HKEY_CURRENT_USER, KEY_SET_VALUE, REG_SZ,
    };

    let run_key: Vec<u16> = "Software\\Microsoft\\Windows\\CurrentVersion\\Run"
        .encode_utf16()
        .chain(Some(0))
        .collect();
    let val_name: Vec<u16> = "Grip".encode_utf16().chain(Some(0)).collect();
    unsafe {
        let mut key: HKEY = null_mut();
        if RegOpenKeyExW(HKEY_CURRENT_USER, run_key.as_ptr(), 0, KEY_SET_VALUE, &mut key) != ERROR_SUCCESS {
            return;
        }
        if enabled {
            if let Ok(exe) = std::env::current_exe() {
                let cmd = format!("\"{}\" --tray", exe.display());
                let wide: Vec<u16> = cmd.encode_utf16().chain(Some(0)).collect();
                let bytes = (wide.len() * 2) as u32;
                let _ = RegSetValueExW(key, val_name.as_ptr(), 0, REG_SZ, wide.as_ptr() as *const u8, bytes);
            }
        } else {
            let _ = RegDeleteValueW(key, val_name.as_ptr());
        }
        RegCloseKey(key);
    }
}

#[cfg(not(windows))]
pub fn autostart_enabled() -> bool {
    false
}

#[cfg(not(windows))]
pub fn set_autostart(_enabled: bool) {}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn window_bounds_clamp_keeps_window_visible_on_disconnected_or_undersized_screens() {
        let offscreen = WindowBounds {
            x: 4200,
            y: 1600,
            width: 1100,
            height: 760,
            maximized: false,
        };
        let clamped = offscreen.clamp_to_rect(0, 0, 1920, 1040);
        assert_eq!(clamped.x, 820);
        assert_eq!(clamped.y, 280);
        assert_eq!(clamped.width, 1100);
        assert_eq!(clamped.height, 760);

        let tiny = WindowBounds {
            x: -300,
            y: -100,
            width: 120,
            height: 200,
            maximized: true,
        };
        let clamped_tiny = tiny.clamp_to_rect(0, 0, 1920, 1040);
        assert_eq!(clamped_tiny.x, 0);
        assert_eq!(clamped_tiny.y, 0);
        assert_eq!(clamped_tiny.width, 360);
        assert_eq!(clamped_tiny.height, 540);
        assert!(clamped_tiny.maximized);
    }

    #[test]
    fn settings_deserialize_without_window_bounds() {
        let s: AppSettings = serde_json::from_str(r#"{"theme":"dark","locale":"en"}"#).unwrap();
        assert_eq!(s.theme, "dark");
        assert!(s.window_bounds.is_none());
    }
}
