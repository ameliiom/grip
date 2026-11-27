import { useCallback, useEffect, useRef } from "react";

export function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  ariaLabel,
  disabled = false,
  dir = "ltr",
  stops,
  defaultValue,
  resetHint,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (next: number) => void;
  ariaLabel: string;
  disabled?: boolean;
  dir?: "ltr" | "rtl";
  stops?: readonly number[];
  defaultValue?: number;
  resetHint?: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const clamped = Math.min(max, Math.max(min, value));
  const span = Math.max(1, max - min);
  const lastEmittedRef = useRef(clamped);

  useEffect(() => {
    lastEmittedRef.current = clamped;
  }, [clamped]);

  const emitIfChanged = useCallback(
    (next: number) => {
      if (next === lastEmittedRef.current) return;
      lastEmittedRef.current = next;
      onChange(next);
    },
    [onChange],
  );

  const effectiveStops =
    stops && stops.length >= 2
      ? [min, ...stops.filter((s) => s > min && s < max), max]
      : null;

  const valueToPct = (raw: number) => {
    const c = Math.min(max, Math.max(min, raw));
    if (!effectiveStops) return ((c - min) / span) * 100;
    const segs = effectiveStops.length - 1;
    for (let i = 0; i < segs; i++) {
      const a = effectiveStops[i]!;
      const b = effectiveStops[i + 1]!;
      if (c <= b) {
        const local = b > a ? (c - a) / (b - a) : 0;
        return ((i + local) / segs) * 100;
      }
    }
    return 100;
  };

  const pct = valueToPct(clamped);
  const showDefaultMarker =
    defaultValue !== undefined &&
    defaultValue >= min &&
    defaultValue <= max &&
    Math.abs(clamped - defaultValue) >= step;
  const defaultPct = showDefaultMarker ? valueToPct(defaultValue) : 0;

  const snapValue = useCallback(
    (raw: number) => {
      const stepped = min + Math.round((raw - min) / step) * step;
      return Math.min(max, Math.max(min, stepped));
    },
    [min, max, step],
  );

  const commitFromClientX = useCallback(
    (clientX: number) => {
      const el = trackRef.current;
      if (!el || disabled) return;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0) return;
      let ratio = (clientX - rect.left) / rect.width;
      if (dir === "rtl") ratio = 1 - ratio;
      ratio = Math.min(1, Math.max(0, ratio));
      if (!effectiveStops) {
        emitIfChanged(snapValue(min + ratio * span));
        return;
      }
      const segs = effectiveStops.length - 1;
      const scaled = ratio * segs;
      const idx = Math.min(segs - 1, Math.floor(scaled));
      const local = scaled - idx;
      const a = effectiveStops[idx]!;
      const b = effectiveStops[idx + 1]!;
      emitIfChanged(snapValue(a + local * (b - a)));
    },
    [disabled, dir, effectiveStops, emitIfChanged, min, snapValue, span],
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    const decKey = dir === "rtl" ? "ArrowRight" : "ArrowLeft";
    const incKey = dir === "rtl" ? "ArrowLeft" : "ArrowRight";
    let next: number | null = null;
    if (e.key === incKey || e.key === "ArrowUp") next = snapValue(clamped + step);
    else if (e.key === decKey || e.key === "ArrowDown") next = snapValue(clamped - step);
    else if (e.key === "PageUp") next = snapValue(clamped + step * 5);
    else if (e.key === "PageDown") next = snapValue(clamped - step * 5);
    else if (e.key === "Home") next = min;
    else if (e.key === "End") next = max;
    if (next !== null) {
      e.preventDefault();
      emitIfChanged(next);
    }
  };

  return (
    <div
      ref={trackRef}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label={ariaLabel}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={clamped}
      aria-disabled={disabled}
      dir={dir}
      title={defaultValue !== undefined ? resetHint : undefined}
      onDoubleClick={() => {
        if (!disabled && defaultValue !== undefined) {
          emitIfChanged(snapValue(defaultValue));
        }
      }}
      onKeyDown={onKeyDown}
      onPointerDown={(e) => {
        if (disabled) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        commitFromClientX(e.clientX);
      }}
      onPointerMove={(e) => {
        if (!disabled && e.buttons === 1) {
          commitFromClientX(e.clientX);
        }
      }}
      className={`relative flex items-center w-full min-w-[120px] h-[var(--ctrl-sm)] select-none touch-none cursor-pointer grip-focus rounded-[var(--radius-pill)] ${
        disabled ? "opacity-45 cursor-not-allowed" : ""
      }`}
    >
      <div className="w-full h-2 rounded-[var(--radius-pill)] bg-[var(--border)] overflow-hidden relative">
        <div
          className="h-full bg-[var(--brand)] rounded-[var(--radius-pill)]"
          style={{ width: `${pct}%` }}
        />
        {showDefaultMarker ? (
          <div
            aria-hidden="true"
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-[var(--fg-muted)] opacity-60 pointer-events-none"
            style={dir === "rtl" ? { right: `${defaultPct}%`, transform: "translate(50%, -50%)" } : { left: `${defaultPct}%` }}
          />
        ) : null}
      </div>
      <div
        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-[var(--surface-0)] border-2 border-[var(--brand)] pointer-events-none"
        style={dir === "rtl" ? { right: `${pct}%`, transform: "translate(50%, -50%)" } : { left: `${pct}%` }}
      />
    </div>
  );
}
