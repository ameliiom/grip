# Grip

**Grip** is a lightweight, bilingual (Arabic RTL / English LTR) desktop studio for configuring Razer gaming mice and peripherals without background bloatware, accounts, or telemetry.

> Built on top of the open-source [`secbird-core`](crates/secbird-core) protocol engine forked from [`infinityInfinite/secbird`](https://github.com/infinityInfinite/secbird) (MIT / Apache-2.0). Hardware database facts come from [`OpenRazer`](https://github.com/openrazer/openrazer) documentation as documented in [`NOTICE`](NOTICE).

## Highlights

- **Bespoke Desktop Studio (`grip-app`):** Minimal ~3.5 MB Tauri desktop controller with silent Windows tray mode (`--tray`), live tray profile switching, USB hotplug & sleep/wake recovery, dark/light DWM titlebar sync, and low-battery OSD notifications.
- **Orthographic Mouse Blueprint:** Precision 12-button side view and asymmetric top view with Normal + HyperShift layers, onboard memory save/restore, locale-independent (`ev.code`) shortcut capture (including Arabic OS layouts, Numpad keys, and standalone modifiers), Windows quick actions, rapid repeat (`1–50 / sec`), and DPI clutch.
- **Performance & Power:** 5-stage visual speed staircase, X/Y axis separation, polling latency (`ms`), wireless sleep timeout, battery indicator, and conditional scroll wheel controls.
- **Native Windows App Integration:** Reads real executable titles (`FileDescription` / `ProductName`) and extracts native `.exe` icons for 1-click automatic profile switching.

## Development

```sh
# Frontend typecheck, UI primitives lint & bundle
cd ui && pnpm install && pnpm check

# Multi-width browser audit (7 widths x light/dark + shift & layout checks)
cd ui && node scripts/run_audit.mjs

# Workspace tests & release build
cargo test --workspace
cargo build --release -p grip-app
```

## License & Attribution

- Dual-licensed under MIT or Apache-2.0 (`LICENSE-MIT`, `LICENSE-APACHE`).
- Upstream engine attribution: [Secretarybird](https://github.com/infinityInfinite/secbird) and [OpenRazer](https://github.com/openrazer/openrazer) (`NOTICE`). Razer and product names are trademarks of Razer Inc.
