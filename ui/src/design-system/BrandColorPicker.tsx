import { Palette } from "lucide-react";
import { BRAND_PRESETS } from "./theme";
import { Button } from "./primitives/Button";
import { Inline, Stack } from "./primitives/Layout";
import { Popover } from "./primitives/Popover";

export function BrandColorPicker({
  value,
  label,
  locale,
  onChange,
}: {
  value: string;
  label: string;
  locale: "ar" | "en";
  onChange: (hex: string) => void;
}) {
  return (
    <Popover
      trigger={
        <Button variant="secondary" size="sm" aria-label={label}>
          <Palette size={15} strokeWidth={2} />
          <span>{label}</span>
        </Button>
      }
    >
      <Stack gap="2">
        <span className="text-xs font-medium text-[var(--fg-muted)]">{label}</span>
        <Inline gap="2" wrap={true}>
          {BRAND_PRESETS.map((preset) => {
            const active = preset.hex.toLowerCase() === value.toLowerCase();
            return (
              <Button
                key={preset.id}
                size="sm"
                variant="secondary"
                active={active}
                onClick={() => onChange(preset.hex)}
              >
                <span
                  className="w-3 h-3 rounded-full shrink-0 border border-[var(--border)]"
                  style={{ backgroundColor: preset.hex }}
                />
                <span>{locale === "ar" ? preset.labelAr : preset.labelEn}</span>
              </Button>
            );
          })}
        </Inline>
      </Stack>
    </Popover>
  );
}
