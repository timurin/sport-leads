"use client";

import {
  ExternalLink,
  History,
  Layers,
  MoreHorizontal,
  X,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Input, Select, Textarea } from "@/components/ui/form-controls";
import {
  PRODUCT_MODEL_SIZE_TYPE_LABELS,
  PRODUCT_MODEL_STATUS_LABELS,
  productModelCoverUrl,
  type ProductModel,
  type ProductModelSizeType,
} from "@/lib/product-models";

const TABS = [
  { id: "main", title: "Основное" },
  { id: "versions", title: "Версии" },
  { id: "links", title: "Связи" },
  { id: "history", title: "История" },
] as const;

type TabId = (typeof TABS)[number]["id"];

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

export type ProductModelRequisitesDraft = {
  article: string;
  name: string;
  size_type: ProductModelSizeType;
  description: string;
};

type ProductModelInspectorProps = {
  model: ProductModel | null;
  editing?: boolean;
  draft?: ProductModelRequisitesDraft | null;
  onDraftChange?: (draft: ProductModelRequisitesDraft) => void;
  onClose?: () => void;
};

function statusPillClass(status: ProductModel["status"]): string {
  if (status === "active") return "bg-emerald-50 text-emerald-700";
  if (status === "draft") return "bg-amber-50 text-amber-700";
  return "bg-slate-100 text-slate-600";
}

function FieldValue({ value }: { value: string | null | undefined }) {
  if (value == null || value.trim() === "") {
    return <span className="text-slate-400">Не заполнено</span>;
  }
  return <>{value}</>;
}

