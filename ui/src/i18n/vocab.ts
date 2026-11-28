export type Locale = "ar" | "en";

export function cleanDeviceDisplayName(name: string): string {
  return name.replace(/\s*\((?:Receiver|Wireless|Wired|Dongle|Bluetooth)\)\s*$/i, "").trim() || name;
}

export type ParsedAction =
  | { kind: "disabled" }
  | { kind: "mouse"; value: string }
  | { kind: "dpi"; value: string }
  | { kind: "dpi-clutch"; dpi: number }
  | { kind: "hypershift" }
  | { kind: "profile"; value: string }
  | { kind: "scroll-mode"; value: string }
  | { kind: "media"; value: string }
  | { kind: "key"; combo: string }
  | { kind: "turbo"; target: string; rate: number }
  | { kind: "macro"; id: number; mode: "once" | "times" | "hold" | "toggle"; count: number }
  | { kind: "unknown"; raw: string };

export function parseAction(raw: string): ParsedAction {
  const s = (raw || "").trim();
  if (!s || s === "disabled") return { kind: "disabled" };
  if (s === "hypershift") return { kind: "hypershift" };
  if (["profile-up", "profile-down", "profile-cycle-up", "profile-cycle-down"].includes(s) || s.startsWith("profile:")) {
    return { kind: "profile", value: s };
  }
  if (s.startsWith("scroll-mode:")) {
    return { kind: "scroll-mode", value: s.slice(12) };
  }
  if (["dpi-up", "dpi-down", "dpi-cycle-up", "dpi-cycle-down"].includes(s)) {
    return { kind: "dpi", value: s };
  }
  if (s.startsWith("dpi-clutch:")) {
    const dpi = Number.parseInt(s.slice(11), 10) || 400;
    return { kind: "dpi-clutch", dpi };
  }
  if (s.startsWith("turbo:")) {
    const rest = s.slice(6);
    const [target, rateStr] = rest.split("@");
    const rate = Number.parseInt(rateStr ?? "20", 10) || 20;
    return { kind: "turbo", target: target || "left", rate };
  }
  if (s.startsWith("macro:")) {
    const rest = s.slice(6);
    const [idStr, modeStr] = rest.split("@");
    const id = Number.parseInt(idStr ?? "1", 10) || 1;
    if (!modeStr) return { kind: "macro", id, mode: "once", count: 1 };
    if (modeStr === "hold") return { kind: "macro", id, mode: "hold", count: 1 };
    if (modeStr === "toggle") return { kind: "macro", id, mode: "toggle", count: 1 };
    return { kind: "macro", id, mode: "times", count: Number.parseInt(modeStr, 10) || 1 };
  }
  if (s.startsWith("media:")) {
    return { kind: "media", value: s.slice(6) };
  }
  if (s.startsWith("key:")) {
    return { kind: "key", combo: s.slice(4) };
  }
  if (
    [
      "left",
      "right",
      "middle",
      "double-click",
      "back",
      "forward",
      "scroll-up",
      "scroll-down",
      "scroll-left",
      "scroll-right",
    ].includes(s)
  ) {
    return { kind: "mouse", value: s };
  }
  return { kind: "unknown", raw: s };
}

function formatKeyCombo(combo: string, compact = false): string {
  const parts = combo.split("+").filter(Boolean);
  const nice = parts.map((p) => {
    const lower = p.toLowerCase();
    const map: Record<string, string> = {
      ctrl: "Ctrl",
      rctrl: "R-Ctrl",
      shift: "Shift",
      rshift: "R-Shift",
      alt: "Alt",
      ralt: "R-Alt",
      win: "Win",
      rwin: "R-Win",
      minus: "-",
      equal: "=",
      lbracket: "[",
      rbracket: "]",
      backslash: "\\",
      semicolon: ";",
      quote: "'",
      comma: ",",
      period: ".",
      slash: "/",
      space: "Space",
      esc: "Esc",
      enter: "Enter",
      tab: "Tab",
      backspace: "Backspace",
      delete: "Del",
      insert: "Ins",
      home: "Home",
      end: "End",
      pageup: "PgUp",
      pagedown: "PgDn",
      up: "↑",
      down: "↓",
      left: "←",
      right: "→",
      capslock: "CapsLock",
      printscreen: "PrtSc",
      scrolllock: "ScrLk",
      pause: "Pause",
      menu: "Menu",
      grave: "`",
      "num-enter": "Num Enter",
      "num-plus": "Num +",
      "num-minus": "Num -",
      "num-star": "Num *",
      "num-slash": "Num /",
      "num-period": "Num .",
      numlock: "NumLock",
    };
    if (map[lower]) return map[lower];
    if (/^num[0-9]$/.test(lower)) return `Num ${lower.slice(3)}`;
    if (/^f([1-9]|1[0-9]|2[0-4])$/.test(lower)) return lower.toUpperCase();
    return lower.length === 1 ? lower.toUpperCase() : (lower[0] ?? "").toUpperCase() + lower.slice(1);
  });
  if (compact && nice.length >= 4) {
    const shortMods = nice.slice(0, -1).map((m) =>
      m === "Ctrl" ? "C" : m === "Shift" ? "S" : m === "Alt" ? "A" : m === "Win" ? "W" : m,
    );
    return [...shortMods, nice[nice.length - 1] ?? ""].join("+");
  }
  return nice.join(" + ");
}

export function formatMouseAction(value: string, locale: Locale): string {
  const ar: Record<string, string> = {
    left: "نقر أيسر",
    right: "نقر أيمن",
    middle: "نقر أوسط",
    "double-click": "نقر مزدوج",
    back: "رجوع",
    forward: "تقدم",
    "scroll-up": "تمرير لأعلى",
    "scroll-down": "تمرير لأسفل",
    "scroll-left": "تمرير يسار",
    "scroll-right": "تمرير يمين",
  };
  const en: Record<string, string> = {
    left: "Left click",
    right: "Right click",
    middle: "Middle click",
    "double-click": "Double click",
    back: "Back",
    forward: "Forward",
    "scroll-up": "Scroll up",
    "scroll-down": "Scroll down",
    "scroll-left": "Scroll left",
    "scroll-right": "Scroll right",
  };
  return (locale === "ar" ? ar[value] : en[value]) ?? value;
}

export function formatMediaAction(value: string, locale: Locale): string {
  const ar: Record<string, string> = {
    "volume-up": "رفع الصوت",
    "volume-down": "خفض الصوت",
    mute: "كتم الصوت",
    "play-pause": "تشغيل / إيقاف",
    "next-track": "المقطع التالي",
    "previous-track": "المقطع السابق",
    stop: "إيقاف الوسائط",
  };
  const en: Record<string, string> = {
    "volume-up": "Volume up",
    "volume-down": "Volume down",
    mute: "Mute audio",
    "play-pause": "Play / Pause",
    "next-track": "Next track",
    "previous-track": "Previous track",
    stop: "Stop media",
  };
  return (locale === "ar" ? ar[value] : en[value]) ?? value;
}

