import { Moon, Plus, RotateCcw, Sliders, Trash2, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import type { DeviceSnapshot } from "../acl/transport";
import {
  Button,
  ChoiceChips,
  ConfirmButton,
  HelpTip,
  Inline,
  NumberStepper,
  SegmentedControl,
  Slider,
  Stack,
  SurfaceCard,
  SurfaceInset,
  Switch,
  TileButton,
} from "../design-system/primitives";
import {
  computeErgonomicStops,
  computeSleepChoices,
  formatLatencyMs,
  formatMinutesLabel,
  type Locale,
  type Vocab,
} from "../i18n/vocab";

export function PerformanceView({
  device,
  locale,
  vocab,
  onSelectDpiStage,
  onCommitDpiStages,
  onSelectPolling,
  onSetSleep,
  onSetScroll,
  onResetPerformance,
}: {
  device: DeviceSnapshot;
  locale: Locale;
  vocab: Vocab;
  onSelectDpiStage: (stage: number) => void;
  onCommitDpiStages: (activeStage: number, stages: [number, number][]) => void;
  onSelectPolling: (hz: number) => void;
  onSetSleep: (minutes?: number, autoSleep?: boolean) => void;
  onSetScroll: (patch: { mode?: string; disabled?: string; acceleration?: string; smartReel?: string }) => void;
  onResetPerformance: () => void;
}) {
  const { capabilities, dpi } = device;
  const activeIdx = Math.max(0, Math.min(dpi.stages.length - 1, dpi.activeStage - 1));
  const currentStage = dpi.stages[activeIdx] ?? [1600, 1600];
  const defaultDpi = Math.min(capabilities.dpiMax, Math.max(capabilities.dpiMin, 1600));

  const [independentXY, setIndependentXY] = useState(currentStage[0] !== currentStage[1]);
  useEffect(() => {
    setIndependentXY(currentStage[0] !== currentStage[1]);
  }, [currentStage]);

  const sleepChoices = computeSleepChoices(capabilities.sleepMaxMinutes);
  const ergonomicStops = computeErgonomicStops(capabilities.dpiMin, capabilities.dpiMax, capabilities.dpiStep);
  const tickStops = [
    ergonomicStops[0] ?? capabilities.dpiMin,
    ergonomicStops[Math.floor(ergonomicStops.length / 3)] ?? capabilities.dpiMin,
    ergonomicStops[Math.floor((ergonomicStops.length * 2) / 3)] ?? capabilities.dpiMax,
    ergonomicStops[ergonomicStops.length - 1] ?? capabilities.dpiMax,
  ];

  const updateCurrentStage = (x: number, y: number) => {
    const nextStages: [number, number][] = dpi.stages.map((st, idx) => (idx === activeIdx ? [x, y] : st));
    onCommitDpiStages(activeIdx + 1, nextStages);
  };

  const addStage = () => {
    if (dpi.stages.length >= dpi.maxStages) return;
    const last = dpi.stages[dpi.stages.length - 1] ?? [1600, 1600];
    const nextVal = Math.min(capabilities.dpiMax, last[0] + 400);
    const nextStages: [number, number][] = [...dpi.stages, [nextVal, nextVal]];
    onCommitDpiStages(nextStages.length, nextStages);
  };

  const removeActiveStage = () => {
    if (dpi.stages.length <= 1) return;
    const nextStages = dpi.stages.filter((_, idx) => idx !== activeIdx);
    const nextActive = Math.min(activeIdx + 1, nextStages.length);
    onCommitDpiStages(nextActive, nextStages);
  };

  const stageValues = dpi.stages.map(([x]) => x);
  const stageLo = Math.max(capabilities.dpiMin, Math.min(...stageValues, capabilities.dpiMax) - 400);
  const stageHi = Math.max(stageLo + 400, ...stageValues, capabilities.dpiMin + 1200);

  const stageBarPercent = (val: number) => {
    const ratio = (val - stageLo) / Math.max(1, stageHi - stageLo);
    return Math.max(20, Math.min(100, Math.round(20 + ratio * 80)));
  };

  const assistChoices = [
    { value: "off", label: vocab.scrollOffLabel },
    { value: "low", label: vocab.scrollLowLabel },
    { value: "medium", label: vocab.scrollMediumLabel },
    { value: "high", label: vocab.scrollHighLabel },
  ] as const;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 min-h-0 items-stretch">
      {/* Interactive 5-Stage Speed Curve + Single Compound Stage Tuner */}
      {capabilities.hasDpi ? (
        <SurfaceCard primaryContent={true} stableFrame={true} className="lg:col-span-7 min-w-0 h-full flex flex-col justify-between">
          <Stack gap="4" className="flex-1 justify-between">
            <Inline gap="2" justify="between" wrap={true}>
              <Inline gap="2" wrap={false}>
                <Sliders size={18} strokeWidth={2} />
                <h2 className="text-base font-bold">{vocab.speedStagesTitle}</h2>
                <HelpTip {...vocab.help.perfStages} side="bottom" />
              </Inline>

              <Inline gap="1" wrap={false}>
                <ConfirmButton
                  variant="ghost"
                  size="sm"
                  icon={<RotateCcw size={14} strokeWidth={2} />}
                  label={vocab.resetDefaults}
                  confirmLabel={vocab.confirmReset}
                  onConfirm={onResetPerformance}
                />
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={dpi.stages.length >= dpi.maxStages}
                  onClick={addStage}
                >
                  <Plus size={15} strokeWidth={2} />
                  <span>{vocab.addStage}</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  iconOnly={true}
                  disabled={dpi.stages.length <= 1}
                  onClick={removeActiveStage}
                  aria-label={vocab.removeStage}
                  title={vocab.removeStage}
                >
                  <Trash2 size={15} strokeWidth={2} />
                </Button>
              </Inline>
            </Inline>

            {/* Visual Stage Curve Bars — fills middle canvas proportionally without floating air under title */}
            <div className="flex-1 flex items-center w-full" dir="ltr">
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 w-full">
                {dpi.stages.map(([x, y], idx) => {
                  const isActive = idx + 1 === dpi.activeStage;
                  const barPct = stageBarPercent(x);
                  const label = x === y ? `${x}` : `${x}×${y}`;
                  return (
                    <TileButton
                      key={`stage-${idx + 1}`}
                      active={isActive}
                      align="center"
                      onClick={() => onSelectDpiStage(idx + 1)}
                      ariaLabel={`${vocab.speedStagesTitle} ${idx + 1}: ${label} ${vocab.speedUnit}`}
                    >
                      <span className="w-full h-24 sm:h-[clamp(96px,18vh,160px)] rounded-[var(--radius-sm)] bg-[var(--surface-2)] flex items-end p-1.5 overflow-hidden">
                        <span
                          className={`w-full rounded-[4px] grip-transition ${
                            isActive ? "bg-[var(--brand)]" : "bg-[var(--fg-muted)] opacity-55"
                          }`}
                          style={{ height: `${barPct}%` }}
                        />
                      </span>
                      <span className="text-xs font-medium tabular-nums whitespace-nowrap">{label}</span>
                    </TileButton>
                  );
                })}
              </div>
            </div>

            <SurfaceInset>
              <Stack gap="4">
                <Inline gap="2" justify="between" wrap={true}>
                  <span className="text-sm font-semibold">
                    {independentXY ? vocab.axisX : vocab.axisBoth}
                  </span>
                  <NumberStepper
                    ariaLabel={independentXY ? vocab.axisX : vocab.axisBoth}
                    value={currentStage[0]}
                    min={capabilities.dpiMin}
                    max={capabilities.dpiMax}
                    step={capabilities.dpiStep}
                    unit={vocab.speedUnit}
                    onCommit={(x) => updateCurrentStage(x, independentXY ? currentStage[1] : x)}
                  />
                </Inline>

                <Stack gap="1">
                  <Slider
                    ariaLabel={independentXY ? vocab.axisX : vocab.axisBoth}
                    min={capabilities.dpiMin}
                    max={capabilities.dpiMax}
                    step={capabilities.dpiStep}
                    stops={ergonomicStops}
                    defaultValue={defaultDpi}
                    resetHint={vocab.sliderResetHint}
                    value={currentStage[0]}
                    onChange={(x) => updateCurrentStage(x, independentXY ? currentStage[1] : x)}
                  />
                  <div className="flex items-center justify-between text-xs text-[var(--fg-muted)] tabular-nums" dir="ltr">
                    {tickStops.map((tick, idx) => (
                      <span key={`${tick}-${idx}`}>{tick}</span>
                    ))}
                  </div>
                </Stack>

                {independentXY ? (
                  <Stack gap="4">
                    <Inline gap="2" justify="between" wrap={true}>
                      <span className="text-sm font-semibold">{vocab.axisY}</span>
                      <NumberStepper
                        ariaLabel={vocab.axisY}
                        value={currentStage[1]}
                        min={capabilities.dpiMin}
                        max={capabilities.dpiMax}
                        step={capabilities.dpiStep}
                        unit={vocab.speedUnit}
                        onCommit={(y) => updateCurrentStage(currentStage[0], y)}
                      />
                    </Inline>
                    <Slider
                      ariaLabel={vocab.axisY}
                      min={capabilities.dpiMin}
                      max={capabilities.dpiMax}
                      step={capabilities.dpiStep}
                      stops={ergonomicStops}
                      defaultValue={defaultDpi}
                      resetHint={vocab.sliderResetHint}
                      value={currentStage[1]}
                      onChange={(y) => updateCurrentStage(currentStage[0], y)}
                    />
                  </Stack>
                ) : null}

                <Inline gap="2" justify="between" wrap={false}>
                  <Inline gap="1" wrap={false}>
                    <span className="text-xs text-[var(--fg-muted)]">{vocab.independentAxes}</span>
                    <HelpTip {...vocab.help.perfAxes} />
                  </Inline>
                  <Switch
                    ariaLabel={vocab.independentAxes}
                    checked={independentXY}
                    onCheckedChange={(on) => {
                      setIndependentXY(on);
                      if (!on) updateCurrentStage(currentStage[0], currentStage[0]);
                    }}
                  />
                </Inline>
              </Stack>
            </SurfaceInset>
          </Stack>
        </SurfaceCard>
      ) : null}

      {/* Polling Latency Selector, Visual Power Meter & Conditional Scroll Wheel */}
      <Stack gap="4" className="lg:col-span-5 min-w-0 h-full justify-between">
        {capabilities.pollingOptions.length > 0 && device.pollingHz !== null ? (
          <SurfaceCard stableFrame={true}>
            <Stack gap="4">
              <Inline gap="2" wrap={false}>
                <Zap size={17} strokeWidth={2} />
                <h2 className="text-base font-bold">{vocab.pollingTitle}</h2>
                <HelpTip {...vocab.help.perfPolling} side="bottom" />
              </Inline>

              <SegmentedControl
                ariaLabel={vocab.pollingTitle}
                dir="ltr"
                size="md"
                fullWidth={true}
                value={String(device.pollingHz)}
                onChange={(val) => onSelectPolling(Number(val))}
                options={capabilities.pollingOptions.map((hz) => ({
                  value: String(hz),
                  label: formatLatencyMs(hz, locale),
                }))}
              />
            </Stack>
          </SurfaceCard>
        ) : null}

        {device.batteryPercent !== null || sleepChoices.length > 0 ? (
          <SurfaceCard stableFrame={true} className="flex-1 flex flex-col justify-between">
            <Stack gap="4">
              <Inline gap="2" wrap={false}>
                <Moon size={17} strokeWidth={2} />
                <h2 className="text-base font-bold">{vocab.powerSleepTitle}</h2>
                <HelpTip {...vocab.help.perfSleep} />
              </Inline>

              {device.batteryPercent !== null ? (
                <div
                  role="progressbar"
                  aria-label={vocab.battery}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={device.batteryPercent}
                  className="w-full h-2.5 rounded-[var(--radius-pill)] bg-[var(--border)] overflow-hidden"
                >
                  <div
                    className={`h-full rounded-[var(--radius-pill)] ${
                      device.batteryPercent <= 15 ? "bg-[var(--status-warn)]" : "bg-[var(--status-ok)]"
                    }`}
                    style={{ width: `${Math.min(100, Math.max(0, device.batteryPercent))}%` }}
                  />
                </div>
              ) : null}

              {sleepChoices.length > 0 && device.sleepMinutes !== null ? (
                <Stack gap="2">
                  <span className="text-xs font-medium text-[var(--fg-muted)]">{vocab.sleepAfterLabel}</span>
                  <ChoiceChips
                    ariaLabel={vocab.sleepAfterLabel}
                    size="sm"
                    value={device.sleepMinutes}
                    onChange={(m) => onSetSleep(m, undefined)}
                    options={sleepChoices.map((m) => ({
                      value: m,
                      label: formatMinutesLabel(m, locale),
                    }))}
                  />
                </Stack>
              ) : null}

              {capabilities.hasAutoSleep && device.autoSleep !== null ? (
                <Inline gap="2" justify="between" wrap={false}>
                  <span className="text-sm">{vocab.autoSleepLabel}</span>
                  <Switch
                    ariaLabel={vocab.autoSleepLabel}
                    checked={device.autoSleep}
                    onCheckedChange={(on) => onSetSleep(undefined, on)}
                  />
                </Inline>
              ) : null}
            </Stack>
          </SurfaceCard>
        ) : null}

        {capabilities.hasScroll && device.scroll ? (
          <SurfaceCard stableFrame={true}>
            <Stack gap="4">
              <Inline gap="2" wrap={false}>
                <h2 className="text-base font-bold">{vocab.scrollWheelTitle}</h2>
                <HelpTip {...vocab.help.perfScroll} />
              </Inline>
              <Stack gap="2">
                <span className="text-xs text-[var(--fg-muted)]">{vocab.scrollModeLabel}</span>
                <ChoiceChips
                  ariaLabel={vocab.scrollModeLabel}
                  size="sm"
                  value={device.scroll.mode}
                  onChange={(mode) => onSetScroll({ mode })}
                  options={[
                    { value: "tactile", label: vocab.scrollTactile },
                    { value: "free-spin", label: vocab.scrollFreeSpin },
                    ...(device.scroll.precision ? [{ value: "precision-tactile", label: vocab.scrollPrecision }] : []),
                  ]}
                />
              </Stack>
              <Stack gap="2">
                <span className="text-xs text-[var(--fg-muted)]">{vocab.scrollAccelLabel}</span>
                <ChoiceChips
                  ariaLabel={vocab.scrollAccelLabel}
                  size="sm"
                  columns={4}
                  value={device.scroll.acceleration}
                  onChange={(acceleration) => onSetScroll({ acceleration })}
                  options={[...assistChoices]}
                />
              </Stack>
              <Stack gap="2">
                <span className="text-xs text-[var(--fg-muted)]">{vocab.smartReelLevelLabel}</span>
                <ChoiceChips
                  ariaLabel={vocab.smartReelLevelLabel}
                  size="sm"
                  columns={4}
                  value={device.scroll.smartReel}
                  onChange={(smartReel) => onSetScroll({ smartReel })}
                  options={[...assistChoices]}
                />
              </Stack>
            </Stack>
          </SurfaceCard>
        ) : null}
      </Stack>
    </div>
  );
}
