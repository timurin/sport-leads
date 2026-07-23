"use client";

import {
  ExternalLink,
  History,
  MoreHorizontal,
  Package,
  Warehouse,
  X,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import type {
  Nomenclature,
  NomenclatureCategory,
  NomenclatureType,
  UnitOfMeasure,
} from "@/lib/nomenclature";

const TYPE_LABELS: Record<NomenclatureType, string> = {
  SERVICE: "Услуга",
  PRODUCT: "Продукция",
  GOODS: "Товар",
  MATERIAL: "Материал",
};

const TABS = [
  { id: "main", title: "Основное" },
  { id: "stock", title: "Остатки" },
  { id: "movements", title: "Движения" },
  { id: "suppliers", title: "Поставщики" },
  { id: "history", title: "История" },
] as const;

type TabId = (typeof TABS)[number]["id"];

type NomenclatureInspectorProps = {
  item: Nomenclature | null;
  categories: NomenclatureCategory[];
  units: UnitOfMeasure[];
  /** Primary/first media URL from nomenclature card, if any. */
  coverUrl?: string | null;
  onClose?: () => void;
};

function FieldValue({ value }: { value: string | null | undefined }) {
  if (value == null || value.trim() === "") {
    return <span className="text-slate-400">Не заполнено</span>;
  }
  return <>{value}</>;
}

function categoryLabel(
  item: Nomenclature,
  categories: NomenclatureCategory[],
): string {
  if (item.category_id != null) {
    return (
      categories.find((category) => category.id === item.category_id)?.name ??
      item.category
    );
  }
  return item.category || "Без категории";
}

function unitLabel(item: Nomenclature, units: UnitOfMeasure[]): string {
  return (
    units.find((unit) => unit.id === item.storage_unit_id)?.symbol ?? item.unit
  );
}

function formatInstant(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = String(date.getUTCFullYear());
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mi = String(date.getUTCMinutes()).padStart(2, "0");
  return `${dd}.${mm}.${yyyy} ${hh}:${mi}`;
}

/** Right-rail quick preview for nomenclature list (materials EntityInspector pattern). */
export function NomenclatureInspector({
  item,
  categories,
  units,
  coverUrl = null,
  onClose,
}: NomenclatureInspectorProps) {
  const [activeTab, setActiveTab] = useState<TabId>("main");

  if (!item) {
    return (
      <aside className="flex h-full min-h-0 w-full items-center justify-center border-l border-slate-200 bg-white px-8 text-center">
        <div>
          <Package size={38} className="mx-auto text-slate-300" />
          <h2 className="mt-4 text-lg font-semibold text-slate-800">
            Позиция не выбрана
          </h2>
          <p className="mt-2 max-w-xs text-sm leading-5 text-slate-500">
            Нажмите иконку статистики в действиях строки, чтобы открыть превью.
          </p>
        </div>
      </aside>
    );
  }

  const href = `/settings/catalogs/nomenclature/${item.id}`;
  const fields = [
    {
      id: "type",
      label: "Тип",
      value: TYPE_LABELS[item.nomenclature_type],
    },
    {
      id: "category",
      label: "Категория",
      value: categoryLabel(item, categories),
    },
    {
      id: "unit",
      label: "Ед. измерения",
      value: unitLabel(item, units),
    },
    {
      id: "price",
      label: "Базовая цена",
      value: `${item.basePrice} ${item.currency}`,
    },
    {
      id: "short_name",
      label: "Краткое название",
      value: item.short_name,
    },
    {
      id: "description",
      label: "Описание",
      value: item.description,
    },
    {
      id: "created_at",
      label: "Создано",
      value: formatInstant(item.created_at),
    },
    {
      id: "updated_at",
      label: "Изменено",
      value: formatInstant(item.updated_at),
    },
  ];

  return (
    <aside className="flex h-full min-h-0 w-full flex-col border-l border-slate-200 bg-white">
      <header className="shrink-0 border-b border-slate-200 px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div
              className={[
                "mb-2 inline-flex rounded-full px-2.5 py-1 text-xs font-medium",
                item.is_active
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-slate-100 text-slate-600",
              ].join(" ")}
            >
              {item.is_active ? "Активна" : "Архив"}
            </div>

            <h2 className="truncate text-xl font-semibold text-slate-950">
              {item.name}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {TYPE_LABELS[item.nomenclature_type]}
            </p>
          </div>

          <div className="flex shrink-0 gap-1">
            <button
              type="button"
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Ещё"
            >
              <MoreHorizontal size={19} />
            </button>
            {onClose ? (
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Закрыть превью"
              >
                <X size={19} />
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
          {coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={coverUrl}
              alt={item.name}
              className="mx-auto h-auto max-h-48 w-full object-contain"
            />
          ) : (
            <div
              className="flex h-40 items-center justify-center text-slate-300"
              aria-label="Нет фото"
            >
              <Package size={36} aria-hidden="true" />
            </div>
          )}
        </div>
      </header>

      <nav className="flex shrink-0 overflow-x-auto border-b border-slate-200 px-4">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={[
              "shrink-0 border-b-2 px-4 py-3 text-sm font-medium",
              activeTab === tab.id
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-slate-500 hover:text-slate-900",
            ].join(" ")}
          >
            {tab.title}
          </button>
        ))}
      </nav>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {activeTab === "main" ? (
          <div className="space-y-6 p-6">
            <section>
              <h3 className="text-sm font-semibold text-slate-900">
                Основная информация
              </h3>
              <dl className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200">
                {fields.map((field) => (
                  <div
                    key={field.id}
                    className="grid grid-cols-[150px_1fr] gap-4 px-4 py-3 text-sm"
                  >
                    <dt className="text-slate-500">{field.label}</dt>
                    <dd className="min-w-0 font-medium whitespace-pre-wrap text-slate-800">
                      <FieldValue value={field.value} />
                    </dd>
                  </div>
                ))}
              </dl>
            </section>

            <section className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Package size={17} />
                  Тип
                </div>
                <div className="mt-3 text-2xl font-semibold text-slate-950">
                  {TYPE_LABELS[item.nomenclature_type]}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <ExternalLink size={17} />
                  Карточка
                </div>
                <div className="mt-3 text-2xl font-semibold text-slate-950">
                  #{item.id}
                </div>
                <Link
                  href={href}
                  className="mt-2 inline-flex text-sm font-medium text-blue-700 hover:underline"
                >
                  Перейти →
                </Link>
              </div>
            </section>
          </div>
        ) : activeTab === "stock" ? (
          <div className="flex min-h-[420px] items-center justify-center p-8 text-center">
            <div>
              <Warehouse size={36} className="mx-auto text-slate-300" />
              <h3 className="mt-4 font-semibold text-slate-800">Остатки</h3>
              <p className="mt-2 max-w-sm text-sm text-slate-500">
                Остатки и склад не хранятся в карточке номенклатуры (ADR-012).
                Регистр склада — отдельный контур.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex min-h-[420px] items-center justify-center p-8 text-center">
            <div>
              <History size={36} className="mx-auto text-slate-300" />
              <h3 className="mt-4 font-semibold text-slate-800">
                {TABS.find((tab) => tab.id === activeTab)?.title}
              </h3>
              <p className="mt-2 text-sm text-slate-500">
                Содержимое вкладки доступно в полной карточке номенклатуры.
              </p>
              <Link
                href={href}
                className="mt-4 inline-flex text-sm font-medium text-blue-700 hover:underline"
              >
                Открыть карточку
              </Link>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
