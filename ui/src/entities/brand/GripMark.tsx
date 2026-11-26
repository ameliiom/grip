export function GripMark({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 256 256" fill="none" aria-hidden="true">
      <rect
        x="8"
        y="8"
        width="240"
        height="240"
        rx="58"
        fill="var(--hw-shell)"
        stroke="var(--border-strong)"
        strokeWidth="8"
      />
      <path
        d="M128 48 C154 48, 178 62, 180 86 C181 99, 175 110, 174 123 C172 138, 178 156, 175 176 C172 199, 154 210, 128 210 C102 210, 84 199, 81 176 C78 156, 84 138, 82 123 C81 110, 75 99, 76 86 C78 62, 102 48, 128 48 Z"
        fill="var(--fg)"
      />
      <line x1="128" y1="48" x2="128" y2="132" stroke="var(--hw-shell)" strokeWidth="8" strokeLinecap="round" />
      <path d="M80 116 C92 146, 102 174, 104 208" stroke="var(--hw-shell)" strokeWidth="8" strokeLinecap="round" />
      <path d="M176 116 C164 146, 154 174, 152 208" stroke="var(--hw-shell)" strokeWidth="8" strokeLinecap="round" />
      <rect x="115" y="68" width="26" height="48" rx="13" fill="var(--hw-shell)" />
      <rect x="119" y="74" width="18" height="36" rx="9" fill="var(--brand)" />
    </svg>
  );
}
