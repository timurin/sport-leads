"use client";

import { useRef, useState, useTransition } from "react";

import { createOrderItem, deleteOrderItem, updateOrderItem } from "@/app/(workspace)/sales/orders/[orderId]/order-item-actions";
import { nomenclatureLabel, type Nomenclature } from "@/lib/nomenclature";
import type { SalesOrderItem } from "@/lib/sales/order-details";

function NomenclaturePicker({
  items,
  value,
  onChange,
}: {
  items: Nomenclature[];
  value: number | null;
  onChange: (item: Nomenclature | null) => void;
}) {
  const selected = items.find((item) => item.id === value) ?? null;
  const [query, setQuery] = useState(selected ? nomenclatureLabel(selected) : "");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const matches = items.filter((item) => item.is_active && `${item.article} ${item.name}`.toLowerCase().includes(query.toLowerCase())).slice(0, 8);
  const options = selected && !selected.is_active && !matches.some((item) => item.id === selected.id) ? [selected, ...matches] : matches;

  function choose(item: Nomenclature | null) {
    onChange(item);
    setQuery(item ? nomenclatureLabel(item) : "");
    setOpen(false);
    setActiveIndex(0);
  }

  return (
    <div className="relative sm:col-span-2">
      <input type="hidden" name="nomenclature_id" value={value ?? ""} />
      <input
        value={query}
        onChange={(event) => { setQuery(event.target.value); onChange(null); setOpen(true); setActiveIndex(0); }}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") { event.preventDefault(); setActiveIndex((index) => Math.min(index + 1, options.length - 1)); }
          if (event.key === "ArrowUp") { event.preventDefault(); setActiveIndex((index) => Math.max(index - 1, 0)); }
          if (event.key === "Enter" && options[activeIndex]) { event.preventDefault(); choose(options[activeIndex]); }
          if (event.key === "Escape") setOpen(false);
        }}
        placeholder="Номенклатура: артикул или название"
        aria-label="Номенклатура"
        className="w-full rounded border px-2 py-1"
      />
      {open ? (
        <div className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded border border-portal-border bg-portal-surface p-1 shadow-lg">
          {options.length === 0 ? <p className="px-2 py-1 text-xs text-portal-muted">Активная номенклатура не найдена</p> : options.map((item, index) => (
            <button
              key={item.id}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(item)}
              className={`block w-full rounded px-2 py-1 text-left text-xs ${index === activeIndex ? "bg-blue-50 text-blue-800" : "text-portal-text"}`}
            >
              {nomenclatureLabel(item)}{item.is_active ? "" : " (архив)"}
            </button>
          ))}
          {value !== null ? <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => choose(null)} className="mt-1 w-full border-t px-2 py-1 text-left text-xs text-portal-muted">Очистить связь</button> : null}
        </div>
      ) : null}
    </div>
  );
}

function priceValue(value: string): string {
  return value.replace(/[^0-9,.-]/g, "").replace(",", ".");
}

function ItemForm({
  item,
  nomenclature,
  variantsByNomenclature,
  isPending,
  onSubmit,
  onDelete,
}: {
  item: SalesOrderItem;
  nomenclature: Nomenclature[];
  variantsByNomenclature: Record<number, import("@/lib/nomenclature").NomenclatureVariant[]>;
  isPending: boolean;
  onSubmit: (formData: FormData) => void;
  onDelete: () => void;
}) {
  const [selectedId, setSelectedId] = useState<number | null>(item.nomenclatureId);
  const [snapshotName, setSnapshotName] = useState(item.snapshotName);
  const [unitPrice, setUnitPrice] = useState(priceValue(item.unitPrice));
  const selected = nomenclature.find((entry) => entry.id === selectedId) ?? null;
  const variants = selected ? variantsByNomenclature[selected.id] ?? [] : [];

  function selectNomenclature(entry: Nomenclature | null) {
    setSelectedId(entry?.id ?? null);
    if (entry) {
      setSnapshotName(entry.name);
      setUnitPrice(entry.basePrice);
    }
  }

  return (
    <form action={onSubmit} className="grid gap-2 rounded border border-portal-border p-3 text-sm sm:grid-cols-[1fr_1fr_1.3fr_1fr_auto_auto] sm:items-center">
      <NomenclaturePicker items={nomenclature} value={selectedId} onChange={selectNomenclature} />
      <select name="nomenclature_variant_id" defaultValue={item.nomenclatureVariantId ?? ""} className="rounded border px-2 py-1"><option value="">Без варианта</option>{variants.filter((variant) => variant.is_active || variant.id === item.nomenclatureVariantId).map((variant) => <option key={variant.id} value={variant.id}>{variant.article} — {variant.name}{variant.is_active ? "" : " (архив)"}</option>)}</select>
      <input name="snapshot_name" value={snapshotName} onChange={(event) => setSnapshotName(event.target.value)} required className="rounded border px-2 py-1" />
      <input name="size_range" defaultValue={item.sizeRange} placeholder="Размеры" className="rounded border px-2 py-1" />
      <input name="personalization" defaultValue={item.personalization} placeholder="Персонализация" className="rounded border px-2 py-1" />
      <input name="color" defaultValue={item.color} placeholder="Цвет" className="rounded border px-2 py-1" />
      <input name="quantity" defaultValue={item.quantity} required type="number" min="0.001" step="0.001" className="w-24 rounded border px-2 py-1" />
      <input name="unit_price" value={unitPrice} onChange={(event) => setUnitPrice(event.target.value)} required type="number" min="0" step="0.01" className="w-28 rounded border px-2 py-1" />
      <input name="discount_percent" defaultValue={item.discountPercent} type="number" min="0" max="100" step="0.01" placeholder="Скидка %" className="w-24 rounded border px-2 py-1" />
      <div className="text-xs text-portal-muted"><div>Исходная: {item.grossAmount}</div><div>Скидка: {item.discountAmount}</div><div className="font-semibold text-portal-text">Итого: {item.lineAmount}</div></div>
      <div className="flex gap-2"><button type="submit" disabled={isPending} className="text-xs font-semibold text-blue-700">Сохранить</button><button type="button" disabled={isPending} onClick={onDelete} className="text-xs font-semibold text-red-700">Удалить</button></div>
      {selected ? <p className="text-xs text-portal-muted sm:col-span-2">Связано: {nomenclatureLabel(selected)}{item.variantSnapshots.length ? ` · ${item.variantSnapshots.map((snapshot) => `${snapshot.characteristic_name}: ${snapshot.option_label}`).join(", ")}` : ""}. Снимок изменится только после явного выбора.</p> : null}
    </form>
  );
}

