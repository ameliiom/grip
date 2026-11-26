import { Battery, BatteryCharging, Mouse } from "lucide-react";
import type { DeviceSnapshot, DeviceSummary } from "../../acl/transport";
import { Badge, Inline } from "../../design-system/primitives";
import type { Vocab } from "../../i18n/vocab";

export function DeviceBatteryPill({ device }: { device: DeviceSummary | DeviceSnapshot }) {
  if (device.batteryPercent === null) return null;
  return (
    <Badge tone={device.batteryPercent <= 15 ? "warn" : "ok"} showDot={true}>
      <Inline gap="1" wrap={false}>
        {device.charging ? <BatteryCharging size={13} strokeWidth={2} /> : <Battery size={13} strokeWidth={2} />}
        <span className="tabular-nums">{device.batteryPercent}%</span>
      </Inline>
    </Badge>
  );
}

export function DeviceSidebarCard({
  device,
  vocab,
}: {
  device: DeviceSnapshot;
  vocab: Vocab;
}) {
  const stageIdx = Math.max(0, device.dpi.activeStage - 1);
  const activeStage = device.dpi.stages[stageIdx] ?? device.dpi.stages[0] ?? [1600, 1600];
  const activeDpi = activeStage[0] === activeStage[1] ? `${activeStage[0]}` : `${activeStage[0]}×${activeStage[1]}`;

  return (
    <div className="rounded-[var(--radius-md)] bg-[var(--surface-0)] border border-[var(--border)] p-3 flex flex-col gap-2.5">
      <div className="flex items-start gap-2.5">
        <span className="inline-flex items-center justify-center w-9 h-9 rounded-[var(--radius-md)] bg-[var(--surface-2)] text-[var(--fg)] shrink-0">
          <Mouse size={18} strokeWidth={2} />
        </span>
        <div className="flex flex-col gap-0.5 min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="w-2 h-2 rounded-full bg-[var(--status-ok)] shrink-0" />
            <span className="text-sm font-bold leading-snug break-words">{device.name}</span>
          </div>
          <span className="text-xs text-[var(--fg-muted)]">{device.activeProfile}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--fg-muted)] pt-2 border-t border-[var(--border)]">
        <bdi dir="ltr" className="tabular-nums font-semibold text-[var(--fg)]">
          {activeDpi} {vocab.speedUnit}
        </bdi>
        {device.pollingHz ? (
          <bdi dir="ltr" className="tabular-nums">
            {device.pollingHz} {vocab.pollingUnit}
          </bdi>
        ) : null}
        {device.batteryPercent !== null ? (
          <span className="inline-flex items-center gap-1 tabular-nums">
            {device.charging ? <BatteryCharging size={13} strokeWidth={2} /> : <Battery size={13} strokeWidth={2} />}
            <span>{device.batteryPercent}%</span>
          </span>
        ) : null}
      </div>
    </div>
  );
}
