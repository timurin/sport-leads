"use client";

import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  FilterX,
  Folder,
  FolderInput,
  FolderOpen,
  FolderPlus,
  Layers,
  Pencil,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";

import {
  copySewingOperation,
  createSewingOperationFolder,
  deleteSewingOperation,
  deleteSewingOperationFolder,
  downloadSewingOperationExport,
  moveSewingOperationFolderSibling,
  moveSewingOperationSibling,
  moveSewingOperationsToFolder,
  updateSewingOperation,
  updateSewingOperationFolder,
} from "@/app/(workspace)/settings/catalogs/sewing_operations/sewing-operation-actions";
import { CatalogFolderMoveModal } from "@/components/settings/catalog-folder-move-modal";
import {
  CatalogTreeDepthCell,
  CatalogTreeDndProvider,
  CatalogTreeDraggableFolder,
  CatalogTreeDraggableItem,
  CatalogTreeRootDropZone,
} from "@/components/settings/catalog-folder-tree-dnd";
import { SewingOperationCreateDrawer } from "@/components/settings/sewing-operation-create-drawer";
import { SewingOperationEquipmentPicker } from "@/components/settings/sewing-operation-equipment-picker";
import { SewingOperationImportDrawer } from "@/components/settings/sewing-operation-import-drawer";
import { SewingOperationTemplatesModal } from "@/components/settings/sewing-operation-templates-modal";
import { Button, IconButton } from "@/components/ui/button";
import {
  canNestCatalogFolder,
  catalogFolderRowSurfaceClass,
  catalogFolderWouldChangeParent,
  isCatalogFolderDescendant,
} from "@/lib/catalog-folder-dnd";
import type { SewingOperationTemplate } from "@/lib/sewing-operation-templates";
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
import { triggerBrowserDownload } from "@/lib/file-download";
import {
  buildSewingCatalogTreeRows,
  filterSewingOperations,
  formatDurationSecondsLabel,
  formatSewingCost,
  formatSewingEquipmentLabels,
  sewingOperationLineTotal,
  toSewingCostInput,
  visibleSewingCatalogTreeRows,
  type SewingOperation,
  type SewingOperationCreateDraft,
  type SewingOperationFolder,
} from "@/lib/sewing-operations";
import type { WorkCenter } from "@/lib/shop-routings";

type RowDraft = SewingOperationCreateDraft;

