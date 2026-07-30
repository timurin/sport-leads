"use client";

import Link from "next/link";
import {
  BarChart3,
  Copy,
  ExternalLink,
  Filter,
  FilterX,
  PanelLeft,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { copyNomenclature, updateNomenclatureCategory } from "@/app/(workspace)/settings/catalogs/nomenclature/nomenclature-actions";
import { PageLayout } from "@/components/layout/page-layout";
import { NomenclatureCreatePanels } from "@/components/settings/nomenclature-create-panels";
import { NomenclatureInspector } from "@/components/settings/nomenclature-inspector";
import {
  NomenclatureSectionCreateMenu,
  parseNomenclatureCreateKind,
  type NomenclatureCreateKind,
} from "@/components/settings/nomenclature-section-create-menu";
import {
  TreeListContent,
  TreeListSplit,
} from "@/components/tree-list/tree-list-split";
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
import { EditDrawer, EditForm } from "@/components/ui/edit-drawer";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterToolbar } from "@/components/ui/filter-toolbar";
import { Checkbox, Field, Input, Select } from "@/components/ui/form-controls";
import { ListTotals } from "@/components/ui/list-pagination";
import { PageToolbar } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { WarehouseCategoryTreePane } from "@/components/warehouse/nomenclature-category-folder-tree";
import {
  NOMENCLATURE_TYPE_LABELS,
  NOMENCLATURE_TYPE_OPTIONS,
  type Nomenclature,
  type NomenclatureCategory,
  type NomenclatureCharacteristicValue,
  type NomenclatureType,
  type UnitOfMeasure,
} from "@/lib/nomenclature";
import {
  buildCategoryTreeRows,
  categoryPathFromMap,
  filterByCategoryListScope,
  parentCategoryOptions,
  type CategoryListScope,
} from "@/lib/nomenclature-category-tree";
import { formatAmountWithCurrency } from "@/lib/money";
import {
  filterByStockPresence,
  stockBalanceOrZero,
  type StockPresenceFilter,
} from "@/lib/stock-balances-filter";

const ROW_ICON_LINK =
  "portal-focus-ring inline-flex size-portal-control-icon shrink-0 items-center justify-center rounded-portal-md border border-portal-border bg-portal-surface text-portal-muted hover:bg-portal-state-hover hover:text-portal-text";

const ROW_ICON_BUTTON =
  "portal-focus-ring inline-flex size-portal-control-icon shrink-0 items-center justify-center rounded-portal-md border border-portal-border bg-portal-surface text-portal-muted hover:bg-portal-state-hover hover:text-portal-text disabled:pointer-events-none disabled:opacity-50";

const typeLabels = NOMENCLATURE_TYPE_LABELS;
const typeOptions = NOMENCLATURE_TYPE_OPTIONS;

function categoryName(
  categoryId: number | null,
  categories: NomenclatureCategory[],
) {
  return (
    categories.find((category) => category.id === categoryId)?.name ??
    "Без категории"
  );
}

function closeTreeOnNarrow(setTreeOpen: (open: boolean) => void) {
  if (
    typeof window !== "undefined" &&
    window.matchMedia("(max-width: 1023px)").matches
  ) {
    setTreeOpen(false);
  }
}

function selectedCategoryIdFromScope(scope: CategoryListScope): number | null {
  return typeof scope === "object" ? scope.categoryId : null;
}

/**
 * Warehouse nomenclature workspace (`4.10.3`–`4.10.6` / `12.2.3`):
 * DS-PT-04 tree + list + inspector + category CRUD + live остаток column/filter.
 */
