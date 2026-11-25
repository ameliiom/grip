export type Locale = "ar" | "en";

export interface Vocab {
  appName: string;
  connected: string;
  disconnected: string;
  battery: string;
  pollingRate: string;
  dpiStages: string;
  activeDpi: string;
  sleepTimer: string;
  minutes: string;
  layerNormal: string;
  layerHyperShift: string;
  topViewTitle: string;
  sideViewTitle: string;
  thumbMatrixTitle: string;
  inspectorTitle: string;
  leftClickProtected: string;
  protectedBadge: string;
  saveToMouse: string;
  savedOnboard: string;
  resetButton: string;
  restoreAll: string;
  undo: string;
  redo: string;
  commandPalette: string;
  searchPlaceholder: string;
  newProfile: string;
  profileNamePlaceholder: string;
  create: string;
  cancel: string;
  profiles: string;
  appBindings: string;
  appExePlaceholder: string;
  themeLight: string;
  themeDark: string;
  brandColor: string;
  firmwareLabel: string;
  serialLabel: string;
  modeSimulated: string;
  modeLive: string;
  categories: {
    keys: string;
    mouse: string;
    media: string;
    dpi: string;
    macros: string;
    disabled: string;
  };
  keyCaptureHint: string;
  pressAnyKey: string;
  recordingKey: string;
  clear: string;
  noDevicesTitle: string;
  noDevicesBody: string;
  rescan: string;
  macroCreateTitle: string;
  macroNamePlaceholder: string;
  macroStepsPlaceholder: string;
  macroSave: string;
  macroEmpty: string;
  disabledLabel: string;
}

export const VOCAB: Record<Locale, Vocab> = {
  ar: {
    appName: "Grip",
    connected: "متصل",
    disconnected: "غير متصل",
    battery: "البطارية",
    pollingRate: "معدل الاستجابة",
    dpiStages: "مراحل السرعة (DPI)",
    activeDpi: "السرعة الحالية",
    sleepTimer: "سكون الماوس",
    minutes: "دقيقة",
    layerNormal: "العادي",
    layerHyperShift: "HyperShift",
    topViewTitle: "الأزرار العلوية والعجلة",
    sideViewTitle: "شبكة الإبهام الجانبية (12 زر)",
    thumbMatrixTitle: "مفاتيح الإبهام (4×3)",
    inspectorTitle: "تخصيص الزر",
    leftClickProtected: "زر النقر الأيسر محمي دائماً حتى لا تفقد التحكم بالماوس.",
    protectedBadge: "محمي",
    saveToMouse: "حفظ داخل الماوس",
    savedOnboard: "تم الحفظ في ذاكرة الماوس",
    resetButton: "استعادة الافتراضي",
    restoreAll: "استعادة كل الأزرار",
    undo: "تراجع",
    redo: "إعادة",
    commandPalette: "الأوامر",
    searchPlaceholder: "ابحث عن أمر أو زر أو سرعة...",
    newProfile: "بروفايل جديد",
    profileNamePlaceholder: "اسم البروفايل (مثلاً: ألعاب)",
    create: "إنشاء",
    cancel: "إلغاء",
    profiles: "البروفايل",
    appBindings: "تطبيقات التبديل التلقائي",
    appExePlaceholder: "اسم البرنامج (مثلاً: cs2.exe)",
    themeLight: "فاتح",
    themeDark: "داكن",
    brandColor: "لون الواجهة",
    firmwareLabel: "التحديث",
    serialLabel: "الرقم التسلسلي",
    modeSimulated: "محاكاة",
    modeLive: "مباشر",
    categories: {
      keys: "مفاتيح",
      mouse: "ماوس",
      media: "وسائط",
      dpi: "DPI",
      macros: "ماكرو",
      disabled: "تعطيل",
    },
    keyCaptureHint: "اضغط مربع الالتقاط ثم اضغط أي مفتاح أو اختصار على الكيبورد:",
    pressAnyKey: "اضغط لتسجيل مفتاح",
    recordingKey: "بانتظار ضغطة الكيبورد...",
    clear: "مسح",
    noDevicesTitle: "لم يتم العثور على جهاز ريزر",
    noDevicesBody: "تأكد من توصيل مستقبل الماوس أو الكابل واضغط إعادة الفحص.",
    rescan: "إعادة الفحص",
    macroCreateTitle: "ماكرو جديد داخل الماوس",
    macroNamePlaceholder: "اسم الماكرو (مثلاً: نسخ سريع)",
    macroStepsPlaceholder: "الخطوات (مثلاً: tap:ctrl+c wait:30)",
    macroSave: "حفظ الماكرو",
    macroEmpty: "لا توجد وحدات ماكرو محفوظة بعد.",
    disabledLabel: "معطّل",
  },
  en: {
    appName: "Grip",
    connected: "Connected",
    disconnected: "Disconnected",
    battery: "Battery",
    pollingRate: "Polling rate",
    dpiStages: "DPI stages",
    activeDpi: "Active DPI",
    sleepTimer: "Sleep timer",
    minutes: "min",
    layerNormal: "Normal",
    layerHyperShift: "HyperShift",
    topViewTitle: "Top buttons & wheel",
    sideViewTitle: "Side thumb grid (1-12)",
    thumbMatrixTitle: "Thumb matrix (4x3)",
    inspectorTitle: "Button action",
    leftClickProtected: "Primary left click stays protected so you never lose mouse control.",
    protectedBadge: "Locked",
    saveToMouse: "Save to mouse",
    savedOnboard: "Saved to onboard memory",
    resetButton: "Reset button",
    restoreAll: "Restore all",
    undo: "Undo",
    redo: "Redo",
    commandPalette: "Commands",
    searchPlaceholder: "Search commands, buttons, or DPI...",
    newProfile: "New profile",
    profileNamePlaceholder: "Profile name (e.g. Gaming)",
    create: "Create",
    cancel: "Cancel",
    profiles: "Profile",
    appBindings: "Auto-switch apps",
    appExePlaceholder: "Program executable (e.g. cs2.exe)",
    themeLight: "Light",
    themeDark: "Dark",
    brandColor: "Accent color",
    firmwareLabel: "Firmware",
    serialLabel: "Serial",
    modeSimulated: "Simulated",
    modeLive: "Live",
    categories: {
      keys: "Keyboard",
      mouse: "Mouse",
      media: "Media",
      dpi: "DPI & Layers",
      macros: "Macros",
      disabled: "Disable",
    },
    keyCaptureHint: "Click the capture box then press any key or shortcut:",
    pressAnyKey: "Click to record key",
    recordingKey: "Press key or combo...",
    clear: "Clear",
    noDevicesTitle: "No Razer device found",
    noDevicesBody: "Connect the mouse receiver or cable and scan again.",
    rescan: "Rescan",
    macroCreateTitle: "New onboard macro",
    macroNamePlaceholder: "Macro name (e.g. Quick Copy)",
    macroStepsPlaceholder: "Steps (e.g. tap:ctrl+c wait:30)",
    macroSave: "Save macro",
    macroEmpty: "No onboard macros stored yet.",
    disabledLabel: "Disabled",
  },
};

