use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RunningApp {
    pub exe: String,
    pub display_name: String,
    pub icon_data_url: Option<String>,
}

/// Build a per-desktop single-instance mutex name so hidden/test desktops never block the user's real desktop.
pub fn single_instance_mutex_name(desktop_name: Option<&str>) -> String {
    let clean: String = desktop_name
        .unwrap_or("Default")
        .trim()
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || ch == '_' || ch == '-' {
                ch
            } else {
                '_'
            }
        })
        .collect();
    let suffix = if clean.is_empty() { "Default" } else { clean.as_str() };
    format!("Local\\GripDesktopSingleInstance_{suffix}")
}

/// Purely algorithmic fallback when an executable exposes no OS PE version description.
pub fn humanize_exe_stem(exe: &str) -> String {
    let base = exe.trim().rsplit(['\\', '/']).next().unwrap_or(exe).trim();
    let stem = base
        .strip_suffix(".exe")
        .or_else(|| base.strip_suffix(".EXE"))
        .unwrap_or(base)
        .trim();
    let words: Vec<String> = stem
        .split(['-', '_', '.'])
        .filter(|s| !s.is_empty())
        .map(|w| {
            let mut ch = w.chars();
            match ch.next() {
                Some(first) => first.to_uppercase().collect::<String>() + ch.as_str(),
                None => String::new(),
            }
        })
        .collect();
    if words.is_empty() {
        exe.to_string()
    } else {
        words.join(" ")
    }
}

