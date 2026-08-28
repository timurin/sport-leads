"use client";

import { useEffect, useMemo, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import {
  linkStandaloneTechnicalCardAction,
  listOrdersForStandaloneLinkAction,
  previewOrderTechCardsForStandaloneLinkAction,
} from "@/app/(workspace)/production/tech-cards/tech-card-actions";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select } from "@/components/ui/form-controls";
import { useToast } from "@/components/ui/toast";
import type { ApiTechnicalCardPreviewLine } from "@/lib/sales/order-tech-cards-api";

type OrderOption = { id: number; number: string; client_name: string | null };

export function StandaloneTechCardLinkPanel({
  cardId,
  orderNumber,
  draftOrderNumber,
  onDraftOrderNumberChange,
  manualEditable = false,
  disabled = false,
}: {
  cardId: number;
  orderNumber: string;
  draftOrderNumber: string;
  onDraftOrderNumberChange: (value: string) => void;
  manualEditable?: boolean;
  disabled?: boolean;
}) {
  const router = useRouter();
  const { push: pushToast } = useToast();
  const [pending, startTransition] = useTransition();
  const [pickOrder, setPickOrder] = useState(false);
  const [orders, setOrders] = useState<OrderOption[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [orderId, setOrderId] = useState("");
  const [lines, setLines] = useState<ApiTechnicalCardPreviewLine[]>([]);
  const [itemId, setItemId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const busy = disabled || pending;
  const freeLines = useMemo(
    () => lines.filter((line) => line.would_create),
    [lines],
  );
  const manualValue = manualEditable ? draftOrderNumber : orderNumber;
  const displayValue = (manualValue || "").trim() || "—";

  useEffect(() => {
    if (!pickOrder) return;
    let cancelled = false;
    void listOrdersForStandaloneLinkAction().then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setLoadError(result.message);
        setOrders([]);
        return;
      }
      setLoadError(null);
      setOrders(result.orders);
    });
    return () => {
      cancelled = true;
    };
  }, [pickOrder]);

  const resetOrderPick = () => {
    setOrderId("");
    setItemId("");
    setLines([]);
    setFormError(null);
  };

  const onTogglePick = (checked: boolean) => {
    setPickOrder(checked);
    if (!checked) resetOrderPick();
  };

  const onSelectOrder = (nextOrderId: string) => {
    setOrderId(nextOrderId);
    setItemId("");
    setLines([]);
    setFormError(null);
    if (!nextOrderId) return;
    startTransition(() => {
      void previewOrderTechCardsForStandaloneLinkAction(Number(nextOrderId)).then(
        (result) => {
          if (!result.ok) {
            setFormError(result.message);
            setLines([]);
            return;
          }
          setFormError(null);
          setLines(result.preview.lines);
        },
      );
    });
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!pickOrder) return;
    const salesOrderItemId = Number(itemId);
    if (!Number.isInteger(salesOrderItemId) || salesOrderItemId < 1) {
      setFormError("Выберите свободную позицию заказа");
      return;
    }
    setFormError(null);
    startTransition(() => {
      void linkStandaloneTechnicalCardAction(cardId, salesOrderItemId).then(
        (result) => {
          if (!result.ok) {
            setFormError(result.message ?? "Не удалось привязать техкарту");
            return;
          }
          if (result.message) pushToast(result.message, "success");
          router.refresh();
        },
      );
    });
  };

  return (
    <form
      className="min-w-0 space-y-portal-2"
      onSubmit={onSubmit}
      data-standalone-link-sales-order
    >
      {loadError ? (
        <p className="text-portal-body text-portal-danger" role="alert">
          {loadError}
        </p>
      ) : null}
      <div className="min-w-0" data-tech-card-order-row data-form-field>
        <div className="flex min-w-0 items-center justify-between gap-portal-2">
          <label
            htmlFor="tech-card-order-number"
            className="text-portal-caption text-portal-muted"
          >
            Заказ
          </label>
          <Checkbox
            id="tech-card-select-order"
            label={
              <span className="whitespace-nowrap text-portal-caption text-portal-primary">
                Выбрать заказ
              </span>
            }
            checked={pickOrder}
            disabled={busy}
            data-tech-card-select-order
            onChange={(event) => onTogglePick(event.target.checked)}
          />
        </div>
        <div className="mt-1 min-w-0">
          {pickOrder ? (
            <Select
              id="tech-card-order-number"
              size="compact"
              value={orderId}
              onChange={(event) => onSelectOrder(event.target.value)}
              disabled={busy || (orders.length === 0 && !loadError)}
              data-tech-card-order-select
            >
              <option value="">Выберите заказ…</option>
              {orders.map((order) => (
                <option key={order.id} value={order.id}>
                  {order.number}
                  {order.client_name ? ` · ${order.client_name}` : ""}
                </option>
              ))}
            </Select>
          ) : manualEditable ? (
            <Input
              id="tech-card-order-number"
              size="compact"
              value={manualValue}
              disabled={busy}
              placeholder="Номер из другой системы"
              data-tech-card-order-number
              onChange={(event) => onDraftOrderNumberChange(event.target.value)}
            />
          ) : (
            <p
              id="tech-card-order-number"
              className="text-portal-body"
              data-tech-card-order-number
            >
              {displayValue}
            </p>
          )}
        </div>
      </div>
      {pickOrder && orderId ? (
        <Field label="Свободная позиция" required>
          <Select
            size="compact"
            value={itemId}
            onChange={(event) => setItemId(event.target.value)}
            disabled={busy || freeLines.length === 0}
          >
            <option value="">
              {freeLines.length === 0
                ? "Нет свободных eligible позиций"
                : "Выберите позицию…"}
            </option>
            {freeLines.map((line) => (
              <option key={line.sales_order_item_id} value={line.sales_order_item_id}>
                {line.position}. {line.snapshot_name} · {line.quantity}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}
      {formError ? (
        <p className="text-portal-body text-portal-danger" role="alert">
          {formError}
        </p>
      ) : null}
      {pickOrder ? (
        <Button
          type="submit"
          variant="primary"
          size="compact"
          disabled={busy || !itemId}
        >
          {pending ? "Привязка…" : "Привязать"}
        </Button>
      ) : null}
    </form>
  );
}
