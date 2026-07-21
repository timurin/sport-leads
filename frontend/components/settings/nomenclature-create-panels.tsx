"use client";

import type { ReactNode } from "react";

import {
  createCharacteristic,
} from "@/app/(workspace)/settings/catalogs/nomenclature/characteristics-actions";
import {
  createNomenclature,
  createNomenclatureCategory,
  createUnitOfMeasure,
} from "@/app/(workspace)/settings/catalogs/nomenclature/nomenclature-actions";
import type { NomenclatureCreateKind } from "@/components/settings/nomenclature-section-create-menu";
import { Button } from "@/components/ui/button";
import { CreateDrawer } from "@/components/ui/create-drawer";
import {
  Field,
  Input,
  MoneyInput,
  Select,
  Textarea,
} from "@/components/ui/form-controls";
import type {
  NomenclatureCategory,
  NomenclatureType,
  UnitCategory,
} from "@/lib/nomenclature";

const typeLabels: Record<NomenclatureType, string> = {
  SERVICE: "Услуга",
  PRODUCT: "Продукция",
  GOODS: "Товар",
  MATERIAL: "Материал",
};
const typeOptions = Object.entries(typeLabels) as [NomenclatureType, string][];

const unitLabels: Record<UnitCategory, string> = {
  QUANTITY: "Количество",
  LENGTH: "Длина",
  AREA: "Площадь",
  MASS: "Масса",
  TIME: "Время",
  SERVICE: "Услуга",
};

const TITLES: Record<NomenclatureCreateKind, string> = {
  nomenclature: "Новая номенклатура",
  category: "Новая категория",
  unit: "Новая единица измерения",
  characteristic: "Новая характеристика",
};

type NomenclatureCreatePanelsProps = {
  kind: NomenclatureCreateKind | null;
  categories?: NomenclatureCategory[];
  onClose: () => void;
  variant?: "docked" | "overlay";
};

export function NomenclatureCreatePanels({
  kind,
  categories = [],
  onClose,
  variant = "docked",
}: NomenclatureCreatePanelsProps) {
  const open = kind != null;

  return (
    <CreateDrawer
      open={open}
      title={kind ? TITLES[kind] : ""}
      onClose={onClose}
      variant={variant}
    >
      {kind === "nomenclature" ? (
        <CreateForm action={createNomenclature} onCancel={onClose}>
          <Field label="Артикул" required>
            <Input name="article" required autoFocus />
          </Field>
          <Field label="Наименование" required>
            <Input name="name" required />
          </Field>
          <Field label="Legacy категория" required>
            <Input name="category" required />
          </Field>
          <Field label="Legacy ед. изм." required>
            <Input name="unit" defaultValue="шт" required />
          </Field>
          <Field label="Тип">
            <Select name="nomenclature_type" defaultValue="PRODUCT">
              {typeOptions.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Категория">
            <Select name="category_id" defaultValue="">
              <option value="">Без категории</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Базовая цена" help="Сумма и валюта">
            <MoneyInput
              name="base_price"
              currencyName="currency"
              defaultValue="0"
              defaultCurrency="RUB"
            />
          </Field>
          <Field label="Краткое наименование">
            <Input name="short_name" />
          </Field>
          <Field label="ID единицы хранения">
            <Input name="storage_unit_id" />
          </Field>
          <Field label="Описание">
            <Textarea name="description" rows={3} />
          </Field>
        </CreateForm>
      ) : null}

      {kind === "category" ? (
        <CreateForm action={createNomenclatureCategory} onCancel={onClose}>
          <Field label="Название" required>
            <Input name="name" required autoFocus />
          </Field>
          <Field label="Код" required>
            <Input name="code" required pattern="[a-z0-9][a-z0-9_-]*" />
          </Field>
          <Field label="Тип номенклатуры">
            <Select name="nomenclature_type" defaultValue="PRODUCT">
              {typeOptions.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Родительская группа">
            <Select name="parent_id" defaultValue="">
              <option value="">Корневая группа</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </Select>
          </Field>
        </CreateForm>
      ) : null}

      {kind === "unit" ? (
        <CreateForm action={createUnitOfMeasure} onCancel={onClose}>
          <Field label="Код" required>
            <Input name="code" required pattern="[A-Z0-9][A-Z0-9_-]*" autoFocus />
          </Field>
          <Field label="Наименование" required>
            <Input name="name" required />
          </Field>
          <Field label="Обозначение" required>
            <Input name="symbol" required />
          </Field>
          <Field label="Категория">
            <Select name="unit_category" defaultValue="QUANTITY">
              {Object.entries(unitLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Точность">
            <Input name="precision" type="number" min={0} max={6} defaultValue={0} />
          </Field>
        </CreateForm>
      ) : null}

      {kind === "characteristic" ? (
        <CreateForm action={createCharacteristic} onCancel={onClose}>
          <Field label="Наименование" required>
            <Input name="name" required autoFocus />
          </Field>
          <Field label="Код">
            <Input name="code" pattern="[a-z0-9][a-z0-9_-]*" placeholder="Необязательно" />
          </Field>
          <Field label="Тип значения">
            <Select name="kind" defaultValue="LIST">
              <option value="LIST">Список</option>
              <option value="COLOR">Цвет</option>
            </Select>
          </Field>
        </CreateForm>
      ) : null}
    </CreateDrawer>
  );
}

function CreateForm({
  action,
  onCancel,
  children,
}: {
  action: (formData: FormData) => void | Promise<void>;
  onCancel: () => void;
  children: ReactNode;
}) {
  return (
    <form action={action} className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 space-y-portal-5 overflow-y-auto p-portal-6">
        <div className="border-t border-portal-border pt-portal-5">
          <h3 className="mb-portal-4 text-portal-body font-semibold text-portal-text">
            Основные данные
          </h3>
          <div className="space-y-portal-4">{children}</div>
        </div>
      </div>
      <footer className="flex items-center justify-end gap-portal-2 border-t border-portal-border bg-portal-surface px-portal-6 py-portal-4">
        <Button type="button" onClick={onCancel}>
          Отмена
        </Button>
        <Button type="submit" variant="primary">
          Сохранить
        </Button>
      </footer>
    </form>
  );
}
