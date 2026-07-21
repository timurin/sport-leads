"use client";

import { X } from "lucide-react";
import type { ReactNode } from "react";

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
  if (!open) {
    return null;
  }

  const panel = (
    <aside
      className={[
        "flex h-full min-h-[600px] w-full flex-col border-l border-slate-200 bg-white",
        variant === "overlay"
          ? "fixed inset-y-0 right-0 z-portal-modal-1 w-full max-w-[520px] shadow-portal-overlay"
          : "",
      ].join(" ")}
      role="dialog"
      aria-modal={variant === "overlay" ? true : undefined}
      aria-label={title}
    >
      <header className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-slate-950">{title}</h2>
          {description ? (
            <p className="mt-1 text-sm text-slate-500">{description}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          aria-label="Закрыть"
        >
          <X size={19} aria-hidden="true" />
        </button>
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
