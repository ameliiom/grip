import {
  Ban,
  Gauge,
  Keyboard,
  Lock,
  Monitor,
  MousePointerClick,
  RotateCcw,
  Sparkles,
  Volume2,
  Zap,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ButtonEntry, LayerName, MacroSummary } from "../../acl/transport";
import {
  Badge,
  Button,
  ChoiceChips,
  OptionReset,
  Slider,
} from "../../design-system/primitives";
import { BUTTON_LABELS, computeErgonomicStops, formatHumanAction, formatResetOptionLabel, parseAction, type Locale, type Vocab } from "../../i18n/vocab";

type ActionCategory = "keys" | "windows" | "mouse" | "turbo" | "speed" | "media" | "macros" | "disabled";

const KEY_PRESETS: readonly string[] = [
  "key:space",
  "key:enter",
  "key:esc",
  "key:tab",
  "key:backspace",
  "key:delete",
];

const STANDALONE_MODIFIERS: readonly { value: string; label: string }[] = [
  { value: "key:ctrl", label: "Ctrl" },
  { value: "key:shift", label: "Shift" },
  { value: "key:alt", label: "Alt" },
  { value: "key:win", label: "Win" },
];

const WINDOWS_PRESETS: readonly { value: string; ar: string; en: string }[] = [
  { value: "key:ctrl+c", ar: "نسخ", en: "Copy" },
  { value: "key:ctrl+v", ar: "لصق", en: "Paste" },
  { value: "key:ctrl+x", ar: "قص", en: "Cut" },
  { value: "key:ctrl+z", ar: "تراجع", en: "Undo" },
  { value: "key:alt+tab", ar: "تبديل النوافذ", en: "Switch apps" },
  { value: "key:win+tab", ar: "عرض المهام", en: "Task view" },
  { value: "key:win+d", ar: "سطح المكتب", en: "Desktop" },
  { value: "key:win+shift+s", ar: "لقطة شاشة", en: "Screenshot" },
  { value: "key:win+l", ar: "قفل الشاشة", en: "Lock PC" },
  { value: "key:ctrl+shift+esc", ar: "إدارة المهام", en: "Task Mgr" },
  { value: "key:alt+f4", ar: "إغلاق نافذة", en: "Close app" },
  { value: "key:win+h", ar: "إملاء صوتي", en: "Voice type" },
];

const MOUSE_PRESETS: readonly string[] = [
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
];

const MEDIA_PRESETS: readonly string[] = [
  "media:mute",
  "media:play-pause",
  "media:stop",
  "media:volume-up",
  "media:volume-down",
  "media:next-track",
  "media:previous-track",
];

const SPEED_CORE_PRESETS: readonly string[] = [
  "dpi-up",
  "dpi-down",
  "dpi-cycle-up",
  "dpi-cycle-down",
  "hypershift",
  "profile-cycle-up",
  "profile-cycle-down",
  "profile-up",
  "profile-down",
];

const ONBOARD_SLOT_PRESETS: readonly string[] = [
  "profile:1",
  "profile:2",
  "profile:3",
  "profile:4",
  "profile:5",
];

const TURBO_MOUSE_TARGETS: readonly string[] = [
  "left",
  "right",
  "middle",
  "back",
  "forward",
  "scroll-up",
  "scroll-down",
  "scroll-left",
  "scroll-right",
];

const CODE_TO_KEY_NAME: Record<string, string> = {
  Space: "space",
  Enter: "enter",
  Escape: "esc",
  Tab: "tab",
  Backspace: "backspace",
  Delete: "delete",
  Insert: "insert",
  Home: "home",
  End: "end",
  PageUp: "pageup",
  PageDown: "pagedown",
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  Minus: "minus",
  Equal: "equal",
  BracketLeft: "lbracket",
  BracketRight: "rbracket",
  Backslash: "backslash",
  IntlBackslash: "iso-backslash",
  Semicolon: "semicolon",
  Quote: "quote",
  Backquote: "grave",
  Comma: "comma",
  Period: "period",
  Slash: "slash",
  CapsLock: "capslock",
  PrintScreen: "printscreen",
  ScrollLock: "scrolllock",
  Pause: "pause",
  ContextMenu: "menu",
  NumLock: "numlock",
  NumpadEnter: "num-enter",
  NumpadAdd: "num-plus",
  NumpadSubtract: "num-minus",
  NumpadMultiply: "num-star",
  NumpadDivide: "num-slash",
  NumpadDecimal: "num-period",
};

