import { Check, Copy, Download, FolderPlus, Gamepad2, Pencil, Plus, Trash2, Upload, X } from "lucide-react";
import { useState } from "react";
import type { DeviceSnapshot, RunningApp } from "../acl/transport";
import {
  Button,
  ConfirmButton,
  FileImportButton,
  HelpTip,
  Inline,
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
  onNotify,
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
  onNotify: (msg: string) => void;
}) {
  const [inlineMode, setInlineMode] = useState<"create" | "rename" | null>(null);
  const [draftName, setDraftName] = useState("");
  const [customApp, setCustomApp] = useState("");

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

  const submitInline = () => {
    const clean = draftName.trim();
    if (!clean) return;
    if (inlineMode === "create") {
      onCreateProfile(clean);
    } else if (inlineMode === "rename" && activeProfile) {
      onRenameProfile(activeProfile.name, clean);
    }
    setDraftName("");
    setInlineMode(null);
  };

  const handleExport = async () => {
    const text = await onExportProfiles();
    if (!text) return;
    const blob = new Blob([text], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "grip-profiles.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    onNotify(vocab.toastExportedFile);
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
      {/* Profile Master List & Zero-Modal Inline Actions */}
      <SurfaceCard primaryContent={true} stableFrame={true} className="lg:col-span-5 min-w-0 h-full flex flex-col justify-between">
        <Stack gap="4" className="flex-1 justify-between">
          <Stack gap="4">
            <Inline gap="2" justify="between" wrap={true}>
              <Inline gap="2" wrap={false}>
                <Gamepad2 size={18} strokeWidth={2} />
                <h2 className="text-base font-bold">{vocab.profilesTitle}</h2>
                <HelpTip {...vocab.help.profilesList} side="bottom" />
              </Inline>

              <Button
                variant="secondary"
                size="sm"
                active={inlineMode === "create"}
                onClick={() => {
                  if (inlineMode === "create") {
                    setInlineMode(null);
                    setDraftName("");
                  } else {
                    setDraftName("");
                    setInlineMode("create");
                  }
                }}
              >
                <FolderPlus size={15} strokeWidth={2} />
                <span>{vocab.newProfile}</span>
              </Button>
            </Inline>

            {inlineMode === "create" ? (
              <div className="flex items-center gap-1.5 w-full">
                <div className="flex-1 min-w-0">
                  <TextInput
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") submitInline();
                      else if (e.key === "Escape") {
                        setInlineMode(null);
                        setDraftName("");
                      }
                    }}
                    placeholder={vocab.profileNamePlaceholder}
                    aria-label={vocab.profileNamePlaceholder}
                    autoFocus
                  />
                </div>
                <Button variant="primary" size="md" iconOnly={true} disabled={!draftName.trim()} onClick={submitInline} aria-label={vocab.create} title={vocab.create}>
                  <Check size={15} strokeWidth={2.5} />
                </Button>
                <Button
                  variant="ghost"
                  size="md"
                  iconOnly={true}
                  onClick={() => {
                    setInlineMode(null);
                    setDraftName("");
                  }}
                  aria-label={vocab.cancel}
                  title={vocab.cancel}
                >
                  <X size={15} strokeWidth={2} />
                </Button>
              </div>
            ) : null}

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
                        <ConfirmButton
                          variant="ghost"
                          size="md"
                          iconOnly={true}
                          tabIndex={isActive ? -1 : undefined}
                          disabled={isActive}
                          icon={<Trash2 size={15} strokeWidth={2} />}
                          label={vocab.deleteProfile}
                          confirmLabel={vocab.confirmDelete}
                          ariaLabel={`${vocab.deleteProfile}: ${p.name}`}
                          onConfirm={() => onDeleteProfile(p.name)}
                        />
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
                {inlineMode === "rename" ? (
                  <div className="flex items-center gap-1.5 w-full">
                    <div className="flex-1 min-w-0">
                      <TextInput
                        value={draftName}
                        onChange={(e) => setDraftName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") submitInline();
                          else if (e.key === "Escape") {
                            setInlineMode(null);
                            setDraftName("");
                          }
                        }}
                        placeholder={vocab.profileNamePlaceholder}
                        aria-label={vocab.renameProfile}
                        autoFocus
                      />
                    </div>
                    <Button variant="primary" size="md" iconOnly={true} disabled={!draftName.trim()} onClick={submitInline} aria-label={vocab.renameProfile} title={vocab.renameProfile}>
                      <Check size={15} strokeWidth={2.5} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="md"
                      iconOnly={true}
                      onClick={() => {
                        setInlineMode(null);
                        setDraftName("");
                      }}
                      aria-label={vocab.cancel}
                      title={vocab.cancel}
                    >
                      <X size={15} strokeWidth={2} />
                    </Button>
                  </div>
                ) : (
                  <>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setDraftName(activeProfile.name);
                        setInlineMode("rename");
                      }}
                    >
                      <Pencil size={14} strokeWidth={2} />
                      <span>{vocab.renameProfile}</span>
                    </Button>

                    <Button variant="secondary" size="sm" onClick={duplicateActive}>
                      <Copy size={14} strokeWidth={2} />
                      <span>{vocab.duplicateProfile}</span>
                    </Button>
                  </>
                )}
              </div>
            ) : null}

            <div className="pt-3 border-t border-[var(--border)] flex flex-wrap items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => void handleExport()}>
                <Download size={14} strokeWidth={2} />
                <span>{vocab.exportToFile}</span>
              </Button>

              <FileImportButton
                variant="ghost"
                size="sm"
                accept=".json,application/json"
                icon={<Upload size={14} strokeWidth={2} />}
                label={vocab.importFromFile}
                onReadText={(text) => {
                  try {
                    JSON.parse(text);
                    onImportProfiles(text);
                  } catch {
                    onNotify(vocab.toastInvalidImport);
                  }
                }}
                onError={() => onNotify(vocab.toastInvalidImport)}
              />
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
                onKeyDown={(e) => {
                  if (e.key === "Enter" && customApp.trim()) addCustomApp();
                }}
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
