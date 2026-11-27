#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[cfg(all(not(debug_assertions), not(feature = "custom-protocol")))]
compile_error!("Release builds must enable `custom-protocol` so frontend assets are embedded.");

mod bus;
mod raw_accel;
mod settings;
mod smoother;
mod win_host;

use bus::{AppBus, BusCommand, BusResponse, CommandError};
use settings::WindowBounds;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::menu::{CheckMenuItem, IsMenuItem, Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, RunEvent, State, WebviewWindow, WebviewWindowBuilder, WindowEvent};

const TRAY_ID: &str = "main-tray";

struct QuitRequested(AtomicBool);
struct LastTraySummary(std::sync::Mutex<Option<bus::TraySummary>>);
struct LastNormalBounds(std::sync::Mutex<Option<WindowBounds>>);

fn record_normal_bounds(app: &AppHandle, win: &WebviewWindow) {
    if win.is_minimized().unwrap_or(false) || win.is_maximized().unwrap_or(false) {
        return;
    }
    if let (Ok(pos), Ok(size)) = (win.outer_position(), win.inner_size()) {
        if size.width >= 360 && size.height >= 540 {
            let state = app.state::<LastNormalBounds>();
            let mut guard = state.0.lock().unwrap_or_else(|p| p.into_inner());
            *guard = Some(WindowBounds {
                x: pos.x,
                y: pos.y,
                width: size.width,
                height: size.height,
                maximized: false,
            });
        }
    }
}

fn capture_window_bounds(app: &AppHandle, win: &WebviewWindow) -> Option<WindowBounds> {
    let maximized = win.is_maximized().unwrap_or(false);
    record_normal_bounds(app, win);
    let mut base = *app
        .state::<LastNormalBounds>()
        .0
        .lock()
        .unwrap_or_else(|p| p.into_inner());
    if let Some(ref mut b) = base {
        b.maximized = maximized;
    }
    base
}

fn sync_titlebar_theme(win: &WebviewWindow, bus: &AppBus) {
    #[cfg(windows)]
    if let Ok(hwnd) = win.hwnd() {
        win_host::set_window_dark_titlebar(hwnd.0 as isize, bus.is_dark_theme());
    }
    #[cfg(not(windows))]
    let _ = (win, bus);
}

fn build_tray_menu(app: &AppHandle, bus: &AppBus) -> tauri::Result<Menu<tauri::Wry>> {
    let summary = bus.tray_summary();
    let is_ar = summary.locale == "ar";
    let open_label = if is_ar { "فتح Grip" } else { "Open Grip" };
    let reapply_label = if is_ar { "إعادة تطبيق البروفايل" } else { "Reapply active profile" };
    let quit_label = if is_ar { "خروج" } else { "Quit" };

    let open_item = MenuItem::with_id(app, "open", open_label, true, None::<&str>)?;
    let reapply_item = MenuItem::with_id(app, "reapply", reapply_label, true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", quit_label, true, None::<&str>)?;
    let sep1 = PredefinedMenuItem::separator(app)?;
    let sep2 = PredefinedMenuItem::separator(app)?;

    let mut profile_checks = Vec::with_capacity(summary.profiles.len());
    for name in &summary.profiles {
        let checked = summary.active_profile.as_deref() == Some(name.as_str());
        profile_checks.push(CheckMenuItem::with_id(
            app,
            format!("profile:{name}"),
            name,
            true,
            checked,
            None::<&str>,
        )?);
    }

    let mut items: Vec<&dyn IsMenuItem<tauri::Wry>> = Vec::with_capacity(profile_checks.len() + 5);
    items.push(&open_item);
    if !profile_checks.is_empty() {
        items.push(&sep1);
        for pc in &profile_checks {
            items.push(pc);
        }
    }
    items.push(&sep2);
    items.push(&reapply_item);
    items.push(&quit_item);
    Menu::with_items(app, &items)
}

fn refresh_tray(app: &AppHandle, bus: &AppBus) {
    let summary = bus.tray_summary();
    let cache = app.state::<LastTraySummary>();
    {
        let mut last = cache.0.lock().unwrap_or_else(|p| p.into_inner());
        if last.as_ref() == Some(&summary) {
            return;
        }
        *last = Some(summary.clone());
    }
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        let _ = tray.set_tooltip(Some(&summary.tooltip));
        if let Ok(menu) = build_tray_menu(app, bus) {
            let _ = tray.set_menu(Some(menu));
        }
    }
}

