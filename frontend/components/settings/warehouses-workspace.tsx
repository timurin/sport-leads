"use client";

import { Check, FilterX, Pencil, Plus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import {
  deleteWarehouse,
  updateWarehouse,
} from "@/app/(workspace)/settings/catalogs/warehouses/warehouse-actions";
import { WarehouseCreateDrawer } from "@/components/settings/warehouse-create-drawer";
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
  filterWarehouses,
  type Warehouse,
  type WarehouseDraft,
} from "@/lib/warehouses";

/** PT-02 warehouses catalog list (`12.1.1`). */
export function WarehousesWorkspace({
  warehouses,
}: {
  warehouses: Warehouse[];
}) {
  const router = useRouter();
  const [created, setCreated] = useState<Warehouse[]>([]);
  const [patched, setPatched] = useState<Record<number, Warehouse>>({});
  const [removedIds, setRemovedIds] = useState<Set<number>>(() => new Set());
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<WarehouseDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const rows = useMemo(() => {
    const byId = new Map<number, Warehouse>();
    for (const row of warehouses) byId.set(row.id, row);
    for (const row of created) byId.set(row.id, row);
    for (const row of Object.values(patched)) byId.set(row.id, row);
    return Array.from(byId.values())
      .filter((row) => !removedIds.has(row.id))
      .sort((a, b) => {
        if (a.is_default !== b.is_default) return a.is_default ? -1 : 1;
        return a.name.localeCompare(b.name, "ru");
      });
  }, [created, patched, removedIds, warehouses]);

  const filtered = useMemo(
    () => filterWarehouses(rows, query),
    [query, rows],
  );

  const startEdit = (row: Warehouse) => {
    setEditingId(row.id);
    setDraft({
      name: row.name,
      code: row.code,
      is_active: row.is_active,
      is_default: row.is_default,
    });
    setError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft(null);
    setError(null);
  };

  const saveEdit = async () => {
    if (editingId == null || draft == null) return;
    setSaving(true);
    setError(null);
    const result = await updateWarehouse(editingId, draft);
    setSaving(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setPatched((current) => ({
      ...current,
      [result.warehouse.id]: result.warehouse,
    }));
    if (result.warehouse.is_default) {
      setPatched((current) => {
        const next = { ...current, [result.warehouse.id]: result.warehouse };
        for (const row of rows) {
          if (row.id !== result.warehouse.id && row.is_default) {
            next[row.id] = { ...row, is_default: false };
          }
        }
        return next;
      });
    }
    cancelEdit();
    router.refresh();
  };

  const remove = async (row: Warehouse) => {
    if (!window.confirm(`Удалить склад «${row.name}»?`)) return;
    setSaving(true);
    setError(null);
    const result = await deleteWarehouse(row.id);
    setSaving(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setRemovedIds((current) => new Set(current).add(row.id));
    if (editingId === row.id) cancelEdit();
    router.refresh();
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <WarehouseCreateDrawer
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(warehouse) => {
          setCreated((current) => [
            warehouse,
            ...current.filter((row) => row.id !== warehouse.id),
          ]);
          router.refresh();
        }}
      />

      <PageToolbar
        start={
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Поиск по наименованию или коду"
            className="min-w-0 w-full flex-1"
            aria-label="Поиск складов"
          />
        }
        end={
          <div className="flex flex-wrap items-center gap-1">
            <IconButton
              label="Создать склад"
              variant="primary"
              className="flex-none"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="size-4" aria-hidden="true" />
            </IconButton>
            <IconButton
              label="Сбросить фильтры"
              variant="secondary"
              className="flex-none"
              onClick={() => setQuery("")}
            >
              <FilterX className="size-4" aria-hidden="true" />
            </IconButton>
          </div>
        }
      />

      <section className="min-h-0 min-w-0 flex-1 overflow-auto bg-portal-surface">
        {error ? (
          <p
            className="border-b border-portal-danger/30 bg-portal-danger-soft px-portal-4 py-portal-2 text-portal-caption text-portal-danger"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        {filtered.length === 0 ? (
          <EmptyState
            title="Нет складов"
            description={
              rows.length === 0
                ? "Создайте склад через кнопку «+» или примените миграцию seed «Основной»."
                : "Измените поисковый запрос или сбросьте фильтры."
            }
          />
        ) : (
          <DataTableFrame className="rounded-none border-x-0 border-b-0 shadow-none">
            <DataTable minWidthClassName="min-w-[720px]">
              <DataTableHead>
                <tr>
                  <DataTableHeaderCell>Наименование</DataTableHeaderCell>
                  <DataTableHeaderCell className="w-36">Код</DataTableHeaderCell>
                  <DataTableHeaderCell className="w-36">Роль</DataTableHeaderCell>
                  <DataTableHeaderCell className="w-28">Статус</DataTableHeaderCell>
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
                            value={draft.name}
                            onChange={(event) =>
                              setDraft((prev) =>
                                prev
                                  ? { ...prev, name: event.target.value }
                                  : prev,
                              )
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
                          <Input
                            value={draft.code}
                            onChange={(event) =>
                              setDraft((prev) =>
                                prev
                                  ? { ...prev, code: event.target.value }
                                  : prev,
                              )
                            }
                            disabled={saving}
                            aria-label="Код"
                          />
                        ) : (
                          <span className="font-mono text-portal-caption text-portal-muted">
                            {row.code}
                          </span>
                        )}
                      </DataTableCell>
                      <DataTableCell>
                        {editing ? (
                          <Checkbox
                            checked={draft.is_default}
                            onChange={(event) =>
                              setDraft((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      is_default: event.target.checked,
                                    }
                                  : prev,
                              )
                            }
                            disabled={saving || row.is_default}
                            label="По умолчанию"
                          />
                        ) : row.is_default ? (
                          <StatusBadge size="compact" tone="primary">
                            По умолчанию
                          </StatusBadge>
                        ) : (
                          <span className="text-portal-muted">—</span>
                        )}
                      </DataTableCell>
                      <DataTableCell>
                        {editing ? (
                          <Checkbox
                            checked={draft.is_active}
                            onChange={(event) =>
                              setDraft((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      is_active: event.target.checked,
                                    }
                                  : prev,
                              )
                            }
                            disabled={saving}
                            label="Активен"
                          />
                        ) : (
                          <StatusBadge
                            size="compact"
                            tone={row.is_active ? "success" : "neutral"}
                          >
                            {row.is_active ? "Активен" : "Неактивен"}
                          </StatusBadge>
                        )}
                      </DataTableCell>
                      <DataTableCell>
                        {editing ? (
                          <div className="flex items-center gap-1">
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
                              variant="secondary"
                              disabled={saving}
                              onClick={cancelEdit}
                            >
                              <X className="size-4" aria-hidden="true" />
                            </IconButton>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <IconButton
                              label="Редактировать"
                              variant="secondary"
                              disabled={saving}
                              onClick={() => startEdit(row)}
                            >
                              <Pencil className="size-4" aria-hidden="true" />
                            </IconButton>
                            <IconButton
                              label="Удалить"
                              variant="secondary"
                              disabled={saving || row.is_default}
                              onClick={() => void remove(row)}
                            >
                              <Trash2 className="size-4" aria-hidden="true" />
                            </IconButton>
                          </div>
                        )}
                      </DataTableCell>
                    </DataTableRow>
                  );
                })}
              </DataTableBody>
            </DataTable>
            <ListTotals primary={`Всего: ${filtered.length}`} />
          </DataTableFrame>
        )}
      </section>
    </div>
  );
}
