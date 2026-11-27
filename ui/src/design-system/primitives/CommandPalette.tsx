import * as Dialog from "@radix-ui/react-dialog";
import { Search, X } from "lucide-react";
import { useMemo, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
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
  emptyLabel,
  items,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  placeholder: string;
  closeLabel: string;
  emptyLabel: string;
  items: readonly PaletteItem[];
}) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items.slice(0, 12);
    return items.filter((item) => item.label.toLowerCase().includes(q) || item.group.toLowerCase().includes(q)).slice(0, 12);
  }, [items, query]);

  const safeIndex = filtered.length > 0 ? Math.min(activeIndex, filtered.length - 1) : 0;

  const executeItem = (item: PaletteItem | undefined) => {
    if (!item) return;
    item.onSelect();
    onOpenChange(false);
  };

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (filtered.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((safeIndex + 1) % filtered.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((safeIndex - 1 + filtered.length) % filtered.length);
    } else if (e.key === "Home") {
      e.preventDefault();
      setActiveIndex(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActiveIndex(filtered.length - 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      executeItem(filtered[safeIndex]);
    }
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setQuery("");
          setActiveIndex(0);
        }
        onOpenChange(next);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/45" />
        <Dialog.Content
          onKeyDown={handleKeyDown}
          className="fixed top-[12%] left-1/2 -translate-x-1/2 z-50 w-[92vw] max-w-[520px] max-h-[76vh] flex flex-col rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-1)] text-[var(--fg)] p-4 shadow-2xl"
        >
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
              onChange={(e) => {
                setQuery(e.target.value);
                setActiveIndex(0);
              }}
              placeholder={placeholder}
              aria-label={placeholder}
              autoFocus
              leading={<Search size={16} strokeWidth={2} />}
            />
            <div className="flex flex-col gap-1.5" role="listbox" aria-label={title}>
              {filtered.length > 0 ? (
                filtered.map((item, idx) => (
                  <Button
                    key={item.id}
                    variant="ghost"
                    size="md"
                    fullWidth
                    active={idx === safeIndex}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => executeItem(item)}
                  >
                    <span className="flex w-full items-center justify-between gap-2">
                      <span>{item.label}</span>
                      <span className="text-xs text-[var(--fg-muted)]">{item.group}</span>
                    </span>
                  </Button>
                ))
              ) : (
                <p className="py-6 text-center text-xs text-[var(--fg-muted)]">{emptyLabel}</p>
              )}
            </div>
          </Stack>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
