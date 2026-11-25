use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RunningApp {
    pub exe: String,
    pub display_name: String,
}

pub fn pretty_exe_name(exe: &str) -> String {
    let stem = exe
        .trim()
        .rsplit(['\\', '/'])
        .next()
        .unwrap_or(exe)
        .strip_suffix(".exe")
        .or_else(|| exe.strip_suffix(".EXE"))
        .unwrap_or(exe)
        .trim();
    match stem.to_ascii_lowercase().as_str() {
        "cs2" => "Counter-Strike 2".into(),
        "valorant-win64-shipping" | "valorant" => "Valorant".into(),
        "chrome" => "Google Chrome".into(),
        "msedge" => "Microsoft Edge".into(),
        "zen" => "Zen Browser".into(),
        "firefox" => "Firefox".into(),
        "discord" => "Discord".into(),
        "code" => "VS Code".into(),
        "spotify" => "Spotify".into(),
        "obs64" => "OBS Studio".into(),
        "steamwebhelper" | "steam" => "Steam".into(),
        other if !other.is_empty() => other
            .split(['-', '_'])
            .filter(|s| !s.is_empty())
            .map(|w| {
                let mut ch = w.chars();
                match ch.next() {
                    Some(first) => first.to_uppercase().collect::<String>() + ch.as_str(),
                    None => String::new(),
                }
            })
            .collect::<Vec<_>>()
            .join(" "),
        _ => exe.to_string(),
    }
}

