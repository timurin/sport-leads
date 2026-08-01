"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  type DragEndEvent,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowDown,
  ArrowUp,
  Check,
  FilterX,
  GripVertical,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useMemo, useState } from "react";

import {
  deleteProductionStage,
  reorderProductionStages,
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
  applyProductionStageOrder,
  filterProductionStages,
  moveProductionStageInOrder,
  nextProductionStageSortOrder,
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
  const dndId = useId();
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
  const reorderEnabled = query.trim().length === 0 && editingId == null;
  const nextSortOrder = nextProductionStageSortOrder(rows);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const persistOrder = async (nextRows: ProductionStage[]) => {
    const previous = new Map(rows.map((stage) => [stage.id, stage.sort_order]));
    const changed = nextRows.filter(
      (stage) => previous.get(stage.id) !== stage.sort_order,
    );
    if (changed.length === 0) return true;
    setSaving(true);
    setError(null);
    const result = await reorderProductionStages(
      changed.map((stage) => ({ id: stage.id, sort_order: stage.sort_order })),
    );
    setSaving(false);
    if (!result.ok) {
      setError(result.message);
      return false;
    }
    setPatched((current) => {
      const next = { ...current };
      for (const stage of result.stages) next[stage.id] = stage;
      return next;
    });
    router.refresh();
    return true;
  };

  const applyLocalOrder = (nextRows: ProductionStage[]) => {
    setPatched((current) => {
      const next = { ...current };
      for (const stage of nextRows) next[stage.id] = stage;
      return next;
    });
  };

  const revertLocalOrder = (previousRows: ProductionStage[]) => {
    setPatched((current) => {
      const next = { ...current };
      for (const stage of previousRows) next[stage.id] = stage;
      return next;
    });
  };

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

  const moveByArrow = async (stageId: number, direction: -1 | 1) => {
    if (!reorderEnabled || saving) return;
    const previousRows = rows;
    const nextRows = moveProductionStageInOrder(rows, stageId, direction);
    if (!nextRows) return;
    applyLocalOrder(nextRows);
    const ok = await persistOrder(nextRows);
    if (!ok) revertLocalOrder(previousRows);
  };

  const onDragEnd = async (event: DragEndEvent) => {
    if (!reorderEnabled || saving) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = rows.findIndex((stage) => stage.id === active.id);
    const newIndex = rows.findIndex((stage) => stage.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const previousRows = rows;
    const reordered = arrayMove(rows, oldIndex, newIndex);
    const nextRows = applyProductionStageOrder(
      reordered,
      reordered.map((stage) => stage.id),
    );
    applyLocalOrder(nextRows);
    const ok = await persistOrder(nextRows);
    if (!ok) revertLocalOrder(previousRows);
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <ProductionStageCreateDrawer
        open={createOpen}
        nextSortOrder={nextSortOrder}
        onClose={() => setCreateOpen(false)}
        onCreated={(stage) => {
          setCreated((current) => [
            stage,
            ...current.filter((item) => item.id !== stage.id),
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
            aria-label="Поиск цехов"
          />
        }
        end={
          <div className="flex flex-wrap items-center gap-1">
            <IconButton
              label="Создать цех"
              variant="primary"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="size-4" aria-hidden="true" />
            </IconButton>
            <IconButton
              label="Сбросить фильтры"
              variant="secondary"
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
        {!reorderEnabled && query.trim() ? (
          <p className="border-b border-portal-border bg-portal-surface-secondary px-portal-4 py-portal-2 text-portal-caption text-portal-muted">
            Сбросьте поиск, чтобы менять порядок этапов перетаскиванием или
            стрелками.
          </p>
        ) : null}
        <DataTableFrame className="rounded-none border-x-0 border-b-0 shadow-none">
          <DndContext
            id={dndId}
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={(event) => void onDragEnd(event)}
          >
            <DataTable minWidthClassName="min-w-[720px]">
              <DataTableHead>
                <tr>
                  <DataTableHeaderCell className="w-36">
                    Порядок
                  </DataTableHeaderCell>
                  <DataTableHeaderCell>Наименование</DataTableHeaderCell>
                  <DataTableHeaderCell className="w-36">Код</DataTableHeaderCell>
                  <DataTableHeaderCell className="w-28">
                    Статус
                  </DataTableHeaderCell>
                  <DataTableHeaderCell className="w-28">
                    Действия
                  </DataTableHeaderCell>
                </tr>
              </DataTableHead>
              <SortableContext
                items={filtered.map((stage) => stage.id)}
                strategy={verticalListSortingStrategy}
                disabled={!reorderEnabled || saving}
              >
                <DataTableBody>
                  {filtered.map((stage, index) => {
                    const editing = editingId === stage.id && draft != null;
                    return (
                      <SortableStageRow
                        key={stage.id}
                        stage={stage}
                        index={index}
                        total={filtered.length}
                        editing={editing}
                        draft={draft}
                        saving={saving}
                        reorderEnabled={reorderEnabled}
                        onDraftChange={setDraft}
                        onStartEdit={() => startEdit(stage)}
                        onCancelEdit={cancelEdit}
                        onSaveEdit={() => void saveEdit()}
                        onRemove={() => void remove(stage)}
                        onMoveUp={() => void moveByArrow(stage.id, -1)}
                        onMoveDown={() => void moveByArrow(stage.id, 1)}
                      />
                    );
                  })}
                </DataTableBody>
              </SortableContext>
            </DataTable>
          </DndContext>
        </DataTableFrame>
        {filtered.length === 0 ? (
          <EmptyState
            title="Цеха не найдены"
            description={
              rows.length === 0
                ? "Каталог пуст. Создайте первый цех через кнопку «+»."
                : "Измените поисковый запрос или сбросьте фильтры."
            }
          />
        ) : null}
      </section>
      <ListTotals primary={`Всего: ${filtered.length} цехов`} />
    </div>
  );
}

function SortableStageRow({
  stage,
  index,
  total,
  editing,
  draft,
  saving,
  reorderEnabled,
  onDraftChange,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  stage: ProductionStage;
  index: number;
  total: number;
  editing: boolean;
  draft: ProductionStageDraft | null;
  saving: boolean;
  reorderEnabled: boolean;
  onDraftChange: (
    value:
      | ProductionStageDraft
      | null
      | ((current: ProductionStageDraft | null) => ProductionStageDraft | null),
  ) => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: stage.id,
    disabled: !reorderEnabled || saving || editing,
  });

  return (
    <DataTableRow
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={isDragging ? "relative z-10 bg-portal-primary-soft/60 opacity-90" : undefined}
    >
      <DataTableCell>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className={[
              "inline-flex size-portal-control-icon items-center justify-center rounded-portal-md text-portal-muted",
              reorderEnabled && !saving && !editing
                ? "cursor-grab hover:bg-portal-surface-secondary hover:text-portal-text active:cursor-grabbing"
                : "cursor-not-allowed opacity-40",
            ].join(" ")}
            aria-label={`Перетащить этап «${stage.name}»`}
            disabled={!reorderEnabled || saving || editing}
            {...attributes}
            {...(reorderEnabled && !saving && !editing ? listeners : {})}
          >
            <GripVertical className="size-4" aria-hidden="true" />
          </button>
          <IconButton
            label={`Выше: ${stage.name}`}
            variant="secondary"
            disabled={!reorderEnabled || saving || editing || index === 0}
            onClick={onMoveUp}
          >
            <ArrowUp className="size-4" aria-hidden="true" />
          </IconButton>
          <IconButton
            label={`Ниже: ${stage.name}`}
            variant="secondary"
            disabled={
              !reorderEnabled || saving || editing || index === total - 1
            }
            onClick={onMoveDown}
          >
            <ArrowDown className="size-4" aria-hidden="true" />
          </IconButton>
        </div>
      </DataTableCell>
      <DataTableCell>
        {editing && draft ? (
          <Input
            value={draft.name}
            onChange={(event) =>
              onDraftChange(
                (value) => value && { ...value, name: event.target.value },
              )
            }
            disabled={saving}
          />
        ) : (
          <span className="font-medium text-portal-text">{stage.name}</span>
        )}
      </DataTableCell>
      <DataTableCell>
        {editing && draft ? (
          <Input
            value={draft.code}
            onChange={(event) =>
              onDraftChange(
                (value) => value && { ...value, code: event.target.value },
              )
            }
            disabled={saving}
          />
        ) : (
          <span className="font-mono text-portal-caption text-portal-muted">
            {stage.code}
          </span>
        )}
      </DataTableCell>
      <DataTableCell>
        {editing && draft ? (
          <Checkbox
            checked={draft.is_active}
            onChange={(event) =>
              onDraftChange(
                (value) =>
                  value && { ...value, is_active: event.target.checked },
              )
            }
            disabled={saving}
            label="Активен"
          />
        ) : (
          <StatusBadge
            size="compact"
            tone={stage.is_active ? "success" : "neutral"}
          >
            {stage.is_active ? "Активен" : "Отключён"}
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
                onClick={onSaveEdit}
              >
                <Check className="size-4" aria-hidden="true" />
              </IconButton>
              <IconButton
                label="Отмена"
                disabled={saving}
                onClick={onCancelEdit}
              >
                <X className="size-4" aria-hidden="true" />
              </IconButton>
            </>
          ) : (
            <>
              <IconButton
                label="Редактировать"
                disabled={saving}
                onClick={onStartEdit}
              >
                <Pencil className="size-4" aria-hidden="true" />
              </IconButton>
              <IconButton
                label="Удалить"
                disabled={saving}
                onClick={onRemove}
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </IconButton>
            </>
          )}
        </div>
      </DataTableCell>
    </DataTableRow>
  );
}