/** Right-rail preview for product-models list (materials EntityInspector pattern). */
export function ProductModelInspector({
  model,
  editing = false,
  draft = null,
  onDraftChange,
  onClose,
}: ProductModelInspectorProps) {
  const [activeTab, setActiveTab] = useState<TabId>("main");
  const visibleTab: TabId = editing ? "main" : activeTab;

  if (!model) {
    return (
      <aside className="flex h-full min-h-[600px] w-full items-center justify-center border-l border-slate-200 bg-white px-8 text-center">
        <div>
          <Layers size={38} className="mx-auto text-slate-300" />
          <h2 className="mt-4 text-lg font-semibold text-slate-800">
            Модель не выбрана
          </h2>
          <p className="mt-2 max-w-xs text-sm leading-5 text-slate-500">
            Выберите запись в списке, чтобы открыть превью карточки.
          </p>
        </div>
      </aside>
    );
  }

  const href = `/settings/catalogs/product-models/${model.id}`;
  const coverSrc = productModelCoverUrl(model.cover_image_url);
  const sizeTypeLocked = model.status !== "draft";
  const display = draft ?? {
    article: model.article,
    name: model.name,
    size_type: model.size_type,
    description: model.description ?? "",
  };

  const fields = [
    { id: "article", label: "Артикул", value: model.article },
    {
      id: "size_type",
      label: "Тип размерной сетки",
      value: PRODUCT_MODEL_SIZE_TYPE_LABELS[model.size_type],
    },
    {
      id: "status",
      label: "Статус",
      value: PRODUCT_MODEL_STATUS_LABELS[model.status],
    },
    {
      id: "description",
      label: "Описание",
      value: model.description?.trim() || null,
    },
    {
      id: "created_at",
      label: "Создано",
      value: formatInstant(model.created_at),
    },
    {
      id: "updated_at",
      label: "Изменено",
      value: formatInstant(model.updated_at),
    },
  ];

  return (
    <aside className="flex h-full min-h-[600px] w-full flex-col border-l border-slate-200 bg-white">
      <header className="border-b border-slate-200 px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div
              className={[
                "mb-2 inline-flex rounded-full px-2.5 py-1 text-xs font-medium",
                statusPillClass(model.status),
              ].join(" ")}
            >
              {PRODUCT_MODEL_STATUS_LABELS[model.status]}
            </div>

            <h2 className="truncate text-xl font-semibold text-slate-950">
              {editing ? display.name || model.name : model.name}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {(editing ? display.article : model.article) || model.article} ·{" "}
              {PRODUCT_MODEL_SIZE_TYPE_LABELS[
                editing ? display.size_type : model.size_type
              ]}
            </p>
            {editing ? (
              <p className="mt-2 text-xs font-medium text-blue-700">
                Редактирование основных реквизитов
              </p>
            ) : null}
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

        {coverSrc ? (
          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={coverSrc}
              alt={`Обложка: ${model.name}`}
              className="mx-auto h-auto max-h-40 w-full object-contain"
            />
          </div>
        ) : null}
      </header>

      <nav className="flex overflow-x-auto border-b border-slate-200 px-4">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={[
              "shrink-0 border-b-2 px-4 py-3 text-sm font-medium",
              visibleTab === tab.id
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-slate-500 hover:text-slate-900",
            ].join(" ")}
          >
            {tab.title}
          </button>
        ))}
      </nav>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {visibleTab === "main" ? (
          <div className="space-y-6 p-6">
            <section>
              <h3 className="text-sm font-semibold text-slate-900">
                Основная информация
              </h3>

              {editing && draft && onDraftChange ? (
                <div className="mt-4 grid gap-3 rounded-xl border border-slate-200 p-4">
                  <label className="grid gap-1 text-sm">
                    <span className="text-slate-500">Артикул</span>
                    <Input
                      value={draft.article}
                      onChange={(event) =>
                        onDraftChange({ ...draft, article: event.target.value })
                      }
                      aria-label="Артикул"
                    />
                  </label>
                  <label className="grid gap-1 text-sm">
                    <span className="text-slate-500">Название</span>
                    <Input
                      value={draft.name}
                      onChange={(event) =>
                        onDraftChange({ ...draft, name: event.target.value })
                      }
                      aria-label="Название"
                    />
                  </label>
                  <label className="grid gap-1 text-sm">
                    <span className="text-slate-500">Тип размерной сетки</span>
                    <Select
                      value={draft.size_type}
                      disabled={sizeTypeLocked}
                      onChange={(event) =>
                        onDraftChange({
                          ...draft,
                          size_type: event.target.value as ProductModelSizeType,
                        })
                      }
                      aria-label="Тип размерной сетки"
                    >
                      {Object.entries(PRODUCT_MODEL_SIZE_TYPE_LABELS).map(
                        ([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ),
                      )}
                    </Select>
                    {sizeTypeLocked ? (
                      <span className="text-xs text-slate-400">
                        Тип сетки меняется только у черновика
                      </span>
                    ) : null}
                  </label>
                  <label className="grid gap-1 text-sm">
                    <span className="text-slate-500">Описание</span>
                    <Textarea
                      value={draft.description}
                      onChange={(event) =>
                        onDraftChange({
                          ...draft,
                          description: event.target.value,
                        })
                      }
                      rows={4}
                      aria-label="Описание"
                    />
                  </label>
                </div>
              ) : (
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
              )}
            </section>

            <section className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Layers size={17} />
                  Статус
                </div>
                <div className="mt-3 text-2xl font-semibold text-slate-950">
                  {PRODUCT_MODEL_STATUS_LABELS[model.status]}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <ExternalLink size={17} />
                  Карточка
                </div>
                <div className="mt-3 text-2xl font-semibold text-slate-950">
                  #{model.id}
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
        ) : (
          <div className="flex min-h-[420px] items-center justify-center p-8 text-center">
            <div>
              <History size={36} className="mx-auto text-slate-300" />
              <h3 className="mt-4 font-semibold text-slate-800">
                {TABS.find((tab) => tab.id === visibleTab)?.title}
              </h3>
              <p className="mt-2 text-sm text-slate-500">
                Содержимое вкладки доступно в полной карточке модели.
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