export function WarehouseNomenclatureWorkspace({
  items,
  categories,
  units,
  fieldValues = {},
  coverUrls = {},
  stockBalances = {},
}: {
  items: Nomenclature[];
  categories: NomenclatureCategory[];
  units: UnitOfMeasure[];
  fieldValues?: Record<number, NomenclatureCharacteristicValue[]>;
  coverUrls?: Record<number, string | null>;
  stockBalances?: Record<number, string>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [copyPending, startCopyTransition] = useTransition();
  const [copyBusyId, setCopyBusyId] = useState<number | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [treeOpen, setTreeOpen] = useState(true);
  const [categoryScope, setCategoryScope] = useState<CategoryListScope>("all");
  const [createKind, setCreateKind] = useState<NomenclatureCreateKind | null>(
    () => parseNomenclatureCreateKind(searchParams.get("create")),
  );
  const [createParentId, setCreateParentId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [type, setType] = useState<"" | NomenclatureType>("");
  const [stockFilter, setStockFilter] = useState<StockPresenceFilter>("all");
  const [active, setActive] = useState("active");
  const [hasPrice, setHasPrice] = useState(false);
  const [missingRequired, setMissingRequired] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);

  const filtersActive =
    Boolean(type) ||
    stockFilter !== "all" ||
    active !== "active" ||
    hasPrice ||
    missingRequired;

  const byId = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );

  const treeRows = useMemo(
    () => buildCategoryTreeRows(categories),
    [categories],
  );

  const editing = categories.find((item) => item.id === editingId) ?? null;
  const parentOptions = useMemo(
    () =>
      editing
        ? parentCategoryOptions(treeRows, editing.id, categories)
        : treeRows,
    [categories, editing, treeRows],
  );

  const selectedCategoryId = selectedCategoryIdFromScope(categoryScope);

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedId) ?? null,
    [items, selectedId],
  );

  const openInspector = (item: Nomenclature) => {
    setSelectedId(item.id);
    setInspectorOpen(true);
  };

  const closeInspector = () => {
    setInspectorOpen(false);
  };

  const closeEdit = () => setEditingId(null);

  const saveEdit = async (formData: FormData) => {
    await updateNomenclatureCategory(formData);
    closeEdit();
  };

  const onCategoryScopeChange = (scope: CategoryListScope) => {
    setCategoryScope(scope);
    closeTreeOnNarrow(setTreeOpen);
  };

  const onCreateKindChange = (kind: NomenclatureCreateKind | null) => {
    setCreateKind(kind);
    if (kind === "category") {
      setCreateParentId(selectedCategoryId);
    } else if (kind == null) {
      setCreateParentId(null);
    }
  };

  const openCreateChild = (parentId: number) => {
    setCategoryScope({ categoryId: parentId });
    setCreateParentId(parentId);
    setCreateKind("category");
  };

  const openEditCategory = (categoryId: number) => {
    setCategoryScope({ categoryId });
    setEditingId(categoryId);
  };

  const scopedItems = useMemo(
    () => filterByCategoryListScope(items, categories, categoryScope),
    [categoryScope, categories, items],
  );

  const stockScopedItems = useMemo(
    () => filterByStockPresence(scopedItems, stockBalances, stockFilter),
    [scopedItems, stockBalances, stockFilter],
  );

  const visibleItems = useMemo(() => {
    return stockScopedItems.filter((item) => {
      const values = fieldValues[item.id] ?? [];
      const text = `${item.name} ${item.short_name ?? ""} ${values
        .map((field) => String(field.value ?? ""))
        .join(" ")}`.toLowerCase();
      if (search && !text.includes(search.toLowerCase())) {
        return false;
      }
      if (type && item.nomenclature_type !== type) {
        return false;
      }
      if (
        (active === "active" && !item.is_active) ||
        (active === "inactive" && item.is_active)
      ) {
        return false;
      }
      if (hasPrice && Number(item.base_price) <= 0) {
        return false;
      }
      if (
        missingRequired &&
        !values.some(
          (field) =>
            field.is_required && (field.value === null || field.value === ""),
        )
      ) {
        return false;
      }
      return true;
    });
  }, [
    stockScopedItems,
    fieldValues,
    search,
    type,
    active,
    hasPrice,
    missingRequired,
  ]);

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

  useEffect(() => {
    if (!inspectorOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setInspectorOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [inspectorOpen]);

  const clearFilters = () => {
    setType("");
    setStockFilter("all");
    setActive("active");
    setHasPrice(false);
    setMissingRequired(false);
  };

  const emptyDescription =
    items.length === 0
      ? "Каталог пуст. Создайте первую позицию через кнопку «Создать»."
      : "Измените поиск, категорию, тип или сбросьте фильтры.";

  const unitLabel = (item: Nomenclature) =>
    units.find((unit) => unit.id === item.storage_unit_id)?.symbol ?? item.unit;

  const onCopyItem = (item: Nomenclature) => {
    setCopyError(null);
    setCopyBusyId(item.id);
    startCopyTransition(async () => {
      try {
        const created = await copyNomenclature(item.id);
        router.push(`/settings/catalogs/nomenclature/${created.id}`);
        router.refresh();
      } catch (caught) {
        setCopyError(
          caught instanceof Error
            ? caught.message
            : "Не удалось скопировать номенклатуру",
        );
        setCopyBusyId(null);
      }
    });
  };

  const rowActions = (item: Nomenclature) => {
    const href = `/settings/catalogs/nomenclature/${item.id}`;
    const statsActive = inspectorOpen && item.id === selectedId;
    const copying = copyPending && copyBusyId === item.id;
    return (
      <div className="flex items-center gap-1" role="group" aria-label="Действия">
        <button
          type="button"
          className={[
            ROW_ICON_BUTTON,
            statsActive
              ? "border-portal-primary bg-portal-state-selected text-portal-primary"
              : "",
          ]
            .filter(Boolean)
            .join(" ")}
          aria-label={`Статистика ${item.name}`}
          aria-pressed={statsActive}
          title="Статистика"
          onClick={() => openInspector(item)}
        >
          <BarChart3 className="size-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          className={ROW_ICON_BUTTON}
          aria-label={`Копировать ${item.name}`}
          title="Копировать"
          disabled={copyPending}
          onClick={() => onCopyItem(item)}
        >
          <Copy
            className={`size-4 ${copying ? "animate-pulse" : ""}`}
            aria-hidden="true"
          />
        </button>
        <Link
          href={href}
          className={ROW_ICON_LINK}
          aria-label={`Открыть ${item.name}`}
          title="Открыть"
        >
          <ExternalLink className="size-4" aria-hidden="true" />
        </Link>
      </div>
    );
  };

  return (
    <PageLayout className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <PageToolbar
          start={
            <div className="flex min-w-0 w-full flex-1 items-center gap-1">
              <Button
                type="button"
                size="compact"
                variant={treeOpen ? "primary" : "secondary"}
                aria-pressed={treeOpen}
                aria-controls="tree-list-drawer"
                onClick={() => setTreeOpen((open) => !open)}
              >
                <PanelLeft className="size-4" aria-hidden="true" />
                Категории
              </Button>
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Поиск по названию и реквизитам"
                className="min-w-0 w-full flex-1"
                aria-label="Поиск номенклатуры"
              />
              <IconButton
                label="Сбросить поиск"
                variant="secondary"
                disabled={!search}
                onClick={() => setSearch("")}
              >
                <X className="size-4" aria-hidden="true" />
              </IconButton>
              <div className="relative shrink-0" ref={filterRef}>
                <IconButton
                  label="Фильтр номенклатуры"
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
                    aria-label="Фильтр номенклатуры"
                    className="absolute right-0 z-20 mt-1 w-[min(100vw-2rem,18rem)] space-y-portal-3 rounded-portal-md border border-portal-border bg-portal-surface p-portal-3 shadow-portal-card"
                  >
                    <Select
                      value={active}
                      onChange={(event) => setActive(event.target.value)}
                      aria-label="Статус"
                    >
                      <option value="active">Активные</option>
                      <option value="inactive">Неактивные</option>
                      <option value="all">Все статусы</option>
                    </Select>
                    <label className="flex items-center gap-2 text-portal-body text-portal-text">
                      <input
                        type="checkbox"
                        checked={hasPrice}
                        onChange={(event) => setHasPrice(event.target.checked)}
                        className="size-4 rounded border-portal-border"
                      />
                      Есть цена
                    </label>
                    <label className="flex items-center gap-2 text-portal-body text-portal-text">
                      <input
                        type="checkbox"
                        checked={missingRequired}
                        onChange={(event) =>
                          setMissingRequired(event.target.checked)
                        }
                        className="size-4 rounded border-portal-border"
                      />
                      Незаполненные обязательные
                    </label>
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
            </div>
          }
          end={
            <NomenclatureSectionCreateMenu
              onSelect={onCreateKindChange}
              size="compact"
            />
          }
        />
        {copyError ? (
          <p
            className="border-b border-portal-danger/30 bg-portal-danger/5 px-portal-4 py-portal-2 text-portal-caption text-portal-danger"
            role="alert"
          >
            {copyError}
          </p>
        ) : null}

        <div className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden">
          <EditDrawer
            open={editing != null}
            title={editing ? `Редактирование: ${editing.name}` : ""}
            onClose={closeEdit}
          >
            {editing ? (
              <EditForm action={saveEdit} onCancel={closeEdit}>
                <input type="hidden" name="id" value={editing.id} />
                <Field label="Название" required>
                  <Input
                    name="name"
                    defaultValue={editing.name}
                    required
                    autoFocus
                  />
                </Field>
                <Field label="Код" required>
                  <Input
                    name="code"
                    defaultValue={editing.code}
                    required
                    pattern="[a-z0-9][a-z0-9_-]*"
                  />
                </Field>
                <Field label="Тип номенклатуры">
                  <Select
                    name="nomenclature_type"
                    defaultValue={editing.nomenclature_type}
                  >
                    {NOMENCLATURE_TYPE_OPTIONS.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Родительская группа">
                  <Select
                    name="parent_id"
                    defaultValue={editing.parent_id ?? ""}
                  >
                    <option value="">Корневая группа</option>
                    {parentOptions.map((row) => (
                      <option key={row.category.id} value={row.category.id}>
                        {row.outline} —{" "}
                        {categoryPathFromMap(row.category, byId)}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Описание">
                  <Input
                    name="description"
                    defaultValue={editing.description ?? ""}
                  />
                </Field>
                <Field label="Порядок">
                  <Input
                    name="sort_order"
                    type="number"
                    min={0}
                    defaultValue={editing.sort_order}
                  />
                </Field>
                <Checkbox
                  name="is_active"
                  value="true"
                  defaultChecked={editing.is_active}
                  label="Активна"
                />
              </EditForm>
            ) : null}
          </EditDrawer>

          <TreeListSplit
            treeOpen={treeOpen}
            onTreeOpenChange={setTreeOpen}
            className="min-h-0 flex-1"
            renderTree={({ onClose }) => (
              <WarehouseCategoryTreePane
                categories={categories}
                scope={categoryScope}
                onScopeChange={onCategoryScopeChange}
                onClose={onClose}
                onEditCategory={openEditCategory}
                onCreateChild={openCreateChild}
              />
            )}
          >
            <TreeListContent className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
              <FilterToolbar variant="strip" label="Фильтры номенклатуры">
                <div
                  className="flex min-w-0 flex-wrap items-center gap-portal-2"
                  role="group"
                  aria-label="Тип"
                >
                  <Button
                    type="button"
                    size="compact"
                    variant={type === "" ? "primary" : "secondary"}
                    aria-pressed={type === ""}
                    onClick={() => setType("")}
                  >
                    Все типы
                  </Button>
                  {typeOptions.map(([value, label]) => (
                    <Button
                      key={value}
                      type="button"
                      size="compact"
                      variant={type === value ? "primary" : "secondary"}
                      aria-pressed={type === value}
                      onClick={() => setType(value)}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
                <div
                  className="flex min-w-0 flex-wrap items-center gap-portal-2"
                  role="group"
                  aria-label="Остаток"
                >
                  <Button
                    type="button"
                    size="compact"
                    variant={
                      stockFilter === "in_stock" ? "primary" : "secondary"
                    }
                    aria-pressed={stockFilter === "in_stock"}
                    onClick={() =>
                      setStockFilter((current) =>
                        current === "in_stock" ? "all" : "in_stock",
                      )
                    }
                  >
                    С остатком
                  </Button>
                </div>
              </FilterToolbar>

              <section className="min-h-0 min-w-0 flex-1 overflow-auto bg-portal-surface">
                <div className="hidden min-w-0 md:block">
                  <DataTableFrame className="rounded-none border-x-0 border-b-0 shadow-none">
                    <DataTable minWidthClassName="min-w-[820px]">
                      <DataTableHead>
                        <tr>
                          <DataTableHeaderCell>Наименование</DataTableHeaderCell>
                          <DataTableHeaderCell>Тип</DataTableHeaderCell>
                          <DataTableHeaderCell>Категория</DataTableHeaderCell>
                          <DataTableHeaderCell>Ед.</DataTableHeaderCell>
                          <DataTableHeaderCell>Цена</DataTableHeaderCell>
                          <DataTableHeaderCell>Остаток</DataTableHeaderCell>
                          <DataTableHeaderCell>Статус</DataTableHeaderCell>
                          <DataTableHeaderCell>Действие</DataTableHeaderCell>
                        </tr>
                      </DataTableHead>
                      <DataTableBody>
                        {visibleItems.map((item) => {
                          const href = `/settings/catalogs/nomenclature/${item.id}`;
                          const selected =
                            inspectorOpen && item.id === selectedId;
                          return (
                            <DataTableRow
                              key={item.id}
                              className={
                                selected
                                  ? "bg-portal-state-selected"
                                  : "hover:bg-portal-state-hover"
                              }
                            >
                              <DataTableCell>
                                <Link
                                  href={href}
                                  className="font-medium text-portal-text hover:text-portal-primary hover:underline"
                                >
                                  {item.name}
                                </Link>
                                {item.short_name ? (
                                  <div className="text-portal-caption text-portal-muted">
                                    {item.short_name}
                                  </div>
                                ) : null}
                              </DataTableCell>
                              <DataTableCell>
                                {typeLabels[item.nomenclature_type]}
                              </DataTableCell>
                              <DataTableCell>
                                {categoryName(item.category_id, categories)}
                              </DataTableCell>
                              <DataTableCell>{unitLabel(item)}</DataTableCell>
                              <DataTableCell>
                                {formatAmountWithCurrency(item.basePrice, item.currency)}
                              </DataTableCell>
                              <DataTableCell>
                                {stockBalanceOrZero(stockBalances, item.id)}
                              </DataTableCell>
                              <DataTableCell>
                                <StatusBadge
                                  size="compact"
                                  tone={item.is_active ? "success" : "neutral"}
                                >
                                  {item.is_active ? "Активна" : "Архив"}
                                </StatusBadge>
                              </DataTableCell>
                              <DataTableCell>{rowActions(item)}</DataTableCell>
                            </DataTableRow>
                          );
                        })}
                      </DataTableBody>
                    </DataTable>
                    {visibleItems.length === 0 ? (
                      <div className="p-portal-6">
                        <EmptyState
                          title={
                            items.length === 0
                              ? "Номенклатуры пока нет"
                              : "Позиции не найдены"
                          }
                          description={emptyDescription}
                          size="compact"
                        />
                      </div>
                    ) : null}
                  </DataTableFrame>
                </div>

                <div className="min-w-0 space-y-portal-3 border-b border-portal-border bg-portal-surface-secondary p-portal-3 md:hidden">
                  {visibleItems.length === 0 ? (
                    <EmptyState
                      title={
                        items.length === 0
                          ? "Номенклатуры пока нет"
                          : "Позиции не найдены"
                      }
                      description={emptyDescription}
                      size="compact"
                    />
                  ) : (
                    visibleItems.map((item) => {
                      const href = `/settings/catalogs/nomenclature/${item.id}`;
                      const selected = inspectorOpen && item.id === selectedId;
                      return (
                        <article
                          key={item.id}
                          className={[
                            "min-w-0 rounded-portal-lg border bg-portal-surface p-portal-4 shadow-portal-sm",
                            selected
                              ? "border-portal-primary"
                              : "border-portal-border",
                          ].join(" ")}
                        >
                          <div className="flex min-w-0 items-start justify-between gap-portal-3">
                            <div className="min-w-0 flex-1 space-y-portal-2">
                              <h3 className="truncate text-portal-body font-semibold text-portal-text">
                                <Link
                                  href={href}
                                  className="hover:text-portal-primary hover:underline"
                                >
                                  {item.name}
                                </Link>
                              </h3>
                              <p className="truncate text-portal-caption text-portal-muted">
                                {typeLabels[item.nomenclature_type]} ·{" "}
                                {unitLabel(item)}
                              </p>
                              <p className="text-portal-caption text-portal-muted">
                                {categoryName(item.category_id, categories)} ·{" "}
                                {formatAmountWithCurrency(item.basePrice, item.currency)} · остаток{" "}
                                {stockBalanceOrZero(stockBalances, item.id)}
                              </p>
                              <div>{rowActions(item)}</div>
                            </div>
                            <StatusBadge
                              size="compact"
                              tone={item.is_active ? "success" : "neutral"}
                            >
                              {item.is_active ? "Активна" : "Архив"}
                            </StatusBadge>
                          </div>
                        </article>
                      );
                    })
                  )}
                </div>

                <ListTotals primary={`Всего: ${visibleItems.length} позиций`} />
              </section>

              {inspectorOpen ? (
                <div
                  className="fixed inset-y-0 right-0 z-portal-modal-1 flex h-dvh w-full max-w-[520px] flex-col overflow-hidden shadow-portal-overlay"
                  role="dialog"
                  aria-modal="true"
                  aria-label="Превью номенклатуры"
                >
                  <NomenclatureInspector
                    item={selectedItem}
                    categories={categories}
                    units={units}
                    coverUrl={
                      selectedId != null
                        ? (coverUrls[selectedId] ?? null)
                        : null
                    }
                    onClose={closeInspector}
                  />
                </div>
              ) : null}
            </TreeListContent>
          </TreeListSplit>
        </div>
      </div>

      <NomenclatureCreatePanels
        kind={createKind}
        categories={categories}
        units={units}
        categoryDefaultParentId={createParentId}
        onClose={() => onCreateKindChange(null)}
        variant="fullscreen"
      />
    </PageLayout>
  );
}
