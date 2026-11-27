import { Minus, Plus } from "lucide-react";
import { useEffect, useState } from "react";

export function NumberStepper({
  value,
  min,
  max,
  step = 50,
  unit,
  ariaLabel,
  onCommit,
  disabled = false,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  ariaLabel: string;
  onCommit: (next: number) => void;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const snap = (n: number) => {
    const clamped = Math.min(max, Math.max(min, n));
    return min + Math.round((clamped - min) / step) * step;
  };

  const commitText = () => {
    const parsed = Number.parseInt(draft.replace(/[^\d]/g, ""), 10);
    if (Number.isFinite(parsed)) {
      const next = snap(parsed);
      setDraft(String(next));
      onCommit(next);
    } else {
      setDraft(String(value));
    }
  };

  return (
    <div className="inline-flex items-center h-[46px] min-[481px]:h-[var(--ctrl-md)] min-w-[208px] rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-0)] overflow-hidden focus-within:outline-2 focus-within:outline-[var(--brand)] focus-within:outline-offset-1">
      <button
        type="button"
        disabled={disabled || value <= min}
        aria-label={`${ariaLabel} -`}
        onClick={() => onCommit(snap(value - step))}
        className="inline-flex items-center justify-center w-[var(--ctrl-md)] h-full text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-2)] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
      >
        <Minus size={15} strokeWidth={2} />
      </button>
      <div className="flex-1 h-full min-w-[120px] flex items-center justify-center gap-1 px-2" dir="ltr">
        <input
          type="text"
          inputMode="numeric"
          disabled={disabled}
          aria-label={ariaLabel}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitText}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              commitText();
              e.currentTarget.blur();
            }
          }}
          className="w-full h-full min-w-[120px] border-0 outline-none bg-transparent text-center text-sm font-semibold tabular-nums text-[var(--fg)]"
        />
        {unit ? <span className="text-xs text-[var(--fg-muted)] shrink-0">{unit}</span> : null}
      </div>
      <button
        type="button"
        disabled={disabled || value >= max}
        aria-label={`${ariaLabel} +`}
        onClick={() => onCommit(snap(value + step))}
        className="inline-flex items-center justify-center w-[var(--ctrl-md)] h-full text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-2)] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
      >
        <Plus size={15} strokeWidth={2} />
      </button>
    </div>
  );
}
