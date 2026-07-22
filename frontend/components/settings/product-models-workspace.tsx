"use client";

import Link from "next/link";
import { Check, ExternalLink, FilterX, Pencil, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { updateProductModelRequisites } from "@/app/(workspace)/settings/catalogs/product-models/product-model-actions";
import { ProductModelCreateDrawer } from "@/components/settings/product-model-create-drawer";
import { ProductModelToolbarActions } from "@/components/settings/product-model-toolbar-actions";
import { IconButton } from "@/components/ui/button";
import { CompactTabs } from "@/components/ui/compact-tabs";
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
import { checkboxClassName } from "@/lib/design-system/control-styles";
import {
  filterProductModels,
  PRODUCT_MODEL_SIZE_TYPE_LABELS,
  PRODUCT_MODEL_STATUS_FILTER_ITEMS,
  PRODUCT_MODEL_STATUS_LABELS,
  productModelCoverUrl,
  productModelStatusTone,
  type ProductModel,
  type ProductModelSizeType,
  type ProductModelStatus,
} from "@/lib/product-models";

const ROW_ICON_LINK =
  "portal-focus-ring inline-flex size-portal-control-icon shrink-0 items-center justify-center rounded-portal-md border border-portal-border bg-portal-surface text-portal-muted hover:bg-portal-state-hover hover:text-portal-text";

type RowDraft = {
  article: string;
  name: string;
  size_type: ProductModelSizeType;
};

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
export function ProductModelsWorkspace({ models }: { models: ProductModel[] }) {
  const router = useRouter();
  const [created, setCreated] = useState<ProductModel[]>([]);
  const [patched, setPatched] = useState<Record<number, ProductModel>>({});
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProductModelStatus>("draft");
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(
    null,
  );
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set());
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<RowDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const selectAllRef = useRef<HTMLInputElement>(null);

  const rows = useMemo(() => {
    const knownIds = new Set(models.map((model) => model.id));
    const pending = created.filter((model) => !knownIds.has(model.id));
    return [
      ...pending,
      ...models.map((model) => patched[model.id] ?? model),
    ];
  }, [created, models, patched]);

  const filtered = useMemo(
    () =>
      filterProductModels(rows, {
        search: query,
        status: statusFilter,
      }),
    [rows, query, statusFilter],
  );

  const statusCounts = useMemo(() => {
    const counts: Record<ProductModelStatus, number> = {
      draft: 0,
      active: 0,
      archived: 0,
    };
    for (const model of rows) {
      counts[model.status] += 1;
    }
    return counts;
  }, [rows]);

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((model) => selectedIds.has(model.id));
  const someFilteredSelected = filtered.some((model) =>
    selectedIds.has(model.id),
  );

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate =
        someFilteredSelected && !allFilteredSelected;
    }
  }, [allFilteredSelected, someFilteredSelected]);

  const clearFilters = () => {
    setQuery("");
    setStatusFilter("draft");
  };

  const toggleRow = (id: number, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const toggleAllFiltered = (checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const model of filtered) {
        if (checked) {
          next.add(model.id);
        } else {
          next.delete(model.id);
        }
      }
      return next;
    });
  };

  const startEdit = (model: ProductModel) => {
    setEditingId(model.id);
    setDraft({
      article: model.article,
      name: model.name,
      size_type: model.size_type,
    });
    setRowError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft(null);
    setRowError(null);
  };

  const saveEdit = async (model: ProductModel) => {
    if (!draft) return;
    if (!draft.article.trim() || !draft.name.trim()) {
      setRowError("Артикул и название обязательны");
      return;
    }
    setSaving(true);
    setRowError(null);
    try {
      const updated = await updateProductModelRequisites(model.id, {
        article: draft.article,
        name: draft.name,
        size_type: draft.size_type,
        description: model.description,
      });
      setPatched((prev) => ({ ...prev, [updated.id]: updated }));
      cancelEdit();
      router.refresh();
    } catch (caught) {
      setRowError(
        caught instanceof Error ? caught.message : "Не удалось сохранить",
      );
    } finally {
      setSaving(false);
    }
  };

  const emptyDescription =
    models.length === 0
      ? "Каталог пуст. Создайте первую модель через кнопку «+»."
      : "Измените поиск, статус или сбросьте фильтры.";

  const openLightbox = (src: string, alt: string) => setLightbox({ src, alt });

  const handleCreated = (model: ProductModel) => {
    setCreated((prev) => [model, ...prev.filter((row) => row.id !== model.id)]);
    router.refresh();
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
      />

      <PageToolbar
        start={
          <>
            <CompactTabs
              className="w-full md:w-auto"
              size="compact"
              label="Статус моделей"
              value={statusFilter}
              onChange={(id) => setStatusFilter(id as ProductModelStatus)}
              items={PRODUCT_MODEL_STATUS_FILTER_ITEMS.map((item) => ({
                ...item,
                count: statusCounts[item.id],
              }))}
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Поиск по артикулу или названию"
              className="min-w-0 w-full flex-1"
              aria-label="Поиск моделей изделий"
            />
          </>
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
              label="Сбросить фильтры"
              variant="secondary"
              onClick={clearFilters}
            >
              <FilterX className="size-4" aria-hidden="true" />
            </IconButton>
            <ProductModelToolbarActions inert />
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
            <DataTable minWidthClassName="min-w-[920px]">
              <DataTableHead>
                <tr>
                  <DataTableHeaderCell className="w-10">
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      checked={allFilteredSelected}
                      aria-label="Выбрать все модели"
                      className={checkboxClassName()}
                      onChange={(event) =>
                        toggleAllFiltered(event.target.checked)
                      }
                    />
                  </DataTableHeaderCell>
                  <DataTableHeaderCell>Фото</DataTableHeaderCell>
                  <DataTableHeaderCell>Артикул</DataTableHeaderCell>
                  <DataTableHeaderCell>Название</DataTableHeaderCell>
                  <DataTableHeaderCell>Тип сетки</DataTableHeaderCell>
                  <DataTableHeaderCell>Статус</DataTableHeaderCell>
                  <DataTableHeaderCell>Стоимость от–до</DataTableHeaderCell>
                  <DataTableHeaderCell>Действие</DataTableHeaderCell>
                </tr>
              </DataTableHead>
              <DataTableBody>
                {filtered.map((model) => {
                  const checked = selectedIds.has(model.id);
                  const editing = editingId === model.id && draft != null;
                  const canChangeSizeType = model.status === "draft";
                  const href = `/settings/catalogs/product-models/${model.id}`;

                  return (
                    <DataTableRow
                      key={model.id}
                      className={
                        editing ? "bg-portal-primary-soft/50" : undefined
                      }
                    >
                      <DataTableCell>
                        <Checkbox
                          checked={checked}
                          aria-label={`Выбрать ${model.name}`}
                          onChange={(event) =>
                            toggleRow(model.id, event.target.checked)
                          }
                        />
                      </DataTableCell>
                      <DataTableCell>
                        <CoverThumb model={model} onOpen={openLightbox} />
                      </DataTableCell>
                      <DataTableCell className="font-medium">
                        {editing ? (
                          <Input
                            size="compact"
                            value={draft.article}
                            onChange={(event) =>
                              setDraft({
                                ...draft,
                                article: event.target.value,
                              })
                            }
                            aria-label="Артикул"
                            disabled={saving}
                          />
                        ) : (
                          model.article
                        )}
                      </DataTableCell>
                      <DataTableCell>
                        {editing ? (
                          <Input
                            size="compact"
                            value={draft.name}
                            onChange={(event) =>
                              setDraft({ ...draft, name: event.target.value })
                            }
                            aria-label="Название"
                            disabled={saving}
                          />
                        ) : (
                          <span className="font-medium text-portal-text">
                            {model.name}
                          </span>
                        )}
                      </DataTableCell>
                      <DataTableCell>
                        {editing ? (
                          <Select
                            size="compact"
                            value={draft.size_type}
                            disabled={saving || !canChangeSizeType}
                            onChange={(event) =>
                              setDraft({
                                ...draft,
                                size_type: event.target
                                  .value as ProductModelSizeType,
                              })
                            }
                            aria-label="Тип размерной сетки"
                          >
                            {Object.entries(PRODUCT_MODEL_SIZE_TYPE_LABELS).map(
                              ([value, label]) => (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              ),
                            )}
                          </Select>
                        ) : (
                          PRODUCT_MODEL_SIZE_TYPE_LABELS[model.size_type]
                        )}
                      </DataTableCell>
                      <DataTableCell>
                        <StatusBadge
                          size="compact"
                          tone={productModelStatusTone(model.status)}
                        >
                          {PRODUCT_MODEL_STATUS_LABELS[model.status]}
                        </StatusBadge>
                      </DataTableCell>
                      <DataTableCell className="text-portal-muted">
                        —
                      </DataTableCell>
                      <DataTableCell>
                        <div
                          className="flex items-center gap-1"
                          role="group"
                          aria-label="Действия"
                        >
                          {editing ? (
                            <>
                              <IconButton
                                label="Сохранить"
                                variant="secondary"
                                disabled={saving}
                                onClick={() => void saveEdit(model)}
                              >
                                <Check className="size-4" aria-hidden="true" />
                              </IconButton>
                              <IconButton
                                label="Отменить"
                                variant="secondary"
                                disabled={saving}
                                onClick={cancelEdit}
                              >
                                <X className="size-4" aria-hidden="true" />
                              </IconButton>
                            </>
                          ) : (
                            <>
                              <IconButton
                                label={`Редактировать ${model.name}`}
                                variant="secondary"
                                onClick={() => startEdit(model)}
                              >
                                <Pencil className="size-4" aria-hidden="true" />
                              </IconButton>
                              <Link
                                href={href}
                                className={ROW_ICON_LINK}
                                aria-label={`Открыть ${model.name}`}
                                title="Открыть"
                              >
                                <ExternalLink
                                  className="size-4"
                                  aria-hidden="true"
                                />
                              </Link>
                            </>
                          )}
                        </div>
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
              const checked = selectedIds.has(model.id);
              const editing = editingId === model.id && draft != null;
              const canChangeSizeType = model.status === "draft";
              const href = `/settings/catalogs/product-models/${model.id}`;

              return (
                <article
                  key={model.id}
                  className={[
                    "min-w-0 rounded-portal-lg border bg-portal-surface p-portal-4 shadow-portal-sm",
                    editing
                      ? "border-portal-primary ring-1 ring-portal-primary"
                      : "border-portal-border",
                  ].join(" ")}
                >
                  <div className="flex min-w-0 items-start justify-between gap-portal-3">
                    <div className="flex min-w-0 flex-1 items-start gap-portal-3">
                      <Checkbox
                        checked={checked}
                        aria-label={`Выбрать ${model.name}`}
                        className="mt-1"
                        onChange={(event) =>
                          toggleRow(model.id, event.target.checked)
                        }
                      />
                      <CoverThumb model={model} onOpen={openLightbox} />
                      <div className="min-w-0 flex-1 space-y-portal-2">
                        {editing ? (
                          <>
                            <Input
                              size="compact"
                              value={draft.name}
                              onChange={(event) =>
                                setDraft({
                                  ...draft,
                                  name: event.target.value,
                                })
                              }
                              aria-label="Название"
                              disabled={saving}
                            />
                            <Input
                              size="compact"
                              value={draft.article}
                              onChange={(event) =>
                                setDraft({
                                  ...draft,
                                  article: event.target.value,
                                })
                              }
                              aria-label="Артикул"
                              disabled={saving}
                            />
                            <Select
                              size="compact"
                              value={draft.size_type}
                              disabled={saving || !canChangeSizeType}
                              onChange={(event) =>
                                setDraft({
                                  ...draft,
                                  size_type: event.target
                                    .value as ProductModelSizeType,
                                })
                              }
                              aria-label="Тип размерной сетки"
                            >
                              {Object.entries(
                                PRODUCT_MODEL_SIZE_TYPE_LABELS,
                              ).map(([value, label]) => (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              ))}
                            </Select>
                          </>
                        ) : (
                          <>
                            <h3 className="truncate text-portal-body font-semibold text-portal-text">
                              {model.name}
                            </h3>
                            <p className="truncate text-portal-caption text-portal-muted">
                              {model.article} ·{" "}
                              {PRODUCT_MODEL_SIZE_TYPE_LABELS[model.size_type]}
                            </p>
                            <p className="text-portal-caption text-portal-muted">
                              Стоимость от–до: —
                            </p>
                          </>
                        )}
                        <div
                          className="flex items-center gap-1"
                          role="group"
                          aria-label="Действия"
                        >
                          {editing ? (
                            <>
                              <IconButton
                                label="Сохранить"
                                variant="secondary"
                                disabled={saving}
                                onClick={() => void saveEdit(model)}
                              >
                                <Check className="size-4" aria-hidden="true" />
                              </IconButton>
                              <IconButton
                                label="Отменить"
                                variant="secondary"
                                disabled={saving}
                                onClick={cancelEdit}
                              >
                                <X className="size-4" aria-hidden="true" />
                              </IconButton>
                            </>
                          ) : (
                            <>
                              <IconButton
                                label={`Редактировать ${model.name}`}
                                variant="secondary"
                                onClick={() => startEdit(model)}
                              >
                                <Pencil className="size-4" aria-hidden="true" />
                              </IconButton>
                              <Link
                                href={href}
                                className={ROW_ICON_LINK}
                                aria-label={`Открыть ${model.name}`}
                                title="Открыть"
                              >
                                <ExternalLink
                                  className="size-4"
                                  aria-hidden="true"
                                />
                              </Link>
                            </>
                          )}
                        </div>
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
