use crate::settings::DesktopSmoothSettings;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::f64::consts::PI;
use std::time::Instant;

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SmootherStatus {
    pub hook_active: bool,
    pub bypassed_for_game: bool,
}

fn lp_alpha(cutoff_hz: f64, dt_secs: f64) -> f64 {
    if cutoff_hz <= 0.0 || dt_secs <= 0.0 || !cutoff_hz.is_finite() || !dt_secs.is_finite() {
        return 1.0;
    }
    let tau = 1.0 / (2.0 * PI * cutoff_hz);
    (1.0 / (1.0 + tau / dt_secs)).clamp(0.0, 1.0)
}

#[derive(Debug)]
pub struct OneEuroEngine {
    initialized: bool,
    last_os_x: i32,
    last_os_y: i32,
    target_x: f64,
    target_y: f64,
    filt_x: f64,
    filt_y: f64,
    vx_hat: f64,
    vy_hat: f64,
    last_time: Option<Instant>,
}

impl Default for OneEuroEngine {
    fn default() -> Self {
        Self::new()
    }
}

impl OneEuroEngine {
    pub fn new() -> Self {
        Self {
            initialized: false,
            last_os_x: 0,
            last_os_y: 0,
            target_x: 0.0,
            target_y: 0.0,
            filt_x: 0.0,
            filt_y: 0.0,
            vx_hat: 0.0,
            vy_hat: 0.0,
            last_time: None,
        }
    }

    pub fn reset(&mut self) {
        self.initialized = false;
        self.vx_hat = 0.0;
        self.vy_hat = 0.0;
        self.last_time = None;
    }

    fn min_cutoff(cfg: &DesktopSmoothSettings) -> f64 {
        let s = f64::from(cfg.strength.min(100)) / 100.0;
        12.0 * (1.0_f64 / 12.0).powf(s)
    }

    fn beta(cfg: &DesktopSmoothSettings) -> f64 {
        let r = f64::from(cfg.responsiveness.min(100)) / 100.0;
        0.002 + r * 0.048
    }

    fn clamp_bounds(x: f64, y: f64, bounds: (i32, i32, i32, i32)) -> (f64, f64) {
        let (min_x, min_y, max_x, max_y) = bounds;
        (
            x.clamp(f64::from(min_x), f64::from(max_x.max(min_x))),
            y.clamp(f64::from(min_y), f64::from(max_y.max(min_y))),
        )
    }

    /// Process a physical mouse movement reported at `(proposed_x, proposed_y)`.
    /// Returns `Some((next_x, next_y, needs_settle))` to override the OS position, or `None` to pass raw.
    pub fn on_mouse_move(
        &mut self,
        proposed_x: i32,
        proposed_y: i32,
        bounds: (i32, i32, i32, i32),
        cfg: &DesktopSmoothSettings,
        now: Instant,
    ) -> Option<(i32, i32, bool)> {
        if !self.initialized {
            self.sync_to(proposed_x, proposed_y, now);
            return None;
        }

        let dt = self
            .last_time
            .map(|prev| now.saturating_duration_since(prev).as_secs_f64())
            .unwrap_or(1.0)
            .max(1e-4);

        let rdx = f64::from(proposed_x - self.last_os_x);
        let rdy = f64::from(proposed_y - self.last_os_y);
        let dist = rdx.hypot(rdy);

        // External teleport/tablet/resume or prolonged pause: resync without smoothing across idle gaps.
        if dt > 0.08 || dist > 400.0 || dist == 0.0 {
            if dt > 0.08 || dist > 400.0 {
                self.sync_to(proposed_x, proposed_y, now);
            } else {
                self.last_time = Some(now);
            }
            return None;
        }

        // Rotate hardware delta by hand-grip tilt angle.
        let angle = f64::from(cfg.rotation_deg).to_radians();
        let (sin_a, cos_a) = angle.sin_cos();
        let mut dx = rdx * cos_a - rdy * sin_a;
        let mut dy = rdx * sin_a + rdy * cos_a;

        // Micro-precision low-speed damping below 350 px/s without touching mid/high speeds.
        if cfg.micro_precision > 0 {
            let speed_px = dist / dt;
            if speed_px < 350.0 {
                let t = (speed_px / 350.0).clamp(0.0, 1.0);
                let smooth_t = t * t * (3.0 - 2.0 * t);
                let damp = 1.0 - (f64::from(cfg.micro_precision.min(50)) / 100.0) * (1.0 - smooth_t);
                dx *= damp;
                dy *= damp;
            }
        }

        let (tx, ty) = Self::clamp_bounds(self.target_x + dx, self.target_y + dy, bounds);
        self.target_x = tx;
        self.target_y = ty;

        // Instantaneous velocity of target stream smoothed at d_cutoff = 1.0 Hz.
        let raw_vx = (self.target_x - self.filt_x) / dt;
        let raw_vy = (self.target_y - self.filt_y) / dt;
        let a_vel = lp_alpha(1.0, dt);
        self.vx_hat += a_vel * (raw_vx - self.vx_hat);
        self.vy_hat += a_vel * (raw_vy - self.vy_hat);

        let speed_hat = self.vx_hat.hypot(self.vy_hat);
        let fc = Self::min_cutoff(cfg) + Self::beta(cfg) * speed_hat;
        let a_pos = lp_alpha(fc, dt);

        self.filt_x += a_pos * (self.target_x - self.filt_x);
        self.filt_y += a_pos * (self.target_y - self.filt_y);
        let (fx, fy) = Self::clamp_bounds(self.filt_x, self.filt_y, bounds);
        self.filt_x = fx;
        self.filt_y = fy;

        let nx = fx.round() as i32;
        let ny = fy.round() as i32;
        self.last_os_x = nx;
        self.last_os_y = ny;
        self.last_time = Some(now);

        let rem = (self.target_x - self.filt_x).hypot(self.target_y - self.filt_y);
        Some((nx, ny, rem >= 0.35))
    }

