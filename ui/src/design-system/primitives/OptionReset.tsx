import { RotateCcw } from "lucide-react";

/** Quiet inline per-option reset trigger: reserved zero-shift slot when unchanged, 1-click single-option reset with default tooltip when changed. */
export function OptionReset({
  changed,
  onReset,
  label,
}: {
  changed: boolean;
  onReset: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      data-option-reset="true"
      disabled={!changed}
      tabIndex={changed ? 0 : -1}
      aria-hidden={!changed || undefined}
      aria-label={label}
      title={label}
      onClick={() => {
        if (changed) onReset();
      }}
      className={
        changed
          ? "inline-flex items-center justify-center rounded-[var(--radius-pill)] h-11 w-11 min-[481px]:h-5 min-[481px]:w-5 text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-2)] grip-transition grip-focus cursor-pointer shrink-0"
          : "hidden min-[481px]:inline-flex min-[481px]:invisible items-center justify-center h-5 w-5 pointer-events-none select-none shrink-0"
      }
    >
      <RotateCcw size={13} strokeWidth={2} />
    </button>
  );
}
