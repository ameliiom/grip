import { Layers, RotateCcw, Save } from "lucide-react";
import { useState } from "react";
import type { DeviceSnapshot, LayerName } from "../acl/transport";
import {
  Badge,
  Button,
  Inline,
  SegmentedControl,
  Stack,
  SurfaceCard,
} from "../design-system/primitives";
import { ActionInspector } from "../entities/button/ActionInspector";
import { HardwareBlueprint, type BlueprintView } from "../entities/device/HardwareBlueprint";
import { BUTTON_LABELS, formatHumanAction, type Locale, type Vocab } from "../i18n/vocab";

export function ButtonsView({
  device,
  selectedButton,
  layer,
  locale,
  vocab,
  onSelectButton,
  onChangeLayer,
  onSetButton,
  onResetButton,
  onRestoreAll,
  onSaveOnboard,
  onPutBackOnboard,
}: {
  device: DeviceSnapshot;
  selectedButton: string;
  layer: LayerName;
  locale: Locale;
  vocab: Vocab;
  onSelectButton: (buttonId: string) => void;
  onChangeLayer: (layer: LayerName) => void;
  onSetButton: (button: string, layer: LayerName, action: string) => void;
  onResetButton: (button: string, layer: LayerName) => void;
  onRestoreAll: () => void;
  onSaveOnboard: () => void;
  onPutBackOnboard: () => void;
}) {
  const [view, setView] = useState<BlueprintView>("both");

  const fallbackEntry = device.buttons.find((b) => b.id === "grid-5") ?? device.buttons[0];
  const activeEntry = device.buttons.find((b) => b.id === selectedButton) ?? fallbackEntry;
  const effectiveSelected = activeEntry?.id ?? selectedButton;

  const hyperActivator = device.buttons.find(
    (b) => b.normal === "hypershift" || b.hypershift === "hypershift",
  );
  const activatorLabel = hyperActivator ? (BUTTON_LABELS[locale][hyperActivator.id] ?? hyperActivator.id) : null;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
      {/* Model-accurate Visual Hardware Blueprint + Sticky On-Board Bar */}
      <SurfaceCard primaryContent={true} className="xl:col-span-8 min-w-0">
        <Stack gap="4">
          <Inline gap="2" justify="between" wrap={true}>
            <SegmentedControl
              ariaLabel={vocab.layerPrimary}
              size="sm"
              value={layer}
              onChange={onChangeLayer}
              options={[
                { value: "normal", label: vocab.layerPrimary, icon: <Layers size={14} strokeWidth={2} /> },
                { value: "hypershift", label: vocab.layerSecondary },
              ]}
            />

            <Inline gap="2" wrap={true}>
              {layer === "hypershift" && activatorLabel ? (
                <Badge tone="active">
                  {vocab.layerSecondaryHeldBy}: {activatorLabel}
                </Badge>
              ) : null}

              <SegmentedControl
                ariaLabel={vocab.sideBodyLabel}
                size="sm"
                value={view}
                onChange={setView}
                options={[
                  { value: "side", label: vocab.viewSide },
                  { value: "top", label: vocab.viewTop },
                  { value: "both", label: vocab.viewBoth },
                ]}
              />
            </Inline>
          </Inline>

          <HardwareBlueprint
            selectedButton={effectiveSelected}
            buttons={device.buttons}
            layer={layer}
            view={view}
            hasSideGrid12={device.capabilities.hasSideGrid12}
            macros={device.macros}
            locale={locale}
            vocab={vocab}
            onSelectButton={onSelectButton}
          />

          {/* Bottom On-Board Memory Action Bar */}
          <div className="pt-3 border-t border-[var(--border)] flex flex-wrap items-center justify-between gap-3">
            <Inline gap="2" wrap={true}>
              <Button variant="ghost" size="md" onClick={onRestoreAll}>
                <RotateCcw size={15} strokeWidth={2} />
                <span>{vocab.restoreAllButtons}</span>
              </Button>
              {device.onboard ? (
                <Button variant="ghost" size="md" onClick={onPutBackOnboard}>
                  {vocab.restoreMouseOriginal}
                </Button>
              ) : null}
              {device.onboard ? (
                <Badge tone={device.onboard.changed ? "warn" : "ok"} showDot={true}>
                  {device.onboard.changed ? vocab.onboardPendingChanges : vocab.savedOnboardOk}
                </Badge>
              ) : null}
            </Inline>

            <Button variant="primary" size="md" onClick={onSaveOnboard}>
              <Save size={16} strokeWidth={2} />
              <span>{vocab.saveToMouse}</span>
            </Button>
          </div>
        </Stack>
      </SurfaceCard>

      {/* Single Contextual Action Inspector */}
      <SurfaceCard className="xl:col-span-4 min-w-0">
        {activeEntry ? (
          <ActionInspector
            entry={activeEntry}
            layer={layer}
            macros={device.macros}
            hasMacros={device.capabilities.hasMacros}
            dpiMin={device.capabilities.dpiMin}
            dpiMax={device.capabilities.dpiMax}
            dpiStep={device.capabilities.dpiStep}
            locale={locale}
            vocab={vocab}
            onAssign={(action) => onSetButton(activeEntry.id, layer, action)}
            onResetButton={() => onResetButton(activeEntry.id, layer)}
          />
        ) : (
          <Badge tone="neutral">{formatHumanAction("disabled", locale)}</Badge>
        )}
      </SurfaceCard>
    </div>
  );
}
