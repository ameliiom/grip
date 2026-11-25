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

  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={ariaLabel}
      aria-pressed={active}
      data-active={active ? "true" : undefined}
      data-multiline-tile="true"
      onClick={onClick}
      className={`${fullWidth ? "w-full min-w-0" : ""} ${sizeCls} rounded-[var(--radius-md)] flex flex-col justify-center gap-0.5 grip-transition grip-focus cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed overflow-hidden ${alignCls} ${
        active
          ? "bg-[var(--brand)] text-[var(--brand-fg)] font-semibold"
          : "bg-[var(--surface-1)] hover:brightness-95 text-[var(--fg)] border border-[var(--border)]"
      }`}
    >
      {children}
    </button>
  );
}
