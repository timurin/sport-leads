"use client";

import Link from "next/link";
import { PanelRightOpen } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { ProductModelInspector } from "@/components/settings/product-model-inspector";
import { ProductModelToolbarActions } from "@/components/settings/product-model-toolbar-actions";
import { Button } from "@/components/ui/button";
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
import { FilterToolbar } from "@/components/ui/filter-toolbar";
import { Input, Select } from "@/components/ui/form-controls";
import { ImageLightbox } from "@/components/ui/image-lightbox";
import { ListTotals } from "@/components/ui/list-pagination";
import { PageToolbar } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  filterProductModels,
  PRODUCT_MODEL_SIZE_TYPE_LABELS,
  PRODUCT_MODEL_STATUS_LABELS,
  productModelCoverUrl,
  productModelStatusTone,
  type ProductModel,
  type ProductModelSizeType,
  type ProductModelStatus,
} from "@/lib/product-models";

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

/** PT-02 product-model catalog list (`DS-PT-02`) + materials-style right preview. */
export function ProductModelsWorkspace({ models }: { models: ProductModel[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"" | ProductModelStatus>("");
  const [sizeType, setSizeType] = useState<"" | ProductModelSizeType>("");
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(
    null,
  );
  const [selectedId, setSelectedId] = useState<number | null>(
    models[0]?.id ?? null,
  );
  const [inspectorOpen, setInspectorOpen] = useState(true);

  const filtered = useMemo(
    () => filterProductModels(models, { search: query, status, sizeType }),
    [models, query, sizeType, status],
  );

  const selectedModel = useMemo(
    () => filtered.find((model) => model.id === selectedId) ?? null,
    [filtered, selectedId],
  );

  useEffect(() => {
    if (filtered.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!filtered.some((model) => model.id === selectedId)) {
      setSelectedId(filtered[0]?.id ?? null);
    }
  }, [filtered, selectedId]);

  const clearFilters = () => {
    setQuery("");
    setStatus("");
    setSizeType("");
  };

  const emptyDescription =
    models.length === 0
      ? "Каталог пуст. Создайте модель через API или дождитесь формы создания в workspace."
      : "Измените поисковый запрос или сбросьте фильтры.";

  const openLightbox = (src: string, alt: string) => setLightbox({ src, alt });

  const selectModel = (model: ProductModel) => {
    setSelectedId(model.id);
    setInspectorOpen(true);
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

      <PageToolbar
        start={
          <p className="text-portal-body text-portal-muted">
            Модели изделий · найдено: {filtered.length}
          </p>
        }
        end={<ProductModelToolbarActions inert />}
      />

      <FilterToolbar variant="strip" label="Фильтры моделей изделий">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Поиск по артикулу или названию"
          className="min-w-0 w-full md:min-w-56 md:flex-1"
          aria-label="Поиск моделей изделий"
        />
        <Select
          value={sizeType}
          onChange={(event) =>
            setSizeType(event.target.value as "" | ProductModelSizeType)
          }
          className="w-full md:w-auto"
          aria-label="Тип размерной сетки"
        >
          <option value="">Все типы</option>
          {Object.entries(PRODUCT_MODEL_SIZE_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Select
          value={status}
          onChange={(event) =>
            setStatus(event.target.value as "" | ProductModelStatus)
          }
          className="w-full md:w-auto"
          aria-label="Статус модели"
        >
          <option value="">Все статусы</option>
          {Object.entries(PRODUCT_MODEL_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Button
          type="button"
          size="compact"
          className="w-full md:w-auto"
          onClick={clearFilters}
        >
          Сбросить
        </Button>
      </FilterToolbar>

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <section className="min-w-0 flex-1 overflow-auto bg-portal-surface">
          <div className="hidden min-w-0 md:block">
            <DataTableFrame className="rounded-none border-x-0 border-b-0 shadow-none">
              <DataTable minWidthClassName="min-w-[780px]">
                <DataTableHead>
                  <tr>
                    <DataTableHeaderCell>Фото</DataTableHeaderCell>
                    <DataTableHeaderCell>Артикул</DataTableHeaderCell>
                    <DataTableHeaderCell>Название</DataTableHeaderCell>
                    <DataTableHeaderCell>Тип сетки</DataTableHeaderCell>
                    <DataTableHeaderCell>Статус</DataTableHeaderCell>
                    <DataTableHeaderCell>Действие</DataTableHeaderCell>
                  </tr>
                </DataTableHead>
                <DataTableBody>
                  {filtered.map((model) => {
                    const selected = model.id === selectedId;
                    return (
                      <DataTableRow
                        key={model.id}
                        className={[
                          "cursor-pointer",
                          selected ? "bg-blue-50 hover:bg-blue-50" : "",
                        ].join(" ")}
                      >
                        <DataTableCell
                          onClick={() => selectModel(model)}
                          className="cursor-pointer"
                        >
                          <CoverThumb model={model} onOpen={openLightbox} />
                        </DataTableCell>
                        <DataTableCell
                          className="cursor-pointer font-medium"
                          onClick={() => selectModel(model)}
                        >
                          {model.article}
                        </DataTableCell>
                        <DataTableCell onClick={() => selectModel(model)}>
                          <span className="font-medium text-portal-text">
                            {model.name}
                          </span>
                        </DataTableCell>
                        <DataTableCell onClick={() => selectModel(model)}>
                          {PRODUCT_MODEL_SIZE_TYPE_LABELS[model.size_type]}
                        </DataTableCell>
                        <DataTableCell onClick={() => selectModel(model)}>
                          <StatusBadge
                            size="compact"
                            tone={productModelStatusTone(model.status)}
                          >
                            {PRODUCT_MODEL_STATUS_LABELS[model.status]}
                          </StatusBadge>
                        </DataTableCell>
                        <DataTableCell
                          onClick={(event) => event.stopPropagation()}
                        >
                          <EntityLink
                            href={`/settings/catalogs/product-models/${model.id}`}
                            className="text-portal-caption"
                          >
                            Открыть
                          </EntityLink>
                        </DataTableCell>
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
                const selected = model.id === selectedId;
                return (
                  <article
                    key={model.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => selectModel(model)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        selectModel(model);
                      }
                    }}
                    className={[
                      "min-w-0 rounded-portal-lg border bg-portal-surface p-portal-4 shadow-portal-sm",
                      selected
                        ? "border-portal-primary ring-1 ring-portal-primary"
                        : "border-portal-border",
                    ].join(" ")}
                  >
                    <div className="flex min-w-0 items-start justify-between gap-portal-3">
                      <div className="flex min-w-0 items-start gap-portal-3">
                        <CoverThumb model={model} onOpen={openLightbox} />
                        <div className="min-w-0">
                          <h3 className="truncate text-portal-body font-semibold text-portal-text">
                            {model.name}
                          </h3>
                          <p className="mt-1 truncate text-portal-caption text-portal-muted">
                            {model.article} ·{" "}
                            {PRODUCT_MODEL_SIZE_TYPE_LABELS[model.size_type]}
                          </p>
                          <Link
                            href={`/settings/catalogs/product-models/${model.id}`}
                            className="mt-2 inline-flex text-portal-caption font-medium text-portal-primary"
                            onClick={(event) => event.stopPropagation()}
                          >
                            Открыть карточку
                          </Link>
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

        {inspectorOpen ? (
          <section className="hidden w-[520px] shrink-0 overflow-hidden lg:block">
            <ProductModelInspector
              model={selectedModel}
              onClose={() => setInspectorOpen(false)}
            />
          </section>
        ) : (
          <button
            type="button"
            onClick={() => setInspectorOpen(true)}
            className="absolute right-4 top-4 z-20 hidden rounded-lg border border-slate-200 bg-white p-2 text-slate-500 shadow-sm hover:text-blue-600 lg:inline-flex"
            title="Открыть превью"
          >
            <PanelRightOpen size={19} />
          </button>
        )}
      </div>
    </div>
  );
}
