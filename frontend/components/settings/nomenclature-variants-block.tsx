"use client";

import { useState, useTransition } from "react";
import { Archive, RotateCcw, Save } from "lucide-react";

import {
  toggleNomenclatureVariant,
  updateNomenclatureVariantCommercial,
} from "@/app/(workspace)/settings/catalogs/nomenclature/characteristics-actions";
import { Button, IconButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/form-controls";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import type { NomenclatureVariant } from "@/lib/nomenclature";

type Draft = {
  price: string;
  barcode: string;
  external_code: string;
};

function toDraft(variant: NomenclatureVariant): Draft {
  return {
    price:
      variant.price == null || String(variant.price).trim() === ""
        ? ""
        : Number(variant.price).toFixed(2),
    barcode: variant.barcode ?? "",
    external_code: variant.external_code ?? "",
  };
}

/** Card block: nomenclature characteristic variants + commercial fields (`4.4.6`). */
export function NomenclatureVariantsBlock({
  nomenclatureId,
  variants,
  basePrice,
}: {
  nomenclatureId: number;
  variants: NomenclatureVariant[];
  basePrice: string;
}) {
  const [drafts, setDrafts] = useState<Record<number, Draft>>(() =>
    Object.fromEntries(variants.map((row) => [row.id, toDraft(row)])),
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const setDraftField = (
    variantId: number,
    field: keyof Draft,
    value: string,
  ) => {
    setDrafts((current) => ({
      ...current,
      [variantId]: {
        ...(current[variantId] ?? toDraft(variants.find((v) => v.id === variantId)!)),
        [field]: value,
      },
    }));
  };

  const onSave = (variant: NomenclatureVariant) => {
    const draft = drafts[variant.id] ?? toDraft(variant);
    setError(null);
    startTransition(async () => {
      try {
        const priceRaw = draft.price.trim();
        await updateNomenclatureVariantCommercial(nomenclatureId, variant.id, {
          price: priceRaw === "" ? null : priceRaw,
          barcode: draft.barcode.trim() || null,
          external_code: draft.external_code.trim() || null,
        });
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Не удалось сохранить вариант",
        );
      }
    });
  };

  const onToggle = (variant: NomenclatureVariant) => {
    const data = new FormData();
    data.set("nomenclature_id", String(nomenclatureId));
    data.set("variant_id", String(variant.id));
    data.set("is_active", String(variant.is_active));
    setError(null);
    startTransition(async () => {
      try {
        await toggleNomenclatureVariant(data);
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Не удалось сменить статус варианта",
        );
      }
    });
  };

  return (
    <SectionCard
      title="Варианты"
      description={`Цена пустая = базовая ${basePrice}. Штрихкод уникален. external_code — для 1С позже.`}
      size="compact"
    >
      {error ? (
        <p className="mb-portal-2 text-portal-caption text-portal-danger" role="alert">
          {error}
        </p>
      ) : null}
      {variants.length === 0 ? (
        <EmptyState
          title="Вариантов пока нет"
          description="Сгенерируйте комбинации характеристик (API generate) или создайте вариант."
          size="compact"
        />
      ) : (
        <ul className="grid gap-portal-3">
          {variants.map((variant) => {
            const draft = drafts[variant.id] ?? toDraft(variant);
            return (
              <li
                key={variant.id}
                className="min-w-0 rounded-portal-md border border-portal-border bg-portal-surface-secondary p-portal-3"
              >
                <div className="mb-portal-2 flex flex-wrap items-center justify-between gap-portal-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-portal-text">
                      {variant.article} — {variant.name}
                    </p>
                    <p className="text-portal-caption text-portal-muted">
                      {variant.options.map((option) => option.label).join(" · ") ||
                        "без опций"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <StatusBadge
                      size="compact"
                      tone={variant.is_active ? "success" : "neutral"}
                    >
                      {variant.is_active ? "Активен" : "Архив"}
                    </StatusBadge>
                    <IconButton
                      label={variant.is_active ? "В архив" : "Восстановить"}
                      variant="secondary"
                      disabled={pending}
                      onClick={() => onToggle(variant)}
                    >
                      {variant.is_active ? (
                        <Archive className="size-4" aria-hidden="true" />
                      ) : (
                        <RotateCcw className="size-4" aria-hidden="true" />
                      )}
                    </IconButton>
                    <Button
                      type="button"
                      size="compact"
                      variant="secondary"
                      disabled={pending}
                      onClick={() => onSave(variant)}
                    >
                      <Save className="size-4" aria-hidden="true" />
                      Сохранить
                    </Button>
                  </div>
                </div>
                <div className="grid min-w-0 gap-portal-2 sm:grid-cols-3">
                  <Input
                    size="compact"
                    inputMode="decimal"
                    placeholder={`Цена (база ${basePrice})`}
                    aria-label={`Цена ${variant.article}`}
                    value={draft.price}
                    disabled={pending}
                    onChange={(event) =>
                      setDraftField(variant.id, "price", event.target.value)
                    }
                  />
                  <Input
                    size="compact"
                    placeholder="Штрихкод"
                    aria-label={`Штрихкод ${variant.article}`}
                    value={draft.barcode}
                    disabled={pending}
                    onChange={(event) =>
                      setDraftField(variant.id, "barcode", event.target.value)
                    }
                  />
                  <Input
                    size="compact"
                    placeholder="external_code"
                    aria-label={`external_code ${variant.article}`}
                    value={draft.external_code}
                    disabled={pending}
                    onChange={(event) =>
                      setDraftField(
                        variant.id,
                        "external_code",
                        event.target.value,
                      )
                    }
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}
