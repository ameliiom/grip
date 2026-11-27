import { Layers, RotateCcw, Save } from "lucide-react";
import { useState } from "react";
import type { DeviceSnapshot, LayerName } from "../acl/transport";
import {
  Badge,
  Button,
  ConfirmButton,
  HelpTip,
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
  const [view, setView] = useState<BlueprintView>(device.capabilities.hasSideGrid12 ? "side" : "top");

  const fallbackEntry = device.buttons.find((b) => b.id === "grid-5") ?? device.buttons[0];
  const activeEntry = device.buttons.find((b) => b.id === selectedButton) ?? fallbackEntry;
  const effectiveSelected = activeEntry?.id ?? selectedButton;

  const hyperActivator = device.buttons.find(
    (b) => b.normal === "hypershift" || b.hypershift === "hypershift",
  );
  const activatorLabel = hyperActivator ? (BUTTON_LABELS[locale][hyperActivator.id] ?? hyperActivator.id) : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 min-h-0 items-stretch">
      {/* Model-accurate Visual Hardware Blueprint + Sticky On-Board Bar */}
      <SurfaceCard primaryContent={true} stableFrame={true} className="lg:col-span-8 min-w-0 h-full flex flex-col justify-between">
        <Stack gap="4" className="flex-1 min-h-0 justify-between">
          <div className="min-h-[40px] flex flex-wrap items-center justify-between gap-2">
            <Inline gap="1" wrap={false}>
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
              <HelpTip {...vocab.help.buttonsLayer} side="bottom" />
            </Inline>

            <div className="flex flex-wrap items-center gap-2">
              {activatorLabel ? (
                <div
                  className={`hidden sm:inline-flex ${
                    layer === "hypershift" ? "" : "invisible pointer-events-none select-none"
                  }`}
                  aria-hidden={layer !== "hypershift" || undefined}
                >
                  <Badge tone="active">
                    {vocab.layerSecondaryHeldBy}: {activatorLabel}
                  </Badge>
                </div>
              ) : null}

              <SegmentedControl
                ariaLabel={vocab.sideBodyLabel}
                size="sm"
                value={view}
                onChange={setView}
                options={[
                  { value: "side", label: vocab.viewSide },
                  { value: "top", label: vocab.viewTop },
                ]}
              />
            </div>
          </div>

          <HardwareBlueprint
            selectedButton={effectiveSelected}
            kind={device.kind}
            capabilities={device.capabilities}
            buttons={device.buttons}
            layer={layer}
            view={view}
            macros={device.macros}
            locale={locale}
            vocab={vocab}
            onSelectButton={onSelectButton}
          />

          {/* Bottom On-Board Memory Action Bar */}
          <div className="pt-3 border-t border-[var(--border)] flex flex-wrap items-center justify-between gap-3">
            <Inline gap="2" wrap={true}>
              <ConfirmButton
                variant="ghost"
                size="md"
                icon={<RotateCcw size={15} strokeWidth={2} />}
                label={vocab.restoreAllButtons}
                confirmLabel={vocab.confirmRestore}
                title={vocab.confirmRestoreAllTitle}
                onConfirm={onRestoreAll}
              />

              {device.onboard ? (
                <ConfirmButton
                  variant="ghost"
                  size="md"
                  label={vocab.restoreMouseOriginal}
                  confirmLabel={vocab.confirmRestore}
                  title={vocab.confirmRestoreFactoryTitle}
                  onConfirm={onPutBackOnboard}
                />
              ) : null}

              {device.onboard ? (
                <Badge tone={device.onboard.changed ? "warn" : "ok"} showDot={true}>
                  {device.onboard.changed ? vocab.onboardPendingChanges : vocab.savedOnboardOk}
                </Badge>
              ) : null}
            </Inline>

            <Inline gap="2" wrap={false}>
              <HelpTip {...vocab.help.buttonsSaveOnboard} />
              <Button variant="primary" size="md" onClick={onSaveOnboard}>
                <Save size={16} strokeWidth={2} />
                <span>{vocab.saveToMouse}</span>
              </Button>
            </Inline>
          </div>
        </Stack>
      </SurfaceCard>

      {/* Single Contextual Action Inspector */}
      <SurfaceCard stableFrame={true} className="lg:col-span-4 min-w-0 h-full">
        {activeEntry ? (
          <ActionInspector
            entry={activeEntry}
            layer={layer}
            macros={device.macros}
            hasMacros={device.capabilities.hasMacros}
            hasScroll={device.capabilities.hasScroll}
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
