"use client";

import { Check, FilterX, Pencil, Plus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import {
  deleteSewingOperation,
  updateSewingOperation,
} from "@/app/(workspace)/settings/catalogs/sewing_operations/sewing-operation-actions";
import { SewingOperationCreateDrawer } from "@/components/settings/sewing-operation-create-drawer";
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
import { ListTotals } from "@/components/ui/list-pagination";
import { PageToolbar } from "@/components/ui/page-header";
import {
  filterSewingOperations,
  formatSewingCost,
  type SewingOperation,
  type SewingOperationCreateDraft,
} from "@/lib/sewing-operations";

type RowDraft = SewingOperationCreateDraft;

/** PT-02 sewing-operations catalog list (`DS-PT-02-CATALOG`, etalon product-models). */
export function SewingOperationsWorkspace({
  operations,
}: {
  operations: SewingOperation[];
}) {
  const router = useRouter();
  const [created, setCreated] = useState<SewingOperation[]>([]);
  const [patched, setPatched] = useState<Record<number, SewingOperation>>({});
  const [removedIds, setRemovedIds] = useState<Set<number>>(() => new Set());
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<RowDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const rows = useMemo(() => {
    const byId = new Map<number, SewingOperation>();
    for (const row of operations) byId.set(row.id, row);
    for (const row of created) byId.set(row.id, row);
    for (const row of Object.values(patched)) byId.set(row.id, row);
    return Array.from(byId.values())
      .filter((row) => !removedIds.has(row.id))
      .sort((a, b) => a.name.localeCompare(b.name, "ru"));
  }, [created, operations, patched, removedIds]);

  const filtered = useMemo(
    () => filterSewingOperations(rows, query),
    [query, rows],
  );

  const clearFilters = () => setQuery("");

  const startEdit = (row: SewingOperation) => {
    setEditingId(row.id);
    setDraft({ name: row.name, cost: formatSewingCost(row.cost) });
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
      const result = await updateSewingOperation(editingId, draft);
      if (!result.ok) {
        setRowError(result.message);
        setSaving(false);
        return;
      }
      setPatched((prev) => ({ ...prev, [result.operation.id]: result.operation }));
      cancelEdit();
      router.refresh();
    } catch {
      setRowError("Не удалось сохранить изменения.");
    }
    setSaving(false);
  };

  const onDelete = async (row: SewingOperation) => {
    if (!window.confirm(`Удалить операцию «${row.name}»?`)) return;
    setSaving(true);
    setRowError(null);
    try {
      const result = await deleteSewingOperation(row.id);
      if (!result.ok) {
        setRowError(result.message);
        setSaving(false);
        return;
      }
      setRemovedIds((prev) => new Set(prev).add(row.id));
      if (editingId === row.id) cancelEdit();
      router.refresh();
    } catch {
      setRowError("Не удалось удалить операцию.");
    }
    setSaving(false);
  };

  const emptyDescription =
    rows.length === 0
      ? "Каталог пуст. Создайте первую операцию через кнопку «+»."
      : "Измените поисковый запрос или сбросьте фильтры.";

  const handleCreated = (operation: SewingOperation) => {
    setCreated((prev) => [
      operation,
      ...prev.filter((row) => row.id !== operation.id),
    ]);
    router.refresh();
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <SewingOperationCreateDrawer
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
            aria-label="Поиск операций пошива"
          />
        }
        end={
          <div className="flex flex-wrap items-center gap-1">
            <IconButton
              label="Создать операцию"
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
            <DataTable minWidthClassName="min-w-[640px]">
              <DataTableHead>
                <tr>
                  <DataTableHeaderCell>Наименование</DataTableHeaderCell>
                  <DataTableHeaderCell className="w-40">
                    Стоимость
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
                          <Input
                            value={draft.cost}
                            onChange={(event) =>
                              setDraft({ ...draft, cost: event.target.value })
                            }
                            disabled={saving}
                            inputMode="decimal"
                            aria-label="Стоимость"
                          />
                        ) : (
                          formatSewingCost(row.cost)
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
                      value={draft.cost}
                      onChange={(event) =>
                        setDraft({ ...draft, cost: event.target.value })
                      }
                      disabled={saving}
                      inputMode="decimal"
                      aria-label="Стоимость"
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
                        {formatSewingCost(row.cost)}
                      </p>
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
            title="Операции не найдены"
            description={emptyDescription}
          />
        ) : null}
      </section>

      <ListTotals primary={`Всего: ${filtered.length} операций`} />
    </div>
  );
}
