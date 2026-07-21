"use client";

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

const fieldClass =
  "h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
const labelClass = "mb-2 block text-sm font-medium text-slate-700";

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
            <input name="article" required className={fieldClass} autoFocus />
          </Field>
          <Field label="Наименование" required>
            <input name="name" required className={fieldClass} />
          </Field>
          <Field label="Legacy категория" required>
            <input name="category" required className={fieldClass} />
          </Field>
          <Field label="Legacy ед. изм." required>
            <input name="unit" defaultValue="шт" required className={fieldClass} />
          </Field>
          <Field label="Тип">
            <select name="nomenclature_type" defaultValue="PRODUCT" className={fieldClass}>
              {typeOptions.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </Field>
          <Field label="Категория">
            <select name="category_id" defaultValue="" className={fieldClass}>
              <option value="">Без категории</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Базовая цена">
            <input name="base_price" defaultValue="0" type="number" min="0" step="0.01" className={fieldClass} />
          </Field>
          <Field label="Валюта">
            <input name="currency" defaultValue="RUB" maxLength={3} className={fieldClass} />
          </Field>
          <Field label="Краткое наименование">
            <input name="short_name" className={fieldClass} />
          </Field>
          <Field label="ID единицы хранения">
            <input name="storage_unit_id" className={fieldClass} />
          </Field>
          <Field label="Описание">
            <textarea name="description" rows={3} className={`${fieldClass} h-auto py-2`} />
          </Field>
        </CreateForm>
      ) : null}

      {kind === "category" ? (
        <CreateForm action={createNomenclatureCategory} onCancel={onClose}>
          <Field label="Название" required>
            <input name="name" required className={fieldClass} autoFocus />
          </Field>
          <Field label="Код" required>
            <input name="code" required pattern="[a-z0-9][a-z0-9_-]*" className={fieldClass} />
          </Field>
          <Field label="Тип номенклатуры">
            <select name="nomenclature_type" defaultValue="PRODUCT" className={fieldClass}>
              {typeOptions.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </Field>
          <Field label="Родительская группа">
            <select name="parent_id" defaultValue="" className={fieldClass}>
              <option value="">Корневая группа</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
          </Field>
        </CreateForm>
      ) : null}

      {kind === "unit" ? (
        <CreateForm action={createUnitOfMeasure} onCancel={onClose}>
          <Field label="Код" required>
            <input name="code" required pattern="[A-Z0-9][A-Z0-9_-]*" className={fieldClass} autoFocus />
          </Field>
          <Field label="Наименование" required>
            <input name="name" required className={fieldClass} />
          </Field>
          <Field label="Обозначение" required>
            <input name="symbol" required className={fieldClass} />
          </Field>
          <Field label="Категория">
            <select name="unit_category" defaultValue="QUANTITY" className={fieldClass}>
              {Object.entries(unitLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </Field>
          <Field label="Точность">
            <input name="precision" type="number" min="0" max="6" defaultValue="0" className={fieldClass} />
          </Field>
        </CreateForm>
      ) : null}

      {kind === "characteristic" ? (
        <CreateForm action={createCharacteristic} onCancel={onClose}>
          <Field label="Наименование" required>
            <input name="name" required className={fieldClass} autoFocus />
          </Field>
          <Field label="Код">
            <input name="code" pattern="[a-z0-9][a-z0-9_-]*" placeholder="Необязательно" className={fieldClass} />
          </Field>
          <Field label="Тип значения">
            <select name="kind" defaultValue="LIST" className={fieldClass}>
              <option value="LIST">Список</option>
              <option value="COLOR">Цвет</option>
            </select>
          </Field>
        </CreateForm>
      ) : null}
    </CreateDrawer>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className={labelClass}>
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </label>
      {children}
    </div>
  );
}

function CreateForm({
  action,
  onCancel,
  children,
}: {
  action: (formData: FormData) => void | Promise<void>;
  onCancel: () => void;
  children: React.ReactNode;
}) {
  return (
    <form action={action} className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-6">
        <div className="border-t border-slate-200 pt-5">
          <h3 className="mb-4 text-sm font-semibold text-slate-900">Основные данные</h3>
          <div className="space-y-4">{children}</div>
        </div>
      </div>
      <footer className="flex items-center justify-end gap-2 border-t border-slate-200 bg-white px-6 py-4">
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
