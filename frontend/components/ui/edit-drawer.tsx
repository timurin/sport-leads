"use client";

import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";

import { Button, IconButton } from "@/components/ui/button";

type EditDrawerProps = {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
};

/**
 * Left edit shell for catalog list workspaces.
 * `lg+` docks beside the list; below `lg` uses left overlay + backdrop.
 */
export function EditDrawer({
  open,
  title,
  description = "Измените поля и сохраните",
  onClose,
  children,
}: EditDrawerProps) {
  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  const panel = (
    <aside
      className="flex h-full min-h-0 w-full flex-col bg-portal-surface"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <header className="flex items-center justify-between border-b border-portal-border px-portal-6 py-portal-5">
        <div className="min-w-0">
          <h2 className="text-portal-page font-semibold text-portal-text">
            {title}
          </h2>
          {description ? (
            <p className="mt-1 text-portal-body text-portal-muted">
              {description}
            </p>
          ) : null}
        </div>
        <IconButton label="Закрыть" onClick={onClose}>
          <X size={19} aria-hidden="true" />
        </IconButton>
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </aside>
  );

  return (
    <>
      <section
        data-edit-drawer-docked
        className="hidden w-[420px] shrink-0 overflow-hidden border-r border-portal-border lg:flex lg:min-h-[600px] lg:flex-col"
      >
        {panel}
      </section>

      <div
        data-edit-drawer-overlay
        className="fixed inset-0 z-portal-modal-1 lg:hidden"
        role="presentation"
      >
        <button
          type="button"
          className="absolute inset-0 bg-slate-950/40"
          aria-label="Закрыть панель редактирования"
          onClick={onClose}
        />
        <div className="absolute inset-y-0 left-0 flex w-full max-w-[min(100%,420px)] flex-col bg-portal-surface shadow-portal-overlay">
          {panel}
        </div>
      </div>
    </>
  );
}

type EditFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  onCancel: () => void;
  children: ReactNode;
  submitLabel?: string;
  readOnly?: boolean;
};

/** Shared edit form chrome: scrollable fields + sticky footer actions. */
export function EditForm({
  action,
  onCancel,
  children,
  submitLabel = "Сохранить",
  readOnly = false,
}: EditFormProps) {
  return (
    <form action={action} className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 space-y-portal-4 overflow-y-auto p-portal-6">
        {children}
      </div>
      <footer className="flex items-center justify-end gap-portal-2 border-t border-portal-border bg-portal-surface px-portal-6 py-portal-4">
        <Button type="button" onClick={onCancel}>
          {readOnly ? "Закрыть" : "Отмена"}
        </Button>
        {readOnly ? null : (
          <Button type="submit" variant="primary">
            {submitLabel}
          </Button>
        )}
      </footer>
    </form>
  );
}
