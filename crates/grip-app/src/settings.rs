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
        }
    }
}

impl AppSettings {
    pub fn load(path: &std::path::Path) -> Self {
        let mut s: Self = std::fs::read_to_string(path)
            .ok()
            .and_then(|raw| serde_json::from_str(raw.trim_start_matches('\u{feff}')).ok())
            .unwrap_or_default();
        s.battery_warning_at = s.battery_warning_at.clamp(5, 95);
        s.theme = normalize_theme(&s.theme);
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
