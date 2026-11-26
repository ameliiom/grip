import { Activity, Download, Gamepad2, RefreshCw, Sparkles, Zap } from "lucide-react";
import { useMemo } from "react";
import type {
  AppSettings,
  DesktopSmoothSettings,
  DeviceSnapshot,
  RawAccelSettings,
  RawAccelStatus,
  SmootherStatus,
} from "../acl/transport";
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
import { formatLatencyMs, type Locale, type Vocab } from "../i18n/vocab";

const PRESETS: Record<"light" | "balanced" | "silk", Pick<DesktopSmoothSettings, "strength" | "responsiveness" | "microPrecision">> = {
  light: { strength: 30, responsiveness: 85, microPrecision: 5 },
  balanced: { strength: 55, responsiveness: 65, microPrecision: 15 },
  silk: { strength: 82, responsiveness: 48, microPrecision: 28 },
};

export function MotionView({
  settings,
  device,
  smootherStatus,
  rawAccelStatus,
  locale,
  vocab,
  onUpdateSettings,
  onApplyRawAccel,
  onOpenRawAccelDownload,
  onRefreshMotionStatus,
  onSelectPolling,
}: {
  settings: AppSettings;
  device: DeviceSnapshot | null;
  smootherStatus: SmootherStatus;
  rawAccelStatus: RawAccelStatus;
  locale: Locale;
  vocab: Vocab;
  onUpdateSettings: (next: AppSettings) => void;
  onApplyRawAccel: (raw: RawAccelSettings) => void;
  onOpenRawAccelDownload: () => void;
  onRefreshMotionStatus: () => void;
  onSelectPolling: (hz: number) => void;
}) {
  const ds = settings.desktopSmooth;
  const ra = settings.rawAccel;

  const patchDesktop = (partial: Partial<DesktopSmoothSettings>) => {
    onUpdateSettings({
      ...settings,
      desktopSmooth: { ...ds, ...partial },
    });
  };

  const patchRawAccel = (partial: Partial<RawAccelSettings>) => {
    onUpdateSettings({
      ...settings,
      rawAccel: { ...ra, ...partial },
    });
  };

  const applyPreset = (preset: "light" | "balanced" | "silk") => {
    patchDesktop({ preset, ...PRESETS[preset], enabled: true });
  };

  const maxPolling = useMemo(() => {
    const opts = device?.capabilities.pollingOptions ?? [];
    if (opts.length === 0) return null;
    const cap = opts.includes(1000) ? 1000 : opts[opts.length - 1] ?? null;
    return cap;
  }, [device?.capabilities.pollingOptions]);

  const showPollingBoost = Boolean(device && device.pollingHz !== null && maxPolling !== null && device.pollingHz < maxPolling);

  const curvePaths = useMemo(() => {
    const rawPts: string[] = [];
    const smoothPts: string[] = [];
    const smoothGain = 0.25 + (ds.strength / 100) * 0.7;
    const respSlope = 0.4 + (ds.responsiveness / 100) * 0.6;
    const microFlat = (ds.microPrecision / 50) * 8;
    const n = 28;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = 10 + t * 340;
      const jitter = Math.sin(i * 2.3) * 4.2 + Math.cos(i * 4.1) * 2.1;
      const baseY = 74 - Math.pow(t, 0.92) * 58;
      const rawY = Math.max(8, Math.min(82, baseY + jitter));
      const smoothedCurve = 74 - (Math.pow(t, 0.92 + (1 - respSlope) * 0.35) * 58 - (1 - t) * microFlat * smoothGain);
      const dampJitter = jitter * (1 - smoothGain * 0.92);
      const smoothY = Math.max(8, Math.min(82, smoothedCurve + dampJitter));
      rawPts.push(`${i === 0 ? "M" : "L"}${x.toFixed(1)},${rawY.toFixed(1)}`);
      smoothPts.push(`${i === 0 ? "M" : "L"}${x.toFixed(1)},${smoothY.toFixed(1)}`);
    }
    return { raw: rawPts.join(" "), smooth: smoothPts.join(" ") };
  }, [ds.strength, ds.responsiveness, ds.microPrecision]);

  const smoothBadge = !ds.enabled
    ? { tone: "neutral" as const, text: vocab.motionOffBadge }
    : smootherStatus.bypassedForGame
      ? { tone: "warn" as const, text: vocab.motionPausedGameBadge }
      : { tone: "ok" as const, text: vocab.motionActiveBadge };

  const driverBadge = rawAccelStatus.driverRunning
    ? { tone: "ok" as const, text: vocab.motionGamingReadyBadge }
    : rawAccelStatus.installed
      ? { tone: "warn" as const, text: vocab.motionGamingInstalledBadge }
      : { tone: "neutral" as const, text: vocab.motionGamingMissingBadge };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 min-h-0 items-stretch">
      {/* Desktop Adaptive One-Euro Smoother */}
      <SurfaceCard primaryContent={true} stableFrame={true} className="lg:col-span-7 min-w-0 h-full flex flex-col justify-between">
        <Stack gap="2">
          <Inline gap="2" justify="between" wrap={true}>
            <Inline gap="2" wrap={false}>
              <Sparkles size={18} strokeWidth={2} />
              <h2 className="text-base font-bold">{vocab.motionDesktopTitle}</h2>
            </Inline>
            <Inline gap="2" wrap={false}>
              <Badge tone={smoothBadge.tone} showDot={true}>
                {smoothBadge.text}
              </Badge>
              <Switch
                ariaLabel={vocab.motionEnableLabel}
                checked={ds.enabled}
                onCheckedChange={(on) => patchDesktop({ enabled: on })}
              />
            </Inline>
          </Inline>

          <Inline gap="2" justify="between" wrap={true}>
            <span className="text-xs text-[var(--fg-muted)]">{vocab.motionDesktopHint}</span>
            <SegmentedControl
              ariaLabel={vocab.motionDesktopTitle}
              size="sm"
              value={ds.preset}
              onChange={(p) => {
                if (p === "light" || p === "balanced" || p === "silk") applyPreset(p);
              }}
              options={[
                { value: "light", label: vocab.motionPresetLight },
                { value: "balanced", label: vocab.motionPresetBalanced },
                { value: "silk", label: vocab.motionPresetSilk },
              ]}
            />
          </Inline>

          <SurfaceInset>
            <Stack gap="2">
              <Inline gap="2" justify="between" wrap={true}>
                <Inline gap="2" wrap={false}>
                  <Activity size={14} strokeWidth={2} />
                  <span className="text-xs font-medium text-[var(--fg-muted)]">{vocab.motionCurveRawLegend}</span>
                </Inline>
                <span className="text-xs font-semibold text-[var(--brand-ink)]">{vocab.motionCurveSmoothLegend}</span>
              </Inline>
              <svg viewBox="0 0 360 88" className="w-full h-20 rounded-[var(--radius-sm)] bg-[var(--hw-canvas)]" aria-hidden="true">
                <line x1="10" y1="74" x2="350" y2="74" stroke="var(--border)" strokeWidth="1" />
                <line x1="10" y1="42" x2="350" y2="42" stroke="var(--border)" strokeWidth="1" strokeDasharray="3 3" />
                <path d={curvePaths.raw} fill="none" stroke="var(--hw-stroke)" strokeWidth="1.75" strokeDasharray="4 3" />
                <path d={curvePaths.smooth} fill="none" stroke="var(--brand)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Stack>
          </SurfaceInset>

          <SurfaceInset>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Stack gap="1">
                <Inline gap="2" justify="between" wrap={false}>
                  <span className="text-xs font-semibold">{vocab.motionStrengthLabel}</span>
                  <span className="text-xs font-bold tabular-nums">{ds.strength}%</span>
                </Inline>
                <Slider
                  ariaLabel={vocab.motionStrengthLabel}
                  min={0}
                  max={100}
                  step={5}
                  value={ds.strength}
                  onChange={(v) => patchDesktop({ strength: v, preset: "custom" })}
                />
              </Stack>

              <Stack gap="1">
                <Inline gap="2" justify="between" wrap={false}>
                  <span className="text-xs font-semibold">{vocab.motionRespLabel}</span>
                  <span className="text-xs font-bold tabular-nums">{ds.responsiveness}%</span>
                </Inline>
                <Slider
                  ariaLabel={vocab.motionRespLabel}
                  min={0}
                  max={100}
                  step={5}
                  value={ds.responsiveness}
                  onChange={(v) => patchDesktop({ responsiveness: v, preset: "custom" })}
                />
              </Stack>

              <Stack gap="1">
                <Inline gap="2" justify="between" wrap={false}>
                  <span className="text-xs font-semibold">{vocab.motionMicroLabel}</span>
                  <span className="text-xs font-bold tabular-nums">{ds.microPrecision}%</span>
                </Inline>
                <Slider
                  ariaLabel={vocab.motionMicroLabel}
                  min={0}
                  max={50}
                  step={5}
                  value={ds.microPrecision}
                  onChange={(v) => patchDesktop({ microPrecision: v, preset: "custom" })}
                />
              </Stack>

              <Stack gap="1">
                <Inline gap="2" justify="between" wrap={false}>
                  <span className="text-xs font-semibold">{vocab.motionRotationLabel}</span>
                  <Inline gap="1" wrap={false}>
                    <span className="text-xs font-bold tabular-nums" dir="ltr">
                      {ds.rotationDeg > 0 ? `+${ds.rotationDeg}°` : `${ds.rotationDeg}°`}
                    </span>
                    {ds.rotationDeg !== 0 ? (
                      <Button variant="ghost" size="sm" onClick={() => patchDesktop({ rotationDeg: 0 })}>
                        <span>{vocab.motionResetRotation}</span>
                      </Button>
                    ) : null}
                  </Inline>
                </Inline>
                <Slider
                  ariaLabel={vocab.motionRotationLabel}
                  min={-25}
                  max={25}
                  step={1}
                  value={ds.rotationDeg}
                  onChange={(v) => patchDesktop({ rotationDeg: v })}
                />
              </Stack>
            </div>
          </SurfaceInset>

          <SurfaceInset>
            <Inline gap="2" justify="between" wrap={false}>
              <Stack gap="1">
                <span className="text-sm font-semibold">{vocab.motionBypassGamesLabel}</span>
                <span className="text-xs text-[var(--fg-muted)]">{vocab.motionBypassGamesHint}</span>
              </Stack>
              <Switch
                ariaLabel={vocab.motionBypassGamesLabel}
                checked={ds.bypassInGames}
                onCheckedChange={(on) => patchDesktop({ bypassInGames: on })}
              />
            </Inline>
          </SurfaceInset>
        </Stack>
      </SurfaceCard>

      {/* Gaming Kernel-Level Raw Accel + Hardware Polling Optimization */}
      <SurfaceCard stableFrame={true} className="lg:col-span-5 min-w-0 h-full flex flex-col justify-between">
        <Stack gap="4">
          <Inline gap="2" justify="between" wrap={true}>
            <Inline gap="2" wrap={false}>
              <Gamepad2 size={18} strokeWidth={2} />
              <h2 className="text-base font-bold">{vocab.motionGamingTitle}</h2>
            </Inline>
            <Badge tone={driverBadge.tone} showDot={true}>
              {driverBadge.text}
            </Badge>
          </Inline>

          {showPollingBoost && maxPolling !== null ? (
            <SurfaceInset>
              <Stack gap="2">
                <Inline gap="2" wrap={false}>
                  <Zap size={15} strokeWidth={2} />
                  <span className="text-xs font-medium">{vocab.motionPollingBoostTitle}</span>
                </Inline>
                <Button variant="secondary" size="sm" fullWidth={true} onClick={() => onSelectPolling(maxPolling)}>
                  <span>
                    {vocab.motionPollingBoostAction} {formatLatencyMs(maxPolling, locale)}
                  </span>
                </Button>
              </Stack>
            </SurfaceInset>
          ) : null}

          {rawAccelStatus.installed ? (
            <Stack gap="2">
              <SurfaceInset>
                <Inline gap="2" justify="between" wrap={false}>
                  <span className="text-sm font-semibold">{vocab.motionRawAccelEnableLabel}</span>
                  <Switch
                    ariaLabel={vocab.motionRawAccelEnableLabel}
                    checked={ra.enabled}
                    onCheckedChange={(on) => patchRawAccel({ enabled: on })}
                  />
                </Inline>
              </SurfaceInset>

              <SurfaceInset>
                <Stack gap="2">
                  <span className="text-xs font-semibold text-[var(--fg-muted)]">{vocab.motionRawAccelModeLabel}</span>
                  <SegmentedControl
                    ariaLabel={vocab.motionRawAccelModeLabel}
                    size="sm"
                    fullWidth={true}
                    value={ra.mode}
                    onChange={(m) => patchRawAccel({ mode: m as RawAccelSettings["mode"] })}
                    options={[
                      { value: "noaccel", label: vocab.motionModeFlat },
                      { value: "natural", label: vocab.motionModeNatural },
                      { value: "synchronous", label: vocab.motionModeSync },
                    ]}
                  />
                </Stack>
              </SurfaceInset>

              <SurfaceInset>
                <Stack gap="2">
                  <Stack gap="1">
                    <Inline gap="2" justify="between" wrap={false}>
                      <span className="text-xs font-semibold">{vocab.motionRawAccelSmoothLabel}</span>
                      <span className="text-xs font-bold tabular-nums" dir="ltr">
                        {(ra.outputSmoothingTenths / 10).toFixed(1)} ms
                      </span>
                    </Inline>
                    <Slider
                      ariaLabel={vocab.motionRawAccelSmoothLabel}
                      min={0}
                      max={80}
                      step={5}
                      value={ra.outputSmoothingTenths}
                      onChange={(v) => patchRawAccel({ outputSmoothingTenths: v })}
                    />
                  </Stack>

                  <Stack gap="1">
                    <Inline gap="2" justify="between" wrap={false}>
                      <span className="text-xs font-semibold">{vocab.motionRawAccelSensLabel}</span>
                      <span className="text-xs font-bold tabular-nums" dir="ltr">
                        {(ra.sensMultiplierPct / 100).toFixed(2)}x
                      </span>
                    </Inline>
                    <Slider
                      ariaLabel={vocab.motionRawAccelSensLabel}
                      min={25}
                      max={200}
                      step={5}
                      value={ra.sensMultiplierPct}
                      onChange={(v) => patchRawAccel({ sensMultiplierPct: v })}
                    />
                  </Stack>

                  <Stack gap="1">
                    <Inline gap="2" justify="between" wrap={false}>
                      <span className="text-xs font-semibold">{vocab.motionRotationLabel}</span>
                      <span className="text-xs font-bold tabular-nums" dir="ltr">
                        {ra.rotationDeg > 0 ? `+${ra.rotationDeg}°` : `${ra.rotationDeg}°`}
                      </span>
                    </Inline>
                    <Slider
                      ariaLabel={vocab.motionRotationLabel}
                      min={-25}
                      max={25}
                      step={1}
                      value={ra.rotationDeg}
                      onChange={(v) => patchRawAccel({ rotationDeg: v })}
                    />
                  </Stack>
                </Stack>
              </SurfaceInset>

              <Button variant="primary" size="md" fullWidth={true} onClick={() => onApplyRawAccel(ra)}>
                <span>{vocab.motionRawAccelApply}</span>
              </Button>
            </Stack>
          ) : (
            <SurfaceInset>
              <Stack gap="4">
                <p className="text-xs text-[var(--fg-muted)] leading-relaxed">{vocab.motionRawAccelSetupHint}</p>
                <Inline gap="2" wrap={true}>
                  <Button variant="primary" size="md" onClick={onOpenRawAccelDownload}>
                    <Download size={15} strokeWidth={2} />
                    <span>{vocab.motionRawAccelDownload}</span>
                  </Button>
                  <Button variant="secondary" size="md" onClick={onRefreshMotionStatus}>
                    <RefreshCw size={15} strokeWidth={2} />
                    <span>{vocab.motionRawAccelRefresh}</span>
                  </Button>
                </Inline>
              </Stack>
            </SurfaceInset>
          )}
        </Stack>
      </SurfaceCard>
    </div>
  );
}
