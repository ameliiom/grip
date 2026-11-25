export type ThemeMode = "light" | "dark";

export const DEFAULT_BRAND_HEX = "#d4af37";

export interface BrandPreset {
  id: string;
  labelAr: string;
  labelEn: string;
  hex: string;
}

export const BRAND_PRESETS: readonly BrandPreset[] = [
  { id: "gold", labelAr: "ذهبي", labelEn: "Gold", hex: "#d4af37" },
  { id: "emerald", labelAr: "زمردي", labelEn: "Emerald", hex: "#22c55e" },
  { id: "sky", labelAr: "سماوي", labelEn: "Sky", hex: "#38bdf8" },
  { id: "amber", labelAr: "كهرماني", labelEn: "Amber", hex: "#f59e0b" },
  { id: "rose", labelAr: "وردي", labelEn: "Rose", hex: "#f43f5e" },
  { id: "mono", labelAr: "أحادي", labelEn: "Neutral", hex: "#71717a" },
];

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null;
  const num = parseInt(clean, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function luminance({ r, g, b }: { r: number; g: number; b: number }): number {
  const ch = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}

export function applyThemeTokens(theme: ThemeMode, brandHex: string): void {
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  const rgb = hexToRgb(brandHex) ?? { r: 212, g: 175, b: 55 };
  const lum = luminance(rgb);
  const brandFg = lum > 0.34 ? "#111111" : "#ffffff";
  root.style.setProperty("--brand", brandHex);
  root.style.setProperty("--brand-fg", brandFg);
  root.style.setProperty("--brand-ink", theme === "dark" ? brandHex : "#111113");
}
