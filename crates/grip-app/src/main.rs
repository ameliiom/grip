#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[cfg(all(not(debug_assertions), not(feature = "custom-protocol")))]
compile_error!("Release builds must enable `custom-protocol` so frontend assets are embedded.");

mod bus;
mod settings;
mod win_host;

use bus::{AppBus, BusCommand, BusResponse, CommandError};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager, RunEvent, State, WebviewWindowBuilder};

struct QuitRequested(AtomicBool);

#[tauri::command]
fn execute_command(bus: State<'_, Arc<AppBus>>, cmd: BusCommand) -> Result<BusResponse, CommandError> {
    bus.execute(cmd)
}

fn open_main_window(app: &AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.show();
        let _ = win.set_focus();
        return;
    }
    if let Some(cfg) = app.config().app.windows.first() {
        if let Ok(win) = WebviewWindowBuilder::from_config(app, cfg).and_then(|b| b.build()) {
            let _ = win.set_focus();
        }
    }
}

fn main() {
    let _instance = match win_host::acquire_single_instance() {
        Some(guard) => guard,
        None => return,
    };

    let bus = Arc::new(AppBus::new());
    let fg_bus = bus.clone();
    win_host::start_foreground_watcher(Arc::new(move |exe| {
        fg_bus.handle_foreground_app(&exe);
    }));

    tauri::Builder::default()
        .manage(bus)
        .manage(QuitRequested(AtomicBool::new(false)))
        .invoke_handler(tauri::generate_handler![execute_command])
        .setup(|app| {
            let open_item = MenuItem::with_id(app, "open", "فتح Grip", true, None::<&str>)?;
            let reapply_item = MenuItem::with_id(app, "reapply", "إعادة تطبيق البروفايل", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "خروج", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open_item, &reapply_item, &quit_item])?;

            let mut tray = TrayIconBuilder::new()
                .tooltip("Grip")
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open" => open_main_window(app),
                    "reapply" => {
                        app.state::<Arc<AppBus>>().reapply_active();
                    }
                    "quit" => {
                        app.state::<QuitRequested>().0.store(true, Ordering::Relaxed);
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        open_main_window(tray.app_handle());
                    }
                });

            if let Some(icon) = app.default_window_icon() {
                tray = tray.icon(icon.clone());
            }
            tray.build(app)?;
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
