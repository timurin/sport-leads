"use client";

import Link from "next/link";
import { Filter, FilterX, Printer, Sparkles, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { generateTechCardsFromOrderAction } from "@/app/(workspace)/production/tech-cards/tech-card-actions";
import { Button, IconButton } from "@/components/ui/button";
import { CreateDrawer } from "@/components/ui/create-drawer";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableFrame,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
} from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { EntityLink } from "@/components/ui/entity-link";
import { Field, Input, Select } from "@/components/ui/form-controls";
import { ListTotals } from "@/components/ui/list-pagination";
import { PageToolbar } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/components/ui/toast";
import {
  asTechCardUiStatus,
  filterTechCardsClient,
  formatTechCardDateTime,
  techCardModelLabel,
  techCardOrderLabel,
  techCardPositionLabel,
  techCardStatusTone,
} from "@/lib/production/tech-cards";
import type { ApiTechnicalCardListItem } from "@/lib/sales/order-tech-cards-api";
import { techCardStatusLabel } from "@/lib/sales/order-tech-cards";

const STATUS_FILTER_ITEMS: { value: string; label: string }[] = [
  { value: "", label: "Все статусы" },
  { value: "draft", label: "Черновик" },
  { value: "in_progress", label: "В работе" },
  { value: "completed", label: "Завершена" },
  { value: "cancelled", label: "Отменена" },
];

