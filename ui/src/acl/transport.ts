import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { DEFAULT_BRAND_HEX } from "../design-system/theme";

export type LayerName = "normal" | "hypershift";

export interface DeviceCapabilities {
  hasButtons: boolean;
  hasSideGrid12: boolean;
  hasSideHex6: boolean;
  hasDpi: boolean;
  dpiMin: number;
  dpiMax: number;
  dpiStep: number;
  pollingOptions: number[];
  sleepMaxMinutes: number | null;
  hasAutoSleep: boolean;
  hasScroll: boolean;
  hasMacros: boolean;
  hasLighting: boolean;
  hasGameMode: boolean;
  hasPower: boolean;
}

export interface ButtonEntry {
  id: string;
  normal: string;
  hypershift: string | null;
  remappedNormal: boolean;
  remappedHypershift: boolean;
  savedNormal: string;
  savedHypershift: string | null;
}

export interface OnboardStatus {
  slot: number;
  profile: string;
  count: number;
  changed: boolean;
}

export interface ScrollState {
  mode: string;
  precision: boolean;
  disabled: string[];
  acceleration: string;
  smartReel: string;
}

export interface LightingZoneState {
  id: number;
  name: string;
  color: string;
  effect: string;
  brightness: number;
  off: boolean;
}

export interface LightingState {
  enabled: boolean;
  zones: LightingZoneState[];
}

export interface ProfileSummary {
  name: string;
  apps: string[];
  customButtonsCount: number;
}

export interface MacroSummary {
  id: number;
  name: string;
  steps: string;
  sizeBytes: number;
}

export interface DeviceSummary {
  deviceKey: string;
  name: string;
  kind: string;
  pidHex: string;
  batteryPercent: number | null;
  charging: boolean | null;
}

export interface RunningApp {
  exe: string;
  displayName: string;
  iconDataUrl?: string | null;
}

export interface AppSettings {
  autostart: boolean;
  closeToTray: boolean;
  popups: boolean;
  autoSwitch: boolean;
  batteryWarning: boolean;
  batteryWarningAt: number;
  theme: "system" | "dark" | "light";
  brandHex: string;
  locale: "ar" | "en";
}

export interface DeviceSnapshot {
  mode: "live" | "simulated";
  deviceKey: string;
  name: string;
  kind: string;
  pidHex: string;
  serial: string;
  firmware: string;
  batteryPercent: number | null;
  charging: boolean | null;
  capabilities: DeviceCapabilities;
  buttons: ButtonEntry[];
  onboard: OnboardStatus | null;
  dpi: { activeStage: number; stages: [number, number][]; maxStages: number };
  pollingHz: number | null;
  sleepMinutes: number | null;
  autoSleep: boolean | null;
  scroll: ScrollState | null;
  lighting: LightingState;
  activeProfile: string;
  profiles: ProfileSummary[];
  macros: MacroSummary[];
  macroFreeBytes: number;
  macroMaxBytes: number;
  canUndo: boolean;
  canRedo: boolean;
}

export interface WorkspaceSnapshot {
  devices: DeviceSummary[];
  activeDevice: DeviceSnapshot | null;
  synapseRunning: string[];
  runningApps: RunningApp[];
  settings: AppSettings;
}

export interface FirmwareCheckResult {
  state: "current" | "update" | "none";
  current: string;
  latestVersion: string | null;
  url: string | null;
  guide: string | null;
}

export interface BusResponse {
  workspace: WorkspaceSnapshot;
  firmwareCheck: FirmwareCheckResult | null;
  diagnosticReport: string | null;
  exportedJson: string | null;
}

