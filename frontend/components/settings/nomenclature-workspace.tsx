"use client";

import { FolderTree } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";

import { updateNomenclatureCategory } from "@/app/(workspace)/settings/catalogs/nomenclature/nomenclature-actions";
import { PageLayout } from "@/components/layout/page-layout";
import { NomenclatureCreatePanels } from "@/components/settings/nomenclature-create-panels";
import {
  NomenclatureSectionCreateMenu,
  parseNomenclatureCreateKind,
  type NomenclatureCreateKind,
} from "@/components/settings/nomenclature-section-create-menu";
import {
  TreeListContent,
  TreeListSplit,
  type TreeListRenderApi,
} from "@/components/tree-list/tree-list-split";
import { TreeNodeButton, TreePane } from "@/components/tree-list/tree-pane";
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
import { EmptyState } from "@/components/ui/empty-state";
import { EntityLink } from "@/components/ui/entity-link";
import { FilterToolbar } from "@/components/ui/filter-toolbar";
import { Checkbox, Input, Select } from "@/components/ui/form-controls";
import { PageToolbar } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import type {
  Nomenclature,
  NomenclatureCategory,
  NomenclatureFieldValue,
  NomenclatureType,
  UnitOfMeasure,
} from "@/lib/nomenclature";

const typeLabels: Record<NomenclatureType, string> = {
  SERVICE: "Услуга",
  PRODUCT: "Продукция",
  GOODS: "Товар",
  MATERIAL: "Материал",
};
const typeOptions = Object.entries(typeLabels) as [NomenclatureType, string][];

function categoryName(
  categoryId: number | null,
  categories: NomenclatureCategory[],
) {
  return (
    categories.find((category) => category.id === categoryId)?.name ??
    "Без категории"
  );
}

function CategoryTree({
  categories,
  selected,
  onSelect,
  showInactive,
}: {
  categories: NomenclatureCategory[];
  selected: number | null;
  onSelect: (id: number | null) => void;
  showInactive: boolean;
}) {
  const children = (parentId: number | null) =>
    categories.filter(
      (category) =>
        category.parent_id === parentId && (category.is_active || showInactive),
    );

  const branch = (parentId: number | null, depth = 0): ReactNode =>
    children(parentId).map((category) => (
      <div key={category.id}>
        <TreeNodeButton
          selected={selected === category.id}
          depth={depth}
          onClick={() => onSelect(category.id)}
        >
          {category.name}
          <span className="ml-1 text-portal-caption text-portal-muted">
            ({category.nomenclature_type})
          </span>
        </TreeNodeButton>
        {branch(category.id, depth + 1)}
      </div>
    ));

  return (
    <div className="space-y-portal-1">
      <TreeNodeButton
        selected={selected === null}
        onClick={() => onSelect(null)}
      >
        Все позиции
      </TreeNodeButton>
      <TreeNodeButton
        selected={selected === -1}
        onClick={() => onSelect(-1)}
      >
        Без категории
      </TreeNodeButton>
      {branch(null)}
    </div>
  );
}

