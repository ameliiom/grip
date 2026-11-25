import { Keyboard, Lock, Plus, RotateCcw, Save } from "lucide-react";
import { useEffect, useState } from "react";
import type { LayerName, MacroSummary } from "../../acl/transport";
import {
  Badge,
  Button,
  ChoiceChips,
  Inline,
  Stack,
  SurfaceInset,
  TextInput,
} from "../../design-system/primitives";
import { BUTTON_LABELS, formatActionLabel, type Locale, type Vocab } from "../../i18n/vocab";

type ActionCategory = "keys" | "mouse" | "media" | "dpi" | "macros" | "disabled";

const KEY_PRESETS: readonly string[] = [
  "key:q",
  "key:e",
  "key:r",
  "key:space",
  "key:ctrl+c",
  "key:ctrl+v",
  "key:win+h",
  "key:f13",
  "key:f14",
  "key:esc",
];

const MOUSE_PRESETS: readonly string[] = ["left", "right", "middle", "double-click", "back", "forward", "scroll-up", "scroll-down"];
const MEDIA_PRESETS: readonly string[] = ["media:mute", "media:play-pause", "media:volume-up", "media:volume-down", "media:next-track", "media:previous-track"];
const DPI_PRESETS: readonly string[] = ["dpi-up", "dpi-down", "dpi-cycle-up", "dpi-cycle-down", "hypershift", "profile-cycle-up"];

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
    ["space", "enter", "esc", "tab", "backspace", "delete", "insert", "home", "end", "pageup", "pagedown", "up", "down", "left", "right"].includes(keyName) ||
    Object.values(map).includes(keyName);
  if (!valid) return null;

  return "key:" + [...mods, keyName].join("+");
}