    /// Advance tail convergence while the hand pauses so sub-pixel remainder settles cleanly at 240Hz.
    pub fn on_settle_tick(
        &mut self,
        cur_os: (i32, i32),
        bounds: (i32, i32, i32, i32),
        cfg: &DesktopSmoothSettings,
        now: Instant,
    ) -> Option<(i32, i32, bool)> {
        if !self.initialized {
            return None;
        }
        if cur_os != (self.last_os_x, self.last_os_y) {
            self.reset();
            return None;
        }
        let dt = self
            .last_time
            .map(|prev| now.saturating_duration_since(prev).as_secs_f64())
            .unwrap_or(0.004)
            .clamp(1e-4, 0.05);

        let rem = (self.target_x - self.filt_x).hypot(self.target_y - self.filt_y);
        if rem < 0.35 {
            self.filt_x = self.target_x;
            self.filt_y = self.target_y;
            let nx = self.filt_x.round() as i32;
            let ny = self.filt_y.round() as i32;
            self.last_os_x = nx;
            self.last_os_y = ny;
            self.last_time = Some(now);
            return Some((nx, ny, false));
        }

        let settle_fc = Self::min_cutoff(cfg).max(4.5);
        let alpha = lp_alpha(settle_fc, dt);
        self.filt_x += alpha * (self.target_x - self.filt_x);
        self.filt_y += alpha * (self.target_y - self.filt_y);
        let (fx, fy) = Self::clamp_bounds(self.filt_x, self.filt_y, bounds);
        self.filt_x = fx;
        self.filt_y = fy;

        let nx = fx.round() as i32;
        let ny = fy.round() as i32;
        self.last_os_x = nx;
        self.last_os_y = ny;
        self.last_time = Some(now);

        let next_rem = (self.target_x - self.filt_x).hypot(self.target_y - self.filt_y);
        Some((nx, ny, next_rem >= 0.35))
    }

    pub fn on_button_down(&mut self) {
        if self.initialized {
            self.target_x = self.filt_x;
            self.target_y = self.filt_y;
            self.vx_hat = 0.0;
            self.vy_hat = 0.0;
        }
    }

    fn sync_to(&mut self, x: i32, y: i32, now: Instant) {
        self.initialized = true;
        self.last_os_x = x;
        self.last_os_y = y;
        self.target_x = f64::from(x);
        self.target_y = f64::from(y);
        self.filt_x = f64::from(x);
        self.filt_y = f64::from(y);
        self.vx_hat = 0.0;
        self.vy_hat = 0.0;
        self.last_time = Some(now);
    }
}