/** PT-04 reference tree + list workspace (`DS-PT-04`). */
export function NomenclatureWorkspace({
  items,
  categories,
  units,
  fieldValues,
}: {
  items: Nomenclature[];
  categories: NomenclatureCategory[];
  units: UnitOfMeasure[];
  fieldValues: Record<number, NomenclatureFieldValue[]>;
}) {
  const searchParams = useSearchParams();
  const [createKind, setCreateKind] = useState<NomenclatureCreateKind | null>(
    () => parseNomenclatureCreateKind(searchParams.get("create")),
  );
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [treeOpen, setTreeOpen] = useState(true);
  const [search, setSearch] = useState("");
  const [type, setType] = useState<"" | NomenclatureType>("");
  const [active, setActive] = useState("active");
  const [nested, setNested] = useState(false);
  const [hasPrice, setHasPrice] = useState(false);
  const [missingRequired, setMissingRequired] = useState(false);

  const descendants = useMemo(() => {
    if (selectedCategory === null || selectedCategory === -1) {
      return [];
    }
    const ids = new Set([selectedCategory]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const category of categories) {
        if (
          category.parent_id !== null &&
          ids.has(category.parent_id) &&
          !ids.has(category.id)
        ) {
          ids.add(category.id);
          changed = true;
        }
      }
    }
    return [...ids];
  }, [categories, selectedCategory]);

  const visibleItems = items.filter((item) => {
    const values = fieldValues[item.id] ?? [];
    const text = `${item.article} ${item.name} ${item.short_name ?? ""} ${values
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
    if (selectedCategory === -1) {
      if (item.category_id !== null) {
        return false;
      }
    } else if (
      selectedCategory !== null &&
      !(nested ? descendants : [selectedCategory]).includes(
        item.category_id ?? -2,
      )
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

  const clearFilters = () => {
    setSearch("");
    setType("");
    setActive("active");
    setSelectedCategory(null);
    setNested(false);
    setHasPrice(false);
    setMissingRequired(false);
  };

  const selectCategory = (id: number | null) => {
    setSelectedCategory(id);
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 1023px)").matches
    ) {
      setTreeOpen(false);
    }
  };

  const selectionLabel =
    selectedCategory === null
      ? "Все позиции"
      : selectedCategory === -1
        ? "Без категории"
        : categoryName(selectedCategory, categories);

  const renderTree = ({ onClose }: TreeListRenderApi) => (
    <TreePane
      title="Группы"
      count={categories.length}
      variant="dock"
      onClose={onClose}
      footer={
        <details>
          <summary className="cursor-pointer text-portal-body font-semibold text-portal-text">
            Редактировать группу
          </summary>
          {selectedCategory &&
            selectedCategory > 0 &&
            categories
              .filter((category) => category.id === selectedCategory)
              .map((category) => (
                <form
                  key={category.id}
                  action={updateNomenclatureCategory}
                  className="mt-portal-2 grid gap-portal-2"
                >
                  <input type="hidden" name="id" value={category.id} />
                  <Input
                    name="name"
                    defaultValue={category.name}
                    size="compact"
                    aria-label="Название группы"
                  />
                  <Input
                    name="code"
                    defaultValue={category.code}
                    size="compact"
                    aria-label="Код группы"
                  />
                  <Select
                    name="nomenclature_type"
                    defaultValue={category.nomenclature_type}
                    size="compact"
                    aria-label="Тип номенклатуры группы"
                  >
                    {typeOptions.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </Select>
                  <Input
                    name="parent_id"
                    defaultValue={category.parent_id ?? ""}
                    placeholder="ID родителя"
                    size="compact"
                    aria-label="ID родителя"
                  />
                  <Input
                    name="sort_order"
                    defaultValue={category.sort_order}
                    type="number"
                    min={0}
                    size="compact"
                    aria-label="Порядок сортировки"
                  />
                  <Checkbox
                    name="is_active"
                    value="true"
                    defaultChecked={category.is_active}
                    label="Активна"
                  />
                  <Button type="submit" variant="primary" size="compact">
                    Сохранить группу
                  </Button>
                </form>
              ))}
        </details>
      }
    >
      <CategoryTree
        categories={categories}
        selected={selectedCategory}
        onSelect={selectCategory}
        showInactive={active !== "active"}
      />
    </TreePane>
  );

  return (
    <PageLayout className="flex min-h-0 flex-1 flex-col">
      <PageToolbar
        start={
          <>
            <Button
              type="button"
              size="compact"
              className="w-full md:w-auto"
              onClick={() => setTreeOpen((open) => !open)}
              aria-pressed={treeOpen}
              aria-controls="tree-list-drawer"
            >
              <FolderTree size={16} aria-hidden="true" />
              Группы
            </Button>
            <p className="text-portal-body text-portal-muted">
              {selectionLabel}
              {" · "}найдено: {visibleItems.length}
            </p>
          </>
        }
        end={<NomenclatureSectionCreateMenu onSelect={setCreateKind} />}
      />

      <TreeListSplit
        renderTree={renderTree}
        treeOpen={treeOpen}
        onTreeOpenChange={setTreeOpen}
      >
        <TreeListContent>
          <FilterToolbar variant="strip" label="Фильтры номенклатуры">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Поиск по артикулу, названию и реквизитам"
              className="min-w-0 w-full md:min-w-56 md:flex-1"
              aria-label="Поиск номенклатуры"
            />
            <Select
              value={type}
              onChange={(event) =>
                setType(event.target.value as "" | NomenclatureType)
              }
              className="w-full md:w-auto"
              aria-label="Тип"
            >
              <option value="">Все типы</option>
              {typeOptions.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
            <Select
              value={active}
              onChange={(event) => setActive(event.target.value)}
              className="w-full md:w-auto"
              aria-label="Статус"
            >
              <option value="active">Активные</option>
              <option value="inactive">Неактивные</option>
              <option value="all">Все статусы</option>
            </Select>
            <Checkbox
              checked={nested}
              onChange={(event) => setNested(event.target.checked)}
              disabled={selectedCategory === null || selectedCategory === -1}
              label="Вложенные"
            />
            <Checkbox
              checked={hasPrice}
              onChange={(event) => setHasPrice(event.target.checked)}
              label="Есть цена"
            />
            <Checkbox
              checked={missingRequired}
              onChange={(event) => setMissingRequired(event.target.checked)}
              label="Есть незаполненные обязательные"
            />
            <Button
              type="button"
              onClick={clearFilters}
              size="compact"
              className="w-full md:w-auto"
            >
              Сбросить
            </Button>
          </FilterToolbar>

          <DataTableFrame className="rounded-none border-x-0 border-b-0 shadow-none">
            <DataTable minWidthClassName="min-w-[850px]">
              <DataTableHead>
                <tr>
                  <DataTableHeaderCell>Артикул</DataTableHeaderCell>
                  <DataTableHeaderCell>Наименование</DataTableHeaderCell>
                  <DataTableHeaderCell>Тип</DataTableHeaderCell>
                  <DataTableHeaderCell>Категория</DataTableHeaderCell>
                  <DataTableHeaderCell>Ед.</DataTableHeaderCell>
                  <DataTableHeaderCell>Цена</DataTableHeaderCell>
                  <DataTableHeaderCell>Статус</DataTableHeaderCell>
                  <DataTableHeaderCell>Действия</DataTableHeaderCell>
                </tr>
              </DataTableHead>
              <DataTableBody>
                {visibleItems.map((item) => (
                  <DataTableRow key={item.id}>
                    <DataTableCell className="font-medium">
                      {item.article}
                    </DataTableCell>
                    <DataTableCell>
                      <EntityLink
                        href={`/settings/catalogs/nomenclature/${item.id}`}
                      >
                        {item.name}
                      </EntityLink>
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
                    <DataTableCell>
                      {units.find((unit) => unit.id === item.storage_unit_id)
                        ?.symbol ?? item.unit}
                    </DataTableCell>
                    <DataTableCell>
                      {item.basePrice} {item.currency}
                    </DataTableCell>
                    <DataTableCell>
                      <StatusBadge
                        size="compact"
                        tone={item.is_active ? "success" : "neutral"}
                      >
                        {item.is_active ? "Активна" : "Архив"}
                      </StatusBadge>
                    </DataTableCell>
                    <DataTableCell>
                      <EntityLink
                        href={`/settings/catalogs/nomenclature/${item.id}`}
                        className="text-portal-caption"
                      >
                        Открыть
                      </EntityLink>
                    </DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
            {visibleItems.length === 0 ? (
              <div className="p-portal-6">
                <EmptyState
                  title="Ничего не найдено"
                  description="По заданным условиям ничего не найдено."
                  size="compact"
                />
              </div>
            ) : null}
          </DataTableFrame>
        </TreeListContent>
      </TreeListSplit>

      <NomenclatureCreatePanels
        kind={createKind}
        categories={categories}
        onClose={() => setCreateKind(null)}
      />
    </PageLayout>
  );
}
