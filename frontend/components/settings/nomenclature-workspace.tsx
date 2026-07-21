"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { updateNomenclatureCategory } from "@/app/(workspace)/settings/catalogs/nomenclature/nomenclature-actions";
import { NomenclatureCreatePanels } from "@/components/settings/nomenclature-create-panels";
import {
  NomenclatureSectionCreateMenu,
  parseNomenclatureCreateKind,
  type NomenclatureCreateKind,
} from "@/components/settings/nomenclature-section-create-menu";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { EntityLink } from "@/components/ui/entity-link";
import { FilterToolbar } from "@/components/ui/filter-toolbar";
import { PageToolbar } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableFrame,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
} from "@/components/ui/data-table";
import { controlClassName } from "@/lib/design-system/control-styles";
import type { Nomenclature, NomenclatureCategory, NomenclatureFieldValue, NomenclatureType, UnitOfMeasure } from "@/lib/nomenclature";

const typeLabels: Record<NomenclatureType, string> = { SERVICE: "Услуга", PRODUCT: "Продукция", GOODS: "Товар", MATERIAL: "Материал" };
const typeOptions = Object.entries(typeLabels) as [NomenclatureType, string][];

function categoryName(categoryId: number | null, categories: NomenclatureCategory[]) { return categories.find((category) => category.id === categoryId)?.name ?? "Без категории"; }

function CategoryTree({ categories, selected, onSelect, showInactive }: { categories: NomenclatureCategory[]; selected: number | null; onSelect: (id: number | null) => void; showInactive: boolean }) {
  const children = (parentId: number | null) => categories.filter((category) => category.parent_id === parentId && (category.is_active || showInactive));
  const branch = (parentId: number | null, depth = 0): ReactNode => children(parentId).map((category) => <div key={category.id}><button type="button" onClick={() => onSelect(category.id)} className={`block w-full rounded px-2 py-1 text-left text-sm ${selected === category.id ? "bg-blue-50 font-semibold text-blue-800" : "hover:bg-slate-50"}`} style={{ paddingLeft: `${8 + depth * 14}px` }}>{category.name}<span className="ml-1 text-xs text-slate-400">({category.nomenclature_type})</span></button>{branch(category.id, depth + 1)}</div>);
  return <div className="space-y-1"><button type="button" onClick={() => onSelect(null)} className={`w-full rounded px-2 py-1 text-left text-sm ${selected === null ? "bg-blue-50 font-semibold text-blue-800" : "hover:bg-slate-50"}`}>Все позиции</button><button type="button" onClick={() => onSelect(-1)} className={`w-full rounded px-2 py-1 text-left text-sm ${selected === -1 ? "bg-blue-50 font-semibold text-blue-800" : "hover:bg-slate-50"}`}>Без категории</button>{branch(null)}</div>;
}

