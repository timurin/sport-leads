"use client";

import {
  Check,
  ChevronDown,
  ChevronRight,
  FilterX,
  Folder,
  FolderOpen,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import {
  deleteWorkCenter,
  updateWorkCenter,
} from "@/app/(workspace)/settings/catalogs/work-centers/work-center-actions";
import { WorkCenterCreateDrawer } from "@/components/settings/work-center-create-drawer";
import {
  CatalogTreeDepthCell,
  CatalogTreeDndProvider,
  CatalogTreeDraggableItem,
  CatalogTreeDroppableFolder,
  CatalogTreeRootDropZone,
} from "@/components/settings/catalog-folder-tree-dnd";
import { IconButton } from "@/components/ui/button";
import { catalogFolderRowSurfaceClass } from "@/lib/catalog-folder-dnd";
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
  buildWorkCenterCatalogTreeRows,
  filterWorkCenters,
  visibleWorkCenterCatalogTreeRows,
  WORK_CENTER_UNASSIGNED_FOLDER_ID,
  type WorkCenter,
  type WorkCenterDraft,
} from "@/lib/shop-routings";

/** PT-02 work-centers catalog list (`11.1.2.3`) with stage folders. */
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
  const [createStageId, setCreateStageId] = useState<number | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(
    () => new Set(productionStages.map((stage) => stage.id)),
  );

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
    return Array.from(byId.values()).filter((row) => !removedIds.has(row.id));
  }, [created, patched, removedIds, workCenters]);

  const filtered = useMemo(
    () => filterWorkCenters(rows, query),
    [query, rows],
  );

  const treeRows = useMemo(
    () =>
      buildWorkCenterCatalogTreeRows(
        productionStages.map((stage) => ({
          id: stage.id,
          name: stage.name,
          sort_order: stage.sort_order,
        })),
        filtered,
      ),
    [filtered, productionStages],
  );

  const searchActive = Boolean(query.trim());
  const effectiveExpanded = useMemo(() => {
    if (!searchActive) return expandedIds;
    const next = new Set(expandedIds);
    for (const row of treeRows) {
      if (row.kind === "folder") next.add(row.id);
    }
    return next;
  }, [expandedIds, searchActive, treeRows]);

  const visibleRows = useMemo(
    () => visibleWorkCenterCatalogTreeRows(treeRows, effectiveExpanded),
    [effectiveExpanded, treeRows],
  );

  const equipmentCount = useMemo(
    () => visibleRows.filter((row) => row.kind === "work_center").length,
    [visibleRows],
  );

  const dndEnabled = query.trim().length === 0 && editingId == null && !saving;

  const onCatalogDrop = async ({
    active,
    over,
  }: {
    active: { kind: string; id?: number };
    over: { kind: string; id?: number };
  }) => {
    if (active.kind !== "item" || typeof active.id !== "number") return;
    const stageId =
      over.kind === "root" ||
      (over.kind === "folder" && over.id === WORK_CENTER_UNASSIGNED_FOLDER_ID)
        ? null
        : over.kind === "folder" && typeof over.id === "number"
          ? over.id
          : undefined;
    if (stageId === undefined) return;
    const current = rows.find((row) => row.id === active.id);
    if (!current || current.production_stage_id === stageId) return;
    setSaving(true);
    setError(null);
    const result = await updateWorkCenter(active.id, {
      name: current.name,
      code: current.code,
      production_stage_id: stageId,
      is_active: current.is_active,
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setPatched((prev) => ({ ...prev, [result.workCenter.id]: result.workCenter }));
    if (stageId != null) {
      setExpandedIds((prev) => new Set(prev).add(stageId));
    } else {
      setExpandedIds((prev) => new Set(prev).add(WORK_CENTER_UNASSIGNED_FOLDER_ID));
    }
    router.refresh();
  };


  const toggleFolder = (folderId: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  };

  const openCreate = (productionStageId: number | null = null) => {
    setCreateStageId(productionStageId);
    setCreateOpen(true);
    if (productionStageId != null) {
      setExpandedIds((prev) => new Set(prev).add(productionStageId));
    } else {
      setExpandedIds((prev) =>
        new Set(prev).add(WORK_CENTER_UNASSIGNED_FOLDER_ID),
      );
    }
  };

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
    if (result.workCenter.production_stage_id != null) {
      setExpandedIds((prev) =>
        new Set(prev).add(result.workCenter.production_stage_id!),
      );
    } else {
      setExpandedIds((prev) =>
        new Set(prev).add(WORK_CENTER_UNASSIGNED_FOLDER_ID),
      );
    }
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
        defaultProductionStageId={createStageId}
        onClose={() => {
          setCreateOpen(false);
          setCreateStageId(null);
        }}
        onCreated={(workCenter) => {
          setCreated((current) => [
            workCenter,
            ...current.filter((row) => row.id !== workCenter.id),
          ]);
          if (workCenter.production_stage_id != null) {
            setExpandedIds((prev) =>
              new Set(prev).add(workCenter.production_stage_id!),
            );
          } else {
            setExpandedIds((prev) =>
              new Set(prev).add(WORK_CENTER_UNASSIGNED_FOLDER_ID),
            );
          }
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
              onClick={() => openCreate(null)}
            >
              <Plus className="size-4" aria-hidden="true" />
            </IconButton>
            <IconButton
              label="Сбросить фильтры"
              variant="secondary"
              className="flex-none"
              onClick={() => setQuery("")}
              disabled={!query}
            >
              <FilterX className="size-4" aria-hidden="true" />
            </IconButton>
          </div>
        }
      />

      <section className="min-h-0 min-w-0 flex-1 overflow-auto bg-portal-surface">
      <CatalogTreeDndProvider enabled={dndEnabled} onDrop={onCatalogDrop}>
        {dndEnabled ? (
          <CatalogTreeRootDropZone label="Перетащите сюда, чтобы убрать привязку к цеху" />
        ) : null}
        {error ? (
          <p
            className="border-b border-portal-danger/30 bg-portal-danger-soft px-portal-4 py-portal-2 text-portal-caption text-portal-danger"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        {treeRows.length === 0 ? (
          <EmptyState
            title="Нет цехов и оборудования"
            description="Создайте цеха в каталоге этапов производства, затем добавьте оборудование."
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
                  <DataTableHeaderCell className="w-36">
                    Действия
                  </DataTableHeaderCell>
                </tr>
              </DataTableHead>
              <DataTableBody>
                {visibleRows.length === 0 ? (
                  <DataTableRow>
                    <DataTableCell colSpan={5}>
                      <EmptyState
                        title="Нет оборудования"
                        description={
                          rows.length === 0
                            ? "Создайте первый рабочий центр через кнопку «+» или в папке цеха."
                            : "Измените поисковый запрос или сбросьте фильтры."
                        }
                      />
                    </DataTableCell>
                  </DataTableRow>
                ) : (
                  visibleRows.map((row) => {
                    if (row.kind === "folder") {
                      const expanded =
                        effectiveExpanded.has(row.id) || searchActive;
                      const folderStageId = row.production_stage_id;
                      return (
                        <CatalogTreeDroppableFolder
                          key={`folder-${row.id}`}
                          folderId={row.id}
                          disabled={!dndEnabled}
                          className={catalogFolderRowSurfaceClass()}
                        >
                          {() => (
                            <>
                          <DataTableCell colSpan={4}>
                            <CatalogTreeDepthCell depth={row.depth}>
                              <IconButton
                                type="button"
                                label={expanded ? "Свернуть" : "Развернуть"}
                                onClick={() => toggleFolder(row.id)}
                              >
                                {expanded ? (
                                  <ChevronDown
                                    className="size-4"
                                    aria-hidden="true"
                                  />
                                ) : (
                                  <ChevronRight
                                    className="size-4"
                                    aria-hidden="true"
                                  />
                                )}
                              </IconButton>
                              {expanded ? (
                                <FolderOpen
                                  className="size-4 shrink-0 text-portal-muted"
                                  aria-hidden="true"
                                />
                              ) : (
                                <Folder
                                  className="size-4 shrink-0 text-portal-muted"
                                  aria-hidden="true"
                                />
                              )}
                              <span className="font-medium text-portal-text">
                                {row.name}
                              </span>
                            </CatalogTreeDepthCell>
                          </DataTableCell>
                          <DataTableCell>
                            <div className="flex items-center justify-end">
                              <IconButton
                                type="button"
                                label="Создать оборудование в цехе"
                                onClick={() => openCreate(folderStageId)}
                              >
                                <Plus
                                  className="size-3.5"
                                  aria-hidden="true"
                                />
                              </IconButton>
                            </div>
                          </DataTableCell>
                            </>
                          )}
                        </CatalogTreeDroppableFolder>
                      );
                    }

                    const item = row.workCenter;
                    const editing = editingId === item.id && draft != null;
                    return (
                      <CatalogTreeDraggableItem
                        key={`wc-${item.id}`}
                        itemId={item.id}
                        label={item.name}
                        disabled={!dndEnabled || editing}
                      >
                        {({ handle }) => (
                          <>
                        <DataTableCell>
                          <CatalogTreeDepthCell depth={row.depth}>
                            {handle}
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
                                {item.name}
                              </span>
                            )}
                          </CatalogTreeDepthCell>
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
                              {item.code}
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
                              {item.production_stage_id == null
                                ? "—"
                                : stageNameById.get(item.production_stage_id) ??
                                  `#${item.production_stage_id}`}
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
                              tone={item.is_active ? "success" : "neutral"}
                            >
                              {item.is_active ? "Активен" : "Неактивен"}
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
                                onClick={() => startEdit(item)}
                              >
                                <Pencil
                                  className="size-4"
                                  aria-hidden="true"
                                />
                              </IconButton>
                              <IconButton
                                label="Удалить"
                                variant="secondary"
                                disabled={saving}
                                onClick={() => void remove(item)}
                              >
                                <Trash2
                                  className="size-4"
                                  aria-hidden="true"
                                />
                              </IconButton>
                            </div>
                          )}
                        </DataTableCell>
                          </>
                        )}
                      </CatalogTreeDraggableItem>
                    );
                  })
                )}
              </DataTableBody>
            </DataTable>
            <ListTotals primary={`Оборудование: ${equipmentCount}`} />
          </DataTableFrame>
        )}
      </CatalogTreeDndProvider>
      </section>
    </div>
  );
}
