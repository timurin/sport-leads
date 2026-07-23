"use client";

import Link from "next/link";
import {
  Copy,
  ExternalLink,
  Filter,
  FilterX,
  Plus,
  Printer,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { copyProductModel } from "@/app/(workspace)/settings/catalogs/product-models/product-model-actions";
import { ProductModelCreateDrawer } from "@/components/settings/product-model-create-drawer";
import { IconButton } from "@/components/ui/button";
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
import { Checkbox, Input, Select } from "@/components/ui/form-controls";
import { ImageLightbox } from "@/components/ui/image-lightbox";
import { ListTotals } from "@/components/ui/list-pagination";
import { PageToolbar } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  PRODUCT_MODEL_SIZE_TYPE_LABELS,
  PRODUCT_MODEL_STATUS_FILTER_ITEMS,
  PRODUCT_MODEL_STATUS_LABELS,
  filterProductModels,
  productModelCoverUrl,
  productModelStatusTone,
  type ProductModel,
  type ProductModelStatus,
} from "@/lib/product-models";
import type { ProductType } from "@/lib/product-types";
import type { SizeGridListItem } from "@/lib/size-grids";

const ROW_ICON_LINK =
  "portal-focus-ring inline-flex size-portal-control-icon shrink-0 items-center justify-center rounded-portal-md border border-portal-border bg-portal-surface text-portal-muted hover:bg-portal-state-hover hover:text-portal-text";

