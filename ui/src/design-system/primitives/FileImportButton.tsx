import { useRef, type ChangeEvent, type ReactNode } from "react";
import { Button, type ButtonVariant, type ControlSize } from "./Button";

/** Styled file-picker trigger living inside design-system primitives so pages stay free of raw <input> tags. */
export function FileImportButton({
  label,
  accept = ".json,application/json",
  variant = "ghost",
  size = "sm",
  icon,
  disabled = false,
  onReadText,
  onError,
}: {
  label: string;
  accept?: string;
  variant?: ButtonVariant;
  size?: ControlSize;
  icon?: ReactNode;
  disabled?: boolean;
  onReadText: (content: string) => void;
  onError?: (reason: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = async (ev: ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0];
    ev.target.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      if (!text.trim()) {
        onError?.("empty");
        return;
      }
      onReadText(text);
    } catch (err) {
      onError?.(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="inline-flex shrink-0">
      <input ref={inputRef} type="file" accept={accept} className="hidden" aria-hidden="true" tabIndex={-1} onChange={(e) => void handleChange(e)} />
      <Button
        variant={variant}
        size={size}
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        {icon}
        <span>{label}</span>
      </Button>
    </div>
  );
}