export function SalesOrderItems({ orderId, items, nomenclature, variantsByNomenclature }: { orderId: string; items: SalesOrderItem[]; nomenclature: Nomenclature[]; variantsByNomenclature: Record<number, import("@/lib/nomenclature").NomenclatureVariant[]> }) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [createNomenclatureId, setCreateNomenclatureId] = useState<number | null>(null);
  const [createSnapshotName, setCreateSnapshotName] = useState("");
  const [createUnitPrice, setCreateUnitPrice] = useState("");

  function submitCreate(formData: FormData) {
    startTransition(async () => {
      const result = await createOrderItem(orderId, formData);
      setMessage(result.message);
      if (result.ok) { formRef.current?.reset(); setCreateNomenclatureId(null); setCreateSnapshotName(""); setCreateUnitPrice(""); }
    });
  }

  function submitDelete(itemId: number) { startTransition(async () => setMessage((await deleteOrderItem(orderId, itemId)).message)); }
  function submitUpdate(itemId: number, formData: FormData) { startTransition(async () => setMessage((await updateOrderItem(orderId, itemId, formData)).message)); }
  function selectCreateNomenclature(entry: Nomenclature | null) {
    setCreateNomenclatureId(entry?.id ?? null);
    if (entry) { setCreateSnapshotName(entry.name); setCreateUnitPrice(entry.basePrice); }
  }

  return (
    <section className="mt-4 rounded-[var(--portal-radius-md)] border border-portal-border bg-portal-surface p-4">
      <h2 className="text-base font-semibold text-portal-text">Товарные позиции</h2>
      {items.length === 0 ? <p className="mt-2 text-sm text-portal-muted">Позиции пока не добавлены.</p> : <div className="mt-3 space-y-2">{items.map((item) => <ItemForm key={item.id} item={item} nomenclature={nomenclature} variantsByNomenclature={variantsByNomenclature} isPending={isPending} onSubmit={(formData) => submitUpdate(item.id, formData)} onDelete={() => submitDelete(item.id)} />)}</div>}
      <form ref={formRef} action={submitCreate} className="mt-4 grid gap-2 sm:grid-cols-6">
        <NomenclaturePicker items={nomenclature} value={createNomenclatureId} onChange={selectCreateNomenclature} />
        <select name="nomenclature_variant_id" className="rounded border px-3 py-2 text-sm"><option value="">Без варианта</option>{(createNomenclatureId ? variantsByNomenclature[createNomenclatureId] ?? [] : []).filter((variant) => variant.is_active).map((variant) => <option key={variant.id} value={variant.id}>{variant.article} — {variant.name}</option>)}</select>
        <input name="snapshot_name" value={createSnapshotName} onChange={(event) => setCreateSnapshotName(event.target.value)} required placeholder="Наименование" className="rounded border px-3 py-2 text-sm" />
        <input name="size_range" placeholder="Размеры" className="rounded border px-3 py-2 text-sm" />
        <input name="personalization" placeholder="Персонализация" className="rounded border px-3 py-2 text-sm" />
        <input name="color" placeholder="Цвет" className="rounded border px-3 py-2 text-sm" />
        <input name="quantity" required type="number" min="0.001" step="0.001" placeholder="Количество" className="rounded border px-3 py-2 text-sm" />
        <input name="unit_price" value={createUnitPrice} onChange={(event) => setCreateUnitPrice(event.target.value)} required type="number" min="0" step="0.01" placeholder="Цена" className="rounded border px-3 py-2 text-sm" />
        <input name="discount_percent" type="number" min="0" max="100" step="0.01" placeholder="Скидка %" className="rounded border px-3 py-2 text-sm" />
        <button type="submit" disabled={isPending} className="rounded bg-blue-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Добавить позицию</button>
      </form>
      {message ? <p className="mt-2 text-sm text-portal-muted" role="status">{message}</p> : null}
    </section>
  );
}
