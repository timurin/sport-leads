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
import { Input } from "@/components/ui/form-controls";
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
  costByModelId = {},
}: {
  models: ProductModel[];
  sizeGrids: SizeGridListItem[];
  /** Precomputed «от–до» labels from assembly variant totals. */
  costByModelId?: Record<number, string>;
}) {
  const router = useRouter();
  const [created, setCreated] = useState<ProductModel[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | ProductModelStatus>("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(
    null,
  );
  const [busyId, setBusyId] = useState<number | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

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
      }),
    [rows, query, statusFilter],
  );

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

  const onPrint = () => {
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
              className="min-w-0 w-full flex-1"
              aria-label="Поиск моделей изделий"
            />
            <IconButton
              label="Сбросить поиск"
              variant="secondary"
              disabled={!query}
              onClick={() => setQuery("")}
            >
              <X className="size-4" aria-hidden="true" />
            </IconButton>
            <div className="relative shrink-0" ref={filterRef}>
              <IconButton
                label="Фильтр по состоянию"
                variant={statusFilter ? "primary" : "secondary"}
                aria-expanded={filterOpen}
                aria-haspopup="menu"
                onClick={() => setFilterOpen((open) => !open)}
              >
                <Filter className="size-4" aria-hidden="true" />
              </IconButton>
              {filterOpen ? (
                <div
                  role="menu"
                  aria-label="Фильтр по состоянию"
                  className="absolute right-0 z-20 mt-1 min-w-[12rem] rounded-portal-md border border-portal-border bg-portal-surface p-1 shadow-portal-card"
                >
                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={statusFilter === ""}
                    className={[
                      "flex w-full items-center rounded-portal-sm px-portal-3 py-2 text-left text-portal-body",
                      statusFilter === ""
                        ? "bg-portal-primary-soft font-medium text-portal-primary"
                        : "text-portal-text hover:bg-portal-state-hover",
                    ].join(" ")}
                    onClick={() => {
                      setStatusFilter("");
                      setFilterOpen(false);
                    }}
                  >
                    Все состояния
                  </button>
                  {PRODUCT_MODEL_STATUS_FILTER_ITEMS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      role="menuitemradio"
                      aria-checked={statusFilter === item.id}
                      className={[
                        "flex w-full items-center rounded-portal-sm px-portal-3 py-2 text-left text-portal-body",
                        statusFilter === item.id
                          ? "bg-portal-primary-soft font-medium text-portal-primary"
                          : "text-portal-text hover:bg-portal-state-hover",
                      ].join(" ")}
                      onClick={() => {
                        setStatusFilter(item.id);
                        setFilterOpen(false);
                      }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <IconButton
              label="Сбросить фильтр"
              variant="secondary"
              disabled={!statusFilter}
              onClick={() => setStatusFilter("")}
            >
              <FilterX className="size-4" aria-hidden="true" />
            </IconButton>
          </div>
        }
        end={
          <div className="flex flex-wrap items-center gap-1">
            <IconButton
              label="Создать модель"
              variant="primary"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="size-4" aria-hidden="true" />
            </IconButton>
            <IconButton
              label="Распечатать"
              variant="secondary"
              onClick={onPrint}
            >
              <Printer className="size-4" aria-hidden="true" />
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
                  <DataTableHeaderCell>Фото</DataTableHeaderCell>
                  <DataTableHeaderCell>Артикул</DataTableHeaderCell>
                  <DataTableHeaderCell>Название</DataTableHeaderCell>
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

                  return (
                    <DataTableRow key={model.id}>
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

              return (
                <article
                  key={model.id}
                  className="min-w-0 rounded-portal-lg border border-portal-border bg-portal-surface p-portal-4 shadow-portal-sm"
                >
                  <div className="flex min-w-0 items-start justify-between gap-portal-3">
                    <div className="flex min-w-0 flex-1 items-start gap-portal-3">
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
                          {model.article} · {gridLabel}
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

        <ListTotals primary={`Всего: ${filtered.length} моделей`} />
      </section>
    </div>
  );
}
