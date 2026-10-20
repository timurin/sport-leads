"use client";

import { X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

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
   * center — centered modal + backdrop (26.11 create tech card).
   * nested — centered modal above the product-model card (30–50% width).
   * fullscreen — full-viewport modal over the current page (dense create forms).
   */
  variant?: "docked" | "overlay" | "fullscreen" | "center" | "nested";
  /** Capture Escape so a parent modal stays open. */
  isolateEscape?: boolean;
  /** Raise an overlay above another open modal. */
  elevated?: boolean;
};

/**
 * Platform create shell (ADR-013).
 * Visual match: EntityInspector create mode in materials EntityWorkspace;
 * fullscreen extends the shell for dense catalog creates (nomenclature).
 *
 * Overlay/fullscreen mount via portal to `document.body` so `position: fixed`
 * is not clipped by AppShell `overflow-hidden` (sticky thead bleed-through).
 */
export function CreateDrawer({
  open,
  title,
  description = "Заполните поля и сохраните изменения",
  onClose,
  children,
  variant = "docked",
  isolateEscape = false,
  elevated = false,
}: CreateDrawerProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (isolateEscape) event.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener("keydown", onKeyDown, isolateEscape);
    return () => window.removeEventListener("keydown", onKeyDown, isolateEscape);
  }, [open, onClose, isolateEscape]);

  useEffect(() => {
    if (!open || (variant !== "fullscreen" && variant !== "overlay" && variant !== "center" && variant !== "nested")) {
      return;
    }
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open, variant]);

  if (!open) {
    return null;
  }

  if (variant === "center") {
    if (!mounted) return null;
    return createPortal(
      <>
        <button
          type="button"
          className="fixed inset-0 z-portal-modal bg-[#101828]/40"
          aria-label="Закрыть окно создания"
          onClick={onClose}
        />
        <div
          className="fixed inset-0 z-portal-modal-1 flex items-center justify-center p-portal-4 pointer-events-none"
        >
          <div
            className="pointer-events-auto flex max-h-[min(90vh,40rem)] w-full max-w-[32rem] flex-col overflow-hidden rounded-portal-lg border border-portal-border bg-portal-surface shadow-portal-overlay"
            role="dialog"
            aria-modal="true"
            aria-label={title}
          >
            <header className="flex shrink-0 items-center justify-between border-b border-portal-border px-portal-6 py-portal-5">
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
            <div className="min-h-0 flex-1 overflow-auto px-portal-6 py-portal-5">{children}</div>
          </div>
        </div>
      </>,
      document.body,
    );
  }

  if (variant === "nested") {
    if (!mounted) return null;
    return createPortal(
      <div
        className="fixed inset-0 z-portal-modal-3 flex items-center justify-center p-portal-4"
        data-product-model-nested-dialog
      >
        <button
          type="button"
          className="absolute inset-0 bg-[#101828]/40"
          aria-label="Закрыть окно"
          onClick={onClose}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className="relative flex max-h-[90vh] min-h-0 w-[clamp(30vw,40vw,50vw)] flex-col overflow-y-auto rounded-portal-lg border border-portal-border bg-portal-page shadow-portal-overlay"
        >
          <header className="sticky top-0 z-portal-raised flex shrink-0 items-center justify-between border-b border-portal-border bg-portal-page px-portal-6 py-portal-5">
            <div className="min-w-0">
              <h2 className="text-portal-page font-semibold text-portal-text">{title}</h2>
              {description ? (
                <p className="mt-1 text-portal-body text-portal-muted">{description}</p>
              ) : null}
            </div>
            <IconButton label="Закрыть окно" variant="secondary" onClick={onClose}>
              <X size={19} aria-hidden="true" />
            </IconButton>
          </header>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
        </div>
      </div>,
      document.body,
    );
  }

  if (variant === "fullscreen") {
    if (!mounted) return null;
    return createPortal(
      <div
        className="fixed inset-0 z-portal-modal-2 flex flex-col bg-portal-surface"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="flex shrink-0 items-center justify-between border-b border-portal-border px-portal-6 py-portal-5">
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
        <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
      </div>,
      document.body,
    );
  }

  const panel = (
    <aside
      className={[
        "flex h-full min-h-[600px] w-full flex-col border-l border-portal-border bg-portal-surface",
        variant === "overlay"
          ? `fixed inset-y-0 right-0 w-full max-w-[520px] shadow-portal-overlay ${elevated ? "z-portal-modal-3" : "z-portal-modal-1"}`
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
    if (!mounted) return null;
    return createPortal(
      <>
        <button
          type="button"
          className={`fixed inset-0 bg-[#101828]/40 ${elevated ? "z-portal-modal-2" : "z-portal-modal"}`}
          aria-label="Закрыть панель создания"
          onClick={onClose}
        />
        {panel}
      </>,
      document.body,
    );
  }

  return (
    <section className="w-[520px] shrink-0 overflow-hidden">{panel}</section>
  );
}