#[cfg(windows)]
mod imp {
    use super::{humanize_exe_stem, RunningApp};
    use base64::Engine;
    use std::cell::{Cell, RefCell};
    use std::collections::BTreeMap;
    use std::ffi::c_void;
    use std::mem::zeroed;
    use std::path::Path;
    use std::ptr::{null, null_mut};
    use std::sync::atomic::{AtomicU32, Ordering};
    use std::sync::{Arc, Mutex, OnceLock};
    use windows_sys::Win32::Foundation::{
        CloseHandle, GetLastError, BOOL, ERROR_ALREADY_EXISTS, ERROR_SUCCESS, HANDLE, HWND, LPARAM, LRESULT, RECT,
        SIZE, TRUE, WPARAM,
    };
    use windows_sys::Win32::Graphics::Dwm::DwmSetWindowAttribute;
    use windows_sys::Win32::Graphics::Gdi::{
        BeginPaint, CreateCompatibleDC, CreateDIBSection, CreateFontW, CreateRoundRectRgn, CreateSolidBrush, DeleteDC,
        DeleteObject, DrawTextW, EndPaint, FillRect, GetDC, GetDeviceCaps, GetMonitorInfoW, InvalidateRect,
        MonitorFromRect, MonitorFromWindow, ReleaseDC, SelectObject, SetBkMode, SetTextColor, SetWindowRgn, BITMAPINFO,
        BITMAPINFOHEADER, BI_RGB, CLEARTYPE_QUALITY, CLIP_DEFAULT_PRECIS, DEFAULT_CHARSET, DEFAULT_PITCH,
        DIB_RGB_COLORS, DT_CENTER, DT_SINGLELINE, DT_VCENTER, FF_DONTCARE, FW_SEMIBOLD, HFONT, LOGPIXELSY,
        MONITORINFO, MONITOR_DEFAULTTONEAREST, OUT_DEFAULT_PRECIS, PAINTSTRUCT, TRANSPARENT,
    };
    use windows_sys::Win32::Storage::FileSystem::{GetFileVersionInfoSizeW, GetFileVersionInfoW, VerQueryValueW};
    use windows_sys::Win32::System::LibraryLoader::GetModuleHandleW;
    use windows_sys::Win32::System::Registry::{
        RegCloseKey, RegOpenKeyExW, RegQueryValueExW, HKEY, HKEY_CURRENT_USER, KEY_READ,
    };
    use windows_sys::Win32::System::StationsAndDesktops::{GetThreadDesktop, GetUserObjectInformationW, UOI_NAME};
    use windows_sys::Win32::System::Threading::{
        CreateMutexW, GetCurrentThreadId, OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32,
        PROCESS_QUERY_LIMITED_INFORMATION,
    };
    use windows_sys::Win32::UI::Accessibility::{SetWinEventHook, HWINEVENTHOOK};
    use windows_sys::Win32::UI::Shell::{ExtractIconExW, ShellExecuteW};
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        CreateWindowExW, DefWindowProcW, DestroyIcon, DispatchMessageW, DrawIconEx, EnumWindows, FindWindowW,
        GetClassNameW, GetClientRect, GetForegroundWindow, GetMessageW, GetWindow, GetWindowRect,
        GetWindowTextLengthW, GetWindowThreadProcessId, IsIconic, IsWindowVisible, KillTimer, LoadCursorW,
        PostMessageW, PostThreadMessageW, RegisterClassW, RegisterWindowMessageW, SetForegroundWindow,
        SetLayeredWindowAttributes, SetTimer, SetWindowPos, ShowWindow, SystemParametersInfoW, TranslateMessage,
        DI_NORMAL, GW_OWNER, HICON, HTTRANSPARENT, HWND_TOPMOST, IDC_ARROW, LWA_ALPHA, MSG, SPI_GETWORKAREA,
        SWP_NOACTIVATE, SWP_SHOWWINDOW, SW_HIDE, SW_RESTORE, SW_SHOWNORMAL, WM_APP, WM_NCHITTEST, WM_PAINT, WM_TIMER,
        WNDCLASSW, WS_EX_LAYERED, WS_EX_NOACTIVATE, WS_EX_TOOLWINDOW, WS_EX_TOPMOST, WS_EX_TRANSPARENT, WS_POPUP,
    };

    const WM_SHOW_OSD: u32 = WM_APP + 21;
    const WM_DEVICECHANGE: u32 = 0x0219;
    const DBT_DEVNODES_CHANGED: usize = 0x0007;
    const WM_POWERBROADCAST: u32 = 0x0218;
    const PBT_APMRESUMESUSPEND: usize = 0x0007;
    const PBT_APMRESUMEAUTOMATIC: usize = 0x0012;
    const TIMER_HIDE_OSD: usize = 1;
    const TIMER_FG_SETTLE: usize = 2;
    const TIMER_HW_REFRESH: usize = 3;
    const TIMER_BATTERY_TICK: usize = 4;
    const EVENT_SYSTEM_FOREGROUND: u32 = 3;
    const WINEVENT_OUTOFCONTEXT: u32 = 0;
    const HOST_BRIDGE_CLASS: &str = "GripHostBridge";
    const SHOW_WINDOW_MSG: &str = "Grip.ShowMainWindow";

    fn wide(s: &str) -> Vec<u16> {
        s.encode_utf16().chain(Some(0)).collect()
    }

    pub struct HostCallbacks {
        pub on_app: Arc<dyn Fn(String) + Send + Sync + 'static>,
        pub on_show_window: Arc<dyn Fn() + Send + Sync + 'static>,
        pub on_hardware_refresh: Arc<dyn Fn() + Send + Sync + 'static>,
        pub on_battery_tick: Arc<dyn Fn() + Send + Sync + 'static>,
    }

    pub struct SingleInstanceGuard(HANDLE);

    impl Drop for SingleInstanceGuard {
        fn drop(&mut self) {
            if !self.0.is_null() {
                unsafe { CloseHandle(self.0) };
            }
        }
    }

    fn current_desktop_name() -> Option<String> {
        unsafe {
            let hdesk = GetThreadDesktop(GetCurrentThreadId());
            if hdesk.is_null() {
                return None;
            }
            let mut buf = [0u16; 128];
            let mut needed = 0u32;
            if GetUserObjectInformationW(
                hdesk,
                UOI_NAME,
                buf.as_mut_ptr().cast(),
                (buf.len() * 2) as u32,
                &mut needed,
            ) == 0
            {
                return None;
            }
            let end = buf.iter().position(|&c| c == 0).unwrap_or(buf.len());
            let name = String::from_utf16_lossy(&buf[..end]).trim().to_string();
            (!name.is_empty()).then_some(name)
        }
    }

    pub fn acquire_single_instance() -> Option<SingleInstanceGuard> {
        let desktop = current_desktop_name();
        let name = wide(&super::single_instance_mutex_name(desktop.as_deref()));
        unsafe {
            let handle = CreateMutexW(null(), 0, name.as_ptr());
            if !handle.is_null() && GetLastError() == ERROR_ALREADY_EXISTS {
                let bridge = FindWindowW(wide(HOST_BRIDGE_CLASS).as_ptr(), null());
                if !bridge.is_null() {
                    let wm_show = RegisterWindowMessageW(wide(SHOW_WINDOW_MSG).as_ptr());
                    if wm_show != 0 {
                        PostMessageW(bridge, wm_show, 0, 0);
                    }
                } else {
                    let existing = FindWindowW(null(), wide("Grip").as_ptr());
                    if !existing.is_null() {
                        ShowWindow(existing, SW_RESTORE);
                        SetForegroundWindow(existing);
                    }
                }
                CloseHandle(handle);
                return None;
            }
            Some(SingleInstanceGuard(handle))
        }
    }

    pub fn windows_prefers_dark() -> bool {
        let subkey = wide("Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize");
        let val_name = wide("AppsUseLightTheme");
        unsafe {
            let mut key: HKEY = null_mut();
            if RegOpenKeyExW(HKEY_CURRENT_USER, subkey.as_ptr(), 0, KEY_READ, &mut key) != ERROR_SUCCESS {
                return true;
            }
            let mut data: u32 = 0;
            let mut size: u32 = 4;
            let ok = RegQueryValueExW(
                key,
                val_name.as_ptr(),
                null(),
                null_mut(),
                (&mut data as *mut u32).cast::<u8>(),
                &mut size,
            ) == ERROR_SUCCESS
                && size == 4;
            RegCloseKey(key);
            if ok {
                data == 0
            } else {
                true
            }
        }
    }

    pub fn set_window_dark_titlebar(hwnd_raw: isize, dark: bool) {
        if cfg!(test) || hwnd_raw == 0 {
            return;
        }
        let val: i32 = if dark { 1 } else { 0 };
        let corner_round: i32 = 2; // DWMWCP_ROUND for frameless Windows 11 crisp corners & shadow
        unsafe {
            if DwmSetWindowAttribute(hwnd_raw as HWND, 20, &val as *const i32 as *const c_void, 4) != 0 {
                let _ = DwmSetWindowAttribute(hwnd_raw as HWND, 19, &val as *const i32 as *const c_void, 4);
            }
            let _ = DwmSetWindowAttribute(hwnd_raw as HWND, 33, &corner_round as *const i32 as *const c_void, 4);
        }
    }

    pub fn clamp_window_bounds(bounds: crate::settings::WindowBounds) -> crate::settings::WindowBounds {
        if cfg!(test) {
            return bounds;
        }
        unsafe {
            let rc = RECT {
                left: bounds.x,
                top: bounds.y,
                right: bounds.x.saturating_add(bounds.width.max(360) as i32),
                bottom: bounds.y.saturating_add(bounds.height.max(540) as i32),
            };
            let mut work: RECT = zeroed();
            let mon = MonitorFromRect(&rc, MONITOR_DEFAULTTONEAREST);
            let mut got = false;
            if !mon.is_null() {
                let mut mi: MONITORINFO = zeroed();
                mi.cbSize = std::mem::size_of::<MONITORINFO>() as u32;
                if GetMonitorInfoW(mon, &mut mi) != 0 {
                    work = mi.rcWork;
                    got = true;
                }
            }
            if !got {
                SystemParametersInfoW(SPI_GETWORKAREA, 0, &mut work as *mut RECT as _, 0);
            }
            if work.right > work.left && work.bottom > work.top {
                bounds.clamp_to_rect(work.left, work.top, work.right, work.bottom)
            } else {
                bounds
            }
        }
    }

    unsafe fn exe_of(hwnd: HWND) -> Option<(String, String)> {
        if hwnd.is_null() {
            return None;
        }
        let mut pid = 0u32;
        GetWindowThreadProcessId(hwnd, &mut pid);
        if pid == 0 {
            return None;
        }
        let proc_h = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
        if proc_h.is_null() {
            return None;
        }
        let mut buf = [0u16; 512];
        let mut len = buf.len() as u32;
        let ok = QueryFullProcessImageNameW(proc_h, PROCESS_NAME_WIN32, buf.as_mut_ptr(), &mut len) != 0;
        CloseHandle(proc_h);
        if !ok {
            return None;
        }
        let raw = String::from_utf16_lossy(&buf[..len as usize]);
        let norm = secbird_core::profile::normalize_app(&raw);
        (!norm.is_empty()).then_some((norm, raw))
    }

    pub fn is_foreground_fullscreen() -> bool {
        if cfg!(test) {
            return false;
        }
        unsafe {
            let hwnd = GetForegroundWindow();
            if hwnd.is_null() || IsIconic(hwnd) != 0 {
                return false;
            }
            let mut cls_buf = [0u16; 64];
            let cls_len = GetClassNameW(hwnd, cls_buf.as_mut_ptr(), cls_buf.len() as i32);
            if cls_len > 0 {
                let cls = String::from_utf16_lossy(&cls_buf[..cls_len as usize]);
                if matches!(
                    cls.as_str(),
                    "Progman" | "WorkerW" | "Shell_TrayWnd" | "Shell_SecondaryTrayWnd"
                ) {
                    return false;
                }
            }
            if let Some((exe, _)) = exe_of(hwnd) {
                if matches!(exe.as_str(), "explorer.exe" | "grip.exe" | "grip-app.exe") {
                    return false;
                }
            }
            let mut rc: RECT = zeroed();
            if GetWindowRect(hwnd, &mut rc) == 0 {
                return false;
            }
            let mon = MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST);
            if mon.is_null() {
                return false;
            }
            let mut mi: MONITORINFO = zeroed();
            mi.cbSize = std::mem::size_of::<MONITORINFO>() as u32;
            if GetMonitorInfoW(mon, &mut mi) == 0 {
                return false;
            }
            rc.left <= mi.rcMonitor.left
                && rc.top <= mi.rcMonitor.top
                && rc.right >= mi.rcMonitor.right
                && rc.bottom >= mi.rcMonitor.bottom
        }
    }

    static APP_META_CACHE: OnceLock<Mutex<BTreeMap<String, (String, Option<String>)>>> = OnceLock::new();

    unsafe fn read_version_string(full_path: &str) -> Option<String> {
        let path_w = wide(full_path);
        let mut handle = 0u32;
        let size = GetFileVersionInfoSizeW(path_w.as_ptr(), &mut handle);
        if size == 0 {
            return None;
        }
        let mut data = vec![0u8; size as usize];
        if GetFileVersionInfoW(path_w.as_ptr(), 0, size, data.as_mut_ptr().cast()) == 0 {
            return None;
        }
        let mut langs: Vec<(u16, u16)> = Vec::new();
        let mut trans_ptr: *mut c_void = null_mut();
        let mut trans_len = 0u32;
        if VerQueryValueW(
            data.as_ptr().cast(),
            wide("\\VarFileInfo\\Translation").as_ptr(),
            &mut trans_ptr,
            &mut trans_len,
        ) != 0
            && !trans_ptr.is_null()
            && trans_len >= 4
        {
            let pairs = std::slice::from_raw_parts(trans_ptr.cast::<u16>(), (trans_len as usize) / 2);
            for chunk in pairs.chunks_exact(2) {
                langs.push((chunk[0], chunk[1]));
            }
        }
        for fallback in [(0x0409u16, 0x04B0u16), (0x0409u16, 0x04E4u16), (0x0000u16, 0x04B0u16)] {
            if !langs.contains(&fallback) {
                langs.push(fallback);
            }
        }
        for (lang, cp) in langs {
            for field in ["FileDescription", "ProductName"] {
                let query = wide(&format!("\\StringFileInfo\\{lang:04X}{cp:04X}\\{field}"));
                let mut val_ptr: *mut c_void = null_mut();
                let mut val_len = 0u32;
                if VerQueryValueW(data.as_ptr().cast(), query.as_ptr(), &mut val_ptr, &mut val_len) != 0
                    && !val_ptr.is_null()
                    && val_len > 1
                {
                    let slice = std::slice::from_raw_parts(val_ptr.cast::<u16>(), val_len as usize);
                    let end = slice.iter().position(|&c| c == 0).unwrap_or(slice.len());
                    let s = String::from_utf16_lossy(&slice[..end]).trim().to_string();
                    if !s.is_empty() && !s.eq_ignore_ascii_case("application") {
                        return Some(s);
                    }
                }
            }
        }
        None
    }

    unsafe fn extract_icon_png_data_url(full_path: &str) -> Option<String> {
        const ICON_SIZE: i32 = 32;
        let path_w = wide(full_path);
        let mut hicon: HICON = null_mut();
        if ExtractIconExW(path_w.as_ptr(), 0, &mut hicon, null_mut(), 1) == 0 || hicon.is_null() {
            return None;
        }

        let screen_dc = GetDC(null_mut());
        let mem_dc = CreateCompatibleDC(screen_dc);
        let mut bmi: BITMAPINFO = zeroed();
        bmi.bmiHeader = BITMAPINFOHEADER {
            biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
            biWidth: ICON_SIZE,
            biHeight: -ICON_SIZE,
            biPlanes: 1,
            biBitCount: 32,
            biCompression: BI_RGB,
            ..zeroed()
        };

        let mut bits_ptr: *mut c_void = null_mut();
        let hbmp = CreateDIBSection(mem_dc, &bmi, DIB_RGB_COLORS, &mut bits_ptr, null_mut(), 0);
        if hbmp.is_null() || bits_ptr.is_null() {
            if !hbmp.is_null() {
                DeleteObject(hbmp.cast());
            }
            DeleteDC(mem_dc);
            if !screen_dc.is_null() {
                ReleaseDC(null_mut(), screen_dc);
            }
            DestroyIcon(hicon);
            return None;
        }

        let px_bytes = (ICON_SIZE * ICON_SIZE * 4) as usize;
        std::ptr::write_bytes(bits_ptr.cast::<u8>(), 0, px_bytes);
        let old = SelectObject(mem_dc, hbmp.cast());
        let drawn = DrawIconEx(mem_dc, 0, 0, hicon, ICON_SIZE, ICON_SIZE, 0, null_mut(), DI_NORMAL) != 0;
        let bgra = std::slice::from_raw_parts(bits_ptr.cast::<u8>(), px_bytes).to_vec();
        SelectObject(mem_dc, old);
        DeleteObject(hbmp.cast());
        DeleteDC(mem_dc);
        if !screen_dc.is_null() {
            ReleaseDC(null_mut(), screen_dc);
        }
        DestroyIcon(hicon);
        if !drawn {
            return None;
        }

        let any_alpha = bgra.chunks_exact(4).any(|p| p[3] != 0);
        let any_rgb = bgra.chunks_exact(4).any(|p| p[0] != 0 || p[1] != 0 || p[2] != 0);
        if !any_alpha && !any_rgb {
            return None;
        }

        let mut rgba = vec![0u8; px_bytes];
        for (dst, src) in rgba.chunks_exact_mut(4).zip(bgra.chunks_exact(4)) {
            let (b, g, r, a) = (src[0], src[1], src[2], src[3]);
            if any_alpha {
                if a == 0 {
                    dst.copy_from_slice(&[0, 0, 0, 0]);
                } else if a < 255 {
                    let ua = a as u16;
                    dst[0] = ((r as u16 * 255) / ua).min(255) as u8;
                    dst[1] = ((g as u16 * 255) / ua).min(255) as u8;
                    dst[2] = ((b as u16 * 255) / ua).min(255) as u8;
                    dst[3] = a;
                } else {
                    dst.copy_from_slice(&[r, g, b, 255]);
                }
            } else if r != 0 || g != 0 || b != 0 {
                dst.copy_from_slice(&[r, g, b, 255]);
            }
        }

        let mut png_bytes = Vec::with_capacity(2048);
        let mut enc = png::Encoder::new(&mut png_bytes, ICON_SIZE as u32, ICON_SIZE as u32);
        enc.set_color(png::ColorType::Rgba);
        enc.set_depth(png::BitDepth::Eight);
        let mut writer = enc.write_header().ok()?;
        writer.write_image_data(&rgba).ok()?;
        writer.finish().ok()?;

        let b64 = base64::engine::general_purpose::STANDARD.encode(png_bytes);
        Some(format!("data:image/png;base64,{b64}"))
    }

    fn resolve_app_metadata(full_path: &str, exe: &str) -> (String, Option<String>) {
        let cache = APP_META_CACHE.get_or_init(|| Mutex::new(BTreeMap::new()));
        if let Ok(guard) = cache.lock() {
            if let Some(hit) = guard.get(full_path) {
                return hit.clone();
            }
        }
        let name = unsafe { read_version_string(full_path) }.unwrap_or_else(|| humanize_exe_stem(exe));
        let icon = unsafe { extract_icon_png_data_url(full_path) };
        let pair = (name, icon);
        if let Ok(mut guard) = cache.lock() {
            guard.insert(full_path.to_string(), pair.clone());
        }
        pair
    }

    pub fn running_apps() -> Vec<RunningApp> {
        unsafe extern "system" fn each(hwnd: HWND, map_ptr: LPARAM) -> BOOL {
            let map = &mut *(map_ptr as *mut BTreeMap<String, RunningApp>);
            if IsWindowVisible(hwnd) != 0 && GetWindow(hwnd, GW_OWNER).is_null() && GetWindowTextLengthW(hwnd) > 0 {
                if let Some((exe, full_path)) = exe_of(hwnd) {
                    if !matches!(
                        exe.as_str(),
                        "explorer.exe"
                            | "applicationframehost.exe"
                            | "textinputhost.exe"
                            | "shellexperiencehost.exe"
                            | "searchhost.exe"
                            | "grip.exe"
                            | "grip-app.exe"
                    ) && !map.contains_key(&exe)
                    {
                        let (display_name, icon_data_url) = resolve_app_metadata(&full_path, &exe);
                        map.insert(
                            exe.clone(),
                            RunningApp {
                                exe,
                                display_name,
                                icon_data_url,
                            },
                        );
                    }
                }
            }
            TRUE
        }
        let mut map: BTreeMap<String, RunningApp> = BTreeMap::new();
        unsafe { EnumWindows(Some(each), &mut map as *mut _ as LPARAM) };
        map.into_values().collect()
    }

    pub fn open_folder(path: &Path) {
        let _ = std::fs::create_dir_all(path);
        let op = wide("open");
        let dir = wide(&path.display().to_string());
        unsafe {
            ShellExecuteW(null_mut(), op.as_ptr(), dir.as_ptr(), null(), null(), SW_SHOWNORMAL);
        }
    }

    static OSD_THREAD_ID: OnceLock<u32> = OnceLock::new();
    thread_local! {
        static OSD_HWND: Cell<HWND> = const { Cell::new(null_mut()) };
        static OSD_TEXT: RefCell<Vec<u16>> = const { RefCell::new(Vec::new()) };
        static OSD_FONT: Cell<HFONT> = const { Cell::new(null_mut()) };
    }

    unsafe fn osd_font(scale: f32) -> HFONT {
        if OSD_FONT.with(Cell::get).is_null() {
            let f = CreateFontW(
                -(17.0 * scale).round() as i32,
                0,
                0,
                0,
                FW_SEMIBOLD as i32,
                0,
                0,
                0,
                DEFAULT_CHARSET as u32,
                OUT_DEFAULT_PRECIS as u32,
                CLIP_DEFAULT_PRECIS as u32,
                CLEARTYPE_QUALITY as u32,
                (DEFAULT_PITCH | FF_DONTCARE) as u32,
                wide("Segoe UI").as_ptr(),
            );
            OSD_FONT.with(|c| c.set(f));
        }
        OSD_FONT.with(Cell::get)
    }

    unsafe extern "system" fn osd_wndproc(hwnd: HWND, msg: u32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
        match msg {
            WM_PAINT => {
                let mut ps: PAINTSTRUCT = zeroed();
                let dc = BeginPaint(hwnd, &mut ps);
                let mut rc: RECT = zeroed();
                GetClientRect(hwnd, &mut rc);
                let bg = CreateSolidBrush(0x0022_1D1D);
                FillRect(dc, &rc, bg);
                DeleteObject(bg as _);
                let old = SelectObject(dc, OSD_FONT.with(Cell::get) as _);
                SetBkMode(dc, TRANSPARENT as _);
                SetTextColor(dc, 0x00FA_FAFA);
                OSD_TEXT.with(|t| {
                    let mut text = t.borrow().clone();
                    DrawTextW(dc, text.as_mut_ptr(), text.len() as i32, &mut rc, DT_CENTER | DT_VCENTER | DT_SINGLELINE);
                });
                SelectObject(dc, old);
                EndPaint(hwnd, &ps);
                0
            }
            WM_TIMER if wparam == TIMER_HIDE_OSD => {
                KillTimer(hwnd, TIMER_HIDE_OSD);
                ShowWindow(hwnd, SW_HIDE);
                0
            }
            WM_NCHITTEST => HTTRANSPARENT as LRESULT,
            _ => DefWindowProcW(hwnd, msg, wparam, lparam),
        }
    }

    unsafe fn ensure_osd_window() -> HWND {
        if OSD_HWND.with(Cell::get).is_null() {
            let hinst = GetModuleHandleW(null());
            let cls = wide("GripCornerOsd");
            let wc = WNDCLASSW {
                lpfnWndProc: Some(osd_wndproc),
                hInstance: hinst,
                lpszClassName: cls.as_ptr(),
                hCursor: LoadCursorW(null_mut(), IDC_ARROW),
                ..zeroed()
            };
            RegisterClassW(&wc);
            let hwnd = CreateWindowExW(
                WS_EX_TOPMOST | WS_EX_TOOLWINDOW | WS_EX_LAYERED | WS_EX_NOACTIVATE | WS_EX_TRANSPARENT,
                cls.as_ptr(),
                wide("Grip").as_ptr(),
                WS_POPUP,
                0,
                0,
                0,
                0,
                null_mut(),
                null_mut(),
                hinst,
                null(),
            );
            SetLayeredWindowAttributes(hwnd, 0, 236, LWA_ALPHA);
            OSD_HWND.with(|c| c.set(hwnd));
        }
        OSD_HWND.with(Cell::get)
    }

    pub fn show_osd(text: &str) {
        if cfg!(test) {
            return;
        }
        let tid = *OSD_THREAD_ID.get_or_init(|| {
            let (tx, rx) = std::sync::mpsc::channel();
            std::thread::Builder::new()
                .name("grip-osd".into())
                .spawn(move || unsafe {
                    let id = GetCurrentThreadId();
                    let hwnd = ensure_osd_window();
                    let _ = tx.send(id);
                    let mut msg: MSG = zeroed();
                    while GetMessageW(&mut msg, null_mut(), 0, 0) > 0 {
                        if msg.message == WM_SHOW_OSD && msg.lParam != 0 {
                            let boxed = Box::from_raw(msg.lParam as *mut String);
                            if !hwnd.is_null() {
                                OSD_TEXT.with(|t| *t.borrow_mut() = boxed.encode_utf16().collect());
                                let dc = GetDC(null_mut());
                                let scale = (GetDeviceCaps(dc, LOGPIXELSY as _) as f32 / 96.0).max(1.0);
                                let font = osd_font(scale);
                                let old = SelectObject(dc, font as _);
                                let mut sz: SIZE = zeroed();
                                OSD_TEXT.with(|t| {
                                    GetTextExtentPoint32W_safe(dc, &t.borrow(), &mut sz);
                                });
                                SelectObject(dc, old);
                                ReleaseDC(null_mut(), dc);
                                let px = |v: f32| (v * scale).round() as i32;
                                let (w, h) = (sz.cx + px(36.0), px(42.0));
                                let mut work: RECT = zeroed();
                                SystemParametersInfoW(SPI_GETWORKAREA, 0, &mut work as *mut RECT as _, 0);
                                let x = work.right - w - px(16.0);
                                let y = work.bottom - h - px(16.0);
                                SetWindowRgn(hwnd, CreateRoundRectRgn(0, 0, w + 1, h + 1, px(12.0), px(12.0)), 0);
                                SetWindowPos(hwnd, HWND_TOPMOST, x, y, w, h, SWP_NOACTIVATE | SWP_SHOWWINDOW);
                                InvalidateRect(hwnd, null(), 1);
                                SetTimer(hwnd, TIMER_HIDE_OSD, 1300, None);
                            }
                            continue;
                        }
                        TranslateMessage(&msg);
                        DispatchMessageW(&msg);
                    }
                })
                .ok();
            rx.recv().unwrap_or(0)
        });
        if tid != 0 {
            let ptr = Box::into_raw(Box::new(text.to_string()));
            unsafe {
                if PostThreadMessageW(tid, WM_SHOW_OSD, 0, ptr as LPARAM) == 0 {
                    drop(Box::from_raw(ptr));
                }
            }
        }
    }

    #[allow(non_snake_case)]
    unsafe fn GetTextExtentPoint32W_safe(
        dc: windows_sys::Win32::Graphics::Gdi::HDC,
        text: &[u16],
        sz: &mut SIZE,
    ) {
        use windows_sys::Win32::Graphics::Gdi::GetTextExtentPoint32W;
        GetTextExtentPoint32W(dc, text.as_ptr(), text.len() as i32, sz);
    }

    static HOST_WATCH_TID: AtomicU32 = AtomicU32::new(0);
    static HOST_WINDOW_HWND: std::sync::atomic::AtomicPtr<std::ffi::c_void> =
        std::sync::atomic::AtomicPtr::new(null_mut());

    thread_local! {
        static HOST_CALLBACKS: RefCell<Option<HostCallbacks>> = const { RefCell::new(None) };
        static WM_SHOW_MAIN: Cell<u32> = const { Cell::new(0) };
    }

    pub fn start_host_monitor(callbacks: HostCallbacks) {
        if HOST_WATCH_TID.load(Ordering::Relaxed) != 0 {
            return;
        }
        let _ = std::thread::Builder::new()
            .name("grip-host-monitor".into())
            .spawn(move || unsafe {
                let tid = GetCurrentThreadId();
                HOST_WATCH_TID.store(tid, Ordering::Relaxed);
                let show_msg = RegisterWindowMessageW(wide(SHOW_WINDOW_MSG).as_ptr());
                WM_SHOW_MAIN.with(|m| m.set(show_msg));
                HOST_CALLBACKS.with(|c| *c.borrow_mut() = Some(callbacks));

                let hinst = GetModuleHandleW(null());
                let cls = wide(HOST_BRIDGE_CLASS);
                let wc = WNDCLASSW {
                    lpfnWndProc: Some(host_wndproc),
                    hInstance: hinst,
                    lpszClassName: cls.as_ptr(),
                    ..zeroed()
                };
                RegisterClassW(&wc);
                let hwnd = CreateWindowExW(
                    0,
                    cls.as_ptr(),
                    wide(HOST_BRIDGE_CLASS).as_ptr(),
                    0,
                    0,
                    0,
                    0,
                    0,
                    null_mut(),
                    null_mut(),
                    hinst,
                    null(),
                );
                if hwnd.is_null() {
                    return;
                }
                HOST_WINDOW_HWND.store(hwnd, Ordering::Relaxed);
                let _hook = SetWinEventHook(
                    EVENT_SYSTEM_FOREGROUND,
                    EVENT_SYSTEM_FOREGROUND,
                    null_mut(),
                    Some(on_fg_event),
                    0,
                    0,
                    WINEVENT_OUTOFCONTEXT,
                );
                SetTimer(hwnd, TIMER_BATTERY_TICK, 60_000, None);

                let mut msg: MSG = zeroed();
                let mut last_exe = String::new();
                while GetMessageW(&mut msg, null_mut(), 0, 0) > 0 {
                    if msg.hwnd == hwnd && msg.message == WM_TIMER {
                        match msg.wParam {
                            TIMER_FG_SETTLE => {
                                KillTimer(hwnd, TIMER_FG_SETTLE);
                                if let Some((exe, _)) = exe_of(GetForegroundWindow()) {
                                    if exe != last_exe {
                                        last_exe = exe.clone();
                                        HOST_CALLBACKS.with(|c| {
                                            if let Some(cb) = c.borrow().as_ref() {
                                                (cb.on_app)(exe.clone());
                                            }
                                        });
                                    }
                                }
                                continue;
                            }
                            TIMER_HW_REFRESH => {
                                KillTimer(hwnd, TIMER_HW_REFRESH);
                                HOST_CALLBACKS.with(|c| {
                                    if let Some(cb) = c.borrow().as_ref() {
                                        (cb.on_hardware_refresh)();
                                    }
                                });
                                continue;
                            }
                            TIMER_BATTERY_TICK => {
                                HOST_CALLBACKS.with(|c| {
                                    if let Some(cb) = c.borrow().as_ref() {
                                        (cb.on_battery_tick)();
                                    }
                                });
                                continue;
                            }
                            _ => {}
                        }
                    }
                    TranslateMessage(&msg);
                    DispatchMessageW(&msg);
                }
            });
    }

    unsafe extern "system" fn host_wndproc(hwnd: HWND, msg: u32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
        let show_msg = WM_SHOW_MAIN.with(Cell::get);
        if show_msg != 0 && msg == show_msg {
            HOST_CALLBACKS.with(|c| {
                if let Some(cb) = c.borrow().as_ref() {
                    (cb.on_show_window)();
                }
            });
            return 0;
        }
        if (msg == WM_DEVICECHANGE && wparam == DBT_DEVNODES_CHANGED)
            || (msg == WM_POWERBROADCAST && (wparam == PBT_APMRESUMESUSPEND || wparam == PBT_APMRESUMEAUTOMATIC))
        {
            SetTimer(hwnd, TIMER_HW_REFRESH, 1200, None);
            return 0;
        }
        DefWindowProcW(hwnd, msg, wparam, lparam)
    }

    unsafe extern "system" fn on_fg_event(
        _: HWINEVENTHOOK,
        _: u32,
        _: HWND,
        _: i32,
        _: i32,
        _: u32,
        _: u32,
    ) {
        let hwnd = HOST_WINDOW_HWND.load(Ordering::Relaxed);
        if !hwnd.is_null() {
            SetTimer(hwnd, TIMER_FG_SETTLE, 280, None);
        }
    }
}

