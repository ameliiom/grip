import { Battery, Mouse } from "lucide-react";
import type { DeviceSnapshot } from "../../acl/transport";
import { Badge, Inline } from "../../design-system/primitives";
import type { Locale, Vocab } from "../../i18n/vocab";

export function DeviceChip({
  device,
  vocab,
}: {
  device: DeviceSnapshot;
  vocab: Vocab;
  locale: Locale;
}) {
  return (
    <Inline gap="2" wrap={true}>
      <Badge tone="ok" showDot={true}>
        {device.name}
      </Badge>
      {device.batteryPercent !== null ? (
        <Badge tone="neutral">
          <Inline gap="1" wrap={false}>
            <Battery size={14} strokeWidth={2} />
            <span className="tabular-nums">{device.batteryPercent}%</span>
          </Inline>
        </Badge>
      ) : null}
      <Badge tone={device.mode === "live" ? "ok" : "neutral"}>
        {device.mode === "live" ? vocab.modeLive : vocab.modeSimulated}
      </Badge>
    </Inline>
  );
}

export function DeviceHeader({
  device,
  vocab,
}: {
  device: DeviceSnapshot;
  vocab: Vocab;
}) {
  const activeDpi = device.dpi.stages[device.dpi.activeStage - 1] ?? device.dpi.stages[0] ?? 1600;
  return (
    <Inline gap="2" justify="between" wrap={true}>
      <Inline gap="2" wrap={false}>
        <span className="inline-flex items-center justify-center w-9 h-9 rounded-[var(--radius-md)] bg-[var(--brand)] text-[var(--brand-fg)] shrink-0">
          <Mouse size={20} strokeWidth={2} />
        </span>
        <div className="flex flex-col">
          <span className="text-sm font-bold leading-tight">{device.name}</span>
          <span className="text-xs text-[var(--fg-muted)] tabular-nums">
            <bdi dir="ltr">{activeDpi} DPI</bdi>
            {device.pollingHz ? (
              <>
                {" • "}
                <bdi dir="ltr">{device.pollingHz} Hz</bdi>
              </>
            ) : null}
            {device.batteryPercent !== null ? ` • ${vocab.battery} ${device.batteryPercent}%` : ""}
          </span>
        </div>
      </Inline>
    </Inline>
  );
}