const MODIFIER_CODES: Record<string, string> = {
  ControlLeft: "ctrl",
  ControlRight: "rctrl",
  ShiftLeft: "shift",
  ShiftRight: "rshift",
  AltLeft: "alt",
  AltRight: "ralt",
  MetaLeft: "win",
  MetaRight: "rwin",
};

function keyNameFromEvent(ev: KeyboardEvent): string | null {
  const letter = /^Key([A-Z])$/.exec(ev.code);
  if (letter && letter[1]) return letter[1].toLowerCase();

  const digit = /^Digit([0-9])$/.exec(ev.code);
  if (digit && digit[1]) return digit[1];

  const numpad = /^Numpad([0-9])$/.exec(ev.code);
  if (numpad && numpad[1]) return `num${numpad[1]}`;

  const fn = /^F([1-9]|1[0-9]|2[0-4])$/.exec(ev.code);
  if (fn && fn[1]) return `f${fn[1]}`;

  if (CODE_TO_KEY_NAME[ev.code]) return CODE_TO_KEY_NAME[ev.code] ?? null;

  const k = ev.key.toLowerCase();
  if (/^[a-z0-9]$/.test(k)) return k;
  return null;
}

function normalizeCapturedKey(ev: KeyboardEvent): string | null {
  if (MODIFIER_CODES[ev.code]) return null;
  const keyName = keyNameFromEvent(ev);
  if (!keyName) return null;

  const mods: string[] = [];
  if (ev.ctrlKey) mods.push("ctrl");
  if (ev.shiftKey) mods.push("shift");
  if (ev.altKey) mods.push("alt");
  if (ev.metaKey) mods.push("win");
  return "key:" + [...mods, keyName].join("+");
}

function initialCategoryFor(raw: string): ActionCategory {
  const p = parseAction(raw);
  if (p.kind === "disabled") return "disabled";
  if (p.kind === "mouse") return "mouse";
  if (p.kind === "turbo") return "turbo";
  if (
    p.kind === "dpi" ||
    p.kind === "dpi-clutch" ||
    p.kind === "hypershift" ||
    p.kind === "profile" ||
    p.kind === "scroll-mode"
  ) {
    return "speed";
  }
  if (p.kind === "media") return "media";
  if (p.kind === "macro") return "macros";
  if (WINDOWS_PRESETS.some((w) => w.value === raw)) return "windows";
  return "keys";
}