#[cfg(not(windows))]
mod imp {
    use super::RunningApp;
    use std::path::Path;
    use std::sync::Arc;

    pub struct SingleInstanceGuard;

    pub struct HostCallbacks {
        pub on_app: Arc<dyn Fn(String) + Send + Sync + 'static>,
        pub on_show_window: Arc<dyn Fn() + Send + Sync + 'static>,
        pub on_hardware_refresh: Arc<dyn Fn() + Send + Sync + 'static>,
        pub on_battery_tick: Arc<dyn Fn() + Send + Sync + 'static>,
    }

    pub fn acquire_single_instance() -> Option<SingleInstanceGuard> {
        Some(SingleInstanceGuard)
    }

    pub fn running_apps() -> Vec<RunningApp> {
        Vec::new()
    }

    pub fn open_folder(_path: &Path) {}

    pub fn show_osd(_text: &str) {}

    pub fn set_window_dark_titlebar(_hwnd_raw: isize, _dark: bool) {}

    pub fn windows_prefers_dark() -> bool {
        true
    }

    pub fn is_foreground_fullscreen() -> bool {
        false
    }

    pub fn start_host_monitor(_callbacks: HostCallbacks) {}

    pub fn clamp_window_bounds(bounds: crate::settings::WindowBounds) -> crate::settings::WindowBounds {
        bounds
    }
}

