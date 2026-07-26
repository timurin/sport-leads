"use client";

import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  Pencil,
  Plus,
} from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { reorderNomenclatureCategorySibling } from "@/app/(workspace)/settings/catalogs/nomenclature/nomenclature-actions";
import { TreeNodeButton, TreePane } from "@/components/tree-list/tree-pane";
import { Button, IconButton } from "@/components/ui/button";
import type { NomenclatureCategory } from "@/lib/nomenclature";
import {
  buildCategoryTreeRows,
  canMoveCategorySibling,
  visibleCategoryTreeRows,
  type CategoryListScope,
} from "@/lib/nomenclature-category-tree";

export type CategoryTreeActionMode =
  | "edit"
  | "createChild"
  | "moveUp"
  | "moveDown";

const ACTION_HINT: Record<CategoryTreeActionMode, string> = {
  edit: "Отметьте категорию для изменения",
  createChild: "Отметьте родителя для новой дочерней",
  moveUp: "Отметьте категорию, чтобы поднять выше",
  moveDown: "Отметьте категорию, чтобы опустить ниже",
};

type WarehouseCategoryTreePaneProps = {
  categories: NomenclatureCategory[];
  scope: CategoryListScope;
  onScopeChange: (scope: CategoryListScope) => void;
  onClose?: () => void;
  onEditCategory: (categoryId: number) => void;
  onCreateChild: (parentId: number) => void;
};

/**
 * Warehouse PT-04 category tree: CRUD icons in «Категории» header;
 * icon click → checkboxes on rows for the chosen action.
 */
