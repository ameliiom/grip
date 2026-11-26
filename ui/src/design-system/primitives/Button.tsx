import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ControlSize = "sm" | "md" | "lg";

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> {
  variant?: ButtonVariant;
  size?: ControlSize;
  active?: boolean;
  dangerHover?: boolean;
  children: ReactNode;
  fullWidth?: boolean;
  iconOnly?: boolean;
  dashed?: boolean;
  tall?: boolean;
}

const SIZE_CLS: Record<ControlSize, string> = {
  sm: "h-[var(--ctrl-sm)] min-w-[var(--ctrl-sm)] px-3 text-xs",
  md: "h-[var(--ctrl-md)] min-w-[var(--ctrl-md)] px-3.5 text-sm",
  lg: "h-[var(--ctrl-lg)] min-w-[var(--ctrl-lg)] px-4 text-sm",
};

const ICON_SIZE_CLS: Record<ControlSize, string> = {
  sm: "h-[var(--ctrl-sm)] w-[var(--ctrl-sm)] px-0 text-xs",
  md: "h-[var(--ctrl-md)] w-[var(--ctrl-md)] px-0 text-sm",
  lg: "h-[var(--ctrl-lg)] w-[var(--ctrl-lg)] px-0 text-sm",
};

export function Button({
  variant = "secondary",
  size = "md",
  active = false,
  dangerHover = false,
  fullWidth = false,
  iconOnly = false,
  dashed = false,
  tall = false,
  type = "button",
  children,
  ...rest
}: ButtonProps) {
  let tone = "bg-[var(--surface-2)] text-[var(--fg)] hover:bg-[var(--surface-3)]";
  if (variant === "primary") {
    tone = "bg-[var(--brand)] text-[var(--brand-fg)] font-semibold hover:brightness-95";
  } else if (variant === "ghost") {
    tone = dangerHover
      ? "bg-transparent text-[var(--fg-muted)] hover:bg-[var(--status-danger)] hover:text-white"
      : "bg-transparent text-[var(--fg)] hover:bg-[var(--surface-2)]";
  } else if (variant === "danger") {
    tone = "bg-[var(--surface-2)] text-[var(--status-danger)] hover:bg-[var(--surface-3)]";
  }

  if (dashed && !active) {
    tone = "border border-dashed border-[var(--border-strong)] bg-[var(--surface-0)] text-[var(--fg)] hover:bg-[var(--surface-3)]";
  }

  if (active && variant !== "primary") {
    tone =
      variant === "ghost"
        ? "bg-[var(--surface-2)] text-[var(--fg)]"
        : "bg-[var(--fg)] text-[var(--surface-0)]";
  }

  return (
    <button
      type={type}
      data-variant={variant === "primary" ? "primary" : undefined}
      data-active={active ? "true" : undefined}
      className={`inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-md)] font-medium grip-transition grip-focus cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed shrink-0 ${iconOnly ? ICON_SIZE_CLS[size] : tall ? "min-h-[56px] px-4 py-2.5 text-sm" : SIZE_CLS[size]} ${tone} ${fullWidth ? "w-full min-w-0" : ""}`}
      {...rest}
    >
      {children}
    </button>
  );
}