fn attach_main_window(app: &AppHandle, win: &WebviewWindow, bus: &AppBus) {
    if let Some(saved) = bus.window_bounds() {
        let b = win_host::clamp_window_bounds(saved);
        let _ = win.set_size(tauri::PhysicalSize::new(b.width, b.height));
        let _ = win.set_position(tauri::PhysicalPosition::new(b.x, b.y));
        if b.maximized {
            let _ = win.maximize();
        }
    }
    let app_h = app.clone();
    let win_h = win.clone();
    win.on_window_event(move |ev| match ev {
        WindowEvent::Moved(_) | WindowEvent::Resized(_) => {
            record_normal_bounds(&app_h, &win_h);
        }
        WindowEvent::CloseRequested { .. } => {
            if let Some(bounds) = capture_window_bounds(&app_h, &win_h) {
                app_h.state::<Arc<AppBus>>().save_window_bounds(bounds);
            }
        }
        _ => {}
    });
    sync_titlebar_theme(win, bus);
}

fn open_main_window(app: &AppHandle, bus: &AppBus) {
    if let Some(win) = app.get_webview_window("main") {
        sync_titlebar_theme(&win, bus);
        let _ = win.show();
        let _ = win.unminimize();
        let _ = win.set_focus();
        return;
    }
    if let Some(cfg) = app.config().app.windows.first() {
        if let Ok(win) = WebviewWindowBuilder::from_config(app, cfg).and_then(|b| b.build()) {
            attach_main_window(app, &win, bus);
            let _ = win.show();
            let _ = win.set_focus();
        }
    }
}

#[tauri::command]
fn window_control(win: WebviewWindow, action: String) -> Result<bool, String> {
    match action.as_str() {
        "minimize" => {
            win.minimize().map_err(|e| e.to_string())?;
            Ok(false)
        }
        "toggleMaximize" => {
            if win.is_maximized().map_err(|e| e.to_string())? {
                win.unmaximize().map_err(|e| e.to_string())?;
                Ok(false)
            } else {
                win.maximize().map_err(|e| e.to_string())?;
                Ok(true)
            }
        }
        "isMaximized" => Ok(win.is_maximized().unwrap_or(false)),
        "close" => {
            win.close().map_err(|e| e.to_string())?;
            Ok(false)
        }
        "startDragging" => {
            win.start_dragging().map_err(|e| e.to_string())?;
            Ok(false)
        }
        other => Err(format!("Unknown window action: {other}")),
    }
}

#[tauri::command]
async fn execute_command(
    app: AppHandle,
    bus: State<'_, Arc<AppBus>>,
    cmd: BusCommand,
) -> Result<BusResponse, CommandError> {
    let bus_arc = bus.inner().clone();
    let resp = tauri::async_runtime::spawn_blocking(move || bus_arc.execute(cmd))
        .await
        .map_err(|e| CommandError::new("TASK_JOIN_ERROR", "تعذر تنفيذ الأمر.", &e.to_string(), "Retry"))??;
    if let Some(win) = app.get_webview_window("main") {
        sync_titlebar_theme(&win, &bus);
    }
    refresh_tray(&app, &bus);
    Ok(resp)
}

