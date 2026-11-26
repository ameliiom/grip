import {
  ChevronDown,
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
  Popover,
  SegmentedControl,
  Stack,
  SurfaceCard,
  type PaletteItem,
} from "../design-system/primitives";
import { DeviceIdentityBar } from "../entities/device/DevicePresenter";
import { GripMark } from "../entities/brand/GripMark";
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
  statusToast,
  onClearToast,
  firmwareResult,
  section,
  paletteOpen,
  onPaletteOpenChange,
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
  statusToast: string | null;
  onClearToast: () => void;
  firmwareResult: FirmwareCheckResult | null;
  section: NavSection;
  paletteOpen: boolean;
  onPaletteOpenChange: (open: boolean) => void;
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
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const device = workspace?.activeDevice ?? null;
  const settings = workspace?.settings;

  const primaryNav: { id: NavSection; label: string; shortLabel: string; icon: ReactNode }[] = [
    { id: "buttons", label: vocab.navButtons, shortLabel: vocab.navButtonsShort, icon: <MousePointerClick size={15} strokeWidth={2} /> },
    { id: "performance", label: vocab.navPerformance, shortLabel: vocab.navPerformanceShort, icon: <Sliders size={15} strokeWidth={2} /> },
    { id: "profiles", label: vocab.navProfiles, shortLabel: vocab.navProfilesShort, icon: <Gamepad2 size={15} strokeWidth={2} /> },
    ...(device?.capabilities.hasMacros
      ? [{ id: "macros" as const, label: vocab.navMacros, shortLabel: vocab.navMacros, icon: <Sparkles size={15} strokeWidth={2} /> }]
      : []),
    ...(device?.capabilities.hasLighting
      ? [{ id: "lighting" as const, label: vocab.navLighting, shortLabel: vocab.navLighting, icon: <Sun size={15} strokeWidth={2} /> }]
      : []),
  ];

  // Scope-fitted shell derived dynamically: >=5 primary modules uses sidebar, 2-4 focused studio views use top bar
  const useSidebar = primaryNav.length >= 5;

  const paletteItems: PaletteItem[] = [
    ...primaryNav.map((item) => ({
      id: `nav-${item.id}`,
      label: item.label,
      group: vocab.appName,
      onSelect: () => onSelectSection(item.id),
    })),
    {
      id: "nav-settings",
      label: vocab.navSettings,
      group: vocab.appName,
      onSelect: () => onSelectSection("settings"),
    },
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

  const sidebarContent = useSidebar ? (
    <div className="flex flex-col justify-between h-full gap-4">
      <Stack gap="4">
        <DeviceIdentityBar
          appName={vocab.appName}
          device={device}
          devices={workspace?.devices ?? []}
          vocab={vocab}
          onSelectDevice={onSelectDevice}
        />
        <nav className="flex flex-col gap-1.5" aria-label={vocab.appName}>
          {[
            ...primaryNav,
            { id: "settings" as const, label: vocab.navSettings, shortLabel: vocab.navSettingsShort, icon: <Settings size={15} strokeWidth={2} /> },
          ].map((item) => {
            const active = section === item.id;
            return (
              <Button
                key={item.id}
                variant="ghost"
                size="md"
                fullWidth={true}
                active={active}
                onClick={() => onSelectSection(item.id)}
              >
                <span className="flex items-center justify-between gap-2 w-full">
                  <span className="flex items-center gap-2 min-w-0">
                    {item.icon}
                    <span className="truncate">{item.label}</span>
                  </span>
                  {active ? <span className="w-1 h-5 rounded-full bg-[var(--brand)] shrink-0" /> : null}
                </span>
              </Button>
            );
          })}
        </nav>
      </Stack>
    </div>
  ) : undefined;

  const headerContent = (
    <div
      className={
        !useSidebar
          ? "flex flex-wrap items-center justify-between gap-2 w-full md:grid md:grid-cols-[1fr_auto_1fr] md:items-center"
          : "flex flex-wrap items-center justify-between gap-2 w-full"
      }
    >
      <div className={!useSidebar ? "justify-self-start min-w-0" : "min-w-0"}>
        {!useSidebar ? (
          <DeviceIdentityBar
            appName={vocab.appName}
            device={device}
            devices={workspace?.devices ?? []}
            vocab={vocab}
            onSelectDevice={onSelectDevice}
          />
        ) : (
          <span className="text-base font-bold">
            {([...primaryNav, { id: "settings" as const, label: vocab.navSettings }].find((n) => n.id === section)?.label) ?? vocab.appName}
          </span>
        )}
      </div>

      {!useSidebar ? (
        <nav
          data-shift-probe="nav"
          className="hidden md:flex items-center justify-self-center"
          aria-label={vocab.appName}
        >
          <SegmentedControl
            ariaLabel={vocab.appName}
            size="sm"
            value={section === "settings" ? "" : section}
            onChange={(next) => {
              if (next) onSelectSection(next as NavSection);
            }}
            options={primaryNav.map((item) => ({
              value: item.id,
              label: item.shortLabel,
              icon: item.icon,
            }))}
          />
        </nav>
      ) : null}

      <div className={`flex items-center gap-1.5 shrink-0 ${!useSidebar ? "justify-self-end" : ""}`}>
        {device ? (
          <div
            className={section === "profiles" ? "invisible pointer-events-none select-none" : ""}
            aria-hidden={section === "profiles" || undefined}
          >
            <Popover
              open={profileMenuOpen && section !== "profiles"}
              onOpenChange={(o) => {
                if (section !== "profiles") setProfileMenuOpen(o);
              }}
              trigger={
                <Button
                  variant="secondary"
                  size="sm"
                  tabIndex={section === "profiles" ? -1 : undefined}
                  aria-label={vocab.profilesTitle}
                >
                  <span className="truncate max-w-[100px]">{device.activeProfile}</span>
                  <ChevronDown size={14} strokeWidth={2} />
                </Button>
              }
            >
              <Stack gap="2">
                <span className="text-xs font-semibold text-[var(--fg-muted)]">{vocab.profilesTitle}</span>
                <ChoiceChips
                  ariaLabel={vocab.profilesTitle}
                  size="sm"
                  value={device.activeProfile}
                  onChange={(name) => {
                    onSelectProfile(name);
                    setProfileMenuOpen(false);
                  }}
                  options={device.profiles.map((p) => ({
                    value: p.name,
                    label: p.name,
                  }))}
                />
              </Stack>
            </Popover>
          </div>
        ) : null}

        <Button
          variant="ghost"
          size="sm"
          iconOnly={true}
          disabled={!device?.canUndo}
          onClick={onUndo}
          aria-label={vocab.undo}
          title={vocab.undo}
        >
          <Undo2 size={16} strokeWidth={2} />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          iconOnly={true}
          disabled={!device?.canRedo}
          onClick={onRedo}
          aria-label={vocab.redo}
          title={vocab.redo}
        >
          <Redo2 size={16} strokeWidth={2} />
        </Button>
        <span className="hidden md:inline-flex">
          <Button
            variant="ghost"
            size="sm"
            iconOnly={true}
            onClick={() => onPaletteOpenChange(true)}
            aria-label={vocab.quickCommands}
            title={vocab.quickCommands}
          >
            <Command size={16} strokeWidth={2} />
          </Button>
        </span>
        {!useSidebar ? (
          <span className="hidden md:inline-flex">
            <Button
              variant="ghost"
              size="sm"
              iconOnly={true}
              active={section === "settings"}
              onClick={() => onSelectSection("settings")}
              aria-label={vocab.navSettings}
              title={vocab.navSettings}
            >
              <Settings size={16} strokeWidth={2} />
            </Button>
          </span>
        ) : null}
      </div>
    </div>
  );

  const mobileNavItems = [
    ...primaryNav.slice(0, 3),
    { id: "settings" as const, label: vocab.navSettings, shortLabel: vocab.navSettingsShort, icon: <Settings size={15} strokeWidth={2} /> },
  ];

  const mobileNavContent = (
    <nav className="grid grid-cols-4 gap-1 w-full" aria-label={vocab.appName}>
      {mobileNavItems.map((item) => (
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

  return (
    <AppShell sidebar={sidebarContent} header={headerContent} mobileNav={mobileNavContent}>
      {errorMsg ? (
        <SurfaceCard>
          <Badge tone="danger" showDot={true}>
            {errorMsg}
          </Badge>
        </SurfaceCard>
      ) : null}

      {!workspace ? (
        <SurfaceCard primaryContent={true} compactPage={true}>
          <Stack gap="4" className="items-center justify-center py-12 text-center">
            <GripMark size={40} />
            <h1 className="text-base font-bold">{vocab.loadingTitle}</h1>
            <p className="text-xs text-[var(--fg-muted)]">{vocab.loadingBody}</p>
          </Stack>
        </SurfaceCard>
      ) : !device && section !== "settings" ? (
        <SurfaceCard primaryContent={true} compactPage={true}>
          <Stack gap="4" className="items-start">
            <h1 className="text-lg font-bold">{vocab.noDevicesTitle}</h1>
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

      {device && section === "profiles" && workspace && settings ? (
        <ProfilesView
          device={device}
          runningApps={workspace.runningApps}
          locale={settings.locale}
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

      {statusToast ? (
        <div
          key={statusToast}
          onAnimationEnd={onClearToast}
          className="fixed bottom-4 end-4 z-50 grip-toast-anim pointer-events-none"
        >
          <Badge tone="ok" showDot={true}>
            {statusToast}
          </Badge>
        </div>
      ) : null}

      <CommandPalette
        open={paletteOpen}
        onOpenChange={onPaletteOpenChange}
        title={vocab.quickCommands}
        placeholder={vocab.searchPlaceholder}
        closeLabel={vocab.cancel}
        items={paletteItems}
      />
    </AppShell>
  );
}
