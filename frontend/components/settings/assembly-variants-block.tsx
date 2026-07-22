"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  addAssemblyOperationLine,
  createAssemblyVariant,
  deleteAssemblyOperationLine,
  deleteAssemblyVariant,
  updateAssemblyVariant,
} from "@/app/(workspace)/settings/catalogs/product-models/product-model-actions";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/form-controls";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  formatAssemblyCost,
  parseAssemblyCostInput,
  validateAssemblyOperationLineDraft,
  validateAssemblyVariantDraft,
  type AssemblyVariant,
} from "@/lib/product-models";

type AssemblyVariantsBlockProps = {
  modelId: number;
  variants: AssemblyVariant[];
};

/** PT-08 main-slot block: manager assembly packages (`6.1.12.4` / ADR-014). */
export function AssemblyVariantsBlock({
  modelId,
  variants,
}: AssemblyVariantsBlockProps) {
  const router = useRouter();
  const [variantName, setVariantName] = useState("");
  const [lineDrafts, setLineDrafts] = useState<
    Record<number, { operation_name: string; cost: string }>
  >({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lineDraft = (variantId: number) =>
    lineDrafts[variantId] ?? { operation_name: "", cost: "0" };

  const setLineDraft = (
    variantId: number,
    next: { operation_name: string; cost: string },
  ) => {
    setLineDrafts((current) => ({ ...current, [variantId]: next }));
  };

  const run = async (action: () => Promise<{ ok: true } | { ok: false; message: string }>) => {
    setBusy(true);
    setError(null);
    const result = await action();
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return false;
    }
    router.refresh();
    return true;
  };

  const onCreateVariant = async () => {
    const validationError = validateAssemblyVariantDraft({ name: variantName });
    if (validationError) {
      setError(validationError);
      return;
    }
    const ok = await run(() => createAssemblyVariant(modelId, variantName));
    if (ok) setVariantName("");
  };

  const onToggleActive = async (variant: AssemblyVariant) => {
    await run(() =>
      updateAssemblyVariant(modelId, variant.id, { is_active: !variant.is_active }),
    );
  };

  const onDeleteVariant = async (variant: AssemblyVariant) => {
    if (!window.confirm(`Удалить вариант «${variant.name}»?`)) return;
    await run(() => deleteAssemblyVariant(modelId, variant.id));
  };

  const onAddLine = async (variantId: number) => {
    const draft = lineDraft(variantId);
    const validationError = validateAssemblyOperationLineDraft(draft);
    if (validationError) {
      setError(validationError);
      return;
    }
    const cost = parseAssemblyCostInput(draft.cost);
    if (cost == null) {
      setError("Укажите стоимость операции (число ≥ 0)");
      return;
    }
    const ok = await run(() =>
      addAssemblyOperationLine(modelId, variantId, {
        operation_name: draft.operation_name,
        cost,
      }),
    );
    if (ok) setLineDraft(variantId, { operation_name: "", cost: "0" });
  };

  const onDeleteLine = async (variantId: number, lineId: number, name: string) => {
    if (!window.confirm(`Удалить операцию «${name}»?`)) return;
    await run(() => deleteAssemblyOperationLine(modelId, variantId, lineId));
  };

  return (
    <div className="grid min-w-0 gap-portal-3">
      <p className="text-portal-caption text-portal-muted">
        Менеджерские пакеты сборки/отделки со стоимостью операций. Цеховые маршруты —
        отдельный контур (Stage 8).
      </p>

      <div className="flex flex-wrap items-end gap-portal-2">
        <label className="min-w-[220px] flex-1">
          <span className="mb-1 block text-portal-caption text-portal-muted">
            Новый вариант
          </span>
          <Input
            value={variantName}
            disabled={busy}
            onChange={(event) => {
              setVariantName(event.target.value);
              setError(null);
            }}
            placeholder="Например, С отстрочкой"
            aria-label="Название варианта сборки"
          />
        </label>
        <Button
          type="button"
          variant="primary"
          size="compact"
          disabled={busy || !variantName.trim()}
          onClick={() => void onCreateVariant()}
        >
          Добавить вариант
        </Button>
      </div>

      {error ? (
        <p className="text-portal-caption text-portal-danger" role="alert">
          {error}
        </p>
      ) : null}

      {variants.length === 0 ? (
        <EmptyState
          title="Вариантов пока нет"
          description="Добавьте пакет сборки — строки операций и итоговая стоимость появятся здесь."
          size="compact"
        />
      ) : (
        <ul className="grid gap-portal-3">
          {variants.map((variant) => {
            const draft = lineDraft(variant.id);
            return (
              <li
                key={variant.id}
                className="rounded-portal-md border border-portal-border bg-portal-surface-secondary p-portal-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-portal-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-portal-2">
                      <p className="font-semibold text-portal-text">{variant.name}</p>
                      <StatusBadge
                        size="compact"
                        tone={variant.is_active ? "success" : "neutral"}
                      >
                        {variant.is_active ? "Активен" : "Неактивен"}
                      </StatusBadge>
                    </div>
                    <p className="mt-1 text-portal-caption text-portal-muted">
                      Итого: {formatAssemblyCost(variant.total_cost)} ₽ ·{" "}
                      {variant.operation_lines.length} оп.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-portal-2">
                    <Button
                      type="button"
                      size="compact"
                      disabled={busy}
                      onClick={() => void onToggleActive(variant)}
                    >
                      {variant.is_active ? "Деактивировать" : "Активировать"}
                    </Button>
                    <Button
                      type="button"
                      size="compact"
                      disabled={busy}
                      onClick={() => void onDeleteVariant(variant)}
                    >
                      Удалить
                    </Button>
                  </div>
                </div>

                {variant.operation_lines.length > 0 ? (
                  <ul className="mt-portal-3 divide-y divide-portal-border overflow-hidden rounded-portal-md border border-portal-border bg-portal-surface">
                    {variant.operation_lines.map((line) => (
                      <li
                        key={line.id}
                        className="flex flex-wrap items-center justify-between gap-portal-2 px-portal-3 py-portal-2"
                      >
                        <div className="min-w-0">
                          <p className="text-portal-body text-portal-text">
                            <span className="text-portal-muted">{line.sequence}. </span>
                            {line.operation_name}
                          </p>
                        </div>
                        <div className="flex items-center gap-portal-2">
                          <span className="text-portal-body font-medium text-portal-text">
                            {formatAssemblyCost(line.cost)} ₽
                          </span>
                          <Button
                            type="button"
                            size="compact"
                            disabled={busy}
                            onClick={() =>
                              void onDeleteLine(
                                variant.id,
                                line.id,
                                line.operation_name,
                              )
                            }
                          >
                            Убрать
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-portal-3 text-portal-caption text-portal-muted">
                    Строк операций пока нет — итог 0,00 ₽.
                  </p>
                )}

                <div className="mt-portal-3 flex flex-wrap items-end gap-portal-2">
                  <label className="min-w-[180px] flex-1">
                    <span className="mb-1 block text-portal-caption text-portal-muted">
                      Операция
                    </span>
                    <Input
                      value={draft.operation_name}
                      disabled={busy}
                      onChange={(event) =>
                        setLineDraft(variant.id, {
                          ...draft,
                          operation_name: event.target.value,
                        })
                      }
                      placeholder="Название операции"
                      aria-label={`Операция для варианта ${variant.name}`}
                    />
                  </label>
                  <label className="w-[120px]">
                    <span className="mb-1 block text-portal-caption text-portal-muted">
                      Стоимость
                    </span>
                    <Input
                      value={draft.cost}
                      disabled={busy}
                      onChange={(event) =>
                        setLineDraft(variant.id, {
                          ...draft,
                          cost: event.target.value,
                        })
                      }
                      inputMode="decimal"
                      aria-label={`Стоимость операции для варианта ${variant.name}`}
                    />
                  </label>
                  <Button
                    type="button"
                    variant="primary"
                    size="compact"
                    disabled={busy || !draft.operation_name.trim()}
                    onClick={() => void onAddLine(variant.id)}
                  >
                    Добавить строку
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
