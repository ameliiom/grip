import { useCallback, useEffect, useRef, useState } from "react";
import {
  executeCommand,
  subscribeWorkspaceUpdates,
  type AppSettings,
  type BusCommand,
  type CommandError,
  type FirmwareCheckResult,
  type RawAccelSettings,
  type WorkspaceSnapshot,
} from "./acl/transport";
import { applyThemeTokens, DEFAULT_BRAND_HEX, getSystemTheme, resolveTheme, type ThemeMode } from "./design-system/theme";
import { VOCAB } from "./i18n/vocab";
import { WorkspaceShell, type NavSection } from "./screens/WorkspaceShell";

const DEFAULT_SETTINGS: AppSettings = {
  autostart: false,
  closeToTray: true,
  popups: true,
  autoSwitch: true,
  batteryWarning: true,
  batteryWarningAt: 15,
  theme: "system",
  brandHex: DEFAULT_BRAND_HEX,
  locale: "ar",
  desktopSmooth: {
    enabled: false,
    preset: "balanced",
    strength: 55,
    responsiveness: 65,
    microPrecision: 15,
    rotationDeg: 0,
    bypassInGames: true,
  },
  rawAccel: {
    enabled: false,
    mode: "noaccel",
    outputSmoothingTenths: 0,
    sensMultiplierPct: 100,
    rotationDeg: 0,
    motivityPct: 150,
    syncSpeed: 15,
  },
};

const VALID_SECTIONS: readonly NavSection[] = [
  "buttons",
  "performance",
  "motion",
  "profiles",
  "macros",
  "lighting",
  "settings",
];
const LAST_SECTION_KEY = "grip.lastSection";

function isValidSection(raw: string): raw is NavSection {
  return (VALID_SECTIONS as readonly string[]).includes(raw);
}

