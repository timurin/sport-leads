"use client";

import { useEffect, useMemo, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import {
  linkStandaloneTechnicalCardAction,
  listOrdersForStandaloneLinkAction,
  previewOrderTechCardsForStandaloneLinkAction,
} from "@/app/(workspace)/production/tech-cards/tech-card-actions";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/form-controls";
import { SectionCard } from "@/components/ui/section-card";
import { useToast } from "@/components/ui/toast";
import type { ApiTechnicalCardPreviewLine } from "@/lib/sales/order-tech-cards-api";

type OrderOption = { id: number; number: string; client_name: string | null };

export function StandaloneTechCardLinkPanel({
  cardId,
  disabled = false,
}: {
  cardId: number;
  disabled?: boolean;
}) {
  const router = useRouter();
  const { push: pushToast } = useToast();
  const [pending, startTransition] = useTransition();
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

  useEffect(() => {
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
  }, []);

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
    <SectionCard
      title="Привязать к заказу"
      description="Самостоятельную техкарту можно один раз привязать к свободной позиции заказа покупателя. Номер техкарты не меняется."
      size="compact"
    >
      <form
        className="space-y-portal-4"
        onSubmit={onSubmit}
        data-standalone-link-sales-order
      >
        {loadError ? (
          <p className="text-portal-body text-portal-danger" role="alert">
            {loadError}
          </p>
        ) : null}
        <Field label="Заказ" required>
          <Select
            value={orderId}
            onChange={(event) => onSelectOrder(event.target.value)}
            disabled={busy || orders.length === 0}
          >
            <option value="">Выберите заказ…</option>
            {orders.map((order) => (
              <option key={order.id} value={order.id}>
                {order.number}
                {order.client_name ? ` · ${order.client_name}` : ""}
              </option>
            ))}
          </Select>
        </Field>
        {orderId ? (
          <Field label="Свободная позиция" required>
            <Select
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
        <Button
          type="submit"
          variant="primary"
          disabled={busy || !itemId}
        >
          {pending ? "Привязка…" : "Привязать"}
        </Button>
      </form>
    </SectionCard>
  );
}
