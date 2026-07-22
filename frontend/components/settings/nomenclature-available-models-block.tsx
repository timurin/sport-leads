"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import {
  addNomenclatureAvailableModel,
  removeNomenclatureAvailableModel,
} from "@/app/(workspace)/settings/catalogs/nomenclature/nomenclature-actions";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Select } from "@/components/ui/form-controls";
import { StatusBadge } from "@/components/ui/status-badge";
import type { NomenclatureAvailableModel } from "@/lib/nomenclature";
import {
  PRODUCT_MODEL_SIZE_TYPE_LABELS,
  PRODUCT_MODEL_STATUS_LABELS,
  productModelStatusTone,
  type ProductModel,
} from "@/lib/product-models";

type NomenclatureAvailableModelsBlockProps = {
  nomenclatureId: number;
  links: NomenclatureAvailableModel[];
  activeModels: ProductModel[];
};

/** PRODUCT whitelist «доступные модели лекал» (`6.1.11` / ADR-014). */
export function NomenclatureAvailableModelsBlock({
  nomenclatureId,
  links,
  activeModels,
}: NomenclatureAvailableModelsBlockProps) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const linkedIds = useMemo(
    () => new Set(links.map((link) => link.product_model_id)),
    [links],
  );
  const options = useMemo(
    () => activeModels.filter((model) => !linkedIds.has(model.id)),
    [activeModels, linkedIds],
  );

  const onAdd = async () => {
    const productModelId = Number(selectedId);
    if (!Number.isFinite(productModelId) || productModelId <= 0) {
      setError("Выберите модель");
      return;
    }
    setBusy(true);
    setError(null);
    const result = await addNomenclatureAvailableModel(
      nomenclatureId,
      productModelId,
    );
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setSelectedId("");
    router.refresh();
  };

  const onRemove = async (productModelId: number) => {
    setBusy(true);
    setError(null);
    const result = await removeNomenclatureAvailableModel(
      nomenclatureId,
      productModelId,
    );
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    router.refresh();
  };

  return (
    <section className="rounded-[14px] border border-[#dfe5ef] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,.05),0_4px_14px_rgba(16,24,40,.04)]">
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[17px] font-semibold text-[#101828]">
            Доступные модели лекал
          </h2>
          <p className="mt-1 text-sm text-[#667085]">
            Whitelist моделей для выбора в заказе (ADR-014). Пустой список — модель
            опциональна.
          </p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-2">
        <label className="min-w-[220px] flex-1">
          <span className="mb-1 block text-xs font-medium text-[#667085]">
            Добавить активную модель
          </span>
          <Select
            value={selectedId}
            disabled={busy || options.length === 0}
            onChange={(event) => {
              setSelectedId(event.target.value);
              setError(null);
            }}
            aria-label="Модель для whitelist"
          >
            <option value="">
              {options.length === 0
                ? "Нет доступных активных моделей"
                : "Выберите модель"}
            </option>
            {options.map((model) => (
              <option key={model.id} value={model.id}>
                {model.article} — {model.name} (
                {PRODUCT_MODEL_SIZE_TYPE_LABELS[model.size_type]})
              </option>
            ))}
          </Select>
        </label>
        <Button
          type="button"
          variant="primary"
          size="compact"
          disabled={busy || !selectedId}
          onClick={() => void onAdd()}
        >
          Добавить
        </Button>
      </div>

      {error ? (
        <p className="mb-3 text-sm text-[#b42318]" role="alert">
          {error}
        </p>
      ) : null}

      {links.length === 0 ? (
        <EmptyState
          title="Список пуст"
          description="Пока модели не привязаны — в заказе выбор модели остаётся опциональным."
          size="compact"
        />
      ) : (
        <ul className="divide-y divide-[#eef2f6] rounded-lg border border-[#eef2f6]">
          {links.map((link) => (
            <li
              key={link.id}
              className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5"
            >
              <div className="min-w-0">
                <Link
                  href={`/settings/catalogs/product-models/${link.product_model_id}`}
                  className="font-semibold text-[#175cd3] hover:underline"
                >
                  {link.article} — {link.name}
                </Link>
                <p className="mt-0.5 text-xs text-[#667085]">
                  {PRODUCT_MODEL_SIZE_TYPE_LABELS[link.size_type]}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge
                  size="compact"
                  tone={productModelStatusTone(link.status)}
                >
                  {PRODUCT_MODEL_STATUS_LABELS[link.status]}
                </StatusBadge>
                <Button
                  type="button"
                  size="compact"
                  disabled={busy}
                  onClick={() => void onRemove(link.product_model_id)}
                >
                  Убрать
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
