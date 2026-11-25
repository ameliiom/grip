export function Switch({
  checked,
  onCheckedChange,
  ariaLabel,
  disabled = false,
}: {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  ariaLabel: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className="inline-flex items-center justify-center min-w-[48px] h-[var(--ctrl-sm)] px-1 rounded-[var(--radius-pill)] grip-focus cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed shrink-0"
    >
      <span
        className={`relative inline-flex items-center w-11 h-6 rounded-[var(--radius-pill)] p-0.5 grip-transition ${
          checked ? "bg-[var(--brand)]" : "bg-[var(--surface-2)]"
        }`}
      >
        <span
          className={`w-5 h-5 rounded-full grip-transition ${
            checked ? "bg-[var(--brand-fg)] translate-x-5 rtl:-translate-x-5" : "bg-[var(--fg-muted)] translate-x-0"
          }`}
        />
      </span>
    </button>
  );
}
