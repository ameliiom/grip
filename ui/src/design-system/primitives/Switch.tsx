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
        className={`relative inline-flex items-center w-11 h-6 rounded-[var(--radius-pill)] p-0.5 grip-transition border ${
          checked ? "bg-[var(--fg)] border-[var(--fg)]" : "bg-[var(--surface-0)] border-[var(--hw-stroke)]"
        }`}
      >
        <span
          className={`w-[18px] h-[18px] rounded-full grip-transition ${
            checked ? "bg-[var(--surface-0)] translate-x-[20px] rtl:-translate-x-[20px]" : "bg-[var(--fg-muted)] translate-x-0"
          }`}
        />
      </span>
    </button>
  );
}
