import { Check } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { ControlSize } from "./Button";

export type ConfirmVariant = "ghost" | "secondary" | "danger";

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

const ARMED_COMPACT_CLS: Record<ControlSize, string> = {
  sm: "h-[var(--ctrl-sm)] min-w-[var(--ctrl-sm)] px-2.5 text-xs",
  md: "h-[var(--ctrl-md)] min-w-[var(--ctrl-md)] px-3 text-xs",
  lg: "h-[var(--ctrl-lg)] min-w-[var(--ctrl-lg)] px-3.5 text-sm",
};

/** In-element two-step confirmation button (no modal/popover). Arms on click 1, confirms on click 2, disarms on Escape/blur/3.5s. */
export function ConfirmButton({
  label,
  confirmLabel,
  onConfirm,
  variant = "ghost",
  size = "sm",
  icon,
  iconOnly = false,
  disabled = false,
  title,
  ariaLabel,
  fullWidth = false,
  tabIndex,
}: {
  label: string;
  confirmLabel: string;
  onConfirm: () => void;
  variant?: ConfirmVariant;
  size?: ControlSize;
  icon?: ReactNode;
  iconOnly?: boolean;
  disabled?: boolean;
  title?: string;
  ariaLabel?: string;
  fullWidth?: boolean;
  tabIndex?: number;
}) {
  const [armed, setArmed] = useState(false);
  const timerRef = useRef<number | null>(null);

  const disarm = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setArmed(false);
  }, []);

  useEffect(() => disarm, [disarm]);

  useEffect(() => {
    if (disabled && armed) disarm();
  }, [disabled, armed, disarm]);

  const arm = () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    setArmed(true);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      setArmed(false);
    }, 3500);
  };

  let tone = "bg-transparent text-[var(--fg)] hover:bg-[var(--surface-2)]";
  if (variant === "secondary") {
    tone = "bg-[var(--surface-2)] text-[var(--fg)] hover:bg-[var(--surface-3)]";
  } else if (variant === "danger") {
    tone = "bg-[var(--surface-2)] text-[var(--status-danger)] hover:bg-[var(--surface-3)]";
  }
  if (armed) {
    tone = "bg-[var(--status-danger-bg)] text-[var(--status-danger-fg)] hover:brightness-95";
  }

  const sizeCls = iconOnly
    ? (armed ? ARMED_COMPACT_CLS[size] : ICON_SIZE_CLS[size])
    : SIZE_CLS[size];

  return (
    <button
      type="button"
      tabIndex={tabIndex}
      disabled={disabled}
      data-confirm-action="true"
      data-armed={armed ? "true" : "false"}
      aria-label={armed ? confirmLabel : (ariaLabel ?? label)}
      title={armed ? confirmLabel : (title ?? label)}
      onClick={() => {
        if (disabled) return;
        if (!armed) {
          arm();
          return;
        }
        disarm();
        onConfirm();
      }}
      onBlur={() => {
        if (armed) disarm();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape" && armed) {
          e.preventDefault();
          e.stopPropagation();
          disarm();
        }
      }}
      className={`inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-[var(--radius-md)] font-medium grip-transition grip-focus cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed shrink-0 ${sizeCls} ${tone} ${fullWidth ? "w-full min-w-0" : ""}`}
    >
      {armed ? (
        <>
          <Check size={14} strokeWidth={2.5} />
          <span>{confirmLabel}</span>
        </>
      ) : (
        <>
          {icon}
          {!iconOnly ? <span>{label}</span> : null}
        </>
      )}
    </button>
  );
}
