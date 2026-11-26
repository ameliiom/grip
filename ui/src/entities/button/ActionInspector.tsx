import { Keyboard, Lock, RotateCcw, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import type { ButtonEntry, LayerName, MacroSummary } from "../../acl/transport";
import {
  Badge,
  Button,
  ChoiceChips,
  Inline,
  Slider,
  Stack,
  SurfaceInset,
} from "../../design-system/primitives";
import { BUTTON_LABELS, formatHumanAction, parseAction, type Locale, type Vocab } from "../../i18n/vocab";

type ActionCategory = "keys" | "mouse" | "turbo" | "speed" | "media" | "macros" | "disabled";

const KEY_PRESETS: readonly string[] = [
  "key:q",
  "key:e",
  "key:r",
  "key:space",
  "key:tab",
  "key:enter",
  "key:ctrl+c",
  "key:ctrl+v",
  "key:win+h",
  "key:f13",
  "key:f14",
  "key:esc",
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
  "media:volume-up",
  "media:volume-down",
  "media:next-track",
  "media:previous-track",
];

const SPEED_PRESETS: readonly string[] = [
  "dpi-up",
  "dpi-down",
  "dpi-cycle-up",
  "dpi-cycle-down",
  "hypershift",
  "profile-cycle-up",
];

const TURBO_TARGETS: readonly string[] = [
  "left",
  "right",
  "middle",
  "scroll-up",
  "scroll-down",
  "scroll-left",
  "scroll-right",
  "key:space",
  "key:q",
  "key:e",
];

function normalizeCapturedKey(ev: KeyboardEvent): string | null {
  const ignore = new Set(["Control", "Shift", "Alt", "Meta"]);
  if (ignore.has(ev.key)) return null;

  const mods: string[] = [];
  if (ev.ctrlKey) mods.push("ctrl");
  if (ev.shiftKey) mods.push("shift");
  if (ev.altKey) mods.push("alt");
  if (ev.metaKey) mods.push("win");

  const k = ev.key.toLowerCase();
  const map: Record<string, string> = {
    " ": "space",
    escape: "esc",
    arrowup: "up",
    arrowdown: "down",
    arrowleft: "left",
    arrowright: "right",
    "`": "grave",
    "-": "minus",
    "=": "equal",
    "[": "lbracket",
    "]": "rbracket",
    "\\": "backslash",
    ";": "semicolon",
    "'": "quote",
    ",": "comma",
    ".": "period",
    "/": "slash",
  };
  const keyName = map[k] ?? k;
  const valid =
    /^[a-z0-9]$/.test(keyName) ||
    /^f([1-9]|1[0-9]|2[0-4])$/.test(keyName) ||
    [
      "space",
      "enter",
      "esc",
      "tab",
      "backspace",
      "delete",
      "insert",
      "home",
      "end",
      "pageup",
      "pagedown",
      "up",
      "down",
      "left",
      "right",
    ].includes(keyName) ||
    Object.values(map).includes(keyName);
  if (!valid) return null;
  return "key:" + [...mods, keyName].join("+");
}

function initialCategoryFor(raw: string): ActionCategory {
  const p = parseAction(raw);
  if (p.kind === "disabled") return "disabled";
  if (p.kind === "mouse") return "mouse";
  if (p.kind === "turbo") return "turbo";
  if (p.kind === "dpi" || p.kind === "dpi-clutch" || p.kind === "hypershift" || p.kind === "profile-cycle") {
    return "speed";
  }
  if (p.kind === "media") return "media";
  if (p.kind === "macro") return "macros";
  return "keys";
}

export function ActionInspector({
  entry,
  layer,
  macros,
  hasMacros,
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
  const [recording, setRecording] = useState(false);

  const parsed = parseAction(currentAction);
  const [turboTarget, setTurboTarget] = useState<string>(parsed.kind === "turbo" ? parsed.target : "left");
  const [turboRate, setTurboRate] = useState<number>(parsed.kind === "turbo" ? parsed.rate : 25);
  const [clutchDpi, setClutchDpi] = useState<number>(parsed.kind === "dpi-clutch" ? parsed.dpi : 400);
  const [macroMode, setMacroMode] = useState<"once" | "hold" | "toggle">(
    parsed.kind === "macro" && (parsed.mode === "hold" || parsed.mode === "toggle") ? parsed.mode : "once",
  );

  useEffect(() => {
    setRecording(false);
    const p = parseAction(currentAction);
    setCategory(initialCategoryFor(currentAction));
    if (p.kind === "turbo") {
      setTurboTarget(p.target);
      setTurboRate(p.rate);
    }
    if (p.kind === "dpi-clutch") {
      setClutchDpi(p.dpi);
    }
  }, [entry.id, layer, currentAction]);

  useEffect(() => {
    if (!recording) return;
    const onKeyDown = (ev: KeyboardEvent) => {
      ev.preventDefault();
      ev.stopPropagation();
      const captured = normalizeCapturedKey(ev);
      if (captured) {
        onAssign(captured);
        setRecording(false);
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [recording, onAssign]);

  const categories = [
    { value: "keys" as const, label: vocab.categories.keys },
    { value: "mouse" as const, label: vocab.categories.mouse },
    { value: "turbo" as const, label: vocab.categories.turbo },
    { value: "speed" as const, label: vocab.categories.speed },
    { value: "media" as const, label: vocab.categories.media },
    ...(hasMacros ? [{ value: "macros" as const, label: vocab.categories.macros }] : []),
    { value: "disabled" as const, label: vocab.categories.disabled },
  ];

  const renderPresets = (list: readonly string[]) => (
    <ChoiceChips
      ariaLabel={vocab.categories[category]}
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

  const keyTokens = parsed.kind === "key" ? formatHumanAction(currentAction, locale, macros).split(" + ") : null;

  return (
    <Stack gap="4" className="h-full justify-between">
      <Stack gap="4">
        <Inline gap="2" justify="between" wrap={true}>
          <Stack gap="1">
            <Inline gap="2" wrap={true}>
              <span className="text-xs text-[var(--fg-muted)]">
                {layer === "normal" ? vocab.layerPrimary : vocab.layerSecondary}
              </span>
              {modified ? <Badge tone="brand">{vocab.modifiedBadge}</Badge> : null}
            </Inline>
            <h2 className="text-base font-bold">{buttonName}</h2>
          </Stack>
          {isLocked ? (
            <Badge tone="neutral">
              <Inline gap="1" wrap={false}>
                <Lock size={13} strokeWidth={2} />
                <span>{vocab.protectedTitle}</span>
              </Inline>
            </Badge>
          ) : keyTokens ? (
            <div className="flex flex-wrap items-center gap-1" dir="ltr">
              {keyTokens.map((tok, i) => (
                <kbd
                  key={`${tok}-${i}`}
                  className="inline-flex items-center justify-center min-w-[26px] h-7 px-2 rounded-[var(--radius-sm)] bg-[var(--surface-2)] border border-[var(--border)] text-xs font-bold text-[var(--fg)]"
                >
                  {tok}
                </kbd>
              ))}
            </div>
          ) : (
            <Badge tone="active">{formatHumanAction(currentAction, locale, macros)}</Badge>
          )}
        </Inline>

        {isLocked ? (
          <SurfaceInset>
            <p className="text-sm text-[var(--fg-muted)]">{vocab.protectedBody}</p>
          </SurfaceInset>
        ) : (
          <Stack gap="4">
            <ChoiceChips
              ariaLabel={buttonName}
              value={category}
              columns={3}
              onChange={(next) => {
                setRecording(false);
                setCategory(next);
              }}
              options={categories}
              size="sm"
            />

            {category === "keys" ? (
              <Stack gap="4">
                <Stack gap="2">
                  <span className="text-xs text-[var(--fg-muted)]">{vocab.keyCaptureHint}</span>
                  <Inline gap="2" wrap={false}>
                    <Button
                      variant="secondary"
                      dashed={!recording}
                      fullWidth={true}
                      active={recording}
                      onClick={() => setRecording((r) => !r)}
                    >
                      <Keyboard size={16} strokeWidth={2} />
                      <span>{recording ? vocab.recordingKey : vocab.pressAnyKey}</span>
                    </Button>
                    {recording ? (
                      <Button variant="ghost" size="md" onClick={() => setRecording(false)}>
                        {vocab.cancel}
                      </Button>
                    ) : null}
                  </Inline>
                </Stack>
                {renderPresets(KEY_PRESETS)}
              </Stack>
            ) : null}

            {category === "mouse" ? renderPresets(MOUSE_PRESETS) : null}

            {category === "turbo" ? (
              <SurfaceInset>
                <Stack gap="4">
                  <Stack gap="2">
                    <span className="text-xs font-medium text-[var(--fg-muted)]">{vocab.turboTargetLabel}</span>
                    <ChoiceChips
                      ariaLabel={vocab.turboTargetLabel}
                      size="sm"
                      value={turboTarget}
                      onChange={setTurboTarget}
                      options={TURBO_TARGETS.map((t) => ({
                        value: t,
                        label: formatHumanAction(t, locale, macros),
                      }))}
                    />
                  </Stack>

                  <Stack gap="2">
                    <Inline gap="2" justify="between" wrap={false}>
                      <span className="text-xs font-medium text-[var(--fg-muted)]">{vocab.turboRateLabel}</span>
                      <span className="text-xs font-bold tabular-nums">
                        {turboRate} {vocab.perSecond}
                      </span>
                    </Inline>
                    <Slider
                      ariaLabel={vocab.turboRateLabel}
                      min={1}
                      max={50}
                      step={1}
                      value={turboRate}
                      onChange={setTurboRate}
                    />
                  </Stack>

                  <Button
                    variant="secondary"
                    size="md"
                    fullWidth={true}
                    onClick={() => onAssign(`turbo:${turboTarget}@${turboRate}`)}
                  >
                    <Zap size={15} strokeWidth={2} />
                    <span>{vocab.applyTurbo}</span>
                  </Button>
                </Stack>
              </SurfaceInset>
            ) : null}

            {category === "speed" ? (
              <Stack gap="4">
                {renderPresets(SPEED_PRESETS)}
                <SurfaceInset>
                  <Stack gap="2">
                    <Inline gap="2" justify="between" wrap={false}>
                      <span className="text-xs font-medium text-[var(--fg-muted)]">{vocab.clutchLabel}</span>
                      <bdi dir="ltr" className="text-xs font-bold tabular-nums">
                        {clutchDpi} {vocab.speedUnit}
                      </bdi>
                    </Inline>
                    <Slider
                      ariaLabel={vocab.clutchLabel}
                      min={dpiMin}
                      max={dpiMax}
                      step={dpiStep}
                      value={clutchDpi}
                      onChange={setClutchDpi}
                    />
                    <Button variant="secondary" size="sm" onClick={() => onAssign(`dpi-clutch:${clutchDpi}`)}>
                      {vocab.applyClutch}
                    </Button>
                  </Stack>
                </SurfaceInset>
              </Stack>
            ) : null}

            {category === "media" ? renderPresets(MEDIA_PRESETS) : null}

            {category === "macros" ? (
              <Stack gap="2">
                <ChoiceChips
                  ariaLabel={vocab.categories.macros}
                  size="sm"
                  value={macroMode}
                  onChange={setMacroMode}
                  options={[
                    { value: "once" as const, label: locale === "ar" ? "تشغيل مرة" : "Play once" },
                    { value: "hold" as const, label: locale === "ar" ? "تكرار عند الضغط" : "Repeat while held" },
                    { value: "toggle" as const, label: locale === "ar" ? "تشغيل / إيقاف" : "Toggle repeat" },
                  ]}
                />
                {macros.length > 0 ? (
                  <ChoiceChips
                    ariaLabel={vocab.navMacros}
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
              </Stack>
            ) : null}

            {category === "disabled" ? (
              <Button variant="danger" onClick={() => onAssign("disabled")}>
                {formatHumanAction("disabled", locale)}
              </Button>
            ) : null}
          </Stack>
        )}
      </Stack>

      <div className="pt-3 border-t border-[var(--border)]">
        <Button variant="ghost" size="md" fullWidth={true} disabled={isLocked || !modified} onClick={onResetButton}>
          <RotateCcw size={15} strokeWidth={2} />
          <span>{vocab.resetButton}</span>
        </Button>
      </div>
    </Stack>
  );
}
