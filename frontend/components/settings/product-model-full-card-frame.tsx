"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from "react";

import { IconButton } from "@/components/ui/button";
import { confirmProductModelClose } from "@/lib/product-models";

type LeaveGuard = { editing: boolean; dirty: boolean };

type LeaveApi = {
  report: (guard: LeaveGuard) => void;
  requestClose: () => void;
};

const ProductModelLeaveContext = createContext<LeaveApi | null>(null);
const ProductModelCardReloadContext = createContext<(() => Promise<void>) | null>(null);

export function useProductModelLeave(): LeaveApi | null {
  return useContext(ProductModelLeaveContext);
}

/** Refresh the open model card. On the standalone page this is a route refresh. */
export function useProductModelCardReload(): () => Promise<void> {
  const reload = useContext(ProductModelCardReloadContext);
  const router = useRouter();
  return useCallback(async () => {
    router.refresh();
    if (reload) await reload();
  }, [reload, router]);
}

export function ProductModelFullCardFrame({
  children,
  onClose,
  onRefresh,
}: {
  children: ReactNode;
  onClose: () => void;
  onRefresh?: () => Promise<void>;
}) {
  const guard = useRef<LeaveGuard>({ editing: false, dirty: false });
  const closeRef = useRef(onClose);
  const refreshRef = useRef(onRefresh);
  const reloadCard = useCallback(async () => {
    await refreshRef.current?.();
  }, []);
  const api = useMemo<LeaveApi>(
    () => ({
      report: (next) => {
        guard.current = next;
      },
      requestClose: () => {
        if (!confirmProductModelClose(guard.current)) return;
        closeRef.current();
      },
    }),
    [],
  );

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    refreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (document.querySelector("[data-product-model-nested-dialog]")) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      api.requestClose();
    };
    window.addEventListener("keydown", onKeyDown, true);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = previous;
    };
  }, [api]);

  return (
    <ProductModelLeaveContext.Provider value={api}>
    <ProductModelCardReloadContext.Provider value={onRefresh ? reloadCard : null}>
      <div className="fixed inset-0 z-portal-modal-2 flex items-center justify-center p-portal-4">
        <button
          type="button"
          className="absolute inset-0 bg-[#101828]/40"
          aria-label="Закрыть полную карточку"
          onClick={() => api.requestClose()}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Полная карточка модели"
          data-product-model-full-card
          className="relative flex max-h-[90vh] w-[90vw] flex-col overflow-hidden rounded-portal-lg border border-portal-border bg-portal-page shadow-portal-overlay"
        >
          <div className="flex shrink-0 items-center justify-end border-b border-portal-border bg-portal-page px-portal-3 py-portal-2">
            <IconButton
              label="Закрыть окно"
              variant="secondary"
              onClick={() => api.requestClose()}
              data-product-model-full-card-close
            >
              <X className="size-4" aria-hidden="true" />
            </IconButton>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">{children}</div>
        </div>
      </div>
    </ProductModelCardReloadContext.Provider>
    </ProductModelLeaveContext.Provider>
  );
}
