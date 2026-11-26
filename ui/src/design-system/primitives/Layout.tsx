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
  stableFrame = false,
  compactPage = false,
}: {
  children: ReactNode;
  className?: string;
  primaryContent?: boolean;
  stableFrame?: boolean;
  compactPage?: boolean;
}) {
  return (
    <section
      data-card="true"
      data-primary-content={primaryContent ? "true" : undefined}
      data-stable-frame={stableFrame ? "true" : undefined}
      data-compact-page={compactPage ? "true" : undefined}
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
  return <div className={`bg-[var(--surface-2)] rounded-[var(--radius-md)] p-3 sm:p-4 ${className}`}>{children}</div>;
}

export function AppShell({
  sidebar,
  header,
  mobileNav,
  children,
}: {
  sidebar?: ReactNode;
  header: ReactNode;
  mobileNav: ReactNode;
  children: ReactNode;
}) {
  return (
    <div data-fit-viewport="true" className="min-h-dvh w-full bg-[var(--surface-0)] text-[var(--fg)] flex">
      {sidebar ? (
        <aside className="hidden lg:flex lg:flex-col w-56 xl:w-60 shrink-0 border-e border-[var(--border)] bg-[var(--surface-1)] p-4">
          {sidebar}
        </aside>
      ) : null}
      <div className="flex-1 min-w-0 flex flex-col min-h-dvh">
        <header className="w-full min-h-[56px] border-b border-[var(--border)] bg-[var(--surface-1)] px-4 sm:px-6 py-2 flex items-center">
          {header}
        </header>
        <div className={`${sidebar ? "lg:hidden" : "md:hidden"} border-b border-[var(--border)] bg-[var(--surface-1)] px-3 py-1.5`}>
          {mobileNav}
        </div>
        <main className="w-full flex-1 min-h-0 min-w-0 px-4 sm:px-6 py-3 flex flex-col gap-3">{children}</main>
      </div>
    </div>
  );
}