export function ActionInspector({
  selectedButton,
  layer,
  currentAction,
  macros,
  hasMacros,
  onboardSavedAt,
  locale,
  vocab,
  onAssign,
  onResetButton,
  onRestoreAll,
  onSaveOnboard,
  onCreateMacro,
}: {
  selectedButton: string;
  layer: LayerName;
  currentAction: string;
  macros: readonly MacroSummary[];
  hasMacros: boolean;
  onboardSavedAt: string | null;
  locale: Locale;
  vocab: Vocab;
  onAssign: (action: string) => void;
  onResetButton: () => void;
  onRestoreAll: () => void;
  onSaveOnboard: () => void;
  onCreateMacro: (name: string, steps: string) => void;
}) {
  const [category, setCategory] = useState<ActionCategory>("keys");
  const [recording, setRecording] = useState(false);
  const [macroName, setMacroName] = useState("");
  const [macroSteps, setMacroSteps] = useState("");
  const isLocked = layer === "normal" && selectedButton === "left" && currentAction === "left";
  const buttonName = BUTTON_LABELS[locale][selectedButton] ?? selectedButton;

  useEffect(() => {
    if (!recording) return;
    const onKeyDown = (ev: KeyboardEvent) => {
      ev.preventDefault();
      ev.stopPropagation();
      const parsed = normalizeCapturedKey(ev);
      if (parsed) {
        onAssign(parsed);
        setRecording(false);
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [recording, onAssign]);

  const categories = [
    { value: "keys" as const, label: vocab.categories.keys },
    { value: "mouse" as const, label: vocab.categories.mouse },
    { value: "media" as const, label: vocab.categories.media },
    { value: "dpi" as const, label: vocab.categories.dpi },
    ...(hasMacros ? [{ value: "macros" as const, label: vocab.categories.macros }] : []),
    { value: "disabled" as const, label: vocab.categories.disabled },
  ];

  const renderPresets = (list: readonly string[]) => (
    <ChoiceChips
      ariaLabel={vocab.inspectorTitle}
      value={currentAction}
      onChange={onAssign}
      size="sm"
      options={list.map((action) => ({
        value: action,
        label: formatActionLabel(action, locale),
      }))}
    />
  );

  return (
    <Stack gap="4" className="h-full justify-between">
      <Stack gap="4">
        <Inline gap="2" justify="between" wrap={true}>
          <Stack gap="1">
            <span className="text-xs text-[var(--fg-muted)]">
              {layer === "normal" ? vocab.layerNormal : vocab.layerHyperShift}
            </span>
            <h2 className="text-base font-bold">{buttonName}</h2>
          </Stack>
          {isLocked ? (
            <Badge tone="neutral">
              <Inline gap="1" wrap={false}>
                <Lock size={13} strokeWidth={2} />
                <span>{vocab.protectedBadge}</span>
              </Inline>
            </Badge>
          ) : (
            <Badge tone="brand">{formatActionLabel(currentAction, locale)}</Badge>
          )}
        </Inline>

        {isLocked ? (
          <SurfaceInset>
            <p className="text-sm text-[var(--fg-muted)]">{vocab.leftClickProtected}</p>
          </SurfaceInset>
        ) : (
          <Stack gap="4">
            <ChoiceChips
              ariaLabel={vocab.inspectorTitle}
              value={category}
              onChange={(next) => {
                setRecording(false);
                setCategory(next);
              }}
              options={categories}
              size="sm"
            />

            {category === "keys" ? (
              <Stack gap="2">
                <span className="text-xs text-[var(--fg-muted)]">{vocab.keyCaptureHint}</span>
                <Inline gap="2" wrap={true}>
                  <Button
                    variant="secondary"
                    active={recording}
                    onClick={() => setRecording((r) => !r)}
                  >
                    <Keyboard size={16} strokeWidth={2} />
                    <span>{recording ? vocab.recordingKey : vocab.pressAnyKey}</span>
                  </Button>
                  {recording ? (
                    <Button variant="ghost" size="sm" onClick={() => setRecording(false)}>
                      {vocab.cancel}
                    </Button>
                  ) : null}
                </Inline>
                {renderPresets(KEY_PRESETS)}
              </Stack>
            ) : null}

            {category === "mouse" ? renderPresets(MOUSE_PRESETS) : null}
            {category === "media" ? renderPresets(MEDIA_PRESETS) : null}
            {category === "dpi" ? renderPresets(DPI_PRESETS) : null}

            {category === "macros" ? (
              <Stack gap="2">
                {macros.length > 0 ? (
                  <ChoiceChips
                    ariaLabel={vocab.categories.macros}
                    value={currentAction}
                    onChange={onAssign}
                    size="sm"
                    options={macros.map((m) => ({
                      value: `macro:${m.id}`,
                      label: m.name,
                    }))}
                  />
                ) : (
                  <span className="text-xs text-[var(--fg-muted)]">{vocab.macroEmpty}</span>
                )}
                <SurfaceInset>
                  <Stack gap="2">
                    <span className="text-xs font-medium">{vocab.macroCreateTitle}</span>
                    <TextInput
                      value={macroName}
                      onChange={(e) => setMacroName(e.target.value)}
                      placeholder={vocab.macroNamePlaceholder}
                      aria-label={vocab.macroNamePlaceholder}
                    />
                    <TextInput
                      value={macroSteps}
                      onChange={(e) => setMacroSteps(e.target.value)}
                      placeholder={vocab.macroStepsPlaceholder}
                      aria-label={vocab.macroStepsPlaceholder}
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={!macroName.trim() || !macroSteps.trim()}
                      onClick={() => {
                        onCreateMacro(macroName, macroSteps);
                        setMacroName("");
                        setMacroSteps("");
                      }}
                    >
                      <Plus size={15} strokeWidth={2} />
                      <span>{vocab.macroSave}</span>
                    </Button>
                  </Stack>
                </SurfaceInset>
              </Stack>
            ) : null}

            {category === "disabled" ? (
              <Button variant="danger" onClick={() => onAssign("disabled")}>
                {vocab.disabledLabel}
              </Button>
            ) : null}
          </Stack>
        )}
      </Stack>

      <Stack gap="2" className="pt-4 border-t border-[var(--border)]">
        <Inline gap="2" wrap={true}>
          <Button variant="secondary" size="md" disabled={isLocked} onClick={onResetButton}>
            <RotateCcw size={15} strokeWidth={2} />
            <span>{vocab.resetButton}</span>
          </Button>
          <Button variant="ghost" size="md" onClick={onRestoreAll}>
            <span>{vocab.restoreAll}</span>
          </Button>
        </Inline>
        <Button variant="primary" size="lg" fullWidth={true} onClick={onSaveOnboard}>
          <Save size={16} strokeWidth={2} />
          <span>{vocab.saveToMouse}</span>
        </Button>
        {onboardSavedAt ? (
          <span className="text-xs text-[var(--status-ok)] tabular-nums">
            {vocab.savedOnboard} ({onboardSavedAt})
          </span>
        ) : null}
      </Stack>
    </Stack>
  );
}
