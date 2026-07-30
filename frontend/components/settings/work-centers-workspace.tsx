"use client";

import { Check, FilterX, Pencil, Plus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import {
  deleteWorkCenter,
  updateWorkCenter,
} from "@/app/(workspace)/settings/catalogs/work-centers/work-center-actions";
import { WorkCenterCreateDrawer } from "@/components/settings/work-center-create-drawer";
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
import { ListTotals } from "@/components/ui/list-pagination";
import { PageToolbar } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import type { ProductionStage } from "@/lib/production-stages";
import {
  filterWorkCenters,
  type WorkCenter,
  type WorkCenterDraft,
} from "@/lib/shop-routings";

/** PT-02 work-centers catalog list (`11.1.2.3`). */
export function WorkCentersWorkspace({
  workCenters,
  productionStages,
}: {
  workCenters: WorkCenter[];
  productionStages: ProductionStage[];
}) {
  const router = useRouter();
  const [created, setCreated] = useState<WorkCenter[]>([]);
  const [patched, setPatched] = useState<Record<number, WorkCenter>>({});
  const [removedIds, setRemovedIds] = useState<Set<number>>(() => new Set());
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<WorkCenterDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const stageNameById = useMemo(() => {
    const map = new Map<number, string>();
    for (const stage of productionStages) map.set(stage.id, stage.name);
    return map;
  }, [productionStages]);

  const rows = useMemo(() => {
    const byId = new Map<number, WorkCenter>();
    for (const row of workCenters) byId.set(row.id, row);
    for (const row of created) byId.set(row.id, row);
    for (const row of Object.values(patched)) byId.set(row.id, row);
    return Array.from(byId.values())
      .filter((row) => !removedIds.has(row.id))
      .sort((a, b) => a.name.localeCompare(b.name, "ru"));
  }, [created, patched, removedIds, workCenters]);

  const filtered = useMemo(
    () => filterWorkCenters(rows, query),
    [query, rows],
  );

  const startEdit = (row: WorkCenter) => {
    setEditingId(row.id);
    setDraft({
      name: row.name,
      code: row.code,
      production_stage_id: row.production_stage_id,
      is_active: row.is_active,
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
    const result = await updateWorkCenter(editingId, draft);
    setSaving(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setPatched((current) => ({
      ...current,
      [result.workCenter.id]: result.workCenter,
    }));
    cancelEdit();
    router.refresh();
  };

  const remove = async (row: WorkCenter) => {
    if (!window.confirm(`Удалить оборудование «${row.name}»?`)) return;
    setSaving(true);
    setError(null);
    const result = await deleteWorkCenter(row.id);
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
      <WorkCenterCreateDrawer
        open={createOpen}
        productionStages={productionStages}
        onClose={() => setCreateOpen(false)}
        onCreated={(workCenter) => {
          setCreated((current) => [
            workCenter,
            ...current.filter((row) => row.id !== workCenter.id),
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
            aria-label="Поиск оборудования"
          />
        }
        end={
          <div className="flex flex-wrap items-center gap-1">
            <IconButton
              label="Создать оборудование"
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
            title="Нет оборудования"
            description={
              rows.length === 0
                ? "Создайте первый рабочий центр через кнопку «+»."
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
                  <DataTableHeaderCell className="w-48">Цех</DataTableHeaderCell>
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
                          <Select
                            value={
                              draft.production_stage_id == null
                                ? ""
                                : String(draft.production_stage_id)
                            }
                            onChange={(event) => {
                              const raw = event.target.value;
                              setDraft((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      production_stage_id: raw
                                        ? Number(raw)
                                        : null,
                                    }
                                  : prev,
                              );
                            }}
                            disabled={saving}
                            aria-label="Цех"
                          >
                            <option value="">Не привязан</option>
                            {productionStages.map((stage) => (
                              <option key={stage.id} value={stage.id}>
                                {stage.name}
                              </option>
                            ))}
                          </Select>
                        ) : (
                          <span className="text-portal-body text-portal-muted">
                            {row.production_stage_id == null
                              ? "—"
                              : stageNameById.get(row.production_stage_id) ??
                                `#${row.production_stage_id}`}
                          </span>
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
                              disabled={saving}
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
