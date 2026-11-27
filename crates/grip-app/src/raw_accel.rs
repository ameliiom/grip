use crate::settings::{grip_config_dir, RawAccelSettings};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::path::PathBuf;

pub const OFFICIAL_RELEASE_URL: &str = "https://github.com/RawAccelOfficial/rawaccel/releases/latest";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RawAccelStatus {
    pub installed: bool,
    pub driver_running: bool,
    pub writer_path: Option<String>,
    pub settings_path: Option<String>,
    pub release_url: String,
}

impl Default for RawAccelStatus {
    fn default() -> Self {
        Self {
            installed: false,
            driver_running: false,
            writer_path: None,
            settings_path: None,
            release_url: OFFICIAL_RELEASE_URL.into(),
        }
    }
}

pub fn build_settings_json(cfg: &RawAccelSettings) -> Value {
    let smooth_ms = (f64::from(cfg.output_smoothing_tenths.min(100)) / 10.0 * 10.0).round() / 10.0;
    let output_dpi = f64::from(cfg.sens_multiplier_pct.clamp(25, 200)) * 10.0;
    let motivity = (f64::from(cfg.motivity_pct.clamp(110, 250)) / 100.0 * 100.0).round() / 100.0;
    let sync_speed = f64::from(cfg.sync_speed.clamp(5, 60));
    let rotation = f64::from(cfg.rotation_deg.clamp(-30, 30));
    let mode = match cfg.mode.as_str() {
        "natural" => "natural",
        "synchronous" => "synchronous",
        _ => "noaccel",
    };

    json!({
        "version": "1.7.0",
        "defaultDeviceConfig": {
            "disable": !cfg.enabled,
            "Use constant time interval based on polling rate": false,
            "DPI (normalizes input speed unit: counts/ms -> in/s)": 0,
            "Polling rate Hz (keep at 0 for automatic adjustment)": 0
        },
        "profiles": [
            {
                "name": "Grip",
                "Stretches domain for horizontal vs vertical inputs": { "x": 1.0, "y": 1.0 },
                "Stretches accel range for horizontal vs vertical inputs": { "x": 1.0, "y": 1.0 },
                "Whole or horizontal accel parameters": {
                    "mode": mode,
                    "Gain / Velocity": true,
                    "inputOffset": 0.0,
                    "outputOffset": 0.0,
                    "acceleration": 0.005,
                    "decayRate": 0.1,
                    "gamma": 1.0,
                    "motivity": motivity,
                    "exponentClassic": 2.0,
                    "scale": 1.0,
                    "exponentPower": 0.05,
                    "limit": motivity,
                    "syncSpeed": sync_speed,
                    "smooth": 0.5,
                    "Cap / Jump": { "x": 15.0, "y": motivity },
                    "Cap mode": "output",
                    "data": []
                },
                "Vertical accel parameters": {
                    "mode": "noaccel",
                    "Gain / Velocity": true,
                    "inputOffset": 0.0,
                    "outputOffset": 0.0,
                    "acceleration": 0.005,
                    "decayRate": 0.1,
                    "gamma": 1.0,
                    "motivity": 1.5,
                    "exponentClassic": 2.0,
                    "scale": 1.0,
                    "exponentPower": 0.05,
                    "limit": 1.5,
                    "syncSpeed": 5.0,
                    "smooth": 0.5,
                    "Cap / Jump": { "x": 15.0, "y": 1.5 },
                    "Cap mode": "output",
                    "data": []
                },
                "Input speed calculation parameters": {
                    "Whole/combined accel (set false for 'by component' mode)": true,
                    "lpNorm": 2.0,
                    "Time in ms after which an input is weighted at half its original value.": 0.0,
                    "Time in ms after which scale is weighted at half its original value.": 0.0,
                    "Time in ms after which an output is weighted at half its original value.": smooth_ms
                },
                "Output DPI": output_dpi,
                "Y/X output DPI ratio (vertical sens multiplier)": 1.0,
                "L/R output DPI ratio (left sens multiplier)": 1.0,
                "U/D output DPI ratio (up sens multiplier)": 1.0,
                "Degrees of rotation": rotation,
                "Degrees of angle snapping": 0.0,
                "Input Speed Cap": 0.0
            }
        ],
        "devices": []
    })
}

pub fn settings_file_path() -> PathBuf {
    grip_config_dir().join("rawaccel-settings.json")
}

