import { Battery, BatteryCharging, Moon, Plus, Sliders, Trash2, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import type { DeviceSnapshot } from "../acl/transport";
import {
  Badge,
  Button,
  ChoiceChips,
  Inline,
  NumberStepper,
  SegmentedControl,
  Slider,
  Stack,
  SurfaceCard,
  SurfaceInset,
  Switch,
} from "../design-system/primitives";
import { formatMinutesLabel, type Locale, type Vocab } from "../i18n/vocab";

export function PerformanceView({
  device,
  locale,
  vocab,
  onSelectDpiStage,
  onCommitDpiStages,
  onSelectPolling,
  onSetSleep,
  onSetScroll,
}: {
  device: DeviceSnapshot;
  locale: Locale;
  vocab: Vocab;
  onSelectDpiStage: (stage: number) => void;
  onCommitDpiStages: (activeStage: number, stages: [number, number][]) => void;
  onSelectPolling: (hz: number) => void;
  onSetSleep: (minutes?: number, autoSleep?: boolean) => void;
  onSetScroll: (patch: { mode?: string; disabled?: string; acceleration?: string; smartReel?: string }) => void;
}) {
  const { capabilities, dpi } = device;
  const activeIdx = Math.max(0, Math.min(dpi.stages.length - 1, dpi.activeStage - 1));
  const currentStage = dpi.stages[activeIdx] ?? [1600, 1600];

  const [independentXY, setIndependentXY] = useState(currentStage[0] !== currentStage[1]);
  useEffect(() => {
    setIndependentXY(currentStage[0] !== currentStage[1]);
  }, [currentStage]);

  const sleepChoices = capabilities.sleepMaxMinutes
    ? [1, 3, 5, 10, capabilities.sleepMaxMinutes].filter((v, i, a) => a.indexOf(v) === i)
    : [];

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

  const activeText =
    currentStage[0] === currentStage[1]
      ? `${currentStage[0]} ${vocab.speedUnit}`
      : `${currentStage[0]} × ${currentStage[1]} ${vocab.speedUnit}`;

  const pollingLabel = (hz: number) => {
    if (hz === 125) return locale === "ar" ? "125 • هادئ" : "125 • Saver";
    if (hz === 500) return locale === "ar" ? "500 • متوازن" : "500 • Fast";
    if (hz === 1000) return locale === "ar" ? "1000 • فائق" : "1000 • Ultra";
    return `${hz} ${vocab.pollingUnit}`;
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
      {/* DPI Stage Management & Live Tuning */}
      {capabilities.hasDpi ? (
        <SurfaceCard primaryContent={true} className="xl:col-span-7 min-w-0">
          <Stack gap="4">
            <Inline gap="2" justify="between" wrap={true}>
              <Inline gap="2" wrap={false}>
                <Sliders size={18} strokeWidth={2} />
                <h2 className="text-base font-bold">{vocab.speedStagesTitle}</h2>
              </Inline>
              <Badge tone="brand">
                <bdi dir="ltr" className="tabular-nums">
                  {activeText}
                </bdi>
              </Badge>
            </Inline>

            <Inline gap="2" justify="between" wrap={true}>
              <ChoiceChips
                ariaLabel={vocab.speedStagesTitle}
                dir="ltr"
                size="md"
                value={dpi.activeStage}
                onChange={onSelectDpiStage}
                options={dpi.stages.map(([x, y], idx) => ({
                  value: idx + 1,
                  label: x === y ? `${idx + 1}: ${x}` : `${idx + 1}: ${x}×${y}`,
                }))}
              />

              <Inline gap="2" wrap={false}>
                {dpi.stages.length < dpi.maxStages ? (
                  <Button variant="secondary" size="sm" onClick={addStage}>
                    <Plus size={15} strokeWidth={2} />
                    <span>{vocab.addStage}</span>
                  </Button>
                ) : null}
                {dpi.stages.length > 1 ? (
                  <Button variant="ghost" size="sm" onClick={removeActiveStage} aria-label={vocab.removeStage}>
                    <Trash2 size={15} strokeWidth={2} />
                  </Button>
                ) : null}
              </Inline>
            </Inline>

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
                <Slider
                  ariaLabel={independentXY ? vocab.axisX : vocab.axisBoth}
                  min={capabilities.dpiMin}
                  max={capabilities.dpiMax}
                  step={capabilities.dpiStep}
                  value={currentStage[0]}
                  onChange={(x) => updateCurrentStage(x, independentXY ? currentStage[1] : x)}
                />

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
                      value={currentStage[1]}
                      onChange={(y) => updateCurrentStage(currentStage[0], y)}
                    />
                  </Stack>
                ) : null}

                <Inline gap="2" justify="between" wrap={false}>
                  <span className="text-xs text-[var(--fg-muted)]">{vocab.independentAxes}</span>
                  <Switch
                    ariaLabel={vocab.independentAxes}
                    checked={independentXY}
                    onCheckedChange={(on) => {
                      setIndependentXY(on);
                      if (!on) updateCurrentStage(currentStage[0], currentStage[0]);
                    }}
                  />
                </Inline>

                <ChoiceChips
                  ariaLabel={vocab.activeSpeedLabel}
                  dir="ltr"
                  size="sm"
                  value={currentStage[0] === currentStage[1] ? currentStage[0] : null}
                  onChange={(val) => updateCurrentStage(val, val)}
                  options={[400, 800, 1200, 1600, 2400, 3200, 4800, 6400].map((v) => ({
                    value: v,
                    label: `${v}`,
                  }))}
                />
              </Stack>
            </SurfaceInset>
          </Stack>
        </SurfaceCard>
      ) : null}

      {/* Polling Rate, Wireless Power & Conditional Scroll Wheel */}
      <Stack gap="4" className="xl:col-span-5 min-w-0">
        {capabilities.pollingOptions.length > 0 && device.pollingHz !== null ? (
          <SurfaceCard>
            <Stack gap="4">
              <Inline gap="2" justify="between" wrap={true}>
                <Inline gap="2" wrap={false}>
                  <Zap size={17} strokeWidth={2} />
                  <h2 className="text-base font-bold">{vocab.pollingTitle}</h2>
                </Inline>
                <Badge tone="neutral">
                  <bdi dir="ltr" className="tabular-nums">
                    {device.pollingHz} {vocab.pollingUnit}
                  </bdi>
                </Badge>
              </Inline>

              <SegmentedControl
                ariaLabel={vocab.pollingTitle}
                dir="ltr"
                size="md"
                value={String(device.pollingHz)}
                onChange={(val) => onSelectPolling(Number(val))}
                options={capabilities.pollingOptions.map((hz) => ({
                  value: String(hz),
                  label: pollingLabel(hz),
                }))}
              />
            </Stack>
          </SurfaceCard>
        ) : null}

        {device.batteryPercent !== null || sleepChoices.length > 0 ? (
          <SurfaceCard>
            <Stack gap="4">
              <Inline gap="2" justify="between" wrap={true}>
                <Inline gap="2" wrap={false}>
                  <Moon size={17} strokeWidth={2} />
                  <h2 className="text-base font-bold">{vocab.powerSleepTitle}</h2>
                </Inline>
                {device.batteryPercent !== null ? (
                  <Badge tone={device.batteryPercent <= 15 ? "warn" : "ok"} showDot={true}>
                    <Inline gap="1" wrap={false}>
                      {device.charging ? <BatteryCharging size={14} strokeWidth={2} /> : <Battery size={14} strokeWidth={2} />}
                      <span className="tabular-nums">
                        {vocab.battery} {device.batteryPercent}%
                      </span>
                    </Inline>
                  </Badge>
                ) : null}
              </Inline>

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
          <SurfaceCard>
            <Stack gap="4">
              <h2 className="text-base font-bold">{vocab.scrollWheelTitle}</h2>
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
              <Inline gap="2" justify="between" wrap={false}>
                <span className="text-sm">{vocab.smartReelLabel}</span>
                <Switch
                  ariaLabel={vocab.smartReelLabel}
                  checked={device.scroll.smartReel !== "off"}
                  onCheckedChange={(on) => onSetScroll({ smartReel: on ? "medium" : "off" })}
                />
              </Inline>
            </Stack>
          </SurfaceCard>
        ) : null}
      </Stack>
    </div>
  );
}
