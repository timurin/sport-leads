"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { updateNomenclatureCategory } from "@/app/(workspace)/settings/catalogs/nomenclature/nomenclature-actions";
import { NomenclatureSectionCreateHost } from "@/components/settings/nomenclature-section-create-host";
import { Button } from "@/components/ui/button";
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
import type {
  NomenclatureCategory,
  NomenclatureType,
} from "@/lib/nomenclature";

const typeLabels: Record<NomenclatureType, string> = {
  SERVICE: "Услуга",
  PRODUCT: "Продукция",
  GOODS: "Товар",
  MATERIAL: "Материал",
};
const typeOptions = Object.entries(typeLabels) as [NomenclatureType, string][];

function categoryPath(
  category: NomenclatureCategory,
  byId: Map<number, NomenclatureCategory>,
): string {
  const parts: string[] = [category.name];
  let parentId = category.parent_id;

  while (parentId != null) {
    const parent = byId.get(parentId);
    if (!parent) {
      break;
    }
    parts.unshift(parent.name);
    parentId = parent.parent_id;
  }

  return parts.join(" / ");
}

/** PT-02 nomenclature catalog list (`DS-PT-02`) + left edit drawer. */
export function NomenclatureCategoriesWorkspace({
  categories,
}: {
  categories: NomenclatureCategory[];
}) {
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const byId = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );

  const rows = useMemo(() => {
    const sorted = [...categories].sort((left, right) => {
      const pathCompare = categoryPath(left, byId).localeCompare(
        categoryPath(right, byId),
        "ru",
      );
      if (pathCompare !== 0) {
        return pathCompare;
      }
      return left.sort_order - right.sort_order;
    });
    const normalized = query.trim().toLocaleLowerCase("ru");
    if (!normalized) {
      return sorted;
    }
    return sorted.filter((category) => {
      const path = categoryPath(category, byId).toLocaleLowerCase("ru");
      return (
        path.includes(normalized) ||
        category.code.toLocaleLowerCase("ru").includes(normalized)
      );
    });
  }, [byId, categories, query]);

  const editing = categories.find((item) => item.id === editingId) ?? null;
  const closeEdit = () => setEditingId(null);

  const saveEdit = async (formData: FormData) => {
    await updateNomenclatureCategory(formData);
    closeEdit();
  };

  return (
    <NomenclatureSectionCreateHost
      categories={categories}
      toolbarStart={
        <p className="text-portal-body text-portal-muted">
          Найдено: {rows.length}
        </p>
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
                  {typeOptions.map(([value, label]) => (
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
                  {categories
                    .filter((category) => category.id !== editing.id)
                    .map((category) => (
                      <option key={category.id} value={category.id}>
                        {categoryPath(category, byId)}
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
              placeholder="Поиск по коду или пути"
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

          <DataTableFrame className="rounded-none border-x-0 border-b-0 shadow-none">
            <DataTable minWidthClassName="min-w-[640px]">
              <DataTableHead>
                <tr>
                  <DataTableHeaderCell>Код</DataTableHeaderCell>
                  <DataTableHeaderCell>Путь</DataTableHeaderCell>
                  <DataTableHeaderCell>Тип</DataTableHeaderCell>
                  <DataTableHeaderCell>Порядок</DataTableHeaderCell>
                  <DataTableHeaderCell>Статус</DataTableHeaderCell>
                  <DataTableHeaderCell>Действие</DataTableHeaderCell>
                </tr>
              </DataTableHead>
              <DataTableBody>
                {rows.map((category) => (
                  <DataTableRow
                    key={category.id}
                    className={
                      editingId === category.id
                        ? "bg-portal-primary-soft/50"
                        : undefined
                    }
                  >
                    <DataTableCell className="font-medium">
                      {category.code}
                    </DataTableCell>
                    <DataTableCell>
                      <button
                        type="button"
                        className="text-left font-medium text-portal-text hover:text-portal-primary"
                        onClick={() => setEditingId(category.id)}
                      >
                        {categoryPath(category, byId)}
                      </button>
                    </DataTableCell>
                    <DataTableCell>{category.nomenclature_type}</DataTableCell>
                    <DataTableCell>{category.sort_order}</DataTableCell>
                    <DataTableCell>
                      <StatusBadge
                        size="compact"
                        tone={category.is_active ? "success" : "neutral"}
                      >
                        {category.is_active ? "Активна" : "Отключена"}
                      </StatusBadge>
                    </DataTableCell>
                    <DataTableCell>
                      <Button
                        type="button"
                        size="compact"
                        onClick={() => setEditingId(category.id)}
                      >
                        Изменить
                      </Button>
                    </DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
            {rows.length === 0 ? (
              <div className="p-portal-6">
                <EmptyState
                  title="Категории не найдены"
                  description="Создайте категорию через «Создать» или измените фильтр."
                  size="compact"
                />
              </div>
            ) : null}
          </DataTableFrame>
          <ListTotals primary={`Всего: ${rows.length} категорий`} />
          <p className="border-t border-portal-border px-portal-4 py-portal-3 text-portal-body text-portal-muted lg:px-portal-6">
            Дерево категорий также доступно в{" "}
            <Link
              href="/settings/catalogs/nomenclature"
              className="font-semibold text-portal-primary hover:underline"
            >
              рабочем месте номенклатуры
            </Link>
            .
          </p>
        </div>
      </div>
    </NomenclatureSectionCreateHost>
  );
}
