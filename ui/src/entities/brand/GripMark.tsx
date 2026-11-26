export function GripMark({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 256 256" fill="none" aria-hidden="true">
      <rect
        x="10"
        y="10"
        width="236"
        height="236"
        rx="56"
        fill="var(--hw-shell)"
        stroke="var(--border-strong)"
        strokeWidth="10"
      />
      <path
        d="M84 56 C96 42, 114 37, 130 37 C148 37, 168 42, 180 54 C190 66, 193 92, 196 122 C202 150, 196 184, 184 202 C170 218, 150 222, 128 222 C104 222, 84 214, 72 198 C60 180, 58 148, 60 118 C62 88, 70 70, 84 56 Z"
        fill="var(--surface-2)"
        stroke="var(--fg)"
        strokeWidth="12"
        strokeLinejoin="round"
      />
      <rect x="118" y="54" width="20" height="44" rx="10" fill="var(--brand)" />
      <rect x="46" y="106" width="16" height="20" rx="5" fill="var(--brand)" />
      <rect x="46" y="132" width="16" height="20" rx="5" fill="var(--brand)" />
      <rect x="46" y="158" width="16" height="20" rx="5" fill="var(--brand)" />
    </svg>
  );
}
