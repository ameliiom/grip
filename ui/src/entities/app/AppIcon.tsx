function computeInitials(name: string): string {
  const words = name
    .trim()
    .split(/[\s\-_.]+/)
    .filter(Boolean);
  if (words.length >= 2) {
    return `${words[0]?.[0] ?? ""}${words[1]?.[0] ?? ""}`.toUpperCase();
  }
  const first = words[0] ?? "?";
  return first.slice(0, 2).toUpperCase();
}

export function AppIcon({
  name,
  iconDataUrl,
  size = "md",
}: {
  name: string;
  iconDataUrl?: string | null;
  size?: "sm" | "md";
}) {
  const dim = size === "sm" ? "w-5 h-5 text-[10px]" : "w-6 h-6 text-xs";
  if (iconDataUrl) {
    return <img src={iconDataUrl} alt="" className={`${dim} rounded-[4px] object-contain shrink-0`} />;
  }
  return (
    <span
      aria-hidden="true"
      className={`${dim} rounded-[6px] bg-[var(--surface-2)] border border-[var(--border)] text-[var(--fg)] font-bold inline-flex items-center justify-center shrink-0 select-none`}
    >
      {computeInitials(name)}
    </span>
  );
}