export function formatHumanAction(
  raw: string,
  locale: Locale,
  macros: readonly { id: number; name: string }[] = [],
  compact = false,
): string {
  const parsed = parseAction(raw);
  switch (parsed.kind) {
    case "disabled":
      return locale === "ar" ? "معطّل" : "Disabled";
    case "hypershift":
      return locale === "ar" ? (compact ? "طبقة ثانية" : "مفتاح الطبقة الإضافية") : compact ? "2nd Layer" : "Secondary Layer";
    case "profile": {
      if (parsed.value.startsWith("profile:")) {
        const slot = parsed.value.slice(8);
        return locale === "ar"
          ? compact
            ? `ذاكرة ${slot}`
            : `بروفايل الذاكرة ${slot}`
          : compact
            ? `Slot ${slot}`
            : `Onboard profile ${slot}`;
      }
      const ar: Record<string, string> = {
        "profile-up": "البروفايل التالي",
        "profile-down": "البروفايل السابق",
        "profile-cycle-up": "تدوير البروفايل للأعلى",
        "profile-cycle-down": "تدوير البروفايل للأسفل",
      };
      const en: Record<string, string> = {
        "profile-up": "Next profile",
        "profile-down": "Previous profile",
        "profile-cycle-up": "Cycle profile up",
        "profile-cycle-down": "Cycle profile down",
      };
      return (locale === "ar" ? ar[parsed.value] : en[parsed.value]) ?? parsed.value;
    }
    case "scroll-mode":
      return locale === "ar"
        ? compact
          ? "وضع العجلة"
          : "تبديل وضع العجلة"
        : compact
          ? "Wheel mode"
          : "Toggle wheel mode";
    case "dpi": {
      const ar: Record<string, string> = {
        "dpi-up": "رفع السرعة",
        "dpi-down": "خفض السرعة",
        "dpi-cycle-up": "تبديل السرعة للأعلى",
        "dpi-cycle-down": "تبديل السرعة للأسفل",
      };
      const en: Record<string, string> = {
        "dpi-up": "Speed up",
        "dpi-down": "Speed down",
        "dpi-cycle-up": "Cycle speed up",
        "dpi-cycle-down": "Cycle speed down",
      };
      return (locale === "ar" ? ar[parsed.value] : en[parsed.value]) ?? parsed.value;
    }
    case "dpi-clutch":
      return locale === "ar"
        ? compact
          ? `دقة ${parsed.dpi}`
          : `قنص مؤقت (${parsed.dpi})`
        : compact
          ? `Clutch ${parsed.dpi}`
          : `Precision clutch (${parsed.dpi})`;
    case "mouse":
      return formatMouseAction(parsed.value, locale);
    case "media":
      return formatMediaAction(parsed.value, locale);
    case "key":
      return formatKeyCombo(parsed.combo, compact);
    case "turbo": {
      const inner = formatHumanAction(parsed.target, locale, macros, true);
      return locale === "ar"
        ? compact
          ? `تكرار ${parsed.rate}/ث`
          : `نقر سريع: ${inner} (${parsed.rate}/ث)`
        : compact
          ? `Repeat ${parsed.rate}/s`
          : `Rapid repeat: ${inner} (${parsed.rate}/s)`;
    }
    case "macro": {
      const found = macros.find((m) => m.id === parsed.id);
      const title = found ? found.name : locale === "ar" ? `ماكرو ${parsed.id}` : `Macro ${parsed.id}`;
      if (parsed.mode === "once") return title;
      if (parsed.mode === "hold") return locale === "ar" ? `${title} (عند الضغط)` : `${title} (hold)`;
      if (parsed.mode === "toggle") return locale === "ar" ? `${title} (تبديل)` : `${title} (toggle)`;
      return locale === "ar" ? `${title} (×${parsed.count})` : `${title} (x${parsed.count})`;
    }
    case "unknown":
      return locale === "ar" ? "أمر مخصص" : "Custom action";
  }
}

export function formatLinkedAppsCount(count: number, locale: Locale): string {
  if (count <= 0) return locale === "ar" ? "عام بدون ربط" : "Global";
  if (count === 1) return locale === "ar" ? "برنامج واحد" : "1 app";
  if (count === 2) return locale === "ar" ? "برنامجان" : "2 apps";
  if (count <= 10) return locale === "ar" ? `${count} برامج` : `${count} apps`;
  return locale === "ar" ? `${count} برنامجاً` : `${count} apps`;
}

export function formatMinutesLabel(minutes: number, locale: Locale): string {
  if (locale === "en") return `${minutes} min`;
  if (minutes === 1) return "دقيقة واحدة";
  if (minutes >= 3 && minutes <= 10) return `${minutes} دقائق`;
  return `${minutes} دقيقة`;
}

export function formatLatencyMs(hz: number, locale: Locale): string {
  const safeHz = Math.max(1, hz);
  const ms = 1000 / safeHz;
  const formatted = ms >= 1 ? `${Math.round(ms * 10) / 10}` : `${Math.round(ms * 1000) / 1000}`;
  return locale === "ar" ? `${safeHz} · ${formatted} مللي` : `${safeHz} · ${formatted}ms`;
}

export function computeErgonomicStops(min: number, max: number, step: number): number[] {
  const safeMin = Math.max(50, min);
  const safeMax = Math.max(safeMin + step, max);
  const count = 7;
  const stops: number[] = [];
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const raw = safeMin * Math.pow(safeMax / safeMin, t);
    const snapped = safeMin + Math.round((raw - safeMin) / step) * step;
    const clamped = Math.min(safeMax, Math.max(safeMin, snapped));
    if (stops[stops.length - 1] !== clamped) stops.push(clamped);
  }
  if (stops[0] !== safeMin) stops[0] = safeMin;
  if (stops[stops.length - 1] !== safeMax) stops[stops.length - 1] = safeMax;
  return stops;
}

export function computeSleepChoices(maxMinutes: number | null): number[] {
  if (!maxMinutes || maxMinutes < 1) return [];
  const targets = [0.06, 0.2, 0.35, 0.65, 1.0];
  const out: number[] = [];
  for (const frac of targets) {
    const val = Math.min(maxMinutes, Math.max(1, Math.round(maxMinutes * frac)));
    if (!out.includes(val)) out.push(val);
  }
  return out;
}

export function formatFriendlyAppName(exe: string): string {
  const clean = exe.trim().replace(/^.*[/\\]/, "");
  const stem = clean.replace(/\.exe$/i, "").trim();
  const words = stem
    .split(/[-_.]+/)
    .filter(Boolean)
    .map((w) => (w[0] ?? "").toUpperCase() + w.slice(1));
  return words.join(" ") || clean || exe;
}

export function formatResetOptionLabel(vocab: Vocab, defaultText?: string): string {
  return defaultText ? `${vocab.resetOption} (${defaultText})` : vocab.resetOption;
}

export const BUTTON_LABELS: Record<Locale, Record<string, string>> = {
  ar: {
    left: "الزر الأيسر",
    right: "الزر الأيمن",
    wheel: "ضغط العجلة",
    "scroll-up": "تمرير للأعلى",
    "scroll-down": "تمرير للأسفل",
    "tilt-left": "إمالة يسار",
    "tilt-right": "إمالة يمين",
    "dpi-up": "رفع السرعة",
    "dpi-down": "خفض السرعة",
    "side-back": "زر جانبي خلفي",
    "side-forward": "زر جانبي أمامي",
    dpi: "زر السرعة",
    "dpi-2": "زر السرعة الثاني",
    profile: "زر البروفايل",
    sniper: "زر القنص",
    hypershift: "مفتاح الطبقة",
    "side-extra": "الزر الجانبي الإضافي",
    "grid-1": "زر الإبهام 1",
    "grid-2": "زر الإبهام 2",
    "grid-3": "زر الإبهام 3",
    "grid-4": "زر الإبهام 4",
    "grid-5": "زر الإبهام 5",
    "grid-6": "زر الإبهام 6",
    "grid-7": "زر الإبهام 7",
    "grid-8": "زر الإبهام 8",
    "grid-9": "زر الإبهام 9",
    "grid-10": "زر الإبهام 10",
    "grid-11": "زر الإبهام 11",
    "grid-12": "زر الإبهام 12",
  },
  en: {
    left: "Left click",
    right: "Right click",
    wheel: "Wheel click",
    "scroll-up": "Scroll up",
    "scroll-down": "Scroll down",
    "tilt-left": "Wheel tilt left",
    "tilt-right": "Wheel tilt right",
    "dpi-up": "Speed up button",
    "dpi-down": "Speed down button",
    "side-back": "Side back",
    "side-forward": "Side forward",
    dpi: "Speed button",
    "dpi-2": "Second speed button",
    profile: "Profile button",
    sniper: "Clutch button",
    hypershift: "Layer key",
    "side-extra": "Extra side button",
    "grid-1": "Thumb 1",
    "grid-2": "Thumb 2",
    "grid-3": "Thumb 3",
    "grid-4": "Thumb 4",
    "grid-5": "Thumb 5",
    "grid-6": "Thumb 6",
    "grid-7": "Thumb 7",
    "grid-8": "Thumb 8",
    "grid-9": "Thumb 9",
    "grid-10": "Thumb 10",
    "grid-11": "Thumb 11",
    "grid-12": "Thumb 12",
  },
};

export interface HelpTipCopy {
  title: string;
  body: string;
}

export interface ScreenGuideCopy {
  title: string;
  summary: string;
  steps: readonly string[];
  saveNote: string;
}

