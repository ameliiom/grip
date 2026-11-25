import type { ReactNode } from "react";
import type { ControlSize } from "./Button";

export interface ChipOption<T extends string | number> {
  value: T;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
}

const SIZE_CLS: Record<ControlSize, string> = {
  sm: "h-[var(--ctrl-sm)] min-w-[var(--ctrl-sm)] px-3 text-xs",
  md: "h-[var(--ctrl-md)] min-w-[var(--ctrl-md)] px-3.5 text-xs",
  lg: "h-[var(--ctrl-lg)] min-w-[var(--ctrl-lg)] px-4 text-sm",
};

export function ChoiceChips<T extends string | number>({
  options,
  value,
  onChange,
  size = "md",
  ariaLabel,
  dir,
}: {
  options: readonly ChipOption<T>[];
  value: T | null;
  onChange: (next: T) => void;
  size?: ControlSize;
  ariaLabel: string;
  dir?: "ltr" | "rtl" | "auto";
}) {
  return (
    <div role="group" aria-label={ariaLabel} dir={dir} className="flex flex-wrap items-center gap-2">
      {options.map((opt) => {
        const isActive = value !== null && opt.value === value;
        return (
          <button
            key={String(opt.value)}
            type="button"
            disabled={opt.disabled}
            aria-pressed={isActive}
            data-active={isActive ? "true" : undefined}
            onClick={() => onChange(opt.value)}
            className={`inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-[var(--radius-md)] font-medium grip-transition grip-focus cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${SIZE_CLS[size]} ${
              isActive
                ? "bg-[var(--brand)] text-[var(--brand-fg)] font-semibold"
                : "bg-[var(--surface-2)] text-[var(--fg)] hover:brightness-95"
            }`}
          >
            {opt.icon}
            <span className="tabular-nums">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
