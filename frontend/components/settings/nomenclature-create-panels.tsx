"use client";

import { useMemo, useState, type ReactNode } from "react";

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
  Checkbox,
  Field,
  Input,
  MoneyInput,
  Select,
  Textarea,
} from "@/components/ui/form-controls";
import type {
  CharacteristicKind,
  NomenclatureCategory,
  NomenclatureType,
  UnitCategory,
  UnitOfMeasure,
} from "@/lib/nomenclature";
import { buildCategoryTreeRows, nextChildSortOrder } from "@/lib/nomenclature-category-tree";

function actionErrorMessage(caught: unknown): string {
  return caught instanceof Error ? caught.message : "Не удалось сохранить.";
}

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

const characteristicKindLabels: Record<CharacteristicKind, string> = {
  STRING: "Строка",
  TEXT: "Текст",
  INTEGER: "Целое число",
  DECIMAL: "Десятичное число",
  BOOLEAN: "Да/нет",
  DATE: "Дата",
  LIST: "Список",
  MULTI_SELECT: "Несколько вариантов",
  COLOR: "Цвет",
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
  units?: UnitOfMeasure[];
  onClose: () => void;
  /** Default fullscreen so create sits above the list (ADR-013 / 4.7.9). */
  variant?: "docked" | "overlay" | "fullscreen";
  /** Prefill parent when creating a category under a selected node (`4.9.3`). */
  categoryDefaultParentId?: number | null;
};

