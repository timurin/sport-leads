"use client";

import {
  ArrowDown,
  ArrowDownUp,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  Filter,
  FilterX,
  Folder,
  FolderInput,
  FolderOpen,
  FolderPlus,
  Layers,
  Pencil,
  Plus,
  Printer,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import {
  copyProductModel,
  createProductModelFolder,
  deleteProductModelFolder,
  downloadProductModelExport,
  moveProductModelFolderSibling,
  moveProductModelsToFolder,
  updateProductModelFolder,
} from "@/app/(workspace)/settings/catalogs/product-models/product-model-actions";
import { CatalogFolderMoveModal } from "@/components/settings/catalog-folder-move-modal";
import {
  CatalogTreeDepthCell,
  CatalogTreeDndProvider,
  CatalogTreeDraggableFolder,
  CatalogTreeDraggableItem,
  CatalogTreeRootDropZone,
} from "@/components/settings/catalog-folder-tree-dnd";
import { CatalogFolderTemplateModal } from "@/components/settings/catalog-folder-template-modal";
import { ProductModelCardModal } from "@/components/settings/product-model-card-modal";
import {
  canNestCatalogFolder,
  catalogFolderRowSurfaceClass,
  catalogFolderWouldChangeParent,
  isCatalogFolderDescendant,
} from "@/lib/catalog-folder-dnd";
import { ProductModelCreateDrawer } from "@/components/settings/product-model-create-drawer";
import { ProductModelImportDrawer } from "@/components/settings/product-model-import-drawer";
import { Button, IconButton } from "@/components/ui/button";
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
import { triggerBrowserDownload } from "@/lib/file-download";
import {
  PRODUCT_MODEL_SIZE_TYPE_LABELS,
  PRODUCT_MODEL_STATUS_FILTER_ITEMS,
  PRODUCT_MODEL_STATUS_LABELS,
  buildProductModelCatalogTreeRows,
  compareProductModelsByListSort,
  filterProductModels,
  productModelCoverUrl,
  productModelStatusTone,
  visibleProductModelCatalogTreeRows,
  type ProductModel,
  type ProductModelFolder,
  type ProductModelListSortDirection,
  type ProductModelListSortField,
  type ProductModelStatus,
} from "@/lib/product-models";
import type { ProductType } from "@/lib/product-types";
import type { SewingOperationTemplate } from "@/lib/sewing-operation-templates";
import type { SizeGridListItem } from "@/lib/size-grids";

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

/** PT-02 product-model catalog list with folder tree (`DS-PT-02`, `6.1.18`). */
export function ProductModelsWorkspace({
  models,
  folders = [],
  sizeGrids,
  productTypes = [],
  sewingTemplates = [],
  costByModelId = {},
}: {
  models: ProductModel[];
  folders?: ProductModelFolder[];
  sizeGrids: SizeGridListItem[];
  productTypes?: ProductType[];
  sewingTemplates?: SewingOperationTemplate[];
  /** Precomputed «от–до» labels from assembly variant totals. */
  costByModelId?: Record<number, string>;
}) {
  const router = useRouter();
  const [created, setCreated] = useState<ProductModel[]>([]);
  const [patched, setPatched] = useState<Record<number, ProductModel>>({});
  const [localFolders, setLocalFolders] = useState<ProductModelFolder[]>(folders);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | ProductModelStatus>("");
  const [productTypeFilter, setProductTypeFilter] = useState<number | null>(
    null,
  );
  const [filterOpen, setFilterOpen] = useState(false);
  const [printSelectMode, setPrintSelectMode] = useState(false);
  const [moveSelectMode, setMoveSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set());
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(
    null,
  );
  const [busyId, setBusyId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createFolderId, setCreateFolderId] = useState<number | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(() => new Set());
  const [moveModalIds, setMoveModalIds] = useState<number[] | null>(null);
  const [templateFolder, setTemplateFolder] = useState<ProductModelFolder | null>(
    null,
  );
  const [cardModalModelId, setCardModalModelId] = useState<number | null>(null);
  const [exportPending, startExportTransition] = useTransition();
  const [exportError, setExportError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<ProductModelListSortField | null>(
    null,
  );
  const [sortDirection, setSortDirection] =
    useState<ProductModelListSortDirection>("asc");
  const filterRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setLocalFolders(folders);
  }, [folders]);

  const rows = useMemo(() => {
    const byId = new Map<number, ProductModel>();
    for (const model of models) byId.set(model.id, model);
    for (const model of created) byId.set(model.id, model);
    for (const model of Object.values(patched)) byId.set(model.id, model);
    return Array.from(byId.values());
  }, [created, models, patched]);

  const filtered = useMemo(
    () =>
      filterProductModels(rows, {
        search: query,
        status: statusFilter,
        productTypeId: productTypeFilter,
      }),
    [rows, query, statusFilter, productTypeFilter],
  );

  const sortLabels = useMemo(
    () => ({
      productType: (model: ProductModel) =>
        model.product_type_name?.trim() ||
        productTypes.find((row) => row.id === model.product_type_id)?.name ||
        "",
      sizeGrid: (model: ProductModel) => {
        const grid = sizeGrids.find((row) => row.id === model.size_grid_id);
        return grid
          ? `${grid.name} · ${PRODUCT_MODEL_SIZE_TYPE_LABELS[grid.size_type]}`
          : PRODUCT_MODEL_SIZE_TYPE_LABELS[model.size_type];
      },
      cost: (model: ProductModel): number | null => {
        if (model.assembly_cost_min == null) return null;
        const amount = Number(
          String(model.assembly_cost_min).replace(",", "."),
        );
        return Number.isFinite(amount) ? amount : null;
      },
    }),
    [productTypes, sizeGrids],
  );

  const changeSort = (field: ProductModelListSortField) => {
    if (sortField === field) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortField(field);
    setSortDirection("asc");
  };

  const treeRows = useMemo(
    () =>
      buildProductModelCatalogTreeRows(localFolders, filtered, {
        compareModels:
          sortField == null
            ? undefined
            : (a, b) =>
                compareProductModelsByListSort(
                  a,
                  b,
                  sortField,
                  sortDirection,
                  sortLabels,
                ),
      }),
    [filtered, localFolders, sortDirection, sortField, sortLabels],
  );

  const searchActive = Boolean(query.trim()) || Boolean(statusFilter) || productTypeFilter != null;

  const visibleRows = useMemo(() => {
    if (searchActive) {
      return treeRows.filter((row) => {
        if (row.kind === "model") return true;
        return filtered.some(
          (model) =>
            model.folder_id != null &&
            (model.folder_id === row.id ||
              isCatalogFolderDescendant(localFolders, model.folder_id, row.id)),
        );
      });
    }
    return visibleProductModelCatalogTreeRows(treeRows, expandedIds);
  }, [expandedIds, filtered, localFolders, searchActive, treeRows]);

  const dndEnabled =
    !searchActive && !saving && !moveSelectMode && !printSelectMode;

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
      if (!catalogFolderWouldChangeParent(folderNodes, active.id, targetParentId)) {
        return;
      }
      setSaving(true);
      try {
        const result = await updateProductModelFolder(active.id, {
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
        const result = await moveProductModelsToFolder([active.id], folderId);
        if (!result.ok) {
          setRowError(result.message);
          return;
        }
        setPatched((prev) => {
          const next = { ...prev };
          for (const model of result.models) next[model.id] = model;
          return next;
        });
        if (folderId != null) {
          setExpandedIds((prev) => new Set(prev).add(folderId));
        }
        router.refresh();
      } catch {
        setRowError("Не удалось переместить модель.");
      } finally {
        setSaving(false);
      }
    }
  };


  const filtersActive = Boolean(statusFilter) || productTypeFilter != null;

  useEffect(() => {
    if (!filterOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!filterRef.current?.contains(event.target as Node)) {
        setFilterOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFilterOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [filterOpen]);

  const emptyDescription =
    models.length === 0 && localFolders.length === 0
      ? "Каталог пуст. Создайте папку или первую модель."
      : "Измените поиск, фильтр или сбросьте их.";

  const openLightbox = (src: string, alt: string) => setLightbox({ src, alt });

  const toggleFolder = (folderId: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  };

  const handleCreated = (model: ProductModel) => {
    setCreated((prev) => [model, ...prev.filter((row) => row.id !== model.id)]);
    if (model.folder_id != null) {
      setExpandedIds((prev) => new Set(prev).add(model.folder_id!));
    }
    router.refresh();
  };

  const onCopy = async (model: ProductModel) => {
    setBusyId(model.id);
    setRowError(null);
    try {
      const createdModel = await copyProductModel(model.id);
      setCreated((prev) => [
        createdModel,
        ...prev.filter((row) => row.id !== createdModel.id),
      ]);
      router.push(`/settings/catalogs/product-models/${createdModel.id}`);
      router.refresh();
    } catch (caught) {
      setRowError(
        caught instanceof Error ? caught.message : "Не удалось скопировать",
      );
      setBusyId(null);
    }
  };

  const onCreateFolder = async (parentId: number | null) => {
    const name = window.prompt(
      parentId == null ? "Название папки (корень)" : "Название вложенной папки",
    );
    if (name == null) return;
    setSaving(true);
    setRowError(null);
    try {
      const result = await createProductModelFolder({
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

  const onRenameFolder = async (folder: ProductModelFolder) => {
    const name = window.prompt("Переименовать папку", folder.name);
    if (name == null || name.trim() === folder.name) return;
    setSaving(true);
    setRowError(null);
    try {
      const result = await updateProductModelFolder(folder.id, { name });
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

  const onSaveFolderTemplate = async (templateId: number | null) => {
    if (templateFolder == null) return;
    setSaving(true);
    setRowError(null);
    try {
      const result = await updateProductModelFolder(templateFolder.id, {
        default_sewing_operation_template_id: templateId,
      });
      if (!result.ok) {
        setRowError(result.message);
        setSaving(false);
        return;
      }
      setLocalFolders((prev) =>
        prev.map((item) =>
          item.id === templateFolder.id ? result.folder : item,
        ),
      );
      setTemplateFolder(null);
      router.refresh();
    } catch {
      setRowError("Не удалось сохранить шаблон папки.");
    }
    setSaving(false);
  };

  const onDeleteFolder = async (folder: ProductModelFolder) => {
    if (!window.confirm(`Удалить папку «${folder.name}»? Она должна быть пустой.`)) {
      return;
    }
    setSaving(true);
    setRowError(null);
    try {
      const result = await deleteProductModelFolder(folder.id);
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

  const onMoveFolder = async (folderId: number, direction: "up" | "down") => {
    setSaving(true);
    setRowError(null);
    try {
      const result = await moveProductModelFolderSibling(folderId, direction);
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

  const onMoveModels = async (folderId: number | null) => {
    if (moveModalIds == null || moveModalIds.length === 0) return;
    setSaving(true);
    setRowError(null);
    try {
      const result = await moveProductModelsToFolder(moveModalIds, folderId);
      if (!result.ok) {
        setRowError(result.message);
        setSaving(false);
        return;
      }
      setPatched((prev) => {
        const next = { ...prev };
        for (const model of result.models) next[model.id] = model;
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
      setRowError("Не удалось переместить модели.");
    }
    setSaving(false);
  };

  const openMoveModal = (ids: number[]) => {
    if (ids.length === 0) return;
    setMoveModalIds(ids);
    setRowError(null);
  };

  const onMoveToolbar = () => {
    if (!moveSelectMode) {
      setMoveSelectMode(true);
      setPrintSelectMode(false);
      setSelectedIds(new Set());
      return;
    }
    if (selectedIds.size === 0) {
      setMoveSelectMode(false);
      return;
    }
    openMoveModal([...selectedIds]);
  };

  const selectMode = printSelectMode || moveSelectMode;

  const clearFilters = () => {
    setStatusFilter("");
    setProductTypeFilter(null);
    setFilterOpen(false);
  };

  const toggleSelected = (modelId: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(modelId)) next.delete(modelId);
      else next.add(modelId);
      return next;
    });
  };

  const filteredModels = useMemo(
    () => visibleRows.filter((row) => row.kind === "model").map((row) => row.model),
    [visibleRows],
  );

  const allFilteredSelected =
    filteredModels.length > 0 &&
    filteredModels.every((model) => selectedIds.has(model.id));

  const toggleSelectAllFiltered = () => {
    setSelectedIds((prev) => {
      if (filteredModels.length === 0) return prev;
      if (filteredModels.every((model) => prev.has(model.id))) {
        const next = new Set(prev);
        for (const model of filteredModels) next.delete(model.id);
        return next;
      }
      const next = new Set(prev);
      for (const model of filteredModels) next.add(model.id);
      return next;
    });
  };

  const onPrint = () => {
    if (!printSelectMode) {
      setPrintSelectMode(true);
      setMoveSelectMode(false);
      setSelectedIds(new Set());
      return;
    }
    if (selectedIds.size === 0) {
      setPrintSelectMode(false);
      return;
    }
    window.alert(
      "Печать будет доступна после настройки шаблона в Администрирование → Печатные формы.",
    );
  };

  const onExportCatalog = () => {
    setExportError(null);
    startExportTransition(async () => {
      try {
        const payload = await downloadProductModelExport({
          format: "csv",
          search: query || undefined,
          status: statusFilter || undefined,
          productTypeId: productTypeFilter,
        });
        triggerBrowserDownload(payload);
      } catch (caught) {
        setExportError(
          caught instanceof Error
            ? caught.message
            : "Не удалось экспортировать модели",
        );
      }
    });
  };

  const costLabel = (modelId: number) => costByModelId[modelId] ?? "—";

  const folderMoveOptions = buildProductModelCatalogTreeRows(
    localFolders,
    [],
  )
    .filter((row) => row.kind === "folder")
    .map((row) =>
      row.kind === "folder"
        ? { id: row.id, name: row.name, depth: row.depth }
        : null,
    )
    .filter((row): row is { id: number; name: string; depth: number } => row != null);

  const modelCountLabel = (count: number) => {
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod10 === 1 && mod100 !== 11) return `${count} модель`;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
      return `${count} модели`;
    }
    return `${count} моделей`;
  };

  const modelMeta = (model: ProductModel) => {
    const grid = sizeGrids.find((row) => row.id === model.size_grid_id);
    const gridLabel = grid
      ? `${grid.name} · ${PRODUCT_MODEL_SIZE_TYPE_LABELS[grid.size_type]}`
      : PRODUCT_MODEL_SIZE_TYPE_LABELS[model.size_type];
    const productTypeLabel =
      model.product_type_name?.trim() ||
      productTypes.find((row) => row.id === model.product_type_id)?.name ||
      "—";
    return { gridLabel, productTypeLabel };
  };

  const rowActions = (model: ProductModel) => {
    const busy = busyId === model.id || saving;
    return (
      <div className="flex flex-wrap items-center justify-end gap-1" role="group" aria-label="Действия">
        <IconButton
          label={`Переместить ${model.name}`}
          variant="secondary"
          disabled={busy}
          onClick={() => openMoveModal([model.id])}
        >
          <FolderInput className="size-4" aria-hidden="true" />
        </IconButton>
        <IconButton
          label={`Копировать ${model.name}`}
          variant="secondary"
          disabled={busy}
          onClick={() => void onCopy(model)}
        >
          <Copy className="size-4" aria-hidden="true" />
        </IconButton>
        <IconButton
          label={`Открыть карточку ${model.name}`}
          variant="secondary"
          disabled={busy}
          onClick={() => setCardModalModelId(model.id)}
        >
          <ExternalLink className="size-4" aria-hidden="true" />
        </IconButton>
      </div>
    );
  };

  const folderActions = (folder: ProductModelFolder) => (
    <div className="flex items-center justify-end gap-0.5">
      <IconButton
        type="button"
        label="Шаблон операций папки"
        disabled={saving}
        onClick={() => setTemplateFolder(folder)}
      >
        <Layers className="size-3.5" />
      </IconButton>
      <IconButton
        type="button"
        label="Создать вложенную папку"
        disabled={saving}
        onClick={() => void onCreateFolder(folder.id)}
      >
        <FolderPlus className="size-3.5" />
      </IconButton>
      <IconButton
        type="button"
        label="Создать модель в папке"
        onClick={() => {
          setCreateFolderId(folder.id);
          setCreateOpen(true);
          setExpandedIds((prev) => new Set(prev).add(folder.id));
        }}
      >
        <Plus className="size-3.5" />
      </IconButton>
      <IconButton
        type="button"
        label="Переименовать папку"
        disabled={saving}
        onClick={() => void onRenameFolder(folder)}
      >
        <Pencil className="size-3.5" />
      </IconButton>
      <IconButton
        type="button"
        label="Папка выше"
        disabled={saving}
        onClick={() => void onMoveFolder(folder.id, "up")}
      >
        <ArrowUp className="size-3.5" />
      </IconButton>
      <IconButton
        type="button"
        label="Папка ниже"
        disabled={saving}
        onClick={() => void onMoveFolder(folder.id, "down")}
      >
        <ArrowDown className="size-3.5" />
      </IconButton>
      <IconButton
        type="button"
        label="Удалить папку"
        disabled={saving}
        onClick={() => void onDeleteFolder(folder)}
      >
        <Trash2 className="size-3.5" />
      </IconButton>
    </div>
  );

  const dataColSpan = selectMode ? 7 : 7;

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
        onClose={() => {
          setCreateOpen(false);
          setCreateFolderId(null);
        }}
        onCreated={handleCreated}
        sizeGrids={sizeGrids}
        folders={localFolders}
        defaultFolderId={createFolderId}
      />

      <ProductModelImportDrawer
        open={importOpen}
        onClose={() => setImportOpen(false)}
      />

      <ProductModelCardModal
        modelId={cardModalModelId}
        open={cardModalModelId != null}
        onClose={() => setCardModalModelId(null)}
        onSaved={(model) => {
          setPatched((current) => ({ ...current, [model.id]: model }));
        }}
      />

      <CatalogFolderTemplateModal
        open={templateFolder != null}
        folder={templateFolder}
        templates={sewingTemplates}
        busy={saving}
        onClose={() => {
          if (saving) return;
          setTemplateFolder(null);
        }}
        onSave={onSaveFolderTemplate}
      />

      <CatalogFolderMoveModal
        open={moveModalIds != null}
        onClose={() => {
          if (saving) return;
          setMoveModalIds(null);
        }}
        onConfirm={onMoveModels}
        folders={folderMoveOptions}
        itemCount={moveModalIds?.length ?? 0}
        itemLabel={modelCountLabel}
        busy={saving}
        initialFolderId={
          moveModalIds?.length === 1
            ? (rows.find((model) => model.id === moveModalIds[0])?.folder_id ??
              null)
            : null
        }
      />

      <PageToolbar
        start={
          <div className="flex min-w-0 w-full flex-1 items-center gap-1">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Поиск по артикулу или названию"
              size="compact"
              className="min-w-0 flex-1 basis-0"
              aria-label="Поиск моделей изделий"
            />
            <div
              className="flex shrink-0 items-center gap-1"
              role="group"
              aria-label="Действия списка"
            >
              <IconButton
                label="Сбросить поиск"
                variant="secondary"
                disabled={!query}
                onClick={() => setQuery("")}
              >
                <X className="size-4" aria-hidden="true" />
              </IconButton>
              <div className="relative" ref={filterRef}>
                <IconButton
                  label="Фильтр"
                  variant={filtersActive ? "primary" : "secondary"}
                  aria-expanded={filterOpen}
                  aria-haspopup="dialog"
                  onClick={() => setFilterOpen((open) => !open)}
                >
                  <Filter className="size-4" aria-hidden="true" />
                </IconButton>
                {filterOpen ? (
                  <div
                    role="dialog"
                    aria-label="Фильтр моделей"
                    className="absolute right-0 z-20 mt-1 w-[min(100vw-2rem,16rem)] space-y-portal-3 rounded-portal-md border border-portal-border bg-portal-surface p-portal-3 shadow-portal-card"
                  >
                    <Select
                      value={statusFilter}
                      size="compact"
                      aria-label="Фильтр по состоянию"
                      onChange={(event) =>
                        setStatusFilter(
                          event.target.value as "" | ProductModelStatus,
                        )
                      }
                    >
                      <option value="">Все состояния</option>
                      {PRODUCT_MODEL_STATUS_FILTER_ITEMS.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.label}
                        </option>
                      ))}
                    </Select>
                    {productTypes.length > 0 ? (
                      <Select
                        value={
                          productTypeFilter == null
                            ? ""
                            : String(productTypeFilter)
                        }
                        size="compact"
                        aria-label="Фильтр по виду изделия"
                        onChange={(event) => {
                          const raw = event.target.value;
                          setProductTypeFilter(raw ? Number(raw) : null);
                        }}
                      >
                        <option value="">Все виды</option>
                        {productTypes.map((row) => (
                          <option key={row.id} value={row.id}>
                            {row.name}
                          </option>
                        ))}
                      </Select>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <IconButton
                label="Сбросить фильтр"
                variant="secondary"
                disabled={!filtersActive}
                onClick={clearFilters}
              >
                <FilterX className="size-4" aria-hidden="true" />
              </IconButton>
              <IconButton
                label={
                  printSelectMode
                    ? selectedIds.size > 0
                      ? `Печать (${selectedIds.size})`
                      : "Выйти из режима печати"
                    : "Печать"
                }
                variant={printSelectMode ? "primary" : "secondary"}
                aria-pressed={printSelectMode}
                onClick={onPrint}
              >
                <Printer className="size-4" aria-hidden="true" />
              </IconButton>
              <IconButton
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
                <FolderInput className="size-4" aria-hidden="true" />
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
            </div>
          </div>
        }
        end={
          <div className="flex !w-auto shrink-0 items-center gap-1">
            <IconButton
              label="Создать папку"
              variant="secondary"
              disabled={saving}
              onClick={() => void onCreateFolder(null)}
            >
              <FolderPlus className="size-4" aria-hidden="true" />
            </IconButton>
            <IconButton
              label="Создать модель"
              variant="primary"
              onClick={() => {
                setCreateFolderId(null);
                setCreateOpen(true);
              }}
            >
              <Plus className="size-4" aria-hidden="true" />
            </IconButton>
          </div>
        }
      />

      <section className="min-h-0 min-w-0 flex-1 overflow-auto bg-portal-surface">
        {exportError ? (
          <p
            className="border-b border-portal-danger/30 bg-portal-danger-soft px-portal-4 py-portal-2 text-portal-caption text-portal-danger"
            role="alert"
          >
            {exportError}
          </p>
        ) : null}
        {rowError ? (
          <p
            className="border-b border-portal-danger/30 bg-portal-danger-soft px-portal-4 py-portal-2 text-portal-caption text-portal-danger"
            role="alert"
          >
            {rowError}
          </p>
        ) : null}

        <div className="hidden min-w-0 md:block">
          <CatalogTreeDndProvider enabled={dndEnabled} onDrop={onCatalogDrop}>
            {dndEnabled ? <CatalogTreeRootDropZone /> : null}
          <DataTableFrame className="rounded-none border-x-0 border-b-0 shadow-none">
            <DataTable minWidthClassName="min-w-[860px]">
              <DataTableHead>
                <tr>
                  {selectMode ? (
                    <DataTableHeaderCell className="w-10">
                      <Checkbox
                        checked={allFilteredSelected}
                        aria-label="Выбрать все модели"
                        onChange={toggleSelectAllFiltered}
                      />
                    </DataTableHeaderCell>
                  ) : null}
                  <DataTableHeaderCell>Фото</DataTableHeaderCell>
                  <SortableHeading
                    label="Артикул"
                    active={sortField === "article"}
                    direction={sortDirection}
                    onClick={() => changeSort("article")}
                  />
                  <SortableHeading
                    label="Название"
                    active={sortField === "name"}
                    direction={sortDirection}
                    onClick={() => changeSort("name")}
                  />
                  <SortableHeading
                    label="Вид изделия"
                    active={sortField === "product_type"}
                    direction={sortDirection}
                    onClick={() => changeSort("product_type")}
                  />
                  <SortableHeading
                    label="Размерная сетка"
                    active={sortField === "size_grid"}
                    direction={sortDirection}
                    onClick={() => changeSort("size_grid")}
                  />
                  <SortableHeading
                    label="Статус"
                    active={sortField === "status"}
                    direction={sortDirection}
                    onClick={() => changeSort("status")}
                  />
                  <SortableHeading
                    label="Стоимость от–до"
                    active={sortField === "cost"}
                    direction={sortDirection}
                    onClick={() => changeSort("cost")}
                  />
                  <DataTableHeaderCell>Действие</DataTableHeaderCell>
                </tr>
              </DataTableHead>
              <DataTableBody>
                {visibleRows.length === 0 ? (
                  <DataTableRow>
                    <DataTableCell colSpan={selectMode ? 9 : 8}>
                      <EmptyState
                        title={
                          models.length === 0 && localFolders.length === 0
                            ? "Моделей изделий пока нет"
                            : "Модели не найдены"
                        }
                        description={emptyDescription}
                        size="compact"
                      />
                    </DataTableCell>
                  </DataTableRow>
                ) : (
                  visibleRows.map((row) => {
                    if (row.kind === "folder") {
                      const expanded =
                        expandedIds.has(row.id) || searchActive;
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
                          {selectMode ? <DataTableCell /> : null}
                          <DataTableCell colSpan={dataColSpan}>
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
                              <div className="min-w-0">
                                <span className="font-medium">{row.name}</span>
                                {row.folder.default_sewing_operation_template_name ? (
                                  <p className="truncate text-portal-caption text-portal-muted">
                                    Шаблон: {row.folder.default_sewing_operation_template_name}
                                  </p>
                                ) : null}
                              </div>
                            </CatalogTreeDepthCell>
                          </DataTableCell>
                          <DataTableCell>
                            {folderActions(row.folder)}
                          </DataTableCell>
                            </>
                          )}
                        </CatalogTreeDraggableFolder>
                      );
                    }

                    const model = row.model;
                    const { gridLabel, productTypeLabel } = modelMeta(model);
                    const checked = selectedIds.has(model.id);

                    return (
                      <CatalogTreeDraggableItem
                        key={`model-${model.id}`}
                        itemId={model.id}
                        label={model.name}
                        disabled={!dndEnabled}
                      >
                        {({ handle }) => (
                          <>
                        {selectMode ? (
                          <DataTableCell>
                            <Checkbox
                              checked={checked}
                              aria-label={`Выбрать ${model.name}`}
                              onChange={() => toggleSelected(model.id)}
                            />
                          </DataTableCell>
                        ) : null}
                        <DataTableCell>
                          <CatalogTreeDepthCell depth={row.depth}>
                            {handle}
                            <CoverThumb model={model} onOpen={openLightbox} />
                          </CatalogTreeDepthCell>
                        </DataTableCell>
                        <DataTableCell className="font-medium">
                          <button
                            type="button"
                            className="portal-focus-ring font-mono text-portal-text hover:text-portal-primary hover:underline"
                            onClick={() => setCardModalModelId(model.id)}
                          >
                            {model.article}
                          </button>
                        </DataTableCell>
                        <DataTableCell>
                          <button
                            type="button"
                            className="portal-focus-ring font-medium text-portal-text hover:text-portal-primary hover:underline"
                            onClick={() => setCardModalModelId(model.id)}
                          >
                            {model.name}
                          </button>
                        </DataTableCell>
                        <DataTableCell>{productTypeLabel}</DataTableCell>
                        <DataTableCell>{gridLabel}</DataTableCell>
                        <DataTableCell>
                          <StatusBadge
                            size="compact"
                            tone={productModelStatusTone(model.status)}
                          >
                            {PRODUCT_MODEL_STATUS_LABELS[model.status]}
                          </StatusBadge>
                        </DataTableCell>
                        <DataTableCell>{costLabel(model.id)}</DataTableCell>
                        <DataTableCell>{rowActions(model)}</DataTableCell>
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
        </div>

        {mounted ? (
          <div className="min-w-0 space-y-portal-3 border-b border-portal-border bg-portal-surface-secondary p-portal-3 md:hidden">
            {visibleRows.length === 0 ? (
              <EmptyState
                title={
                  models.length === 0 && localFolders.length === 0
                    ? "Моделей изделий пока нет"
                    : "Модели не найдены"
                }
                description={emptyDescription}
                size="compact"
              />
            ) : (
              visibleRows.map((row) => {
                if (row.kind === "folder") {
                  const expanded = expandedIds.has(row.id) || searchActive;
                  return (
                    <article
                      key={`folder-m-${row.id}`}
                      className="min-w-0 rounded-portal-lg border border-portal-border bg-portal-surface-2/40 p-portal-3"
                      style={{ marginLeft: `${row.depth * 0.75}rem` }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          className="flex min-w-0 flex-1 items-center gap-1 text-left"
                          onClick={() => toggleFolder(row.id)}
                        >
                          {expanded ? (
                            <ChevronDown className="size-4 shrink-0" />
                          ) : (
                            <ChevronRight className="size-4 shrink-0" />
                          )}
                          {expanded ? (
                            <FolderOpen className="size-4 shrink-0 text-portal-muted" />
                          ) : (
                            <Folder className="size-4 shrink-0 text-portal-muted" />
                          )}
                          <div className="min-w-0">
                          <span className="truncate font-medium">{row.name}</span>
                          {row.folder.default_sewing_operation_template_name ? (
                            <p className="truncate text-portal-caption text-portal-muted">
                              Шаблон: {row.folder.default_sewing_operation_template_name}
                            </p>
                          ) : null}
                        </div>
                        </button>
                        {folderActions(row.folder)}
                      </div>
                    </article>
                  );
                }

                const model = row.model;
                const { gridLabel, productTypeLabel } = modelMeta(model);

                return (
                  <article
                    key={`model-m-${model.id}`}
                    className="min-w-0 rounded-portal-lg border border-portal-border bg-portal-surface p-portal-4 shadow-portal-sm"
                    style={{ marginLeft: `${row.depth * 0.75}rem` }}
                  >
                    <div className="flex min-w-0 items-start justify-between gap-portal-3">
                      <div className="flex min-w-0 flex-1 items-start gap-portal-3">
                        {selectMode ? (
                          <Checkbox
                            checked={selectedIds.has(model.id)}
                            aria-label={`Выбрать ${model.name}`}
                            onChange={() => toggleSelected(model.id)}
                            className="mt-1 shrink-0"
                          />
                        ) : null}
                        <CoverThumb model={model} onOpen={openLightbox} />
                        <div className="min-w-0 flex-1 space-y-portal-2">
                          <h3 className="truncate text-portal-body font-semibold text-portal-text">
                            <button
                              type="button"
                              className="portal-focus-ring max-w-full truncate text-left hover:text-portal-primary hover:underline"
                              onClick={() => setCardModalModelId(model.id)}
                            >
                              {model.name}
                            </button>
                          </h3>
                          <p className="truncate text-portal-caption text-portal-muted">
                            {model.article} · {productTypeLabel} · {gridLabel}
                          </p>
                          <p className="text-portal-caption text-portal-muted">
                            Стоимость от–до: {costLabel(model.id)}
                          </p>
                          {rowActions(model)}
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
        ) : null}

        <ListTotals
          primary={`Всего: ${filtered.length} моделей · Папок: ${localFolders.length}`}
        />
      </section>
    </div>
  );
}

function SortableHeading({
  label,
  active,
  direction,
  onClick,
}: {
  label: string;
  active: boolean;
  direction: ProductModelListSortDirection;
  onClick: () => void;
}) {
  const Icon = !active ? ArrowDownUp : direction === "asc" ? ArrowUp : ArrowDown;
  return (
    <DataTableHeaderCell
      aria-sort={
        active ? (direction === "asc" ? "ascending" : "descending") : "none"
      }
    >
      <button
        type="button"
        onClick={onClick}
        className={[
          "inline-flex items-center gap-1.5 whitespace-nowrap font-inherit text-inherit uppercase tracking-wide",
          "text-portal-caption font-semibold",
          active ? "text-portal-primary" : "text-portal-muted",
          "hover:text-portal-primary",
        ].join(" ")}
      >
        {label}
        <Icon size={13} aria-hidden="true" />
      </button>
    </DataTableHeaderCell>
  );
}