#[cfg(windows)]
mod win {
    use super::{OneEuroEngine, SmootherStatus};
    use crate::settings::DesktopSmoothSettings;
    use std::cell::{Cell, RefCell};
    use std::collections::HashSet;
    use std::mem::zeroed;
    use std::ptr::{null, null_mut};
    use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
    use std::sync::{Mutex, OnceLock};
    use std::time::Instant;
    use windows_sys::Win32::Foundation::{HWND, LPARAM, LRESULT, POINT, WPARAM};
    use windows_sys::Win32::System::LibraryLoader::GetModuleHandleW;
    use windows_sys::Win32::System::Threading::{
        GetCurrentThread, GetCurrentThreadId, SetThreadPriority, THREAD_PRIORITY_ABOVE_NORMAL,
    };
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        CallNextHookEx, CreateWindowExW, DefWindowProcW, DispatchMessageW, GetCursorPos, GetMessageW,
        GetSystemMetrics, KillTimer, PostThreadMessageW, RegisterClassW, SetCursorPos, SetTimer, SetWindowsHookExW,
        TranslateMessage, UnhookWindowsHookEx, HHOOK, LLMHF_INJECTED, LLMHF_LOWER_IL_INJECTED, MSG, MSLLHOOKSTRUCT,
        SM_CXVIRTUALSCREEN, SM_CYVIRTUALSCREEN, SM_XVIRTUALSCREEN, SM_YVIRTUALSCREEN, WH_MOUSE_LL, WM_APP,
        WM_LBUTTONDOWN, WM_MBUTTONDOWN, WM_MOUSEMOVE, WM_QUIT, WM_RBUTTONDOWN, WM_TIMER, WNDCLASSW,
    };

    const WM_SYNC_SMOOTHER: u32 = WM_APP + 41;
    const TIMER_SETTLE: usize = 11;

    struct SharedState {
        cfg: DesktopSmoothSettings,
        game_exes: HashSet<String>,
        foreground_exe: String,
        foreground_fullscreen: bool,
    }

    impl Default for SharedState {
        fn default() -> Self {
            Self {
                cfg: DesktopSmoothSettings::default(),
                game_exes: HashSet::new(),
                foreground_exe: String::new(),
                foreground_fullscreen: false,
            }
        }
    }

    static SHARED: OnceLock<Mutex<SharedState>> = OnceLock::new();
    static THREAD_ID: AtomicU32 = AtomicU32::new(0);
    static HOOK_ACTIVE: AtomicBool = AtomicBool::new(false);
    static PAUSED_FOR_GAME: AtomicBool = AtomicBool::new(false);

    thread_local! {
        static HOOK_HANDLE: Cell<HHOOK> = const { Cell::new(null_mut()) };
        static ENGINE: RefCell<OneEuroEngine> = RefCell::new(OneEuroEngine::new());
        static LIVE_CFG: RefCell<DesktopSmoothSettings> = RefCell::new(DesktopSmoothSettings::default());
        static BRIDGE_HWND: Cell<HWND> = const { Cell::new(null_mut()) };
        static IN_SYNTHETIC_SET: Cell<bool> = const { Cell::new(false) };
    }

    fn shared() -> &'static Mutex<SharedState> {
        SHARED.get_or_init(|| Mutex::new(SharedState::default()))
    }

    fn wide(s: &str) -> Vec<u16> {
        s.encode_utf16().chain(Some(0)).collect()
    }

    fn virtual_bounds() -> (i32, i32, i32, i32) {
        unsafe {
            let x = GetSystemMetrics(SM_XVIRTUALSCREEN);
            let y = GetSystemMetrics(SM_YVIRTUALSCREEN);
            let w = GetSystemMetrics(SM_CXVIRTUALSCREEN).max(1);
            let h = GetSystemMetrics(SM_CYVIRTUALSCREEN).max(1);
            (x, y, x + w - 1, y + h - 1)
        }
    }

    fn compute_paused(state: &SharedState) -> bool {
        if !state.cfg.bypass_in_games {
            return false;
        }
        state.foreground_fullscreen
            || (!state.foreground_exe.is_empty() && state.game_exes.contains(&state.foreground_exe))
    }

    fn ensure_worker_started() -> u32 {
        let existing = THREAD_ID.load(Ordering::Acquire);
        if existing != 0 {
            return existing;
        }
        let (tx, rx) = std::sync::mpsc::channel();
        let _ = std::thread::Builder::new()
            .name("grip-mouse-smoother".into())
            .spawn(move || unsafe {
                SetThreadPriority(GetCurrentThread(), THREAD_PRIORITY_ABOVE_NORMAL);
                let tid = GetCurrentThreadId();
                THREAD_ID.store(tid, Ordering::Release);

                let hinst = GetModuleHandleW(null());
                let cls = wide("GripSmootherBridge");
                let wc = WNDCLASSW {
                    lpfnWndProc: Some(wnd_proc),
                    hInstance: hinst,
                    lpszClassName: cls.as_ptr(),
                    ..zeroed()
                };
                RegisterClassW(&wc);
                let hwnd = CreateWindowExW(
                    0,
                    cls.as_ptr(),
                    wide("GripSmootherBridge").as_ptr(),
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
                BRIDGE_HWND.with(|c| c.set(hwnd));

                // Ensure message queue exists before signaling ready.
                let mut msg: MSG = zeroed();
                let _ = tx.send(tid);
                sync_hook_on_worker();

                while GetMessageW(&mut msg, null_mut(), 0, 0) > 0 {
                    if msg.message == WM_SYNC_SMOOTHER {
                        sync_hook_on_worker();
                        continue;
                    }
                    TranslateMessage(&msg);
                    DispatchMessageW(&msg);
                }

                let hook = HOOK_HANDLE.with(Cell::get);
                if !hook.is_null() {
                    UnhookWindowsHookEx(hook);
                    HOOK_HANDLE.with(|c| c.set(null_mut()));
                }
                HOOK_ACTIVE.store(false, Ordering::Release);
            });
        rx.recv().unwrap_or(0)
    }

    unsafe fn sync_hook_on_worker() {
        let cfg = {
            let guard = shared().lock().unwrap_or_else(|p| p.into_inner());
            PAUSED_FOR_GAME.store(compute_paused(&guard), Ordering::Release);
            guard.cfg.clone()
        };
        let want = cfg.enabled;
        LIVE_CFG.with(|c| *c.borrow_mut() = cfg);

        let cur = HOOK_HANDLE.with(Cell::get);
        if want && cur.is_null() {
            let h = SetWindowsHookExW(WH_MOUSE_LL, Some(ll_mouse_proc), GetModuleHandleW(null()), 0);
            if !h.is_null() {
                HOOK_HANDLE.with(|c| c.set(h));
                HOOK_ACTIVE.store(true, Ordering::Release);
                ENGINE.with(|e| e.borrow_mut().reset());
            }
        } else if !want && !cur.is_null() {
            let hwnd = BRIDGE_HWND.with(Cell::get);
            if !hwnd.is_null() {
                KillTimer(hwnd, TIMER_SETTLE);
            }
            UnhookWindowsHookEx(cur);
            HOOK_HANDLE.with(|c| c.set(null_mut()));
            HOOK_ACTIVE.store(false, Ordering::Release);
            ENGINE.with(|e| e.borrow_mut().reset());
        } else {
            ENGINE.with(|e| e.borrow_mut().reset());
        }
    }

    unsafe extern "system" fn wnd_proc(hwnd: HWND, msg: u32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
        if msg == WM_TIMER && wparam == TIMER_SETTLE {
            if !HOOK_ACTIVE.load(Ordering::Relaxed) || PAUSED_FOR_GAME.load(Ordering::Relaxed) {
                KillTimer(hwnd, TIMER_SETTLE);
                return 0;
            }
            let mut pt: POINT = zeroed();
            if GetCursorPos(&mut pt) == 0 {
                KillTimer(hwnd, TIMER_SETTLE);
                return 0;
            }
            let bounds = virtual_bounds();
            let now = Instant::now();
            let res = LIVE_CFG.with(|c| {
                let cfg = c.borrow();
                ENGINE.with(|e| e.borrow_mut().on_settle_tick((pt.x, pt.y), bounds, &cfg, now))
            });
            match res {
                Some((nx, ny, more)) => {
                    IN_SYNTHETIC_SET.with(|f| f.set(true));
                    SetCursorPos(nx, ny);
                    IN_SYNTHETIC_SET.with(|f| f.set(false));
                    if !more {
                        KillTimer(hwnd, TIMER_SETTLE);
                    }
                }
                None => {
                    KillTimer(hwnd, TIMER_SETTLE);
                }
            }
            return 0;
        }
        DefWindowProcW(hwnd, msg, wparam, lparam)
    }

    unsafe extern "system" fn ll_mouse_proc(n_code: i32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
        if n_code < 0 {
            return CallNextHookEx(null_mut(), n_code, wparam, lparam);
        }
        let msg = wparam as u32;
        if msg == WM_LBUTTONDOWN || msg == WM_RBUTTONDOWN || msg == WM_MBUTTONDOWN {
            ENGINE.with(|e| e.borrow_mut().on_button_down());
            let hwnd = BRIDGE_HWND.with(Cell::get);
            if !hwnd.is_null() {
                KillTimer(hwnd, TIMER_SETTLE);
            }
            return CallNextHookEx(null_mut(), n_code, wparam, lparam);
        }
        if msg != WM_MOUSEMOVE {
            return CallNextHookEx(null_mut(), n_code, wparam, lparam);
        }
        if PAUSED_FOR_GAME.load(Ordering::Relaxed) || IN_SYNTHETIC_SET.with(Cell::get) {
            return CallNextHookEx(null_mut(), n_code, wparam, lparam);
        }
        let info = &*(lparam as *const MSLLHOOKSTRUCT);
        if (info.flags & (LLMHF_INJECTED | LLMHF_LOWER_IL_INJECTED)) != 0 {
            return CallNextHookEx(null_mut(), n_code, wparam, lparam);
        }

        let bounds = virtual_bounds();
        let now = Instant::now();
        let outcome = LIVE_CFG.with(|c| {
            let cfg = c.borrow();
            ENGINE.with(|e| e.borrow_mut().on_mouse_move(info.pt.x, info.pt.y, bounds, &cfg, now))
        });
        match outcome {
            Some((nx, ny, needs_settle)) => {
                IN_SYNTHETIC_SET.with(|f| f.set(true));
                SetCursorPos(nx, ny);
                IN_SYNTHETIC_SET.with(|f| f.set(false));
                let hwnd = BRIDGE_HWND.with(Cell::get);
                if !hwnd.is_null() {
                    if needs_settle {
                        SetTimer(hwnd, TIMER_SETTLE, 4, None);
                    } else {
                        KillTimer(hwnd, TIMER_SETTLE);
                    }
                }
                1
            }
            None => CallNextHookEx(null_mut(), n_code, wparam, lparam),
        }
    }

    pub fn sync_config(cfg: &DesktopSmoothSettings, game_exes: &HashSet<String>) {
        if cfg!(test) {
            return;
        }
        {
            let mut guard = shared().lock().unwrap_or_else(|p| p.into_inner());
            guard.cfg = cfg.clone();
            guard.game_exes = game_exes.clone();
            guard.foreground_fullscreen = crate::win_host::is_foreground_fullscreen();
            PAUSED_FOR_GAME.store(compute_paused(&guard), Ordering::Release);
        }
        if cfg.enabled || THREAD_ID.load(Ordering::Acquire) != 0 {
            let tid = ensure_worker_started();
            if tid != 0 {
                unsafe { PostThreadMessageW(tid, WM_SYNC_SMOOTHER, 0, 0) };
            }
        }
    }

    pub fn notify_foreground_changed(exe: &str, fullscreen: bool) {
        if cfg!(test) {
            return;
        }
        let mut guard = shared().lock().unwrap_or_else(|p| p.into_inner());
        guard.foreground_exe = exe.to_string();
        guard.foreground_fullscreen = fullscreen;
        PAUSED_FOR_GAME.store(compute_paused(&guard), Ordering::Release);
    }

    pub fn status() -> SmootherStatus {
        SmootherStatus {
            hook_active: HOOK_ACTIVE.load(Ordering::Relaxed),
            bypassed_for_game: HOOK_ACTIVE.load(Ordering::Relaxed) && PAUSED_FOR_GAME.load(Ordering::Relaxed),
        }
    }

    pub fn shutdown() {
        let tid = THREAD_ID.swap(0, Ordering::AcqRel);
        if tid != 0 {
            unsafe { PostThreadMessageW(tid, WM_QUIT, 0, 0) };
        }
    }
}

