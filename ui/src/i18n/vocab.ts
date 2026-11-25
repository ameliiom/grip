export type Locale = "ar" | "en";

export type ParsedAction =
  | { kind: "disabled" }
  | { kind: "mouse"; value: string }
  | { kind: "dpi"; value: string }
  | { kind: "dpi-clutch"; dpi: number }
  | { kind: "hypershift" }
  | { kind: "profile-cycle"; dir: "up" | "down" }
  | { kind: "media"; value: string }
  | { kind: "key"; combo: string }
  | { kind: "turbo"; target: string; rate: number }
  | { kind: "macro"; id: number; mode: "once" | "times" | "hold" | "toggle"; count: number }
  | { kind: "unknown"; raw: string };

export function parseAction(raw: string): ParsedAction {
  const s = (raw || "").trim();
  if (!s || s === "disabled") return { kind: "disabled" };
  if (s === "hypershift") return { kind: "hypershift" };
  if (s === "profile-cycle-up") return { kind: "profile-cycle", dir: "up" };
  if (s === "profile-cycle-down") return { kind: "profile-cycle", dir: "down" };
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
      shift: "Shift",
      alt: "Alt",
      win: "Win",
      minus: "-",
      equal: "=",
      space: "Space",
      esc: "Esc",
      enter: "Enter",
      tab: "Tab",
      backspace: "Backspace",
      delete: "Del",
      grave: "`",
    };
    if (map[lower]) return map[lower];
    return lower.length === 1 ? lower.toUpperCase() : (lower[0] ?? "").toUpperCase() + lower.slice(1);
  });
  if (compact && nice.length >= 4) {
    const mods = nice.slice(0, -1).map((m) => m[0]);
    return `${mods.join("+")}+${nice[nice.length - 1]}`;
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
  };
  const en: Record<string, string> = {
    "volume-up": "Volume up",
    "volume-down": "Volume down",
    mute: "Mute audio",
    "play-pause": "Play / Pause",
    "next-track": "Next track",
    "previous-track": "Previous track",
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
    case "profile-cycle":
      return locale === "ar"
        ? parsed.dir === "up"
          ? "البروفايل التالي"
          : "البروفايل السابق"
        : parsed.dir === "up"
          ? "Next profile"
          : "Previous profile";
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

export function formatMinutesLabel(minutes: number, locale: Locale): string {
  if (locale === "en") return `${minutes} min`;
  if (minutes === 1) return "دقيقة واحدة";
  if (minutes >= 3 && minutes <= 10) return `${minutes} دقائق`;
  return `${minutes} دقيقة`;
}

export function formatFriendlyAppName(exe: string): string {
  const clean = exe.trim().replace(/^.*[/\\]/, "");
  const stem = clean.replace(/\.exe$/i, "");
  const known: Record<string, string> = {
    cs2: "Counter-Strike 2",
    "valorant-win64-shipping": "Valorant",
    valorant: "Valorant",
    chrome: "Google Chrome",
    msedge: "Microsoft Edge",
    zen: "Zen Browser",
    firefox: "Firefox",
    discord: "Discord",
    code: "VS Code",
    spotify: "Spotify",
    obs64: "OBS Studio",
  };
  return known[stem.toLowerCase()] ?? (stem || exe);
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

export interface Vocab {
  appName: string;
  navButtons: string;
  navButtonsShort: string;
  navPerformance: string;
  navPerformanceShort: string;
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
  cancel: string;
  turboTargetLabel: string;
  turboRateLabel: string;
  perSecond: string;
  applyTurbo: string;
  clutchLabel: string;
  applyClutch: string;
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
  profilesTitle: string;
  newProfile: string;
  profileNamePlaceholder: string;
  create: string;
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
  popupsLabel: string;
  popupsHint: string;
  autoSwitchLabel: string;
  autoSwitchHint: string;
  lowBatteryAlertLabel: string;
  lowBatteryLevelLabel: string;
  settingsAppearanceTitle: string;
  themeLabel: string;
  themeDark: string;
  themeLight: string;
  accentColorLabel: string;
  languageLabel: string;
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
}

export const VOCAB: Record<Locale, Vocab> = {
  ar: {
    appName: "Grip",
    navButtons: "تخصيص الأزرار",
    navButtonsShort: "أزرار",
    navPerformance: "السرعة والطاقة",
    navPerformanceShort: "سرعة",
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
    viewSide: "الجانب (12 زر)",
    viewTop: "الأعلى",
    viewBoth: "كلا المنظورين",
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
      mouse: "الماوس",
      turbo: "نقر سريع",
      speed: "السرعة",
      media: "صوت",
      macros: "ماكرو",
      disabled: "تعطيل",
    },
    keyCaptureHint: "اضغط مربع الالتقاط ثم اضغط أي مفتاح أو اختصار:",
    pressAnyKey: "اضغط لتسجيل مفتاح",
    recordingKey: "اضغط المفتاح الآن...",
    cancel: "إلغاء",
    turboTargetLabel: "الزر المتكرر",
    turboRateLabel: "السرعة (ضغطة في الثانية)",
    perSecond: "/ث",
    applyTurbo: "تعيين التكرار السريع",
    clutchLabel: "تثبيت مؤقت للدقة عند الضغط",
    applyClutch: "تعيين سرعة القنص",
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
    scrollAccelLabel: "تسريع التمرير",
    smartReelLabel: "تحويل تلقائي للحر عند الدفع السريع",
    profilesTitle: "البروفايلات",
    newProfile: "بروفايل جديد",
    profileNamePlaceholder: "اسم البروفايل (مثلاً: ألعاب)",
    create: "إنشاء",
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
    popupsLabel: "إشعار خفيف على زاوية الشاشة عند تبديل السرعة أو البروفايل",
    popupsHint: "يظهر لثانية فوق الساعة بدون ما يقاطع اللعب",
    autoSwitchLabel: "التبديل التلقائي للبروفايل حسب البرنامج المفتوح",
    autoSwitchHint: "يبدّل إعدادات الماوس فوراً عند الانتقال للعبة أو المتصفح",
    lowBatteryAlertLabel: "تنبيه انخفاض البطارية",
    lowBatteryLevelLabel: "ينبهك إذا وصلت أقل من",
    settingsAppearanceTitle: "المظهر واللغة",
    themeLabel: "المظهر",
    themeDark: "داكن",
    themeLight: "فاتح",
    accentColorLabel: "لون التمييز",
    languageLabel: "اللغة",
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
  },
  en: {
    appName: "Grip",
    navButtons: "Buttons",
    navButtonsShort: "Buttons",
    navPerformance: "Speed & Power",
    navPerformanceShort: "Speed",
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
    viewSide: "Side (12)",
    viewTop: "Top",
    viewBoth: "Dual view",
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
      mouse: "Mouse",
      turbo: "Rapid fire",
      speed: "Speed",
      media: "Media",
      macros: "Macros",
      disabled: "Disable",
    },
    keyCaptureHint: "Click the capture box and press any key or shortcut:",
    pressAnyKey: "Click to record key",
    recordingKey: "Press any key now...",
    cancel: "Cancel",
    turboTargetLabel: "Repeated action",
    turboRateLabel: "Repeat speed (presses per second)",
    perSecond: "/s",
    applyTurbo: "Apply rapid repeat",
    clutchLabel: "Hold-to-aim precision speed",
    applyClutch: "Apply precision speed",
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
    scrollAccelLabel: "Scroll acceleration",
    smartReelLabel: "Auto switch to free spin on fast flick",
    profilesTitle: "Profiles",
    newProfile: "New profile",
    profileNamePlaceholder: "Profile name (e.g. Gaming)",
    create: "Create",
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
    popupsLabel: "Show brief corner popup on speed or profile switch",
    popupsHint: "Fades after 1 second without stealing focus",
    autoSwitchLabel: "Auto-switch profile by active app",
    autoSwitchHint: "Applies matching mouse setup as soon as a game is focused",
    lowBatteryAlertLabel: "Low battery warning",
    lowBatteryLevelLabel: "Warn below",
    settingsAppearanceTitle: "Appearance & language",
    themeLabel: "Theme",
    themeDark: "Dark",
    themeLight: "Light",
    accentColorLabel: "Accent color",
    languageLabel: "Language",
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
  },
};
