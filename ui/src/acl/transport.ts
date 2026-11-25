import { invoke } from "@tauri-apps/api/core";

export type LayerName = "normal" | "hypershift";

export interface DeviceCapabilities {
  hasButtons: boolean;
  hasSideGrid12: boolean;
  hasDpi: boolean;
  dpiMin: number;
  dpiMax: number;
  dpiStep: number;
  pollingOptions: number[];
  sleepMaxMinutes: number | null;
  hasMacros: boolean;
  hasLighting: boolean;
}

export interface ProfileSummary {
  name: string;
  apps: string[];
}

export interface MacroSummary {
  id: number;
  name: string;
  steps: string;
}

export interface DeviceSnapshot {
  mode: "live" | "simulated";
  deviceKey: string;
  name: string;
  pidHex: string;
  serial: string;
  firmware: string;
  batteryPercent: number | null;
  charging: boolean | null;
  capabilities: DeviceCapabilities;
  dpi: { activeStage: number; stages: number[] };
  pollingHz: number | null;
  sleepMinutes: number | null;
  activeProfile: string;
  profiles: ProfileSummary[];
  buttonsNormal: Record<string, string>;
  buttonsHyperShift: Record<string, string>;
  macros: MacroSummary[];
  onboardSavedAt: string | null;
  canUndo: boolean;
  canRedo: boolean;
}

export type BusCommand =
  | { type: "getSnapshot"; deviceKey?: string }
  | { type: "rescan" }
  | { type: "setButton"; deviceKey: string; button: string; layer: LayerName; action: string }
  | { type: "resetButton"; deviceKey: string; button: string; layer: LayerName }
  | { type: "restoreAllButtons"; deviceKey: string }
  | { type: "saveOnboard"; deviceKey: string }
  | { type: "setDpiStage"; deviceKey: string; stage: number }
  | { type: "setDpiStages"; deviceKey: string; activeStage: number; stages: number[] }
  | { type: "setPolling"; deviceKey: string; hz: number }
  | { type: "setSleep"; deviceKey: string; minutes: number }
  | { type: "selectProfile"; deviceKey: string; name: string }
  | { type: "createProfile"; deviceKey: string; name: string }
  | { type: "setProfileApps"; deviceKey: string; name: string; apps: string[] }
  | { type: "createMacro"; deviceKey: string; name: string; steps: string }
  | { type: "undo"; deviceKey: string }
  | { type: "redo"; deviceKey: string };

export interface CommandError {
  code: string;
  userMessageAr: string;
  userMessageEn: string;
  recoveryAction: string;
}

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

// Browser preview / real-browser multi-width audit simulator matching the owner's observed hardware
const BASE_NORMAL: Record<string, string> = {
  left: "left",
  right: "right",
  wheel: "middle",
  "scroll-up": "scroll-up",
  "scroll-down": "scroll-down",
  "dpi-up": "dpi-up",
  "dpi-down": "dpi-down",
  "tilt-left": "scroll-down",
  "tilt-right": "scroll-up",
  "grid-1": "key:q",
  "grid-2": "key:e",
  "grid-3": "key:3",
  "grid-4": "key:r",
  "grid-5": "key:ctrl+shift+alt+win+t",
  "grid-6": "key:ctrl+shift+alt+win+c",
  "grid-7": "key:win+h",
  "grid-8": "key:8",
  "grid-9": "key:ctrl+shift+alt+m",
  "grid-10": "disabled",
  "grid-11": "disabled",
  "grid-12": "disabled",
};

const BASE_HYPERSHIFT: Record<string, string> = {
  left: "left",
  right: "right",
  wheel: "middle",
  "tilt-left": "back",
  "tilt-right": "forward",
  "dpi-up": "profile-cycle-up",
  "dpi-down": "profile-cycle-down",
  "grid-1": "key:ctrl+c",
  "grid-2": "key:ctrl+v",
  "grid-3": "key:ctrl+z",
  "grid-4": "key:ctrl+y",
  "grid-5": "media:mute",
  "grid-6": "media:play-pause",
  "grid-7": "media:volume-up",
  "grid-8": "media:volume-down",
  "grid-9": "disabled",
  "grid-10": "disabled",
  "grid-11": "disabled",
  "grid-12": "disabled",
};

interface SimStore {
  snapshot: DeviceSnapshot;
  undoStack: DeviceSnapshot[];
  redoStack: DeviceSnapshot[];
}

const simStore: SimStore = {
  snapshot: {
    mode: "simulated",
    deviceKey: "00B4:PM2337H26101218",
    name: "Razer Naga V2 HyperSpeed",
    pidHex: "00B4",
    serial: "PM2337H26101218",
    firmware: "v1.1",
    batteryPercent: 94,
    charging: false,
    capabilities: {
      hasButtons: true,
      hasSideGrid12: true,
      hasDpi: true,
      dpiMin: 100,
      dpiMax: 30000,
      dpiStep: 50,
      pollingOptions: [125, 500, 1000],
      sleepMaxMinutes: 15,
      hasMacros: true,
      hasLighting: false,
    },
    dpi: { activeStage: 4, stages: [1000, 1500, 2000, 2500, 3000] },
    pollingHz: 1000,
    sleepMinutes: 5,
    activeProfile: "افتراضي",
    profiles: [
      { name: "افتراضي", apps: [] },
      { name: "ألعاب", apps: ["cs2.exe"] },
      { name: "إنتاجية", apps: ["code.exe"] },
    ],
    buttonsNormal: { ...BASE_NORMAL },
    buttonsHyperShift: { ...BASE_HYPERSHIFT },
    macros: [{ id: 1, name: "نسخ سريع", steps: "tap:ctrl+c wait:30" }],
    onboardSavedAt: null,
    canUndo: false,
    canRedo: false,
  },
  undoStack: [],
  redoStack: [],
};