#[cfg(windows)]
mod win {
    use super::{build_settings_json, settings_file_path, RawAccelStatus, OFFICIAL_RELEASE_URL};
    use crate::settings::RawAccelSettings;
    use std::os::windows::process::CommandExt;
    use std::path::PathBuf;
    use std::process::Command;
    use std::ptr::{null, null_mut};
    use windows_sys::Win32::Foundation::ERROR_SUCCESS;
    use windows_sys::Win32::System::Registry::{RegCloseKey, RegOpenKeyExW, HKEY, HKEY_LOCAL_MACHINE, KEY_READ};
    use windows_sys::Win32::System::Services::{
        CloseServiceHandle, OpenSCManagerW, OpenServiceW, QueryServiceStatus, SC_MANAGER_CONNECT,
        SERVICE_QUERY_STATUS, SERVICE_RUNNING, SERVICE_STATUS,
    };
    use windows_sys::Win32::UI::Shell::ShellExecuteW;
    use windows_sys::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;

    const CREATE_NO_WINDOW: u32 = 0x0800_0000;

    fn wide(s: &str) -> Vec<u16> {
        s.encode_utf16().chain(Some(0)).collect()
    }

    fn service_key_exists() -> bool {
        let subkey = wide("SYSTEM\\CurrentControlSet\\Services\\rawaccel");
        unsafe {
            let mut key: HKEY = null_mut();
            let ok = RegOpenKeyExW(HKEY_LOCAL_MACHINE, subkey.as_ptr(), 0, KEY_READ, &mut key) == ERROR_SUCCESS;
            if ok {
                RegCloseKey(key);
            }
            ok
        }
    }

    fn is_driver_running() -> bool {
        let name = wide("rawaccel");
        unsafe {
            let scm = OpenSCManagerW(null(), null(), SC_MANAGER_CONNECT);
            if scm.is_null() {
                return false;
            }
            let svc = OpenServiceW(scm, name.as_ptr(), SERVICE_QUERY_STATUS);
            if svc.is_null() {
                CloseServiceHandle(scm);
                return false;
            }
            let mut status: SERVICE_STATUS = std::mem::zeroed();
            let running = QueryServiceStatus(svc, &mut status) != 0 && status.dwCurrentState == SERVICE_RUNNING;
            CloseServiceHandle(svc);
            CloseServiceHandle(scm);
            running
        }
    }

    fn find_writer_exe() -> Option<PathBuf> {
        let mut candidates: Vec<PathBuf> = Vec::new();
        if let Some(local) = std::env::var_os("LOCALAPPDATA").map(PathBuf::from) {
            candidates.push(local.join("Grip").join("RawAccel").join("writer.exe"));
            candidates.push(local.join("RawAccel").join("writer.exe"));
            candidates.push(local.join("Programs").join("RawAccel").join("writer.exe"));
        }
        candidates.push(PathBuf::from(r"C:\Program Files\RawAccel\writer.exe"));
        candidates.push(PathBuf::from(r"C:\Program Files (x86)\RawAccel\writer.exe"));
        if let Some(home) = std::env::var_os("USERPROFILE").map(PathBuf::from) {
            candidates.push(home.join("RawAccel").join("writer.exe"));
            candidates.push(home.join("Desktop").join("RawAccel").join("writer.exe"));
        }
        if let Some(path_var) = std::env::var_os("PATH") {
            for dir in std::env::split_paths(&path_var) {
                candidates.push(dir.join("writer.exe"));
            }
        }
        candidates.into_iter().find(|p| p.is_file())
    }

    pub fn detect_status() -> RawAccelStatus {
        let service_present = service_key_exists();
        let driver_running = service_present && is_driver_running();
        let writer = find_writer_exe();
        let installed = service_present || writer.is_some();
        let settings_path = settings_file_path();
        RawAccelStatus {
            installed,
            driver_running,
            writer_path: writer.map(|p| p.display().to_string()),
            settings_path: settings_path.is_file().then(|| settings_path.display().to_string()),
            release_url: OFFICIAL_RELEASE_URL.into(),
        }
    }

