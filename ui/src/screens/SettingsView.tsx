import { CheckCircle2, ChevronDown, Copy, FolderOpen, Palette, RefreshCw } from "lucide-react";
import { useState } from "react";
import type { AppSettings, DeviceSnapshot, FirmwareCheckResult } from "../acl/transport";
import { BrandColorPicker } from "../design-system/BrandColorPicker";
import {
  Badge,
  Button,
  Inline,
  SegmentedControl,
  Slider,
  Stack,
  SurfaceCard,
  SurfaceInset,
  Switch,
} from "../design-system/primitives";
import type { Locale, Vocab } from "../i18n/vocab";

export function SettingsView({
  settings,
  device,
  synapseRunning,
  firmwareResult,
  vocab,
  onUpdateSettings,
  onCheckFirmware,
  onCopyReport,
  onOpenFolder,
}: {
  settings: AppSettings;
  device: DeviceSnapshot | null;
  synapseRunning: readonly string[];
  firmwareResult: FirmwareCheckResult | null;
  vocab: Vocab;
  onUpdateSettings: (next: AppSettings) => void;
  onCheckFirmware: () => void;
  onCopyReport: () => Promise<void>;
  onOpenFolder: () => void;
}) {
  const [supportOpen, setSupportOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const patch = (partial: Partial<AppSettings>) => {
    onUpdateSettings({ ...settings, ...partial });
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
      {/* Startup & Behavior */}
      <SurfaceCard primaryContent={true} className="xl:col-span-7 min-w-0">
        <Stack gap="4">
          <h2 className="text-base font-bold">{vocab.settingsBehaviorTitle}</h2>

          <SurfaceInset>
            <Inline gap="2" justify="between" wrap={false}>
              <Stack gap="1">
                <span className="text-sm font-semibold">{vocab.autostartLabel}</span>
                <span className="text-xs text-[var(--fg-muted)]">{vocab.autostartHint}</span>
              </Stack>
              <Switch
                ariaLabel={vocab.autostartLabel}
                checked={settings.autostart}
                onCheckedChange={(on) => patch({ autostart: on })}
              />
            </Inline>
          </SurfaceInset>

          <SurfaceInset>
            <Inline gap="2" justify="between" wrap={false}>
              <Stack gap="1">
                <span className="text-sm font-semibold">{vocab.popupsLabel}</span>
                <span className="text-xs text-[var(--fg-muted)]">{vocab.popupsHint}</span>
              </Stack>
              <Switch
                ariaLabel={vocab.popupsLabel}
                checked={settings.popups}
                onCheckedChange={(on) => patch({ popups: on })}
              />
            </Inline>
          </SurfaceInset>

          <SurfaceInset>
            <Inline gap="2" justify="between" wrap={false}>
              <Stack gap="1">
                <span className="text-sm font-semibold">{vocab.autoSwitchLabel}</span>
                <span className="text-xs text-[var(--fg-muted)]">{vocab.autoSwitchHint}</span>
              </Stack>
              <Switch
                ariaLabel={vocab.autoSwitchLabel}
                checked={settings.autoSwitch}
                onCheckedChange={(on) => patch({ autoSwitch: on })}
              />
            </Inline>
          </SurfaceInset>

          <SurfaceInset>
            <Stack gap="4">
              <Inline gap="2" justify="between" wrap={false}>
                <span className="text-sm font-semibold">{vocab.lowBatteryAlertLabel}</span>
                <Switch
                  ariaLabel={vocab.lowBatteryAlertLabel}
                  checked={settings.batteryWarning}
                  onCheckedChange={(on) => patch({ batteryWarning: on })}
                />
              </Inline>
              {settings.batteryWarning ? (
                <Stack gap="2">
                  <Inline gap="2" justify="between" wrap={false}>
                    <span className="text-xs text-[var(--fg-muted)]">{vocab.lowBatteryLevelLabel}</span>
                    <span className="text-xs font-bold tabular-nums">{settings.batteryWarningAt}%</span>
                  </Inline>
                  <Slider
                    ariaLabel={vocab.lowBatteryLevelLabel}
                    min={5}
                    max={50}
                    step={5}
                    value={settings.batteryWarningAt}
                    onChange={(v) => patch({ batteryWarningAt: v })}
                  />
                </Stack>
              ) : null}
            </Stack>
          </SurfaceInset>
        </Stack>
      </SurfaceCard>

      {/* Appearance & Collapsed Support Disclosure */}
      <Stack gap="4" className="xl:col-span-5 min-w-0">
        <SurfaceCard>
          <Stack gap="4">
            <Inline gap="2" wrap={false}>
              <Palette size={17} strokeWidth={2} />
              <h2 className="text-base font-bold">{vocab.settingsAppearanceTitle}</h2>
            </Inline>

            <Inline gap="2" justify="between" wrap={true}>
              <span className="text-sm font-medium">{vocab.themeLabel}</span>
              <SegmentedControl
                ariaLabel={vocab.themeLabel}
                size="sm"
                value={settings.theme}
                onChange={(t) => patch({ theme: t })}
                options={[
                  { value: "dark", label: vocab.themeDark },
                  { value: "light", label: vocab.themeLight },
                ]}
              />
            </Inline>

            <Inline gap="2" justify="between" wrap={true}>
              <span className="text-sm font-medium">{vocab.languageLabel}</span>
              <SegmentedControl
                ariaLabel={vocab.languageLabel}
                size="sm"
                value={settings.locale}
                onChange={(loc: Locale) => patch({ locale: loc })}
                options={[
                  { value: "ar", label: "العربية" },
                  { value: "en", label: "English" },
                ]}
              />
            </Inline>

            <Inline gap="2" justify="between" wrap={true}>
              <span className="text-sm font-medium">{vocab.accentColorLabel}</span>
              <BrandColorPicker
                value={settings.brandHex}
                label={vocab.accentColorLabel}
                locale={settings.locale}
                onChange={(hex) => patch({ brandHex: hex })}
              />
            </Inline>
          </Stack>
        </SurfaceCard>

        {/* Secondary Device Support Disclosure (kept out of primary operator screens) */}
        <SurfaceCard>
          <Stack gap="4">
            <Button variant="ghost" size="md" fullWidth={true} onClick={() => setSupportOpen((s) => !s)}>
              <span className="flex items-center justify-between w-full">
                <span>{vocab.deviceSupportTitle}</span>
                <ChevronDown size={16} strokeWidth={2} />
              </span>
            </Button>

            {supportOpen ? (
              <Stack gap="4">
                {device ? (
                  <SurfaceInset>
                    <Stack gap="2">
                      <Inline gap="2" justify="between" wrap={true}>
                        <span className="text-xs text-[var(--fg-muted)]">{vocab.deviceModelLabel}</span>
                        <span className="text-xs font-semibold">{device.name}</span>
                      </Inline>
                      <Inline gap="2" justify="between" wrap={true}>
                        <span className="text-xs text-[var(--fg-muted)]">{vocab.firmwareVersionLabel}</span>
                        <span className="text-xs font-semibold tabular-nums">{device.firmware}</span>
                      </Inline>
                      <Button variant="secondary" size="sm" onClick={onCheckFirmware}>
                        <RefreshCw size={14} strokeWidth={2} />
                        <span>{vocab.checkUpdates}</span>
                      </Button>
                      {firmwareResult ? (
                        <Badge tone={firmwareResult.state === "update" ? "warn" : "ok"}>
                          {firmwareResult.state === "current"
                            ? vocab.firmwareUpToDate
                            : firmwareResult.state === "update"
                              ? `${vocab.firmwareAvailable}: ${firmwareResult.latestVersion ?? ""}`
                              : vocab.firmwareNoneListed}
                        </Badge>
                      ) : null}
                    </Stack>
                  </SurfaceInset>
                ) : null}

                <SurfaceInset>
                  <Stack gap="2">
                    <span className="text-xs font-medium text-[var(--fg-muted)]">{vocab.synapseConflictTitle}</span>
                    {synapseRunning.length === 0 ? (
                      <Badge tone="ok" showDot={true}>
                        {vocab.synapseNoConflict}
                      </Badge>
                    ) : (
                      <Badge tone="warn" showDot={true}>
                        {synapseRunning.join(", ")}
                      </Badge>
                    )}
                  </Stack>
                </SurfaceInset>

                <Inline gap="2" wrap={true}>
                  <Button variant="secondary" size="sm" onClick={onOpenFolder}>
                    <FolderOpen size={14} strokeWidth={2} />
                    <span>{vocab.openDataFolder}</span>
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={async () => {
                      await onCopyReport();
                      setCopied(true);
                    }}
                  >
                    {copied ? <CheckCircle2 size={14} strokeWidth={2} /> : <Copy size={14} strokeWidth={2} />}
                    <span>{copied ? vocab.reportCopied : vocab.copySupportReport}</span>
                  </Button>
                </Inline>
              </Stack>
            ) : null}
          </Stack>
        </SurfaceCard>
      </Stack>
    </div>
  );
}
