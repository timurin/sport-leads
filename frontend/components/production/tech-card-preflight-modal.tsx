"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";
import type { PreflightItem } from "@/lib/production/tech-card-preflight";

export function TechCardPreflightModal({
  items,
  onClose,
  onOpen,
}: {
  items: PreflightItem[];
  onClose: () => void;
  onOpen: (item: PreflightItem) => void;
}) {
  const openerRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      restoreOpener();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function restoreOpener() {
    const opener = openerRef.current;
    onCloseRef.current();
    window.setTimeout(() => opener?.focus({ preventScroll: true }), 0);
  }

  const dialog = (
    <div className="fixed inset-0 z-portal-modal-3 flex items-end justify-center p-portal-3 sm:items-center sm:p-portal-4" role="presentation">
      <button type="button" className="absolute inset-0 bg-[#101828]/40" aria-label="Закрыть" onClick={restoreOpener} />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="tech-card-preflight-title"
        data-tech-card-preflight
        className="relative grid max-h-[90vh] w-full max-w-lg gap-portal-4 overflow-auto rounded-portal-lg border border-portal-border bg-portal-surface p-portal-4 shadow-portal-overlay sm:p-portal-5"
      >
        <div className="grid gap-portal-2">
          <h2 id="tech-card-preflight-title" className="text-portal-body font-semibold">
            Техкарта требует настройки
          </h2>
          <p className="text-portal-caption text-portal-text">Перед расчётом и запуском устраните ошибки:</p>
        </div>
        <ul className="grid gap-portal-3">
          {items.map((item) => (
            <li
              key={item.key}
              data-preflight-issue={item.code}
              data-preflight-severity={item.severity}
              className={`grid gap-portal-2 rounded-portal-md border px-portal-3 py-portal-3 ${
                item.severity === "error"
                  ? "border-portal-danger/40 bg-portal-danger-soft"
                  : "border-portal-warning/40 bg-portal-warning-soft"
              }`}
            >
              <p className="text-portal-body font-medium text-portal-text">{item.title}</p>
              {item.detail && item.detail !== item.title ? <p className="text-portal-caption text-portal-text">{item.detail}</p> : null}
              {item.operations.length > 0 ? (
                <ul className="list-disc pl-portal-5 text-portal-caption text-portal-text">
                  {item.operations.map((name) => <li key={name}>{name}</li>)}
                </ul>
              ) : null}
              {item.reasons.length > 0 ? (
                <ul className="list-disc pl-portal-5 text-portal-caption text-portal-text">
                  {item.reasons.map((reason) => <li key={reason}>{reason}</li>)}
                </ul>
              ) : null}
              {item.why ? <p className="text-portal-caption text-portal-muted">{item.why}</p> : null}
              {item.actionLabel ? (
                <div>
                  <Button type="button" size="compact" variant={item.severity === "error" ? "primary" : "secondary"} data-preflight-action={item.code} onClick={() => onOpen(item)}>
                    {item.actionLabel}
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
        <div className="flex justify-end">
          <Button type="button" size="compact" variant="secondary" data-preflight-close onClick={restoreOpener}>
            Закрыть
          </Button>
        </div>
      </section>
    </div>
  );
  return createPortal(dialog, document.body);
}
