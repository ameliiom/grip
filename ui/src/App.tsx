import { useCallback, useEffect, useState } from "react";
import {
  executeCommand,
  type AppSettings,
  type BusCommand,
  type CommandError,
  type FirmwareCheckResult,
  type WorkspaceSnapshot,
} from "./acl/transport";
import { applyThemeTokens, DEFAULT_BRAND_HEX } from "./design-system/theme";
import { VOCAB } from "./i18n/vocab";
import { WorkspaceShell, type NavSection } from "./screens/WorkspaceShell";

const DEFAULT_SETTINGS: AppSettings = {
  autostart: false,
  popups: true,
  autoSwitch: true,
  batteryWarning: true,
  batteryWarningAt: 15,
  theme: "dark",
  brandHex: DEFAULT_BRAND_HEX,
  locale: "ar",
};

function getInitialSection(): NavSection {
  if (typeof window === "undefined") return "buttons";
  const hash = window.location.hash.replace(/^#/, "") as NavSection;
  if (["buttons", "performance", "profiles", "macros", "lighting", "settings"].includes(hash)) {
    return hash;
  }
  return "buttons";
}

export function App() {
  const [workspace, setWorkspace] = useState<WorkspaceSnapshot | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [firmwareResult, setFirmwareResult] = useState<FirmwareCheckResult | null>(null);
  const [section, setSection] = useState<NavSection>(getInitialSection);

  const settings = workspace?.settings ?? DEFAULT_SETTINGS;
  const vocab = VOCAB[settings.locale];

  useEffect(() => {
    document.documentElement.lang = settings.locale;
    document.documentElement.dir = settings.locale === "ar" ? "rtl" : "ltr";
  }, [settings.locale]);

  useEffect(() => {
    const scheme =
      typeof window !== "undefined" && !workspace && window.matchMedia?.("(prefers-color-scheme: light)").matches
        ? "light"
        : settings.theme;
    applyThemeTokens(scheme, settings.brandHex || DEFAULT_BRAND_HEX);
  }, [settings.theme, settings.brandHex, workspace]);

  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-color-scheme: light)");
    if (!mq) return;
    const onScheme = (ev: MediaQueryListEvent) => {
      const nextTheme = ev.matches ? "light" : "dark";
      setWorkspace((prev) =>
        prev ? { ...prev, settings: { ...prev.settings, theme: nextTheme } } : prev,
      );
      applyThemeTokens(nextTheme, settings.brandHex || DEFAULT_BRAND_HEX);
    };
    mq.addEventListener("change", onScheme);
    return () => mq.removeEventListener("change", onScheme);
  }, [settings.brandHex]);

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

  const run = useCallback(
    async (cmd: BusCommand) => {
      try {
        setErrorMsg(null);
        const resp = await executeCommand(cmd);
        setWorkspace(resp.workspace);
        if (resp.firmwareCheck) setFirmwareResult(resp.firmwareCheck);
        return resp;
      } catch (err) {
        const ce = err as Partial<CommandError>;
        const msg = settings.locale === "ar" ? (ce.userMessageAr ?? String(err)) : (ce.userMessageEn ?? String(err));
        setErrorMsg(msg);
        return null;
      }
    },
    [settings.locale],
  );

  useEffect(() => {
    void run({ type: "getWorkspace" });
  }, [run]);

  const devKey = workspace?.activeDevice?.deviceKey ?? "";

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "z" && devKey) {
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
      firmwareResult={firmwareResult}
      section={section}
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
      onRestoreAll={() => void run({ type: "restoreAllButtons", deviceKey: devKey })}
      onSaveOnboard={() => void run({ type: "saveOnboard", deviceKey: devKey })}
      onPutBackOnboard={() => void run({ type: "putBackOnboard", deviceKey: devKey })}
      onSelectDpiStage={(stage) => void run({ type: "setDpiStage", deviceKey: devKey, stage })}
      onCommitDpiStages={(activeStage, stages) =>
        void run({ type: "setDpiStages", deviceKey: devKey, activeStage, stages })
      }
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
      onImportProfiles={(json) => void run({ type: "importProfiles", json })}
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
      onUpdateSettings={(next) => void run({ type: "updateSettings", settings: next })}
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
