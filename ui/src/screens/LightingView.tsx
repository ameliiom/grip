import { Sun } from "lucide-react";
import type { DeviceSnapshot } from "../acl/transport";
import { BRAND_PRESETS } from "../design-system/theme";
import {
  Button,
  ChoiceChips,
  Inline,
  Slider,
  Stack,
  SurfaceCard,
  SurfaceInset,
  Switch,
} from "../design-system/primitives";
import type { Locale, Vocab } from "../i18n/vocab";

export function LightingView({
  device,
  locale,
  vocab,
  onSetLightingControl,
  onSetColor,
  onSetBrightness,
  onSetEffect,
  onSetOff,
  onSyncAll,
}: {
  device: DeviceSnapshot;
  locale: Locale;
  vocab: Vocab;
  onSetLightingControl: (enabled: boolean) => void;
  onSetColor: (zone: string, color: string) => void;
  onSetBrightness: (zone: string, percent: number) => void;
  onSetEffect: (zone: string, effect: string) => void;
  onSetOff: (zone: string) => void;
  onSyncAll: (color?: string) => void;
}) {
  return (
    <Stack gap="4">
      <SurfaceCard primaryContent={true}>
        <Stack gap="4">
          <Inline gap="2" justify="between" wrap={true}>
            <Inline gap="2" wrap={false}>
              <Sun size={18} strokeWidth={2} />
              <h2 className="text-base font-bold">{vocab.lightingTitle}</h2>
            </Inline>
            <Inline gap="2" wrap={false}>
              <span className="text-sm text-[var(--fg-muted)]">{vocab.lightingControlLabel}</span>
              <Switch
                ariaLabel={vocab.lightingControlLabel}
                checked={device.lighting.enabled}
                onCheckedChange={onSetLightingControl}
              />
            </Inline>
          </Inline>

          {device.lighting.zones.map((zone) => (
            <SurfaceInset key={zone.id}>
              <Stack gap="4">
                <Inline gap="2" justify="between" wrap={true}>
                  <span className="text-sm font-bold">{zone.name}</span>
                  <Button variant="ghost" size="sm" onClick={() => onSetOff(zone.name)}>
                    {vocab.categories.disabled}
                  </Button>
                </Inline>

                <ChoiceChips
                  ariaLabel={zone.name}
                  size="sm"
                  value={zone.effect}
                  onChange={(eff) => onSetEffect(zone.name, eff)}
                  options={[
                    { value: "spectrum", label: locale === "ar" ? "طيف متدرج" : "Spectrum" },
                    { value: "breathing", label: locale === "ar" ? "تنفّس" : "Breathing" },
                    { value: "wave:left@3", label: locale === "ar" ? "موجة" : "Wave" },
                  ]}
                />

                <Inline gap="2" wrap={true}>
                  {BRAND_PRESETS.map((preset) => (
                    <Button
                      key={preset.id}
                      variant="secondary"
                      size="sm"
                      onClick={() => onSetColor(zone.name, preset.hex)}
                    >
                      {locale === "ar" ? preset.labelAr : preset.labelEn}
                    </Button>
                  ))}
                </Inline>

                <Stack gap="1">
                  <span className="text-xs text-[var(--fg-muted)]">
                    {vocab.brightnessLabel}: {zone.brightness}%
                  </span>
                  <Slider
                    ariaLabel={vocab.brightnessLabel}
                    min={0}
                    max={100}
                    step={5}
                    value={zone.brightness}
                    onChange={(pct) => onSetBrightness(zone.name, pct)}
                  />
                </Stack>
              </Stack>
            </SurfaceInset>
          ))}

          <Button variant="secondary" size="md" onClick={() => onSyncAll(BRAND_PRESETS[0]?.hex)}>
            {vocab.syncAllDevices}
          </Button>
        </Stack>
      </SurfaceCard>
    </Stack>
  );
}
