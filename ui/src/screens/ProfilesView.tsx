import { Check, Copy, Download, FolderPlus, Gamepad2, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { useState } from "react";
import type { DeviceSnapshot, RunningApp } from "../acl/transport";
import {
  Button,
  HelpTip,
  Inline,
  Popover,
  Stack,
  SurfaceCard,
  TextInput,
  TileButton,
} from "../design-system/primitives";
import { AppIcon } from "../entities/app/AppIcon";
import { formatFriendlyAppName, formatLinkedAppsCount, type Locale, type Vocab } from "../i18n/vocab";

export function ProfilesView({
  device,
  runningApps,
  locale,
  vocab,
  onSelectProfile,
  onCreateProfile,
  onRenameProfile,
  onDeleteProfile,
  onSetProfileApps,
  onExportProfiles,
  onImportProfiles,
}: {
  device: DeviceSnapshot;
  runningApps: readonly RunningApp[];
  locale: Locale;
  vocab: Vocab;
  onSelectProfile: (name: string) => void;
  onCreateProfile: (name: string) => void;
  onRenameProfile: (oldName: string, newName: string) => void;
  onDeleteProfile: (name: string) => void;
  onSetProfileApps: (name: string, apps: string[]) => void;
  onExportProfiles: () => Promise<string | null>;
  onImportProfiles: (json: string) => void;
}) {
  const [newName, setNewName] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState(device.activeProfile);
  const [customApp, setCustomApp] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [exportedNote, setExportedNote] = useState(false);

  const activeProfile =
    device.profiles.find((p) => p.name === device.activeProfile) ?? device.profiles[0];
  const assignedApps = activeProfile?.apps ?? [];

  const runningByExe = new Map<string, RunningApp>();
  for (const app of runningApps) {
    runningByExe.set(app.exe.toLowerCase(), app);
  }

  // Merge live running apps + any manually assigned custom apps into ONE unified interactive grid
  const unifiedApps: RunningApp[] = [...runningApps];
  for (const exe of assignedApps) {
    if (!runningByExe.has(exe.toLowerCase())) {
      unifiedApps.push({ exe, displayName: formatFriendlyAppName(exe), iconDataUrl: null });
    }
  }

  const toggleApp = (exe: string) => {
    if (!activeProfile) return;
    const exists = assignedApps.includes(exe);
    const next = exists ? assignedApps.filter((a) => a !== exe) : [...assignedApps, exe];
    onSetProfileApps(activeProfile.name, next);
  };

  const addCustomApp = () => {
    const clean = customApp.trim();
    if (!clean || !activeProfile) return;
    const next = assignedApps.includes(clean) ? assignedApps : [...assignedApps, clean];
    onSetProfileApps(activeProfile.name, next);
    setCustomApp("");
  };

  const handleExport = async () => {
    const text = await onExportProfiles();
    if (text && navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      setExportedNote(true);
    }
  };

  const duplicateActive = () => {
    if (!activeProfile) return;
    const base = `${activeProfile.name} (${locale === "ar" ? "نسخة" : "Copy"})`;
    let candidate = base;
    let idx = 2;
    while (device.profiles.some((p) => p.name === candidate)) {
      candidate = `${base} ${idx}`;
      idx += 1;
    }
    onCreateProfile(candidate);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 min-h-0 items-stretch">
      {/* Profile Master List & Actions */}
      <SurfaceCard primaryContent={true} stableFrame={true} className="lg:col-span-5 min-w-0 h-full flex flex-col justify-between">
        <Stack gap="4" className="flex-1 justify-between">
          <Stack gap="4">
            <Inline gap="2" justify="between" wrap={true}>
              <Inline gap="2" wrap={false}>
                <Gamepad2 size={18} strokeWidth={2} />
                <h2 className="text-base font-bold">{vocab.profilesTitle}</h2>
                <HelpTip {...vocab.help.profilesList} side="bottom" />
              </Inline>

              <Popover
                open={createOpen}
                onOpenChange={setCreateOpen}
                trigger={
                  <Button variant="secondary" size="sm">
                    <FolderPlus size={15} strokeWidth={2} />
                    <span>{vocab.newProfile}</span>
                  </Button>
                }
              >
                <Stack gap="2">
                  <span className="text-xs font-medium text-[var(--fg-muted)]">{vocab.newProfile}</span>
                  <TextInput
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder={vocab.profileNamePlaceholder}
                    aria-label={vocab.profileNamePlaceholder}
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={!newName.trim()}
                    onClick={() => {
                      onCreateProfile(newName);
                      setNewName("");
                      setCreateOpen(false);
                    }}
                  >
                    {vocab.create}
                  </Button>
                </Stack>
              </Popover>
            </Inline>

            <Stack gap="2">
              {device.profiles.map((p) => {
                const isActive = p.name === device.activeProfile;
                return (
                  <div key={p.name} className="flex items-center gap-1.5 w-full">
                    <div className="flex-1 min-w-0">
                      <TileButton active={isActive} onClick={() => onSelectProfile(p.name)} ariaLabel={p.name}>
                        <span className="flex items-center justify-between gap-2 w-full">
                          <span className="text-sm font-medium truncate">{p.name}</span>
                          <span className="inline-flex items-center gap-1.5 shrink-0">
                            {p.apps.slice(0, 3).map((exe) => {
                              const match = runningByExe.get(exe.toLowerCase());
                              return (
                                <AppIcon
                                  key={exe}
                                  name={match?.displayName ?? formatFriendlyAppName(exe)}
                                  iconDataUrl={match?.iconDataUrl}
                                  size="sm"
                                />
                              );
                            })}
                            <span className="text-xs opacity-80 tabular-nums">
                              {formatLinkedAppsCount(p.apps.length, locale)}
                            </span>
                          </span>
                        </span>
                      </TileButton>
                    </div>
                    {device.profiles.length > 1 ? (
                      <div
                        className={isActive ? "invisible pointer-events-none select-none shrink-0" : "shrink-0"}
                        aria-hidden={isActive || undefined}
                      >
                        <Button
                          variant="ghost"
                          size="md"
                          iconOnly={true}
                          tabIndex={isActive ? -1 : undefined}
                          disabled={isActive}
                          aria-label={`${vocab.deleteProfile}: ${p.name}`}
                          title={vocab.deleteProfile}
                          onClick={() => onDeleteProfile(p.name)}
                        >
                          <Trash2 size={15} strokeWidth={2} />
                        </Button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </Stack>
          </Stack>

          <Stack gap="4">
            {activeProfile ? (
              <div className="pt-3 border-t border-[var(--border)] flex flex-wrap items-center gap-2">
                <Popover
                  open={renameOpen}
                  onOpenChange={(o) => {
                    if (o) setRenameValue(activeProfile.name);
                    setRenameOpen(o);
                  }}
                  trigger={
                    <Button variant="secondary" size="sm">
                      <Pencil size={14} strokeWidth={2} />
                      <span>{vocab.renameProfile}</span>
                    </Button>
                  }
                >
                  <Stack gap="2">
                    <span className="text-xs font-medium text-[var(--fg-muted)]">{vocab.renameProfile}</span>
                    <TextInput
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      placeholder={vocab.profileNamePlaceholder}
                      aria-label={vocab.renameProfile}
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={!renameValue.trim()}
                      onClick={() => {
                        onRenameProfile(activeProfile.name, renameValue);
                        setRenameOpen(false);
                      }}
                    >
                      {vocab.renameProfile}
                    </Button>
                  </Stack>
                </Popover>

                <Button variant="secondary" size="sm" onClick={duplicateActive}>
                  <Copy size={14} strokeWidth={2} />
                  <span>{vocab.duplicateProfile}</span>
                </Button>
              </div>
            ) : null}

            <div className="pt-3 border-t border-[var(--border)] flex flex-wrap items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => void handleExport()}>
                {exportedNote ? <Copy size={14} strokeWidth={2} /> : <Download size={14} strokeWidth={2} />}
                <span>{exportedNote ? vocab.reportCopied : vocab.exportProfiles}</span>
              </Button>

              <Popover
                open={importOpen}
                onOpenChange={setImportOpen}
                trigger={
                  <Button variant="ghost" size="sm">
                    <Upload size={14} strokeWidth={2} />
                    <span>{vocab.importProfiles}</span>
                  </Button>
                }
              >
                <Stack gap="2">
                  <TextInput
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                    placeholder={vocab.importProfiles}
                    aria-label={vocab.importProfiles}
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={!importText.trim()}
                    onClick={() => {
                      onImportProfiles(importText);
                      setImportText("");
                      setImportOpen(false);
                    }}
                  >
                    {vocab.importProfiles}
                  </Button>
                </Stack>
              </Popover>
            </div>
          </Stack>
        </Stack>
      </SurfaceCard>

      {/* Unified Interactive Visual App Auto-Switch Grid (Real App Icons + 1-Click Toggle, Zero Horizontal Shift) */}
      <SurfaceCard stableFrame={true} className="lg:col-span-7 min-w-0 h-full flex flex-col justify-between">
        <Stack gap="4" className="flex-1 justify-between">
          <Stack gap="4">
            <Inline gap="2" wrap={false}>
              <h2 className="text-base font-bold">{vocab.autoSwitchAppsTitle}</h2>
              <HelpTip {...vocab.help.profilesAutoSwitch} side="bottom" />
            </Inline>

            <p className="text-xs text-[var(--fg-muted)]">{vocab.openAppsHint}</p>

            {unifiedApps.length > 0 ? (
              <div className={`grid gap-2 ${unifiedApps.length <= 4 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"}`}>
                {unifiedApps.map((app) => {
                  const linked = assignedApps.includes(app.exe);
                  return (
                    <TileButton
                      key={app.exe}
                      active={linked}
                      onClick={() => toggleApp(app.exe)}
                      ariaLabel={app.displayName}
                    >
                      <span className="flex items-center justify-between gap-2 w-full">
                        <span className="flex items-center gap-2 min-w-0">
                          <AppIcon name={app.displayName} iconDataUrl={app.iconDataUrl} size="sm" />
                          <span className="text-xs font-medium truncate">{app.displayName}</span>
                        </span>
                        <Check
                          size={14}
                          strokeWidth={2.5}
                          className={`shrink-0 ${linked ? "opacity-100" : "opacity-0"}`}
                        />
                      </span>
                    </TileButton>
                  );
                })}
              </div>
            ) : (
              <span className="text-xs text-[var(--fg-muted)]">{vocab.noAppsAssigned}</span>
            )}
          </Stack>

          <Inline gap="2" wrap={true}>
            <div className="flex-1 min-w-[180px]">
              <TextInput
                value={customApp}
                onChange={(e) => setCustomApp(e.target.value)}
                placeholder={vocab.customAppPlaceholder}
                aria-label={vocab.customAppPlaceholder}
              />
            </div>
            <Button variant="secondary" size="md" disabled={!customApp.trim()} onClick={addCustomApp}>
              <Plus size={15} strokeWidth={2} />
              <span>{vocab.addApp}</span>
            </Button>
          </Inline>
        </Stack>
      </SurfaceCard>
    </div>
  );
}