#[cfg(windows)]
mod imp {
    use super::{pretty_exe_name, RunningApp};
    use std::cell::{Cell, RefCell};
    use std::collections::BTreeMap;
    use std::mem::zeroed;
    use std::path::Path;
    use std::ptr::{null, null_mut};
    use std::sync::atomic::{AtomicU32, Ordering};
    use std::sync::{Arc, OnceLock};
    use windows_sys::Win32::Foundation::{
        CloseHandle, GetLastError, BOOL, ERROR_ALREADY_EXISTS, HANDLE, HWND, LPARAM, LRESULT, RECT, SIZE, TRUE, WPARAM,
    };
    use windows_sys::Win32::Graphics::Gdi::{
        BeginPaint, CreateFontW, CreateRoundRectRgn, CreateSolidBrush, DeleteObject, DrawTextW, EndPaint, FillRect,
        GetDC, GetDeviceCaps, InvalidateRect, ReleaseDC, SelectObject, SetBkMode, SetTextColor, SetWindowRgn,
        CLEARTYPE_QUALITY, CLIP_DEFAULT_PRECIS, DEFAULT_CHARSET, DEFAULT_PITCH, DT_CENTER, DT_SINGLELINE, DT_VCENTER,
        FF_DONTCARE, FW_SEMIBOLD, HFONT, LOGPIXELSY, OUT_DEFAULT_PRECIS, PAINTSTRUCT, TRANSPARENT,
    };
    use windows_sys::Win32::System::LibraryLoader::GetModuleHandleW;
    use windows_sys::Win32::System::Threading::{
        CreateMutexW, GetCurrentThreadId, OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32,
        PROCESS_QUERY_LIMITED_INFORMATION,
    };
    use windows_sys::Win32::UI::Accessibility::{SetWinEventHook, HWINEVENTHOOK};
    use windows_sys::Win32::UI::Shell::ShellExecuteW;
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        CreateWindowExW, DefWindowProcW, DispatchMessageW, EnumWindows, FindWindowW, GetClientRect,
        GetForegroundWindow, GetMessageW, GetWindow, GetWindowTextLengthW, GetWindowThreadProcessId, IsWindowVisible,
        KillTimer, LoadCursorW, PostThreadMessageW, RegisterClassW, SetForegroundWindow, SetLayeredWindowAttributes,
        SetTimer, SetWindowPos, ShowWindow, SystemParametersInfoW, TranslateMessage, GW_OWNER, HTTRANSPARENT,
        HWND_TOPMOST, IDC_ARROW, LWA_ALPHA, MSG, SPI_GETWORKAREA, SWP_NOACTIVATE, SWP_SHOWWINDOW, SW_HIDE, SW_RESTORE,
        SW_SHOWNORMAL, WM_APP, WM_NCHITTEST, WM_PAINT, WM_TIMER, WNDCLASSW, WS_EX_LAYERED, WS_EX_NOACTIVATE,
        WS_EX_TOOLWINDOW, WS_EX_TOPMOST, WS_EX_TRANSPARENT, WS_POPUP,
    };

    const WM_SHOW_OSD: u32 = WM_APP + 21;
    const TIMER_HIDE_OSD: usize = 1;
    const TIMER_FG_SETTLE: usize = 2;
    const EVENT_SYSTEM_FOREGROUND: u32 = 3;
    const WINEVENT_OUTOFCONTEXT: u32 = 0;

    fn wide(s: &str) -> Vec<u16> {
        s.encode_utf16().chain(Some(0)).collect()
    }

    pub struct SingleInstanceGuard(HANDLE);

    impl Drop for SingleInstanceGuard {
        fn drop(&mut self) {
            if !self.0.is_null() {
                unsafe { CloseHandle(self.0) };
            }
        }
    }

    pub fn acquire_single_instance() -> Option<SingleInstanceGuard> {
        let name = wide("Local\\GripDesktopSingleInstance");
        unsafe {
            let handle = CreateMutexW(null(), 0, name.as_ptr());
            if !handle.is_null() && GetLastError() == ERROR_ALREADY_EXISTS {
                let existing = FindWindowW(null(), wide("Grip").as_ptr());
                if !existing.is_null() {
                    ShowWindow(existing, SW_RESTORE);
                    SetForegroundWindow(existing);
                }
                CloseHandle(handle);
                return None;
            }
            Some(SingleInstanceGuard(handle))
        }
    }

    unsafe fn exe_of(hwnd: HWND) -> Option<String> {
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
        (!norm.is_empty()).then_some(norm)
    }

    pub fn running_apps() -> Vec<RunningApp> {
        unsafe extern "system" fn each(hwnd: HWND, map_ptr: LPARAM) -> BOOL {
            let map = &mut *(map_ptr as *mut BTreeMap<String, String>);
            if IsWindowVisible(hwnd) != 0 && GetWindow(hwnd, GW_OWNER).is_null() && GetWindowTextLengthW(hwnd) > 0 {
                if let Some(exe) = exe_of(hwnd) {
                    if !matches!(
                        exe.as_str(),
                        "explorer.exe"
                            | "applicationframehost.exe"
                            | "textinputhost.exe"
                            | "shellexperiencehost.exe"
                            | "searchhost.exe"
                            | "grip.exe"
                            | "grip-app.exe"
                    ) {
                        map.entry(exe.clone()).or_insert_with(|| pretty_exe_name(&exe));
                    }
                }
            }
            TRUE
        }
        let mut map = BTreeMap::new();
        unsafe { EnumWindows(Some(each), &mut map as *mut _ as LPARAM) };
        map.into_iter()
            .map(|(exe, display_name)| RunningApp { exe, display_name })
            .collect()
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

    static FG_WATCH_TID: AtomicU32 = AtomicU32::new(0);
    static FG_WINDOW_HWND: std::sync::atomic::AtomicPtr<std::ffi::c_void> =
        std::sync::atomic::AtomicPtr::new(null_mut());

    pub fn start_foreground_watcher(on_app: Arc<dyn Fn(String) + Send + Sync + 'static>) {
        if FG_WATCH_TID.load(Ordering::Relaxed) != 0 {
            return;
        }
        let _ = std::thread::Builder::new()
            .name("grip-fg-watcher".into())
            .spawn(move || unsafe {
                let tid = GetCurrentThreadId();
                FG_WATCH_TID.store(tid, Ordering::Relaxed);
                let hinst = GetModuleHandleW(null());
                let cls = wide("GripFgWatcher");
                let wc = WNDCLASSW {
                    lpfnWndProc: Some(fg_wndproc),
                    hInstance: hinst,
                    lpszClassName: cls.as_ptr(),
                    ..zeroed()
                };
                RegisterClassW(&wc);
                let hwnd = CreateWindowExW(
                    0,
                    cls.as_ptr(),
                    wide("GripFgWatcher").as_ptr(),
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
                FG_WINDOW_HWND.store(hwnd, Ordering::Relaxed);
                let _hook = SetWinEventHook(
                    EVENT_SYSTEM_FOREGROUND,
                    EVENT_SYSTEM_FOREGROUND,
                    null_mut(),
                    Some(on_fg_event),
                    0,
                    0,
                    WINEVENT_OUTOFCONTEXT,
                );
                let mut msg: MSG = zeroed();
                let mut last_exe = String::new();
                while GetMessageW(&mut msg, null_mut(), 0, 0) > 0 {
                    if msg.hwnd == hwnd && msg.message == WM_TIMER && msg.wParam == TIMER_FG_SETTLE {
                        KillTimer(hwnd, TIMER_FG_SETTLE);
                        if let Some(exe) = exe_of(GetForegroundWindow()) {
                            if exe != last_exe {
                                last_exe = exe.clone();
                                on_app(exe);
                            }
                        }
                        continue;
                    }
                    TranslateMessage(&msg);
                    DispatchMessageW(&msg);
                }
            });
    }

    unsafe extern "system" fn fg_wndproc(hwnd: HWND, msg: u32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
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
        let hwnd = FG_WINDOW_HWND.load(Ordering::Relaxed);
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

    pub fn acquire_single_instance() -> Option<SingleInstanceGuard> {
        Some(SingleInstanceGuard)
    }

    pub fn running_apps() -> Vec<RunningApp> {
        Vec::new()
    }

    pub fn open_folder(_path: &Path) {}

    pub fn show_osd(_text: &str) {}

    pub fn start_foreground_watcher(_on_app: Arc<dyn Fn(String) + Send + Sync + 'static>) {}
}

pub use imp::{acquire_single_instance, open_folder, running_apps, show_osd, start_foreground_watcher};
