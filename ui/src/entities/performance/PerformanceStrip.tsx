import { Moon, Sliders, Zap } from "lucide-react";
import type { DeviceCapabilities } from "../../acl/transport";
import { ChoiceChips, Inline, SegmentedControl, Stack, SurfaceInset } from "../../design-system/primitives";
import { formatMinutesLabel, type Locale, type Vocab } from "../../i18n/vocab";

export function PerformanceStrip({
  capabilities,
  dpi,
  pollingHz,
  sleepMinutes,
  locale,
  vocab,
  onSelectDpiStage,
  onSelectPolling,
  onSelectSleep,
}: {
  capabilities: DeviceCapabilities;
  dpi: { activeStage: number; stages: number[] };
  pollingHz: number | null;
  sleepMinutes: number | null;
  locale: Locale;
  vocab: Vocab;
  onSelectDpiStage: (stage: number) => void;
  onSelectPolling: (hz: number) => void;
  onSelectSleep: (minutes: number) => void;
}) {
  const activeDpi = dpi.stages[dpi.activeStage - 1] ?? dpi.stages[0] ?? 1600;
  const sleepChoices = capabilities.sleepMaxMinutes
    ? [1, 3, 5, 10, capabilities.sleepMaxMinutes].filter((v, i, a) => a.indexOf(v) === i)
    : [];

  return (
    <SurfaceInset>
      <Stack gap="4">
        {capabilities.hasDpi ? (
          <Stack gap="2">
            <Inline gap="2" justify="between" wrap={true}>
              <Inline gap="1" wrap={false}>
                <Sliders size={14} strokeWidth={2} />
                <span className="text-xs font-medium text-[var(--fg-muted)]">{vocab.dpiStages}</span>
              </Inline>
              <bdi dir="ltr" className="text-xs font-bold tabular-nums">
                {activeDpi} DPI
              </bdi>
            </Inline>
            <ChoiceChips
              ariaLabel={vocab.dpiStages}
              dir="ltr"
              size="sm"
              value={dpi.activeStage}
              onChange={onSelectDpiStage}
              options={dpi.stages.map((val, idx) => ({
                value: idx + 1,
                label: `${val}`,
              }))}
            />
          </Stack>
        ) : null}

        <Inline gap="4" justify="between" wrap={true}>
          {capabilities.pollingOptions.length > 0 && pollingHz !== null ? (
            <Stack gap="1">
              <Inline gap="1" wrap={false}>
                <Zap size={14} strokeWidth={2} />
                <span className="text-xs font-medium text-[var(--fg-muted)]">{vocab.pollingRate}</span>
              </Inline>
              <SegmentedControl
                ariaLabel={vocab.pollingRate}
                dir="ltr"
                size="sm"
                value={String(pollingHz)}
                onChange={(val) => onSelectPolling(Number(val))}
                options={capabilities.pollingOptions.map((hz) => ({
                  value: String(hz),
                  label: `${hz} Hz`,
                }))}
              />
            </Stack>
          ) : null}

          {sleepChoices.length > 0 && sleepMinutes !== null ? (
            <Stack gap="1">
              <Inline gap="1" wrap={false}>
                <Moon size={14} strokeWidth={2} />
                <span className="text-xs font-medium text-[var(--fg-muted)]">{vocab.sleepTimer}</span>
              </Inline>
              <ChoiceChips
                ariaLabel={vocab.sleepTimer}
                size="sm"
                value={sleepMinutes}
                onChange={onSelectSleep}
                options={sleepChoices.map((m) => ({
                  value: m,
                  label: formatMinutesLabel(m, locale),
                }))}
              />
            </Stack>
          ) : null}
        </Inline>
      </Stack>
    </SurfaceInset>
  );
}
