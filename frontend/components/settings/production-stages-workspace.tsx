"use client";

import { Check, FilterX, Pencil, Plus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import {
  deleteProductionStage,
  updateProductionStage,
} from "@/app/(workspace)/settings/catalogs/production-stages/production-stage-actions";
import { ProductionStageCreateDrawer } from "@/components/settings/production-stage-create-drawer";
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
  filterProductionStages,
  type ProductionStage,
  type ProductionStageDraft,
} from "@/lib/production-stages";

/** PT-02 production-stages catalog list. */
export function ProductionStagesWorkspace({
  stages,
}: {
  stages: ProductionStage[];
}) {
  const router = useRouter();
  const [created, setCreated] = useState<ProductionStage[]>([]);
  const [patched, setPatched] = useState<Record<number, ProductionStage>>({});
  const [removedIds, setRemovedIds] = useState<Set<number>>(() => new Set());
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<ProductionStageDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const rows = useMemo(() => {
    const byId = new Map<number, ProductionStage>();
    [...stages, ...created, ...Object.values(patched)].forEach((stage) =>
      byId.set(stage.id, stage),
    );
    return Array.from(byId.values())
      .filter((stage) => !removedIds.has(stage.id))
      .sort(
        (a, b) =>
          a.sort_order - b.sort_order || a.name.localeCompare(b.name, "ru"),
      );
  }, [created, patched, removedIds, stages]);
  const filtered = useMemo(
    () => filterProductionStages(rows, query),
    [query, rows],
  );

  const startEdit = (stage: ProductionStage) => {
    setEditingId(stage.id);
    setDraft({
      name: stage.name,
      code: stage.code,
      is_active: stage.is_active,
      sort_order: stage.sort_order,
    });
    setError(null);
  };
  const cancelEdit = () => {
    setEditingId(null);
    setDraft(null);
    setError(null);
  };
  const saveEdit = async () => {
    if (editingId == null || !draft) return;
    setSaving(true);
    const result = await updateProductionStage(editingId, draft);
    setSaving(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setPatched((current) => ({ ...current, [result.stage.id]: result.stage }));
    cancelEdit();
    router.refresh();
  };
  const remove = async (stage: ProductionStage) => {
    if (!window.confirm(`Удалить цех «${stage.name}»?`)) return;
    setSaving(true);
    const result = await deleteProductionStage(stage.id);
    setSaving(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setRemovedIds((current) => new Set(current).add(stage.id));
    router.refresh();
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <ProductionStageCreateDrawer
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(stage) => {
          setCreated((current) => [stage, ...current.filter((item) => item.id !== stage.id)]);
          router.refresh();
        }}
      />
      <PageToolbar
        start={<Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск по наименованию или коду" className="min-w-0 w-full flex-1" aria-label="Поиск цехов" />}
        end={
          <div className="flex flex-wrap items-center gap-1">
            <IconButton label="Создать цех" variant="primary" onClick={() => setCreateOpen(true)}><Plus className="size-4" aria-hidden="true" /></IconButton>
            <IconButton label="Сбросить фильтры" variant="secondary" onClick={() => setQuery("")}><FilterX className="size-4" aria-hidden="true" /></IconButton>
          </div>
        }
      />
      <section className="min-h-0 min-w-0 flex-1 overflow-auto bg-portal-surface">
        {error ? <p className="border-b border-portal-danger/30 bg-portal-danger-soft px-portal-4 py-portal-2 text-portal-caption text-portal-danger" role="alert">{error}</p> : null}
        <DataTableFrame className="rounded-none border-x-0 border-b-0 shadow-none">
          <DataTable minWidthClassName="min-w-[720px]">
            <DataTableHead><tr><DataTableHeaderCell>Наименование</DataTableHeaderCell><DataTableHeaderCell className="w-36">Код</DataTableHeaderCell><DataTableHeaderCell className="w-28">Порядок</DataTableHeaderCell><DataTableHeaderCell className="w-28">Статус</DataTableHeaderCell><DataTableHeaderCell className="w-28">Действия</DataTableHeaderCell></tr></DataTableHead>
            <DataTableBody>
              {filtered.map((stage) => {
                const editing = editingId === stage.id && draft != null;
                return <DataTableRow key={stage.id}>
                  <DataTableCell>{editing ? <Input value={draft.name} onChange={(event) => setDraft((value) => value && { ...value, name: event.target.value })} disabled={saving} /> : <span className="font-medium text-portal-text">{stage.name}</span>}</DataTableCell>
                  <DataTableCell>{editing ? <Input value={draft.code} onChange={(event) => setDraft((value) => value && { ...value, code: event.target.value })} disabled={saving} /> : <span className="font-mono text-portal-caption text-portal-muted">{stage.code}</span>}</DataTableCell>
                  <DataTableCell>{editing ? <Input value={String(draft.sort_order)} inputMode="numeric" onChange={(event) => setDraft((value) => value && { ...value, sort_order: Number(event.target.value) || 0 })} disabled={saving} /> : stage.sort_order}</DataTableCell>
                  <DataTableCell>{editing ? <Checkbox checked={draft.is_active} onChange={(event) => setDraft((value) => value && { ...value, is_active: event.target.checked })} disabled={saving} label="Активен" /> : <StatusBadge size="compact" tone={stage.is_active ? "success" : "neutral"}>{stage.is_active ? "Активен" : "Отключён"}</StatusBadge>}</DataTableCell>
                  <DataTableCell><div className="flex items-center gap-1">{editing ? <><IconButton label="Сохранить" variant="primary" disabled={saving} onClick={() => void saveEdit()}><Check className="size-4" aria-hidden="true" /></IconButton><IconButton label="Отмена" disabled={saving} onClick={cancelEdit}><X className="size-4" aria-hidden="true" /></IconButton></> : <><IconButton label="Редактировать" disabled={saving} onClick={() => startEdit(stage)}><Pencil className="size-4" aria-hidden="true" /></IconButton><IconButton label="Удалить" disabled={saving} onClick={() => void remove(stage)}><Trash2 className="size-4" aria-hidden="true" /></IconButton></>}</div></DataTableCell>
                </DataTableRow>;
              })}
            </DataTableBody>
          </DataTable>
        </DataTableFrame>
        {filtered.length === 0 ? <EmptyState title="Цеха не найдены" description={rows.length === 0 ? "Каталог пуст. Создайте первый цех через кнопку «+»." : "Измените поисковый запрос или сбросьте фильтры."} /> : null}
      </section>
      <ListTotals primary={`Всего: ${filtered.length} цехов`} />
    </div>
  );
}