/** PT-02 production technical cards list. */
export function TechCardsWorkspace({
  cards,
  orderId,
}: {
  cards: ApiTechnicalCardListItem[];
  orderId?: string;
}) {
  const router = useRouter();
  const { push: pushToast } = useToast();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [generateOrderId, setGenerateOrderId] = useState(orderId ?? "");
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const filterRef = useRef<HTMLDivElement>(null);

  const filtersActive = Boolean(statusFilter) || Boolean(stageFilter.trim());

  useEffect(() => {
    if (!filterOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!filterRef.current?.contains(event.target as Node)) {
        setFilterOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFilterOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [filterOpen]);

  const filtered = useMemo(
    () =>
      filterTechCardsClient(cards, {
        search: query,
        status: statusFilter,
        stage: stageFilter,
      }),
    [cards, query, stageFilter, statusFilter],
  );

  const clearFilters = () => {
    setStatusFilter("");
    setStageFilter("");
    setFilterOpen(false);
  };

  const openGenerate = () => {
    setGenerateOrderId(orderId ?? "");
    setGenerateError(null);
    setGenerateOpen(true);
  };

  const runGenerate = async (targetOrderId: string) => {
    const trimmed = targetOrderId.trim();
    if (!trimmed) {
      setGenerateError("Укажите ID заказа");
      return;
    }

    setGenerating(true);
    setGenerateError(null);
    try {
      const result = await generateTechCardsFromOrderAction(trimmed);
      if (!result.ok) {
        setGenerateError(result.message ?? "Ошибка формирования");
        setGenerating(false);
        return;
      }
      pushToast(result.message ?? "Техкарты сформированы", "success");
      setGenerateOpen(false);
      if (orderId !== trimmed) {
        router.push(`/production/tech-cards?orderId=${encodeURIComponent(trimmed)}`);
      } else {
        router.refresh();
      }
    } catch {
      setGenerateError("Не удалось сформировать техкарты");
    }
    setGenerating(false);
  };

  const onGenerateSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void runGenerate(generateOrderId);
  };

  const onGeneratePrimary = () => {
    if (orderId) {
      void runGenerate(orderId);
      return;
    }
    openGenerate();
  };

  const onPrint = () => {
    pushToast("Печать списка техкарт — скоро", "neutral");
  };

  const detailHref = (cardId: number) => {
    const base = `/production/tech-cards/${cardId}`;
    return orderId ? `${base}?orderId=${encodeURIComponent(orderId)}` : base;
  };

  const emptyDescription =
    cards.length === 0
      ? orderId
        ? "По этому заказу техкарт нет. Сформируйте их из заказа."
        : "Техкарт пока нет. Сформируйте их из заказа продаж."
      : "Измените поиск или фильтры, либо сбросьте их.";

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <CreateDrawer
        open={generateOpen}
        title="Сформировать техкарты из заказа"
        description="Укажите ID заказа продаж — будут созданы техкарты для eligible позиций."
        onClose={() => {
          if (generating) return;
          setGenerateOpen(false);
        }}
        variant="overlay"
      >
        <form className="space-y-portal-4" onSubmit={onGenerateSubmit}>
          <Field label="ID заказа" required>
            <Input
              value={generateOrderId}
              onChange={(event) => setGenerateOrderId(event.target.value)}
              placeholder="Например, 4"
              disabled={generating}
              inputMode="numeric"
            />
          </Field>
          {generateError ? (
            <p className="text-portal-body text-portal-danger" role="alert">
              {generateError}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-portal-2">
            <Button type="submit" variant="primary" disabled={generating}>
              {generating ? "Формирование…" : "Сформировать"}
            </Button>
            <Button type="button" disabled={generating} onClick={() => setGenerateOpen(false)}>
              Отмена
            </Button>
          </div>
        </form>
      </CreateDrawer>

      <PageToolbar
        start={
          <div className="flex min-w-0 w-full flex-1 items-center gap-1">
            {orderId ? (
              <Link
                href="/production/tech-cards"
                className="inline-flex shrink-0 items-center gap-1 rounded-portal-md border border-portal-border bg-portal-surface-secondary px-portal-2 py-1 text-portal-caption font-medium text-portal-text hover:bg-portal-state-hover"
              >
                Заказ #{orderId}
                <X className="size-3.5" aria-hidden="true" />
              </Link>
            ) : null}
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Поиск по № ТК, заказу, позиции, модели"
              size="compact"
              className="min-w-0 flex-1 basis-0"
              aria-label="Поиск техкарт"
            />
            <div
              className="flex shrink-0 items-center gap-1"
              role="group"
              aria-label="Действия списка"
            >
              <IconButton
                label="Сбросить поиск"
                variant="secondary"
                disabled={!query}
                onClick={() => setQuery("")}
              >
                <X className="size-4" aria-hidden="true" />
              </IconButton>
              <div className="relative" ref={filterRef}>
                <IconButton
                  label="Фильтр"
                  variant={filtersActive ? "primary" : "secondary"}
                  aria-expanded={filterOpen}
                  aria-haspopup="dialog"
                  onClick={() => setFilterOpen((open) => !open)}
                >
                  <Filter className="size-4" aria-hidden="true" />
                </IconButton>
                {filterOpen ? (
                  <div
                    role="dialog"
                    aria-label="Фильтр техкарт"
                    className="absolute right-0 z-20 mt-1 w-[min(100vw-2rem,16rem)] space-y-portal-3 rounded-portal-md border border-portal-border bg-portal-surface p-portal-3 shadow-portal-card"
                  >
                    <Field label="Статус">
                      <Select
                        value={statusFilter}
                        onChange={(event) => setStatusFilter(event.target.value)}
                      >
                        {STATUS_FILTER_ITEMS.map((item) => (
                          <option key={item.value || "all"} value={item.value}>
                            {item.label}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Участок">
                      <Input
                        value={stageFilter}
                        onChange={(event) => setStageFilter(event.target.value)}
                        placeholder="Подстрока участка"
                      />
                    </Field>
                    <Button type="button" size="compact" onClick={clearFilters}>
                      Очистить фильтры
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        }
        end={
          <div className="flex flex-wrap items-center gap-1">
            <IconButton label="Печать" variant="secondary" onClick={onPrint}>
              <Printer className="size-4" aria-hidden="true" />
            </IconButton>
            <IconButton
              label="Сбросить фильтры"
              variant="secondary"
              disabled={!filtersActive && !query}
              onClick={() => {
                setQuery("");
                clearFilters();
              }}
            >
              <FilterX className="size-4" aria-hidden="true" />
            </IconButton>
            <Button
              type="button"
              variant="primary"
              disabled={generating}
              onClick={onGeneratePrimary}
              className="inline-flex items-center gap-portal-2"
            >
              <Sparkles className="size-4" aria-hidden="true" />
              {generating ? "Формирование…" : "Сформировать из заказа"}
            </Button>
          </div>
        }
      />

      <section className="min-h-0 min-w-0 flex-1 overflow-auto bg-portal-surface">
        {filtered.length === 0 ? (
          <EmptyState title="Нет техкарт" description={emptyDescription} />
        ) : (
          <>
            <div className="hidden min-w-0 md:block">
              <DataTableFrame className="rounded-none border-x-0 border-b-0 shadow-none">
                <DataTable minWidthClassName="min-w-[960px]">
                  <DataTableHead>
                    <tr>
                      <DataTableHeaderCell className="w-40">№ ТК</DataTableHeaderCell>
                      <DataTableHeaderCell className="w-36">Заказ</DataTableHeaderCell>
                      <DataTableHeaderCell>Позиция</DataTableHeaderCell>
                      <DataTableHeaderCell className="w-44">Модель</DataTableHeaderCell>
                      <DataTableHeaderCell className="w-32">Статус</DataTableHeaderCell>
                      <DataTableHeaderCell className="w-36">Участок</DataTableHeaderCell>
                      <DataTableHeaderCell className="w-20">Кол-во</DataTableHeaderCell>
                      <DataTableHeaderCell className="w-36">Обновлено</DataTableHeaderCell>
                    </tr>
                  </DataTableHead>
                  <DataTableBody>
                    {filtered.map((card) => {
                      const status = asTechCardUiStatus(String(card.status));
                      return (
                        <DataTableRow key={card.id}>
                          <DataTableCell>
                            <Link
                              href={detailHref(card.id)}
                              className="font-medium text-portal-primary hover:underline"
                            >
                              {card.number}
                            </Link>
                          </DataTableCell>
                          <DataTableCell>
                            <EntityLink href={`/sales/orders/${card.sales_order_id}`}>
                              {techCardOrderLabel(card)}
                            </EntityLink>
                          </DataTableCell>
                          <DataTableCell>{techCardPositionLabel(card)}</DataTableCell>
                          <DataTableCell className="text-portal-muted">
                            {techCardModelLabel(card)}
                          </DataTableCell>
                          <DataTableCell>
                            <StatusBadge size="compact" tone={techCardStatusTone(status)}>
                              {techCardStatusLabel(status)}
                            </StatusBadge>
                          </DataTableCell>
                          <DataTableCell className="text-portal-muted">
                            {card.current_stage_label ?? "—"}
                          </DataTableCell>
                          <DataTableCell className="tabular-nums">
                            {card.quantity}
                          </DataTableCell>
                          <DataTableCell className="text-portal-muted">
                            {formatTechCardDateTime(card.updated_at)}
                          </DataTableCell>
                        </DataTableRow>
                      );
                    })}
                  </DataTableBody>
                </DataTable>
              </DataTableFrame>
            </div>

            <div className="flex flex-col gap-portal-3 p-portal-4 md:hidden">
              {filtered.map((card) => {
                const status = asTechCardUiStatus(String(card.status));
                return (
                  <article
                    key={card.id}
                    className="rounded-portal-md border border-portal-border bg-portal-surface p-portal-4 shadow-portal-card"
                  >
                    <div className="flex items-start justify-between gap-portal-3">
                      <Link
                        href={detailHref(card.id)}
                        className="font-semibold text-portal-primary hover:underline"
                      >
                        {card.number}
                      </Link>
                      <StatusBadge size="compact" tone={techCardStatusTone(status)}>
                        {techCardStatusLabel(status)}
                      </StatusBadge>
                    </div>
                    <dl className="mt-portal-3 grid gap-portal-2 text-portal-body">
                      <div className="flex justify-between gap-portal-3">
                        <dt className="text-portal-muted">Заказ</dt>
                        <dd>
                          <EntityLink href={`/sales/orders/${card.sales_order_id}`}>
                            {techCardOrderLabel(card)}
                          </EntityLink>
                        </dd>
                      </div>
                      <div className="flex justify-between gap-portal-3">
                        <dt className="text-portal-muted">Позиция</dt>
                        <dd className="text-right">{techCardPositionLabel(card)}</dd>
                      </div>
                      <div className="flex justify-between gap-portal-3">
                        <dt className="text-portal-muted">Участок</dt>
                        <dd className="text-right">{card.current_stage_label ?? "—"}</dd>
                      </div>
                      <div className="flex justify-between gap-portal-3">
                        <dt className="text-portal-muted">Обновлено</dt>
                        <dd className="text-right">{formatTechCardDateTime(card.updated_at)}</dd>
                      </div>
                    </dl>
                  </article>
                );
              })}
            </div>

            <ListTotals
              primary={`Показано: ${filtered.length} из ${cards.length} техкарт`}
            />
          </>
        )}
      </section>
    </div>
  );
}
