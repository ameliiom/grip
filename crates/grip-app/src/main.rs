#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod bus;

use bus::{AppBus, BusCommand, CommandError, DeviceSnapshot};
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager, RunEvent, State, WebviewWindowBuilder};

struct QuitRequested(AtomicBool);

#[tauri::command]
fn execute_command(bus: State<'_, AppBus>, cmd: BusCommand) -> Result<DeviceSnapshot, CommandError> {
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
    tauri::Builder::default()
        .manage(AppBus::new())
        .manage(QuitRequested(AtomicBool::new(false)))
        .invoke_handler(tauri::generate_handler![execute_command])
        .setup(|app| {
            let open_item = MenuItem::with_id(app, "open", "Open Grip", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open_item, &quit_item])?;

            let mut tray = TrayIconBuilder::new()
                .tooltip("Grip")
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open" => open_main_window(app),
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
            // Keep the lightweight Rust tray running when the window closes and WebView2 is destroyed.
            if let RunEvent::ExitRequested { api, .. } = event {
                if !app.state::<QuitRequested>().0.load(Ordering::Relaxed) {
                    api.prevent_exit();
                }
            }
        });
}