export interface Vocab {
  appName: string;
  navButtons: string;
  navButtonsShort: string;
  navPerformance: string;
  navPerformanceShort: string;
  navMotion: string;
  navMotionShort: string;
  navProfiles: string;
  navProfilesShort: string;
  navMacros: string;
  navLighting: string;
  navSettings: string;
  navSettingsShort: string;
  connected: string;
  disconnected: string;
  battery: string;
  speedUnit: string;
  pollingUnit: string;
  layerPrimary: string;
  layerSecondary: string;
  layerSecondaryHeldBy: string;
  viewSide: string;
  viewTop: string;
  viewBoth: string;
  defaultActionLabel: string;
  topBodyLabel: string;
  sideBodyLabel: string;
  thumbKeypadCount: string;
  modifiedBadge: string;
  protectedTitle: string;
  protectedBody: string;
  saveToMouse: string;
  savedOnboardOk: string;
  onboardPendingChanges: string;
  restoreMouseOriginal: string;
  resetButton: string;
  restoreAllButtons: string;
  undo: string;
  redo: string;
  quickCommands: string;
  searchPlaceholder: string;
  categories: {
    keys: string;
    windows: string;
    mouse: string;
    turbo: string;
    speed: string;
    media: string;
    macros: string;
    disabled: string;
  };
  keyCaptureHint: string;
  pressAnyKey: string;
  recordingKey: string;
  recordingCancelHint: string;
  quickPresetsLabel: string;
  modifiersLabel: string;
  cancel: string;
  turboTargetLabel: string;
  turboCaptureKey: string;
  turboRateLabel: string;
  perSecond: string;
  applyTurbo: string;
  clutchLabel: string;
  applyClutch: string;
  profileActionsLabel: string;
  onboardSlotsLabel: string;
  speedStagesTitle: string;
  addStage: string;
  removeStage: string;
  activeSpeedLabel: string;
  independentAxes: string;
  axisX: string;
  axisY: string;
  axisBoth: string;
  pollingTitle: string;
  pollingQuiet: string;
  pollingBalanced: string;
  pollingFast: string;
  powerSleepTitle: string;
  sleepAfterLabel: string;
  autoSleepLabel: string;
  scrollWheelTitle: string;
  scrollModeLabel: string;
  scrollTactile: string;
  scrollFreeSpin: string;
  scrollPrecision: string;
  scrollAccelLabel: string;
  smartReelLabel: string;
  smartReelLevelLabel: string;
  scrollOffLabel: string;
  scrollLowLabel: string;
  scrollMediumLabel: string;
  scrollHighLabel: string;
  profilesTitle: string;
  newProfile: string;
  profileNamePlaceholder: string;
  create: string;
  duplicateProfile: string;
  renameProfile: string;
  deleteProfile: string;
  exportProfiles: string;
  importProfiles: string;
  autoSwitchAppsTitle: string;
  openAppsHint: string;
  customAppPlaceholder: string;
  addApp: string;
  assignedAppsLabel: string;
  noAppsAssigned: string;
  macrosTitle: string;
  macroCreateTitle: string;
  macroNamePlaceholder: string;
  macroRecordStart: string;
  macroRecordStop: string;
  macroAddDelay: string;
  macroSave: string;
  macroMemoryLabel: string;
  macroEmpty: string;
  lightingTitle: string;
  lightingControlLabel: string;
  brightnessLabel: string;
  syncAllDevices: string;
  settingsBehaviorTitle: string;
  autostartLabel: string;
  autostartHint: string;
  closeBehaviorLabel: string;
  closeBehaviorHint: string;
  closeToTrayOption: string;
  closeQuitOption: string;
  popupsLabel: string;
  popupsHint: string;
  autoSwitchLabel: string;
  autoSwitchHint: string;
  lowBatteryAlertLabel: string;
  lowBatteryLevelLabel: string;
  settingsAppearanceTitle: string;
  themeLabel: string;
  themeSystem: string;
  themeDark: string;
  themeLight: string;
  accentColorLabel: string;
  languageLabel: string;
  windowMinimize: string;
  windowMaximize: string;
  windowRestore: string;
  windowClose: string;
  deviceSupportTitle: string;
  deviceModelLabel: string;
  firmwareVersionLabel: string;
  checkUpdates: string;
  firmwareUpToDate: string;
  firmwareAvailable: string;
  firmwareNoneListed: string;
  synapseConflictTitle: string;
  synapseNoConflict: string;
  openDataFolder: string;
  copySupportReport: string;
  reportCopied: string;
  noDevicesTitle: string;
  noDevicesBody: string;
  rescan: string;
  loadingTitle: string;
  loadingBody: string;
  confirmRestoreAllTitle: string;
  confirmRestoreFactoryTitle: string;
  confirmYes: string;
  toastSavedOnboard: string;
  toastRestoredAll: string;
  toastRestoredFactory: string;
  toastImportedProfiles: string;
  toastRawAccelApplied: string;
  motionDesktopTitle: string;
  motionDesktopHint: string;
  motionEnableLabel: string;
  motionActiveBadge: string;
  motionPausedGameBadge: string;
  motionOffBadge: string;
  motionPresetLight: string;
  motionPresetBalanced: string;
  motionPresetSilk: string;
  motionStrengthLabel: string;
  motionRespLabel: string;
  motionMicroLabel: string;
  motionRotationLabel: string;
  motionResetRotation: string;
  motionBypassGamesLabel: string;
  motionBypassGamesHint: string;
  motionCurveRawLegend: string;
  motionCurveSmoothLegend: string;
  motionGamingTitle: string;
  motionGamingReadyBadge: string;
  motionGamingInstalledBadge: string;
  motionGamingMissingBadge: string;
  motionPollingBoostTitle: string;
  motionPollingBoostAction: string;
  motionRawAccelEnableLabel: string;
  motionRawAccelModeLabel: string;
  motionModeFlat: string;
  motionModeNatural: string;
  motionModeSync: string;
  motionRawAccelSmoothLabel: string;
  motionRawAccelSensLabel: string;
  motionRawAccelApply: string;
  motionRawAccelApplying: string;
  motionRawAccelApplyDirty: string;
  motionRawAccelPendingBadge: string;
  motionRawAccelSetupHint: string;
  motionRawAccelDownload: string;
  motionRawAccelRefresh: string;
  screenGuideTrigger: string;
  toastAutoSaved: string;
  toastAppliedToMouse: string;
  toastButtonSaved: string;
  toastButtonReset: string;
  toastProfileUpdated: string;
  resetDefaults: string;
  confirmReset: string;
  confirmDelete: string;
  confirmRestore: string;
  discardChanges: string;
  retry: string;
  dismiss: string;
  sliderResetHint: string;
  noSearchResults: string;
  shortcutsTitle: string;
  shortcutsSummary: string;
  appVersionLabel: string;
  resetOption: string;
  toastResetDefaults: string;
  toastDiscardedChanges: string;
  toastExportedFile: string;
  toastInvalidImport: string;
  importFromFile: string;
  exportToFile: string;
  guides: Record<"buttons" | "performance" | "motion" | "profiles" | "macros" | "lighting" | "settings", ScreenGuideCopy>;
  help: {
    buttonsLayer: HelpTipCopy;
    buttonsSaveOnboard: HelpTipCopy;
    perfStages: HelpTipCopy;
    perfAxes: HelpTipCopy;
    perfPolling: HelpTipCopy;
    perfSleep: HelpTipCopy;
    perfScroll: HelpTipCopy;
    motionDesktop: HelpTipCopy;
    motionStrength: HelpTipCopy;
    motionResp: HelpTipCopy;
    motionMicro: HelpTipCopy;
    motionRotation: HelpTipCopy;
    motionBypass: HelpTipCopy;
    motionGaming: HelpTipCopy;
    motionRawMode: HelpTipCopy;
    motionRawSmooth: HelpTipCopy;
    motionRawSens: HelpTipCopy;
    profilesList: HelpTipCopy;
    profilesAutoSwitch: HelpTipCopy;
    macrosSection: HelpTipCopy;
    lightingSection: HelpTipCopy;
    settingsBehavior: HelpTipCopy;
    settingsAppearance: HelpTipCopy;
  };
}