export const BUTTON_LABELS: Record<Locale, Record<string, string>> = {
  ar: {
    left: "النقر الأيسر",
    right: "النقر الأيمن",
    wheel: "ضغط العجلة",
    "tilt-left": "إمالة العجلة يسار",
    "tilt-right": "إمالة العجلة يمين",
    "scroll-up": "تمرير لأعلى",
    "scroll-down": "تمرير لأسفل",
    "dpi-up": "رفع السرعة",
    "dpi-down": "خفض السرعة",
    "grid-1": "زر جانبي 1",
    "grid-2": "زر جانبي 2",
    "grid-3": "زر جانبي 3",
    "grid-4": "زر جانبي 4",
    "grid-5": "زر جانبي 5",
    "grid-6": "زر جانبي 6",
    "grid-7": "زر جانبي 7",
    "grid-8": "زر جانبي 8",
    "grid-9": "زر جانبي 9",
    "grid-10": "زر جانبي 10",
    "grid-11": "زر جانبي 11",
    "grid-12": "زر جانبي 12",
  },
  en: {
    left: "Left click",
    right: "Right click",
    wheel: "Wheel click",
    "tilt-left": "Wheel tilt left",
    "tilt-right": "Wheel tilt right",
    "scroll-up": "Scroll up",
    "scroll-down": "Scroll down",
    "dpi-up": "DPI up",
    "dpi-down": "DPI down",
    "grid-1": "Side 1",
    "grid-2": "Side 2",
    "grid-3": "Side 3",
    "grid-4": "Side 4",
    "grid-5": "Side 5",
    "grid-6": "Side 6",
    "grid-7": "Side 7",
    "grid-8": "Side 8",
    "grid-9": "Side 9",
    "grid-10": "Side 10",
    "grid-11": "Side 11",
    "grid-12": "Side 12",
  },
};

export function formatMinutesLabel(minutes: number, locale: Locale): string {
  if (locale === "en") return `${minutes} min`;
  if (minutes >= 3 && minutes <= 10) return `${minutes} دقائق`;
  return `${minutes} دقيقة`;
}

export function formatActionLabel(action: string, locale: Locale): string {
  if (!action) return "—";
  if (action === "disabled") return locale === "ar" ? "معطّل" : "Disabled";
  if (action === "left") return locale === "ar" ? "أيسر" : "Left";
  if (action === "right") return locale === "ar" ? "أيمن" : "Right";
  if (action === "middle") return locale === "ar" ? "وسط" : "Middle";
  if (action === "double-click") return locale === "ar" ? "نقر مزدوج" : "Double click";
  if (action === "back") return locale === "ar" ? "رجوع" : "Back";
  if (action === "forward") return locale === "ar" ? "تقدم" : "Forward";
  if (action === "scroll-up") return locale === "ar" ? "تمرير أعلى" : "Scroll up";
  if (action === "scroll-down") return locale === "ar" ? "تمرير أسفل" : "Scroll down";
  if (action === "dpi-up") return locale === "ar" ? "رفع DPI" : "DPI +";
  if (action === "dpi-down") return locale === "ar" ? "خفض DPI" : "DPI -";
  if (action === "dpi-cycle-up") return locale === "ar" ? "تبديل DPI" : "Cycle DPI";
  if (action === "hypershift") return "HyperShift";
  if (action.startsWith("key:")) {
    return action
      .slice(4)
      .split("+")
      .map((part) => (part.length === 1 ? part.toUpperCase() : part[0]?.toUpperCase() + part.slice(1)))
      .join("+");
  }
  if (action.startsWith("media:")) {
    const k = action.slice(6);
    const mapAr: Record<string, string> = {
      "volume-up": "رفع الصوت",
      "volume-down": "خفض الصوت",
      mute: "كتم الصوت",
      "play-pause": "تشغيل/إيقاف",
      "next-track": "التالي",
      "previous-track": "السابق",
    };
    return locale === "ar" ? (mapAr[k] ?? k) : k;
  }
  if (action.startsWith("macro:")) {
    return (locale === "ar" ? "ماكرو " : "Macro ") + action.slice(6);
  }
  return action;
}
