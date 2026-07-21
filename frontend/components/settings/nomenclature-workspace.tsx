"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { updateNomenclatureCategory } from "@/app/(workspace)/settings/catalogs/nomenclature/nomenclature-actions";
import { NomenclatureCreatePanels } from "@/components/settings/nomenclature-create-panels";
import {
  NomenclatureSectionCreateMenu,
  type NomenclatureCreateKind,
} from "@/components/settings/nomenclature-section-create-menu";
import { PageToolbar } from "@/components/ui/page-header";
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
  const [createKind, setCreateKind] = useState<NomenclatureCreateKind | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [type, setType] = useState<"" | NomenclatureType>("");
  const [active, setActive] = useState("active");
  const [nested, setNested] = useState(false);
  const [hasPrice, setHasPrice] = useState(false);
  const [missingRequired, setMissingRequired] = useState(false);

  useEffect(() => {
    const create = searchParams.get("create");
    if (
      create === "nomenclature" ||
      create === "category" ||
      create === "unit" ||
      create === "characteristic"
    ) {
      setCreateKind(create);
    }
  }, [searchParams]);
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
    <div className="min-w-0 flex-1 space-y-4 overflow-auto p-6"><div className="grid gap-4 lg:grid-cols-[240px_1fr]"><aside className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"><div className="mb-2 flex items-center justify-between"><h3 className="font-semibold">Группы</h3><span className="text-xs text-slate-400">{categories.length}</span></div><CategoryTree categories={categories} selected={selectedCategory} onSelect={setSelectedCategory} showInactive={active !== "active"}/><details className="mt-4 border-t pt-3"><summary className="cursor-pointer text-sm font-semibold">Редактировать группу</summary>{selectedCategory && selectedCategory > 0 && categories.filter((category) => category.id === selectedCategory).map((category) => <form key={category.id} action={updateNomenclatureCategory} className="mt-2 grid gap-2"><input type="hidden" name="id" value={category.id}/><input name="name" defaultValue={category.name} className="rounded border px-2 py-1 text-sm"/><input name="code" defaultValue={category.code} className="rounded border px-2 py-1 text-sm"/><select name="nomenclature_type" defaultValue={category.nomenclature_type} className="rounded border px-2 py-1 text-sm">{typeOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><input name="parent_id" defaultValue={category.parent_id ?? ""} placeholder="ID родителя" className="rounded border px-2 py-1 text-sm"/><input name="sort_order" defaultValue={category.sort_order} type="number" min="0" className="rounded border px-2 py-1 text-sm"/><label className="flex items-center gap-2 text-xs"><input type="checkbox" name="is_active" value="true" defaultChecked={category.is_active}/> Активна</label><button className="rounded bg-slate-800 px-2 py-1 text-xs font-semibold text-white">Сохранить группу</button></form>)}</details></aside><main className="min-w-0 space-y-3"><div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Поиск по артикулу, названию и реквизитам" className="min-w-56 flex-1 rounded border px-3 py-2 text-sm"/><select value={type} onChange={(event) => setType(event.target.value as "" | NomenclatureType)} className="rounded border px-3 py-2 text-sm"><option value="">Все типы</option>{typeOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><select value={active} onChange={(event) => setActive(event.target.value)} className="rounded border px-3 py-2 text-sm"><option value="active">Активные</option><option value="inactive">Неактивные</option><option value="all">Все статусы</option></select><label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={nested} onChange={(event) => setNested(event.target.checked)} disabled={selectedCategory === null || selectedCategory === -1}/>Вложенные</label><label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={hasPrice} onChange={(event) => setHasPrice(event.target.checked)}/>Есть цена</label><label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={missingRequired} onChange={(event) => setMissingRequired(event.target.checked)}/>Есть незаполненные обязательные</label><button type="button" onClick={clearFilters} className="rounded border border-slate-300 px-3 py-2 text-sm">Сбросить</button></div><div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm"><table className="min-w-full text-left text-sm"><thead className="border-b bg-slate-50 text-slate-500"><tr><th className="px-4 py-3">Артикул</th><th className="px-4 py-3">Наименование</th><th className="px-4 py-3">Тип</th><th className="px-4 py-3">Категория</th><th className="px-4 py-3">Ед.</th><th className="px-4 py-3">Цена</th><th className="px-4 py-3">Статус</th><th className="px-4 py-3">Действия</th></tr></thead><tbody>{visibleItems.map((item) => <tr key={item.id} className="border-b last:border-0"><td className="px-4 py-3 font-medium">{item.article}</td><td className="px-4 py-3"><Link className="font-semibold text-blue-700 hover:underline" href={`/settings/catalogs/nomenclature/${item.id}`}>{item.name}</Link>{item.short_name && <div className="text-xs text-slate-500">{item.short_name}</div>}</td><td className="px-4 py-3">{typeLabels[item.nomenclature_type]}</td><td className="px-4 py-3">{categoryName(item.category_id, categories)}</td><td className="px-4 py-3">{units.find((unit) => unit.id === item.storage_unit_id)?.symbol ?? item.unit}</td><td className="px-4 py-3">{item.basePrice} {item.currency}</td><td className="px-4 py-3">{item.is_active ? "Активна" : "Архив"}</td><td className="px-4 py-3"><Link href={`/settings/catalogs/nomenclature/${item.id}`} className="text-xs font-semibold text-blue-700">Открыть</Link></td></tr>)}</tbody></table>{visibleItems.length === 0 && <div className="p-8 text-center text-sm text-slate-500">По заданным условиям ничего не найдено.</div>}</div></main></div></div>
    <NomenclatureCreatePanels kind={createKind} categories={categories} onClose={() => setCreateKind(null)} />
    </div></div>;
}