/** PT-02 sewing-operations catalog with folder tree (`6.3.11`) + templates modal (`6.3.12`). */
export function SewingOperationsWorkspace({
  operations,
  folders,
  sewingWorkCenters,
  templates = [],
}: {
  operations: SewingOperation[];
  folders: SewingOperationFolder[];
  sewingWorkCenters: WorkCenter[];
  templates?: SewingOperationTemplate[];
}) {
  const router = useRouter();
  const [created, setCreated] = useState<SewingOperation[]>([]);
  const [patched, setPatched] = useState<Record<number, SewingOperation>>({});
  const [removedIds, setRemovedIds] = useState<Set<number>>(() => new Set());
  const [localFolders, setLocalFolders] = useState<SewingOperationFolder[]>(folders);
  const [query, setQuery] = useState("");
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<RowDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createFolderId, setCreateFolderId] = useState<number | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(() => new Set());
  const [moveSelectMode, setMoveSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set());
  const [moveModalIds, setMoveModalIds] = useState<number[] | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [exportPending, startExportTransition] = useTransition();
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    setLocalFolders(folders);
  }, [folders]);

  const rows = useMemo(() => {
    const byId = new Map<number, SewingOperation>();
    for (const row of operations) byId.set(row.id, row);
    for (const row of created) byId.set(row.id, row);
    for (const row of Object.values(patched)) byId.set(row.id, row);
    return Array.from(byId.values()).filter((row) => !removedIds.has(row.id));
  }, [created, operations, patched, removedIds]);

  const filteredOps = useMemo(
    () => filterSewingOperations(rows, query),
    [query, rows],
  );

  const treeRows = useMemo(
    () => buildSewingCatalogTreeRows(localFolders, filteredOps),
    [filteredOps, localFolders],
  );

  const visibleRows = useMemo(() => {
    if (query.trim()) {
      // Search: show matching ops + ancestor folders expanded/forced visible.
      return treeRows.filter((row) => {
        if (row.kind === "operation") return true;
        return filteredOps.some(
          (op) =>
            op.folder_id != null &&
            (op.folder_id === row.id ||
              isCatalogFolderDescendant(localFolders, op.folder_id, row.id)),
        );
      });
    }
    return visibleSewingCatalogTreeRows(treeRows, expandedIds);
  }, [expandedIds, filteredOps, localFolders, query, treeRows]);

  const dndEnabled =
    query.trim().length === 0 &&
    editingId == null &&
    !saving &&
    !moveSelectMode;

  const folderNodes = useMemo(
    () =>
      localFolders.map((folder) => ({
        id: folder.id,
        parent_id: folder.parent_id,
      })),
    [localFolders],
  );

  const onCatalogDrop = async ({
    active,
    over,
  }: {
    active: { kind: string; id?: number };
    over: { kind: string; id?: number };
  }) => {
    setRowError(null);
    if (active.kind === "folder" && typeof active.id === "number") {
      const targetParentId =
        over.kind === "root"
          ? null
          : over.kind === "folder" && typeof over.id === "number"
            ? over.id
            : undefined;
      if (targetParentId === undefined) return;
      if (!canNestCatalogFolder(folderNodes, active.id, targetParentId)) {
        setRowError("Нельзя вложить папку в себя или в своего потомка.");
        return;
      }
      if (
        !catalogFolderWouldChangeParent(folderNodes, active.id, targetParentId)
      ) {
        return;
      }
      setSaving(true);
      try {
        const result = await updateSewingOperationFolder(active.id, {
          parent_id: targetParentId,
        });
        if (!result.ok) {
          setRowError(result.message);
          return;
        }
        setLocalFolders((prev) =>
          prev.map((folder) =>
            folder.id === result.folder.id ? result.folder : folder,
          ),
        );
        if (targetParentId != null) {
          setExpandedIds((prev) => new Set(prev).add(targetParentId));
        }
        router.refresh();
      } catch {
        setRowError("Не удалось переместить папку.");
      } finally {
        setSaving(false);
      }
      return;
    }

    if (active.kind === "item" && typeof active.id === "number") {
      const folderId =
        over.kind === "root"
          ? null
          : over.kind === "folder" && typeof over.id === "number"
            ? over.id
            : undefined;
      if (folderId === undefined) return;
      const current = rows.find((row) => row.id === active.id);
      if (current && current.folder_id === folderId) return;
      setSaving(true);
      try {
        const result = await moveSewingOperationsToFolder(
          [active.id],
          folderId,
        );
        if (!result.ok) {
          setRowError(result.message);
          return;
        }
        setPatched((prev) => {
          const next = { ...prev };
          for (const operation of result.operations) {
            next[operation.id] = operation;
          }
          return next;
        });
        if (folderId != null) {
          setExpandedIds((prev) => new Set(prev).add(folderId));
        }
        router.refresh();
      } catch {
        setRowError("Не удалось переместить операцию.");
      } finally {
        setSaving(false);
      }
    }
  };

  const clearFilters = () => setQuery("");

  const onExportCatalog = () => {
    setExportError(null);
    startExportTransition(async () => {
      try {
        const payload = await downloadSewingOperationExport({
          format: "csv",
          search: query || undefined,
        });
        triggerBrowserDownload(payload);
      } catch (caught) {
        setExportError(
          caught instanceof Error
            ? caught.message
            : "Не удалось экспортировать операции",
        );
      }
    });
  };

  const toggleFolder = (folderId: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  };

  const openMoveModal = (ids: number[]) => {
    if (ids.length === 0) return;
    setMoveModalIds(ids);
    setRowError(null);
  };

  const onMoveToolbar = () => {
    if (!moveSelectMode) {
      setMoveSelectMode(true);
      setSelectedIds(new Set());
      setEditingId(null);
      setDraft(null);
      setRowError(null);
      return;
    }
    if (selectedIds.size === 0) {
      setMoveSelectMode(false);
      return;
    }
    openMoveModal([...selectedIds]);
  };

  const onMoveOperations = async (folderId: number | null) => {
    if (moveModalIds == null || moveModalIds.length === 0) return;
    setSaving(true);
    setRowError(null);
    try {
      const result = await moveSewingOperationsToFolder(moveModalIds, folderId);
      if (!result.ok) {
        setRowError(result.message);
        setSaving(false);
        return;
      }
      setPatched((prev) => {
        const next = { ...prev };
        for (const operation of result.operations) next[operation.id] = operation;
        return next;
      });
      setMoveModalIds(null);
      setMoveSelectMode(false);
      setSelectedIds(new Set());
      if (folderId != null) {
        setExpandedIds((prev) => new Set(prev).add(folderId));
      }
      router.refresh();
    } catch {
      setRowError("Не удалось переместить операции.");
    }
    setSaving(false);
  };

  const toggleSelected = (operationId: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(operationId)) next.delete(operationId);
      else next.add(operationId);
      return next;
    });
  };

  const visibleOperations = useMemo(
    () =>
      visibleRows
        .filter((row) => row.kind === "operation")
        .map((row) => row.operation),
    [visibleRows],
  );

  const allVisibleSelected =
    visibleOperations.length > 0 &&
    visibleOperations.every((op) => selectedIds.has(op.id));

  const toggleSelectAllVisible = () => {
    setSelectedIds((prev) => {
      if (visibleOperations.length === 0) return prev;
      if (visibleOperations.every((op) => prev.has(op.id))) {
        const next = new Set(prev);
        for (const op of visibleOperations) next.delete(op.id);
        return next;
      }
      const next = new Set(prev);
      for (const op of visibleOperations) next.add(op.id);
      return next;
    });
  };

  const folderMoveOptions = buildSewingCatalogTreeRows(localFolders, [])
    .filter((row) => row.kind === "folder")
    .map((row) =>
      row.kind === "folder"
        ? { id: row.id, name: row.name, depth: row.depth }
        : null,
    )
    .filter((row): row is { id: number; name: string; depth: number } => row != null);

  const operationCountLabel = (count: number) => {
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod10 === 1 && mod100 !== 11) return `${count} операцию`;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
      return `${count} операции`;
    }
    return `${count} операций`;
  };

  const startEdit = (row: SewingOperation) => {
    setEditingId(row.id);
    setDraft({
      name: row.name,
      cost: toSewingCostInput(row.cost),
      quantity_per_item: String(row.quantity_per_item ?? 1),
      duration_seconds: String(row.duration_seconds ?? 0),
      folder_id: row.folder_id,
      work_center_ids: [...(row.work_center_ids ?? [])],
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

  const onDeleteOp = async (row: SewingOperation) => {
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

  const onCreateFolder = async (parentId: number | null) => {
    const name = window.prompt(
      parentId == null ? "Название папки (корень)" : "Название вложенной папки",
    );
    if (name == null) return;
    setSaving(true);
    setRowError(null);
    try {
      const result = await createSewingOperationFolder({
        name,
        parent_id: parentId,
      });
      if (!result.ok) {
        setRowError(result.message);
        setSaving(false);
        return;
      }
      setLocalFolders((prev) => [...prev, result.folder]);
      if (parentId != null) {
        setExpandedIds((prev) => new Set(prev).add(parentId));
      }
      router.refresh();
    } catch {
      setRowError("Не удалось создать папку.");
    }
    setSaving(false);
  };

  const onRenameFolder = async (folder: SewingOperationFolder) => {
    const name = window.prompt("Переименовать папку", folder.name);
    if (name == null || name.trim() === folder.name) return;
    setSaving(true);
    setRowError(null);
    try {
      const result = await updateSewingOperationFolder(folder.id, { name });
      if (!result.ok) {
        setRowError(result.message);
        setSaving(false);
        return;
      }
      setLocalFolders((prev) =>
        prev.map((item) => (item.id === folder.id ? result.folder : item)),
      );
      router.refresh();
    } catch {
      setRowError("Не удалось переименовать папку.");
    }
    setSaving(false);
  };

  const onDeleteFolder = async (folder: SewingOperationFolder) => {
    if (!window.confirm(`Удалить папку «${folder.name}»? Она должна быть пустой.`)) {
      return;
    }
    setSaving(true);
    setRowError(null);
    try {
      const result = await deleteSewingOperationFolder(folder.id);
      if (!result.ok) {
        setRowError(result.message);
        setSaving(false);
        return;
      }
      setLocalFolders((prev) => prev.filter((item) => item.id !== folder.id));
      router.refresh();
    } catch {
      setRowError("Не удалось удалить папку.");
    }
    setSaving(false);
  };

  const onMoveFolder = async (
    folderId: number,
    direction: "up" | "down",
  ) => {
    setSaving(true);
    setRowError(null);
    try {
      const result = await moveSewingOperationFolderSibling(folderId, direction);
      if (!result.ok) {
        setRowError(result.message);
        setSaving(false);
        return;
      }
      router.refresh();
    } catch {
      setRowError("Не удалось переместить папку.");
    }
    setSaving(false);
  };

  const onMoveOp = async (operationId: number, direction: "up" | "down") => {
    setSaving(true);
    setRowError(null);
    try {
      const result = await moveSewingOperationSibling(operationId, direction);
      if (!result.ok) {
        setRowError(result.message);
        setSaving(false);
        return;
      }
      setPatched((prev) => ({ ...prev, [result.operation.id]: result.operation }));
      router.refresh();
    } catch {
      setRowError("Не удалось переместить операцию.");
    }
    setSaving(false);
  };

  const handleCreated = (operation: SewingOperation) => {
    setCreated((prev) => [
      operation,
      ...prev.filter((row) => row.id !== operation.id),
    ]);
    if (operation.folder_id != null) {
      setExpandedIds((prev) => new Set(prev).add(operation.folder_id!));
    }
    router.refresh();
  };

  const onCopyOp = async (row: SewingOperation) => {
    setSaving(true);
    setRowError(null);
    try {
      const result = await copySewingOperation(
        row.id,
        rows.map((item) => item.name),
      );
      if (!result.ok) {
        setRowError(result.message);
        setSaving(false);
        return;
      }
      handleCreated(result.operation);
    } catch {
      setRowError("Не удалось скопировать операцию.");
    }
    setSaving(false);
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <SewingOperationCreateDrawer
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={handleCreated}
        sewingWorkCenters={sewingWorkCenters}
        folders={localFolders}
        defaultFolderId={createFolderId}
      />

      <SewingOperationImportDrawer
        open={importOpen}
        onClose={() => setImportOpen(false)}
      />

      <SewingOperationTemplatesModal
        open={templatesOpen}
        onClose={() => setTemplatesOpen(false)}
        templates={templates}
        operations={rows}
        folders={localFolders}
      />

      <CatalogFolderMoveModal
        open={moveModalIds != null}
        onClose={() => {
          if (saving) return;
          setMoveModalIds(null);
        }}
        onConfirm={onMoveOperations}
        folders={folderMoveOptions}
        itemCount={moveModalIds?.length ?? 0}
        itemLabel={operationCountLabel}
        busy={saving}
        initialFolderId={
          moveModalIds?.length === 1
            ? (rows.find((op) => op.id === moveModalIds[0])?.folder_id ?? null)
            : null
        }
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
              type="button"
              label="Сбросить поиск"
              onClick={clearFilters}
              disabled={!query}
            >
              <FilterX className="size-4" />
            </IconButton>
            <IconButton
              type="button"
              label="Шаблоны операций"
              onClick={() => setTemplatesOpen(true)}
            >
              <Layers className="size-4" />
            </IconButton>
            <IconButton
              type="button"
              label={
                moveSelectMode
                  ? selectedIds.size > 0
                    ? `Переместить (${selectedIds.size})`
                    : "Выйти из режима переноса"
                  : "Переместить в папку"
              }
              variant={moveSelectMode ? "primary" : "secondary"}
              aria-pressed={moveSelectMode}
              disabled={saving}
              onClick={onMoveToolbar}
            >
              <FolderInput className="size-4" />
            </IconButton>
            <IconButton
              type="button"
              label="Создать папку"
              onClick={() => void onCreateFolder(null)}
              disabled={saving}
            >
              <FolderPlus className="size-4" />
            </IconButton>
            <Button
              type="button"
              size="compact"
              variant="secondary"
              disabled={exportPending}
              onClick={onExportCatalog}
            >
              <Download className="size-4" aria-hidden="true" />
              Экспорт
            </Button>
            <Button
              type="button"
              size="compact"
              variant="secondary"
              onClick={() => setImportOpen(true)}
            >
              <Upload className="size-4" aria-hidden="true" />
              Импорт
            </Button>
            <IconButton
              type="button"
              label="Создать операцию"
              onClick={() => {
                setCreateFolderId(null);
                setCreateOpen(true);
              }}
            >
              <Plus className="size-4" />
            </IconButton>
          </div>
        }
      />

      {rowError || exportError ? (
        <div className="border-b border-portal-line px-portal-4 py-2 text-portal-caption text-red-700">
          {rowError ?? exportError}
        </div>
      ) : null}

      <CatalogTreeDndProvider enabled={dndEnabled} onDrop={onCatalogDrop}>
        {dndEnabled ? <CatalogTreeRootDropZone /> : null}
        <DataTableFrame className="min-h-0 flex-1">
          <DataTable>
            <DataTableHead>
              <DataTableRow>
                {moveSelectMode ? (
                  <DataTableHeaderCell className="w-[2.5rem]">
                    <Checkbox
                      checked={allVisibleSelected}
                      onChange={toggleSelectAllVisible}
                      aria-label="Выбрать все видимые операции"
                    />
                  </DataTableHeaderCell>
                ) : null}
                <DataTableHeaderCell>Наименование</DataTableHeaderCell>
                <DataTableHeaderCell className="w-[7rem]">
                  Стоимость
                </DataTableHeaderCell>
                <DataTableHeaderCell className="w-[5rem]">
                  Кол-во
                </DataTableHeaderCell>
                <DataTableHeaderCell className="w-[7rem]">Сумма</DataTableHeaderCell>
                <DataTableHeaderCell className="w-[6rem]">Время</DataTableHeaderCell>
                <DataTableHeaderCell>Оборудование</DataTableHeaderCell>
                <DataTableHeaderCell className="w-[12rem]" />
              </DataTableRow>
            </DataTableHead>
            <DataTableBody>
              {visibleRows.length === 0 ? (
                <DataTableRow>
                  <DataTableCell colSpan={moveSelectMode ? 8 : 7}>
                    <EmptyState
                      title="Нет строк"
                      description={
                        rows.length === 0
                          ? "Создайте папку или операцию."
                          : "Измените поиск или сбросьте фильтр."
                      }
                    />
                  </DataTableCell>
                </DataTableRow>
              ) : (
                visibleRows.map((row) => {
                  if (row.kind === "folder") {
                    const expanded =
                      expandedIds.has(row.id) || Boolean(query.trim());
                    return (
                      <CatalogTreeDraggableFolder
                        key={`folder-${row.id}`}
                        folderId={row.id}
                        label={row.name}
                        disabled={!dndEnabled}
                        className={catalogFolderRowSurfaceClass()}
                      >
                        {({ handle }) => (
                          <>
                            {moveSelectMode ? <DataTableCell /> : null}
                            <DataTableCell colSpan={6}>
                              <CatalogTreeDepthCell depth={row.depth}>
                                {handle}
                                <IconButton
                                  type="button"
                                  label={expanded ? "Свернуть" : "Развернуть"}
                                  onClick={() => toggleFolder(row.id)}
                                >
                                  {expanded ? (
                                    <ChevronDown className="size-4" />
                                  ) : (
                                    <ChevronRight className="size-4" />
                                  )}
                                </IconButton>
                                {expanded ? (
                                  <FolderOpen className="size-4 shrink-0 text-portal-muted" />
                                ) : (
                                  <Folder className="size-4 shrink-0 text-portal-muted" />
                                )}
                                <span className="font-medium">{row.name}</span>
                              </CatalogTreeDepthCell>
                            </DataTableCell>
                            <DataTableCell>
                              <div className="flex items-center justify-end gap-0.5">
                                <IconButton
                                  type="button"
                                  label="Создать вложенную папку"
                                  disabled={saving}
                                  onClick={() => void onCreateFolder(row.id)}
                                >
                                  <FolderPlus className="size-3.5" />
                                </IconButton>
                                <IconButton
                                  type="button"
                                  label="Создать операцию в папке"
                                  onClick={() => {
                                    setCreateFolderId(row.id);
                                    setCreateOpen(true);
                                    setExpandedIds((prev) =>
                                      new Set(prev).add(row.id),
                                    );
                                  }}
                                >
                                  <Plus className="size-3.5" />
                                </IconButton>
                                <IconButton
                                  type="button"
                                  label="Переименовать папку"
                                  disabled={saving}
                                  onClick={() => void onRenameFolder(row.folder)}
                                >
                                  <Pencil className="size-3.5" />
                                </IconButton>
                                <IconButton
                                  type="button"
                                  label="Папка выше"
                                  disabled={saving}
                                  onClick={() => void onMoveFolder(row.id, "up")}
                                >
                                  <ArrowUp className="size-3.5" />
                                </IconButton>
                                <IconButton
                                  type="button"
                                  label="Папка ниже"
                                  disabled={saving}
                                  onClick={() =>
                                    void onMoveFolder(row.id, "down")
                                  }
                                >
                                  <ArrowDown className="size-3.5" />
                                </IconButton>
                                <IconButton
                                  type="button"
                                  label="Удалить папку"
                                  disabled={saving}
                                  onClick={() => void onDeleteFolder(row.folder)}
                                >
                                  <Trash2 className="size-3.5" />
                                </IconButton>
                              </div>
                            </DataTableCell>
                          </>
                        )}
                      </CatalogTreeDraggableFolder>
                    );
                  }

                  const op = row.operation;
                  const editing = editingId === op.id && draft != null;
                  return (
                    <CatalogTreeDraggableItem
                      key={`op-${op.id}`}
                      itemId={op.id}
                      label={op.name}
                      disabled={!dndEnabled || editing}
                    >
                      {({ handle }) => (
                        <>
                          {moveSelectMode ? (
                            <DataTableCell>
                              <Checkbox
                                checked={selectedIds.has(op.id)}
                                onChange={() => toggleSelected(op.id)}
                                aria-label={`Выбрать ${op.name}`}
                              />
                            </DataTableCell>
                          ) : null}
                          <DataTableCell>
                            <CatalogTreeDepthCell depth={row.depth}>
                              {handle}
                              <div className="min-w-0 flex-1 space-y-1">
                                {editing ? (
                                  <Input
                                    value={draft.name}
                                    onChange={(event) =>
                                      setDraft({
                                        ...draft,
                                        name: event.target.value,
                                      })
                                    }
                                    aria-label="Наименование"
                                  />
                                ) : (
                                  <span className="text-portal-text">
                                    {op.name}
                                  </span>
                                )}
                              </div>
                            </CatalogTreeDepthCell>
                          </DataTableCell>
                          <DataTableCell>
                            {editing ? (
                              <Input
                                value={draft.cost}
                                onChange={(event) =>
                                  setDraft({
                                    ...draft,
                                    cost: event.target.value,
                                  })
                                }
                                aria-label="Стоимость"
                              />
                            ) : (
                              formatSewingCost(op.cost)
                            )}
                          </DataTableCell>
                          <DataTableCell>
                            {editing ? (
                              <Input
                                value={draft.quantity_per_item}
                                onChange={(event) =>
                                  setDraft({
                                    ...draft,
                                    quantity_per_item: event.target.value,
                                  })
                                }
                                aria-label="Количество"
                              />
                            ) : (
                              op.quantity_per_item
                            )}
                          </DataTableCell>
                          <DataTableCell>
                            {formatSewingCost(
                              sewingOperationLineTotal(
                                op.cost,
                                op.quantity_per_item,
                              ),
                            )}
                          </DataTableCell>
                          <DataTableCell>
                            {editing ? (
                              <Input
                                value={draft.duration_seconds}
                                onChange={(event) =>
                                  setDraft({
                                    ...draft,
                                    duration_seconds: event.target.value,
                                  })
                                }
                                aria-label="Время, с"
                              />
                            ) : (
                              formatDurationSecondsLabel(op.duration_seconds)
                            )}
                          </DataTableCell>
                          <DataTableCell>
                            {editing ? (
                              <SewingOperationEquipmentPicker
                                idPrefix={`edit-sewing-wc-${op.id}`}
                                workCenters={sewingWorkCenters}
                                selectedIds={draft.work_center_ids}
                                disabled={saving}
                                onChange={(work_center_ids) =>
                                  setDraft({ ...draft, work_center_ids })
                                }
                                compact
                              />
                            ) : (
                              formatSewingEquipmentLabels(
                                op.work_center_ids,
                                sewingWorkCenters,
                              )
                            )}
                          </DataTableCell>
                          <DataTableCell>
                            <div className="flex items-center justify-end gap-0.5">
                              {editing ? (
                                <>
                                  <IconButton
                                    type="button"
                                    label="Сохранить"
                                    disabled={saving}
                                    onClick={() => void saveEdit()}
                                  >
                                    <Check className="size-3.5" />
                                  </IconButton>
                                  <IconButton
                                    type="button"
                                    label="Отмена"
                                    disabled={saving}
                                    onClick={cancelEdit}
                                  >
                                    <X className="size-3.5" />
                                  </IconButton>
                                </>
                              ) : (
                                <>
                                  <IconButton
                                    type="button"
                                    label={`Переместить ${op.name}`}
                                    disabled={saving}
                                    onClick={() => openMoveModal([op.id])}
                                  >
                                    <FolderInput className="size-3.5" />
                                  </IconButton>
                                  <IconButton
                                    type="button"
                                    label={`Копировать ${op.name}`}
                                    disabled={saving}
                                    onClick={() => void onCopyOp(op)}
                                  >
                                    <Copy className="size-3.5" />
                                  </IconButton>
                                  <IconButton
                                    type="button"
                                    label="Выше"
                                    disabled={saving}
                                    onClick={() => void onMoveOp(op.id, "up")}
                                  >
                                    <ArrowUp className="size-3.5" />
                                  </IconButton>
                                  <IconButton
                                    type="button"
                                    label="Ниже"
                                    disabled={saving}
                                    onClick={() => void onMoveOp(op.id, "down")}
                                  >
                                    <ArrowDown className="size-3.5" />
                                  </IconButton>
                                  <IconButton
                                    type="button"
                                    label="Изменить"
                                    disabled={saving}
                                    onClick={() => startEdit(op)}
                                  >
                                    <Pencil className="size-3.5" />
                                  </IconButton>
                                  <IconButton
                                    type="button"
                                    label="Удалить"
                                    disabled={saving}
                                    onClick={() => void onDeleteOp(op)}
                                  >
                                    <Trash2 className="size-3.5" />
                                  </IconButton>
                                </>
                              )}
                            </div>
                          </DataTableCell>
                        </>
                      )}
                    </CatalogTreeDraggableItem>
                  );
                })
              )}
            </DataTableBody>
          </DataTable>
        </DataTableFrame>
      </CatalogTreeDndProvider>

      <ListTotals primary={`Операций: ${filteredOps.length} / ${rows.length}`} />
    </div>
  );
}
