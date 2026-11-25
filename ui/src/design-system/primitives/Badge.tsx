import type { ReactNode } from "react";

export type StatusTone = "ok" | "warn" | "danger" | "active" | "neutral" | "brand";

const DOT_CLS: Record<StatusTone, string> = {
  ok: "bg-[var(--status-ok)]",
  warn: "bg-[var(--status-warn)]",
  danger: "bg-[var(--status-danger)]",
  active: "bg-[var(--status-active)]",
  neutral: "bg-[var(--status-neutral)]",
  brand: "bg-[var(--brand)]",
};

export function Badge({
  children,
  tone,
  showDot = false,
}: {
  children: ReactNode;
  tone?: StatusTone;
  showDot?: boolean;
}) {
  const isBrand = tone === "brand";
  return (
    <span
      data-badge="true"
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-[var(--radius-pill)] px-2.5 py-1 text-xs font-medium tabular-nums ${
        isBrand
          ? "bg-[var(--brand)] text-[var(--brand-fg)] font-semibold"
          : "bg-[var(--surface-2)] text-[var(--fg)]"
      }`}
    >
      {showDot && tone ? <span className={`w-2 h-2 rounded-full shrink-0 ${DOT_CLS[tone]}`} /> : null}
      <span>{children}</span>
    </span>
  );
}
