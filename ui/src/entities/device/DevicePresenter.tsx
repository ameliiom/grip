import { Battery, BatteryCharging, Mouse } from "lucide-react";
import type { DeviceSnapshot, DeviceSummary } from "../../acl/transport";
import { Badge, Inline } from "../../design-system/primitives";
import type { Vocab } from "../../i18n/vocab";

export function DeviceStatusChip({
  device,
  vocab,
}: {
  device: DeviceSummary | DeviceSnapshot;
  vocab: Vocab;
}) {
  return (
    <Inline gap="2" wrap={true}>
      <Badge tone="ok" showDot={true}>
        {device.name}
      </Badge>
      {device.batteryPercent !== null ? (
        <Badge tone={device.batteryPercent <= 15 ? "warn" : "neutral"}>
          <Inline gap="1" wrap={false}>
            {device.charging ? <BatteryCharging size={14} strokeWidth={2} /> : <Battery size={14} strokeWidth={2} />}
            <span className="tabular-nums">{device.batteryPercent}%</span>
          </Inline>
        </Badge>
      ) : null}
      <Badge tone="ok">{vocab.connected}</Badge>
    </Inline>
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
    <div className="rounded-[var(--radius-md)] bg-[var(--surface-2)] p-3 flex flex-col gap-2">
      <div className="flex items-center gap-2.5">
        <span className="inline-flex items-center justify-center w-9 h-9 rounded-[var(--radius-md)] bg-[var(--brand)] text-[var(--brand-fg)] shrink-0">
          <Mouse size={19} strokeWidth={2} />
        </span>
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-bold leading-snug break-words">{device.name}</span>
          <span className="text-xs text-[var(--fg-muted)]">{vocab.connected}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--fg-muted)] pt-1 border-t border-[var(--border)]">
        <bdi dir="ltr" className="tabular-nums font-medium text-[var(--fg)]">
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
