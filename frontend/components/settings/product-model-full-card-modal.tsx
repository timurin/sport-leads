"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { loadProductModelFullCard } from "@/app/(workspace)/settings/catalogs/product-models/product-model-actions";
import { ProductModelFullCardFrame } from "@/components/settings/product-model-full-card-frame";
import { ProductModelPersistentCard } from "@/components/settings/product-model-persistent-card";
import type { ProductModelDetailData } from "@/lib/product-model-detail-data";

export function ProductModelFullCardModal({
  modelId,
  onClose,
  focusNorms = false,
  focusOperationName = null,
  expandRoutingTemplateId = null,
}: {
  modelId: number;
  onClose: () => void;
  focusNorms?: boolean;
  focusOperationName?: string | null;
  expandRoutingTemplateId?: number | null;
}) {
  const [card, setCard] = useState<ProductModelDetailData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const loadCard = useCallback(async (showError: boolean) => {
    const id = ++requestId.current;
    const result = await loadProductModelFullCard(modelId);
    if (id !== requestId.current) return;
    if (!result.ok) {
      if (showError) setError(result.message);
      return;
    }
    setError(null);
    setCard(result.card);
  }, [modelId]);

  useEffect(() => {
    void loadCard(true);
  }, [loadCard]);

  useEffect(() => {
    if (!card || !focusNorms || focusOperationName) return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById("product-model-route-norms")?.scrollIntoView({ block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [card, focusNorms, focusOperationName]);

  return (
    <ProductModelFullCardFrame onClose={onClose} onRefresh={() => loadCard(false)}>
      {error ? <p className="p-portal-6 text-portal-body text-portal-danger">{error}</p> : null}
      {!error && !card ? <p className="p-portal-6 text-portal-body text-portal-muted">Загрузка…</p> : null}
      {card ? (
        <ProductModelPersistentCard
          {...card}
          expandRoutingTemplateId={focusNorms ? expandRoutingTemplateId : null}
        />
      ) : null}
    </ProductModelFullCardFrame>
  );
}
