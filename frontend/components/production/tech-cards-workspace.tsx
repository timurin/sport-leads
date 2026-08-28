"use client";

import Link from "next/link";
import {
  BookMarked,
  Copy,
  Filter,
  FilterX,
  Pencil,
  Plus,
  Printer,
  Save,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";

import {
  copyTechnicalCardAction,
  createStandaloneTechnicalCardAction,
  deleteTechnicalCardAction,
  generateTechCardsFromOrderAction,
} from "@/app/(workspace)/production/tech-cards/tech-card-actions";
import { NomenclaturePickModal } from "@/components/sales/nomenclature-pick-modal";
import { CompactTabs } from "@/components/ui/compact-tabs";
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
import type { Nomenclature, NomenclatureCategory } from "@/lib/nomenclature";
import {
  asTechCardUiStatus,
  filterTechCardsClient,
  parseTechCardListView,
  type TechCardListView,
  formatTechCardDateTime,
  techCardModelLabel,
  techCardOrderLabel,
  techCardPositionLabel,
  techCardStatusTone,
} from "@/lib/production/tech-cards";
import { techCardVisibleNumber } from "@/lib/production/tech-card-display";
import type { ApiTechnicalCardListItem } from "@/lib/sales/order-tech-cards-api";
import { techCardStatusLabel } from "@/lib/sales/order-tech-cards";

const STATUS_FILTER_ITEMS: { value: string; label: string }[] = [
  { value: "", label: "Все статусы" },
  { value: "draft", label: "Черновик" },
  { value: "in_progress", label: "В работе" },
  { value: "completed", label: "Завершена" },
  { value: "cancelled", label: "Отменена" },
];

function TechCardOrderCell({ card }: { card: ApiTechnicalCardListItem }) {
  const label = techCardOrderLabel(card);
  if (card.sales_order_id == null) {
    return <span>{label}</span>;
  }
  return <EntityLink href={`/sales/orders/${card.sales_order_id}`}>{label}</EntityLink>;
}

/** PT-02 production technical cards list. */
export function TechCardsWorkspace({
  cards,
  orderId,
  productNomenclatures = [],
  categories = [],
  view = "list",
  kanban = null,
}: {
  cards: ApiTechnicalCardListItem[];
  orderId?: string;
  productNomenclatures?: Nomenclature[];
  categories?: NomenclatureCategory[];
  view?: TechCardListView;
  kanban?: ReactNode;
}) {
  const router = useRouter();
  const { push: pushToast } = useToast();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [responsibleFilter, setResponsibleFilter] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [generateOrderId, setGenerateOrderId] = useState(orderId ?? "");
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createNomenclatureId, setCreateNomenclatureId] = useState("");
  const [createNomenclatureName, setCreateNomenclatureName] = useState("");
  const [createNomenclatureDraft, setCreateNomenclatureDraft] = useState("");
  const [createNomenclatureEditing, setCreateNomenclatureEditing] = useState(false);
  const [pickOpen, setPickOpen] = useState(false);
  const [createOrderNumber, setCreateOrderNumber] = useState("");
  const [createPlannedCount, setCreatePlannedCount] = useState("1");
  const [createDesiredDate, setCreateDesiredDate] = useState("");
  const [rowBusyId, setRowBusyId] = useState<number | null>(null);
  const filterRef = useRef<HTMLDivElement>(null);
  const listView = parseTechCardListView(view);

  const filtersActive =
    Boolean(statusFilter) ||
    Boolean(stageFilter.trim()) ||
    Boolean(responsibleFilter.trim());

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
        responsible: responsibleFilter,
      }),
    [cards, query, responsibleFilter, stageFilter, statusFilter],
  );

  const clearFilters = () => {
    setStatusFilter("");
    setStageFilter("");
    setResponsibleFilter("");
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

  const resetCreateForm = () => {
    setCreateNomenclatureId("");
    setCreateNomenclatureName("");
    setCreateNomenclatureDraft("");
    setCreateNomenclatureEditing(false);
    setPickOpen(false);
    setCreateOrderNumber("");
    setCreatePlannedCount("1");
    setCreateDesiredDate("");
    setCreateError(null);
  };

  const saveNomenclatureName = () => {
    setCreateNomenclatureName(createNomenclatureDraft.trim());
    setCreateNomenclatureEditing(false);
  };

  const viewHref = (next: TechCardListView) => {
    const params = new URLSearchParams();
    if (next === "kanban") params.set("view", "kanban");
    if (orderId) params.set("orderId", orderId);
    const queryString = params.toString();
    return queryString ? `/production/tech-cards?${queryString}` : "/production/tech-cards";
  };

  const onCopyCard = async (cardId: number) => {
    setRowBusyId(cardId);
    try {
      const result = await copyTechnicalCardAction(cardId);
      if (!result.ok) {
        pushToast(result.message ?? "Не удалось скопировать", "danger");
      } else {
        pushToast(result.message ?? "Скопировано", "success");
        if (result.card) {
          router.push(detailHref(result.card.id));
          return;
        }
        router.refresh();
      }
    } catch {
      pushToast("Не удалось скопировать техкарту", "danger");
    }
    setRowBusyId(null);
  };

  const onDeleteCard = async (card: ApiTechnicalCardListItem) => {
    if (String(card.status) !== "draft") return;
    if (!window.confirm(`Удалить техкарту ${techCardVisibleNumber(card)}?`)) return;
    setRowBusyId(card.id);
    try {
      const result = await deleteTechnicalCardAction(card.id);
      if (!result.ok) {
        pushToast(result.message ?? "Не удалось удалить", "danger");
      } else {
        pushToast(result.message ?? "Удалено", "success");
        router.refresh();
      }
    } catch {
      pushToast("Не удалось удалить техкарту", "danger");
    }
    setRowBusyId(null);
  };

  const openCreate = () => {
    resetCreateForm();
    setCreateNomenclatureEditing(true);
    setCreateOpen(true);
  };

  const runCreate = async () => {
    const nomenclatureIdRaw = createNomenclatureId.trim();
    const nomenclatureId = nomenclatureIdRaw ? Number(nomenclatureIdRaw) : null;
    const nomenclatureName = (
      createNomenclatureEditing ? createNomenclatureDraft : createNomenclatureName
    ).trim();
    const plannedCount = Number(createPlannedCount);
    const hasCatalogId =
      nomenclatureId != null &&
      Number.isSafeInteger(nomenclatureId) &&
      nomenclatureId > 0;
    if (!hasCatalogId && !nomenclatureName) {
      setCreateError("Укажите номенклатуру");
      return;
    }
    if (!createOrderNumber.trim()) {
      setCreateError("Укажите номер заказа");
      return;
    }
    if (!Number.isSafeInteger(plannedCount) || plannedCount < 1) {
      setCreateError("План ТК должен быть целым числом ≥ 1");
      return;
    }
    if (!createDesiredDate.trim()) {
      setCreateError("Укажите дату отгрузки");
      return;
    }

    if (createNomenclatureEditing && nomenclatureName) {
      setCreateNomenclatureName(nomenclatureName);
      setCreateNomenclatureEditing(false);
    }

    setCreating(true);
    setCreateError(null);
    try {
      const result = await createStandaloneTechnicalCardAction({
        nomenclatureId: hasCatalogId ? nomenclatureId : null,
        nomenclatureName: nomenclatureName || null,
        orderNumber: createOrderNumber.trim(),
        plannedCount,
        desiredDate: createDesiredDate.trim(),
        quantity: 1,
      });
      if (!result.ok || result.card == null) {
        setCreateError(result.message ?? "Ошибка создания");
        setCreating(false);
        return;
      }
      pushToast(result.message ?? "Техкарта создана", "success");
      setCreateOpen(false);
      router.push(`/production/tech-cards/${result.card.id}`);
    } catch {
      setCreateError("Не удалось создать техкарту");
    }
    setCreating(false);
  };

  const onCreateSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void runCreate();
  };

  const detailHref = (cardId: number) => {
    const base = `/production/tech-cards/${cardId}`;
    return orderId ? `${base}?orderId=${encodeURIComponent(orderId)}` : base;
  };

  const emptyDescription =
    cards.length === 0
      ? orderId
        ? "По этому заказу техкарт нет. Сформируйте их из заказа или создайте standalone."
        : "Техкарт пока нет. Создайте standalone-техкарту или сформируйте из заказа продаж."
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

      <NomenclaturePickModal
        open={pickOpen}
        items={productNomenclatures}
        categories={categories}
        value={createNomenclatureId ? Number(createNomenclatureId) : null}
        onClose={() => setPickOpen(false)}
        onSelect={(item) => {
          if (item == null) return;
          setCreateNomenclatureId(String(item.id));
          setCreateNomenclatureName(item.name);
          setCreateNomenclatureDraft(item.name);
          setCreateNomenclatureEditing(false);
          setPickOpen(false);
        }}
      />

      <CreateDrawer
        open={createOpen}
        title="Создать техкарту"
        description="Без заказа продаж: номенклатура (текст или справочник), номер, план ТК и дата отгрузки."
        onClose={() => {
          if (creating) return;
          setCreateOpen(false);
        }}
        variant="center"
      >
        <form
          className="space-y-portal-4"
          onSubmit={onCreateSubmit}
          data-standalone-tech-card-create
        >
          <Field label="Номенклатура" required>
            <div
              className="flex min-w-0 items-center gap-1"
              data-tech-card-create-nomenclature-chrome
              data-tech-card-create-nomenclature-editing={
                createNomenclatureEditing ? "true" : "false"
              }
            >
              <Input
                value={
                  createNomenclatureEditing
                    ? createNomenclatureDraft
                    : createNomenclatureName
                }
                onChange={(event) => setCreateNomenclatureDraft(event.target.value)}
                placeholder="Название или выберите в справочнике"
                disabled={creating || !createNomenclatureEditing}
                aria-label="Номенклатура"
              />
              {createNomenclatureEditing ? (
                <>
                  <IconButton
                    type="button"
                    label="Отменить"
                    variant="secondary"
                    disabled={creating}
                    data-tech-card-create-nomenclature-cancel
                    onClick={() => {
                      setCreateNomenclatureDraft(createNomenclatureName);
                      setCreateNomenclatureEditing(false);
                    }}
                  >
                    <X className="size-4" aria-hidden="true" />
                  </IconButton>
                  <IconButton
                    type="button"
                    label="Сохранить"
                    variant="secondary"
                    disabled={creating}
                    data-tech-card-create-nomenclature-save
                    onClick={saveNomenclatureName}
                  >
                    <Save className="size-4" aria-hidden="true" />
                  </IconButton>
                </>
              ) : (
                <IconButton
                  type="button"
                  label="Править"
                  variant="secondary"
                  disabled={creating}
                  data-tech-card-create-nomenclature-edit
                  onClick={() => {
                    setCreateNomenclatureDraft(createNomenclatureName);
                    setCreateNomenclatureEditing(true);
                  }}
                >
                  <Pencil className="size-4" aria-hidden="true" />
                </IconButton>
              )}
              <IconButton
                type="button"
                label="Выбрать в справочнике"
                variant="secondary"
                disabled={creating}
                data-tech-card-create-nomenclature-catalog
                onClick={() => setPickOpen(true)}
              >
                <BookMarked className="size-4" aria-hidden="true" />
              </IconButton>
            </div>
          </Field>
          <Field label="Номер заказа" required>
            <Input
              value={createOrderNumber}
              onChange={(event) => setCreateOrderNumber(event.target.value)}
              placeholder="Например, 1310"
              disabled={creating}
            />
          </Field>
          <Field label="План ТК" required>
            <Input
              type="number"
              min={1}
              step={1}
              value={createPlannedCount}
              onChange={(event) => setCreatePlannedCount(event.target.value)}
              disabled={creating}
            />
          </Field>
          <Field label="Дата отгрузки" required>
            <Input
              type="date"
              value={createDesiredDate}
              onChange={(event) => setCreateDesiredDate(event.target.value)}
              disabled={creating}
            />
          </Field>
          {createError ? (
            <p className="text-portal-body text-portal-danger" role="alert">
              {createError}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-portal-2">
            <Button type="submit" variant="primary" disabled={creating}>
              {creating ? "Создание…" : "Создать"}
            </Button>
            <Button type="button" disabled={creating} onClick={() => setCreateOpen(false)}>
              Отмена
            </Button>
          </div>
        </form>
      </CreateDrawer>

      <PageToolbar
        start={
          <div className="flex min-w-0 w-full flex-1 items-center gap-1">
            <div data-tech-card-list-view-tabs>
              <CompactTabs
                label="Вид техкарт"
                size="compact"
                value={listView}
                onChange={(id) => router.push(viewHref(parseTechCardListView(id)))}
                items={[
                  { id: "list", label: "Техкарты" },
                  { id: "kanban", label: "Канбан" },
                ]}
              />
            </div>
            {orderId ? (
              <Link
                href="/production/tech-cards"
                className="inline-flex shrink-0 items-center gap-1 rounded-portal-md border border-portal-border bg-portal-surface-secondary px-portal-2 py-1 text-portal-caption font-medium text-portal-text hover:bg-portal-state-hover"
              >
                Заказ #{orderId}
                <X className="size-3.5" aria-hidden="true" />
              </Link>
            ) : null}
            {listView === "list" ? (
              <>
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
                        className="absolute right-0 z-20 mt-1 w-[min(100vw-2rem,18rem)] space-y-portal-3 rounded-portal-md border border-portal-border bg-portal-surface p-portal-3 shadow-portal-card"
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
                        <Field label="Ответственный">
                          <Input
                            value={responsibleFilter}
                            onChange={(event) => setResponsibleFilter(event.target.value)}
                            placeholder="Подстрока ФИО"
                            data-tech-card-filter-responsible
                          />
                        </Field>
                        <Button type="button" size="compact" onClick={clearFilters}>
                          Очистить фильтры
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </>
            ) : null}
          </div>
        }
        end={
          <div className="flex flex-wrap items-center gap-1">
            <IconButton label="Печать" variant="secondary" onClick={onPrint}>
              <Printer className="size-4" aria-hidden="true" />
            </IconButton>
            {listView === "list" ? (
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
            ) : null}
            <IconButton
              label="Создать"
              title="Создать"
              variant="secondary"
              disabled={creating}
              data-tech-card-toolbar-create
              onClick={openCreate}
            >
              <Plus className="size-4" aria-hidden="true" />
            </IconButton>
            <IconButton
              label="Сформировать из заказа"
              title="Сформировать из заказа"
              variant="primary"
              disabled={generating}
              data-tech-card-toolbar-generate
              onClick={onGeneratePrimary}
            >
              <Sparkles className="size-4" aria-hidden="true" />
            </IconButton>
          </div>
        }
      />

      <section className="min-h-0 min-w-0 flex-1 overflow-auto bg-portal-surface">
        {listView === "kanban" ? (
          kanban
        ) : filtered.length === 0 ? (
          <EmptyState title="Нет техкарт" description={emptyDescription} />
        ) : (
          <>
            <div className="hidden min-w-0 md:block">
              <DataTableFrame className="rounded-none border-x-0 border-b-0 shadow-none">
                <DataTable minWidthClassName="min-w-[1100px]">
                  <DataTableHead>
                    <tr>
                      <DataTableHeaderCell className="w-40">№ ТК</DataTableHeaderCell>
                      <DataTableHeaderCell className="w-36">Заказ</DataTableHeaderCell>
                      <DataTableHeaderCell>Позиция</DataTableHeaderCell>
                      <DataTableHeaderCell className="w-44">Модель</DataTableHeaderCell>
                      <DataTableHeaderCell className="w-36">Ответственный</DataTableHeaderCell>
                      <DataTableHeaderCell className="w-32">Статус</DataTableHeaderCell>
                      <DataTableHeaderCell className="w-36">Участок</DataTableHeaderCell>
                      <DataTableHeaderCell className="w-20">Кол-во</DataTableHeaderCell>
                      <DataTableHeaderCell className="w-36">Обновлено</DataTableHeaderCell>
                      <DataTableHeaderCell className="w-24"> </DataTableHeaderCell>
                    </tr>
                  </DataTableHead>
                  <DataTableBody>
                    {filtered.map((card) => {
                      const status = asTechCardUiStatus(String(card.status));
                      const isDraft = String(card.status) === "draft";
                      const rowBusy = rowBusyId === card.id;
                      return (
                        <DataTableRow key={card.id}>
                          <DataTableCell>
                            <Link
                              href={detailHref(card.id)}
                              className="font-medium text-portal-primary hover:underline"
                            >
                              {techCardVisibleNumber(card)}
                            </Link>
                          </DataTableCell>
                          <DataTableCell>
                            <TechCardOrderCell card={card} />
                          </DataTableCell>
                          <DataTableCell>{techCardPositionLabel(card)}</DataTableCell>
                          <DataTableCell className="text-portal-muted">
                            {techCardModelLabel(card)}
                          </DataTableCell>
                          <DataTableCell className="text-portal-muted">
                            {card.responsible_name?.trim() || "—"}
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
                          <DataTableCell>
                            <div
                              className="flex items-center justify-end gap-1"
                              data-tech-card-row-actions
                            >
                              <IconButton
                                label="Копировать"
                                variant="secondary"
                                disabled={rowBusy}
                                data-tech-card-row-copy
                                onClick={() => void onCopyCard(card.id)}
                              >
                                <Copy className="size-4" aria-hidden="true" />
                              </IconButton>
                              <IconButton
                                label="Удалить"
                                variant="danger"
                                disabled={rowBusy || !isDraft}
                                data-tech-card-row-delete
                                onClick={() => void onDeleteCard(card)}
                              >
                                <Trash2 className="size-4" aria-hidden="true" />
                              </IconButton>
                            </div>
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
                const isDraft = String(card.status) === "draft";
                const rowBusy = rowBusyId === card.id;
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
                        {techCardVisibleNumber(card)}
                      </Link>
                      <StatusBadge size="compact" tone={techCardStatusTone(status)}>
                        {techCardStatusLabel(status)}
                      </StatusBadge>
                    </div>
                    <dl className="mt-portal-3 grid gap-portal-2 text-portal-body">
                      <div className="flex justify-between gap-portal-3">
                        <dt className="text-portal-muted">Заказ</dt>
                        <dd>
                          <TechCardOrderCell card={card} />
                        </dd>
                      </div>
                      <div className="flex justify-between gap-portal-3">
                        <dt className="text-portal-muted">Позиция</dt>
                        <dd className="text-right">{techCardPositionLabel(card)}</dd>
                      </div>
                      <div className="flex justify-between gap-portal-3">
                        <dt className="text-portal-muted">Ответственный</dt>
                        <dd className="text-right">{card.responsible_name?.trim() || "—"}</dd>
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
                    <div
                      className="mt-portal-3 flex justify-end gap-1"
                      data-tech-card-row-actions
                    >
                      <IconButton
                        label="Копировать"
                        variant="secondary"
                        disabled={rowBusy}
                        data-tech-card-row-copy
                        onClick={() => void onCopyCard(card.id)}
                      >
                        <Copy className="size-4" aria-hidden="true" />
                      </IconButton>
                      <IconButton
                        label="Удалить"
                        variant="danger"
                        disabled={rowBusy || !isDraft}
                        data-tech-card-row-delete
                        onClick={() => void onDeleteCard(card)}
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                      </IconButton>
                    </div>
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
