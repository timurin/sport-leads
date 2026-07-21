"use client";

import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";

import { IconButton } from "@/components/ui/button";

type CreateDrawerProps = {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  /**
   * docked — right column in a workspace split (materials / EntityInspector).
   * overlay — fixed right panel + backdrop when no inspector column exists.
   */
  variant?: "docked" | "overlay";
};

/**
 * Platform create shell (ADR-013).
 * Visual match: EntityInspector create mode in materials EntityWorkspace.
 */
export function CreateDrawer({
  open,
  title,
  description = "Заполните поля и сохраните изменения",
  onClose,
  children,
  variant = "docked",
}: CreateDrawerProps) {
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
      className={[
        "flex h-full min-h-[600px] w-full flex-col border-l border-portal-border bg-portal-surface",
        variant === "overlay"
          ? "fixed inset-y-0 right-0 z-portal-modal-1 w-full max-w-[520px] shadow-portal-overlay"
          : "",
      ].join(" ")}
      role="dialog"
      aria-modal={variant === "overlay" ? true : undefined}
      aria-label={title}
    >
      <header className="flex items-center justify-between border-b border-portal-border px-portal-6 py-portal-5">
        <div className="min-w-0">
          <h2 className="text-portal-page font-semibold text-portal-text">{title}</h2>
          {description ? (
            <p className="mt-1 text-portal-body text-portal-muted">{description}</p>
          ) : null}
        </div>
        <IconButton label="Закрыть" onClick={onClose}>
          <X size={19} aria-hidden="true" />
        </IconButton>
      </header>

      <div className="min-h-0 flex-1">{children}</div>
    </aside>
  );

  if (variant === "overlay") {
    return (
      <>
        <button
          type="button"
          className="fixed inset-0 z-portal-modal bg-[#101828]/40"
          aria-label="Закрыть панель создания"
          onClick={onClose}
        />
        {panel}
      </>
    );
  }

  return (
    <section className="w-[520px] shrink-0 overflow-hidden">{panel}</section>
  );
}
