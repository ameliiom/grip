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
  columns,
}: {
  options: readonly ChipOption<T>[];
  value: T | null;
  onChange: (next: T) => void;
  size?: ControlSize;
  ariaLabel: string;
  dir?: "ltr" | "rtl" | "auto";
  columns?: 2 | 3;
}) {
  const layoutCls =
    columns === 3
      ? "grid grid-cols-2 sm:grid-cols-3 gap-1.5 w-full"
      : columns === 2
        ? "grid grid-cols-2 gap-1.5 w-full"
        : "flex flex-wrap items-center gap-2";

  return (
    <div role="group" aria-label={ariaLabel} dir={dir} className={layoutCls}>
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
                ? "bg-[var(--fg)] text-[var(--surface-0)] border border-[var(--fg)] font-semibold"
                : "bg-[var(--surface-0)] text-[var(--fg)] border border-[var(--border)] hover:bg-[var(--surface-2)]"
            }`}
          >
            {opt.icon}
            <span className="tabular-nums truncate">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
