"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import {
  createSupplierPriceRecord,
  deleteSupplierPriceRecord,
  saveSupplierRecord,
} from "@/app/(workspace)/purchases/suppliers/supplier-actions";
import { SimpleEntityCard } from "@/components/entity/simple-entity-card";
import { Button } from "@/components/ui/button";
import { EntityHeader } from "@/components/ui/entity-header";
import {
  Checkbox,
  Field,
  Input,
  Select,
  Textarea,
} from "@/components/ui/form-controls";
import { InlineAlert } from "@/components/ui/inline-alert";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  toSupplierDraft,
  type SupplierDetailView,
  type SupplierDraft,
} from "@/lib/purchases/suppliers";

export type NomenclatureOption = {
  id: number;
  name: string;
};

type Props = {
  supplier: SupplierDetailView;
  nomenclatureOptions: NomenclatureOption[];
};

/** PT-05 supplier card + prices (`DS-PT-05`). */
export function SupplierCard({ supplier, nomenclatureOptions }: Props) {
  const router = useRouter();
  const [draft, setDraft] = useState<SupplierDraft>(() => toSupplierDraft(supplier));
  const [error, setError] = useState<string | null>(null);
  const [priceError, setPriceError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [nomenclatureId, setNomenclatureId] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [comment, setComment] = useState("");

  const usedIds = useMemo(
    () => new Set(supplier.prices.map((price) => price.nomenclatureId)),
    [supplier.prices],
  );
  const availableOptions = nomenclatureOptions.filter(
    (item) => !usedIds.has(item.id),
  );

  const setField = <K extends keyof SupplierDraft>(
    key: K,
    value: SupplierDraft[K],
  ) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  return (
    <SimpleEntityCard
      header={
        <EntityHeader
          eyebrow={
            <Link
              href="/purchases/suppliers"
              className="text-portal-primary hover:underline"
            >
              Поставщики
            </Link>
          }
          title={supplier.name}
          description="Поставщик закупок (ADR-033). Цены — на номенклатуру."
          status={
            <StatusBadge
              tone={supplier.isActive ? "success" : "neutral"}
              size="compact"
            >
              {supplier.isActive ? "Активен" : "Архив"}
            </StatusBadge>
          }
        />
      }
    >
      <SectionCard
        title="Реквизиты"
        description="Master-карточка поставщика. Банковские счета — вне MVP."
        size="compact"
      >
        {error ? (
          <InlineAlert tone="danger" size="compact">
            {error}
          </InlineAlert>
        ) : null}
        <form
          className="grid min-w-0 gap-portal-3 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            startTransition(async () => {
              setError(null);
              const result = await saveSupplierRecord(supplier.id, draft);
              if (!result.ok) {
                setError(result.message);
                return;
              }
              router.refresh();
            });
          }}
        >
          <Field label="Наименование" htmlFor="supplier-name" required className="sm:col-span-2">
            <Input
              id="supplier-name"
              value={draft.name}
              onChange={(event) => setField("name", event.target.value)}
            />
          </Field>
          <Field label="Код" htmlFor="supplier-code">
            <Input
              id="supplier-code"
              value={draft.code}
              onChange={(event) => setField("code", event.target.value)}
            />
          </Field>
          <Field label="ИНН" htmlFor="supplier-inn">
            <Input
              id="supplier-inn"
              value={draft.inn}
              onChange={(event) => setField("inn", event.target.value)}
            />
          </Field>
          <Field label="КПП" htmlFor="supplier-kpp">
            <Input
              id="supplier-kpp"
              value={draft.kpp}
              onChange={(event) => setField("kpp", event.target.value)}
            />
          </Field>
          <Field label="Телефон" htmlFor="supplier-phone">
            <Input
              id="supplier-phone"
              value={draft.phone}
              onChange={(event) => setField("phone", event.target.value)}
            />
          </Field>
          <Field label="Email" htmlFor="supplier-email">
            <Input
              id="supplier-email"
              value={draft.email}
              onChange={(event) => setField("email", event.target.value)}
            />
          </Field>
          <Field label="Юр. адрес" htmlFor="supplier-address" className="sm:col-span-2">
            <Input
              id="supplier-address"
              value={draft.legalAddress}
              onChange={(event) => setField("legalAddress", event.target.value)}
            />
          </Field>
          <Field label="Заметки" htmlFor="supplier-notes" className="sm:col-span-2">
            <Textarea
              id="supplier-notes"
              value={draft.notes}
              onChange={(event) => setField("notes", event.target.value)}
              rows={3}
            />
          </Field>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <Checkbox
              checked={draft.isActive}
              onChange={(event) => setField("isActive", event.target.checked)}
            />
            Активен
          </label>
          <div className="sm:col-span-2">
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? "Сохранение…" : "Сохранить"}
            </Button>
          </div>
        </form>
      </SectionCard>

      <SectionCard
        title="Цены поставщика"
        description="Закупочная цена на позицию номенклатуры (RUB). Не цена продажи."
        size="compact"
      >
        {priceError ? (
          <InlineAlert tone="danger" size="compact">
            {priceError}
          </InlineAlert>
        ) : null}

        {supplier.prices.length === 0 ? (
          <p className="mb-portal-3 text-portal-caption text-portal-muted">
            Цен пока нет.
          </p>
        ) : (
          <ul className="mb-portal-3 divide-y divide-portal-border rounded-lg border border-portal-border">
            {supplier.prices.map((price) => (
              <li
                key={price.id}
                className="flex flex-wrap items-center justify-between gap-2 px-portal-3 py-portal-2 text-sm"
              >
                <div className="min-w-0">
                  <div className="font-medium text-portal-text">
                    {price.nomenclatureName}
                  </div>
                  <div className="tabular-nums text-portal-muted">
                    {price.unitPrice} {price.currency}
                    {price.comment ? ` · ${price.comment}` : ""}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="compact"
                  disabled={pending}
                  onClick={() => {
                    startTransition(async () => {
                      setPriceError(null);
                      const result = await deleteSupplierPriceRecord(
                        supplier.id,
                        price.id,
                      );
                      if (!result.ok) {
                        setPriceError(result.message);
                        return;
                      }
                      router.refresh();
                    });
                  }}
                >
                  Удалить
                </Button>
              </li>
            ))}
          </ul>
        )}

        <form
          className="grid min-w-0 gap-portal-3 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            startTransition(async () => {
              setPriceError(null);
              const result = await createSupplierPriceRecord(supplier.id, {
                nomenclatureId: Number(nomenclatureId),
                unitPrice,
                comment,
              });
              if (!result.ok) {
                setPriceError(result.message);
                return;
              }
              setNomenclatureId("");
              setUnitPrice("");
              setComment("");
              router.refresh();
            });
          }}
        >
          <Field label="Номенклатура" htmlFor="supplier-price-nom" required className="sm:col-span-2">
            <Select
              id="supplier-price-nom"
              value={nomenclatureId}
              onChange={(event) => setNomenclatureId(event.target.value)}
              disabled={availableOptions.length === 0}
            >
              <option value="">
                {availableOptions.length === 0
                  ? "Нет доступных позиций"
                  : "Выберите…"}
              </option>
              {availableOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Цена, RUB" htmlFor="supplier-price-value" required>
            <Input
              id="supplier-price-value"
              inputMode="decimal"
              value={unitPrice}
              onChange={(event) => setUnitPrice(event.target.value)}
            />
          </Field>
          <Field label="Комментарий" htmlFor="supplier-price-comment">
            <Input
              id="supplier-price-comment"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
            />
          </Field>
          <div className="sm:col-span-2">
            <Button
              type="submit"
              variant="secondary"
              disabled={pending || availableOptions.length === 0}
            >
              Добавить цену
            </Button>
          </div>
        </form>
      </SectionCard>
    </SimpleEntityCard>
  );
}
