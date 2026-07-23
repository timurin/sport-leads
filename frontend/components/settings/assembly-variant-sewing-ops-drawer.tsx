"use client";

import { type FormEvent, useMemo, useState } from "react";

import {
  addAssemblyVariantSewingOperations,
  createAssemblyVariant,
} from "@/app/(workspace)/settings/catalogs/product-models/product-model-actions";
import { Button } from "@/components/ui/button";
import { CreateDrawer } from "@/components/ui/create-drawer";
import { Checkbox, Field, Input } from "@/components/ui/form-controls";
import { EmptyState } from "@/components/ui/empty-state";
import {
  formatAssemblyCost,
  sumSelectedSewingOperationCosts,
  validateAssemblyVariantDraft,
} from "@/lib/product-models";
import {
  filterSewingOperations,
  formatDurationMinutesSeconds,
  formatSewingCost,
  type SewingOperation,
} from "@/lib/sewing-operations";

type AssemblyVariantSewingOpsDrawerProps = {
  open: boolean;
  modelId: number;
  sewingOperations: SewingOperation[];
  /** When set, selected ops are appended to an existing variant. */
  variantId?: number | null;
  excludeSewingOperationIds?: number[];
  onClose: () => void;
  onSaved: () => void;
};

/** Right panel: pick sewing operations into an assembly variant (`6.3.6`). */
export function AssemblyVariantSewingOpsDrawer({
  open,
  modelId,
  sewingOperations,
  variantId = null,
  excludeSewingOperationIds = [],
  onClose,
  onSaved,
}: AssemblyVariantSewingOpsDrawerProps) {
  const isAppend = variantId != null;
  const [name, setName] = useState("");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const excluded = useMemo(
    () => new Set(excludeSewingOperationIds),
    [excludeSewingOperationIds],
  );

  const available = useMemo(
    () =>
      filterSewingOperations(
        sewingOperations.filter((row) => !excluded.has(row.id)),
        search,
      ),
    [excluded, search, sewingOperations],
  );

  const selectedOps = useMemo(
    () => sewingOperations.filter((row) => selectedIds.includes(row.id)),
    [selectedIds, sewingOperations],
  );

  const total = sumSelectedSewingOperationCosts(selectedOps);
  const totalDuration = selectedOps.reduce(
    (sum, operation) => sum + (Number(operation.duration_seconds) || 0),
    0,
  );

  function resetAndClose() {
    if (saving) return;
    setName("");
    setSearch("");
    setSelectedIds([]);
    setError("");
    onClose();
  }

  function toggle(operationId: number) {
    setSelectedIds((current) =>
      current.includes(operationId)
        ? current.filter((id) => id !== operationId)
        : [...current, operationId],
    );
    setError("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isAppend) {
      const validationError = validateAssemblyVariantDraft({ name });
      if (validationError) {
        setError(validationError);
        return;
      }
    }
    if (selectedIds.length === 0) {
      setError("Выберите хотя бы одну операцию пошива");
      return;
    }

    setSaving(true);
    setError("");
    const result = isAppend
      ? await addAssemblyVariantSewingOperations(modelId, variantId, selectedIds)
      : await createAssemblyVariant(modelId, name, selectedIds);
    setSaving(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setName("");
    setSearch("");
    setSelectedIds([]);
    onSaved();
    onClose();
  }

  return (
    <CreateDrawer
      open={open}
      title={isAppend ? "Добавить операции пошива" : "Новый вариант сборки"}
      description="Вариант — группа операций пошива. Итоговая стоимость = сумма выбранных."
      onClose={resetAndClose}
      variant="overlay"
    >
      <form onSubmit={submit} className="flex h-full min-h-0 flex-col">
        <div className="min-h-0 flex-1 space-y-portal-5 overflow-y-auto p-portal-6">
          {!isAppend ? (
            <Field label="Название варианта" required>
              <Input
                autoFocus
                required
                maxLength={255}
                value={name}
                disabled={saving}
                onChange={(event) => {
                  setName(event.target.value);
                  setError("");
                }}
                placeholder="Например, С отстрочкой"
              />
            </Field>
          ) : null}

          <div>
            <div className="mb-portal-3 flex flex-wrap items-end justify-between gap-portal-2">
              <h3 className="text-portal-body font-semibold text-portal-text">
                Операции пошива
              </h3>
              <p className="text-portal-caption text-portal-muted">
                Выбрано: {selectedIds.length} · Итого: {formatAssemblyCost(total)}{" "}
                ₽ · Время сборки 1 изделия{" "}
                {formatDurationMinutesSeconds(totalDuration)}
              </p>
            </div>
            <Field label="Поиск">
              <Input
                value={search}
                disabled={saving}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Найти операцию"
                aria-label="Поиск операций пошива"
              />
            </Field>

            {available.length === 0 ? (
              <div className="mt-portal-4">
                <EmptyState
                  title={
                    sewingOperations.length === 0
                      ? "Справочник пуст"
                      : "Нет доступных операций"
                  }
                  description={
                    sewingOperations.length === 0
                      ? "Сначала добавьте операции в «Операции пошива»."
                      : "Все операции уже в варианте или не найдены по поиску."
                  }
                  size="compact"
                />
              </div>
            ) : (
              <ul className="mt-portal-4 divide-y divide-portal-border overflow-hidden rounded-portal-md border border-portal-border">
                {available.map((operation) => {
                  const checked = selectedIds.includes(operation.id);
                  return (
                    <li key={operation.id} className="px-portal-3 py-portal-2">
                      <Checkbox
                        id={`sewing-op-${operation.id}`}
                        checked={checked}
                        disabled={saving}
                        onChange={() => toggle(operation.id)}
                        label={`${operation.name} — ${formatSewingCost(operation.cost)} ₽ · ${operation.duration_seconds ?? 0} с`}
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {error ? (
            <p className="text-portal-body text-portal-danger" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <footer className="flex items-center justify-end gap-portal-2 border-t border-portal-border bg-portal-surface px-portal-6 py-portal-4">
          <Button type="button" onClick={resetAndClose} disabled={saving}>
            Отмена
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={saving || selectedIds.length === 0}
          >
            {saving
              ? "Сохранение…"
              : isAppend
                ? "Добавить в вариант"
                : "Создать вариант"}
          </Button>
        </footer>
      </form>
    </CreateDrawer>
  );
}
