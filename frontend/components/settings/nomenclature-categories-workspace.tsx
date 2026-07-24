"use client";

import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Plus,
} from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  reorderNomenclatureCategorySibling,
  updateNomenclatureCategory,
} from "@/app/(workspace)/settings/catalogs/nomenclature/nomenclature-actions";
import { NomenclatureSectionCreateHost } from "@/components/settings/nomenclature-section-create-host";
import type { NomenclatureCreateKind } from "@/components/settings/nomenclature-section-create-menu";
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
import { StatusBadge } from "@/components/ui/status-badge";
import {
  NOMENCLATURE_TYPE_LABELS,
  NOMENCLATURE_TYPE_OPTIONS,
  type NomenclatureCategory,
} from "@/lib/nomenclature";
import {
  buildCategoryTreeRows,
  canMoveCategorySibling,
  categoryPathFromMap,
  filterCategoryTreeRows,
  parentCategoryOptions,
} from "@/lib/nomenclature-category-tree";

/** Indented tree-table + CRUD for categories directory (`4.9.2` / `4.9.3`). */
export function NomenclatureCategoriesWorkspace({
  categories,
}: {
  categories: NomenclatureCategory[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [createKind, setCreateKind] = useState<NomenclatureCreateKind | null>(
    null,
  );
  const [createParentId, setCreateParentId] = useState<number | null>(null);
  const [collapsedIds, setCollapsedIds] = useState<Set<number>>(
    () => new Set(),
  );
  const [actionError, setActionError] = useState<string | null>(null);

  const byId = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );

  const treeRows = useMemo(
    () => buildCategoryTreeRows(categories),
    [categories],
  );

  const filteredRows = useMemo(
    () => filterCategoryTreeRows(treeRows, query),
    [query, treeRows],
  );

  const visibleRows = useMemo(() => {
    const hidden = new Set<number>();
    for (const row of filteredRows) {
      let parentId = row.category.parent_id;
      while (parentId != null) {
        if (collapsedIds.has(parentId) || hidden.has(parentId)) {
          hidden.add(row.category.id);
          break;
        }
        parentId = byId.get(parentId)?.parent_id ?? null;
      }
    }
    return filteredRows.filter((row) => !hidden.has(row.category.id));
  }, [byId, collapsedIds, filteredRows]);

  const editing = categories.find((item) => item.id === editingId) ?? null;
  const parentOptions = useMemo(
    () =>
      editing
        ? parentCategoryOptions(treeRows, editing.id, categories)
        : treeRows,
    [categories, editing, treeRows],
  );

  const closeEdit = () => setEditingId(null);

  const saveEdit = async (formData: FormData) => {
    await updateNomenclatureCategory(formData);
    closeEdit();
  };

  const toggleCollapsed = (id: number) => {
    setCollapsedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const openCreateChild = (parentId: number) => {
    setSelectedId(parentId);
    setCreateParentId(parentId);
    setCreateKind("category");
  };

  const onCreateKindChange = (kind: NomenclatureCreateKind | null) => {
    setCreateKind(kind);
    if (kind === "category") {
      setCreateParentId(selectedId);
    } else if (kind == null) {
      setCreateParentId(null);
    }
  };

  const moveSibling = (categoryId: number, direction: -1 | 1) => {
    setActionError(null);
    startTransition(async () => {
      try {
        await reorderNomenclatureCategorySibling(categoryId, direction);
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

  return (
    <NomenclatureSectionCreateHost
      categories={categories}
      createKind={createKind}
      onCreateKindChange={onCreateKindChange}
      categoryDefaultParentId={createParentId}
      toolbarStart={
        <div className="flex flex-wrap items-center gap-portal-3">
          <p className="text-portal-body text-portal-muted">
            Найдено: {filteredRows.length}
          </p>
          {selectedId != null ? (
            <Button
              type="button"
              size="compact"
              variant="secondary"
              onClick={() => openCreateChild(selectedId)}
            >
              <Plus className="size-4" aria-hidden="true" />
              Дочерняя к выбранной
            </Button>
          ) : null}
        </div>
      }
    >
      <div className="relative flex min-h-0 min-w-0 flex-1">
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
                      {row.outline} — {categoryPathFromMap(row.category, byId)}
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

        <div className="min-w-0 flex-1">
          <FilterToolbar variant="strip" label="Фильтры категорий">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Поиск по номеру, коду или названию"
              className="min-w-0 w-full md:min-w-56 md:flex-1"
              aria-label="Поиск категорий"
            />
            <Button
              type="button"
              size="compact"
              className="w-full md:w-auto"
              onClick={() => setQuery("")}
            >
              Сбросить
            </Button>
          </FilterToolbar>

          {actionError ? (
            <p className="border-b border-portal-danger/30 bg-portal-danger/5 px-portal-4 py-portal-2 text-portal-caption text-portal-danger">
              {actionError}
            </p>
          ) : null}

          <DataTableFrame className="rounded-none border-x-0 border-b-0 shadow-none">
            <DataTable minWidthClassName="min-w-[820px]">
              <DataTableHead>
                <tr>
                  <DataTableHeaderCell className="w-24">№</DataTableHeaderCell>
                  <DataTableHeaderCell>Категория</DataTableHeaderCell>
                  <DataTableHeaderCell>Код</DataTableHeaderCell>
                  <DataTableHeaderCell>Тип</DataTableHeaderCell>
                  <DataTableHeaderCell>Статус</DataTableHeaderCell>
                  <DataTableHeaderCell className="w-40">
                    Порядок
                  </DataTableHeaderCell>
                  <DataTableHeaderCell>Действие</DataTableHeaderCell>
                </tr>
              </DataTableHead>
              <DataTableBody>
                {visibleRows.map((row) => {
                  const { category, depth, outline, hasChildren } = row;
                  const collapsed = collapsedIds.has(category.id);
                  const selected = selectedId === category.id;
                  const canUp = canMoveCategorySibling(
                    categories,
                    category.id,
                    -1,
                  );
                  const canDown = canMoveCategorySibling(
                    categories,
                    category.id,
                    1,
                  );
                  return (
                    <DataTableRow
                      key={category.id}
                      className={
                        editingId === category.id || selected
                          ? "bg-portal-primary-soft/50"
                          : undefined
                      }
                    >
                      <DataTableCell className="font-medium tabular-nums text-portal-muted">
                        {outline}
                      </DataTableCell>
                      <DataTableCell>
                        <div
                          className="flex min-w-0 items-center gap-portal-1"
                          style={{ paddingLeft: `${depth * 16}px` }}
                        >
                          {hasChildren ? (
                            <IconButton
                              label={
                                collapsed
                                  ? `Развернуть ${category.name}`
                                  : `Свернуть ${category.name}`
                              }
                              onClick={() => toggleCollapsed(category.id)}
                              className="shrink-0"
                            >
                              {collapsed ? (
                                <ChevronRight size={16} aria-hidden="true" />
                              ) : (
                                <ChevronDown size={16} aria-hidden="true" />
                              )}
                            </IconButton>
                          ) : (
                            <span
                              className="inline-block w-8 shrink-0"
                              aria-hidden="true"
                            />
                          )}
                          <button
                            type="button"
                            className="min-w-0 truncate text-left font-medium text-portal-text hover:text-portal-primary"
                            onClick={() => {
                              setSelectedId(category.id);
                              setEditingId(category.id);
                            }}
                          >
                            {category.name}
                          </button>
                        </div>
                      </DataTableCell>
                      <DataTableCell className="font-medium">
                        {category.code}
                      </DataTableCell>
                      <DataTableCell>
                        {NOMENCLATURE_TYPE_LABELS[category.nomenclature_type]}
                      </DataTableCell>
                      <DataTableCell>
                        <StatusBadge
                          size="compact"
                          tone={category.is_active ? "success" : "neutral"}
                        >
                          {category.is_active ? "Активна" : "Отключена"}
                        </StatusBadge>
                      </DataTableCell>
                      <DataTableCell>
                        <div className="flex items-center gap-portal-1">
                          <IconButton
                            label={`Выше: ${category.name}`}
                            title="Выше"
                            disabled={pending || !canUp}
                            onClick={() => moveSibling(category.id, -1)}
                          >
                            <ArrowUp size={16} aria-hidden="true" />
                          </IconButton>
                          <IconButton
                            label={`Ниже: ${category.name}`}
                            title="Ниже"
                            disabled={pending || !canDown}
                            onClick={() => moveSibling(category.id, 1)}
                          >
                            <ArrowDown size={16} aria-hidden="true" />
                          </IconButton>
                        </div>
                      </DataTableCell>
                      <DataTableCell>
                        <div className="flex flex-wrap gap-portal-1">
                          <Button
                            type="button"
                            size="compact"
                            onClick={() => {
                              setSelectedId(category.id);
                              setEditingId(category.id);
                            }}
                          >
                            Изменить
                          </Button>
                          <Button
                            type="button"
                            size="compact"
                            variant="secondary"
                            onClick={() => openCreateChild(category.id)}
                          >
                            Дочерняя
                          </Button>
                        </div>
                      </DataTableCell>
                    </DataTableRow>
                  );
                })}
              </DataTableBody>
            </DataTable>
            {visibleRows.length === 0 ? (
              <div className="p-portal-6">
                <EmptyState
                  title="Категории не найдены"
                  description="Создайте категорию через «Создать» или измените фильтр."
                  size="compact"
                />
              </div>
            ) : null}
          </DataTableFrame>
          <ListTotals primary={`Всего: ${filteredRows.length} категорий`} />
        </div>
      </div>
    </NomenclatureSectionCreateHost>
  );
}
