"use client";

import { useRef, useState, useTransition } from "react";

import { createOrderItem, deleteOrderItem, updateOrderItem } from "@/app/(workspace)/sales/orders/[orderId]/order-item-actions";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form-controls";
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
  const matches = items
    .filter((item) =>
      item.is_active
      && `${item.article} ${item.name}`.toLowerCase().includes(query.toLowerCase()),
    )
    .slice(0, 8);
  const options =
    selected && !selected.is_active && !matches.some((item) => item.id === selected.id)
      ? [selected, ...matches]
      : matches;

  function choose(item: Nomenclature | null) {
    onChange(item);
    setQuery(item ? nomenclatureLabel(item) : "");
    setOpen(false);
    setActiveIndex(0);
  }

  return (
    <div className="relative sm:col-span-2">
      <input type="hidden" name="nomenclature_id" value={value ?? ""} />
      <Input
        size="compact"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          onChange(null);
          setOpen(true);
          setActiveIndex(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActiveIndex((index) => Math.min(index + 1, options.length - 1));
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveIndex((index) => Math.max(index - 1, 0));
          }
          if (event.key === "Enter" && options[activeIndex]) {
            event.preventDefault();
            choose(options[activeIndex]);
          }
          if (event.key === "Escape") {
            setOpen(false);
          }
        }}
        placeholder="Номенклатура: артикул или название"
        aria-label="Номенклатура"
      />
      {open ? (
        <div className="absolute z-portal-dropdown mt-1 max-h-56 w-full overflow-auto rounded-portal-md border border-portal-border bg-portal-surface p-portal-1 shadow-portal-overlay">
          {options.length === 0 ? (
            <p className="px-portal-2 py-portal-1 text-portal-meta text-portal-muted">
              Активная номенклатура не найдена
            </p>
          ) : (
            options.map((item, index) => (
              <button
                key={item.id}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(item)}
                className={[
                  "block w-full rounded-portal-sm px-portal-2 py-portal-1 text-left text-portal-meta",
                  index === activeIndex
                    ? "bg-portal-primary-soft text-portal-primary"
                    : "text-portal-text hover:bg-portal-state-hover",
                ].join(" ")}
              >
                {nomenclatureLabel(item)}
                {item.is_active ? "" : " (архив)"}
              </button>
            ))
          )}
          {value !== null ? (
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(null)}
              className="mt-portal-1 w-full border-t border-portal-border px-portal-2 py-portal-1 text-left text-portal-meta text-portal-muted"
            >
              Очистить связь
            </button>
          ) : null}
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
    <form
      action={onSubmit}
      className="grid gap-portal-2 rounded-portal-md border border-portal-border p-portal-3 text-portal-body sm:grid-cols-[1fr_1fr_1.3fr_1fr_auto_auto] sm:items-center"
    >
      <NomenclaturePicker
        items={nomenclature}
        value={selectedId}
        onChange={selectNomenclature}
      />
      <Select
        name="nomenclature_variant_id"
        size="compact"
        defaultValue={item.nomenclatureVariantId ?? ""}
      >
        <option value="">Без варианта</option>
        {variants
          .filter((variant) => variant.is_active || variant.id === item.nomenclatureVariantId)
          .map((variant) => (
            <option key={variant.id} value={variant.id}>
              {variant.article} — {variant.name}
              {variant.is_active ? "" : " (архив)"}
            </option>
          ))}
      </Select>
      <Input
        name="snapshot_name"
        size="compact"
        value={snapshotName}
        onChange={(event) => setSnapshotName(event.target.value)}
        required
      />
      <Input
        name="size_range"
        size="compact"
        defaultValue={item.sizeRange}
        placeholder="Размеры"
      />
      <Input
        name="personalization"
        size="compact"
        defaultValue={item.personalization}
        placeholder="Персонализация"
      />
      <Input
        name="color"
        size="compact"
        defaultValue={item.color}
        placeholder="Цвет"
      />
      <Input
        name="quantity"
        size="compact"
        className="w-24"
        defaultValue={item.quantity}
        required
        type="number"
        min="0.001"
        step="0.001"
      />
      <Input
        name="unit_price"
        size="compact"
        className="w-28"
        value={unitPrice}
        onChange={(event) => setUnitPrice(event.target.value)}
        required
        type="number"
        min="0"
        step="0.01"
      />
      <Input
        name="discount_percent"
        size="compact"
        className="w-24"
        defaultValue={item.discountPercent}
        type="number"
        min="0"
        max="100"
        step="0.01"
        placeholder="Скидка %"
      />
      <div className="text-portal-meta text-portal-muted">
        <div>Исходная: {item.grossAmount}</div>
        <div>Скидка: {item.discountAmount}</div>
        <div className="font-semibold text-portal-text">Итого: {item.lineAmount}</div>
      </div>
      <div className="flex gap-portal-2">
        <Button type="submit" variant="ghost" size="compact" disabled={isPending}>
          Сохранить
        </Button>
        <Button
          type="button"
          variant="danger"
          size="compact"
          disabled={isPending}
          onClick={onDelete}
        >
          Удалить
        </Button>
      </div>
      {selected ? (
        <p className="text-portal-meta text-portal-muted sm:col-span-2">
          Связано: {nomenclatureLabel(selected)}
          {item.variantSnapshots.length
            ? ` · ${item.variantSnapshots
                .map(
                  (snapshot) =>
                    `${snapshot.characteristic_name}: ${snapshot.option_label}`,
                )
                .join(", ")}`
            : ""}
          . Снимок изменится только после явного выбора.
        </p>
      ) : null}
    </form>
  );
}

