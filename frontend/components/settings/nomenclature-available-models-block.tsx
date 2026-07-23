"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ChevronDown, Plus, Save } from "lucide-react";

import {
  addNomenclatureAvailableModel,
  removeNomenclatureAvailableModel,
} from "@/app/(workspace)/settings/catalogs/nomenclature/nomenclature-actions";
import { Button, IconButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Select } from "@/components/ui/form-controls";
import { SectionCard } from "@/components/ui/section-card";
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
  className?: string;
};

/** PRODUCT whitelist «доступные модели лекал» (`6.1.11` / ADR-014). */
export function NomenclatureAvailableModelsBlock({
  nomenclatureId,
  links,
  activeModels,
  className = "",
}: NomenclatureAvailableModelsBlockProps) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(true);
  const [adding, setAdding] = useState(false);

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
    setAdding(false);
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
    <SectionCard
      title="Доступные лекала"
      size="compact"
      className={className}
      collapsed={!open}
      description={
        open
          ? "Whitelist моделей для выбора в заказе (ADR-014)."
          : undefined
      }
      actions={
        <div className="flex items-center gap-1">
          <IconButton
            label="Добавить лекало"
            title="Добавить"
            variant="secondary"
            disabled={busy}
            onClick={() => {
              setOpen(true);
              setAdding((value) => !value);
              setError(null);
            }}
          >
            <Plus className="size-4" aria-hidden="true" />
          </IconButton>
          <IconButton
            label="Сохранить"
            title="Сохранить"
            variant="primary"
            disabled={busy || !adding || !selectedId}
            onClick={() => void onAdd()}
          >
            <Save className="size-4" aria-hidden="true" />
          </IconButton>
          <IconButton
            label={open ? "Свернуть" : "Развернуть"}
            title={open ? "Свернуть" : "Развернуть"}
            variant="secondary"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            <ChevronDown
              className={[
                "size-4 transition-transform",
                open ? "rotate-180" : "",
              ].join(" ")}
              aria-hidden="true"
            />
          </IconButton>
        </div>
      }
    >
      {adding ? (
        <div className="mb-portal-4 flex flex-wrap items-end gap-2">
          <label className="min-w-[180px] flex-1">
            <span className="mb-1 block text-portal-caption font-medium text-portal-muted">
              Модель
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
                  : "Выберите или найдите модель"}
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
            variant="secondary"
            size="compact"
            disabled={busy}
            onClick={() => {
              setAdding(false);
              setSelectedId("");
              setError(null);
            }}
          >
            Отмена
          </Button>
        </div>
      ) : null}

      {error ? (
        <p className="mb-portal-3 text-portal-body text-portal-danger" role="alert">
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
        <ul className="divide-y divide-portal-border rounded-portal-md border border-portal-border">
          {links.map((link) => (
            <li
              key={link.id}
              className="flex flex-wrap items-center justify-between gap-3 px-portal-3 py-portal-2"
            >
              <div className="min-w-0">
                <Link
                  href={`/settings/catalogs/product-models/${link.product_model_id}`}
                  className="font-semibold text-portal-primary hover:underline"
                >
                  {link.article} — {link.name}
                </Link>
                <p className="mt-0.5 text-portal-caption text-portal-muted">
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
    </SectionCard>
  );
}
