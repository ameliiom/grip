import { Battery, BatteryCharging, ChevronDown, Mouse } from "lucide-react";
import { useState } from "react";
import type { DeviceSnapshot, DeviceSummary } from "../../acl/transport";
import { Button, ChoiceChips, Popover, Stack } from "../../design-system/primitives";
import { cleanDeviceDisplayName, type Vocab } from "../../i18n/vocab";

export function DeviceIdentityBar({
  appName,
  device,
  devices,
  vocab,
  onSelectDevice,
}: {
  appName: string;
  device: DeviceSnapshot | null;
  devices: readonly DeviceSummary[];
  vocab: Vocab;
  onSelectDevice: (deviceKey: string) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);

  const batteryNode =
    device && device.batteryPercent !== null ? (
      <span
        data-metric="true"
        className={`inline-flex items-center gap-1 text-xs font-medium tabular-nums shrink-0 ${
          device.batteryPercent <= 15 ? "text-[var(--status-warn)]" : "text-[var(--fg-muted)]"
        }`}
      >
        {device.charging ? <BatteryCharging size={14} strokeWidth={2} /> : <Battery size={14} strokeWidth={2} />}
        <span>{device.batteryPercent}%</span>
      </span>
    ) : null;

  const core = (
    <div className="inline-flex items-center gap-2 min-w-0 shrink-0">
      <span className="inline-flex items-center justify-center w-8 h-8 rounded-[var(--radius-md)] bg-[var(--surface-2)] text-[var(--fg)] shrink-0">
        <Mouse size={17} strokeWidth={2} />
      </span>
      <span className="text-base font-bold tracking-tight whitespace-nowrap shrink-0">{appName}</span>
      {device ? (
        <span className="inline-flex items-center gap-2 min-w-0">
          <span
            className="w-2 h-2 rounded-full bg-[var(--status-ok)] shrink-0"
            title={vocab.connected}
            aria-label={vocab.connected}
          />
          <span className="hidden lg:inline text-sm font-medium text-[var(--fg)] whitespace-nowrap truncate max-w-[280px] xl:max-w-none">
            {cleanDeviceDisplayName(device.name)}
          </span>
          {batteryNode}
        </span>
      ) : (
        <span className="inline-flex items-center gap-1.5 text-xs text-[var(--fg-muted)] whitespace-nowrap">
          <span className="w-2 h-2 rounded-full bg-[var(--status-neutral)] shrink-0" />
          <span>{vocab.disconnected}</span>
        </span>
      )}
    </div>
  );

  if (!device || devices.length <= 1) {
    return core;
  }

  return (
    <Popover
      open={pickerOpen}
      onOpenChange={setPickerOpen}
      trigger={
        <Button variant="ghost" size="sm" aria-label={vocab.deviceModelLabel}>
          {core}
          <ChevronDown size={14} strokeWidth={2} />
        </Button>
      }
    >
      <Stack gap="2">
        <span className="text-xs font-semibold text-[var(--fg-muted)]">{vocab.deviceModelLabel}</span>
        <ChoiceChips
          ariaLabel={vocab.deviceModelLabel}
          size="sm"
          value={device.deviceKey}
          onChange={(k) => {
            onSelectDevice(k);
            setPickerOpen(false);
          }}
          options={devices.map((d) => ({ value: d.deviceKey, label: cleanDeviceDisplayName(d.name) }))}
        />
      </Stack>
    </Popover>
  );
}