function CoverThumb({
  model,
  onOpen,
}: {
  model: ProductModel;
  onOpen: (src: string, alt: string) => void;
}) {
  const src = productModelCoverUrl(model.cover_image_url);
  const alt = `Обложка: ${model.name}`;

  if (!src) {
    return (
      <span
        className="inline-flex size-10 items-center justify-center rounded-portal-md border border-dashed border-portal-border bg-portal-surface-secondary text-portal-caption text-portal-muted"
        aria-label="Нет изображения"
      >
        —
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onOpen(src, alt);
      }}
      className="overflow-hidden rounded-portal-md border border-portal-border bg-portal-surface-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-portal-primary"
      aria-label={`Открыть изображение ${model.name}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className="size-10 object-cover" />
    </button>
  );
}

/** PT-02 product-model catalog list (`DS-PT-02`). */
export function ProductModelsWorkspace({
  models,
  sizeGrids,
  productTypes = [],
  costByModelId = {},
}: {
  models: ProductModel[];
  sizeGrids: SizeGridListItem[];
  productTypes?: ProductType[];
  /** Precomputed «от–до» labels from assembly variant totals. */
  costByModelId?: Record<number, string>;
}) {
  const router = useRouter();
  const [created, setCreated] = useState<ProductModel[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | ProductModelStatus>("");
  const [productTypeFilter, setProductTypeFilter] = useState<number | null>(
    null,
  );
  const [filterOpen, setFilterOpen] = useState(false);
  const [printSelectMode, setPrintSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set());
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(
    null,
  );
  const [busyId, setBusyId] = useState<number | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const rows = useMemo(() => {
    const knownIds = new Set(models.map((model) => model.id));
    const pending = created.filter((model) => !knownIds.has(model.id));
    return [...pending, ...models];
  }, [created, models]);

  const filtered = useMemo(
    () =>
      filterProductModels(rows, {
        search: query,
        status: statusFilter,
        productTypeId: productTypeFilter,
      }),
    [rows, query, statusFilter, productTypeFilter],
  );

  const filtersActive = Boolean(statusFilter) || productTypeFilter != null;

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

  const emptyDescription =
    models.length === 0
      ? "Каталог пуст. Создайте первую модель через кнопку «+»."
      : "Измените поиск, фильтр или сбросьте их.";

  const openLightbox = (src: string, alt: string) => setLightbox({ src, alt });

  const handleCreated = (model: ProductModel) => {
    setCreated((prev) => [model, ...prev.filter((row) => row.id !== model.id)]);
    router.refresh();
  };

  const onCopy = async (model: ProductModel) => {
    setBusyId(model.id);
    setRowError(null);
    try {
      const createdModel = await copyProductModel(model.id);
      setCreated((prev) => [
        createdModel,
        ...prev.filter((row) => row.id !== createdModel.id),
      ]);
      router.push(`/settings/catalogs/product-models/${createdModel.id}`);
      router.refresh();
    } catch (caught) {
      setRowError(
        caught instanceof Error ? caught.message : "Не удалось скопировать",
      );
      setBusyId(null);
    }
  };

  const clearFilters = () => {
    setStatusFilter("");
    setProductTypeFilter(null);
    setFilterOpen(false);
  };

  const toggleSelected = (modelId: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(modelId)) next.delete(modelId);
      else next.add(modelId);
      return next;
    });
  };

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((model) => selectedIds.has(model.id));

  const toggleSelectAllFiltered = () => {
    setSelectedIds((prev) => {
      if (filtered.length === 0) return prev;
      if (filtered.every((model) => prev.has(model.id))) {
        const next = new Set(prev);
        for (const model of filtered) next.delete(model.id);
        return next;
      }
      const next = new Set(prev);
      for (const model of filtered) next.add(model.id);
      return next;
    });
  };

  const onPrint = () => {
    if (!printSelectMode) {
      setPrintSelectMode(true);
      return;
    }
    if (selectedIds.size === 0) {
      setPrintSelectMode(false);
      setSelectedIds(new Set());
      return;
    }
    window.alert(
      "Печать будет доступна после настройки шаблона в Администрирование → Печатные формы.",
    );
  };

  const costLabel = (modelId: number) => costByModelId[modelId] ?? "—";

  const rowActions = (model: ProductModel) => {
    const href = `/settings/catalogs/product-models/${model.id}`;
    const busy = busyId === model.id;
    return (
      <div className="flex items-center gap-1" role="group" aria-label="Действия">
        <IconButton
          label={`Копировать ${model.name}`}
          variant="secondary"
          disabled={busy}
          onClick={() => void onCopy(model)}
        >
          <Copy className="size-4" aria-hidden="true" />
        </IconButton>
        <Link
          href={href}
          className={ROW_ICON_LINK}
          aria-label={`Открыть ${model.name}`}
          title="Открыть"
        >
          <ExternalLink className="size-4" aria-hidden="true" />
        </Link>
      </div>
    );
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {lightbox ? (
        <ImageLightbox
          src={lightbox.src}
          alt={lightbox.alt}
          onClose={() => setLightbox(null)}
        />
      ) : null}

      <ProductModelCreateDrawer
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={handleCreated}
        sizeGrids={sizeGrids}
      />

      <PageToolbar
        start={
          <div className="flex min-w-0 w-full flex-1 items-center gap-1">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Поиск по артикулу или названию"
              size="compact"
              className="min-w-0 flex-1 basis-0"
              aria-label="Поиск моделей изделий"
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
                    aria-label="Фильтр моделей"
                    className="absolute right-0 z-20 mt-1 w-[min(100vw-2rem,16rem)] space-y-portal-3 rounded-portal-md border border-portal-border bg-portal-surface p-portal-3 shadow-portal-card"
                  >
                    <Select
                      value={statusFilter}
                      size="compact"
                      aria-label="Фильтр по состоянию"
                      onChange={(event) =>
                        setStatusFilter(
                          event.target.value as "" | ProductModelStatus,
                        )
                      }
                    >
                      <option value="">Все состояния</option>
                      {PRODUCT_MODEL_STATUS_FILTER_ITEMS.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.label}
                        </option>
                      ))}
                    </Select>
                    {productTypes.length > 0 ? (
                      <Select
                        value={
                          productTypeFilter == null
                            ? ""
                            : String(productTypeFilter)
                        }
                        size="compact"
                        aria-label="Фильтр по виду изделия"
                        onChange={(event) => {
                          const raw = event.target.value;
                          setProductTypeFilter(raw ? Number(raw) : null);
                        }}
                      >
                        <option value="">Все виды</option>
                        {productTypes.map((row) => (
                          <option key={row.id} value={row.id}>
                            {row.name}
                          </option>
                        ))}
                      </Select>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <IconButton
                label="Сбросить фильтр"
                variant="secondary"
                disabled={!filtersActive}
                onClick={clearFilters}
              >
                <FilterX className="size-4" aria-hidden="true" />
              </IconButton>
              <IconButton
                label={
                  printSelectMode
                    ? selectedIds.size > 0
                      ? `Печать (${selectedIds.size})`
                      : "Выйти из режима печати"
                    : "Печать"
                }
                variant={printSelectMode ? "primary" : "secondary"}
                aria-pressed={printSelectMode}
                onClick={onPrint}
              >
                <Printer className="size-4" aria-hidden="true" />
              </IconButton>
            </div>
          </div>
        }
        end={
          <div className="!w-auto shrink-0">
            <IconButton
              label="Создать модель"
              variant="primary"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="size-4" aria-hidden="true" />
            </IconButton>
          </div>
        }
      />

      <section className="min-h-0 min-w-0 flex-1 overflow-auto bg-portal-surface">
        {rowError ? (
          <p
            className="border-b border-portal-danger/30 bg-portal-danger-soft px-portal-4 py-portal-2 text-portal-caption text-portal-danger"
            role="alert"
          >
            {rowError}
          </p>
        ) : null}

        <div className="hidden min-w-0 md:block">
          <DataTableFrame className="rounded-none border-x-0 border-b-0 shadow-none">
            <DataTable minWidthClassName="min-w-[860px]">
              <DataTableHead>
                <tr>
                  {printSelectMode ? (
                    <DataTableHeaderCell className="w-10">
                      <Checkbox
                        checked={allFilteredSelected}
                        aria-label="Выбрать все модели"
                        onChange={toggleSelectAllFiltered}
                      />
                    </DataTableHeaderCell>
                  ) : null}
                  <DataTableHeaderCell>Фото</DataTableHeaderCell>
                  <DataTableHeaderCell>Артикул</DataTableHeaderCell>
                  <DataTableHeaderCell>Название</DataTableHeaderCell>
                  <DataTableHeaderCell>Вид изделия</DataTableHeaderCell>
                  <DataTableHeaderCell>Размерная сетка</DataTableHeaderCell>
                  <DataTableHeaderCell>Статус</DataTableHeaderCell>
                  <DataTableHeaderCell>Стоимость от–до</DataTableHeaderCell>
                  <DataTableHeaderCell>Действие</DataTableHeaderCell>
                </tr>
              </DataTableHead>
              <DataTableBody>
                {filtered.map((model) => {
                  const href = `/settings/catalogs/product-models/${model.id}`;
                  const grid = sizeGrids.find(
                    (row) => row.id === model.size_grid_id,
                  );
                  const gridLabel = grid
                    ? `${grid.name} · ${PRODUCT_MODEL_SIZE_TYPE_LABELS[grid.size_type]}`
                    : PRODUCT_MODEL_SIZE_TYPE_LABELS[model.size_type];
                  const productTypeLabel =
                    model.product_type_name?.trim() ||
                    productTypes.find((row) => row.id === model.product_type_id)
                      ?.name ||
                    "—";
                  const checked = selectedIds.has(model.id);

                  return (
                    <DataTableRow key={model.id}>
                      {printSelectMode ? (
                        <DataTableCell>
                          <Checkbox
                            checked={checked}
                            aria-label={`Выбрать ${model.name}`}
                            onChange={() => toggleSelected(model.id)}
                          />
                        </DataTableCell>
                      ) : null}
                      <DataTableCell>
                        <CoverThumb model={model} onOpen={openLightbox} />
                      </DataTableCell>
                      <DataTableCell className="font-medium">
                        <Link
                          href={href}
                          className="font-mono text-portal-text hover:text-portal-primary hover:underline"
                        >
                          {model.article}
                        </Link>
                      </DataTableCell>
                      <DataTableCell>
                        <Link
                          href={href}
                          className="font-medium text-portal-text hover:text-portal-primary hover:underline"
                        >
                          {model.name}
                        </Link>
                      </DataTableCell>
                      <DataTableCell>{productTypeLabel}</DataTableCell>
                      <DataTableCell>{gridLabel}</DataTableCell>
                      <DataTableCell>
                        <StatusBadge
                          size="compact"
                          tone={productModelStatusTone(model.status)}
                        >
                          {PRODUCT_MODEL_STATUS_LABELS[model.status]}
                        </StatusBadge>
                      </DataTableCell>
                      <DataTableCell>{costLabel(model.id)}</DataTableCell>
                      <DataTableCell>{rowActions(model)}</DataTableCell>
                    </DataTableRow>
                  );
                })}
              </DataTableBody>
            </DataTable>
            {filtered.length === 0 ? (
              <div className="p-portal-6">
                <EmptyState
                  title={
                    models.length === 0
                      ? "Моделей изделий пока нет"
                      : "Модели не найдены"
                  }
                  description={emptyDescription}
                  size="compact"
                />
              </div>
            ) : null}
          </DataTableFrame>
        </div>

        {mounted ? (
        <div className="min-w-0 space-y-portal-3 border-b border-portal-border bg-portal-surface-secondary p-portal-3 md:hidden">
          {filtered.length === 0 ? (
            <EmptyState
              title={
                models.length === 0
                  ? "Моделей изделий пока нет"
                  : "Модели не найдены"
              }
              description={emptyDescription}
              size="compact"
            />
          ) : (
            filtered.map((model) => {
              const href = `/settings/catalogs/product-models/${model.id}`;
              const grid = sizeGrids.find((row) => row.id === model.size_grid_id);
              const gridLabel = grid
                ? `${grid.name} · ${PRODUCT_MODEL_SIZE_TYPE_LABELS[grid.size_type]}`
                : PRODUCT_MODEL_SIZE_TYPE_LABELS[model.size_type];
              const productTypeLabel =
                model.product_type_name?.trim() ||
                productTypes.find((row) => row.id === model.product_type_id)
                  ?.name ||
                "—";

              return (
                <article
                  key={model.id}
                  className="min-w-0 rounded-portal-lg border border-portal-border bg-portal-surface p-portal-4 shadow-portal-sm"
                >
                  <div className="flex min-w-0 items-start justify-between gap-portal-3">
                    <div className="flex min-w-0 flex-1 items-start gap-portal-3">
                      {printSelectMode ? (
                        <Checkbox
                          checked={selectedIds.has(model.id)}
                          aria-label={`Выбрать ${model.name}`}
                          onChange={() => toggleSelected(model.id)}
                          className="mt-1 shrink-0"
                        />
                      ) : null}
                      <CoverThumb model={model} onOpen={openLightbox} />
                      <div className="min-w-0 flex-1 space-y-portal-2">
                        <h3 className="truncate text-portal-body font-semibold text-portal-text">
                          <Link
                            href={href}
                            className="hover:text-portal-primary hover:underline"
                          >
                            {model.name}
                          </Link>
                        </h3>
                        <p className="truncate text-portal-caption text-portal-muted">
                          {model.article} · {productTypeLabel} · {gridLabel}
                        </p>
                        <p className="text-portal-caption text-portal-muted">
                          Стоимость от–до: {costLabel(model.id)}
                        </p>
                        {rowActions(model)}
                      </div>
                    </div>
                    <StatusBadge
                      size="compact"
                      tone={productModelStatusTone(model.status)}
                    >
                      {PRODUCT_MODEL_STATUS_LABELS[model.status]}
                    </StatusBadge>
                  </div>
                </article>
              );
            })
          )}
        </div>
        ) : null}

        <ListTotals primary={`Всего: ${filtered.length} моделей`} />
      </section>
    </div>
  );
}
