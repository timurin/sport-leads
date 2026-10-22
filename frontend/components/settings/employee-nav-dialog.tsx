"use client";

import { useEffect, useId, useRef, useState } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function EmployeeNavDialog({
  title,
  level,
  dirty = false,
  pending = false,
  inert = false,
  onClose,
  onDiscard,
  children,
}: {
  title: string;
  level: 1 | 2;
  dirty?: boolean;
  pending?: boolean;
  inert?: boolean;
  onClose: () => void;
  onDiscard?: () => void;
  children: React.ReactNode;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const decisionRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const dirtyRef = useRef(dirty);
  const pendingRef = useRef(pending);
  const [confirming, setConfirming] = useState(false);
  const confirmingRef = useRef(false);

  useEffect(() => {
    onCloseRef.current = onClose;
    dirtyRef.current = dirty;
    pendingRef.current = pending;
    confirmingRef.current = confirming;
  }, [onClose, dirty, pending, confirming]);

  useEffect(() => {
    const locks = window as Window & { __employeeNavLocks?: number };
    locks.__employeeNavLocks = (locks.__employeeNavLocks ?? 0) + 1;
    document.body.style.overflow = "hidden";
    return () => {
      locks.__employeeNavLocks = (locks.__employeeNavLocks ?? 1) - 1;
      if (locks.__employeeNavLocks <= 0) document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    if (inert) return;
    const panel = panelRef.current;
    if (!panel) return;
    const previous = document.activeElement as HTMLElement | null;
    const items = () =>
      [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (item) => item.tabIndex >= 0 && !item.closest("[inert]"),
      );
    items()[0]?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        if (pendingRef.current) return;
        if (confirmingRef.current) {
          setConfirming(false);
          return;
        }
        if (dirtyRef.current) {
          setConfirming(true);
          return;
        }
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = items();
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      previous?.focus();
    };
  }, [inert]);

  useEffect(() => {
    if (!dirty || inert) return;
    const onUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [dirty, inert]);

  useEffect(() => {
    if (confirming) decisionRef.current?.querySelector("button")?.focus();
  }, [confirming]);

  const requestClose = () => {
    if (pending || inert) return;
    if (dirty) {
      setConfirming(true);
      return;
    }
    onClose();
  };

  return (
    <div
      inert={inert ? true : undefined}
      className={level === 2 ? "fixed inset-0 z-portal-modal-3" : "fixed inset-0 z-portal-modal"}
    >
      <button
        type="button"
        aria-label="Закрыть слой"
        className={level === 2 ? "absolute inset-0 bg-black/40" : "absolute inset-0 bg-black/30"}
        onClick={requestClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal={inert ? undefined : true}
        aria-labelledby={titleId}
        data-employee-nav-level={level}
        className="absolute inset-x-0 top-0 bottom-0 flex min-w-0 flex-col overflow-hidden bg-portal-surface shadow-lg sm:inset-x-auto sm:right-3 sm:top-3 sm:bottom-3 sm:w-[min(760px,calc(100%-1.5rem))] sm:rounded-portal-lg sm:border sm:border-portal-border"
      >
        <div className="flex items-center justify-between gap-3 border-b border-portal-border px-portal-4 py-portal-3">
          <h2 id={titleId} className="min-w-0 truncate text-portal-section font-semibold text-portal-text">
            {title}
          </h2>
          <button type="button" className="text-portal-caption text-portal-primary" onClick={requestClose}>
            Закрыть
          </button>
        </div>
        {confirming && dirty ? (
          <div ref={decisionRef} className="flex flex-wrap items-center gap-2 border-b border-portal-border px-portal-4 py-portal-2">
            <p className="text-portal-caption text-portal-text">Есть несохранённые изменения.</p>
            <button type="button" className="text-portal-caption text-portal-primary" onClick={() => setConfirming(false)}>
              Остаться
            </button>
            <button
              type="button"
              className="text-portal-caption text-portal-danger"
              onClick={() => {
                setConfirming(false);
                (onDiscard ?? onClose)();
              }}
            >
              Отбросить
            </button>
          </div>
        ) : null}
        <div className="min-h-0 flex-1 overflow-auto p-portal-4">{children}</div>
      </div>
    </div>
  );
}