export function ActionInspector({
  entry,
  layer,
  macros,
  hasMacros,
  hasScroll,
  dpiMin,
  dpiMax,
  dpiStep,
  locale,
  vocab,
  onAssign,
  onResetButton,
}: {
  entry: ButtonEntry;
  layer: LayerName;
  macros: readonly MacroSummary[];
  hasMacros: boolean;
  hasScroll: boolean;
  dpiMin: number;
  dpiMax: number;
  dpiStep: number;
  locale: Locale;
  vocab: Vocab;
  onAssign: (action: string) => void;
  onResetButton: () => void;
}) {
  const currentAction = layer === "normal" ? entry.normal : (entry.hypershift ?? entry.normal);
  const modified = layer === "normal" ? entry.remappedNormal : entry.remappedHypershift;
  const isLocked = layer === "normal" && entry.id === "left" && currentAction === "left";
  const buttonName = BUTTON_LABELS[locale][entry.id] ?? entry.id;

  const [category, setCategory] = useState<ActionCategory>(() => initialCategoryFor(currentAction));
  const [recordMode, setRecordMode] = useState<"off" | "keys" | "turbo">("off");
  const soloModifierRef = useRef<string | null>(null);
  const lastSlotRef = useRef(`${entry.id}:${layer}`);

  const parsed = parseAction(currentAction);
  const [turboTarget, setTurboTarget] = useState<string>(parsed.kind === "turbo" ? parsed.target : "left");
  const [turboRate, setTurboRate] = useState<number>(parsed.kind === "turbo" ? parsed.rate : 25);
  const [clutchDpi, setClutchDpi] = useState<number>(parsed.kind === "dpi-clutch" ? parsed.dpi : 400);
  const [macroMode, setMacroMode] = useState<"once" | "hold" | "toggle">(
    parsed.kind === "macro" && (parsed.mode === "hold" || parsed.mode === "toggle") ? parsed.mode : "once",
  );

  useEffect(() => {
    const slotKey = `${entry.id}:${layer}`;
    if (lastSlotRef.current !== slotKey) {
      lastSlotRef.current = slotKey;
      setRecordMode("off");
      soloModifierRef.current = null;
      setCategory(initialCategoryFor(currentAction));
    }
    const p = parseAction(currentAction);
    if (p.kind === "turbo") {
      setTurboTarget(p.target);
      setTurboRate(p.rate);
    }
    if (p.kind === "dpi-clutch") {
      setClutchDpi(p.dpi);
    }
  }, [entry.id, layer, currentAction]);

  useEffect(() => {
    if (recordMode === "off") return;
    const onKeyDown = (ev: KeyboardEvent) => {
      ev.preventDefault();
      ev.stopPropagation();
      const modToken = MODIFIER_CODES[ev.code];
      if (modToken) {
        soloModifierRef.current = modToken;
        return;
      }
      soloModifierRef.current = null;
      const captured = normalizeCapturedKey(ev);
      if (!captured) return;
      if (recordMode === "turbo") {
        setTurboTarget(captured);
        onAssign(`turbo:${captured}@${turboRate}`);
      } else {
        onAssign(captured);
      }
      setRecordMode("off");
    };
    const onKeyUp = (ev: KeyboardEvent) => {
      const modToken = MODIFIER_CODES[ev.code];
      if (!modToken || soloModifierRef.current !== modToken) return;
      ev.preventDefault();
      ev.stopPropagation();
      soloModifierRef.current = null;
      const standalone = `key:${modToken}`;
      if (recordMode === "turbo") {
        setTurboTarget(standalone);
        onAssign(`turbo:${standalone}@${turboRate}`);
      } else {
        onAssign(standalone);
      }
      setRecordMode("off");
    };
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onKeyUp, true);
    };
  }, [recordMode, turboRate, onAssign]);

  const categories = [
    { value: "keys" as const, label: vocab.categories.keys, icon: <Keyboard size={14} strokeWidth={2} /> },
    { value: "windows" as const, label: vocab.categories.windows, icon: <Monitor size={14} strokeWidth={2} /> },
    { value: "mouse" as const, label: vocab.categories.mouse, icon: <MousePointerClick size={14} strokeWidth={2} /> },
    { value: "turbo" as const, label: vocab.categories.turbo, icon: <Zap size={14} strokeWidth={2} /> },
    { value: "speed" as const, label: vocab.categories.speed, icon: <Gauge size={14} strokeWidth={2} /> },
    { value: "media" as const, label: vocab.categories.media, icon: <Volume2 size={14} strokeWidth={2} /> },
    ...(hasMacros
      ? [{ value: "macros" as const, label: vocab.categories.macros, icon: <Sparkles size={14} strokeWidth={2} /> }]
      : []),
    { value: "disabled" as const, label: vocab.categories.disabled, icon: <Ban size={14} strokeWidth={2} /> },
  ];

  const renderPresets = (list: readonly string[]) => (
    <ChoiceChips
      ariaLabel={vocab.categories[category]}
      variant="pills"
      tier="presets"
      value={currentAction}
      onChange={onAssign}
      size="sm"
      columns={3}
      options={list.map((action) => ({
        value: action,
        label: formatHumanAction(action, locale, macros),
      }))}
    />
  );

  const speedPresets = hasScroll ? [...SPEED_CORE_PRESETS, "scroll-mode:1"] : SPEED_CORE_PRESETS;
  const keyTokens = parsed.kind === "key" ? formatHumanAction(currentAction, locale, macros).split(" + ") : null;

  return (
    <div className="flex flex-col justify-between h-full min-h-0 gap-3" data-inspector="true">
      <div className="flex-1 min-h-0 flex flex-col gap-3">
        {/* Single fixed-height header: button name + inline state dot + keycap/action preview (0px vertical shift) */}
        <div className="min-h-[40px] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="text-base font-bold truncate">{buttonName}</h2>
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                modified ? "bg-[var(--brand)] opacity-100" : "bg-[var(--status-neutral)] opacity-0"
              }`}
              title={modified ? vocab.modifiedBadge : undefined}
            />
          </div>

          <div className="shrink-0 flex items-center">
            {isLocked ? (
              <Badge tone="neutral">
                <span className="inline-flex items-center gap-1">
                  <Lock size={13} strokeWidth={2} />
                  <span>{vocab.protectedTitle}</span>
                </span>
              </Badge>
            ) : keyTokens ? (
              <div className="flex items-center gap-1" dir="ltr">
                {keyTokens.map((tok, i) => (
                  <kbd
                    key={`${tok}-${i}`}
                    className="inline-flex items-center justify-center min-w-[26px] h-7 px-2 rounded-[var(--radius-sm)] bg-[var(--surface-2)] border border-[var(--border-strong)] text-xs font-medium text-[var(--fg)]"
                  >
                    {tok}
                  </kbd>
                ))}
              </div>
            ) : (
              <Badge tone="active">{formatHumanAction(currentAction, locale, macros)}</Badge>
            )}
          </div>
        </div>

        {isLocked ? (
          <div
            data-control-tier="stage"
            className="bg-[var(--surface-2)] border border-[var(--border-strong)] rounded-[var(--radius-md)] p-4"
          >
            <p className="text-sm text-[var(--fg-muted)]">{vocab.protectedBody}</p>
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col gap-3">
            {/* Tier 1: Category Switcher inside Recessed Track */}
            <ChoiceChips
              ariaLabel={buttonName}
              variant="tabs"
              tier="tabs"
              value={category}
              columns={3}
              onChange={(next) => {
                setRecordMode("off");
                soloModifierRef.current = null;
                setCategory(next);
              }}
              options={categories}
              size="sm"
            />

            {category === "keys" ? (
              <div className="flex flex-col gap-3">
                {/* Tier 2: Elevated Interactive Capture Stage */}
                <div
                  data-control-tier="stage"
                  className="bg-[var(--surface-2)] border border-[var(--border-strong)] rounded-[var(--radius-md)] p-3 flex flex-col gap-2"
                >
                  <span className="text-xs text-[var(--fg-muted)]">{vocab.keyCaptureHint}</span>
                  <Button
                    variant="secondary"
                    tall={true}
                    dashed={recordMode !== "keys"}
                    fullWidth={true}
                    active={recordMode === "keys"}
                    onClick={() => {
                      soloModifierRef.current = null;
                      setRecordMode((m) => (m === "keys" ? "off" : "keys"));
                    }}
                  >
                    <Keyboard size={17} strokeWidth={2} />
                    <span>{recordMode === "keys" ? vocab.recordingCancelHint : vocab.pressAnyKey}</span>
                  </Button>
                </div>

                {/* Tier 3: Borderless Soft Preset Pills */}
                <div className="pt-2 border-t border-[var(--border)] flex flex-col gap-2">
                  <span className="text-xs font-medium text-[var(--fg-muted)]">{vocab.modifiersLabel}</span>
                  <ChoiceChips
                    ariaLabel={vocab.modifiersLabel}
                    variant="pills"
                    tier="presets"
                    value={currentAction}
                    onChange={onAssign}
                    size="sm"
                    columns={4}
                    options={STANDALONE_MODIFIERS}
                  />
                  <span className="text-xs font-medium text-[var(--fg-muted)]">{vocab.quickPresetsLabel}</span>
                  {renderPresets(KEY_PRESETS)}
                </div>
              </div>
            ) : null}

            {category === "windows" ? (
              <div className="pt-1 flex flex-col gap-2">
                <span className="text-xs font-medium text-[var(--fg-muted)]">{vocab.quickPresetsLabel}</span>
                <ChoiceChips
                  ariaLabel={vocab.categories.windows}
                  variant="pills"
                  tier="presets"
                  value={currentAction}
                  onChange={onAssign}
                  size="sm"
                  columns={3}
                  options={WINDOWS_PRESETS.map((w) => ({
                    value: w.value,
                    label: locale === "ar" ? w.ar : w.en,
                  }))}
                />
              </div>
            ) : null}

            {category === "mouse" ? (
              <div className="pt-1 flex flex-col gap-2">
                <span className="text-xs font-medium text-[var(--fg-muted)]">{vocab.quickPresetsLabel}</span>
                {renderPresets(MOUSE_PRESETS)}
              </div>
            ) : null}

            {category === "turbo" ? (
              <div className="flex flex-col gap-3">
                {/* Tier 2: Turbo Interactive Configuration Well */}
                <div
                  data-control-tier="stage"
                  className="bg-[var(--surface-2)] border border-[var(--border-strong)] rounded-[var(--radius-md)] p-3 flex flex-col gap-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-[var(--fg-muted)]">{vocab.turboTargetLabel}</span>
                    <Badge tone="active">{formatHumanAction(turboTarget, locale, macros, true)}</Badge>
                  </div>

                  <Button
                    variant="secondary"
                    dashed={recordMode !== "turbo"}
                    fullWidth={true}
                    active={recordMode === "turbo"}
                    onClick={() => {
                      soloModifierRef.current = null;
                      setRecordMode((m) => (m === "turbo" ? "off" : "turbo"));
                    }}
                  >
                    <Keyboard size={15} strokeWidth={2} />
                    <span>{recordMode === "turbo" ? vocab.recordingCancelHint : vocab.turboCaptureKey}</span>
                  </Button>

                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-medium text-[var(--fg-muted)]">{vocab.turboRateLabel}</span>
                        <OptionReset
                          changed={turboRate !== 25}
                          label={formatResetOptionLabel(vocab, `25 ${vocab.perSecond}`)}
                          onReset={() => setTurboRate(25)}
                        />
                      </div>
                      <span className="text-xs font-bold tabular-nums">
                        {turboRate} {vocab.perSecond}
                      </span>
                    </div>
                    <Slider
                      ariaLabel={vocab.turboRateLabel}
                      min={1}
                      max={50}
                      step={1}
                      defaultValue={25}
                      resetHint={vocab.sliderResetHint}
                      value={turboRate}
                      onChange={setTurboRate}
                    />
                  </div>

                  <Button
                    variant="secondary"
                    size="sm"
                    fullWidth={true}
                    onClick={() => onAssign(`turbo:${turboTarget}@${turboRate}`)}
                  >
                    <Zap size={15} strokeWidth={2} />
                    <span>{vocab.applyTurbo}</span>
                  </Button>
                </div>

                {/* Tier 3: Mouse Target Presets */}
                <div className="pt-2 border-t border-[var(--border)] flex flex-col gap-2">
                  <span className="text-xs font-medium text-[var(--fg-muted)]">{vocab.quickPresetsLabel}</span>
                  <ChoiceChips
                    ariaLabel={vocab.turboTargetLabel}
                    variant="pills"
                    tier="presets"
                    size="sm"
                    columns={3}
                    value={turboTarget}
                    onChange={(nextTarget) => {
                      setTurboTarget(nextTarget);
                      onAssign(`turbo:${nextTarget}@${turboRate}`);
                    }}
                    options={TURBO_MOUSE_TARGETS.map((t) => ({
                      value: t,
                      label: formatHumanAction(t, locale, macros),
                    }))}
                  />
                </div>
              </div>
            ) : null}

            {category === "speed" ? (
              <div className="flex flex-col gap-3">
                {/* Tier 2: Precision Clutch Slider Stage */}
                <div
                  data-control-tier="stage"
                  className="bg-[var(--surface-2)] border border-[var(--border-strong)] rounded-[var(--radius-md)] p-3 flex flex-col gap-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-medium text-[var(--fg-muted)]">{vocab.clutchLabel}</span>
                      <OptionReset
                        changed={clutchDpi !== Math.min(dpiMax, Math.max(dpiMin, 400))}
                        label={formatResetOptionLabel(vocab, `${Math.min(dpiMax, Math.max(dpiMin, 400))} ${vocab.speedUnit}`)}
                        onReset={() => setClutchDpi(Math.min(dpiMax, Math.max(dpiMin, 400)))}
                      />
                    </div>
                    <bdi dir="ltr" className="text-xs font-bold tabular-nums">
                      {clutchDpi} {vocab.speedUnit}
                    </bdi>
                  </div>
                  <Slider
                    ariaLabel={vocab.clutchLabel}
                    min={dpiMin}
                    max={dpiMax}
                    step={dpiStep}
                    stops={computeErgonomicStops(dpiMin, dpiMax, dpiStep)}
                    defaultValue={Math.min(dpiMax, Math.max(dpiMin, 400))}
                    resetHint={vocab.sliderResetHint}
                    value={clutchDpi}
                    onChange={setClutchDpi}
                  />
                  <Button variant="secondary" size="sm" onClick={() => onAssign(`dpi-clutch:${clutchDpi}`)}>
                    {vocab.applyClutch}
                  </Button>
                </div>

                {/* Tier 3: Speed, Profile & Single-Row Onboard Memory Slots */}
                <div className="pt-2 border-t border-[var(--border)] flex flex-col gap-2">
                  <span className="text-xs font-medium text-[var(--fg-muted)]">{vocab.profileActionsLabel}</span>
                  {renderPresets(speedPresets)}
                  <span className="text-xs font-medium text-[var(--fg-muted)]">{vocab.onboardSlotsLabel}</span>
                  <ChoiceChips
                    ariaLabel={vocab.onboardSlotsLabel}
                    variant="pills"
                    tier="presets"
                    value={currentAction}
                    onChange={onAssign}
                    size="sm"
                    columns={5}
                    options={ONBOARD_SLOT_PRESETS.map((action, idx) => ({
                      value: action,
                      label: String(idx + 1),
                    }))}
                  />
                </div>
              </div>
            ) : null}

            {category === "media" ? (
              <div className="pt-1 flex flex-col gap-2">
                <span className="text-xs font-medium text-[var(--fg-muted)]">{vocab.quickPresetsLabel}</span>
                {renderPresets(MEDIA_PRESETS)}
              </div>
            ) : null}

            {category === "macros" ? (
              <div className="flex flex-col gap-3">
                <div
                  data-control-tier="stage"
                  className="bg-[var(--surface-2)] border border-[var(--border-strong)] rounded-[var(--radius-md)] p-3 flex flex-col gap-2.5"
                >
                  <ChoiceChips
                    ariaLabel={vocab.categories.macros}
                    variant="cards"
                    size="sm"
                    value={macroMode}
                    onChange={setMacroMode}
                    options={[
                      { value: "once" as const, label: locale === "ar" ? "تشغيل مرة" : "Play once" },
                      { value: "hold" as const, label: locale === "ar" ? "تكرار عند الضغط" : "Repeat while held" },
                      { value: "toggle" as const, label: locale === "ar" ? "تشغيل / إيقاف" : "Toggle repeat" },
                    ]}
                  />
                </div>
                <div className="pt-2 border-t border-[var(--border)] flex flex-col gap-2">
                  {macros.length > 0 ? (
                    <ChoiceChips
                      ariaLabel={vocab.navMacros}
                      variant="pills"
                      tier="presets"
                      value={currentAction}
                      onChange={onAssign}
                      size="sm"
                      options={macros.map((m) => ({
                        value: macroMode === "once" ? `macro:${m.id}` : `macro:${m.id}@${macroMode}`,
                        label: m.name,
                      }))}
                    />
                  ) : (
                    <span className="text-xs text-[var(--fg-muted)]">{vocab.macroEmpty}</span>
                  )}
                </div>
              </div>
            ) : null}

            {category === "disabled" ? (
              <div
                data-control-tier="stage"
                className="bg-[var(--surface-2)] border border-[var(--border-strong)] rounded-[var(--radius-md)] p-3 flex flex-col gap-2.5"
              >
                <Button variant="danger" fullWidth={true} onClick={() => onAssign("disabled")}>
                  <Ban size={15} strokeWidth={2} />
                  <span>{formatHumanAction("disabled", locale)}</span>
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </div>

      <div className="pt-3 border-t border-[var(--border)]">
        <Button variant="ghost" size="md" fullWidth={true} disabled={isLocked || !modified} onClick={onResetButton}>
          <RotateCcw size={15} strokeWidth={2} />
          <span>{vocab.resetButton}</span>
        </Button>
      </div>
    </div>
  );
}
