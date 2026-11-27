import * as PopoverPrimitive from "@radix-ui/react-popover";
import { HelpCircle } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

export function HelpTip({
  title,
  body,
  side = "top",
}: {
  title: string;
  body: string;
  side?: "top" | "bottom" | "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const openTimerRef = useRef<number | null>(null);
  const closeTimerRef = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    if (openTimerRef.current !== null) {
      window.clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const scheduleOpen = () => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    if (open) return;
    openTimerRef.current = window.setTimeout(() => {
      openTimerRef.current = null;
      setOpen(true);
    }, 120);
  };

  const scheduleClose = () => {
    if (openTimerRef.current !== null) {
      window.clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null;
      setOpen(false);
    }, 140);
  };

  return (
    <PopoverPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        clearTimers();
        setOpen(next);
      }}
    >
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          data-help-tip="true"
          aria-label={title}
          title={title}
          onMouseEnter={scheduleOpen}
          onMouseLeave={scheduleClose}
          className="inline-flex items-center justify-center rounded-[var(--radius-pill)] h-11 w-11 min-[481px]:h-5 min-[481px]:w-5 text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-2)] grip-transition grip-focus cursor-pointer shrink-0"
        >
          <HelpCircle size={14} strokeWidth={2} />
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          side={side}
          sideOffset={6}
          collisionPadding={12}
          onMouseEnter={() => {
            if (closeTimerRef.current !== null) {
              window.clearTimeout(closeTimerRef.current);
              closeTimerRef.current = null;
            }
          }}
          onMouseLeave={scheduleClose}
          className="z-50 max-w-[270px] rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-2)] text-[var(--fg)] p-3 shadow-lg text-start flex flex-col gap-1"
        >
          <p className="text-xs font-semibold text-[var(--fg)]">{title}</p>
          <p className="text-xs leading-relaxed text-[var(--fg-muted)]">{body}</p>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