export function WarehouseCategoryTreePane({
  categories,
  scope,
  onScopeChange,
  onClose,
  onEditCategory,
  onCreateChild,
}: WarehouseCategoryTreePaneProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [expandedIds, setExpandedIds] = useState<Set<number>>(
    () => new Set(),
  );
  const [actionMode, setActionMode] = useState<CategoryTreeActionMode | null>(
    null,
  );
  const [checkedId, setCheckedId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const treeRows = useMemo(
    () => buildCategoryTreeRows(categories),
    [categories],
  );

  const visibleRows = useMemo(
    () => visibleCategoryTreeRows(treeRows, expandedIds),
    [expandedIds, treeRows],
  );

  const toggleExpanded = (id: number) => {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectScope = (next: CategoryListScope) => {
    onScopeChange(next);
  };

  const selectCategory = (categoryId: number, hasChildren: boolean) => {
    if (actionMode) return;
    selectScope({ categoryId });
    if (hasChildren) {
      toggleExpanded(categoryId);
    }
  };

  const clearActionMode = () => {
    setActionMode(null);
    setCheckedId(null);
    setActionError(null);
  };

  const toggleActionMode = (mode: CategoryTreeActionMode) => {
    setActionError(null);
    setCheckedId(null);
    setActionMode((current) => (current === mode ? null : mode));
  };

  const moveSibling = (categoryId: number, direction: -1 | 1) => {
    setActionError(null);
    startTransition(async () => {
      try {
        await reorderNomenclatureCategorySibling(categoryId, direction);
        clearActionMode();
        router.refresh();
      } catch (caught) {
        setActionError(
          caught instanceof Error
            ? caught.message
            : "Не удалось изменить порядок",
        );
      }
    });
  };

  const applyCheckedAction = (categoryId: number) => {
    if (!actionMode) return;
    selectScope({ categoryId });

    if (actionMode === "edit") {
      onEditCategory(categoryId);
      clearActionMode();
      return;
    }
    if (actionMode === "createChild") {
      setExpandedIds((current) => {
        const next = new Set(current);
        next.add(categoryId);
        return next;
      });
      onCreateChild(categoryId);
      clearActionMode();
      return;
    }
    if (actionMode === "moveUp") {
      if (!canMoveCategorySibling(categories, categoryId, -1)) {
        setActionError("Категорию нельзя поднять выше.");
        return;
      }
      moveSibling(categoryId, -1);
      return;
    }
    if (actionMode === "moveDown") {
      if (!canMoveCategorySibling(categories, categoryId, 1)) {
        setActionError("Категорию нельзя опустить ниже.");
        return;
      }
      moveSibling(categoryId, 1);
    }
  };

  const onCheckboxChange = (categoryId: number, checked: boolean) => {
    if (!checked) {
      setCheckedId(null);
      return;
    }
    setCheckedId(categoryId);
    applyCheckedAction(categoryId);
  };

  const headerActions = (
    <>
      <IconButton
        label="Поднять категорию"
        title="Выше"
        variant={actionMode === "moveUp" ? "primary" : "ghost"}
        aria-pressed={actionMode === "moveUp"}
        disabled={pending}
        onClick={() => toggleActionMode("moveUp")}
      >
        <ArrowUp size={16} aria-hidden="true" />
      </IconButton>
      <IconButton
        label="Опустить категорию"
        title="Ниже"
        variant={actionMode === "moveDown" ? "primary" : "ghost"}
        aria-pressed={actionMode === "moveDown"}
        disabled={pending}
        onClick={() => toggleActionMode("moveDown")}
      >
        <ArrowDown size={16} aria-hidden="true" />
      </IconButton>
      <IconButton
        label="Изменить категорию"
        title="Изменить"
        variant={actionMode === "edit" ? "primary" : "ghost"}
        aria-pressed={actionMode === "edit"}
        onClick={() => toggleActionMode("edit")}
      >
        <Pencil size={16} aria-hidden="true" />
      </IconButton>
      <IconButton
        label="Добавить дочернюю категорию"
        title="Добавить"
        variant={actionMode === "createChild" ? "primary" : "ghost"}
        aria-pressed={actionMode === "createChild"}
        onClick={() => toggleActionMode("createChild")}
      >
        <Plus size={16} aria-hidden="true" />
      </IconButton>
    </>
  );

  const allSelected = scope === "all";
  const uncategorizedSelected = scope === "uncategorized";

  return (
    <TreePane
      title="Категории"
      count={categories.length}
      variant="dock"
      onClose={onClose}
      label="Дерево категорий номенклатуры"
      headerActions={headerActions}
      footer={
        actionMode ? (
          <div className="space-y-portal-2">
            <p className="text-portal-caption text-portal-muted">
              {ACTION_HINT[actionMode]}
            </p>
            <Button
              type="button"
              size="compact"
              variant="secondary"
              className="w-full"
              onClick={clearActionMode}
            >
              Отмена
            </Button>
          </div>
        ) : null
      }
    >
      <div className="space-y-portal-1" data-nomenclature-category-folder-tree>
        {actionError ? (
          <p className="rounded-portal-md bg-portal-danger-soft px-portal-2 py-portal-1 text-portal-caption text-portal-danger">
            {actionError}
          </p>
        ) : null}

        <TreeNodeButton
          selected={allSelected && !actionMode}
          onClick={() => {
            if (actionMode) return;
            selectScope("all");
          }}
          className={actionMode ? "pointer-events-none opacity-50" : ""}
        >
          Все
        </TreeNodeButton>
        <TreeNodeButton
          selected={uncategorizedSelected && !actionMode}
          onClick={() => {
            if (actionMode) return;
            selectScope("uncategorized");
          }}
          className={actionMode ? "pointer-events-none opacity-50" : ""}
        >
          Без категории
        </TreeNodeButton>

        {visibleRows.map((row) => {
          const { category, depth, hasChildren } = row;
          const expanded = expandedIds.has(category.id);
          const selected =
            !actionMode &&
            typeof scope === "object" &&
            scope.categoryId === category.id;
          const checkboxDisabled =
            pending ||
            (actionMode === "moveUp" &&
              !canMoveCategorySibling(categories, category.id, -1)) ||
            (actionMode === "moveDown" &&
              !canMoveCategorySibling(categories, category.id, 1));

          return (
            <div
              key={category.id}
              className={[
                "flex min-w-0 items-center gap-portal-1 rounded-portal-md",
                selected ? "bg-portal-primary-soft/40" : "",
                !category.is_active ? "opacity-60" : "",
              ].join(" ")}
              style={{ paddingLeft: `${depth * 14}px` }}
            >
              {actionMode ? (
                <label className="inline-flex size-portal-control-icon shrink-0 cursor-pointer items-center justify-center">
                  <input
                    type="checkbox"
                    className="size-4 rounded border-portal-border"
                    checked={checkedId === category.id}
                    disabled={checkboxDisabled}
                    aria-label={`Выбрать ${category.name}`}
                    onChange={(event) =>
                      onCheckboxChange(category.id, event.target.checked)
                    }
                  />
                </label>
              ) : hasChildren ? (
                <button
                  type="button"
                  className="portal-focus-ring inline-flex size-portal-control-icon shrink-0 items-center justify-center rounded-portal-md text-portal-muted hover:bg-portal-state-hover hover:text-portal-text"
                  aria-label={
                    expanded
                      ? `Свернуть ${category.name}`
                      : `Развернуть ${category.name}`
                  }
                  onClick={() => toggleExpanded(category.id)}
                >
                  {expanded ? (
                    <ChevronDown size={16} aria-hidden="true" />
                  ) : (
                    <ChevronRight size={16} aria-hidden="true" />
                  )}
                </button>
              ) : (
                <span className="inline-block size-portal-control-icon shrink-0" />
              )}

              {hasChildren ? (
                <button
                  type="button"
                  className="inline-flex shrink-0 text-portal-muted hover:text-portal-primary"
                  aria-label={
                    expanded
                      ? `Свернуть папку ${category.name}`
                      : `Открыть папку ${category.name}`
                  }
                  onClick={() => toggleExpanded(category.id)}
                >
                  {expanded ? (
                    <FolderOpen
                      size={16}
                      className="text-portal-primary"
                      aria-hidden="true"
                    />
                  ) : (
                    <Folder size={16} aria-hidden="true" />
                  )}
                </button>
              ) : (
                <Folder
                  size={16}
                  className="shrink-0 text-portal-muted"
                  aria-hidden="true"
                />
              )}

              <button
                type="button"
                data-tree-node
                data-selected={selected || undefined}
                className={[
                  "min-w-0 flex-1 truncate rounded-portal-md px-portal-2 py-portal-1 text-left text-portal-body transition-colors",
                  selected
                    ? "font-semibold text-portal-primary"
                    : "text-portal-text hover:bg-portal-surface-secondary",
                ].join(" ")}
                onClick={() => {
                  if (actionMode) {
                    if (!checkboxDisabled) {
                      onCheckboxChange(category.id, true);
                    }
                    return;
                  }
                  selectCategory(category.id, hasChildren);
                }}
              >
                {category.name}
              </button>
            </div>
          );
        })}
      </div>
    </TreePane>
  );
}
