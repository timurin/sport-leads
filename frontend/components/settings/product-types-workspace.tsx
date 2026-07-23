"use client";

import { Check, FilterX, Pencil, Plus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import {
  deleteProductType,
  updateProductType,
} from "@/app/(workspace)/settings/catalogs/product-types/product-type-actions";
import { ProductTypeCreateDrawer } from "@/components/settings/product-type-create-drawer";
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
import { Checkbox, Input } from "@/components/ui/form-controls";
import { ListTotals } from "@/components/ui/list-pagination";
import { PageToolbar } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  filterProductTypes,
  type ProductType,
  type ProductTypeDraft,
} from "@/lib/product-types";

/** PT-02 product-types catalog list (`DS-PT-02-CATALOG`, etalon sewing-operations). */
export function ProductTypesWorkspace({
  productTypes,
}: {
  productTypes: ProductType[];
}) {
  const router = useRouter();
  const [created, setCreated] = useState<ProductType[]>([]);
  const [patched, setPatched] = useState<Record<number, ProductType>>({});
  const [removedIds, setRemovedIds] = useState<Set<number>>(() => new Set());
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<ProductTypeDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const rows = useMemo(() => {
    const byId = new Map<number, ProductType>();
    for (const row of productTypes) byId.set(row.id, row);
    for (const row of created) byId.set(row.id, row);
    for (const row of Object.values(patched)) byId.set(row.id, row);
    return Array.from(byId.values())
      .filter((row) => !removedIds.has(row.id))
      .sort((a, b) => {
        if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
        return a.name.localeCompare(b.name, "ru");
      });
  }, [created, productTypes, patched, removedIds]);

  const filtered = useMemo(
    () => filterProductTypes(rows, query),
    [query, rows],
  );

  const clearFilters = () => setQuery("");

  const startEdit = (row: ProductType) => {
    setEditingId(row.id);
    setDraft({
      name: row.name,
      is_active: row.is_active,
      sort_order: String(row.sort_order),
    });
    setRowError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft(null);
    setRowError(null);
  };

  const saveEdit = async () => {
    if (editingId == null || draft == null) return;
    setSaving(true);
    setRowError(null);
    try {
      const result = await updateProductType(editingId, draft);
      if (!result.ok) {
        setRowError(result.message);
        setSaving(false);
        return;
      }
      setPatched((prev) => ({
        ...prev,
        [result.productType.id]: result.productType,
      }));
      cancelEdit();
      router.refresh();
    } catch {
      setRowError("Не удалось сохранить изменения.");
    }
    setSaving(false);
  };

  const onDelete = async (row: ProductType) => {
    if (!window.confirm(`Удалить тип изделия «${row.name}»?`)) return;
    setSaving(true);
    setRowError(null);
    try {
      const result = await deleteProductType(row.id);
      if (!result.ok) {
        setRowError(result.message);
        setSaving(false);
        return;
      }
      setRemovedIds((prev) => new Set(prev).add(row.id));
      if (editingId === row.id) cancelEdit();
      router.refresh();
    } catch {
      setRowError("Не удалось удалить тип изделия.");
    }
    setSaving(false);
  };

  const emptyDescription =
    rows.length === 0
      ? "Каталог пуст. Создайте первый тип через кнопку «+»."
      : "Измените поисковый запрос или сбросьте фильтры.";

  const handleCreated = (productType: ProductType) => {
    setCreated((prev) => [
      productType,
      ...prev.filter((row) => row.id !== productType.id),
    ]);
    router.refresh();
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <ProductTypeCreateDrawer
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={handleCreated}
      />

      <PageToolbar
        start={
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Поиск по наименованию"
            className="min-w-0 w-full flex-1"
            aria-label="Поиск типов изделий"
          />
        }
        end={
          <div className="flex flex-wrap items-center gap-1">
            <IconButton
              label="Создать тип изделия"
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
            <DataTable minWidthClassName="min-w-[720px]">
              <DataTableHead>
                <tr>
                  <DataTableHeaderCell className="w-24">
                    Порядок
                  </DataTableHeaderCell>
                  <DataTableHeaderCell>Наименование</DataTableHeaderCell>
                  <DataTableHeaderCell className="w-36">
                    Статус
                  </DataTableHeaderCell>
                  <DataTableHeaderCell className="w-28">
                    Действия
                  </DataTableHeaderCell>
                </tr>
              </DataTableHead>
              <DataTableBody>
                {filtered.map((row) => {
                  const editing = editingId === row.id && draft != null;
                  return (
                    <DataTableRow key={row.id}>
                      <DataTableCell>
                        {editing ? (
                          <Input
                            value={draft.sort_order}
                            onChange={(event) =>
                              setDraft({
                                ...draft,
                                sort_order: event.target.value,
                              })
                            }
                            disabled={saving}
                            inputMode="numeric"
                            aria-label="Порядок"
                          />
                        ) : (
                          row.sort_order
                        )}
                      </DataTableCell>
                      <DataTableCell>
                        {editing ? (
                          <Input
                            value={draft.name}
                            onChange={(event) =>
                              setDraft({ ...draft, name: event.target.value })
                            }
                            disabled={saving}
                            aria-label="Наименование"
                          />
                        ) : (
                          <span className="font-medium text-portal-text">
                            {row.name}
                          </span>
                        )}
                      </DataTableCell>
                      <DataTableCell>
                        {editing ? (
                          <Checkbox
                            checked={draft.is_active}
                            onChange={(event) =>
                              setDraft({
                                ...draft,
                                is_active: event.target.checked,
                              })
                            }
                            disabled={saving}
                            label="Активен"
                          />
                        ) : (
                          <StatusBadge
                            size="compact"
                            tone={row.is_active ? "success" : "neutral"}
                          >
                            {row.is_active ? "Активен" : "Отключён"}
                          </StatusBadge>
                        )}
                      </DataTableCell>
                      <DataTableCell>
                        <div className="flex items-center gap-1">
                          {editing ? (
                            <>
                              <IconButton
                                label="Сохранить"
                                variant="primary"
                                disabled={saving}
                                onClick={() => void saveEdit()}
                              >
                                <Check className="size-4" aria-hidden="true" />
                              </IconButton>
                              <IconButton
                                label="Отмена"
                                disabled={saving}
                                onClick={cancelEdit}
                              >
                                <X className="size-4" aria-hidden="true" />
                              </IconButton>
                            </>
                          ) : (
                            <>
                              <IconButton
                                label="Редактировать"
                                disabled={saving}
                                onClick={() => startEdit(row)}
                              >
                                <Pencil className="size-4" aria-hidden="true" />
                              </IconButton>
                              <IconButton
                                label="Удалить"
                                disabled={saving}
                                onClick={() => void onDelete(row)}
                              >
                                <Trash2 className="size-4" aria-hidden="true" />
                              </IconButton>
                            </>
                          )}
                        </div>
                      </DataTableCell>
                    </DataTableRow>
                  );
                })}
              </DataTableBody>
            </DataTable>
          </DataTableFrame>
        </div>

        <div className="space-y-portal-3 p-portal-4 md:hidden">
          {filtered.map((row) => {
            const editing = editingId === row.id && draft != null;
            return (
              <article
                key={row.id}
                className="rounded-portal-md border border-portal-border bg-portal-surface p-portal-4"
              >
                {editing ? (
                  <div className="grid gap-portal-3">
                    <Input
                      value={draft.name}
                      onChange={(event) =>
                        setDraft({ ...draft, name: event.target.value })
                      }
                      disabled={saving}
                      aria-label="Наименование"
                    />
                    <Input
                      value={draft.sort_order}
                      onChange={(event) =>
                        setDraft({ ...draft, sort_order: event.target.value })
                      }
                      disabled={saving}
                      inputMode="numeric"
                      aria-label="Порядок"
                    />
                    <Checkbox
                      checked={draft.is_active}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          is_active: event.target.checked,
                        })
                      }
                      disabled={saving}
                      label="Активен"
                    />
                    <div className="flex gap-1">
                      <IconButton
                        label="Сохранить"
                        variant="primary"
                        disabled={saving}
                        onClick={() => void saveEdit()}
                      >
                        <Check className="size-4" aria-hidden="true" />
                      </IconButton>
                      <IconButton
                        label="Отмена"
                        disabled={saving}
                        onClick={cancelEdit}
                      >
                        <X className="size-4" aria-hidden="true" />
                      </IconButton>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-portal-3">
                    <div>
                      <p className="font-medium text-portal-text">{row.name}</p>
                      <p className="text-portal-caption text-portal-muted">
                        Порядок: {row.sort_order}
                      </p>
                      <div className="mt-portal-2">
                        <StatusBadge
                          size="compact"
                          tone={row.is_active ? "success" : "neutral"}
                        >
                          {row.is_active ? "Активен" : "Отключён"}
                        </StatusBadge>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <IconButton
                        label="Редактировать"
                        disabled={saving}
                        onClick={() => startEdit(row)}
                      >
                        <Pencil className="size-4" aria-hidden="true" />
                      </IconButton>
                      <IconButton
                        label="Удалить"
                        disabled={saving}
                        onClick={() => void onDelete(row)}
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                      </IconButton>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            title="Типы изделий не найдены"
            description={emptyDescription}
          />
        ) : null}
      </section>

      <ListTotals primary={`Всего: ${filtered.length} типов`} />
    </div>
  );
}
