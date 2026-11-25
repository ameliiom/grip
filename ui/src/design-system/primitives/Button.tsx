import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ControlSize = "sm" | "md" | "lg";

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> {
  variant?: ButtonVariant;
  size?: ControlSize;
  active?: boolean;
  children: ReactNode;
  fullWidth?: boolean;
}

const SIZE_CLS: Record<ControlSize, string> = {
  sm: "h-[var(--ctrl-sm)] min-w-[var(--ctrl-sm)] px-3 text-xs",
  md: "h-[var(--ctrl-md)] min-w-[var(--ctrl-md)] px-3.5 text-sm",
  lg: "h-[var(--ctrl-lg)] min-w-[var(--ctrl-lg)] px-4 text-sm",
};

export function Button({
  variant = "secondary",
  size = "md",
  active = false,
  fullWidth = false,
  type = "button",
  children,
  ...rest
}: ButtonProps) {
  let tone = "bg-[var(--surface-2)] text-[var(--fg)] hover:brightness-95";
  if (variant === "primary") {
    tone = "bg-[var(--brand)] text-[var(--brand-fg)] font-semibold hover:brightness-95";
  } else if (variant === "ghost") {
    tone = "bg-transparent text-[var(--fg)] hover:bg-[var(--surface-2)]";
  } else if (variant === "danger") {
    tone = "bg-[var(--surface-2)] text-[var(--status-danger)] hover:brightness-95";
  }

  if (active && variant !== "primary") {
    tone = "bg-[var(--brand)] text-[var(--brand-fg)] font-semibold";
  }

  return (
    <button
      type={type}
      data-variant={variant === "primary" ? "primary" : undefined}
      data-active={active ? "true" : undefined}
      className={`inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-md)] font-medium grip-transition grip-focus cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed shrink-0 ${SIZE_CLS[size]} ${tone} ${fullWidth ? "w-full min-w-0" : ""}`}
      {...rest}
    >
      {children}
    </button>
  );
}