function cloneSnapshot(snap: DeviceSnapshot): DeviceSnapshot {
  return JSON.parse(JSON.stringify(snap)) as DeviceSnapshot;
}

function syncHistoryFlags(snap: DeviceSnapshot): DeviceSnapshot {
  return {
    ...snap,
    canUndo: simStore.undoStack.length > 0,
    canRedo: simStore.redoStack.length > 0,
  };
}

function runSimulated(cmd: BusCommand): DeviceSnapshot {
  if (cmd.type === "getSnapshot" || cmd.type === "rescan") {
    return syncHistoryFlags(simStore.snapshot);
  }
  if (cmd.type === "undo") {
    const prev = simStore.undoStack.pop();
    if (prev) {
      simStore.redoStack.push(cloneSnapshot(simStore.snapshot));
      simStore.snapshot = prev;
    }
    return syncHistoryFlags(simStore.snapshot);
  }
  if (cmd.type === "redo") {
    const next = simStore.redoStack.pop();
    if (next) {
      simStore.undoStack.push(cloneSnapshot(simStore.snapshot));
      simStore.snapshot = next;
    }
    return syncHistoryFlags(simStore.snapshot);
  }

  const before = cloneSnapshot(simStore.snapshot);
  const next = cloneSnapshot(simStore.snapshot);

  switch (cmd.type) {
    case "setButton": {
      if (cmd.layer === "normal" && cmd.button === "left" && cmd.action !== "left") {
        throw {
          code: "PROTECTED_LEFT_CLICK",
          userMessageAr: "زر النقر الأيسر محمي ولا يمكن تغييره.",
          userMessageEn: "Left click is protected and cannot be changed.",
          recoveryAction: "Select another button",
        } satisfies CommandError;
      }
      if (cmd.layer === "normal") next.buttonsNormal[cmd.button] = cmd.action;
      else next.buttonsHyperShift[cmd.button] = cmd.action;
      break;
    }
    case "resetButton": {
      if (cmd.layer === "normal") next.buttonsNormal[cmd.button] = BASE_NORMAL[cmd.button] ?? "disabled";
      else next.buttonsHyperShift[cmd.button] = BASE_HYPERSHIFT[cmd.button] ?? "disabled";
      break;
    }
    case "restoreAllButtons": {
      next.buttonsNormal = { ...BASE_NORMAL };
      next.buttonsHyperShift = { ...BASE_HYPERSHIFT };
      break;
    }
    case "saveOnboard": {
      next.onboardSavedAt = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
      break;
    }
    case "setDpiStage": {
      if (cmd.stage >= 1 && cmd.stage <= next.dpi.stages.length) {
        next.dpi.activeStage = cmd.stage;
      }
      break;
    }
    case "setDpiStages": {
      if (cmd.stages.length >= 1 && cmd.stages.length <= 5) {
        next.dpi = { activeStage: cmd.activeStage, stages: [...cmd.stages] };
      }
      break;
    }
    case "setPolling": {
      next.pollingHz = cmd.hz;
      break;
    }
    case "setSleep": {
      next.sleepMinutes = cmd.minutes;
      break;
    }
    case "selectProfile": {
      if (next.profiles.some((p) => p.name === cmd.name)) {
        next.activeProfile = cmd.name;
      }
      break;
    }
    case "createProfile": {
      const clean = cmd.name.trim();
      if (clean && !next.profiles.some((p) => p.name === clean)) {
        next.profiles.push({ name: clean, apps: [] });
        next.activeProfile = clean;
      }
      break;
    }
    case "setProfileApps": {
      next.profiles = next.profiles.map((p) => (p.name === cmd.name ? { ...p, apps: cmd.apps } : p));
      break;
    }
    case "createMacro": {
      const clean = cmd.name.trim();
      const steps = cmd.steps.trim();
      if (clean && steps) {
        const nextId = next.macros.reduce((m, item) => Math.max(m, item.id), 0) + 1;
        next.macros.push({ id: nextId, name: clean, steps });
      }
      break;
    }
  }

  simStore.undoStack.push(before);
  simStore.redoStack = [];
  simStore.snapshot = next;
  return syncHistoryFlags(simStore.snapshot);
}

export async function executeCommand(cmd: BusCommand): Promise<DeviceSnapshot> {
  if (!isTauriRuntime()) {
    return runSimulated(cmd);
  }
  return invoke<DeviceSnapshot>("execute_command", { cmd });
}
