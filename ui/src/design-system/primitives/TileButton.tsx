import type { ReactNode } from "react";

export function TileButton({
  active = false,
  disabled = false,
  onClick,
  ariaLabel,
  align = "start",
  compact = false,
  fillCell = false,
  fullWidth = true,
  tone = "default",
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  ariaLabel?: string;
  align?: "start" | "center" | "end";
  compact?: boolean;
  fillCell?: boolean;
  fullWidth?: boolean;
  tone?: "default" | "hardware";
  children: ReactNode;
}) {
  const alignCls =
    align === "end"
      ? "items-end text-end"
      : align === "center"
        ? "items-center text-center"
        : "items-start text-start";
  const sizeCls = fillCell
    ? "min-h-[44px] sm:min-h-0 sm:h-full px-2 py-1"
    : compact
      ? "min-h-[44px] sm:min-h-[38px] px-2.5 py-1"
      : "min-h-[44px] px-3 py-1.5";
  const stateCls =
    tone === "hardware"
      ? active
        ? "bg-[var(--brand)] text-[var(--brand-fg)] border border-[var(--brand)] font-medium"
        : "bg-[var(--hw-shell)] hover:border-[var(--fg)] text-[var(--fg)] border border-[var(--hw-stroke)] font-medium"
      : active
        ? "bg-[var(--surface-3)] border border-[var(--fg)] text-[var(--fg)] font-medium"
        : "bg-[var(--surface-0)] hover:bg-[var(--surface-2)] text-[var(--fg)] border border-[var(--border)] font-medium";

  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={ariaLabel}
      aria-pressed={active}
      data-active={active ? "true" : undefined}
      data-multiline-tile="true"
      onClick={onClick}
      className={`${fullWidth ? "w-full min-w-0" : ""} ${sizeCls} rounded-[var(--radius-md)] flex flex-col justify-center gap-0.5 grip-transition grip-focus cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed overflow-hidden ${alignCls} ${stateCls}`}
    >
      {children}
    </button>
  );
}