export const VOCAB: Record<Locale, Vocab> = {
  ar: {
    appName: "Grip",
    navButtons: "تخصيص الأزرار",
    navButtonsShort: "أزرار",
    navPerformance: "السرعة والطاقة",
    navPerformanceShort: "سرعة",
    navMotion: "التنعيم والدقة",
    navMotionShort: "تنعيم",
    navProfiles: "البروفايلات والألعاب",
    navProfilesShort: "ملفات",
    navMacros: "الماكرو",
    navLighting: "الإضاءة",
    navSettings: "الإعدادات",
    navSettingsShort: "ضبط",
    connected: "متصل",
    disconnected: "غير متصل",
    battery: "البطارية",
    speedUnit: "DPI",
    pollingUnit: "Hz",
    layerPrimary: "الوضع الأساسي",
    layerSecondary: "الوضع الإضافي",
    layerSecondaryHeldBy: "يتفعّل بالضغط المطوّل على",
    viewSide: "الجانب",
    viewTop: "الأعلى",
    viewBoth: "كلا المنظورين",
    defaultActionLabel: "افتراضي",
    topBodyLabel: "الأزرار العلوية والعجلة",
    sideBodyLabel: "الأزرار الجانبية للإبهام",
    thumbKeypadCount: "12 زر",
    modifiedBadge: "معدّل",
    protectedTitle: "محمي",
    protectedBody: "النقر الأيسر محمي دائماً حتى لا تفقد التحكم بالماوس. عيّن النقر الأيسر لزر آخر أولاً إذا أردت تغييره.",
    saveToMouse: "حفظ في ذاكرة الماوس",
    savedOnboardOk: "محفوظ داخل ذاكرة الماوس",
    onboardPendingChanges: "تعديلات جديدة غير محفوظة بالماوس بعد",
    restoreMouseOriginal: "استرجاع إعداد المصنع للذاكرة",
    resetButton: "إرجاع هذا الزر",
    restoreAllButtons: "استرجاع كل الأزرار",
    undo: "تراجع",
    redo: "إعادة",
    quickCommands: "بحث سريع",
    searchPlaceholder: "ابحث عن قسم، زر، مرحلة سرعة، أو بروفايل...",
    categories: {
      keys: "اختصار",
      windows: "ويندوز",
      mouse: "الماوس",
      turbo: "نقر سريع",
      speed: "السرعة",
      media: "صوت",
      macros: "ماكرو",
      disabled: "تعطيل",
    },
    keyCaptureHint: "اضغط المربع بالأسفل ثم اضغط أي مفتاح أو اختصار:",
    pressAnyKey: "اضغط لتسجيل مفتاح",
    recordingKey: "اضغط المفتاح الآن...",
    recordingCancelHint: "اضغط أي مفتاح الآن — أو اضغط هنا للإلغاء",
    quickPresetsLabel: "اختصارات سريعة",
    modifiersLabel: "مفاتيح التعديل المفردة",
    cancel: "إلغاء",
    turboTargetLabel: "الزر أو المفتاح المتكرر",
    turboCaptureKey: "تسجيل أي مفتاح من اللوحة",
    turboRateLabel: "السرعة (ضغطة في الثانية)",
    perSecond: "/ث",
    applyTurbo: "تعيين التكرار السريع",
    clutchLabel: "تثبيت مؤقت للدقة عند الضغط",
    applyClutch: "تعيين سرعة القنص",
    profileActionsLabel: "تبديل البروفايلات والذاكرة",
    onboardSlotsLabel: "التبديل المباشر لذاكرة الماوس",
    speedStagesTitle: "مراحل السرعة",
    addStage: "إضافة مرحلة",
    removeStage: "حذف المرحلة",
    activeSpeedLabel: "السرعة الفعّالة",
    independentAxes: "فصل المحور الأفقي عن العمودي",
    axisX: "أفقي",
    axisY: "عمودي",
    axisBoth: "السرعة",
    pollingTitle: "معدل الاستجابة",
    pollingQuiet: "توفير طاقة",
    pollingBalanced: "متوازن",
    pollingFast: "استجابة فائقة",
    powerSleepTitle: "الطاقة وسكون الماوس",
    sleepAfterLabel: "إيقاف الإضاءة والحساس بعد خمول",
    autoSleepLabel: "تفعيل السكون التلقائي للبطارية",
    scrollWheelTitle: "إعدادات عجلة التمرير",
    scrollModeLabel: "وضع دوران العجلة",
    scrollTactile: "درجات ملموسة",
    scrollFreeSpin: "حركة حرة",
    scrollPrecision: "تدرّج دقيق",
    scrollAccelLabel: "تسريع التمرير الحر",
    smartReelLabel: "تحويل تلقائي للحر عند الدفع السريع",
    smartReelLevelLabel: "حساسية التحويل التلقائي للحر",
    scrollOffLabel: "إيقاف",
    scrollLowLabel: "خفيف",
    scrollMediumLabel: "متوسط",
    scrollHighLabel: "عالي",
    profilesTitle: "البروفايلات",
    newProfile: "بروفايل جديد",
    profileNamePlaceholder: "اسم البروفايل (مثلاً: ألعاب)",
    create: "إنشاء",
    duplicateProfile: "نسخ",
    renameProfile: "تغيير الاسم",
    deleteProfile: "حذف",
    exportProfiles: "تصدير نسخة احتياطية",
    importProfiles: "استيراد نسخة",
    autoSwitchAppsTitle: "تشغيل تلقائي مع البرامج والألعاب",
    openAppsHint: "اختر من البرامج المفتوحة الآن ليشتغل هذا البروفايل تلقائياً معها:",
    customAppPlaceholder: "اسم برنامج آخر (مثلاً: Valorant)",
    addApp: "ربط",
    assignedAppsLabel: "البرامج المرتبطة بهذا البروفايل",
    noAppsAssigned: "لا توجد برامج مرتبطة بعد — اختر من القائمة أو اكتب اسم البرنامج.",
    macrosTitle: "الماكرو المتسلسل",
    macroCreateTitle: "تسجيل ماكرو جديد",
    macroNamePlaceholder: "اسم الماكرو",
    macroRecordStart: "ابدأ التسجيل",
    macroRecordStop: "إيقاف التسجيل",
    macroAddDelay: "إضافة انتظار 50 مللي ثانية",
    macroSave: "حفظ الماكرو بالماوس",
    macroMemoryLabel: "المساحة المتبقية",
    macroEmpty: "لا توجد اختصارات ماكرو مسجلة بعد.",
    lightingTitle: "الإضاءة والألوان",
    lightingControlLabel: "السماح للبرنامج بالتحكم بالإضاءة",
    brightnessLabel: "السطوع",
    syncAllDevices: "توحيد اللون على كل الأجهزة",
    settingsBehaviorTitle: "التشغيل والتنبيهات",
    autostartLabel: "تشغيل تلقائي مع الويندوز",
    autostartHint: "يفتح بالخلفية بأيقونة الساعة بأقل استهلاك للذاكرة",
    closeBehaviorLabel: "عند إغلاق النافذة",
    closeBehaviorHint: "اختر هل يبقى Grip بجانب الساعة أو يغلق بالكامل",
    closeToTrayOption: "إخفاء للساعة",
    closeQuitOption: "خروج كامل",
    popupsLabel: "إشعار خفيف على زاوية الشاشة عند تبديل السرعة أو البروفايل",
    popupsHint: "يظهر لثانية فوق الساعة بدون ما يقاطع اللعب",
    autoSwitchLabel: "التبديل التلقائي للبروفايل حسب البرنامج المفتوح",
    autoSwitchHint: "يبدّل إعدادات الماوس فوراً عند الانتقال للعبة أو المتصفح",
    lowBatteryAlertLabel: "تنبيه انخفاض البطارية",
    lowBatteryLevelLabel: "ينبهك إذا وصلت أقل من",
    settingsAppearanceTitle: "المظهر واللغة",
    themeLabel: "المظهر",
    themeSystem: "تلقائي",
    themeDark: "داكن",
    themeLight: "فاتح",
    accentColorLabel: "لون التمييز",
    languageLabel: "اللغة",
    windowMinimize: "تصغير",
    windowMaximize: "تكبير",
    windowRestore: "استعادة الحجم",
    windowClose: "إغلاق",
    deviceSupportTitle: "معلومات الجهاز والدعم",
    deviceModelLabel: "الجهاز",
    firmwareVersionLabel: "إصدار البرنامج الداخلي",
    checkUpdates: "فحص التحديثات",
    firmwareUpToDate: "جهازك محدّث لآخر إصدار",
    firmwareAvailable: "يتوفر تحديث رسمي أحدث",
    firmwareNoneListed: "لا يوجد تحديث منشور لهذا الموديل حالياً",
    synapseConflictTitle: "فحص تعارض البرامج الأخرى",
    synapseNoConflict: "الوضع سليم — لا توجد برامج متعارضة بالخلفية",
    openDataFolder: "فتح مجلد المحفوظات",
    copySupportReport: "نسخ تقرير الدعم",
    reportCopied: "تم النسخ للحافظة",
    noDevicesTitle: "لم يتم العثور على الماوس",
    noDevicesBody: "تأكد من توصيل قطعة الاستقبال اللاسلكي أو الكابل ثم اضغط إعادة الفحص.",
    rescan: "إعادة الفحص",
    loadingTitle: "جاري تشغيل Grip...",
    loadingBody: "نقرأ الآن إعدادات الماوس والبروفايلات المحفوظة.",
    confirmRestoreAllTitle: "هل تريد استرجاع جميع الأزرار للوضع الافتراضي؟",
    confirmRestoreFactoryTitle: "هل تريد استرجاع إعداد المصنع لذاكرة الماوس؟",
    confirmYes: "تأكيد الاسترجاع",
    toastSavedOnboard: "تم الحفظ في ذاكرة الماوس بنجاح",
    toastRestoredAll: "تم استرجاع جميع الأزرار للوضع الافتراضي",
    toastRestoredFactory: "تم استرجاع إعداد المصنع للذاكرة",
    toastImportedProfiles: "تم استيراد النسخة الاحتياطية بنجاح",
    toastRawAccelApplied: "تم تطبيق إعدادات الدقة والتنعيم للألعاب بنجاح",
    motionDesktopTitle: "تنعيم حركة المكتب والتصميم",
    motionDesktopHint: "ينعّم الحركات البطيئة ويبقي الحركات السريعة فورية بدون ثقل",
    motionEnableLabel: "تفعيل التنعيم الذكي",
    motionActiveBadge: "فعّال",
    motionPausedGameBadge: "متوقف مؤقتاً داخل اللعبة",
    motionOffBadge: "مغلق",
    motionPresetLight: "خفيف",
    motionPresetBalanced: "متوازن",
    motionPresetSilk: "فائق النعومة",
    motionStrengthLabel: "قوة التنعيم",
    motionRespLabel: "استجابة الحركة السريعة",
    motionMicroLabel: "تثبيت الدقة البطيئة",
    motionRotationLabel: "ميلان مسكة اليد",
    motionResetRotation: "تصفير",
    motionBypassGamesLabel: "إيقاف تلقائي داخل الألعاب (حماية وأداء)",
    motionBypassGamesHint: "يتوقف التنعيم فوراً عند فتح أوفرواتش أو أي لعبة بملء الشاشة",
    motionCurveRawLegend: "الحركة الخام",
    motionCurveSmoothLegend: "بعد التنعيم الذكي",
    motionGamingTitle: "دقة ونعومة الألعاب",
    motionGamingReadyBadge: "جاهز وفعّال",
    motionGamingInstalledBadge: "مثبّت — بانتظار التفعيل",
    motionGamingMissingBadge: "غير مثبّت بعد",
    motionPollingBoostTitle: "استجابة الماوس الحالية أقل من الحد الأقصى لنعومة 240Hz",
    motionPollingBoostAction: "رفع الاستجابة إلى",
    motionRawAccelEnableLabel: "تفعيل محرك Raw Accel للألعاب",
    motionRawAccelModeLabel: "نوع الاستجابة",
    motionModeFlat: "ثابت",
    motionModeNatural: "طبيعي",
    motionModeSync: "متزامن",
    motionRawAccelSmoothLabel: "تنعيم الإخراج",
    motionRawAccelSensLabel: "مضاعف الحساسية",
    motionRawAccelApply: "تطبيق على الألعاب",
    motionRawAccelApplying: "جاري التطبيق...",
    motionRawAccelApplyDirty: "تطبيق التعديلات على الألعاب",
    motionRawAccelPendingBadge: "تعديلات بانتظار التطبيق",
    motionRawAccelSetupHint: "لنعومة فائقة داخل الألعاب التنافسية بدون تأخير وبشكل مقبول مع أنظمة الحماية، ثبّت أداة Raw Accel الرسمية ثم اضغط فحص.",
    motionRawAccelDownload: "تحميل Raw Accel الرسمي",
    motionRawAccelRefresh: "فحص بعد التثبيت",
    screenGuideTrigger: "شرح هذه الشاشة (F1)",
    toastAutoSaved: "تم الحفظ تلقائياً",
    toastAppliedToMouse: "تم التطبيق على الماوس",
    toastButtonSaved: "تم حفظ وظيفة الزر",
    toastButtonReset: "تمت إعادة الزر للافتراضي",
    toastProfileUpdated: "تم تحديث البروفايل",
    resetDefaults: "إعادة للافتراضي",
    confirmReset: "تأكيد الإعادة؟",
    confirmDelete: "حذف؟",
    confirmRestore: "تأكيد الاسترجاع؟",
    discardChanges: "تراجع",
    retry: "إعادة المحاولة",
    dismiss: "إغلاق",
    sliderResetHint: "انقر مرتين للإرجاع للافتراضي",
    noSearchResults: "لا توجد نتائج مطابقة",
    shortcutsTitle: "اختصارات الكيبورد",
    shortcutsSummary: "Ctrl+K بحث · Ctrl+Z تراجع · Ctrl+Y إعادة · F1 شرح",
    appVersionLabel: "إصدار التطبيق",
    resetOption: "إرجاع للافتراضي",
    toastResetDefaults: "تمت الإعادة للوضع الافتراضي",
    toastDiscardedChanges: "تم التراجع عن التعديلات غير المطبّقة",
    toastExportedFile: "تم حفظ ملف النسخة الاحتياطية",
    toastInvalidImport: "ملف النسخة غير صالح",
    importFromFile: "استيراد ملف",
    exportToFile: "حفظ ملف",
    guides: {
      buttons: {
        title: "تخصيص الأزرار",
        summary: "بدّل وظيفة أي زر بالماوس أو أضف اختصاراً جديداً للوضع الأساسي أو الإضافي.",
        steps: [
          "اضغط أي زر على رسمة الماوس أو من الشبكة بالأسفل لاختياره.",
          "اختر نوع الوظيفة من اليسار (اختصار لوحة، أمر ويندوز، نقر سريع، سرعة، أو تعطيل).",
          "بعد الانتهاء اضغط حفظ في ذاكرة الماوس حتى تبقى التعديلات حتى بدون تشغيل التطبيق.",
        ],
        saveNote: "تعيين الزر يتطبق فوراً على البروفايل، وزر الحفظ يثبته في ذاكرة الماوس الداخلية.",
      },
      performance: {
        title: "السرعة والطاقة",
        summary: "تحكم بمراحل حساسية المؤشر (DPI) وسرعة الاستجابة وسكون البطارية.",
        steps: [
          "اضغط أي عمود من مراحل السرعة لاختياره وتفعيل سرعته مباشرة.",
          "اسحب شريط السرعة أو اكتب الرقم لضبط الحساسية، وفعل فصل المحورين عند الحاجة.",
          "اختر معدل الاستجابة المناسب (Hz) ووقت السكون لتوازن الأداء وعمر البطارية.",
        ],
        saveNote: "كل تغيير هنا ينحفظ ويتطبق مباشرة على الماوس خلال أجزاء من الثانية.",
      },
      motion: {
        title: "التنعيم والدقة",
        summary: "نعومة فائقة للماوس على سطح المكتب وتنعيم مخصص للألعاب بدون تأخير.",
        steps: [
          "العمود الأيمن/الأول للنظام: اختر خفيف أو متوازن أو فائق النعومة، أو وزنه بالشرائط.",
          "خيار الإيقاف التلقائي يوقف تنعيم المكتب فور دخولك أوفرواتش أو أي لعبة بملء الشاشة.",
          "عمود الألعاب يضبط Raw Accel: عدّل النعومة أو المنحنى ثم اضغط تطبيق ليُفعّل بالتعريف.",
        ],
        saveNote: "شرائط تنعيم المكتب تنحفظ وتشتغل فوراً، أما عمود الألعاب فيتفعّل عند الضغط على تطبيق.",
      },
      profiles: {
        title: "البروفايلات والألعاب",
        summary: "أنشئ أوضاعاً مختلفة لألعابك وبرامجك واربطها لتتبدّل تلقائياً.",
        steps: [
          "اختر البروفايل من القائمة أو أنشئ واحداً جديداً وسمّه باسم لعبتك.",
          "من قسم البرامج المرتبطة اضغط على أي برنامج مفتوح أو أضف اسمه ليشتغل البروفايل معه تلقائياً.",
          "استخدم تصدير/استيراد لأخذ نسخة احتياطية لكل بروفايلاتك بأي وقت.",
        ],
        saveNote: "التبديل والربط والإنشاء تنحفظ تلقائياً في ملف البروفايلات فور تعديلها.",
      },
      macros: {
        title: "الماكرو المتسلسل",
        summary: "سجّل سلسلة مفاتيح وتوقيتات واضغط زراً واحداً لتنفيذها تلقائياً.",
        steps: [
          "اكتب اسماً واضحاً للماكرو ثم اضغط ابدأ التسجيل واضغط المفاتيح بالترتيب.",
          "أضف فواصل 50 مللي ثانية بين الضغطات عند الحاجة، واضغط أي خطوة لحذفها.",
          "اضغط حفظ الماكرو بالماوس ثم اربطه بأي زر من تبويب الأزرار.",
        ],
        saveNote: "الماكرو يُحفظ في ذاكرة الماوس عند الضغط على زر الحفظ فقط.",
      },
      lighting: {
        title: "الإضاءة والألوان",
        summary: "اختر تأثير الإضاءة ولون التمييز ومستوى السطوع لكل منطقة بالماوس.",
        steps: [
          "فعّل التحكم بالإضاءة من أعلى البطاقة لفتح التخصيص.",
          "اختر التأثير (طيف، تنفّس، أو موجة) ثم اللون المناسب.",
          "اضبط شريط السطوع أو اضغط توحيد اللون لتطبيقه على جميع الأجهزة.",
        ],
        saveNote: "كل تغيير باللون أو السطوع يتطبق مباشرة على إضاءة الماوس.",
      },
      settings: {
        title: "الإعدادات",
        summary: "ضبط تشغيل التطبيق مع النظام، التنبيهات، المظهر، اللغة، ومعلومات الجهاز.",
        steps: [
          "فعّل التشغيل التلقائي مع الويندوز والبقاء بالساعة لتتفعّل بروفايلاتك والتنعيم دائماً.",
          "اختر المظهر التلقائي أو الداكن أو الفاتح، ولون التمييز ولغة الواجهة.",
          "افتح قسم معلومات الجهاز والدعم للتحقق من التحديثات أو فتح مجلد المحفوظات.",
        ],
        saveNote: "جميع خيارات الإعدادات والمظهر تنحفظ وتُفعّل فوراً دون الحاجة لزر حفظ.",
      },
    },
    help: {
      buttonsLayer: {
        title: "الوضع الأساسي والإضافي",
        body: "الوضع الأساسي يعمل بالضغط العادي. الوضع الإضافي يمنح كل زر وظيفة ثانية عند الضغط المطوّل على زر الطبقة.",
      },
      buttonsSaveOnboard: {
        title: "الحفظ في ذاكرة الماوس",
        body: "التعديلات تتطبق الآن عبر البرنامج، والضغط على هذا الزر يكتبها داخل الماوس لتعمل على أي جهاز آخر حتى بدون Grip.",
      },
      perfStages: {
        title: "مراحل السرعة (DPI)",
        body: "الرقم الأعلى يجعل المؤشر أسرع بنفس حركة اليد. 800-1600 ممتاز للدقة و2400-3000 للحركة السريعة أو الشاشات العريضة.",
      },
      perfAxes: {
        title: "فصل المحور الأفقي والعمودي",
        body: "شغّله فقط إذا أردت سرعة حركة اليمين واليسار مختلفة عن سرعة الأعلى والأسفل.",
      },
      perfPolling: {
        title: "معدل الاستجابة (Hz)",
        body: "عدد مرات إرسال حركة الماوس في الثانية. 1000Hz يعطي سلاسة أعلى لشاشات الألعاب، و125-500 يوفّر بطارية أكثر.",
      },
      perfSleep: {
        title: "السكون والبطارية",
        body: "يطفئ الحساس مؤقتاً بعد توقفك عن استخدام الماوس لتطويل عمر البطارية دون تأخير عند تحريكه مجدداً.",
      },
      perfScroll: {
        title: "أوضاع عجلة التمرير",
        body: "تتيح التبديل بين الدرجات المتقطعة الدقيقة والحركة الحرة السريعة للصفحات الطويلة.",
      },
      motionDesktop: {
        title: "تنعيم المكتب التكيفي",
        body: "يمتص اهتزاز اليد البسيط عند التصويب الدقيق أو الضغط على الأيقونات الصغيرة ويبقي الحركات السريعة حرة بدون ثقل.",
      },
      motionStrength: {
        title: "قوة التنعيم",
        body: "رفعه ينعّم الاهتزازات البطيئة أكثر؛ خفضه يعطي إحساساً أقرب للحركة الخام المباشرة.",
      },
      motionResp: {
        title: "استجابة الحركة السريعة",
        body: "رفعه يقلل أي تأخير عند تحريك الماوس بسرعة بين طرفي الشاشة؛ خفضه يهدّئ الحركة السريعة أكثر.",
      },
      motionMicro: {
        title: "تثبيت الدقة البطيئة",
        body: "يقلل الحركات المجهرية تحت 350 بكسل في الثانية لتسهيل التحديد الدقيق في القوائم والتصميم.",
      },
      motionRotation: {
        title: "ميلان مسكة اليد",
        body: "يعوّض ميلان معصمك الطبيعي حتى تطلع الحركة الأفقية مستقيمة. اتركه 0 إذا مسكتك مستقيمة.",
      },
      motionBypass: {
        title: "الإيقاف التلقائي بالألعاب",
        body: "يوقف تنعيم المكتب تلقائياً بمجرد تشغيل لعبة أو نافذة بملء الشاشة لحماية الأيم والتوافق التام مع أنظمة مكافحة الغش.",
      },
      motionGaming: {
        title: "محرك Raw Accel للألعاب",
        body: "يعمل على مستوى تعريف الويندوز بزمن شبه معدوم ومناسب للألعاب التنافسية، ويحتاج الضغط على زر التطبيق لتفعيله.",
      },
      motionRawMode: {
        title: "نوع المنحنى بالألعاب",
        body: "ثابت: سرعة متساوية تماماً بدون تسريع. طبيعي ومتزامن: دقة أعلى بالحركة البطيئة وتسارع ناعم بالالتفاف السريع.",
      },
      motionRawSmooth: {
        title: "تنعيم إخراج الألعاب",
        body: "قيمة 0.0 خام تماماً وفورية لألعاب التصويب (أدق وأسرع أيم). رفعها يضيف تأخيراً لتنعيم الإخراج وقد يثقل الحركة السريعة.",
      },
      motionRawSens: {
        title: "مضاعف الحساسية",
        body: "1.00x يحافظ على سرعتك الأصلية 100%. أقل يبطئ الحساسية الكاملة وأعلى يسرّعها.",
      },
      profilesList: {
        title: "قائمة البروفايلات",
        body: "كل بروفايل يحفظ أزراره ومراحل سرعته ومعدل استجابته بشكل مستقل. لا يمكن حذف البروفايل المفعّل حالياً.",
      },
      profilesAutoSwitch: {
        title: "التبديل التلقائي مع البرامج",
        body: "عند ربط لعبة أو برنامج بهذا البروفايل، يتحوّل الماوس إليه فور الانتقال لتلك النافذة ويعود لوضعك الافتراضي عند الخروج.",
      },
      macrosSection: {
        title: "الماكرو المتسلسل",
        body: "يسجّل ضغطات لوحة المفاتيح مع توقيت الانتظار بينها. اضغط أي خطوة لحذفها قبل الحفظ بالماوس.",
      },
      lightingSection: {
        title: "التحكم بإضاءة الماوس",
        body: "اضبط اللون والتأثير والسطوع مباشرة على الماوس؛ تقليل السطوع يطيل عمر البطارية اللاسلكية.",
      },
      settingsBehavior: {
        title: "سلوك التشغيل والنظام",
        body: "يحدّد بقاء التطبيق بالخلفية عند الساعة لتشغيل التنعيم والتبديل التلقائي مع ألعابك في كل تشغيل للويندوز.",
      },
      settingsAppearance: {
        title: "المظهر ولون التمييز",
        body: "يتبع مظهر الويندوز تلقائياً أو يثبّت الداكن/الفاتح مع تغيير لون الأزرار الفعّالة ولغة كل الشاشات.",
      },
    },
  },
  en: {
    appName: "Grip",
    navButtons: "Buttons",
    navButtonsShort: "Buttons",
    navPerformance: "Speed & Power",
    navPerformanceShort: "Speed",
    navMotion: "Motion & Precision",
    navMotionShort: "Motion",
    navProfiles: "Profiles & Apps",
    navProfilesShort: "Profiles",
    navMacros: "Macros",
    navLighting: "Lighting",
    navSettings: "Settings",
    navSettingsShort: "Settings",
    connected: "Connected",
    disconnected: "Disconnected",
    battery: "Battery",
    speedUnit: "DPI",
    pollingUnit: "Hz",
    layerPrimary: "Primary layer",
    layerSecondary: "Secondary layer",
    layerSecondaryHeldBy: "Activated while holding",
    viewSide: "Side",
    viewTop: "Top",
    viewBoth: "Dual view",
    defaultActionLabel: "Default",
    topBodyLabel: "Top buttons & scroll wheel",
    sideBodyLabel: "Side thumb keypad",
    thumbKeypadCount: "12 keys",
    modifiedBadge: "Modified",
    protectedTitle: "Protected",
    protectedBody: "Primary left click stays protected so you never lose mouse control. Assign left click to another button first to change it.",
    saveToMouse: "Save to mouse",
    savedOnboardOk: "Saved in mouse memory",
    onboardPendingChanges: "Unsaved changes relative to mouse memory",
    restoreMouseOriginal: "Restore factory memory",
    resetButton: "Reset this button",
    restoreAllButtons: "Restore all buttons",
    undo: "Undo",
    redo: "Redo",
    quickCommands: "Quick search",
    searchPlaceholder: "Search views, buttons, speed stages, or profiles...",
    categories: {
      keys: "Shortcut",
      windows: "Windows",
      mouse: "Mouse",
      turbo: "Rapid fire",
      speed: "Speed",
      media: "Media",
      macros: "Macros",
      disabled: "Disable",
    },
    keyCaptureHint: "Click below and press any key, Numpad key, or combo:",
    pressAnyKey: "Click to record key",
    recordingKey: "Press any key now...",
    recordingCancelHint: "Press any key now — or click here to cancel",
    quickPresetsLabel: "Quick presets",
    modifiersLabel: "Standalone modifiers",
    cancel: "Cancel",
    turboTargetLabel: "Repeated action",
    turboCaptureKey: "Record any keyboard key",
    turboRateLabel: "Repeat speed (presses per second)",
    perSecond: "/s",
    applyTurbo: "Apply rapid repeat",
    clutchLabel: "Hold-to-aim precision speed",
    applyClutch: "Apply precision speed",
    profileActionsLabel: "Profiles & memory slots",
    onboardSlotsLabel: "Onboard memory slots",
    speedStagesTitle: "Speed stages",
    addStage: "Add stage",
    removeStage: "Remove stage",
    activeSpeedLabel: "Active speed",
    independentAxes: "Separate horizontal & vertical speed",
    axisX: "Horizontal",
    axisY: "Vertical",
    axisBoth: "Speed",
    pollingTitle: "Response rate",
    pollingQuiet: "Battery saver",
    pollingBalanced: "Balanced",
    pollingFast: "Ultra responsive",
    powerSleepTitle: "Wireless battery & sleep",
    sleepAfterLabel: "Sleep after idle",
    autoSleepLabel: "Automatic battery sleep",
    scrollWheelTitle: "Scroll wheel",
    scrollModeLabel: "Wheel feel",
    scrollTactile: "Tactile",
    scrollFreeSpin: "Free spin",
    scrollPrecision: "Precision",
    scrollAccelLabel: "Free-spin acceleration",
    smartReelLabel: "Auto switch to free spin on fast flick",
    smartReelLevelLabel: "Auto-switch flick sensitivity",
    scrollOffLabel: "Off",
    scrollLowLabel: "Low",
    scrollMediumLabel: "Medium",
    scrollHighLabel: "High",
    profilesTitle: "Profiles",
    newProfile: "New profile",
    profileNamePlaceholder: "Profile name (e.g. Gaming)",
    create: "Create",
    duplicateProfile: "Duplicate",
    renameProfile: "Rename",
    deleteProfile: "Delete",
    exportProfiles: "Export backup",
    importProfiles: "Import backup",
    autoSwitchAppsTitle: "Auto-switch with games & apps",
    openAppsHint: "Pick any open app so this profile activates automatically:",
    customAppPlaceholder: "App name (e.g. Valorant)",
    addApp: "Link",
    assignedAppsLabel: "Linked apps",
    noAppsAssigned: "No apps linked yet — choose an open app above.",
    macrosTitle: "Sequences & Macros",
    macroCreateTitle: "Record new macro",
    macroNamePlaceholder: "Macro name",
    macroRecordStart: "Start recording",
    macroRecordStop: "Stop recording",
    macroAddDelay: "Add 50 ms pause",
    macroSave: "Save macro",
    macroMemoryLabel: "Memory left",
    macroEmpty: "No saved macros yet.",
    lightingTitle: "Lighting",
    lightingControlLabel: "Allow Grip to control lighting",
    brightnessLabel: "Brightness",
    syncAllDevices: "Match all devices",
    settingsBehaviorTitle: "Startup & alerts",
    autostartLabel: "Start automatically with Windows",
    autostartHint: "Runs quietly in the tray with minimal memory",
    closeBehaviorLabel: "When closing window",
    closeBehaviorHint: "Choose whether Grip stays in the tray or exits completely",
    closeToTrayOption: "Keep in tray",
    closeQuitOption: "Quit app",
    popupsLabel: "Show brief corner popup on speed or profile switch",
    popupsHint: "Fades after 1 second without stealing focus",
    autoSwitchLabel: "Auto-switch profile by active app",
    autoSwitchHint: "Applies matching mouse setup as soon as a game is focused",
    lowBatteryAlertLabel: "Low battery warning",
    lowBatteryLevelLabel: "Warn below",
    settingsAppearanceTitle: "Appearance & language",
    themeLabel: "Theme",
    themeSystem: "Auto",
    themeDark: "Dark",
    themeLight: "Light",
    accentColorLabel: "Accent color",
    languageLabel: "Language",
    windowMinimize: "Minimize",
    windowMaximize: "Maximize",
    windowRestore: "Restore",
    windowClose: "Close",
    deviceSupportTitle: "Device details & support",
    deviceModelLabel: "Device",
    firmwareVersionLabel: "Internal version",
    checkUpdates: "Check for updates",
    firmwareUpToDate: "Your mouse is up to date",
    firmwareAvailable: "Official update available",
    firmwareNoneListed: "No public update listed for this model",
    synapseConflictTitle: "Background conflict check",
    synapseNoConflict: "Clean — no conflicting software running",
    openDataFolder: "Open saved data folder",
    copySupportReport: "Copy support summary",
    reportCopied: "Copied to clipboard",
    noDevicesTitle: "Mouse not detected",
    noDevicesBody: "Check the wireless receiver or cable and scan again.",
    rescan: "Scan again",
    loadingTitle: "Starting Grip...",
    loadingBody: "Reading connected hardware and saved profiles.",
    confirmRestoreAllTitle: "Restore all buttons to defaults?",
    confirmRestoreFactoryTitle: "Restore factory defaults on mouse memory?",
    confirmYes: "Confirm restore",
    toastSavedOnboard: "Saved to mouse memory",
    toastRestoredAll: "All buttons restored to defaults",
    toastRestoredFactory: "Factory memory defaults restored",
    toastImportedProfiles: "Profiles imported successfully",
    toastRawAccelApplied: "Applied Raw Accel gaming tuning successfully",
    motionDesktopTitle: "Desktop Adaptive Smoothing",
    motionDesktopHint: "Smooths slow jitter while keeping quick flicks instant and crisp",
    motionEnableLabel: "Enable adaptive smoothing",
    motionActiveBadge: "Active",
    motionPausedGameBadge: "Auto-paused in game",
    motionOffBadge: "Off",
    motionPresetLight: "Light",
    motionPresetBalanced: "Balanced",
    motionPresetSilk: "Silky",
    motionStrengthLabel: "Smoothing strength",
    motionRespLabel: "Flick responsiveness",
    motionMicroLabel: "Micro-aim stabilization",
    motionRotationLabel: "Grip angle rotation",
    motionResetRotation: "Zero",
    motionBypassGamesLabel: "Auto-bypass inside fullscreen games",
    motionBypassGamesHint: "Suspends hook automatically when launching games for anti-cheat safety",
    motionCurveRawLegend: "Raw stepped input",
    motionCurveSmoothLegend: "Adaptive smoothed",
    motionGamingTitle: "Gaming Precision & Smoothing",
    motionGamingReadyBadge: "Ready",
    motionGamingInstalledBadge: "Installed — inactive",
    motionGamingMissingBadge: "Not installed",
    motionPollingBoostTitle: "Mouse polling is below max smoothness for 240Hz displays",
    motionPollingBoostAction: "Raise polling to",
    motionRawAccelEnableLabel: "Enable Raw Accel driver tuning",
    motionRawAccelModeLabel: "Curve style",
    motionModeFlat: "Flat",
    motionModeNatural: "Natural",
    motionModeSync: "Synchronous",
    motionRawAccelSmoothLabel: "Output smoothing",
    motionRawAccelSensLabel: "Sensitivity scale",
    motionRawAccelApply: "Apply to games",
    motionRawAccelApplying: "Applying...",
    motionRawAccelApplyDirty: "Apply changes to games",
    motionRawAccelPendingBadge: "Unapplied changes",
    motionRawAccelSetupHint: "For sub-0.1ms anti-cheat-safe cursor smoothing inside competitive games, install official Raw Accel then refresh status.",
    motionRawAccelDownload: "Get official Raw Accel",
    motionRawAccelRefresh: "Refresh status",
    screenGuideTrigger: "Screen guide (F1)",
    toastAutoSaved: "Saved automatically",
    toastAppliedToMouse: "Applied to mouse",
    toastButtonSaved: "Button action saved",
    toastButtonReset: "Button reset to default",
    toastProfileUpdated: "Profile updated",
    resetDefaults: "Reset defaults",
    confirmReset: "Confirm reset?",
    confirmDelete: "Delete?",
    confirmRestore: "Confirm restore?",
    discardChanges: "Discard",
    retry: "Retry",
    dismiss: "Dismiss",
    sliderResetHint: "Double-click to reset to default",
    noSearchResults: "No matching results",
    shortcutsTitle: "Keyboard shortcuts",
    shortcutsSummary: "Ctrl+K Search · Ctrl+Z Undo · Ctrl+Y Redo · F1 Guide",
    appVersionLabel: "App version",
    resetOption: "Reset to default",
    toastResetDefaults: "Restored to defaults",
    toastDiscardedChanges: "Discarded unapplied changes",
    toastExportedFile: "Backup file saved",
    toastInvalidImport: "Invalid backup file",
    importFromFile: "Import file",
    exportToFile: "Export file",
    guides: {
      buttons: {
        title: "Buttons",
        summary: "Assign keyboard shortcuts, Windows actions, rapid fire, or layer keys to any mouse input.",
        steps: [
          "Click a button on the mouse blueprint or bottom grid to select it.",
          "Pick an action category on the left (Shortcut, Windows, Mouse, Rapid fire, Speed, Media, or Disable).",
          "Click Save to mouse at the bottom to store edits inside onboard mouse memory.",
        ],
        saveNote: "Button changes update your active profile immediately; Save to mouse writes them into hardware flash.",
      },
      performance: {
        title: "Speed & Power",
        summary: "Configure pointer speed stages (DPI), sensor polling rate, and wireless sleep behavior.",
        steps: [
          "Click any stage column to activate that speed immediately.",
          "Drag the slider or enter an exact number, and toggle X/Y separation if needed.",
          "Pick your polling rate (Hz) and idle sleep timer to balance responsiveness and battery life.",
        ],
        saveNote: "All changes in Speed & Power save and apply directly to the connected mouse.",
      },
      motion: {
        title: "Motion & Precision",
        summary: "Tune adaptive desktop smoothing and driver-level gaming smoothing without sacrificing speed.",
        steps: [
          "Left card tunes desktop smoothing: pick Light, Balanced, or Silky, or adjust sliders.",
          "Keep Auto-bypass enabled so desktop smoothing pauses automatically in fullscreen games.",
          "Right card tunes Raw Accel for games: adjust curve or smoothing, then click Apply to games.",
        ],
        saveNote: "Desktop controls save and take effect live; Gaming Raw Accel updates when you click Apply.",
      },
      profiles: {
        title: "Profiles & Apps",
        summary: "Manage distinct profiles per workflow and link games or apps for automatic switching.",
        steps: [
          "Select a profile on the left or create a new one for each game or workflow.",
          "Click running apps on the right (or type an app name) to link automatic switching.",
          "Use Export or Import to back up or share your full profile library anytime.",
        ],
        saveNote: "Switching, renaming, linking apps, and deleting profiles save automatically.",
      },
      macros: {
        title: "Macros",
        summary: "Record multi-key sequences and delays that play back from any mouse button.",
        steps: [
          "Name your macro, click Start recording, and press keys in sequence.",
          "Insert 50 ms pauses between steps if needed, or click a step chip to remove it.",
          "Click Save macro to write it to mouse memory, then bind it on the Buttons tab.",
        ],
        saveNote: "Macros are written to mouse memory when you click Save macro.",
      },
      lighting: {
        title: "Lighting",
        summary: "Customize LED effects, accent colors, and brightness per mouse lighting zone.",
        steps: [
          "Enable lighting control at the top of the card.",
          "Pick an effect style and color preset for each zone.",
          "Drag the brightness slider or click Match all devices to sync across hardware.",
        ],
        saveNote: "Every color, effect, and brightness adjustment updates hardware lighting live.",
      },
      settings: {
        title: "Settings",
        summary: "Control autostart, tray behavior, notifications, visual theme, language, and hardware diagnostics.",
        steps: [
          "Enable autostart and Keep in tray so auto-switching and motion smoothing always stay ready.",
          "Switch between Auto, Dark, or Light themes, brand accent color, and Arabic or English.",
          "Expand Device details & support to check updates, conflicts, or open your saved folder.",
        ],
        saveNote: "All preferences and theme choices save and apply automatically.",
      },
    },
    help: {
      buttonsLayer: {
        title: "Primary & Secondary layers",
        body: "Primary works on normal clicks. Secondary gives every button a second action while holding your layer key.",
      },
      buttonsSaveOnboard: {
        title: "Save to mouse memory",
        body: "Edits apply via Grip right now; saving to mouse writes them into flash memory so they work even without Grip running.",
      },
      perfStages: {
        title: "Speed stages (DPI)",
        body: "Higher values move the cursor farther per physical inch. 800-1600 suits precision; 2400-3000 suits large ultra-wide screens.",
      },
      perfAxes: {
        title: "Independent X / Y sensitivity",
        body: "Turn this on only if you want horizontal speed to differ from vertical speed.",
      },
      perfPolling: {
        title: "Response rate (Hz)",
        body: "How often the mouse reports motion each second. 1000Hz maximizes smoothness; 125-500Hz extends wireless battery life.",
      },
      perfSleep: {
        title: "Battery & idle sleep",
        body: "Turns off the sensor after idle minutes to conserve battery while waking instantly on movement.",
      },
      perfScroll: {
        title: "Scroll wheel feel",
        body: "Switch between tactile notched steps and free-spinning smooth scroll for long documents.",
      },
      motionDesktop: {
        title: "Desktop adaptive smoothing",
        body: "Filters slow hand micro-jitter on 240Hz displays while keeping fast cross-screen moves crisp and lag-free.",
      },
      motionStrength: {
        title: "Smoothing strength",
        body: "Higher values smooth slow jitter more aggressively; lower values feel closer to raw cursor input.",
      },
      motionResp: {
        title: "Flick responsiveness",
        body: "Higher values snap faster during quick hand moves; lower values add subtle glide to fast motion.",
      },
      motionMicro: {
        title: "Micro-aim stabilization",
        body: "Gently damps tiny movements below 350 px/s to steady precision clicks on small targets.",
      },
      motionRotation: {
        title: "Grip angle rotation",
        body: "Compensates for natural wrist tilt so horizontal swipes track level. Leave at 0 if your grip is straight.",
      },
      motionBypass: {
        title: "Auto-bypass in games",
        body: "Automatically suspends desktop smoothing when linked games or fullscreen windows are active.",
      },
      motionGaming: {
        title: "Raw Accel gaming driver",
        body: "Runs at kernel level with near-zero overhead and anti-cheat compatibility. Click Apply to games after tuning.",
      },
      motionRawMode: {
        title: "Curve mode",
        body: "Flat keeps a constant 1:1 speed. Natural and Synchronous combine low-speed precision with smooth fast flick gain.",
      },
      motionRawSmooth: {
        title: "Output smoothing",
        body: "0.0 ms gives crisp, instant raw 1:1 aim for FPS games. Higher values add smoothing delay and can make quick flicks feel floaty.",
      },
      motionRawSens: {
        title: "Sensitivity scale",
        body: "1.00x keeps your native DPI speed unchanged. Lower slows down; higher speeds up.",
      },
      profilesList: {
        title: "Profile library",
        body: "Each profile stores independent buttons, speed stages, and polling rate. The currently active profile cannot be deleted.",
      },
      profilesAutoSwitch: {
        title: "App auto-switching",
        body: "Linked apps activate this profile the instant their window gains focus and switch back when you leave.",
      },
      macrosSection: {
        title: "Keyboard macros",
        body: "Captures key taps and delays played from a single mouse button. Click any chip to remove a step before saving.",
      },
      lightingSection: {
        title: "Hardware lighting",
        body: "Updates mouse LEDs live; lowering brightness extends wireless battery runtime.",
      },
      settingsBehavior: {
        title: "Background & tray behavior",
        body: "Controls autostart and tray persistence so auto-switching and motion smoothing stay ready after reboot.",
      },
      settingsAppearance: {
        title: "Theme & language",
        body: "Follows Windows dark/light automatically or locks a theme, accent color, and full UI language.",
      },
    },
  },
};
