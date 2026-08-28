"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { createPurchaseOrderRecord } from "@/app/(workspace)/purchases/orders/purchase-order-actions";
import { Button } from "@/components/ui/button";
import { CreateDrawer } from "@/components/ui/create-drawer";
import { Field, Input, Select, Textarea } from "@/components/ui/form-controls";
import { InlineAlert } from "@/components/ui/inline-alert";
import {
  emptyPurchaseOrderDraft,
  type PurchaseOrderCreateDraft,
} from "@/lib/purchases/purchase-orders";
import type {
  SupplierOption,
  WarehouseOption,
} from "@/components/purchases/purchase-orders-workspace";

type Props = {
  open: boolean;
  onClose: () => void;
  suppliers: SupplierOption[];
  warehouses: WarehouseOption[];
};

export function PurchaseOrderCreateDrawer({
  open,
  onClose,
  suppliers,
  warehouses,
}: Props) {
  const router = useRouter();
  const [draft, setDraft] = useState<PurchaseOrderCreateDraft>(() =>
    emptyPurchaseOrderDraft(),
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const reset = () => {
    setDraft(emptyPurchaseOrderDraft());
    setError(null);
  };

  return (
    <CreateDrawer
      open={open}
      title="Новый заказ поставщику"
      description="Черновик = заявка (ADR-034). Строки и подтверждение — на карточке."
      onClose={() => {
        reset();
        onClose();
      }}
      variant="overlay"
    >
      <form
        className="flex h-full min-h-0 flex-col"
        onSubmit={(event) => {
          event.preventDefault();
          if (!draft.supplierId) {
            setError("Выберите поставщика");
            return;
          }
          startTransition(async () => {
            setError(null);
            const result = await createPurchaseOrderRecord(draft);
            if (!result.ok) {
              setError(result.message);
              return;
            }
            reset();
            onClose();
            router.push(`/purchases/orders/${result.id}`);
            router.refresh();
          });
        }}
      >
        <div className="min-h-0 flex-1 space-y-portal-3 overflow-y-auto p-portal-4">
          {error ? (
            <InlineAlert tone="danger" size="compact">
              {error}
            </InlineAlert>
          ) : null}
          <Field label="Поставщик" htmlFor="po-create-supplier" required>
            <Select
              id="po-create-supplier"
              value={draft.supplierId}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  supplierId: event.target.value,
                }))
              }
              required
            >
              <option value="">Выберите поставщика</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={String(supplier.id)}>
                  {supplier.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Ожидаемая дата" htmlFor="po-create-date">
            <Input
              id="po-create-date"
              type="date"
              value={draft.expectedDate}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  expectedDate: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Склад прихода (опц.)" htmlFor="po-create-warehouse">
            <Select
              id="po-create-warehouse"
              value={draft.warehouseId}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  warehouseId: event.target.value,
                }))
              }
            >
              <option value="">Не выбран</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={String(warehouse.id)}>
                  {warehouse.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Комментарий" htmlFor="po-create-notes">
            <Textarea
              id="po-create-notes"
              value={draft.notes}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  notes: event.target.value,
                }))
              }
              rows={3}
            />
          </Field>
        </div>
        <div className="flex shrink-0 justify-end gap-2 border-t border-portal-border p-portal-4">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              reset();
              onClose();
            }}
          >
            Отмена
          </Button>
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? "Создание…" : "Создать"}
          </Button>
        </div>
      </form>
    </CreateDrawer>
  );
}