fn main() {
    let _instance = match win_host::acquire_single_instance() {
        Some(guard) => guard,
        None => return,
    };

    let bus = Arc::new(AppBus::new());
    let initial_bounds = bus.window_bounds();
    let start_in_tray = std::env::args().any(|a| a == "--tray");

    tauri::Builder::default()
        .manage(bus)
        .manage(QuitRequested(AtomicBool::new(false)))
        .manage(LastTraySummary(std::sync::Mutex::new(None)))
        .manage(LastNormalBounds(std::sync::Mutex::new(initial_bounds)))
        .invoke_handler(tauri::generate_handler![execute_command, window_control])
        .setup(move |app| {
            let app_bus = app.state::<Arc<AppBus>>().inner().clone();
            let initial_menu = build_tray_menu(app.handle(), &app_bus)?;
            let initial_tip = app_bus.tray_summary().tooltip;

            let mut tray = TrayIconBuilder::with_id(TRAY_ID)
                .tooltip(initial_tip)
                .menu(&initial_menu)
                .on_menu_event(|app, event| {
                    let bus = app.state::<Arc<AppBus>>().inner().clone();
                    let id = event.id.as_ref();
                    if id == "open" {
                        open_main_window(app, &bus);
                    } else if id == "reapply" {
                        let app_h = app.clone();
                        tauri::async_runtime::spawn_blocking(move || {
                            bus.reapply_active();
                            let h = app_h.clone();
                            let _ = app_h.run_on_main_thread(move || {
                                let b = h.state::<Arc<AppBus>>().inner().clone();
                                refresh_tray(&h, &b);
                            });
                        });
                    } else if id == "quit" {
                        if let Some(win) = app.get_webview_window("main") {
                            if let Some(bounds) = capture_window_bounds(app, &win) {
                                bus.save_window_bounds(bounds);
                            }
                        }
                        app.state::<QuitRequested>().0.store(true, Ordering::Relaxed);
                        smoother::shutdown();
                        app.exit(0);
                    } else if let Some(name) = id.strip_prefix("profile:") {
                        let app_h = app.clone();
                        let pname = name.to_string();
                        tauri::async_runtime::spawn_blocking(move || {
                            if bus.select_profile_from_tray(&pname) {
                                let _ = app_h.emit("grip:workspace-updated", ());
                                let h = app_h.clone();
                                let _ = app_h.run_on_main_thread(move || {
                                    let b = h.state::<Arc<AppBus>>().inner().clone();
                                    refresh_tray(&h, &b);
                                });
                            }
                        });
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let handle = tray.app_handle();
                        let bus = handle.state::<Arc<AppBus>>().inner().clone();
                        open_main_window(handle, &bus);
                    }
                });

            if let Some(icon) = app.default_window_icon() {
                tray = tray.icon(icon.clone());
            }
            tray.build(app)?;

            let hw_busy = Arc::new(AtomicBool::new(false));
            let bat_busy = Arc::new(AtomicBool::new(false));
            let fg_app = app.handle().clone();
            let fg_bus = app_bus.clone();
            let show_app = app.handle().clone();
            let hw_app = app.handle().clone();
            let hw_bus = app_bus.clone();
            let bat_app = app.handle().clone();
            let bat_bus = app_bus.clone();

            win_host::start_host_monitor(win_host::HostCallbacks {
                on_app: Arc::new(move |exe| {
                    let app_h = fg_app.clone();
                    let bus_arc = fg_bus.clone();
                    tauri::async_runtime::spawn_blocking(move || {
                        if bus_arc.handle_foreground_app(&exe) {
                            let _ = app_h.emit("grip:workspace-updated", ());
                            let h = app_h.clone();
                            let _ = app_h.run_on_main_thread(move || {
                                let b = h.state::<Arc<AppBus>>().inner().clone();
                                refresh_tray(&h, &b);
                            });
                        }
                    });
                }),
                on_show_window: Arc::new(move || {
                    let h = show_app.clone();
                    let _ = show_app.run_on_main_thread(move || {
                        let bus = h.state::<Arc<AppBus>>().inner().clone();
                        open_main_window(&h, &bus);
                    });
                }),
                on_hardware_refresh: Arc::new(move || {
                    if hw_busy.swap(true, Ordering::AcqRel) {
                        return;
                    }
                    let flag = hw_busy.clone();
                    let app_h = hw_app.clone();
                    let bus_arc = hw_bus.clone();
                    tauri::async_runtime::spawn_blocking(move || {
                        let refreshed = bus_arc.rescan_and_reapply();
                        flag.store(false, Ordering::Release);
                        if refreshed {
                            let _ = app_h.emit("grip:workspace-updated", ());
                            let h = app_h.clone();
                            let _ = app_h.run_on_main_thread(move || {
                                let b = h.state::<Arc<AppBus>>().inner().clone();
                                refresh_tray(&h, &b);
                            });
                        }
                    });
                }),
                on_battery_tick: Arc::new(move || {
                    if bat_busy.swap(true, Ordering::AcqRel) {
                        return;
                    }
                    let flag = bat_busy.clone();
                    let app_h = bat_app.clone();
                    let bus_arc = bat_bus.clone();
                    tauri::async_runtime::spawn_blocking(move || {
                        let _ = bus_arc.check_battery_alerts();
                        flag.store(false, Ordering::Release);
                        let h = app_h.clone();
                        let _ = app_h.run_on_main_thread(move || {
                            let b = h.state::<Arc<AppBus>>().inner().clone();
                            refresh_tray(&h, &b);
                        });
                    });
                }),
            });

            if let Some(win) = app.get_webview_window("main") {
                attach_main_window(app.handle(), &win, &app_bus);
            }

            if !start_in_tray {
                open_main_window(app.handle(), &app_bus);
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error building Grip")
        .run(|app, event| {
            // Destroy WebView2 window on close while keeping tray active if closeToTray is enabled.
            if let RunEvent::ExitRequested { api, .. } = event {
                let force_quit = app.state::<QuitRequested>().0.load(Ordering::Relaxed);
                let stay_in_tray = app.state::<Arc<AppBus>>().close_to_tray();
                if !force_quit && stay_in_tray {
                    api.prevent_exit();
                } else {
                    smoother::shutdown();
                }
            }
        });
    smoother::shutdown();
}

#[cfg(test)]
mod asset_tests {
    #[test]
    fn embedded_frontend_assets_are_bundled() {
        assert!(!tauri::is_dev());
        let ctx: tauri::Context<tauri::Wry> = tauri::generate_context!();
        let index = ctx
            .assets()
            .get(&"index.html".into())
            .expect("index.html must be embedded in binary");
        let html = String::from_utf8_lossy(&index);
        assert!(html.contains("<div id=\"root\">"));
    }
}
