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

export type ChoiceChipsVariant = "pills" | "tabs" | "cards";

export function ChoiceChips<T extends string | number>({
  options,
  value,
  onChange,
  size = "md",
  ariaLabel,
  dir,
  columns,
  variant = "pills",
  tier,
}: {
  options: readonly ChipOption<T>[];
  value: T | null;
  onChange: (next: T) => void;
  size?: ControlSize;
  ariaLabel: string;
  dir?: "ltr" | "rtl" | "auto";
  columns?: 2 | 3 | 4 | 5;
  variant?: ChoiceChipsVariant;
  tier?: string;
}) {
  const layoutCls =
    columns === 5
      ? "grid grid-cols-3 sm:grid-cols-5 gap-1.5 w-full"
      : columns === 4
        ? "grid grid-cols-2 sm:grid-cols-4 gap-1.5 w-full"
        : columns === 3
          ? "grid grid-cols-2 sm:grid-cols-3 gap-1.5 w-full"
          : columns === 2
            ? "grid grid-cols-2 gap-1.5 w-full"
            : "flex flex-wrap items-center gap-2";

  const wrapperCls =
    variant === "tabs"
      ? `${layoutCls} bg-[var(--surface-2)] border border-[var(--border)] rounded-[var(--radius-md)] p-1`
      : layoutCls;

  return (
    <div role="group" aria-label={ariaLabel} dir={dir} data-control-tier={tier} className={wrapperCls}>
      {options.map((opt) => {
        const isActive = value !== null && opt.value === value;
        let stateCls: string;
        if (variant === "tabs") {
          stateCls = isActive
            ? "bg-[var(--surface-0)] text-[var(--fg)] border border-[var(--border-strong)]"
            : "bg-transparent text-[var(--fg-muted)] border border-transparent hover:text-[var(--fg)] hover:bg-[var(--surface-3)]";
        } else if (variant === "cards") {
          stateCls = isActive
            ? "bg-[var(--fg)] text-[var(--surface-0)] border border-[var(--fg)]"
            : "bg-[var(--surface-0)] text-[var(--fg)] border border-[var(--border)] hover:bg-[var(--surface-2)]";
        } else {
          stateCls = isActive
            ? "bg-[var(--fg)] text-[var(--surface-0)] border border-[var(--fg)]"
            : "bg-[var(--surface-3)] text-[var(--fg)] border border-transparent hover:border-[var(--border-strong)]";
        }

        return (
          <button
            key={String(opt.value)}
            type="button"
            disabled={opt.disabled}
            aria-pressed={isActive}
            data-active={isActive ? "true" : undefined}
            onClick={() => onChange(opt.value)}
            className={`inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-[var(--radius-sm)] font-medium grip-transition grip-focus cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${SIZE_CLS[size]} ${stateCls}`}
          >
            {opt.icon}
            <span className="tabular-nums truncate">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
