import { CheckCircle2, ChevronDown, Copy, FolderOpen, Monitor, Moon, Palette, RefreshCw, Sun } from "lucide-react";
import { useState } from "react";
import type { AppSettings, DeviceSnapshot, FirmwareCheckResult } from "../acl/transport";
import { BrandColorPicker } from "../design-system/BrandColorPicker";
import { DEFAULT_BRAND_HEX } from "../design-system/theme";
import {
  Badge,
  Button,
  HelpTip,
  Inline,
  OptionReset,
  SegmentedControl,
  Slider,
  Stack,
  SurfaceCard,
  SurfaceInset,
  Switch,
} from "../design-system/primitives";
import { cleanDeviceDisplayName, formatResetOptionLabel, type Locale, type Vocab } from "../i18n/vocab";

export function SettingsView({
  settings,
  appVersion,
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
  appVersion: string;
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
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 min-h-0 items-stretch">
      {/* Startup & Behavior */}
      <SurfaceCard primaryContent={true} stableFrame={true} className="lg:col-span-7 min-w-0 h-full">
        <Stack gap="2">
          <Inline gap="2" wrap={false}>
            <h2 className="text-base font-bold">{vocab.settingsBehaviorTitle}</h2>
            <HelpTip {...vocab.help.settingsBehavior} side="bottom" />
          </Inline>

          <SurfaceInset>
            <Inline gap="2" justify="between" wrap={false}>
              <Stack gap="1">
                <Inline gap="1" wrap={false}>
                  <span className="text-sm font-semibold">{vocab.autostartLabel}</span>
                  <OptionReset
                    changed={settings.autostart}
                    label={formatResetOptionLabel(vocab)}
                    onReset={() => patch({ autostart: false })}
                  />
                </Inline>
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
            <Inline gap="2" justify="between" wrap={true}>
              <Stack gap="1">
                <Inline gap="1" wrap={false}>
                  <span className="text-sm font-semibold">{vocab.closeBehaviorLabel}</span>
                  <OptionReset
                    changed={!settings.closeToTray}
                    label={formatResetOptionLabel(vocab, vocab.closeToTrayOption)}
                    onReset={() => patch({ closeToTray: true })}
                  />
                </Inline>
                <span className="text-xs text-[var(--fg-muted)]">{vocab.closeBehaviorHint}</span>
              </Stack>
              <SegmentedControl
                ariaLabel={vocab.closeBehaviorLabel}
                size="sm"
                value={settings.closeToTray ? "tray" : "quit"}
                onChange={(mode) => patch({ closeToTray: mode === "tray" })}
                options={[
                  { value: "tray", label: vocab.closeToTrayOption },
                  { value: "quit", label: vocab.closeQuitOption },
                ]}
              />
            </Inline>
          </SurfaceInset>

          <SurfaceInset>
            <Inline gap="2" justify="between" wrap={false}>
              <Stack gap="1">
                <Inline gap="1" wrap={false}>
                  <span className="text-sm font-semibold">{vocab.popupsLabel}</span>
                  <OptionReset
                    changed={!settings.popups}
                    label={formatResetOptionLabel(vocab)}
                    onReset={() => patch({ popups: true })}
                  />
                </Inline>
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
                <Inline gap="1" wrap={false}>
                  <span className="text-sm font-semibold">{vocab.autoSwitchLabel}</span>
                  <OptionReset
                    changed={!settings.autoSwitch}
                    label={formatResetOptionLabel(vocab)}
                    onReset={() => patch({ autoSwitch: true })}
                  />
                </Inline>
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
                <Inline gap="1" wrap={false}>
                  <span className="text-sm font-semibold">{vocab.lowBatteryAlertLabel}</span>
                  <OptionReset
                    changed={!settings.batteryWarning}
                    label={formatResetOptionLabel(vocab)}
                    onReset={() => patch({ batteryWarning: true })}
                  />
                </Inline>
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
                    <Inline gap="1" wrap={false}>
                      <OptionReset
                        changed={settings.batteryWarningAt !== 15}
                        label={formatResetOptionLabel(vocab, "15%")}
                        onReset={() => patch({ batteryWarningAt: 15 })}
                      />
                      <span className="text-xs font-bold tabular-nums">{settings.batteryWarningAt}%</span>
                    </Inline>
                  </Inline>
                  <Slider
                    ariaLabel={vocab.lowBatteryLevelLabel}
                    min={5}
                    max={50}
                    step={5}
                    defaultValue={15}
                    resetHint={vocab.sliderResetHint}
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
      <Stack gap="4" className="lg:col-span-5 min-w-0 h-full justify-between">
        <SurfaceCard className="flex-1">
          <Stack gap="4">
            <Inline gap="2" wrap={false}>
              <Palette size={17} strokeWidth={2} />
              <h2 className="text-base font-bold">{vocab.settingsAppearanceTitle}</h2>
              <HelpTip {...vocab.help.settingsAppearance} side="bottom" />
            </Inline>

            <Inline gap="2" justify="between" wrap={true}>
              <Inline gap="1" wrap={false}>
                <span className="text-sm font-medium">{vocab.themeLabel}</span>
                <OptionReset
                  changed={settings.theme !== "system"}
                  label={formatResetOptionLabel(vocab, vocab.themeSystem)}
                  onReset={() => patch({ theme: "system" })}
                />
              </Inline>
              <SegmentedControl
                ariaLabel={vocab.themeLabel}
                size="sm"
                value={settings.theme}
                onChange={(t) => patch({ theme: t as AppSettings["theme"] })}
                options={[
                  { value: "system", label: vocab.themeSystem, icon: <Monitor size={14} strokeWidth={2} /> },
                  { value: "dark", label: vocab.themeDark, icon: <Moon size={14} strokeWidth={2} /> },
                  { value: "light", label: vocab.themeLight, icon: <Sun size={14} strokeWidth={2} /> },
                ]}
              />
            </Inline>

            <Inline gap="2" justify="between" wrap={true}>
              <Inline gap="1" wrap={false}>
                <span className="text-sm font-medium">{vocab.languageLabel}</span>
                <OptionReset
                  changed={settings.locale !== "ar"}
                  label={formatResetOptionLabel(vocab, "العربية")}
                  onReset={() => patch({ locale: "ar" })}
                />
              </Inline>
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
              <Inline gap="1" wrap={false}>
                <span className="text-sm font-medium">{vocab.accentColorLabel}</span>
                <OptionReset
                  changed={settings.brandHex.toLowerCase() !== DEFAULT_BRAND_HEX}
                  label={formatResetOptionLabel(vocab)}
                  onReset={() => patch({ brandHex: DEFAULT_BRAND_HEX })}
                />
              </Inline>
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
                <span className="inline-flex items-center gap-2">
                  <span className="text-xs text-[var(--fg-muted)] tabular-nums" dir="ltr">
                    v{appVersion}
                  </span>
                  <ChevronDown size={16} strokeWidth={2} />
                </span>
              </span>
            </Button>

            {supportOpen ? (
              <Stack gap="4">
                <SurfaceInset>
                  <Stack gap="2">
                    <Inline gap="2" justify="between" wrap={true}>
                      <span className="text-xs text-[var(--fg-muted)]">{vocab.appVersionLabel}</span>
                      <span className="text-xs font-semibold tabular-nums" dir="ltr">
                        Grip v{appVersion}
                      </span>
                    </Inline>
                    <Inline gap="2" justify="between" wrap={true}>
                      <span className="text-xs text-[var(--fg-muted)]">{vocab.shortcutsTitle}</span>
                      <span className="text-xs text-[var(--fg)]" dir="ltr">
                        {vocab.shortcutsSummary}
                      </span>
                    </Inline>
                  </Stack>
                </SurfaceInset>
                {device ? (
                  <SurfaceInset>
                    <Stack gap="2">
                      <Inline gap="2" justify="between" wrap={true}>
                        <span className="text-xs text-[var(--fg-muted)]">{vocab.deviceModelLabel}</span>
                        <span className="text-xs font-semibold">{cleanDeviceDisplayName(device.name)}</span>
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
