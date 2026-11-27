import { Clock, Keyboard, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { DeviceSnapshot } from "../acl/transport";
import {
  Badge,
  Button,
  ConfirmButton,
  HelpTip,
  Inline,
  Stack,
  SurfaceCard,
  SurfaceInset,
  TextInput,
} from "../design-system/primitives";
import type { Vocab } from "../i18n/vocab";

export function MacrosView({
  device,
  vocab,
  onCreateMacro,
  onDeleteMacro,
}: {
  device: DeviceSnapshot;
  vocab: Vocab;
  onCreateMacro: (name: string, steps: string) => void;
  onDeleteMacro: (macroId: number) => void;
}) {
  const [name, setName] = useState("");
  const [recording, setRecording] = useState(false);
  const [stepsList, setStepsList] = useState<string[]>([]);

  useEffect(() => {
    if (!recording) return;
    const onKeyDown = (ev: KeyboardEvent) => {
      ev.preventDefault();
      ev.stopPropagation();
      const k = ev.key.toLowerCase();
      if (["control", "shift", "alt", "meta"].includes(k)) return;
      const clean = k === " " ? "space" : k === "escape" ? "esc" : k;
      const mods: string[] = [];
      if (ev.ctrlKey) mods.push("ctrl");
      if (ev.shiftKey) mods.push("shift");
      if (ev.altKey) mods.push("alt");
      if (ev.metaKey) mods.push("win");
      const token = [...mods, clean].join("+");
      setStepsList((prev) => [...prev, `tap:${token}`]);
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [recording]);

  const handleSave = () => {
    if (!name.trim() || stepsList.length === 0) return;
    onCreateMacro(name.trim(), stepsList.join(" "));
    setName("");
    setStepsList([]);
    setRecording(false);
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
      <SurfaceCard primaryContent={true} className="xl:col-span-6 min-w-0">
        <Stack gap="4">
          <Inline gap="2" justify="between" wrap={true}>
            <Inline gap="2" wrap={false}>
              <h2 className="text-base font-bold">{vocab.macroCreateTitle}</h2>
              <HelpTip {...vocab.help.macrosSection} side="bottom" />
            </Inline>
            {device.macroMaxBytes > 0 ? (
              <Badge tone="neutral">
                {vocab.macroMemoryLabel}: {Math.round((device.macroFreeBytes / device.macroMaxBytes) * 100)}%
              </Badge>
            ) : null}
          </Inline>

          <TextInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={vocab.macroNamePlaceholder}
            aria-label={vocab.macroNamePlaceholder}
          />

          <Inline gap="2" wrap={true}>
            <Button variant="secondary" active={recording} onClick={() => setRecording((r) => !r)}>
              <Keyboard size={15} strokeWidth={2} />
              <span>{recording ? vocab.macroRecordStop : vocab.macroRecordStart}</span>
            </Button>
            <Button
              variant="ghost"
              size="md"
              onClick={() => setStepsList((prev) => [...prev, "wait:50"])}
            >
              <Clock size={15} strokeWidth={2} />
              <span>{vocab.macroAddDelay}</span>
            </Button>
          </Inline>

          <SurfaceInset>
            <Inline gap="2" wrap={true}>
              {stepsList.length > 0 ? (
                stepsList.map((st, idx) => (
                  <Button
                    key={`${st}-${idx}`}
                    variant="secondary"
                    size="sm"
                    onClick={() => setStepsList((prev) => prev.filter((_, i) => i !== idx))}
                  >
                    <span>{st.replace(/^tap:/, "").replace(/^wait:/, "+")}</span>
                  </Button>
                ))
              ) : (
                <span className="text-xs text-[var(--fg-muted)]">{vocab.macroEmpty}</span>
              )}
            </Inline>
          </SurfaceInset>

          <Button
            variant="primary"
            size="lg"
            disabled={!name.trim() || stepsList.length === 0}
            onClick={handleSave}
          >
            <Plus size={16} strokeWidth={2} />
            <span>{vocab.macroSave}</span>
          </Button>
        </Stack>
      </SurfaceCard>

      <SurfaceCard className="xl:col-span-6 min-w-0">
        <Stack gap="4">
          <h2 className="text-base font-bold">{vocab.macrosTitle}</h2>
          {device.macros.length > 0 ? (
            <Stack gap="2">
              {device.macros.map((m) => (
                <SurfaceInset key={m.id}>
                  <Inline gap="2" justify="between" wrap={false}>
                    <Stack gap="1">
                      <span className="text-sm font-bold">{m.name}</span>
                      <span className="text-xs text-[var(--fg-muted)]">{m.steps}</span>
                    </Stack>
                    <ConfirmButton
                      variant="danger"
                      size="sm"
                      iconOnly={true}
                      icon={<Trash2 size={14} strokeWidth={2} />}
                      label={vocab.deleteProfile}
                      confirmLabel={vocab.confirmDelete}
                      ariaLabel={`${vocab.deleteProfile}: ${m.name}`}
                      onConfirm={() => onDeleteMacro(m.id)}
                    />
                  </Inline>
                </SurfaceInset>
              ))}
            </Stack>
          ) : (
            <span className="text-xs text-[var(--fg-muted)]">{vocab.macroEmpty}</span>
          )}
        </Stack>
      </SurfaceCard>
    </div>
  );
}
