"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";

import { loadTechnicalCardWorkspace } from "@/app/(workspace)/production/tech-cards/load-tech-card-document-action";
import { TechCardDetailWorkspace } from "@/components/production/tech-card-detail-workspace";
import { IconButton } from "@/components/ui/button";

export function TechnicalCardFullCardModal({ cardId, onClose }: { cardId: number; onClose: () => void }) {
  const [documentCard, setDocumentCard] = useState<Awaited<ReturnType<typeof loadTechnicalCardWorkspace>> | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadTechnicalCardWorkspace(cardId).then((result) => {
      if (!cancelled) setDocumentCard(result);
    });
    return () => {
      cancelled = true;
    };
  }, [cardId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (document.querySelector("[data-product-model-full-card], [data-product-model-nested-dialog], dialog[open]")) return;
      event.preventDefault();
      onClose();
    };
    window.addEventListener("keydown", onKeyDown, true);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-portal-modal-2 flex items-center justify-center p-portal-4">
      <button type="button" className="absolute inset-0 bg-[#101828]/40" aria-label="Закрыть техкарту" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Техкарта"
        data-planning-tech-card-modal
        className="relative flex max-h-[90vh] w-[90vw] flex-col overflow-hidden rounded-portal-lg border border-portal-border bg-portal-page shadow-portal-overlay"
      >
        <div className="flex shrink-0 items-center justify-end border-b border-portal-border bg-portal-page px-portal-3 py-portal-2">
          <IconButton label="Закрыть окно" variant="secondary" onClick={onClose}>
            <X className="size-4" aria-hidden="true" />
          </IconButton>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          {!documentCard ? <p className="p-portal-6 text-portal-body text-portal-muted">Загрузка…</p> : null}
          {documentCard && !documentCard.ok ? <p className="p-portal-6 text-portal-body text-portal-danger">{documentCard.message}</p> : null}
          {documentCard?.ok ? <TechCardDetailWorkspace {...documentCard.document} /> : null}
        </div>
      </div>
    </div>
  );
}
