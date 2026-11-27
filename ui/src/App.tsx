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

function getInitialSection(): NavSection {
  if (typeof window === "undefined") return "buttons";
  const hash = window.location.hash.replace(/^#/, "") as NavSection;
  if (["buttons", "performance", "motion", "profiles", "macros", "lighting", "settings"].includes(hash)) {
    return hash;
  }
  return "buttons";
}

export function App() {
  const [workspace, setWorkspace] = useState<WorkspaceSnapshot | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusToast, setStatusToast] = useState<string | null>(null);
  const [firmwareResult, setFirmwareResult] = useState<FirmwareCheckResult | null>(null);
  const [section, setSection] = useState<NavSection>(getInitialSection);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [systemTheme, setSystemTheme] = useState<ThemeMode>(getSystemTheme);
  const [applyingRawAccel, setApplyingRawAccel] = useState(false);

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
    if (typeof window !== "undefined") {
      window.location.hash = next;
    }
  };

  const formatError = (err: unknown) => {
    const ce = err as Partial<CommandError>;
    return localeRef.current === "ar" ? (ce.userMessageAr ?? String(err)) : (ce.userMessageEn ?? String(err));
  };

  const run = useCallback(async (cmd: BusCommand, toastOnSuccess?: string) => {
    try {
      setErrorMsg(null);
      const resp = await executeCommand(cmd);
      setWorkspace(resp.workspace);
      if (resp.firmwareCheck) setFirmwareResult(resp.firmwareCheck);
      if (toastOnSuccess) setStatusToast(toastOnSuccess);
      return resp;
    } catch (err) {
      setErrorMsg(formatError(err));
      return null;
    }
  }, []);

  const flushSettings = useCallback(async () => {
    if (settingsInFlightRef.current) return;
    settingsInFlightRef.current = true;
    try {
      while (pendingSettingsRef.current !== null) {
        const next = pendingSettingsRef.current;
        pendingSettingsRef.current = null;
        try {
          setErrorMsg(null);
          const resp = await executeCommand({ type: "updateSettings", settings: next });
          if (pendingSettingsRef.current === null) {
            setWorkspace(resp.workspace);
          }
        } catch (err) {
          setErrorMsg(formatError(err));
          pendingSettingsRef.current = null;
        }
      }
    } finally {
      settingsInFlightRef.current = false;
    }
  }, []);

  const handleUpdateSettings = useCallback(
    (next: AppSettings) => {
      setWorkspace((prev) => (prev ? { ...prev, settings: next } : prev));
      pendingSettingsRef.current = next;
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
          }
        } catch (err) {
          setErrorMsg(formatError(err));
          pendingDpiRef.current = null;
        }
      }
    } finally {
      dpiInFlightRef.current = false;
    }
  }, []);

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
      const mod = ev.ctrlKey || ev.metaKey;
      if (mod && ev.key.toLowerCase() === "k") {
        ev.preventDefault();
        setPaletteOpen((open) => !open);
        return;
      }
      if (mod && ev.key.toLowerCase() === "z" && devKey) {
        ev.preventDefault();
        if (ev.shiftKey) void run({ type: "redo", deviceKey: devKey });
        else void run({ type: "undo", deviceKey: devKey });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [devKey, run]);

  return (
    <WorkspaceShell
      workspace={workspace}
      errorMsg={errorMsg}
      statusToast={statusToast}
      onClearToast={() => setStatusToast(null)}
      firmwareResult={firmwareResult}
      section={section}
      paletteOpen={paletteOpen}
      onPaletteOpenChange={setPaletteOpen}
      applyingRawAccel={applyingRawAccel}
      vocab={vocab}
      onSelectSection={selectSection}
      onSelectDevice={(k) => void run({ type: "selectDevice", deviceKey: k })}
      onRescan={() => void run({ type: "rescan" })}
      onSetButton={(button, layer, action) =>
        void run({ type: "setButton", deviceKey: devKey, button, layer, action })
      }
      onResetButton={(button, layer) =>
        void run({ type: "resetButton", deviceKey: devKey, button, layer })
      }
      onRestoreAll={() => void run({ type: "restoreAllButtons", deviceKey: devKey }, vocab.toastRestoredAll)}
      onSaveOnboard={() => void run({ type: "saveOnboard", deviceKey: devKey }, vocab.toastSavedOnboard)}
      onPutBackOnboard={() => void run({ type: "putBackOnboard", deviceKey: devKey }, vocab.toastRestoredFactory)}
      onSelectDpiStage={(stage) => void run({ type: "setDpiStage", deviceKey: devKey, stage })}
      onCommitDpiStages={handleCommitDpiStages}
      onSelectPolling={(hz) => void run({ type: "setPolling", deviceKey: devKey, hz })}
      onSetSleep={(minutes, autoSleep) =>
        void run({ type: "setSleep", deviceKey: devKey, minutes, autoSleep })
      }
      onSetScroll={(patch) => void run({ type: "setScroll", deviceKey: devKey, ...patch })}
      onSelectProfile={(name) => void run({ type: "selectProfile", deviceKey: devKey, name })}
      onCreateProfile={(name) => void run({ type: "createProfile", deviceKey: devKey, name })}
      onRenameProfile={(oldName, newName) =>
        void run({ type: "renameProfile", deviceKey: devKey, oldName, newName })
      }
      onDeleteProfile={(name) => void run({ type: "deleteProfile", deviceKey: devKey, name })}
      onSetProfileApps={(name, apps) =>
        void run({ type: "setProfileApps", deviceKey: devKey, name, apps })
      }
      onExportProfiles={async () => {
        const resp = await run({ type: "exportProfiles" });
        return resp?.exportedJson ?? null;
      }}
      onImportProfiles={(json) => void run({ type: "importProfiles", json }, vocab.toastImportedProfiles)}
      onCreateMacro={(name, steps) =>
        void run({ type: "createMacro", deviceKey: devKey, name, steps })
      }
      onDeleteMacro={(macroId) => void run({ type: "deleteMacro", deviceKey: devKey, macroId })}
      onSetLightingControl={(enabled) =>
        void run({ type: "setLightingControl", deviceKey: devKey, enabled })
      }
      onSetLightingColor={(zone, color) =>
        void run({ type: "setLightingColor", deviceKey: devKey, zone, color })
      }
      onSetLightingBrightness={(zone, percent) =>
        void run({ type: "setLightingBrightness", deviceKey: devKey, zone, percent })
      }
      onSetLightingEffect={(zone, effect) =>
        void run({ type: "setLightingEffect", deviceKey: devKey, zone, effect })
      }
      onSetLightingOff={(zone) => void run({ type: "setLightingOff", deviceKey: devKey, zone })}
      onSyncLighting={(color) => void run({ type: "syncLighting", color })}
      onUpdateSettings={handleUpdateSettings}
      onApplyRawAccel={(raw: RawAccelSettings) => {
        if (applyingRawAccel) return;
        setApplyingRawAccel(true);
        void run({ type: "applyRawAccel", settings: raw }, vocab.toastRawAccelApplied).finally(() =>
          setApplyingRawAccel(false),
        );
      }}
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