export function SalesOrderItems({
  orderId,
  items,
  nomenclature,
  variantsByNomenclature,
}: {
  orderId: string;
  items: SalesOrderItem[];
  nomenclature: Nomenclature[];
  variantsByNomenclature: Record<
    number,
    import("@/lib/nomenclature").NomenclatureVariant[]
  >;
}) {
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
      if (result.ok) {
        formRef.current?.reset();
        setCreateNomenclatureId(null);
        setCreateSnapshotName("");
        setCreateUnitPrice("");
      }
    });
  }

  function submitDelete(itemId: number) {
    startTransition(async () =>
      setMessage((await deleteOrderItem(orderId, itemId)).message),
    );
  }

  function submitUpdate(itemId: number, formData: FormData) {
    startTransition(async () =>
      setMessage((await updateOrderItem(orderId, itemId, formData)).message),
    );
  }

  function selectCreateNomenclature(entry: Nomenclature | null) {
    setCreateNomenclatureId(entry?.id ?? null);
    if (entry) {
      setCreateSnapshotName(entry.name);
      setCreateUnitPrice(entry.basePrice);
    }
  }

  const createVariants = createNomenclatureId
    ? variantsByNomenclature[createNomenclatureId] ?? []
    : [];

  return (
    <section className="mt-portal-4 rounded-portal-md border border-portal-border bg-portal-surface p-portal-4">
      <h2 className="text-portal-section font-semibold text-portal-text">
        Товарные позиции
      </h2>
      {items.length === 0 ? (
        <p className="mt-portal-2 text-portal-body text-portal-muted">
          Позиции пока не добавлены.
        </p>
      ) : (
        <div className="mt-portal-3 space-y-portal-2">
          {items.map((item) => (
            <ItemForm
              key={item.id}
              item={item}
              nomenclature={nomenclature}
              variantsByNomenclature={variantsByNomenclature}
              isPending={isPending}
              onSubmit={(formData) => submitUpdate(item.id, formData)}
              onDelete={() => submitDelete(item.id)}
            />
          ))}
        </div>
      )}
      <form
        ref={formRef}
        action={submitCreate}
        className="mt-portal-4 grid gap-portal-2 sm:grid-cols-6"
      >
        <NomenclaturePicker
          items={nomenclature}
          value={createNomenclatureId}
          onChange={selectCreateNomenclature}
        />
        <Select name="nomenclature_variant_id" defaultValue="">
          <option value="">Без варианта</option>
          {createVariants
            .filter((variant) => variant.is_active)
            .map((variant) => (
              <option key={variant.id} value={variant.id}>
                {variant.article} — {variant.name}
              </option>
            ))}
        </Select>
        <Input
          name="snapshot_name"
          value={createSnapshotName}
          onChange={(event) => setCreateSnapshotName(event.target.value)}
          required
          placeholder="Наименование"
        />
        <Input name="size_range" placeholder="Размеры" />
        <Input name="personalization" placeholder="Персонализация" />
        <Input name="color" placeholder="Цвет" />
        <Input
          name="quantity"
          required
          type="number"
          min="0.001"
          step="0.001"
          placeholder="Количество"
        />
        <Input
          name="unit_price"
          value={createUnitPrice}
          onChange={(event) => setCreateUnitPrice(event.target.value)}
          required
          type="number"
          min="0"
          step="0.01"
          placeholder="Цена"
        />
        <Input
          name="discount_percent"
          type="number"
          min="0"
          max="100"
          step="0.01"
          placeholder="Скидка %"
        />
        <Button type="submit" variant="primary" disabled={isPending}>
          Добавить позицию
        </Button>
      </form>
      {message ? (
        <p className="mt-portal-2 text-portal-body text-portal-muted" role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}
