"use client";

import { X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button, IconButton } from "@/components/ui/button";

export type CatalogFolderMoveOption = {
  id: number;
  name: string;
  depth: number;
};

/** Centered folder-target picker for single/bulk catalog moves. */
export function CatalogFolderMoveModal({
  open,
  onClose,
  onConfirm,
  folders,
  itemCount,
  itemLabel,
  busy = false,
  initialFolderId = null,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (folderId: number | null) => void | Promise<void>;
  folders: CatalogFolderMoveOption[];
  itemCount: number;
  itemLabel: (count: number) => string;
  busy?: boolean;
  initialFolderId?: number | null;
}) {
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(
    initialFolderId,
  );

  useEffect(() => {
    if (!open) return;
    setSelectedFolderId(initialFolderId);
  }, [open, initialFolderId]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previous;
    };
  }, [open, busy, onClose]);

  const title = useMemo(() => {
    if (itemCount <= 0) return "Переместить в папку";
    return `Переместить ${itemLabel(itemCount)}`;
  }, [itemCount, itemLabel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-portal-modal-2 flex items-center justify-center p-portal-4">
      <button
        type="button"
        className="absolute inset-0 bg-[#101828]/40"
        aria-label="Закрыть"
        disabled={busy}
        onClick={() => {
          if (!busy) onClose();
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative z-10 flex max-h-[min(90vh,40rem)] w-full max-w-[28rem] flex-col overflow-hidden rounded-portal-md border border-portal-border bg-portal-surface shadow-portal-overlay"
      >
        <header className="flex shrink-0 items-start justify-between gap-portal-3 border-b border-portal-border px-portal-5 py-portal-4">
          <div className="min-w-0">
            <h2 className="text-portal-page font-semibold text-portal-text">
              {title}
            </h2>
            <p className="mt-1 text-portal-caption text-portal-muted">
              Выберите папку назначения или корень каталога
            </p>
          </div>
          <IconButton
            label="Закрыть"
            disabled={busy}
            onClick={onClose}
          >
            <X size={19} aria-hidden="true" />
          </IconButton>
        </header>

        <div className="min-h-0 flex-1 space-y-portal-3 overflow-y-auto p-portal-5">
          <p className="text-portal-caption text-portal-muted">
            {itemCount > 0
              ? `Выбрано: ${itemLabel(itemCount)}`
              : "Нет выбранных строк"}
          </p>
          <ul className="divide-y divide-portal-border overflow-hidden rounded-portal-md border border-portal-border">
            <li>
              <label className="flex cursor-pointer items-center gap-portal-3 px-portal-4 py-portal-3 hover:bg-portal-surface-2">
                <input
                  type="radio"
                  name="catalog-folder-move-target"
                  checked={selectedFolderId === null}
                  disabled={busy || itemCount === 0}
                  onChange={() => setSelectedFolderId(null)}
                />
                <span className="text-portal-body text-portal-text">
                  Корень каталога
                </span>
              </label>
            </li>
            {folders.map((folder) => (
              <li key={folder.id}>
                <label
                  className="flex cursor-pointer items-center gap-portal-3 px-portal-4 py-portal-3 hover:bg-portal-surface-2"
                  style={{ paddingLeft: `${folder.depth * 0.75 + 1}rem` }}
                >
                  <input
                    type="radio"
                    name="catalog-folder-move-target"
                    checked={selectedFolderId === folder.id}
                    disabled={busy || itemCount === 0}
                    onChange={() => setSelectedFolderId(folder.id)}
                  />
                  <span className="truncate text-portal-body text-portal-text">
                    {folder.name}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          {folders.length === 0 ? (
            <p className="text-portal-caption text-portal-muted">
              Папок пока нет — можно переместить только в корень.
            </p>
          ) : null}
        </div>

        <footer className="flex shrink-0 items-center justify-end gap-portal-2 border-t border-portal-border bg-portal-surface px-portal-5 py-portal-4">
          <Button type="button" disabled={busy} onClick={onClose}>
            Отмена
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={busy || itemCount === 0}
            onClick={() => void onConfirm(selectedFolderId)}
          >
            {busy ? "Перенос…" : "Переместить"}
          </Button>
        </footer>
      </div>
    </div>
  );
}
