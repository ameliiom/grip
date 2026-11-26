import type { ReactNode } from "react";
import type { ControlSize } from "./Button";

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

const BTN_SIZE_CLS: Record<ControlSize, string> = {
  sm: "h-[var(--ctrl-sm)] min-w-[var(--ctrl-sm)]",
  md: "h-[var(--ctrl-md)] min-w-[var(--ctrl-md)]",
  lg: "h-[var(--ctrl-lg)] min-w-[var(--ctrl-lg)]",
};

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = "sm",
  ariaLabel,
  dir,
  fullWidth = false,
}: {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (next: T) => void;
  size?: ControlSize;
  ariaLabel: string;
  dir?: "ltr" | "rtl" | "auto";
  fullWidth?: boolean;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      dir={dir}
      className={`${fullWidth ? "flex w-full" : "inline-flex"} max-w-full flex-wrap items-center gap-1 rounded-[var(--radius-md)] bg-[var(--surface-2)] p-1`}
    >
      {options.map((opt) => {
        const isActive = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={isActive}
            data-active={isActive ? "true" : undefined}
            onClick={() => onChange(opt.value)}
            className={`${fullWidth ? "flex-1 min-w-0" : ""} inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-[var(--radius-sm)] px-3 text-xs font-medium grip-transition grip-focus cursor-pointer ${BTN_SIZE_CLS[size]} ${
              isActive
                ? "bg-[var(--surface-0)] text-[var(--fg)] border border-[var(--border-strong)]"
                : "border border-transparent text-[var(--fg-muted)] hover:text-[var(--fg)]"
            }`}
          >
            {opt.icon}
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
