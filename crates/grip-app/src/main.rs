#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[cfg(all(not(debug_assertions), not(feature = "custom-protocol")))]
compile_error!("Release builds must enable `custom-protocol` so frontend assets are embedded.");

mod bus;
mod settings;
mod win_host;

use bus::{AppBus, BusCommand, BusResponse, CommandError};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::menu::{CheckMenuItem, IsMenuItem, Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, RunEvent, State, WebviewWindow, WebviewWindowBuilder};

const TRAY_ID: &str = "main-tray";

struct QuitRequested(AtomicBool);

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
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        let _ = tray.set_tooltip(Some(&summary.tooltip));
        if let Ok(menu) = build_tray_menu(app, bus) {
            let _ = tray.set_menu(Some(menu));
        }
    }
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
            sync_titlebar_theme(&win, bus);
            let _ = win.show();
            let _ = win.set_focus();
        }
    }
}

#[tauri::command]
fn execute_command(
    app: AppHandle,
    bus: State<'_, Arc<AppBus>>,
    cmd: BusCommand,
) -> Result<BusResponse, CommandError> {
    let resp = bus.execute(cmd)?;
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
    let start_in_tray = std::env::args().any(|a| a == "--tray");

    tauri::Builder::default()
        .manage(bus)
        .manage(QuitRequested(AtomicBool::new(false)))
        .invoke_handler(tauri::generate_handler![execute_command])
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
                        bus.reapply_active();
                    } else if id == "quit" {
                        app.state::<QuitRequested>().0.store(true, Ordering::Relaxed);
                        app.exit(0);
                    } else if let Some(name) = id.strip_prefix("profile:") {
                        if bus.select_profile_from_tray(name) {
                            refresh_tray(app, &bus);
                            let _ = app.emit("grip:workspace-updated", ());
                        }
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

            let fg_app = app.handle().clone();
            let fg_bus = app_bus.clone();
            let show_app = app.handle().clone();
            let hw_app = app.handle().clone();
            let hw_bus = app_bus.clone();
            let bat_app = app.handle().clone();
            let bat_bus = app_bus.clone();

            win_host::start_host_monitor(win_host::HostCallbacks {
                on_app: Arc::new(move |exe| {
                    if fg_bus.handle_foreground_app(&exe) {
                        refresh_tray(&fg_app, &fg_bus);
                        let _ = fg_app.emit("grip:workspace-updated", ());
                    }
                }),
                on_show_window: Arc::new(move || {
                    let h = show_app.clone();
                    let _ = show_app.run_on_main_thread(move || {
                        let bus = h.state::<Arc<AppBus>>().inner().clone();
                        open_main_window(&h, &bus);
                    });
                }),
                on_hardware_refresh: Arc::new(move || {
                    if hw_bus.rescan_and_reapply() {
                        refresh_tray(&hw_app, &hw_bus);
                        let _ = hw_app.emit("grip:workspace-updated", ());
                    }
                }),
                on_battery_tick: Arc::new(move || {
                    let _ = bat_bus.check_battery_alerts();
                    refresh_tray(&bat_app, &bat_bus);
                }),
            });

            if !start_in_tray {
                open_main_window(app.handle(), &app_bus);
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error building Grip")
        .run(|app, event| {
            // Destroy WebView2 window on close while keeping the lightweight Rust tray active.
            if let RunEvent::ExitRequested { api, .. } = event {
                if !app.state::<QuitRequested>().0.load(Ordering::Relaxed) {
                    api.prevent_exit();
                }
            }
        });
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