export type BusCommand =
  | { type: "getSnapshot"; deviceKey?: string }
  | { type: "getWorkspace"; deviceKey?: string }
  | { type: "selectDevice"; deviceKey: string }
  | { type: "rescan" }
  | { type: "setButton"; deviceKey: string; button: string; layer: LayerName; action: string }
  | { type: "resetButton"; deviceKey: string; button: string; layer: LayerName }
  | { type: "restoreAllButtons"; deviceKey: string }
  | { type: "saveOnboard"; deviceKey: string }
  | { type: "putBackOnboard"; deviceKey: string }
  | { type: "setDpiStage"; deviceKey: string; stage: number }
  | { type: "setDpiStages"; deviceKey: string; activeStage: number; stages: [number, number][] }
  | { type: "setPolling"; deviceKey: string; hz: number }
  | { type: "setSleep"; deviceKey: string; minutes?: number; autoSleep?: boolean }
  | {
      type: "setScroll";
      deviceKey: string;
      mode?: string;
      disabled?: string;
      acceleration?: string;
      smartReel?: string;
    }
  | { type: "selectProfile"; deviceKey: string; name: string }
  | { type: "createProfile"; deviceKey: string; name: string }
  | { type: "renameProfile"; deviceKey: string; oldName: string; newName: string }
  | { type: "deleteProfile"; deviceKey: string; name: string }
  | { type: "setProfileApps"; deviceKey: string; name: string; apps: string[] }
  | { type: "exportProfiles" }
  | { type: "importProfiles"; json: string }
  | { type: "createMacro"; deviceKey: string; name: string; steps: string }
  | { type: "deleteMacro"; deviceKey: string; macroId: number }
  | { type: "setLightingControl"; deviceKey: string; enabled: boolean }
  | { type: "setLightingColor"; deviceKey: string; zone: string; color: string }
  | { type: "setLightingBrightness"; deviceKey: string; zone: string; percent: number }
  | { type: "setLightingEffect"; deviceKey: string; zone: string; effect: string }
  | { type: "setLightingOff"; deviceKey: string; zone: string }
  | { type: "syncLighting"; color?: string; effect?: string }
  | { type: "updateSettings"; settings: AppSettings }
  | { type: "checkFirmware"; deviceKey: string }
  | { type: "generateReport" }
  | { type: "openConfigFolder" }
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

const INITIAL_BUTTONS: ButtonEntry[] = [
  { id: "left", normal: "left", hypershift: "left", remappedNormal: false, remappedHypershift: false, savedNormal: "left", savedHypershift: "left" },
  { id: "right", normal: "right", hypershift: "right", remappedNormal: false, remappedHypershift: false, savedNormal: "right", savedHypershift: "right" },
  { id: "wheel", normal: "middle", hypershift: "middle", remappedNormal: false, remappedHypershift: false, savedNormal: "middle", savedHypershift: "middle" },
  { id: "scroll-up", normal: "scroll-up", hypershift: "scroll-up", remappedNormal: false, remappedHypershift: false, savedNormal: "scroll-up", savedHypershift: "scroll-up" },
  { id: "scroll-down", normal: "scroll-down", hypershift: "scroll-down", remappedNormal: false, remappedHypershift: false, savedNormal: "scroll-down", savedHypershift: "scroll-down" },
  { id: "tilt-left", normal: "scroll-down", hypershift: "turbo:scroll-left@50", remappedNormal: true, remappedHypershift: true, savedNormal: "scroll-left", savedHypershift: "scroll-left" },
  { id: "tilt-right", normal: "scroll-up", hypershift: "hypershift", remappedNormal: true, remappedHypershift: true, savedNormal: "scroll-right", savedHypershift: "hypershift" },
  { id: "dpi-up", normal: "dpi-up", hypershift: "dpi-up", remappedNormal: false, remappedHypershift: false, savedNormal: "dpi-up", savedHypershift: "dpi-up" },
  { id: "dpi-down", normal: "dpi-down", hypershift: "dpi-down", remappedNormal: false, remappedHypershift: false, savedNormal: "dpi-down", savedHypershift: "dpi-down" },
  { id: "grid-1", normal: "key:q", hypershift: "key:1", remappedNormal: true, remappedHypershift: false, savedNormal: "key:1", savedHypershift: "key:1" },
  { id: "grid-2", normal: "key:e", hypershift: "key:2", remappedNormal: true, remappedHypershift: false, savedNormal: "key:2", savedHypershift: "key:2" },
  { id: "grid-3", normal: "key:3", hypershift: "key:3", remappedNormal: false, remappedHypershift: false, savedNormal: "key:3", savedHypershift: "key:3" },
  { id: "grid-4", normal: "key:r", hypershift: "key:4", remappedNormal: true, remappedHypershift: false, savedNormal: "key:4", savedHypershift: "key:4" },
  { id: "grid-5", normal: "key:ctrl+shift+alt+win+t", hypershift: "key:5", remappedNormal: true, remappedHypershift: false, savedNormal: "key:5", savedHypershift: "key:5" },
  { id: "grid-6", normal: "key:ctrl+shift+alt+win+c", hypershift: "key:6", remappedNormal: true, remappedHypershift: false, savedNormal: "key:6", savedHypershift: "key:6" },
  { id: "grid-7", normal: "key:win+h", hypershift: "key:7", remappedNormal: true, remappedHypershift: false, savedNormal: "key:7", savedHypershift: "key:7" },
  { id: "grid-8", normal: "key:8", hypershift: "key:8", remappedNormal: false, remappedHypershift: false, savedNormal: "key:8", savedHypershift: "key:8" },
  { id: "grid-9", normal: "key:ctrl+shift+alt+m", hypershift: "key:9", remappedNormal: true, remappedHypershift: false, savedNormal: "key:9", savedHypershift: "key:9" },
  { id: "grid-10", normal: "disabled", hypershift: "key:0", remappedNormal: true, remappedHypershift: false, savedNormal: "key:0", savedHypershift: "key:0" },
  { id: "grid-11", normal: "disabled", hypershift: "key:minus", remappedNormal: true, remappedHypershift: false, savedNormal: "key:minus", savedHypershift: "key:minus" },
  { id: "grid-12", normal: "disabled", hypershift: "key:equal", remappedNormal: true, remappedHypershift: false, savedNormal: "key:equal", savedHypershift: "key:equal" },
];

