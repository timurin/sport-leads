"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import {
  addPurchaseOrderLineRecord,
  cancelPurchaseOrderRecord,
  confirmPurchaseOrderRecord,
  deletePurchaseOrderLineRecord,
  savePurchaseOrderHeader,
} from "@/app/(workspace)/purchases/orders/purchase-order-actions";
import { SimpleEntityCard } from "@/components/entity/simple-entity-card";
import { Button } from "@/components/ui/button";
import { EntityHeader } from "@/components/ui/entity-header";
import { Field, Input, Select, Textarea } from "@/components/ui/form-controls";
import { InlineAlert } from "@/components/ui/inline-alert";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  formatMoneyRub,
  purchaseOrderStatusLabel,
  purchaseOrderStatusTone,
  type PurchaseOrderDetailView,
} from "@/lib/purchases/purchase-orders";

export type NomenclatureOption = { id: number; name: string };
export type WarehouseOption = { id: number; name: string };

type Props = {
  order: PurchaseOrderDetailView;
  nomenclatureOptions: NomenclatureOption[];
  warehouses: WarehouseOption[];
};

/** PT-05 purchase order card + lines (`DS-PT-05`). */
export function PurchaseOrderCard({
  order,
  nomenclatureOptions,
  warehouses,
}: Props) {
  const router = useRouter();
  const [expectedDate, setExpectedDate] = useState(order.expectedDate);
  const [warehouseId, setWarehouseId] = useState(
    order.warehouseId != null ? String(order.warehouseId) : "",
  );
  const [notes, setNotes] = useState(order.notes);
  const [error, setError] = useState<string | null>(null);
  const [lineError, setLineError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [nomenclatureId, setNomenclatureId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");
  const [comment, setComment] = useState("");

  const isDraft = order.status === "draft";
  const canCancel =
    order.status === "draft" || order.status === "ordered";

  const usedIds = useMemo(
    () => new Set(order.lines.map((line) => line.nomenclatureId)),
    [order.lines],
  );
  const availableOptions = nomenclatureOptions.filter(
    (item) => !usedIds.has(item.id),
  );

  const refresh = () => router.refresh();

  return (
    <SimpleEntityCard
      header={
        <EntityHeader
          eyebrow={
            <Link
              href="/purchases/orders"
              className="text-portal-primary hover:underline"
            >
              Заказы поставщикам
            </Link>
          }
          title={order.number}
          description={`${order.supplierName} · ADR-034 · приход склада — 13.2.1`}
          status={
            <StatusBadge
              tone={purchaseOrderStatusTone(order.status)}
              size="compact"
            >
              {purchaseOrderStatusLabel(order.status)}
            </StatusBadge>
          }
          actions={
            <div className="flex flex-wrap gap-2">
              {isDraft ? (
                <Button
                  type="button"
                  variant="primary"
                  disabled={pending || order.lines.length === 0}
                  onClick={() => {
                    startTransition(async () => {
                      setError(null);
                      const result = await confirmPurchaseOrderRecord(order.id);
                      if (!result.ok) {
                        setError(result.message);
                        return;
                      }
                      refresh();
                    });
                  }}
                >
                  Подтвердить
                </Button>
              ) : null}
              {canCancel ? (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => {
                    startTransition(async () => {
                      setError(null);
                      const result = await cancelPurchaseOrderRecord(order.id);
                      if (!result.ok) {
                        setError(result.message);
                        return;
                      }
                      refresh();
                    });
                  }}
                >
                  Отменить
                </Button>
              ) : null}
            </div>
          }
        />
      }
    >
      <SectionCard
        title="Шапка"
        description={`Сумма ${formatMoneyRub(order.totalAmount)}. Подтверждение не пишет склад.`}
        size="compact"
      >
        {error ? (
          <InlineAlert tone="danger" size="compact">
            {error}
          </InlineAlert>
        ) : null}
        <div className="grid gap-portal-3 md:grid-cols-2">
          <Field label="Поставщик">
            <Input value={order.supplierName} disabled readOnly />
          </Field>
          <Field label="Валюта">
            <Input value={order.currency} disabled readOnly />
          </Field>
          <Field label="Ожидаемая дата" htmlFor="po-expected">
            <Input
              id="po-expected"
              type="date"
              value={expectedDate}
              disabled={!isDraft || pending}
              onChange={(event) => setExpectedDate(event.target.value)}
            />
          </Field>
          <Field label="Склад прихода" htmlFor="po-warehouse">
            <Select
              id="po-warehouse"
              value={warehouseId}
              disabled={!isDraft || pending}
              onChange={(event) => setWarehouseId(event.target.value)}
            >
              <option value="">Не выбран</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={String(warehouse.id)}>
                  {warehouse.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Комментарий" htmlFor="po-notes" className="md:col-span-2">
            <Textarea
              id="po-notes"
              value={notes}
              disabled={!isDraft || pending}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
            />
          </Field>
        </div>
        {isDraft ? (
          <div className="mt-portal-3 flex justify-end">
            <Button
              type="button"
              variant="primary"
              disabled={pending}
              onClick={() => {
                startTransition(async () => {
                  setError(null);
                  const result = await savePurchaseOrderHeader({
                    orderId: order.id,
                    expectedDate,
                    warehouseId,
                    notes,
                  });
                  if (!result.ok) {
                    setError(result.message);
                    return;
                  }
                  refresh();
                });
              }}
            >
              Сохранить шапку
            </Button>
          </div>
        ) : null}
      </SectionCard>

      <SectionCard
        title="Строки"
        description="Цена по умолчанию из прайса поставщика, если не указана явно."
        size="compact"
      >
        {lineError ? (
          <InlineAlert tone="danger" size="compact">
            {lineError}
          </InlineAlert>
        ) : null}

        {order.lines.length === 0 ? (
          <p className="text-portal-caption text-portal-muted">
            Строк пока нет. Добавьте номенклатуру ниже.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead>
                <tr className="border-b border-portal-border text-portal-caption text-portal-muted">
                  <th className="py-2 pr-3 font-medium">Номенклатура</th>
                  <th className="py-2 pr-3 font-medium">Кол-во</th>
                  <th className="py-2 pr-3 font-medium">Цена</th>
                  <th className="py-2 pr-3 font-medium">Сумма</th>
                  <th className="py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {order.lines.map((line) => (
                  <tr
                    key={line.id}
                    className="border-b border-portal-border/60"
                  >
                    <td className="py-2 pr-3">{line.nomenclatureName}</td>
                    <td className="py-2 pr-3">{line.quantity}</td>
                    <td className="py-2 pr-3">
                      {formatMoneyRub(line.unitPrice)}
                    </td>
                    <td className="py-2 pr-3">
                      {formatMoneyRub(line.lineAmount)}
                    </td>
                    <td className="py-2 text-right">
                      {isDraft ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="compact"
                          disabled={pending}
                          onClick={() => {
                            startTransition(async () => {
                              setLineError(null);
                              const result = await deletePurchaseOrderLineRecord({
                                orderId: order.id,
                                lineId: line.id,
                              });
                              if (!result.ok) {
                                setLineError(result.message);
                                return;
                              }
                              refresh();
                            });
                          }}
                        >
                          Удалить
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {isDraft ? (
          <div className="mt-portal-4 grid gap-portal-3 md:grid-cols-4">
            <Field label="Номенклатура" htmlFor="po-line-nom" className="md:col-span-2">
              <Select
                id="po-line-nom"
                value={nomenclatureId}
                onChange={(event) => setNomenclatureId(event.target.value)}
              >
                <option value="">Выберите</option>
                {availableOptions.map((item) => (
                  <option key={item.id} value={String(item.id)}>
                    {item.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Кол-во" htmlFor="po-line-qty">
              <Input
                id="po-line-qty"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
              />
            </Field>
            <Field label="Цена (опц.)" htmlFor="po-line-price">
              <Input
                id="po-line-price"
                value={unitPrice}
                onChange={(event) => setUnitPrice(event.target.value)}
                placeholder="из прайса"
              />
            </Field>
            <Field label="Комментарий" htmlFor="po-line-comment" className="md:col-span-3">
              <Input
                id="po-line-comment"
                value={comment}
                onChange={(event) => setComment(event.target.value)}
              />
            </Field>
            <div className="flex items-end">
              <Button
                type="button"
                variant="primary"
                disabled={pending || !nomenclatureId}
                onClick={() => {
                  startTransition(async () => {
                    setLineError(null);
                    const result = await addPurchaseOrderLineRecord({
                      orderId: order.id,
                      nomenclatureId: Number(nomenclatureId),
                      quantity,
                      unitPrice,
                      comment,
                    });
                    if (!result.ok) {
                      setLineError(result.message);
                      return;
                    }
                    setNomenclatureId("");
                    setQuantity("1");
                    setUnitPrice("");
                    setComment("");
                    refresh();
                  });
                }}
              >
                Добавить
              </Button>
            </div>
          </div>
        ) : null}
      </SectionCard>
    </SimpleEntityCard>
  );
}
