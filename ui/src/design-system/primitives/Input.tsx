import type { InputHTMLAttributes, ReactNode } from "react";

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "className" | "size"> {
  leading?: ReactNode;
  trailing?: ReactNode;
}

export function TextInput({ leading, trailing, ...rest }: InputProps) {
  return (
    <div className="flex items-center gap-2 h-[var(--ctrl-md)] min-w-[120px] w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-0)] px-3 focus-within:outline-2 focus-within:outline-[var(--brand)] focus-within:outline-offset-1">
      {leading ? <span className="text-[var(--fg-muted)] shrink-0">{leading}</span> : null}
      <input
        className="w-full min-w-[80px] border-0 outline-none bg-transparent text-sm text-[var(--fg)] placeholder:text-[var(--fg-muted)]"
        {...rest}
      />
      {trailing ? <span className="shrink-0">{trailing}</span> : null}
    </div>
  );
}
