import {
  Command,
  Gamepad2,
  MousePointerClick,
  Redo2,
  RefreshCw,
  Settings,
  Sliders,
  Sparkles,
  Sun,
  Undo2,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import type { AppSettings, FirmwareCheckResult, LayerName, WorkspaceSnapshot } from "../acl/transport";
import {
  AppShell,
  Badge,
  Button,
  ChoiceChips,
  CommandPalette,
  Inline,
  Stack,
  SurfaceCard,
  type PaletteItem,
} from "../design-system/primitives";
import { DeviceSidebarCard, DeviceStatusChip } from "../entities/device/DevicePresenter";
import type { Vocab } from "../i18n/vocab";
import { ButtonsView } from "./ButtonsView";
import { LightingView } from "./LightingView";
import { MacrosView } from "./MacrosView";
import { PerformanceView } from "./PerformanceView";
import { ProfilesView } from "./ProfilesView";
import { SettingsView } from "./SettingsView";

export type NavSection = "buttons" | "performance" | "profiles" | "macros" | "lighting" | "settings";

export function WorkspaceShell({
  workspace,
  errorMsg,
  firmwareResult,
  section,
  vocab,
  onSelectSection,
  onSelectDevice,
  onRescan,
  onSetButton,
  onResetButton,
  onRestoreAll,
  onSaveOnboard,
  onPutBackOnboard,
  onSelectDpiStage,
  onCommitDpiStages,
  onSelectPolling,
  onSetSleep,
  onSetScroll,
  onSelectProfile,
  onCreateProfile,
  onRenameProfile,
  onDeleteProfile,
  onSetProfileApps,
  onExportProfiles,
  onImportProfiles,
  onCreateMacro,
  onDeleteMacro,
  onSetLightingControl,
  onSetLightingColor,
  onSetLightingBrightness,
  onSetLightingEffect,
  onSetLightingOff,
  onSyncLighting,
  onUpdateSettings,
  onCheckFirmware,
  onCopyReport,
  onOpenFolder,
  onUndo,
  onRedo,
}: {
  workspace: WorkspaceSnapshot | null;
  errorMsg: string | null;
  firmwareResult: FirmwareCheckResult | null;
  section: NavSection;
  vocab: Vocab;
  onSelectSection: (next: NavSection) => void;
  onSelectDevice: (deviceKey: string) => void;
  onRescan: () => void;
  onSetButton: (button: string, layer: LayerName, action: string) => void;
  onResetButton: (button: string, layer: LayerName) => void;
  onRestoreAll: () => void;
  onSaveOnboard: () => void;
  onPutBackOnboard: () => void;
  onSelectDpiStage: (stage: number) => void;
  onCommitDpiStages: (activeStage: number, stages: [number, number][]) => void;
  onSelectPolling: (hz: number) => void;
  onSetSleep: (minutes?: number, autoSleep?: boolean) => void;
  onSetScroll: (patch: { mode?: string; disabled?: string; acceleration?: string; smartReel?: string }) => void;
  onSelectProfile: (name: string) => void;
  onCreateProfile: (name: string) => void;
  onRenameProfile: (oldName: string, newName: string) => void;
  onDeleteProfile: (name: string) => void;
  onSetProfileApps: (name: string, apps: string[]) => void;
  onExportProfiles: () => Promise<string | null>;
  onImportProfiles: (json: string) => void;
  onCreateMacro: (name: string, steps: string) => void;
  onDeleteMacro: (macroId: number) => void;
  onSetLightingControl: (enabled: boolean) => void;
  onSetLightingColor: (zone: string, color: string) => void;
  onSetLightingBrightness: (zone: string, percent: number) => void;
  onSetLightingEffect: (zone: string, effect: string) => void;
  onSetLightingOff: (zone: string) => void;
  onSyncLighting: (color?: string) => void;
  onUpdateSettings: (settings: AppSettings) => void;
  onCheckFirmware: () => void;
  onCopyReport: () => Promise<void>;
  onOpenFolder: () => void;
  onUndo: () => void;
  onRedo: () => void;
}) {
  const [selectedButton, setSelectedButton] = useState("grid-5");
  const [layer, setLayer] = useState<LayerName>("normal");
  const [paletteOpen, setPaletteOpen] = useState(false);

  const device = workspace?.activeDevice ?? null;
  const settings = workspace?.settings;

  const navItems: { id: NavSection; label: string; shortLabel: string; icon: ReactNode }[] = [
    { id: "buttons", label: vocab.navButtons, shortLabel: vocab.navButtonsShort, icon: <MousePointerClick size={16} strokeWidth={2} /> },
    { id: "performance", label: vocab.navPerformance, shortLabel: vocab.navPerformanceShort, icon: <Sliders size={16} strokeWidth={2} /> },
    { id: "profiles", label: vocab.navProfiles, shortLabel: vocab.navProfilesShort, icon: <Gamepad2 size={16} strokeWidth={2} /> },
    ...(device?.capabilities.hasMacros
      ? [{ id: "macros" as const, label: vocab.navMacros, shortLabel: vocab.navMacros, icon: <Sparkles size={16} strokeWidth={2} /> }]
      : []),
    ...(device?.capabilities.hasLighting
      ? [{ id: "lighting" as const, label: vocab.navLighting, shortLabel: vocab.navLighting, icon: <Sun size={16} strokeWidth={2} /> }]
      : []),
    { id: "settings", label: vocab.navSettings, shortLabel: vocab.navSettingsShort, icon: <Settings size={16} strokeWidth={2} /> },
  ];

  const activeNav = navItems.find((n) => n.id === section) ?? navItems[0];
  const pageTitle = activeNav?.label ?? vocab.appName;

  const paletteItems: PaletteItem[] = [
    ...navItems.map((item) => ({
      id: `nav-${item.id}`,
      label: item.label,
      group: vocab.appName,
      onSelect: () => onSelectSection(item.id),
    })),
    ...(device
      ? [
          ...device.dpi.stages.map(([x], idx) => ({
            id: `dpi-${idx + 1}`,
            label: `${x} ${vocab.speedUnit}`,
            group: vocab.speedStagesTitle,
            onSelect: () => onSelectDpiStage(idx + 1),
          })),
          ...device.profiles.map((pr) => ({
            id: `prof-${pr.name}`,
            label: pr.name,
            group: vocab.profilesTitle,
            onSelect: () => onSelectProfile(pr.name),
          })),
          {
            id: "save-onboard",
            label: vocab.saveToMouse,
            group: vocab.navButtons,
            onSelect: onSaveOnboard,
          },
        ]
      : []),
  ];

  const sidebarContent = (
    <div className="flex flex-col justify-between h-full gap-4">
      <Stack gap="4">
        <Inline gap="2" justify="between" wrap={false}>
          <span className="text-lg font-bold tracking-tight">{vocab.appName}</span>
          <Badge tone={device ? "ok" : "neutral"} showDot={true}>
            {device ? vocab.connected : vocab.disconnected}
          </Badge>
        </Inline>

        {device ? <DeviceSidebarCard device={device} vocab={vocab} /> : null}

        {workspace && workspace.devices.length > 1 && device ? (
          <ChoiceChips
            ariaLabel={vocab.deviceModelLabel}
            size="sm"
            value={device.deviceKey}
            onChange={onSelectDevice}
            options={workspace.devices.map((d) => ({
              value: d.deviceKey,
              label: d.name,
            }))}
          />
        ) : null}

        <nav className="flex flex-col gap-1.5" aria-label={vocab.appName}>
          {navItems.map((item) => (
            <Button
              key={item.id}
              variant="ghost"
              size="md"
              fullWidth={true}
              active={section === item.id}
              onClick={() => onSelectSection(item.id)}
            >
              <span className="flex items-center gap-2.5 w-full">
                {item.icon}
                <span>{item.label}</span>
              </span>
            </Button>
          ))}
        </nav>
      </Stack>

      {device ? (
        <Button variant="secondary" size="md" fullWidth={true} onClick={onSaveOnboard}>
          {vocab.saveToMouse}
        </Button>
      ) : null}
    </div>
  );

  const headerContent = (
    <div className="flex flex-wrap items-center justify-between gap-2 w-full">
      <Inline gap="2" wrap={true}>
        <h1 className="text-base font-bold">{pageTitle}</h1>
        {device ? <DeviceStatusChip device={device} vocab={vocab} /> : null}
        {device ? (
          <ChoiceChips
            ariaLabel={vocab.profilesTitle}
            size="sm"
            value={device.activeProfile}
            onChange={onSelectProfile}
            options={device.profiles.slice(0, 4).map((p) => ({
              value: p.name,
              label: p.name,
            }))}
          />
        ) : null}
      </Inline>

      <Inline gap="2" wrap={true}>
        <Button variant="secondary" size="sm" disabled={!device?.canUndo} onClick={onUndo} aria-label={vocab.undo}>
          <Undo2 size={15} strokeWidth={2} />
          <span>{vocab.undo}</span>
        </Button>
        <Button variant="secondary" size="sm" disabled={!device?.canRedo} onClick={onRedo} aria-label={vocab.redo}>
          <Redo2 size={15} strokeWidth={2} />
          <span>{vocab.redo}</span>
        </Button>
        <Button variant="secondary" size="sm" onClick={() => setPaletteOpen(true)} aria-label={vocab.quickCommands}>
          <Command size={15} strokeWidth={2} />
          <span>{vocab.quickCommands}</span>
        </Button>
      </Inline>
    </div>
  );

  const mobileNavContent = (
    <nav className="grid grid-cols-4 gap-1 w-full" aria-label={vocab.appName}>
      {navItems.slice(0, 4).map((item) => (
        <Button
          key={item.id}
          variant="ghost"
          size="sm"
          fullWidth={true}
          active={section === item.id}
          onClick={() => onSelectSection(item.id)}
          aria-label={item.label}
        >
          <span className="hidden sm:inline-flex shrink-0">{item.icon}</span>
          <span className="whitespace-nowrap truncate">{item.shortLabel}</span>
        </Button>
      ))}
    </nav>
  );

  const footerContent = (
    <div className="flex flex-wrap items-center justify-between gap-2 w-full">
      <span>{vocab.appName}</span>
      <span>{device ? device.name : vocab.disconnected}</span>
    </div>
  );

  return (
    <AppShell sidebar={sidebarContent} header={headerContent} mobileNav={mobileNavContent} footer={footerContent}>
      <Stack gap="4">
        {errorMsg ? (
          <SurfaceCard>
            <Badge tone="danger" showDot={true}>
              {errorMsg}
            </Badge>
          </SurfaceCard>
        ) : null}

        {!device && section !== "settings" ? (
          <SurfaceCard primaryContent={true}>
            <Stack gap="4" className="items-start">
              <h2 className="text-lg font-bold">{vocab.noDevicesTitle}</h2>
              <p className="text-sm text-[var(--fg-muted)]">{vocab.noDevicesBody}</p>
              <Button variant="primary" size="md" onClick={onRescan}>
                <RefreshCw size={16} strokeWidth={2} />
                <span>{vocab.rescan}</span>
              </Button>
            </Stack>
          </SurfaceCard>
        ) : null}

        {device && section === "buttons" && settings ? (
          <ButtonsView
            device={device}
            selectedButton={selectedButton}
            layer={layer}
            locale={settings.locale}
            vocab={vocab}
            onSelectButton={setSelectedButton}
            onChangeLayer={setLayer}
            onSetButton={onSetButton}
            onResetButton={onResetButton}
            onRestoreAll={onRestoreAll}
            onSaveOnboard={onSaveOnboard}
            onPutBackOnboard={onPutBackOnboard}
          />
        ) : null}

        {device && section === "performance" && settings ? (
          <PerformanceView
            device={device}
            locale={settings.locale}
            vocab={vocab}
            onSelectDpiStage={onSelectDpiStage}
            onCommitDpiStages={onCommitDpiStages}
            onSelectPolling={onSelectPolling}
            onSetSleep={onSetSleep}
            onSetScroll={onSetScroll}
          />
        ) : null}

        {device && section === "profiles" && workspace ? (
          <ProfilesView
            device={device}
            runningApps={workspace.runningApps}
            vocab={vocab}
            onSelectProfile={onSelectProfile}
            onCreateProfile={onCreateProfile}
            onRenameProfile={onRenameProfile}
            onDeleteProfile={onDeleteProfile}
            onSetProfileApps={onSetProfileApps}
            onExportProfiles={onExportProfiles}
            onImportProfiles={onImportProfiles}
          />
        ) : null}

        {device && section === "macros" && device.capabilities.hasMacros ? (
          <MacrosView
            device={device}
            vocab={vocab}
            onCreateMacro={onCreateMacro}
            onDeleteMacro={onDeleteMacro}
          />
        ) : null}

        {device && section === "lighting" && device.capabilities.hasLighting && settings ? (
          <LightingView
            device={device}
            locale={settings.locale}
            vocab={vocab}
            onSetLightingControl={onSetLightingControl}
            onSetColor={onSetLightingColor}
            onSetBrightness={onSetLightingBrightness}
            onSetEffect={onSetLightingEffect}
            onSetOff={onSetLightingOff}
            onSyncAll={onSyncLighting}
          />
        ) : null}

        {section === "settings" && settings ? (
          <SettingsView
            settings={settings}
            device={device}
            synapseRunning={workspace?.synapseRunning ?? []}
            firmwareResult={firmwareResult}
            vocab={vocab}
            onUpdateSettings={onUpdateSettings}
            onCheckFirmware={onCheckFirmware}
            onCopyReport={onCopyReport}
            onOpenFolder={onOpenFolder}
          />
        ) : null}
      </Stack>

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        title={vocab.quickCommands}
        placeholder={vocab.searchPlaceholder}
        closeLabel={vocab.cancel}
        items={paletteItems}
      />
    </AppShell>
  );
}
