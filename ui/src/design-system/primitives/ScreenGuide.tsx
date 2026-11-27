import * as PopoverPrimitive from "@radix-ui/react-popover";
import { HelpCircle } from "lucide-react";
import { Button } from "./Button";

export function ScreenGuide({
  triggerLabel,
  title,
  summary,
  steps,
  saveNote,
  shortcutsHint,
  open,
  onOpenChange,
}: {
  triggerLabel: string;
  title: string;
  summary: string;
  steps: readonly string[];
  saveNote: string;
  shortcutsHint?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <PopoverPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <PopoverPrimitive.Trigger asChild>
        <Button
          variant="ghost"
          size="sm"
          iconOnly={true}
          active={open}
          data-screen-guide="true"
          aria-label={triggerLabel}
          title={triggerLabel}
        >
          <HelpCircle size={16} strokeWidth={2} />
        </Button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          side="bottom"
          align="end"
          sideOffset={6}
          collisionPadding={12}
          data-screen-guide-content="true"
          className="z-50 w-[min(340px,calc(100vw-24px))] rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-2)] text-[var(--fg)] p-4 shadow-lg text-start flex flex-col gap-3"
        >
          <div className="flex flex-col gap-1">
            <p className="text-sm font-bold text-[var(--fg)]">{title}</p>
            <p className="text-xs leading-relaxed text-[var(--fg-muted)]">{summary}</p>
          </div>
          <ol className="flex flex-col gap-2">
            {steps.map((step, idx) => (
              <li key={idx} className="flex items-start gap-2 text-xs leading-relaxed text-[var(--fg)]">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[var(--surface-3)] text-[var(--fg)] font-semibold tabular-nums shrink-0">
                  {idx + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          <div className="pt-2 border-t border-[var(--border)] flex flex-col gap-1">
            <p className="text-xs font-medium text-[var(--fg-muted)]">{saveNote}</p>
            {shortcutsHint ? (
              <p className="text-xs text-[var(--fg-muted)]" dir="ltr">
                {shortcutsHint}
              </p>
            ) : null}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