    pub fn apply_settings(cfg: &RawAccelSettings) -> Result<RawAccelStatus, String> {
        let Some(writer) = find_writer_exe() else {
            return Err("Raw Accel writer.exe was not found on this PC.".into());
        };
        let spath = settings_file_path();
        if let Some(parent) = spath.parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        let body = serde_json::to_string_pretty(&build_settings_json(cfg)).map_err(|e| e.to_string())?;
        std::fs::write(&spath, body).map_err(|e| e.to_string())?;

        let out = Command::new(&writer)
            .arg(&spath)
            .creation_flags(CREATE_NO_WINDOW)
            .output()
            .map_err(|e| e.to_string())?;
        if !out.status.success() {
            let stderr = String::from_utf8_lossy(&out.stderr).trim().to_string();
            let stdout = String::from_utf8_lossy(&out.stdout).trim().to_string();
            let err = match (stderr.is_empty(), stdout.is_empty()) {
                (false, false) => format!("{stderr} ({stdout})"),
                (false, true) => stderr,
                (true, false) => stdout,
                (true, true) => format!("writer.exe exited with {}", out.status),
            };
            return Err(err);
        }
        Ok(detect_status())
    }

    pub fn open_release_page() {
        let op = wide("open");
        let url = wide(OFFICIAL_RELEASE_URL);
        unsafe {
            ShellExecuteW(null_mut(), op.as_ptr(), url.as_ptr(), null(), null(), SW_SHOWNORMAL);
        }
    }
}

#[cfg(not(windows))]
mod win {
    use super::{RawAccelStatus, OFFICIAL_RELEASE_URL};
    use crate::settings::RawAccelSettings;

    pub fn detect_status() -> RawAccelStatus {
        RawAccelStatus::default()
    }

    pub fn apply_settings(_cfg: &RawAccelSettings) -> Result<RawAccelStatus, String> {
        Err("Raw Accel is supported on Windows only.".into())
    }

    pub fn open_release_page() {
        let _ = OFFICIAL_RELEASE_URL;
    }
}

pub fn detect_status() -> RawAccelStatus {
    win::detect_status()
}

pub fn apply_settings(cfg: &RawAccelSettings) -> Result<RawAccelStatus, String> {
    win::apply_settings(cfg)
}

pub fn open_release_page() {
    win::open_release_page();
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builds_official_raw_accel_v170_schema() {
        let mut cfg = RawAccelSettings {
            enabled: true,
            mode: "natural".into(),
            output_smoothing_tenths: 25,
            sens_multiplier_pct: 90,
            rotation_deg: -5,
            motivity_pct: 140,
            sync_speed: 20,
        };
        let doc = build_settings_json(&cfg);
        assert_eq!(doc["defaultDeviceConfig"]["disable"], json!(false));
        assert_eq!(doc["devices"], json!([]));
        let p = &doc["profiles"][0];
        assert_eq!(p["Whole or horizontal accel parameters"]["mode"], json!("natural"));
        let speed_params = &p["Input speed calculation parameters"];
        assert_eq!(
            speed_params["Whole/combined accel (set false for 'by component' mode)"],
            json!(true)
        );
        assert_eq!(speed_params["lpNorm"], json!(2.0));
        assert_eq!(
            speed_params["Time in ms after which an output is weighted at half its original value."],
            json!(2.5)
        );
        assert_eq!(p["Degrees of rotation"], json!(-5.0));
        assert_eq!(p["Output DPI"], json!(900.0));
        assert_eq!(p["Input Speed Cap"], json!(0.0));
        assert!(p.get("Sensitivity multiplier").is_none());

        cfg.mode = "noaccel".into();
        cfg.sens_multiplier_pct = 100;
        cfg.output_smoothing_tenths = 15;
        let doc_noaccel = build_settings_json(&cfg);
        let p_noaccel = &doc_noaccel["profiles"][0];
        assert_eq!(p_noaccel["Whole or horizontal accel parameters"]["mode"], json!("noaccel"));
        assert_eq!(p_noaccel["Output DPI"], json!(1000.0));
        assert_eq!(
            p_noaccel["Input speed calculation parameters"]
                ["Time in ms after which an output is weighted at half its original value."],
            json!(1.5)
        );

        cfg.enabled = false;
        cfg.mode = "synchronous".into();
        let doc2 = build_settings_json(&cfg);
        assert_eq!(doc2["defaultDeviceConfig"]["disable"], json!(true));
        assert_eq!(doc2["profiles"][0]["Whole or horizontal accel parameters"]["mode"], json!("synchronous"));
        assert_eq!(doc2["profiles"][0]["Whole or horizontal accel parameters"]["syncSpeed"], json!(20.0));
    }
}
