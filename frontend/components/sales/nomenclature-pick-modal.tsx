"use client";

import { ChevronDown, ChevronRight, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { TreeNodeButton, TreePane } from "@/components/tree-list/tree-pane";
import { Button, IconButton } from "@/components/ui/button";
import { Input } from "@/components/ui/form-controls";
import {
  buildCategoryTreeRows,
  filterByCategoryListScope,
  visibleCategoryTreeRows,
  type CategoryListScope,
} from "@/lib/nomenclature-category-tree";
import {
  nomenclatureLabel,
  type Nomenclature,
  type NomenclatureCategory,
} from "@/lib/nomenclature";

type MobilePane = "categories" | "items";

type NomenclaturePickModalProps = {
  open: boolean;
  items: Nomenclature[];
  categories: NomenclatureCategory[];
  value: number | null;
  onClose: () => void;
  onSelect: (item: Nomenclature | null) => void;
};

/**
 * Adaptive nomenclature chooser for order lines: category tree + item list.
 * Selection modal (not entity create) — centered dialog is allowed for pickers.
 */
export function NomenclaturePickModal({
  open,
  items,
  categories,
  value,
  onClose,
  onSelect,
}: NomenclaturePickModalProps) {
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<CategoryListScope>("all");
  const [expandedIds, setExpandedIds] = useState<Set<number>>(() => new Set());
  const [mobilePane, setMobilePane] = useState<MobilePane>("items");
  const [treeOpenOnMobile, setTreeOpenOnMobile] = useState(false);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setScope("all");
    setMobilePane("items");
    setTreeOpenOnMobile(false);
    setExpandedIds(new Set());
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const activeCategories = useMemo(
    () => categories.filter((row) => row.is_active),
    [categories],
  );

  const treeRows = useMemo(
    () => buildCategoryTreeRows(activeCategories),
    [activeCategories],
  );

  const visibleTree = useMemo(
    () => visibleCategoryTreeRows(treeRows, expandedIds),
    [treeRows, expandedIds],
  );

  const scopedItems = useMemo(() => {
    const active = items.filter((item) => item.is_active);
    const byCategory = filterByCategoryListScope(active, activeCategories, scope);
    const q = query.trim().toLocaleLowerCase("ru");
    if (!q) return byCategory;
    return byCategory.filter((item) => {
      const haystack = [
        item.name,
        item.short_name ?? "",
        item.category ?? "",
        item.unit,
      ]
        .join(" ")
        .toLocaleLowerCase("ru");
      return haystack.includes(q);
    });
  }, [items, activeCategories, scope, query]);

  const selectedCategoryLabel = useMemo(() => {
    if (scope === "all") return "Все категории";
    if (scope === "uncategorized") return "Без категории";
    const match = activeCategories.find((row) => row.id === scope.categoryId);
    return match?.name ?? "Категория";
  }, [scope, activeCategories]);

  if (!open) return null;

  function toggleExpand(categoryId: number) {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  }

  function pickCategory(next: CategoryListScope) {
    setScope(next);
    setMobilePane("items");
    setTreeOpenOnMobile(false);
  }

  function choose(item: Nomenclature | null) {
    onSelect(item);
    onClose();
  }

  const treeBody = (
    <div className="space-y-portal-1">
      <TreeNodeButton
        selected={scope === "all"}
        onClick={() => pickCategory("all")}
      >
        Все категории
      </TreeNodeButton>
      <TreeNodeButton
        selected={scope === "uncategorized"}
        onClick={() => pickCategory("uncategorized")}
      >
        Без категории
      </TreeNodeButton>
      {visibleTree.map((row) => {
        const selected =
          typeof scope === "object" && scope.categoryId === row.category.id;
        return (
          <div key={row.category.id} className="flex min-w-0 items-stretch gap-0.5">
            {row.hasChildren ? (
              <button
                type="button"
                className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-portal-sm text-portal-muted hover:bg-portal-surface-secondary hover:text-portal-text"
                aria-label={
                  expandedIds.has(row.category.id)
                    ? `Свернуть «${row.category.name}»`
                    : `Развернуть «${row.category.name}»`
                }
                aria-expanded={expandedIds.has(row.category.id)}
                onClick={() => toggleExpand(row.category.id)}
              >
                {expandedIds.has(row.category.id) ? (
                  <ChevronDown size={14} aria-hidden />
                ) : (
                  <ChevronRight size={14} aria-hidden />
                )}
              </button>
            ) : (
              <span className="inline-block w-7 shrink-0" aria-hidden />
            )}
            <TreeNodeButton
              selected={selected}
              depth={row.depth}
              className="min-w-0 flex-1"
              onClick={() => pickCategory({ categoryId: row.category.id })}
            >
              <span className="truncate">{row.category.name}</span>
            </TreeNodeButton>
          </div>
        );
      })}
    </div>
  );

  const listBody = (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-portal-border px-portal-3 py-portal-2 sm:px-portal-4">
        <label className="relative block">
          <Search
            size={14}
            className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-portal-muted"
            aria-hidden
          />
          <Input
            size="compact"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Поиск номенклатуры"
            aria-label="Поиск номенклатуры"
            className="pl-8"
            autoFocus
          />
        </label>
        <p className="mt-portal-1 text-portal-caption text-portal-muted">
          {selectedCategoryLabel} · {scopedItems.length} поз.
        </p>
      </div>
      <ul className="min-h-0 flex-1 space-y-portal-1 overflow-y-auto p-portal-2 sm:p-portal-3">
        {scopedItems.length === 0 ? (
          <li className="px-portal-2 py-portal-6 text-center text-portal-body text-portal-muted">
            Активная номенклатура не найдена
          </li>
        ) : (
          scopedItems.map((item) => {
            const selected = item.id === value;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => choose(item)}
                  className={[
                    "flex w-full flex-col gap-0.5 rounded-portal-md px-portal-3 py-portal-2 text-left transition-colors",
                    selected
                      ? "bg-portal-primary-soft text-portal-primary"
                      : "text-portal-text hover:bg-portal-surface-secondary",
                  ].join(" ")}
                >
                  <span className="text-portal-body font-medium">
                    {nomenclatureLabel(item)}
                  </span>
                  <span className="text-portal-caption text-portal-muted">
                    {[
                      item.short_name,
                      item.unit,
                      item.basePrice ? `${item.basePrice} ₽` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </button>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-portal-modal-2 flex items-end justify-center bg-[#101828]/40 p-0 sm:items-center sm:p-portal-4"
      role="presentation"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="nomenclature-pick-title"
        className="flex h-[min(92vh,720px)] w-full max-w-4xl flex-col overflow-hidden rounded-t-portal-lg border border-portal-border bg-portal-surface shadow-portal-overlay sm:h-[min(85vh,640px)] sm:rounded-portal-lg"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between gap-portal-2 border-b border-portal-border px-portal-3 py-portal-3 sm:px-portal-4">
          <div className="min-w-0">
            <h2
              id="nomenclature-pick-title"
              className="text-portal-title font-semibold text-portal-text"
            >
              Выбор номенклатуры
            </h2>
            <p className="text-portal-caption text-portal-muted">
              Категории слева, позиции справа. На узких экранах — переключение вкладок.
            </p>
          </div>
          <IconButton label="Закрыть" onClick={onClose}>
            <X size={18} aria-hidden />
          </IconButton>
        </header>

        {/* Mobile pane switch */}
        <div className="flex shrink-0 gap-portal-1 border-b border-portal-border px-portal-3 py-portal-2 md:hidden">
          <Button
            type="button"
            size="compact"
            variant={mobilePane === "categories" || treeOpenOnMobile ? "primary" : "secondary"}
            onClick={() => {
              setMobilePane("categories");
              setTreeOpenOnMobile(true);
            }}
          >
            Категории
          </Button>
          <Button
            type="button"
            size="compact"
            variant={mobilePane === "items" && !treeOpenOnMobile ? "primary" : "secondary"}
            onClick={() => {
              setMobilePane("items");
              setTreeOpenOnMobile(false);
            }}
          >
            Список
          </Button>
          {value !== null ? (
            <Button
              type="button"
              size="compact"
              variant="ghost"
              className="ml-auto"
              onClick={() => choose(null)}
            >
              Очистить
            </Button>
          ) : null}
        </div>

        <div className="grid min-h-0 flex-1 md:grid-cols-[minmax(14rem,18rem)_minmax(0,1fr)]">
          <div
            className={[
              "min-h-0 border-portal-border md:block md:border-r",
              mobilePane === "categories" || treeOpenOnMobile
                ? "block"
                : "hidden",
            ].join(" ")}
          >
            <TreePane
              title="Категории"
              count={activeCategories.length}
              variant="dock"
              className="h-full"
              label="Дерево категорий номенклатуры"
            >
              {treeBody}
            </TreePane>
          </div>

          <div
            className={[
              "flex min-h-0 min-w-0 flex-col",
              mobilePane === "items" && !treeOpenOnMobile ? "flex" : "hidden md:flex",
            ].join(" ")}
          >
            <div className="hidden shrink-0 items-center justify-end gap-portal-2 border-b border-portal-border px-portal-4 py-portal-2 md:flex">
              {value !== null ? (
                <Button type="button" size="compact" variant="ghost" onClick={() => choose(null)}>
                  Очистить связь
                </Button>
              ) : null}
              <Button type="button" size="compact" variant="secondary" onClick={onClose}>
                Отмена
              </Button>
            </div>
            {listBody}
          </div>
        </div>

        <footer className="flex shrink-0 items-center justify-end gap-portal-2 border-t border-portal-border px-portal-3 py-portal-2 md:hidden">
          <Button type="button" size="compact" variant="secondary" onClick={onClose}>
            Отмена
          </Button>
        </footer>
      </div>
    </div>
  );
}