export function NomenclatureCreatePanels({
  kind,
  categories = [],
  units = [],
  onClose,
  variant = "fullscreen",
  categoryDefaultParentId = null,
}: NomenclatureCreatePanelsProps) {
  const open = kind != null;
  const categoryTreeRows = useMemo(
    () => buildCategoryTreeRows(categories.filter((row) => row.is_active)),
    [categories],
  );
  const categoryParentId =
    kind === "category" && categoryDefaultParentId != null
      ? String(categoryDefaultParentId)
      : "";
  const categorySortOrder =
    kind === "category"
      ? nextChildSortOrder(
          categories,
          categoryDefaultParentId != null ? categoryDefaultParentId : null,
        )
      : 0;

  return (
    <CreateDrawer
      open={open}
      title={kind ? TITLES[kind] : ""}
      description={
        kind === "nomenclature"
          ? "Заполните обязательные поля."
          : kind === "category" && categoryDefaultParentId != null
            ? "Дочерняя категория под выбранным узлом."
            : undefined
      }
      onClose={onClose}
      variant={variant}
    >
      {kind === "nomenclature" ? (
        <NomenclatureCreateForm
          categories={categories}
          units={units}
          onCancel={onClose}
        />
      ) : null}

      {kind === "category" ? (
        <CreateForm action={createNomenclatureCategory} onCancel={onClose}>
          <input type="hidden" name="sort_order" value={categorySortOrder} />
          <Field label="Название" required>
            <Input name="name" required autoFocus />
          </Field>
          <Field label="Код" required>
            <Input name="code" required pattern="[a-z0-9][a-z0-9_-]*" />
          </Field>
          <Field label="Тип номенклатуры">
            <Select name="nomenclature_type" defaultValue="PRODUCT">
              {typeOptions.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Родительская группа">
            <Select name="parent_id" defaultValue={categoryParentId} key={categoryParentId}>
              <option value="">Корневая группа</option>
              {categoryTreeRows.map((row) => (
                <option key={row.category.id} value={row.category.id}>
                  {row.outline} — {row.category.name}
                </option>
              ))}
            </Select>
          </Field>
        </CreateForm>
      ) : null}

      {kind === "unit" ? (
        <CreateForm action={createUnitOfMeasure} onCancel={onClose}>
          <Field
            label="Код"
            required
            help="Только латиница A–Z, цифры, _ и -: например PCS, KG, M2 (не «шт»)"
          >
            <Input
              name="code"
              required
              pattern="[A-Z0-9][A-Z0-9_-]*"
              title="Латиница A-Z, цифры, _ и -"
              placeholder="PCS"
              autoFocus
              style={{ textTransform: "uppercase" }}
              onInput={(event) => {
                const target = event.currentTarget;
                const next = target.value.toUpperCase();
                if (target.value !== next) target.value = next;
              }}
            />
          </Field>
          <Field label="Наименование" required>
            <Input name="name" required />
          </Field>
          <Field label="Обозначение" required>
            <Input name="symbol" required placeholder="шт." />
          </Field>
          <Field label="Категория">
            <Select name="unit_category" defaultValue="QUANTITY">
              {Object.entries(unitLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Точность">
            <Input
              name="precision"
              type="number"
              min={0}
              max={6}
              defaultValue={0}
            />
          </Field>
        </CreateForm>
      ) : null}

      {kind === "characteristic" ? (
        <CreateForm action={createCharacteristic} onCancel={onClose}>
          <Field label="Наименование" required>
            <Input name="name" required autoFocus />
          </Field>
          <Field label="Код">
            <Input
              name="code"
              pattern="[a-z0-9][a-z0-9_-]*"
              placeholder="Необязательно"
            />
          </Field>
          <Field label="Тип">
            <Select name="kind" defaultValue="LIST">
              {Object.entries(characteristicKindLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Checkbox
            name="is_variant_dimension"
            value="true"
            label="Измерение варианта (цвет, размер…)"
          />
        </CreateForm>
      ) : null}
    </CreateDrawer>
  );
}

/**
 * Create layout (owner 4.7.10):
 * Block 1 — 50/50:
 *   left: name, base price
 *   right: type, category, storage unit
 * Block 2 — optional: short name, description (unchanged)
 * Legacy category/unit strings are derived (hidden), not edited.
 */
function NomenclatureCreateForm({
  categories,
  units,
  onCancel,
}: {
  categories: NomenclatureCategory[];
  units: UnitOfMeasure[];
  onCancel: () => void;
}) {
  const [nomenclatureType, setNomenclatureType] =
    useState<NomenclatureType>("PRODUCT");
  const [categoryId, setCategoryId] = useState("");
  const [storageUnitId, setStorageUnitId] = useState("");

  const activeCategoryRows = useMemo(
    () =>
      buildCategoryTreeRows(
        categories.filter((category) => category.is_active),
      ),
    [categories],
  );

  const activeUnits = useMemo(
    () => units.filter((unit) => unit.is_active),
    [units],
  );

  const legacyCategory =
    categories.find((category) => String(category.id) === categoryId)?.name ??
    "Без категории";

  const legacyUnit =
    activeUnits.find((unit) => String(unit.id) === storageUnitId)?.symbol ??
    "шт";

  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(formData: FormData) {
    setPending(true);
    setError("");
    try {
      await createNomenclature(formData);
      onCancel();
    } catch (caught) {
      setError(actionErrorMessage(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <form action={submit} className="flex h-full min-h-0 flex-col">
      <input type="hidden" name="category" value={legacyCategory} />
      <input type="hidden" name="unit" value={legacyUnit} />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-5xl space-y-portal-6 p-portal-6">
          {error ? (
            <p className="rounded-portal-md border border-portal-danger/30 bg-portal-danger/5 px-portal-3 py-portal-2 text-portal-caption text-portal-danger">
              {error}
            </p>
          ) : null}
          <FormSection>
            <div className="grid gap-portal-4 md:grid-cols-2 md:items-start">
              <div className="space-y-portal-4">
                <Field label="Наименование" required>
                  <Input name="name" required autoFocus disabled={pending} />
                </Field>
                <Field label="Базовая цена" help="Сумма и валюта">
                  <MoneyInput
                    name="base_price"
                    currencyName="currency"
                    defaultValue="0"
                    defaultCurrency="RUB"
                    disabled={pending}
                  />
                </Field>
              </div>
              <div className="space-y-portal-4">
                <Field label="Тип">
                  <Select
                    name="nomenclature_type"
                    value={nomenclatureType}
                    disabled={pending}
                    onChange={(event) => {
                      const next = event.target.value as NomenclatureType;
                      setNomenclatureType(next);
                    }}
                  >
                    {typeOptions.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Категория">
                  <Select
                    name="category_id"
                    value={categoryId}
                    disabled={pending}
                    onChange={(event) => setCategoryId(event.target.value)}
                  >
                    <option value="">Без категории</option>
                    {activeCategoryRows.map((row) => (
                      <option key={row.category.id} value={row.category.id}>
                        {row.outline} — {row.category.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Ед. хранения">
                  <Select
                    name="storage_unit_id"
                    value={storageUnitId}
                    disabled={pending}
                    onChange={(event) => setStorageUnitId(event.target.value)}
                  >
                    <option value="">Не выбрана</option>
                    {activeUnits.map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {unit.name} ({unit.symbol})
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            </div>
          </FormSection>

          <FormSection title="Дополнительно">
            <div className="grid gap-portal-4">
              <Field label="Наименование для печати">
                <Input name="short_name" disabled={pending} />
              </Field>
              <Field label="Описание">
                <Textarea name="description" rows={4} disabled={pending} />
              </Field>
            </div>
          </FormSection>
        </div>
      </div>

      <footer className="flex shrink-0 items-center justify-end gap-portal-2 border-t border-portal-border bg-portal-surface px-portal-6 py-portal-4">
        <Button type="button" onClick={onCancel} disabled={pending}>
          Отмена
        </Button>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Сохранение…" : "Сохранить"}
        </Button>
      </footer>
    </form>
  );
}

function FormSection({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-portal-lg border border-portal-border bg-portal-surface p-portal-5">
      {title ? (
        <h3 className="mb-portal-4 text-portal-body font-semibold text-portal-text">
          {title}
        </h3>
      ) : null}
      {children}
    </section>
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
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(formData: FormData) {
    setPending(true);
    setError("");
    try {
      await action(formData);
      onCancel();
    } catch (caught) {
      setError(actionErrorMessage(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <form action={submit} className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 space-y-portal-5 overflow-y-auto p-portal-6">
        <div className="mx-auto w-full max-w-xl space-y-portal-4">
          {error ? (
            <p className="rounded-portal-md border border-portal-danger/30 bg-portal-danger/5 px-portal-3 py-portal-2 text-portal-caption text-portal-danger">
              {error}
            </p>
          ) : null}
          <fieldset disabled={pending} className="min-w-0 space-y-portal-4 border-0 p-0">
            {children}
          </fieldset>
        </div>
      </div>
      <footer className="flex shrink-0 items-center justify-end gap-portal-2 border-t border-portal-border bg-portal-surface px-portal-6 py-portal-4">
        <Button type="button" onClick={onCancel} disabled={pending}>
          Отмена
        </Button>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Сохранение…" : "Сохранить"}
        </Button>
      </footer>
    </form>
  );
}
