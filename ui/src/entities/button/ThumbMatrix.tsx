import { Button, Inline, Stack } from "../../design-system/primitives";
import { BUTTON_LABELS, formatActionLabel, type Locale, type Vocab } from "../../i18n/vocab";

const TOP_BUTTONS: readonly string[] = ["left", "right", "wheel", "tilt-left", "tilt-right", "dpi-up", "dpi-down"];
const MATRIX_ORDER: readonly number[] = [1, 4, 7, 10, 2, 5, 8, 11, 3, 6, 9, 12];

function compactAction(label: string): string {
  if (label.length <= 10) return label;
  return label
    .replace("Ctrl+Shift+Alt+Win+", "CSAW+")
    .replace("Ctrl+Shift+Alt+", "CSA+");
}

export function ThumbMatrix({
  selectedButton,
  bindings,
  hasSideGrid12,
  locale,
  vocab,
  onSelectButton,
}: {
  selectedButton: string;
  bindings: Record<string, string>;
  hasSideGrid12: boolean;
  locale: Locale;
  vocab: Vocab;
  onSelectButton: (buttonId: string) => void;
}) {
  const names = BUTTON_LABELS[locale];

  return (
    <Stack gap="4">
      <Stack gap="2">
        <span className="text-xs font-medium text-[var(--fg-muted)]">{vocab.topViewTitle}</span>
        <Inline gap="2" wrap={true}>
          {TOP_BUTTONS.map((id) => {
            const label = names[id] ?? id;
            const act = compactAction(formatActionLabel(bindings[id] ?? "", locale));
            return (
              <Button
                key={id}
                size="sm"
                variant="secondary"
                active={selectedButton === id}
                onClick={() => onSelectButton(id)}
              >
                <span>{label}</span>
                <span className="opacity-75 text-xs" dir="auto">
                  • {act}
                </span>
              </Button>
            );
          })}
        </Inline>
      </Stack>

      {hasSideGrid12 ? (
        <Stack gap="2">
          <span className="text-xs font-medium text-[var(--fg-muted)]">{vocab.thumbMatrixTitle}</span>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2" dir="ltr">
            {MATRIX_ORDER.map((num) => {
              const id = `grid-${num}`;
              const raw = bindings[id] ?? "disabled";
              const text = compactAction(formatActionLabel(raw, locale));
              return (
                <Button
                  key={id}
                  size="md"
                  variant="secondary"
                  active={selectedButton === id}
                  fullWidth={true}
                  onClick={() => onSelectButton(id)}
                >
                  <span className="inline-flex items-center justify-between w-full gap-1.5 whitespace-nowrap overflow-hidden">
                    <span className="font-bold tabular-nums opacity-80">{num}</span>
                    <span className="truncate font-medium" dir="auto">
                      {text}
                    </span>
                  </span>
                </Button>
              );
            })}
          </div>
        </Stack>
      ) : null}
    </Stack>
  );
}
