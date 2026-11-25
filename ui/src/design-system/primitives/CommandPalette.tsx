import * as Dialog from "@radix-ui/react-dialog";
import { Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "./Button";
import { TextInput } from "./Input";
import { Stack } from "./Layout";

export interface PaletteItem {
  id: string;
  label: string;
  group: string;
  onSelect: () => void;
}

export function CommandPalette({
  open,
  onOpenChange,
  title,
  placeholder,
  closeLabel,
  items,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  placeholder: string;
  closeLabel: string;
  items: readonly PaletteItem[];
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items.slice(0, 12);
    return items.filter((item) => item.label.toLowerCase().includes(q) || item.group.toLowerCase().includes(q)).slice(0, 12);
  }, [items, query]);

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) setQuery("");
        onOpenChange(next);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/45" />
        <Dialog.Content className="fixed top-[12%] left-1/2 -translate-x-1/2 z-50 w-[92vw] max-w-[520px] max-h-[76vh] flex flex-col rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-1)] text-[var(--fg)] p-4 shadow-2xl">
          <Stack gap="4">
            <div className="flex items-center justify-between gap-2">
              <Dialog.Title className="text-sm font-bold">{title}</Dialog.Title>
              <Dialog.Close asChild>
                <Button variant="ghost" size="sm" aria-label={closeLabel}>
                  <X size={16} strokeWidth={2} />
                </Button>
              </Dialog.Close>
            </div>
            <TextInput
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder}
              aria-label={placeholder}
              autoFocus
              leading={<Search size={16} strokeWidth={2} />}
            />
            <div className="flex flex-col gap-1.5">
              {filtered.map((item) => (
                <Button
                  key={item.id}
                  variant="ghost"
                  size="md"
                  fullWidth
                  onClick={() => {
                    item.onSelect();
                    onOpenChange(false);
                  }}
                >
                  <span className="flex w-full items-center justify-between gap-2">
                    <span>{item.label}</span>
                    <span className="text-xs text-[var(--fg-muted)]">{item.group}</span>
                  </span>
                </Button>
              ))}
            </div>
          </Stack>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