const SIM_DEVICE: DeviceSnapshot = {
  mode: "simulated",
  deviceKey: "NAGA-V2-HS",
  name: "Razer Naga V2 HyperSpeed",
  kind: "mouse",
  pidHex: "00B4",
  serial: "PM2337H26101218",
  firmware: "v1.1",
  batteryPercent: 72,
  charging: false,
  capabilities: {
    hasButtons: true,
    hasSideGrid12: true,
    hasSideHex6: false,
    hasDpi: true,
    dpiMin: 100,
    dpiMax: 30000,
    dpiStep: 50,
    pollingOptions: [125, 500, 1000],
    sleepMaxMinutes: 15,
    hasAutoSleep: false,
    hasScroll: false,
    hasMacros: false,
    hasLighting: false,
    hasGameMode: false,
    hasPower: false,
  },
  buttons: INITIAL_BUTTONS,
  onboard: null,
  dpi: {
    activeStage: 4,
    stages: [
      [1000, 1000],
      [1500, 1500],
      [2000, 2000],
      [2500, 2500],
      [3000, 3000],
    ],
    maxStages: 5,
  },
  pollingHz: 1000,
  sleepMinutes: 5,
  autoSleep: null,
  scroll: null,
  lighting: { enabled: true, zones: [] },
  activeProfile: "افتراضي",
  profiles: [
    { name: "افتراضي", apps: [], customButtonsCount: 11 },
    { name: "ألعاب", apps: ["cs2.exe"], customButtonsCount: 6 },
    { name: "عمل", apps: ["chrome.exe"], customButtonsCount: 4 },
  ],
  macros: [],
  macroFreeBytes: 0,
  macroMaxBytes: 0,
  canUndo: false,
  canRedo: false,
};

const simState: {
  workspace: WorkspaceSnapshot;
  undoStack: DeviceSnapshot[];
  redoStack: DeviceSnapshot[];
} = {
  workspace: {
    devices: [
      {
        deviceKey: "NAGA-V2-HS",
        name: "Razer Naga V2 HyperSpeed",
        kind: "mouse",
        pidHex: "00B4",
        batteryPercent: 72,
        charging: false,
      },
    ],
    activeDevice: structuredClone(SIM_DEVICE),
    synapseRunning: [],
    runningApps: [
      { exe: "chrome.exe", displayName: "Google Chrome", iconDataUrl: null },
      { exe: "cs2.exe", displayName: "Counter-Strike 2", iconDataUrl: null },
      { exe: "valorant.exe", displayName: "Valorant", iconDataUrl: null },
      { exe: "discord.exe", displayName: "Discord", iconDataUrl: null },
    ],
    settings: {
      autostart: false,
      closeToTray: true,
      popups: true,
      autoSwitch: true,
      batteryWarning: true,
      batteryWarningAt: 15,
      theme: "system",
      brandHex: DEFAULT_BRAND_HEX,
      locale: "ar",
    },
  },
  undoStack: [],
  redoStack: [],
};