pub use imp::{
    acquire_single_instance, clamp_window_bounds, is_foreground_fullscreen, open_folder, running_apps,
    set_window_dark_titlebar, show_osd, start_host_monitor, windows_prefers_dark, HostCallbacks,
};

#[cfg(test)]
mod tests {
    use super::{humanize_exe_stem, single_instance_mutex_name};

    #[test]
    fn algorithmic_exe_stem_formatting_handles_paths_and_separators() {
        assert_eq!(humanize_exe_stem("C:\\Games\\star-citizen_live.exe"), "Star Citizen Live");
        assert_eq!(humanize_exe_stem("notepad.exe"), "Notepad");
    }

    #[test]
    fn single_instance_mutex_is_isolated_per_desktop() {
        assert_eq!(
            single_instance_mutex_name(Some("Default")),
            "Local\\GripDesktopSingleInstance_Default"
        );
        assert_eq!(
            single_instance_mutex_name(Some("exebox-ABC123")),
            "Local\\GripDesktopSingleInstance_exebox-ABC123"
        );
        assert_eq!(
            single_instance_mutex_name(None),
            "Local\\GripDesktopSingleInstance_Default"
        );
        assert_eq!(
            single_instance_mutex_name(Some("  ")),
            "Local\\GripDesktopSingleInstance_Default"
        );
    }
}
