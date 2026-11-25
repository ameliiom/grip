import { useCallback, useEffect, useState } from "react";
import { executeCommand, type BusCommand, type CommandError, type DeviceSnapshot } from "./acl/transport";
import { applyThemeTokens, DEFAULT_BRAND_HEX, type ThemeMode } from "./design-system/theme";
import { VOCAB, type Locale } from "./i18n/vocab";
import { WorkspaceScreen } from "./screens/WorkspaceScreen";

function getInitialTheme(): ThemeMode {
  if (typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: light)").matches) {
    return "light";
  }
  return "dark";
}

function getDefaultBrand(): string {
  return getComputedStyle(document.documentElement).getPropertyValue("--brand").trim() || DEFAULT_BRAND_HEX;
}

export function App() {
  const [snapshot, setSnapshot] = useState<DeviceSnapshot | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [locale, setLocale] = useState<Locale>("ar");
  const [theme, setTheme] = useState<ThemeMode>(getInitialTheme);
  const [brandHex, setBrandHex] = useState<string>(getDefaultBrand);

  const vocab = VOCAB[locale];

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
  }, [locale]);

  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-color-scheme: light)");
    if (!mq) return;
    const sync = (e: MediaQueryListEvent) => setTheme(e.matches ? "light" : "dark");
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    applyThemeTokens(theme, brandHex.startsWith("#") ? brandHex : DEFAULT_BRAND_HEX);
  }, [theme, brandHex]);

  const run = useCallback(
    async (cmd: BusCommand) => {
      try {
        setErrorMsg(null);
        const next = await executeCommand(cmd);
        setSnapshot(next);
      } catch (err) {
        const ce = err as Partial<CommandError>;
        const msg =
          locale === "ar"
            ? (ce.userMessageAr ?? String(err))
            : (ce.userMessageEn ?? String(err));
        setErrorMsg(msg);
      }
    },
    [locale],
  );

  useEffect(() => {
    void run({ type: "getSnapshot" });
  }, [run]);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "z" && snapshot) {
        ev.preventDefault();
        if (ev.shiftKey) void run({ type: "redo", deviceKey: snapshot.deviceKey });
        else void run({ type: "undo", deviceKey: snapshot.deviceKey });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [snapshot, run]);

  const devKey = snapshot?.deviceKey ?? "";

  return (
    <WorkspaceScreen
      snapshot={snapshot}
      errorMsg={errorMsg}
      locale={locale}
      theme={theme}
      brandHex={brandHex}
      vocab={vocab}
      onSetLocale={setLocale}
      onSetTheme={setTheme}
      onSetBrandHex={setBrandHex}
      onRescan={() => void run({ type: "rescan" })}
      onSetButton={(button, layer, action) => void run({ type: "setButton", deviceKey: devKey, button, layer, action })}
      onResetButton={(button, layer) => void run({ type: "resetButton", deviceKey: devKey, button, layer })}
      onRestoreAll={() => void run({ type: "restoreAllButtons", deviceKey: devKey })}
      onSaveOnboard={() => void run({ type: "saveOnboard", deviceKey: devKey })}
      onSelectDpiStage={(stage) => void run({ type: "setDpiStage", deviceKey: devKey, stage })}
      onSelectPolling={(hz) => void run({ type: "setPolling", deviceKey: devKey, hz })}
      onSelectSleep={(minutes) => void run({ type: "setSleep", deviceKey: devKey, minutes })}
      onSelectProfile={(name) => void run({ type: "selectProfile", deviceKey: devKey, name })}
      onCreateProfile={(name) => void run({ type: "createProfile", deviceKey: devKey, name })}
      onCreateMacro={(name, steps) => void run({ type: "createMacro", deviceKey: devKey, name, steps })}
      onUndo={() => void run({ type: "undo", deviceKey: devKey })}
      onRedo={() => void run({ type: "redo", deviceKey: devKey })}
    />
  );
}