export function NomenclatureWorkspace({ items, categories, units, fieldValues }: { items: Nomenclature[]; categories: NomenclatureCategory[]; units: UnitOfMeasure[]; fieldValues: Record<number, NomenclatureFieldValue[]> }) {
  const searchParams = useSearchParams();
  const [createKind, setCreateKind] = useState<NomenclatureCreateKind | null>(
    () => parseNomenclatureCreateKind(searchParams.get("create")),
  );
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [type, setType] = useState<"" | NomenclatureType>("");
  const [active, setActive] = useState("active");
  const [nested, setNested] = useState(false);
  const [hasPrice, setHasPrice] = useState(false);
  const [missingRequired, setMissingRequired] = useState(false);

  const descendants = useMemo(() => { if (selectedCategory === null || selectedCategory === -1) return []; const ids = new Set([selectedCategory]); let changed = true; while (changed) { changed = false; for (const category of categories) if (category.parent_id !== null && ids.has(category.parent_id) && !ids.has(category.id)) { ids.add(category.id); changed = true; } } return [...ids]; }, [categories, selectedCategory]);
  const visibleItems = items.filter((item) => { const values = fieldValues[item.id] ?? []; const text = `${item.article} ${item.name} ${item.short_name ?? ""} ${values.map((field) => String(field.value ?? "")).join(" ")}`.toLowerCase(); if (search && !text.includes(search.toLowerCase())) return false; if (type && item.nomenclature_type !== type) return false; if (active === "active" && !item.is_active || active === "inactive" && item.is_active) return false; if (selectedCategory === -1 ? item.category_id !== null : selectedCategory !== null && !(nested ? descendants : [selectedCategory]).includes(item.category_id ?? -2)) return false; if (hasPrice && Number(item.base_price) <= 0) return false; if (missingRequired && !values.some((field) => field.is_required && (field.value === null || field.value === ""))) return false; return true; });
  const clearFilters = () => { setSearch(""); setType(""); setActive("active"); setSelectedCategory(null); setNested(false); setHasPrice(false); setMissingRequired(false); };
  return <div className="flex min-h-0 min-w-0 flex-1 flex-col">
    <PageToolbar
      start={
        <p className="text-sm text-slate-500">
          {selectedCategory === null ? "Все позиции" : selectedCategory === -1 ? "Без категории" : categoryName(selectedCategory, categories)}
          {" · "}найдено: {visibleItems.length}
        </p>
      }
      end={
        <NomenclatureSectionCreateMenu onSelect={setCreateKind} />
      }
    />
    <div className="relative flex min-h-0 flex-1 overflow-hidden">
    <div className="min-w-0 flex-1 space-y-4 overflow-auto p-6"><div className="grid gap-4 lg:grid-cols-[240px_1fr]"><aside className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"><div className="mb-2 flex items-center justify-between"><h3 className="font-semibold">Группы</h3><span className="text-xs text-slate-400">{categories.length}</span></div><CategoryTree categories={categories} selected={selectedCategory} onSelect={setSelectedCategory} showInactive={active !== "active"}/><details className="mt-4 border-t pt-3"><summary className="cursor-pointer text-sm font-semibold">Редактировать группу</summary>{selectedCategory && selectedCategory > 0 && categories.filter((category) => category.id === selectedCategory).map((category) => <form key={category.id} action={updateNomenclatureCategory} className="mt-2 grid gap-2"><input type="hidden" name="id" value={category.id}/><input name="name" defaultValue={category.name} className={controlClassName({ size: "compact" })}/><input name="code" defaultValue={category.code} className={controlClassName({ size: "compact" })}/><select name="nomenclature_type" defaultValue={category.nomenclature_type} className={controlClassName({ size: "compact" })}>{typeOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><input name="parent_id" defaultValue={category.parent_id ?? ""} placeholder="ID родителя" className={controlClassName({ size: "compact" })}/><input name="sort_order" defaultValue={category.sort_order} type="number" min="0" className={controlClassName({ size: "compact" })}/><label className="flex items-center gap-2 text-xs"><input type="checkbox" name="is_active" value="true" defaultChecked={category.is_active}/> Активна</label><button className="rounded bg-slate-800 px-2 py-1 text-xs font-semibold text-white">Сохранить группу</button></form>)}</details></aside><main className="min-w-0 space-y-3"><FilterToolbar variant="card"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Поиск по артикулу, названию и реквизитам" className={controlClassName({ className: "min-w-56 flex-1" })}/><select value={type} onChange={(event) => setType(event.target.value as "" | NomenclatureType)} className={controlClassName()}><option value="">Все типы</option>{typeOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><select value={active} onChange={(event) => setActive(event.target.value)} className={controlClassName()}><option value="active">Активные</option><option value="inactive">Неактивные</option><option value="all">Все статусы</option></select><label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={nested} onChange={(event) => setNested(event.target.checked)} disabled={selectedCategory === null || selectedCategory === -1}/>Вложенные</label><label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={hasPrice} onChange={(event) => setHasPrice(event.target.checked)}/>Есть цена</label><label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={missingRequired} onChange={(event) => setMissingRequired(event.target.checked)}/>Есть незаполненные обязательные</label><Button type="button" onClick={clearFilters} size="compact">Сбросить</Button></FilterToolbar><DataTableFrame><DataTable><DataTableHead><tr><DataTableHeaderCell>Артикул</DataTableHeaderCell><DataTableHeaderCell>Наименование</DataTableHeaderCell><DataTableHeaderCell>Тип</DataTableHeaderCell><DataTableHeaderCell>Категория</DataTableHeaderCell><DataTableHeaderCell>Ед.</DataTableHeaderCell><DataTableHeaderCell>Цена</DataTableHeaderCell><DataTableHeaderCell>Статус</DataTableHeaderCell><DataTableHeaderCell>Действия</DataTableHeaderCell></tr></DataTableHead><DataTableBody>{visibleItems.map((item) => <DataTableRow key={item.id}><DataTableCell className="font-medium">{item.article}</DataTableCell><DataTableCell><EntityLink href={`/settings/catalogs/nomenclature/${item.id}`}>{item.name}</EntityLink>{item.short_name && <div className="text-xs text-portal-muted">{item.short_name}</div>}</DataTableCell><DataTableCell>{typeLabels[item.nomenclature_type]}</DataTableCell><DataTableCell>{categoryName(item.category_id, categories)}</DataTableCell><DataTableCell>{units.find((unit) => unit.id === item.storage_unit_id)?.symbol ?? item.unit}</DataTableCell><DataTableCell>{item.basePrice} {item.currency}</DataTableCell><DataTableCell><StatusBadge size="compact" tone={item.is_active ? "success" : "neutral"}>{item.is_active ? "Активна" : "Архив"}</StatusBadge></DataTableCell><DataTableCell><EntityLink href={`/settings/catalogs/nomenclature/${item.id}`} className="text-xs">Открыть</EntityLink></DataTableCell></DataTableRow>)}</DataTableBody></DataTable>{visibleItems.length === 0 ? <div className="p-portal-6"><EmptyState title="Ничего не найдено" description="По заданным условиям ничего не найдено." size="compact" /></div> : null}</DataTableFrame></main></div></div>
    <NomenclatureCreatePanels kind={createKind} categories={categories} onClose={() => setCreateKind(null)} />
    </div></div>;
}