#[cfg(not(windows))]
mod win {
    use super::SmootherStatus;
    use crate::settings::DesktopSmoothSettings;
    use std::collections::HashSet;

    pub fn sync_config(_cfg: &DesktopSmoothSettings, _game_exes: &HashSet<String>) {}
    pub fn notify_foreground_changed(_exe: &str, _fullscreen: bool) {}
    pub fn status() -> SmootherStatus {
        SmootherStatus::default()
    }
    pub fn shutdown() {}
}

pub fn sync_config(cfg: &DesktopSmoothSettings, game_exes: &HashSet<String>) {
    win::sync_config(cfg, game_exes);
}

pub fn notify_foreground_changed(exe: &str, fullscreen: bool) {
    win::notify_foreground_changed(exe, fullscreen);
}

pub fn status() -> SmootherStatus {
    win::status()
}

pub fn shutdown() {
    win::shutdown();
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Duration;

    fn cfg_balanced() -> DesktopSmoothSettings {
        DesktopSmoothSettings {
            enabled: true,
            preset: "balanced".into(),
            strength: 65,
            responsiveness: 65,
            micro_precision: 15,
            rotation_deg: 0,
            bypass_in_games: true,
        }
    }

    #[test]
    fn micro_jitter_is_attenuated_and_fast_flicks_stay_responsive() {
        let bounds = (0, 0, 5119, 1439);
        let cfg = cfg_balanced();
        let mut eng = OneEuroEngine::new();
        let t0 = Instant::now();
        assert_eq!(eng.on_mouse_move(1000, 500, bounds, &cfg, t0), None);

        // Micro hand tremor oscillating +/- 2px every 4ms (240Hz)
        let mut cur = (1000, 500);
        let mut max_dev = 0;
        let mut t = t0;
        for step in 1..=20 {
            t += Duration::from_millis(4);
            let jitter = if step % 2 == 0 { 2 } else { -2 };
            let target = (cur.0 + jitter, cur.1);
            if let Some((nx, ny, _)) = eng.on_mouse_move(target.0, target.1, bounds, &cfg, t) {
                cur = (nx, ny);
                max_dev = max_dev.max((nx - 1000).abs());
            }
        }
        assert!(max_dev <= 1, "expected micro-jitter clamped/attenuated, got deviation {max_dev}");

        // Fast flick: 80px across 3 frames at 4ms -> tracks promptly without dragging behind
        let mut flick_x = cur.0;
        for _ in 0..4 {
            t += Duration::from_millis(4);
            if let Some((nx, _, _)) = eng.on_mouse_move(flick_x + 25, cur.1, bounds, &cfg, t) {
                flick_x = nx;
            }
        }
        assert!(flick_x > cur.0 + 70, "fast flick lagged too much: started={} ended={}", cur.0, flick_x);
    }

    #[test]
    fn rotation_and_settle_convergence_are_accurate() {
        let bounds = (0, 0, 3839, 2159);
        let mut cfg = cfg_balanced();
        cfg.rotation_deg = 30;
        cfg.micro_precision = 0;

        let mut eng = OneEuroEngine::new();
        let t0 = Instant::now();
        eng.on_mouse_move(1000, 1000, bounds, &cfg, t0);

        let t1 = t0 + Duration::from_millis(4);
        let first = eng.on_mouse_move(1100, 1000, bounds, &cfg, t1).unwrap();
        // With +30deg rotation and pure +X input, Y must shift positively.
        assert!(first.1 > 1000, "expected rotated Y > 1000, got {}", first.1);

        // Settle ticks must bring filtered cursor within 1px of rotated target cleanly
        let mut cur = (first.0, first.1);
        let mut t = t1;
        for _ in 0..80 {
            t += Duration::from_millis(4);
            if let Some((nx, ny, more)) = eng.on_settle_tick(cur, bounds, &cfg, t) {
                cur = (nx, ny);
                if !more {
                    break;
                }
            }
        }
        assert!((cur.0 - 1087).abs() <= 2 && (cur.1 - 1050).abs() <= 2, "settled at {:?}", cur);
    }
}
