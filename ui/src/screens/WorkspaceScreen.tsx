import { Command, FolderPlus, Globe, Layers, Moon, Redo2, RefreshCw, Sun, Undo2 } from "lucide-react";
import { useState } from "react";
import type { DeviceSnapshot, LayerName } from "../acl/transport";
import { BrandColorPicker } from "../design-system/BrandColorPicker";
import type { ThemeMode } from "../design-system/theme";
import {
  AppShell,
  Badge,
  Button,
  ChoiceChips,
  CommandPalette,
  Inline,
  Popover,
  SegmentedControl,
  Stack,
  SurfaceCard,
  TextInput,
  type PaletteItem,
} from "../design-system/primitives";
import { ActionInspector } from "../entities/button/ActionInspector";
import { MouseDiagram } from "../entities/button/MouseDiagram";
import { ThumbMatrix } from "../entities/button/ThumbMatrix";
import { DeviceChip, DeviceHeader } from "../entities/device/DevicePresenter";
import { PerformanceStrip } from "../entities/performance/PerformanceStrip";
import type { Locale, Vocab } from "../i18n/vocab";

export function WorkspaceScreen({
  snapshot,
  errorMsg,
  locale,
  theme,
  brandHex,
  vocab,
  onSetLocale,
  onSetTheme,
  onSetBrandHex,
  onRescan,
  onSetButton,
  onResetButton,
  onRestoreAll,
  onSaveOnboard,
  onSelectDpiStage,
  onSelectPolling,
  onSelectSleep,
  onSelectProfile,
  onCreateProfile,
  onCreateMacro,
  onUndo,
  onRedo,
}: {
  snapshot: DeviceSnapshot | null;
  errorMsg: string | null;
  locale: Locale;
  theme: ThemeMode;
  brandHex: string;
  vocab: Vocab;
  onSetLocale: (l: Locale) => void;
  onSetTheme: (t: ThemeMode) => void;
  onSetBrandHex: (hex: string) => void;
  onRescan: () => void;
  onSetButton: (button: string, layer: LayerName, action: string) => void;
  onResetButton: (button: string, layer: LayerName) => void;
  onRestoreAll: () => void;
  onSaveOnboard: () => void;
  onSelectDpiStage: (stage: number) => void;
  onSelectPolling: (hz: number) => void;
  onSelectSleep: (minutes: number) => void;
  onSelectProfile: (name: string) => void;
  onCreateProfile: (name: string) => void;
  onCreateMacro: (name: string, steps: string) => void;
  onUndo: () => void;
  onRedo: () => void;
}) {
  const [layer, setLayer] = useState<LayerName>("normal");
  const [selectedButton, setSelectedButton] = useState<string>("grid-5");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [newProfileName, setNewProfileName] = useState("");
  const [profilePopoverOpen, setProfilePopoverOpen] = useState(false);

  const bindings = snapshot ? (layer === "normal" ? snapshot.buttonsNormal : snapshot.buttonsHyperShift) : {};
  const currentAction = bindings[selectedButton] ?? "disabled";

  const paletteItems: PaletteItem[] = snapshot
    ? [
        ...snapshot.dpi.stages.map((d, idx) => ({
          id: `dpi-${idx + 1}`,
          label: `${d} DPI`,
          group: vocab.dpiStages,
          onSelect: () => onSelectDpiStage(idx + 1),
        })),
        ...snapshot.profiles.map((pr) => ({
          id: `prof-${pr.name}`,
          label: pr.name,
          group: vocab.profiles,
          onSelect: () => onSelectProfile(pr.name),
        })),
        {
          id: "layer-toggle",
          label: layer === "normal" ? vocab.layerHyperShift : vocab.layerNormal,
          group: vocab.appName,
          onSelect: () => setLayer((l) => (l === "normal" ? "hypershift" : "normal")),
        },
        {
          id: "save-onboard",
          label: vocab.saveToMouse,
          group: vocab.appName,
          onSelect: onSaveOnboard,
        },
      ]
    : [];

  const headerContent = (
    <div className="flex flex-wrap items-center justify-between gap-2 w-full">
      <Inline gap="2" wrap={true}>
        <span className="text-base font-bold tracking-tight">{vocab.appName}</span>
        {snapshot ? <DeviceChip device={snapshot} vocab={vocab} locale={locale} /> : null}
      </Inline>

      <Inline gap="2" wrap={true}>
        {snapshot ? (
          <>
            <ChoiceChips
              ariaLabel={vocab.profiles}
              size="sm"
              value={snapshot.activeProfile}
              onChange={onSelectProfile}
              options={snapshot.profiles.map((p) => ({
                value: p.name,
                label: p.name,
              }))}
            />
            <Popover
              open={profilePopoverOpen}
              onOpenChange={setProfilePopoverOpen}
              trigger={
                <Button variant="secondary" size="sm" aria-label={vocab.newProfile}>
                  <FolderPlus size={15} strokeWidth={2} />
                  <span>{vocab.newProfile}</span>
                </Button>
              }
            >
              <Stack gap="2">
                <span className="text-xs font-medium text-[var(--fg-muted)]">{vocab.newProfile}</span>
                <TextInput
                  value={newProfileName}
                  onChange={(e) => setNewProfileName(e.target.value)}
                  placeholder={vocab.profileNamePlaceholder}
                  aria-label={vocab.profileNamePlaceholder}
                />
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!newProfileName.trim()}
                  onClick={() => {
                    onCreateProfile(newProfileName);
                    setNewProfileName("");
                    setProfilePopoverOpen(false);
                  }}
                >
                  {vocab.create}
                </Button>
              </Stack>
            </Popover>
          </>
        ) : null}

        <Button variant="secondary" size="sm" disabled={!snapshot?.canUndo} onClick={onUndo} aria-label={vocab.undo}>
          <Undo2 size={15} strokeWidth={2} />
          <span>{vocab.undo}</span>
        </Button>
        <Button variant="secondary" size="sm" disabled={!snapshot?.canRedo} onClick={onRedo} aria-label={vocab.redo}>
          <Redo2 size={15} strokeWidth={2} />
          <span>{vocab.redo}</span>
        </Button>

        <Button variant="secondary" size="sm" onClick={() => setPaletteOpen(true)} aria-label={vocab.commandPalette}>
          <Command size={15} strokeWidth={2} />
          <span>{vocab.commandPalette}</span>
        </Button>

        <BrandColorPicker value={brandHex} label={vocab.brandColor} locale={locale} onChange={onSetBrandHex} />

        <Button
          variant="secondary"
          size="sm"
          onClick={() => onSetTheme(theme === "dark" ? "light" : "dark")}
          aria-label={theme === "dark" ? vocab.themeLight : vocab.themeDark}
        >
          {theme === "dark" ? <Sun size={15} strokeWidth={2} /> : <Moon size={15} strokeWidth={2} />}
          <span>{theme === "dark" ? vocab.themeLight : vocab.themeDark}</span>
        </Button>

        <Button
          variant="secondary"
          size="sm"
          onClick={() => onSetLocale(locale === "ar" ? "en" : "ar")}
          aria-label={locale === "ar" ? "English" : "العربية"}
        >
          <Globe size={15} strokeWidth={2} />
          <span>{locale === "ar" ? "EN" : "عربي"}</span>
        </Button>
      </Inline>
    </div>
  );

  const footerContent = (
    <Inline gap="4" justify="between" wrap={true}>
      <span className="tabular-nums">
        {snapshot
          ? `${snapshot.name} (${snapshot.pidHex}) • ${vocab.firmwareLabel}: ${snapshot.firmware} • ${vocab.serialLabel}: ${snapshot.serial || "—"}`
          : vocab.disconnected}
      </span>
      <span className="tabular-nums">Grip • Rust + Tauri</span>
    </Inline>
  );

  return (
    <AppShell header={headerContent} footer={footerContent}>
      <Stack gap="4">
        {errorMsg ? (
          <SurfaceCard>
            <Badge tone="danger" showDot={true}>
              {errorMsg}
            </Badge>
          </SurfaceCard>
        ) : null}

        {!snapshot ? (
          <SurfaceCard primaryContent={true}>
            <Stack gap="4" className="items-start">
              <h1 className="text-lg font-bold">{vocab.noDevicesTitle}</h1>
              <p className="text-sm text-[var(--fg-muted)]">{vocab.noDevicesBody}</p>
              <Button variant="primary" size="md" onClick={onRescan}>
                <RefreshCw size={16} strokeWidth={2} />
                <span>{vocab.rescan}</span>
              </Button>
            </Stack>
          </SurfaceCard>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            {/* Visual Hardware Stage + 4x3 Matrix + Performance */}
            <SurfaceCard primaryContent={true} className="lg:col-span-8 min-w-0">
              <Stack gap="4">
                <Inline gap="2" justify="between" wrap={true}>
                  <DeviceHeader device={snapshot} vocab={vocab} />
                  <SegmentedControl
                    ariaLabel={vocab.layerNormal}
                    size="sm"
                    value={layer}
                    onChange={setLayer}
                    options={[
                      { value: "normal", label: vocab.layerNormal, icon: <Layers size={14} strokeWidth={2} /> },
                      { value: "hypershift", label: vocab.layerHyperShift },
                    ]}
                  />
                </Inline>

                <MouseDiagram
                  selectedButton={selectedButton}
                  bindings={bindings}
                  hasSideGrid12={snapshot.capabilities.hasSideGrid12}
                  vocab={vocab}
                  onSelectButton={setSelectedButton}
                />

                {snapshot.capabilities.hasButtons ? (
                  <ThumbMatrix
                    selectedButton={selectedButton}
                    bindings={bindings}
                    hasSideGrid12={snapshot.capabilities.hasSideGrid12}
                    locale={locale}
                    vocab={vocab}
                    onSelectButton={setSelectedButton}
                  />
                ) : null}

                <PerformanceStrip
                  capabilities={snapshot.capabilities}
                  dpi={snapshot.dpi}
                  pollingHz={snapshot.pollingHz}
                  sleepMinutes={snapshot.sleepMinutes}
                  locale={locale}
                  vocab={vocab}
                  onSelectDpiStage={onSelectDpiStage}
                  onSelectPolling={onSelectPolling}
                  onSelectSleep={onSelectSleep}
                />
              </Stack>
            </SurfaceCard>

            {/* Action Inspector */}
            <SurfaceCard className="lg:col-span-4 min-w-0">
              <ActionInspector
                selectedButton={selectedButton}
                layer={layer}
                currentAction={currentAction}
                macros={snapshot.macros}
                hasMacros={snapshot.capabilities.hasMacros}
                onboardSavedAt={snapshot.onboardSavedAt}
                locale={locale}
                vocab={vocab}
                onAssign={(action) => onSetButton(selectedButton, layer, action)}
                onResetButton={() => onResetButton(selectedButton, layer)}
                onRestoreAll={onRestoreAll}
                onSaveOnboard={onSaveOnboard}
                onCreateMacro={onCreateMacro}
              />
            </SurfaceCard>
          </div>
        )}
      </Stack>

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        title={vocab.commandPalette}
        placeholder={vocab.searchPlaceholder}
        closeLabel={vocab.cancel}
        items={paletteItems}
      />
    </AppShell>
  );
}