function syncSimFlags(dev: DeviceSnapshot): DeviceSnapshot {
  return {
    ...dev,
    canUndo: simState.undoStack.length > 0,
    canRedo: simState.redoStack.length > 0,
  };
}

function runSimulated(cmd: BusCommand): BusResponse {
  const ws = structuredClone(simState.workspace);
  const dev = ws.activeDevice;
  let firmwareCheck: FirmwareCheckResult | null = null;
  let diagnosticReport: string | null = null;
  let exportedJson: string | null = null;

  if (cmd.type === "updateSettings") {
    ws.settings = { ...cmd.settings };
    simState.workspace = ws;
    return { workspace: ws, firmwareCheck, diagnosticReport, exportedJson };
  }

  if (cmd.type === "getWorkspace" || cmd.type === "getSnapshot" || cmd.type === "rescan" || cmd.type === "selectDevice") {
    return { workspace: ws, firmwareCheck, diagnosticReport, exportedJson };
  }

  if (!dev) {
    throw {
      code: "NO_DEVICE",
      userMessageAr: "لم يتم العثور على أي جهاز متصل حالياً.",
      userMessageEn: "No connected device found.",
      recoveryAction: "Connect device",
    } satisfies CommandError;
  }

  if (cmd.type === "checkFirmware") {
    firmwareCheck = {
      state: "current",
      current: dev.firmware,
      latestVersion: null,
      url: null,
      guide: null,
    };
    return { workspace: ws, firmwareCheck, diagnosticReport, exportedJson };
  }
  if (cmd.type === "generateReport") {
    diagnosticReport = `Device: ${dev.name}\nFirmware: ${dev.firmware}`;
    return { workspace: ws, firmwareCheck, diagnosticReport, exportedJson };
  }
  if (cmd.type === "exportProfiles") {
    exportedJson = JSON.stringify({ profiles: dev.profiles }, null, 2);
    return { workspace: ws, firmwareCheck, diagnosticReport, exportedJson };
  }
  if (cmd.type === "openConfigFolder") {
    return { workspace: ws, firmwareCheck, diagnosticReport, exportedJson };
  }

  if (cmd.type === "undo") {
    const prev = simState.undoStack.pop();
    if (prev) {
      simState.redoStack.push(structuredClone(dev));
      ws.activeDevice = syncSimFlags(prev);
      simState.workspace = ws;
    }
    return { workspace: ws, firmwareCheck, diagnosticReport, exportedJson };
  }

  if (cmd.type === "redo") {
    const nxt = simState.redoStack.pop();
    if (nxt) {
      simState.undoStack.push(structuredClone(dev));
      ws.activeDevice = syncSimFlags(nxt);
      simState.workspace = ws;
    }
    return { workspace: ws, firmwareCheck, diagnosticReport, exportedJson };
  }

  const before = structuredClone(dev);

  switch (cmd.type) {
    case "setButton": {
      if (cmd.layer === "normal" && cmd.button === "left" && cmd.action !== "left") {
        const hasOtherLeft = dev.buttons.some((b) => b.id !== "left" && b.normal === "left");
        if (!hasOtherLeft) {
          throw {
            code: "PROTECTED_LEFT_CLICK",
            userMessageAr: "زر النقر الأيسر محمي ولا يمكن إزالته إلا بعد تعيين النقر الأيسر لزر آخر.",
            userMessageEn: "Primary left click stays protected.",
            recoveryAction: "Assign left click elsewhere first",
          } satisfies CommandError;
        }
      }
      dev.buttons = dev.buttons.map((b) => {
        if (b.id !== cmd.button) return b;
        return cmd.layer === "normal"
          ? { ...b, normal: cmd.action, remappedNormal: cmd.action !== b.savedNormal }
          : { ...b, hypershift: cmd.action, remappedHypershift: cmd.action !== b.savedHypershift };
      });
      if (dev.onboard) dev.onboard.changed = true;
      break;
    }
    case "resetButton": {
      dev.buttons = dev.buttons.map((b) => {
        if (b.id !== cmd.button) return b;
        return cmd.layer === "normal"
          ? { ...b, normal: b.savedNormal, remappedNormal: false }
          : { ...b, hypershift: b.savedHypershift, remappedHypershift: false };
      });
      if (dev.onboard) dev.onboard.changed = true;
      break;
    }
    case "restoreAllButtons": {
      dev.buttons = dev.buttons.map((b) => ({
        ...b,
        normal: b.savedNormal,
        hypershift: b.savedHypershift,
        remappedNormal: false,
        remappedHypershift: false,
      }));
      dev.onboard = null;
      break;
    }
    case "saveOnboard": {
      const count = dev.buttons.filter((b) => b.remappedNormal || b.remappedHypershift).length;
      dev.onboard = { slot: 1, profile: dev.activeProfile, count, changed: false };
      break;
    }
    case "putBackOnboard": {
      dev.onboard = null;
      break;
    }
    case "setDpiStage": {
      dev.dpi.activeStage = cmd.stage;
      break;
    }
    case "setDpiStages": {
      dev.dpi.activeStage = cmd.activeStage;
      dev.dpi.stages = cmd.stages.map(([x, y]) => [x, y]);
      break;
    }
    case "setPolling": {
      dev.pollingHz = cmd.hz;
      break;
    }
    case "setSleep": {
      if (cmd.minutes !== undefined) dev.sleepMinutes = cmd.minutes;
      if (cmd.autoSleep !== undefined) dev.autoSleep = cmd.autoSleep;
      break;
    }
    case "selectProfile": {
      if (dev.profiles.some((p) => p.name === cmd.name)) {
        dev.activeProfile = cmd.name;
      }
      break;
    }
    case "createProfile": {
      const clean = cmd.name.trim();
      if (clean && !dev.profiles.some((p) => p.name === clean)) {
        dev.profiles.push({ name: clean, apps: [], customButtonsCount: 0 });
        dev.activeProfile = clean;
      }
      break;
    }
    case "renameProfile": {
      const clean = cmd.newName.trim();
      if (clean && !dev.profiles.some((p) => p.name === clean)) {
        dev.profiles = dev.profiles.map((p) => (p.name === cmd.oldName ? { ...p, name: clean } : p));
        if (dev.activeProfile === cmd.oldName) dev.activeProfile = clean;
      }
      break;
    }
    case "deleteProfile": {
      if (dev.activeProfile !== cmd.name) {
        dev.profiles = dev.profiles.filter((p) => p.name !== cmd.name);
      }
      break;
    }
    case "setProfileApps": {
      const cleanApps = cmd.apps.map((a) => a.trim().toLowerCase()).filter(Boolean);
      dev.profiles = dev.profiles.map((p) => {
        if (p.name === cmd.name) return { ...p, apps: cleanApps };
        return { ...p, apps: p.apps.filter((a) => !cleanApps.includes(a)) };
      });
      break;
    }
    case "importProfiles": {
      break;
    }
  }

  simState.undoStack.push(before);
  simState.redoStack = [];
  ws.activeDevice = syncSimFlags(dev);
  simState.workspace = ws;
  return { workspace: ws, firmwareCheck, diagnosticReport, exportedJson };
}

export async function executeCommand(cmd: BusCommand): Promise<BusResponse> {
  if (!isTauriRuntime()) {
    return runSimulated(cmd);
  }
  const normalizedCmd = cmd.type === "getSnapshot" ? { type: "getWorkspace" as const, deviceKey: cmd.deviceKey } : cmd;
  return invoke<BusResponse>("execute_command", { cmd: normalizedCmd });
}

export type WindowAction = "minimize" | "toggleMaximize" | "isMaximized" | "close" | "startDragging";

export function isDesktopWindow(): boolean {
  if (isTauriRuntime()) return true;
  if (typeof window !== "undefined") {
    return new URLSearchParams(window.location.search).get("desktop") === "1";
  }
  return false;
}

export async function windowControl(action: WindowAction): Promise<boolean> {
  if (!isTauriRuntime()) return false;
  return invoke<boolean>("window_control", { action });
}

export async function subscribeWorkspaceUpdates(onUpdate: () => void): Promise<() => void> {
  if (!isTauriRuntime()) {
    return () => {};
  }
  return listen("grip:workspace-updated", () => onUpdate());
}
