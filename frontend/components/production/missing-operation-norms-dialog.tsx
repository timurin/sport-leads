"use client";

import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";

export function MissingOperationNormsDialog({
  operations,
  canEditNorms,
  onClose,
  onFill,
}: {
  operations: string[];
  canEditNorms: boolean;
  onClose: () => void;
  onFill: () => void;
}) {
  const dialog = (
    <div className="fixed inset-0 z-portal-modal-3 flex items-center justify-center p-portal-4" role="presentation">
      <button type="button" className="absolute inset-0 bg-[#101828]/40" aria-label="Закрыть" onClick={onClose} />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="missing-operation-norms-title"
        data-missing-norms-dialog
        className="relative grid w-full max-w-lg gap-portal-4 rounded-portal-lg border border-portal-border bg-portal-surface p-portal-5 shadow-portal-overlay"
      >
        <div className="grid gap-portal-2">
          <h2 id="missing-operation-norms-title" className="text-portal-body font-semibold">
            Нормы операций не заполнены!
          </h2>
          <p className="text-portal-caption text-portal-text">
            Для выбранной модели не заполнены нормы одной или нескольких производственных операций. Без них техкарта не может быть корректно рассчитана и запланирована.
          </p>
          {operations.length > 0 ? (
            <ul className="list-disc pl-portal-5 text-portal-caption text-portal-text">
              {operations.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="flex flex-wrap justify-end gap-portal-2">
          <Button type="button" size="compact" variant="secondary" data-missing-norms-close onClick={onClose}>
            Закрыть
          </Button>
          {canEditNorms ? (
            <Button type="button" size="compact" variant="primary" data-missing-norms-fill onClick={onFill}>
              Заполнить
            </Button>
          ) : null}
        </div>
      </section>
    </div>
  );

  return createPortal(dialog, document.body);
}
