"use client";

import Link from "next/link";
import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import {
  attachTechnicalCardToBatchAction,
  createProductionBatchAction,
  detachTechnicalCardFromBatchAction,
} from "@/app/(workspace)/production/orders/production-order-actions";
import { ProductionFactRollupPanel } from "@/components/production/production-fact-rollup-panel";
import { Button, IconButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Select } from "@/components/ui/form-controls";
import { PageToolbar } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/components/ui/toast";
import {
  productionBatchStatusLabel,
  productionOrderStatusLabel,
  productionOrderStatusTone,
  type ProductionFactRollup,
  type ProductionOrderDetail,
} from "@/lib/production/production-orders";
import type { ApiTechnicalCardListItem } from "@/lib/sales/order-tech-cards-api";

function CollapseToggleButton({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <Button type="button" size="compact" variant="secondary" onClick={onToggle}>
      {collapsed ? (
        <>
          <ChevronRight className="size-4" aria-hidden="true" />
          Развернуть
        </>
      ) : (
        <>
          <ChevronDown className="size-4" aria-hidden="true" />
          Свернуть
        </>
      )}
    </Button>
  );
}

/** PT-03 / document-style production order card with batches. */
export function ProductionOrderDetailWorkspace({
  order,
  technicalCards,
  orderRollup,
  batchRollups,
}: {
  order: ProductionOrderDetail;
  technicalCards: ApiTechnicalCardListItem[];
  orderRollup: ProductionFactRollup;
  batchRollups: Record<number, ProductionFactRollup>;
}) {
  const router = useRouter();
  const { push: pushToast } = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachByBatch, setAttachByBatch] = useState<Record<number, string>>({});
  const [orderFactCollapsed, setOrderFactCollapsed] = useState(false);
  const [batchCollapsed, setBatchCollapsed] = useState<Record<number, boolean>>(
    {},
  );
  const [batchFactCollapsed, setBatchFactCollapsed] = useState<
    Record<number, boolean>
  >({});

  const refresh = () => router.refresh();

  const isBatchCollapsed = (batchId: number) => batchCollapsed[batchId] === true;
  const toggleBatchCollapsed = (batchId: number) => {
    setBatchCollapsed((current) => ({
      ...current,
      [batchId]: !current[batchId],
    }));
  };
  const isBatchFactCollapsed = (batchId: number) =>
    batchFactCollapsed[batchId] === true;
  const toggleBatchFactCollapsed = (batchId: number) => {
    setBatchFactCollapsed((current) => ({
      ...current,
      [batchId]: !current[batchId],
    }));
  };
  const onCreateBatch = async () => {
    setBusy(true);
    setError(null);
    const result = await createProductionBatchAction(order.id, {});
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    pushToast("Партия создана", "success");
    refresh();
  };

  const onAttach = async (event: FormEvent, batchId: number) => {
    event.preventDefault();
    const raw = attachByBatch[batchId]?.trim() ?? "";
    const cardId = Number(raw);
    if (!Number.isSafeInteger(cardId) || cardId <= 0) {
      setError("Выберите техкарту");
      return;
    }
    setBusy(true);
    setError(null);
    const result = await attachTechnicalCardToBatchAction(order.id, batchId, cardId);
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    pushToast("Техкарта привязана", "success");
    setAttachByBatch((current) => ({ ...current, [batchId]: "" }));
    refresh();
  };

  const onDetach = async (batchId: number, cardId: number) => {
    if (!window.confirm(`Отвязать техкарту #${cardId} от партии?`)) return;
    setBusy(true);
    setError(null);
    const result = await detachTechnicalCardFromBatchAction(order.id, batchId, cardId);
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    pushToast("Техкарта отвязана", "success");
    refresh();
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <PageToolbar
        start={
          <div className="flex min-w-0 flex-wrap items-center gap-portal-2">
            <Link
              href="/production/orders"
              className="text-portal-body text-portal-muted hover:text-portal-text"
            >
              ← Заказы
            </Link>
            <p className="text-portal-body font-semibold text-portal-text">
              {order.number}
            </p>
            <StatusBadge
              size="compact"
              tone={productionOrderStatusTone(order.status)}
            >
              {productionOrderStatusLabel(order.status)}
            </StatusBadge>
          </div>
        }
        end={
          <Button
            variant="primary"
            disabled={busy || order.status === "cancelled"}
            onClick={() => void onCreateBatch()}
          >
            <Plus className="size-4" aria-hidden="true" />
            Партия
          </Button>
        }
      />

      <div className="min-h-0 flex-1 space-y-portal-4 overflow-auto p-portal-4 lg:p-portal-6">
        {error ? (
          <p className="text-portal-body text-portal-danger" role="alert">
            {error}
          </p>
        ) : null}

        <SectionCard title="Реквизиты" size="compact">
          <dl className="grid gap-portal-3 sm:grid-cols-2">
            <div>
              <dt className="text-portal-caption text-portal-muted">Заказ покупателя</dt>
              <dd className="mt-1 text-portal-body">
                <Link
                  href={`/sales/orders/${order.sales_order_id}`}
                  className="text-portal-primary hover:underline"
                >
                  {order.sales_order_number?.trim() || `#${order.sales_order_id}`}
                </Link>
              </dd>
            </div>
            <div>
              <dt className="text-portal-caption text-portal-muted">Порядок</dt>
              <dd className="mt-1 text-portal-body">{order.order_seq}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-portal-caption text-portal-muted">Примечание</dt>
              <dd className="mt-1 text-portal-body">{order.notes?.trim() || "—"}</dd>
            </div>
          </dl>
        </SectionCard>

        <SectionCard
          title="Сводка факта заказа"
          description="Только чтение · источники — техкарты партий"
          size="compact"
          collapsed={orderFactCollapsed}
          actions={
            <CollapseToggleButton
              collapsed={orderFactCollapsed}
              onToggle={() => setOrderFactCollapsed((current) => !current)}
            />
          }
        >
          <ProductionFactRollupPanel rollup={orderRollup} title="По всем партиям" />
        </SectionCard>

        {order.batches.length === 0 ? (
          <EmptyState
            title="Нет партий"
            description="Создайте партию и привяжите техкарты того же заказа покупателя."
          />
        ) : (
          order.batches.map((batch) => {
            const editable = batch.status === "draft";
            const linkedCardIds = new Set(
              order.batches.flatMap((item) =>
                item.card_links.map((link) => link.technical_card_id),
              ),
            );
            const availableCards = technicalCards.filter(
              (card) => !linkedCardIds.has(card.id),
            );
            const batchIsCollapsed = isBatchCollapsed(batch.id);
            const batchFactIsCollapsed = isBatchFactCollapsed(batch.id);
            return (
              <SectionCard
                key={batch.id}
                title={batch.number}
                description={`Партия · seq ${batch.batch_seq}`}
                size="compact"
                collapsed={batchIsCollapsed}
                actions={
                  <div className="flex flex-wrap items-center gap-portal-2">
                    <StatusBadge
                      size="compact"
                      tone={productionOrderStatusTone(batch.status)}
                    >
                      {productionBatchStatusLabel(batch.status)}
                    </StatusBadge>
                    <CollapseToggleButton
                      collapsed={batchIsCollapsed}
                      onToggle={() => toggleBatchCollapsed(batch.id)}
                    />
                  </div>
                }
              >
                {batch.card_links.length === 0 ? (
                  <p className="text-portal-caption text-portal-muted">
                    Техкарты не привязаны.
                  </p>
                ) : (
                  <ul className="space-y-portal-2">
                    {batch.card_links.map((link) => (
                      <li
                        key={link.id}
                        className="flex items-center justify-between gap-portal-2 rounded-portal-md border border-portal-border px-portal-3 py-portal-2"
                      >
                        <Link
                          href={`/production/tech-cards/${link.technical_card_id}`}
                          className="text-portal-body text-portal-primary hover:underline"
                        >
                          {link.technical_card_number?.trim() ||
                            `ТК #${link.technical_card_id}`}
                        </Link>
                        {editable ? (
                          <IconButton
                            label="Отвязать техкарту"
                            variant="secondary"
                            disabled={busy}
                            onClick={() =>
                              void onDetach(batch.id, link.technical_card_id)
                            }
                          >
                            <Trash2 className="size-4" aria-hidden="true" />
                          </IconButton>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}

                {editable ? (
                  <form
                    className="mt-portal-3 flex flex-wrap items-end gap-portal-2"
                    onSubmit={(event) => void onAttach(event, batch.id)}
                  >
                    <Field label="Техкарта" className="min-w-[14rem] flex-1">
                      <Select
                        value={attachByBatch[batch.id] ?? ""}
                        onChange={(event) =>
                          setAttachByBatch((current) => ({
                            ...current,
                            [batch.id]: event.target.value,
                          }))
                        }
                        disabled={busy}
                      >
                        <option value="">Выберите техкарту…</option>
                        {availableCards.map((card) => (
                          <option key={card.id} value={card.id}>
                            {card.number} · {card.nomenclature_name}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Button type="submit" variant="secondary" disabled={busy}>
                      Привязать
                    </Button>
                  </form>
                ) : null}
                {editable && availableCards.length === 0 ? (
                  <p className="mt-portal-2 text-portal-caption text-portal-muted">
                    Свободных техкарт для этого заказа нет.
                  </p>
                ) : null}

                <div className="mt-portal-4 border-t border-portal-border pt-portal-3">
                  <div className="rounded-portal-lg border border-portal-border bg-portal-surface-secondary/40">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-portal-2 rounded-portal-lg px-portal-3 py-portal-2.5 text-left transition-colors hover:bg-portal-state-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-focus-ring"
                      aria-expanded={!batchFactIsCollapsed}
                      onClick={() => toggleBatchFactCollapsed(batch.id)}
                    >
                      <span className="text-portal-caption font-semibold tracking-wide text-portal-muted uppercase">
                        Факт партии
                      </span>
                      <span className="inline-flex shrink-0 items-center gap-1 text-portal-caption text-portal-muted">
                        {batchFactIsCollapsed ? (
                          <>
                            Развернуть
                            <ChevronRight className="size-4" aria-hidden="true" />
                          </>
                        ) : (
                          <>
                            Свернуть
                            <ChevronDown className="size-4" aria-hidden="true" />
                          </>
                        )}
                      </span>
                    </button>
                    {batchFactIsCollapsed ? null : (
                      <div className="border-t border-portal-border px-portal-3 py-portal-3">
                        {batchRollups[batch.id] ? (
                          <ProductionFactRollupPanel
                            rollup={batchRollups[batch.id]}
                            title="Сводка по привязанным ТК"
                          />
                        ) : (
                          <p className="text-portal-caption text-portal-muted">
                            Сводка факта партии недоступна.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </SectionCard>
            );
          })
        )}
      </div>
    </div>
  );
}