function getInitialSection(): NavSection {
  if (typeof window === "undefined") return "buttons";
  const hash = window.location.hash.replace(/^#/, "");
  if (isValidSection(hash)) {
    return hash;
  }
  try {
    const saved = window.localStorage.getItem(LAST_SECTION_KEY);
    if (saved && isValidSection(saved)) {
      return saved;
    }
  } catch {
    // intentional: storage may be disabled in restricted contexts
  }
  return "buttons";
}

export function App() {
  const appVersion = typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "1.0.0";
  const [workspace, setWorkspace] = useState<WorkspaceSnapshot | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [canRetryError, setCanRetryError] = useState(false);
  const [toastState, setToastState] = useState<{ id: number; text: string } | null>(null);
  const [firmwareResult, setFirmwareResult] = useState<FirmwareCheckResult | null>(null);
  const [section, setSection] = useState<NavSection>(getInitialSection);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [systemTheme, setSystemTheme] = useState<ThemeMode>(getSystemTheme);
  const [applyingRawAccel, setApplyingRawAccel] = useState(false);
  const [appliedRawAccel, setAppliedRawAccel] = useState<RawAccelSettings | null>(null);

  const lastFailedCmdRef = useRef<{ cmd: BusCommand; toast?: string } | null>(null);
  const pendingSettingsToastRef = useRef<string | null>(null);

  const settings = workspace?.settings ?? DEFAULT_SETTINGS;
  const vocab = VOCAB[settings.locale];
  const localeRef = useRef(settings.locale);
  useEffect(() => {
    localeRef.current = settings.locale;
  }, [settings.locale]);

  const devKey = workspace?.activeDevice?.deviceKey ?? "";
  const devKeyRef = useRef(devKey);
  useEffect(() => {
    devKeyRef.current = devKey;
  }, [devKey]);

  const nextToastIdRef = useRef(1);
  const showToast = useCallback((text: string) => {
    const id = nextToastIdRef.current++;
    setToastState({ id, text });
  }, []);

  const rawAccelInitRef = useRef(false);
  const hasUnappliedRawAccel = Boolean(
    workspace &&
      appliedRawAccel &&
      JSON.stringify(workspace.settings.rawAccel) !== JSON.stringify(appliedRawAccel),
  );

  const pendingSettingsRef = useRef<AppSettings | null>(null);
  const settingsInFlightRef = useRef(false);
  const settingsTimerRef = useRef<number | null>(null);

  const pendingDpiRef = useRef<{ activeStage: number; stages: [number, number][] } | null>(null);
  const dpiInFlightRef = useRef(false);
  const dpiTimerRef = useRef<number | null>(null);

  const refreshInFlightRef = useRef(false);
  const refreshPendingRef = useRef(false);

  useEffect(() => {
    return () => {
      if (settingsTimerRef.current !== null) window.clearTimeout(settingsTimerRef.current);
      if (dpiTimerRef.current !== null) window.clearTimeout(dpiTimerRef.current);
    };
  }, []);

  useEffect(() => {
    document.documentElement.lang = settings.locale;
    document.documentElement.dir = settings.locale === "ar" ? "rtl" : "ltr";
  }, [settings.locale]);

  useEffect(() => {
    const resolved = settings.theme === "system" ? systemTheme : resolveTheme(settings.theme);
    applyThemeTokens(resolved, settings.brandHex || DEFAULT_BRAND_HEX);
  }, [settings.theme, settings.brandHex, systemTheme]);

  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-color-scheme: light)");
    if (!mq) return;
    const onScheme = (ev: MediaQueryListEvent) => {
      setSystemTheme(ev.matches ? "light" : "dark");
    };
    mq.addEventListener("change", onScheme);
    return () => mq.removeEventListener("change", onScheme);
  }, []);

  useEffect(() => {
    const onHash = () => setSection(getInitialSection());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const selectSection = (next: NavSection) => {
    setSection(next);
    setGuideOpen(false);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(LAST_SECTION_KEY, next);
      } catch {
        // intentional: storage may be disabled in restricted contexts
      }
      window.location.hash = next;
    }
  };

  const formatError = (err: unknown) => {
    const ce = err as Partial<CommandError>;
    return localeRef.current === "ar" ? (ce.userMessageAr ?? String(err)) : (ce.userMessageEn ?? String(err));
  };

  const run = useCallback(
    async (cmd: BusCommand, toastOnSuccess?: string) => {
      try {
        setErrorMsg(null);
        setCanRetryError(false);
        const resp = await executeCommand(cmd);
        lastFailedCmdRef.current = null;
        setWorkspace(resp.workspace);
        if (!rawAccelInitRef.current) {
          rawAccelInitRef.current = true;
          setAppliedRawAccel(resp.workspace.settings.rawAccel);
        }
        if (resp.firmwareCheck) setFirmwareResult(resp.firmwareCheck);
        if (toastOnSuccess) showToast(toastOnSuccess);
        return resp;
      } catch (err) {
        lastFailedCmdRef.current = { cmd, toast: toastOnSuccess };
        setCanRetryError(true);
        setErrorMsg(formatError(err));
        return null;
      }
    },
    [showToast],
  );

  const handleDismissError = useCallback(() => {
    setErrorMsg(null);
    setCanRetryError(false);
    lastFailedCmdRef.current = null;
  }, []);

  const handleRetryError = useCallback(() => {
    const last = lastFailedCmdRef.current;
    if (last) void run(last.cmd, last.toast);
  }, [run]);

  const flushSettings = useCallback(async () => {
    if (settingsInFlightRef.current) return;
    settingsInFlightRef.current = true;
    try {
      while (pendingSettingsRef.current !== null) {
        const next = pendingSettingsRef.current;
        const customToast = pendingSettingsToastRef.current;
        pendingSettingsRef.current = null;
        pendingSettingsToastRef.current = null;
        try {
          setErrorMsg(null);
          setCanRetryError(false);
          const resp = await executeCommand({ type: "updateSettings", settings: next });
          if (pendingSettingsRef.current === null) {
            setWorkspace(resp.workspace);
            showToast(customToast ?? VOCAB[resp.workspace.settings.locale].toastAutoSaved);
          }
        } catch (err) {
          lastFailedCmdRef.current = { cmd: { type: "updateSettings", settings: next }, toast: customToast ?? undefined };
          setCanRetryError(true);
          setErrorMsg(formatError(err));
          pendingSettingsRef.current = null;
        }
      }
    } finally {
      settingsInFlightRef.current = false;
    }
  }, [showToast]);

  const handleUpdateSettings = useCallback(
    (next: AppSettings, toastOverride?: string) => {
      setWorkspace((prev) => (prev ? { ...prev, settings: next } : prev));
      pendingSettingsRef.current = next;
      if (toastOverride) pendingSettingsToastRef.current = toastOverride;
      if (settingsTimerRef.current !== null) {
        window.clearTimeout(settingsTimerRef.current);
      }
      settingsTimerRef.current = window.setTimeout(() => {
        settingsTimerRef.current = null;
        void flushSettings();
      }, 80);
    },
    [flushSettings],
  );

  const flushDpiStages = useCallback(async () => {
    if (dpiInFlightRef.current) return;
    dpiInFlightRef.current = true;
    try {
      while (pendingDpiRef.current !== null) {
        const target = pendingDpiRef.current;
        pendingDpiRef.current = null;
        const key = devKeyRef.current;
        if (!key) break;
        try {
          setErrorMsg(null);
          const resp = await executeCommand({
            type: "setDpiStages",
            deviceKey: key,
            activeStage: target.activeStage,
            stages: target.stages,
          });
          if (pendingDpiRef.current === null) {
            setWorkspace(resp.workspace);
            showToast(VOCAB[resp.workspace.settings.locale].toastAppliedToMouse);
          }
        } catch (err) {
          setErrorMsg(formatError(err));
          pendingDpiRef.current = null;
        }
      }
    } finally {
      dpiInFlightRef.current = false;
    }
  }, [showToast]);

  const handleCommitDpiStages = useCallback(
    (activeStage: number, stages: [number, number][]) => {
      setWorkspace((prev) =>
        prev?.activeDevice
          ? {
              ...prev,
              activeDevice: {
                ...prev.activeDevice,
                dpi: { ...prev.activeDevice.dpi, activeStage, stages },
              },
            }
          : prev,
      );
      pendingDpiRef.current = { activeStage, stages };
      if (dpiTimerRef.current !== null) {
        window.clearTimeout(dpiTimerRef.current);
      }
      dpiTimerRef.current = window.setTimeout(() => {
        dpiTimerRef.current = null;
        void flushDpiStages();
      }, 120);
    },
    [flushDpiStages],
  );

  const refreshWorkspaceCoalesced = useCallback(async () => {
    if (refreshInFlightRef.current) {
      refreshPendingRef.current = true;
      return;
    }
    refreshInFlightRef.current = true;
    try {
      do {
        refreshPendingRef.current = false;
        await run({ type: "getWorkspace" });
      } while (refreshPendingRef.current);
    } finally {
      refreshInFlightRef.current = false;
    }
  }, [run]);

  useEffect(() => {
    void refreshWorkspaceCoalesced();
  }, [refreshWorkspaceCoalesced]);

  useEffect(() => {
    let unlisten: (() => void) | null = null;
    void subscribeWorkspaceUpdates(() => {
      void refreshWorkspaceCoalesced();
    }).then((fn) => {
      unlisten = fn;
    });
    return () => {
      if (unlisten) unlisten();
    };
  }, [refreshWorkspaceCoalesced]);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "F1") {
        ev.preventDefault();
        setGuideOpen((open) => !open);
        return;
      }
      const mod = ev.ctrlKey || ev.metaKey;
      if (mod && ev.code === "KeyK") {
        ev.preventDefault();
        setPaletteOpen((open) => !open);
        return;
      }
      const target = ev.target as HTMLElement | null;
      const inEditable = Boolean(target?.closest("input, textarea, [contenteditable='true']"));
      if (!inEditable && mod && devKey) {
        if (ev.code === "KeyZ") {
          ev.preventDefault();
          if (ev.shiftKey) void run({ type: "redo", deviceKey: devKey });
          else void run({ type: "undo", deviceKey: devKey });
        } else if (ev.code === "KeyY") {
          ev.preventDefault();
          void run({ type: "redo", deviceKey: devKey });
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [devKey, run]);

  const handleApplyRawAccel = useCallback(
    (raw: RawAccelSettings, toastMsg?: string) => {
      if (applyingRawAccel) return;
      setApplyingRawAccel(true);
      void run({ type: "applyRawAccel", settings: raw }, toastMsg ?? vocab.toastRawAccelApplied)
        .then((resp) => {
          if (resp) setAppliedRawAccel(resp.workspace.settings.rawAccel);
        })
        .finally(() => setApplyingRawAccel(false));
    },
    [applyingRawAccel, run, vocab.toastRawAccelApplied],
  );

  const handleDiscardRawAccel = useCallback(() => {
    if (!workspace || !appliedRawAccel) return;
    handleUpdateSettings({ ...workspace.settings, rawAccel: appliedRawAccel }, vocab.toastDiscardedChanges);
  }, [appliedRawAccel, handleUpdateSettings, vocab.toastDiscardedChanges, workspace]);

  const handleResetDesktopMotion = useCallback(() => {
    handleUpdateSettings({ ...settings, desktopSmooth: { ...DEFAULT_SETTINGS.desktopSmooth } }, vocab.toastResetDefaults);
  }, [handleUpdateSettings, settings, vocab.toastResetDefaults]);

  const handleResetRawAccel = useCallback(() => {
    const defRaw = { ...DEFAULT_SETTINGS.rawAccel };
    if (workspace?.rawAccelStatus.driverRunning) {
      handleApplyRawAccel(defRaw, vocab.toastResetDefaults);
    } else {
      handleUpdateSettings({ ...settings, rawAccel: defRaw }, vocab.toastResetDefaults);
    }
  }, [handleApplyRawAccel, handleUpdateSettings, settings, vocab.toastResetDefaults, workspace?.rawAccelStatus.driverRunning]);

  const handleResetPerformance = useCallback(async () => {
    const dev = workspace?.activeDevice;
    if (!dev) return;
    const caps = dev.capabilities;
    const snapDpi = (v: number) => {
      const c = Math.min(caps.dpiMax, Math.max(caps.dpiMin, v));
      return caps.dpiMin + Math.round((c - caps.dpiMin) / caps.dpiStep) * caps.dpiStep;
    };
    const stages: [number, number][] = [800, 1600, 2400, 3200]
      .slice(0, Math.max(1, dev.dpi.maxStages))
      .map((v) => {
        const s = snapDpi(v);
        return [s, s];
      });
    await run({
      type: "setDpiStages",
      deviceKey: dev.deviceKey,
      activeStage: Math.min(2, stages.length),
      stages,
    });
    if (caps.pollingOptions.length > 0 && dev.pollingHz !== null) {
      const targetHz = caps.pollingOptions.includes(1000)
        ? 1000
        : (caps.pollingOptions[caps.pollingOptions.length - 1] ?? dev.pollingHz);
      if (dev.pollingHz !== targetHz) {
        await run({ type: "setPolling", deviceKey: dev.deviceKey, hz: targetHz });
      }
    }
    if (caps.sleepMaxMinutes && dev.sleepMinutes !== null) {
      await run({
        type: "setSleep",
        deviceKey: dev.deviceKey,
        minutes: Math.min(caps.sleepMaxMinutes, 5),
        autoSleep: caps.hasAutoSleep ? false : undefined,
      });
    }
    showToast(vocab.toastResetDefaults);
  }, [run, showToast, vocab.toastResetDefaults, workspace?.activeDevice]);

  const handleResetAppSettings = useCallback(() => {
    handleUpdateSettings({ ...DEFAULT_SETTINGS, locale: settings.locale }, vocab.toastResetDefaults);
  }, [handleUpdateSettings, settings.locale, vocab.toastResetDefaults]);

  return (
    <WorkspaceShell
      workspace={workspace}
      appVersion={appVersion}
      errorMsg={errorMsg}
      canRetryError={canRetryError}
      onRetryError={handleRetryError}
      onDismissError={handleDismissError}
      onNotify={showToast}
      statusToast={toastState?.text ?? null}
      toastKey={toastState?.id ?? 0}
      onClearToast={() => setToastState(null)}
      firmwareResult={firmwareResult}
      section={section}
      paletteOpen={paletteOpen}
      onPaletteOpenChange={setPaletteOpen}
      guideOpen={guideOpen}
      onGuideOpenChange={setGuideOpen}
      applyingRawAccel={applyingRawAccel}
      hasUnappliedRawAccel={hasUnappliedRawAccel}
      vocab={vocab}
      onSelectSection={selectSection}
      onSelectDevice={(k) => void run({ type: "selectDevice", deviceKey: k })}
      onRescan={() => void run({ type: "rescan" })}
      onSetButton={(button, layer, action) =>
        void run({ type: "setButton", deviceKey: devKey, button, layer, action }, vocab.toastButtonSaved)
      }
      onResetButton={(button, layer) =>
        void run({ type: "resetButton", deviceKey: devKey, button, layer }, vocab.toastButtonReset)
      }
      onRestoreAll={() => void run({ type: "restoreAllButtons", deviceKey: devKey }, vocab.toastRestoredAll)}
      onSaveOnboard={() => void run({ type: "saveOnboard", deviceKey: devKey }, vocab.toastSavedOnboard)}
      onPutBackOnboard={() => void run({ type: "putBackOnboard", deviceKey: devKey }, vocab.toastRestoredFactory)}
      onSelectDpiStage={(stage) => void run({ type: "setDpiStage", deviceKey: devKey, stage }, vocab.toastAppliedToMouse)}
      onCommitDpiStages={handleCommitDpiStages}
      onSelectPolling={(hz) => void run({ type: "setPolling", deviceKey: devKey, hz }, vocab.toastAppliedToMouse)}
      onSetSleep={(minutes, autoSleep) =>
        void run({ type: "setSleep", deviceKey: devKey, minutes, autoSleep }, vocab.toastAppliedToMouse)
      }
      onSetScroll={(patch) => void run({ type: "setScroll", deviceKey: devKey, ...patch }, vocab.toastAppliedToMouse)}
      onSelectProfile={(name) => void run({ type: "selectProfile", deviceKey: devKey, name }, vocab.toastProfileUpdated)}
      onCreateProfile={(name) => void run({ type: "createProfile", deviceKey: devKey, name }, vocab.toastProfileUpdated)}
      onRenameProfile={(oldName, newName) =>
        void run({ type: "renameProfile", deviceKey: devKey, oldName, newName }, vocab.toastProfileUpdated)
      }
      onDeleteProfile={(name) => void run({ type: "deleteProfile", deviceKey: devKey, name }, vocab.toastProfileUpdated)}
      onSetProfileApps={(name, apps) =>
        void run({ type: "setProfileApps", deviceKey: devKey, name, apps }, vocab.toastProfileUpdated)
      }
      onExportProfiles={async () => {
        const resp = await run({ type: "exportProfiles" });
        return resp?.exportedJson ?? null;
      }}
      onImportProfiles={(json) => void run({ type: "importProfiles", json }, vocab.toastImportedProfiles)}
      onCreateMacro={(name, steps) =>
        void run({ type: "createMacro", deviceKey: devKey, name, steps }, vocab.toastSavedOnboard)
      }
      onDeleteMacro={(macroId) => void run({ type: "deleteMacro", deviceKey: devKey, macroId }, vocab.toastProfileUpdated)}
      onSetLightingControl={(enabled) =>
        void run({ type: "setLightingControl", deviceKey: devKey, enabled }, vocab.toastAppliedToMouse)
      }
      onSetLightingColor={(zone, color) =>
        void run({ type: "setLightingColor", deviceKey: devKey, zone, color }, vocab.toastAppliedToMouse)
      }
      onSetLightingBrightness={(zone, percent) =>
        void run({ type: "setLightingBrightness", deviceKey: devKey, zone, percent }, vocab.toastAppliedToMouse)
      }
      onSetLightingEffect={(zone, effect) =>
        void run({ type: "setLightingEffect", deviceKey: devKey, zone, effect }, vocab.toastAppliedToMouse)
      }
      onSetLightingOff={(zone) => void run({ type: "setLightingOff", deviceKey: devKey, zone }, vocab.toastAppliedToMouse)}
      onSyncLighting={(color) => void run({ type: "syncLighting", color }, vocab.toastAppliedToMouse)}
      onUpdateSettings={(next) => handleUpdateSettings(next)}
      onApplyRawAccel={(raw: RawAccelSettings) => handleApplyRawAccel(raw)}
      onDiscardRawAccel={handleDiscardRawAccel}
      onResetDesktopMotion={handleResetDesktopMotion}
      onResetRawAccel={handleResetRawAccel}
      onResetPerformance={() => void handleResetPerformance()}
      onResetAppSettings={handleResetAppSettings}
      onOpenRawAccelDownload={() => void run({ type: "openRawAccelDownload" })}
      onRefreshMotionStatus={() => void run({ type: "refreshMotionStatus" })}
      onCheckFirmware={() => void run({ type: "checkFirmware", deviceKey: devKey })}
      onCopyReport={async () => {
        const resp = await run({ type: "generateReport" });
        if (resp?.diagnosticReport && navigator.clipboard) {
          await navigator.clipboard.writeText(resp.diagnosticReport);
        }
      }}
      onOpenFolder={() => void run({ type: "openConfigFolder" })}
      onUndo={() => void run({ type: "undo", deviceKey: devKey })}
      onRedo={() => void run({ type: "redo", deviceKey: devKey })}
    />
  );
}
