import type { ReactNode } from "react";

type GapToken = "1" | "2" | "4" | "6" | "8";

const GAP_MAP: Record<GapToken, string> = {
  "1": "gap-1",
  "2": "gap-2",
  "4": "gap-4",
  "6": "gap-6",
  "8": "gap-8",
};

export function Stack({
  children,
  gap = "4",
  className = "",
}: {
  children: ReactNode;
  gap?: GapToken;
  className?: string;
}) {
  return <div className={`flex flex-col ${GAP_MAP[gap]} ${className}`}>{children}</div>;
}

export function Inline({
  children,
  gap = "2",
  wrap = true,
  align = "center",
  justify = "start",
  className = "",
}: {
  children: ReactNode;
  gap?: GapToken;
  wrap?: boolean;
  align?: "start" | "center" | "end" | "stretch";
  justify?: "start" | "center" | "end" | "between";
  className?: string;
}) {
  const alignCls =
    align === "start" ? "items-start" : align === "end" ? "items-end" : align === "stretch" ? "items-stretch" : "items-center";
  const justCls =
    justify === "between" ? "justify-between" : justify === "end" ? "justify-end" : justify === "center" ? "justify-center" : "justify-start";
  return (
    <div className={`flex ${wrap ? "flex-wrap" : "flex-nowrap"} ${alignCls} ${justCls} ${GAP_MAP[gap]} ${className}`}>
      {children}
    </div>
  );
}

export function SurfaceCard({
  children,
  className = "",
  primaryContent = false,
}: {
  children: ReactNode;
  className?: string;
  primaryContent?: boolean;
}) {
  return (
    <section
      data-card="true"
      data-primary-content={primaryContent ? "true" : undefined}
      className={`bg-[var(--surface-1)] border border-[var(--border)] rounded-[var(--radius-lg)] p-4 sm:p-5 ${className}`}
    >
      {children}
    </section>
  );
}

export function SurfaceInset({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-[var(--surface-2)] rounded-[var(--radius-md)] p-3 ${className}`}>
      {children}
    </div>
  );
}

export function AppShell({
  header,
  children,
  footer,
}: {
  header: ReactNode;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="min-h-screen w-full bg-[var(--surface-0)] text-[var(--fg)] flex flex-col">
      <header className="w-full border-b border-[var(--border)] bg-[var(--surface-1)] px-4 sm:px-6 py-3">
        {header}
      </header>
      <main className="w-full flex-1 px-4 sm:px-6 py-4 sm:py-6">{children}</main>
      <footer className="w-full border-t border-[var(--border)] bg-[var(--surface-1)] px-4 sm:px-6 py-3 text-xs text-[var(--fg-muted)]">
        {footer}
      </footer>
    </div>
  );
}
