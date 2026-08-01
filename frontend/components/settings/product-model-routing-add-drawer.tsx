"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";

import { createProductModelRouting } from "@/app/(workspace)/settings/catalogs/product-models/product-model-actions";
import { Button } from "@/components/ui/button";
import { CreateDrawer } from "@/components/ui/create-drawer";
import { Field, Input } from "@/components/ui/form-controls";
import { EmptyState } from "@/components/ui/empty-state";
import {
  buildRoutingNormRows,
  filterAvailableShopRoutingsForWhitelist,
  parseNormQtyInput,
  type ProductModelRoutingLink,
} from "@/lib/product-model-routings";
import type { ShopRoutingTemplate } from "@/lib/shop-routings";
import {
  formatTechOperationVolumeUnit,
  type TechOperation,
  type TechOperationVolumeUnit,
} from "@/lib/tech-operations";

type ProductModelRoutingAddDrawerProps = {
  open: boolean;
  modelId: number;
  shopRoutings: ShopRoutingTemplate[];
  links: ProductModelRoutingLink[];
  techOperations: TechOperation[];
  onClose: () => void;
  onSaved: () => void;
};

/** Right panel: pick a routing preset, review ops + norms, attach to model (`6.1.17`). */
export function ProductModelRoutingAddDrawer({
  open,
  modelId,
  shopRoutings,
  links,
  techOperations,
  onClose,
  onSaved,
}: ProductModelRoutingAddDrawerProps) {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draftQty, setDraftQty] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const available = useMemo(
    () => filterAvailableShopRoutingsForWhitelist(shopRoutings, links, search),
    [links, search, shopRoutings],
  );

  const selected = useMemo(
    () => available.find((row) => row.id === selectedId) ?? null,
    [available, selectedId],
  );

  const opById = useMemo(() => {
    const map = new Map<number, TechOperation>();
    for (const row of techOperations) map.set(row.id, row);
    return map;
  }, [techOperations]);

  const operationRows = useMemo(() => {
    if (!selected) return [];
    const opsMap = new Map(
      [...opById.entries()].map(([id, op]) => [
        id,
        { name: op.name, volume_unit: op.volume_unit },
      ]),
    );
    return buildRoutingNormRows(selected.stage_lines ?? [], [], opsMap);
  }, [opById, selected]);

  useEffect(() => {
    if (!open) return;
    setSelectedId(null);
    setDraftQty({});
    setSearch("");
    setError("");
  }, [open]);

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const row of operationRows) {
      next[row.key] = "";
    }
    setDraftQty(next);
  }, [selectedId, operationRows]);

  function resetAndClose() {
    if (saving) return;
    setSearch("");
    setSelectedId(null);
    setDraftQty({});
    setError("");
    onClose();
  }

  function unitLabel(unit: string) {
    if (unit === "linear_meters" || unit === "pieces") {
      return formatTechOperationVolumeUnit(unit as TechOperationVolumeUnit);
    }
    return unit;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selectedId == null || !selected) {
      setError("Выберите маршрут из справочника");
      return;
    }

    const norms: Array<{
      production_stage_id: number | null;
      tech_operation_id: number | null;
      norm_qty_per_item: string;
      unit: string;
    }> = [];

    for (const row of operationRows) {
      if (row.production_stage_id == null && row.tech_operation_id == null) {
        continue;
      }
      const raw = (draftQty[row.key] ?? "").trim();
      if (!raw) continue;
      const parsed = parseNormQtyInput(raw);
      if (parsed == null) {
        setError(
          `Некорректная норма для «${row.operation_label}» (число ≥ 0, до 3 знаков)`,
        );
        return;
      }
      norms.push({
        production_stage_id: row.production_stage_id,
        tech_operation_id: row.tech_operation_id,
        norm_qty_per_item: parsed,
        unit: row.unit,
      });
    }

    setSaving(true);
    setError("");
    const result = await createProductModelRouting(modelId, selectedId, norms);
    setSaving(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setSearch("");
    setSelectedId(null);
    setDraftQty({});
    onSaved();
    onClose();
  }

  return (
    <CreateDrawer
      open={open}
      title="Добавить маршрут"
      description="Выберите пресет — операции подтянутся из справочника. Укажите норму на 1 изделие (план)."
      onClose={resetAndClose}
      variant="overlay"
    >
      <form onSubmit={(event) => void submit(event)} className="flex h-full min-h-0 flex-col">
        <div className="min-h-0 flex-1 space-y-portal-5 overflow-y-auto p-portal-6">
          <div>
            <div className="mb-portal-3 flex flex-wrap items-end justify-between gap-portal-2">
              <h3 className="text-portal-body font-semibold text-portal-text">
                Пресеты маршрутов
              </h3>
              <p className="text-portal-caption text-portal-muted">
                Редактирование этапов — только в каталоге
              </p>
            </div>
            <Field label="Поиск">
              <Input
                value={search}
                disabled={saving}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Название или код"
                aria-label="Поиск маршрутов"
              />
            </Field>

            {available.length === 0 ? (
              <div className="mt-portal-4">
                <EmptyState
                  title="Нет доступных маршрутов"
                  description="Все активные пресеты уже в whitelist, либо справочник пуст."
                  size="compact"
                />
              </div>
            ) : (
              <ul
                className="mt-portal-4 divide-y divide-portal-border overflow-hidden rounded-portal-md border border-portal-border"
                role="radiogroup"
                aria-label="Пресеты маршрутов"
              >
                {available.map((row) => {
                  const checked = selectedId === row.id;
                  const opCount = row.stage_lines?.length ?? 0;
                  return (
                    <li key={row.id} className="px-portal-3 py-portal-2">
                      <label className="flex cursor-pointer items-start gap-portal-2">
                        <input
                          type="radio"
                          className="mt-1"
                          name="product-model-routing-preset"
                          checked={checked}
                          disabled={saving}
                          onChange={() => {
                            setSelectedId(row.id);
                            setError("");
                          }}
                        />
                        <span className="min-w-0">
                          <span className="block text-portal-body font-medium text-portal-text">
                            {row.name}
                          </span>
                          <span className="text-portal-caption text-portal-muted">
                            {opCount} оп.
                            {row.code ? ` · ${row.code}` : ""}
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {selected ? (
            <div>
              <div className="mb-portal-3 flex flex-wrap items-end justify-between gap-portal-2">
                <h3 className="text-portal-body font-semibold text-portal-text">
                  Операции маршрута
                </h3>
                <p className="text-portal-caption text-portal-muted">
                  {operationRows.length} оп. · норма на 1 изд. (план)
                </p>
              </div>

              {operationRows.length === 0 ? (
                <EmptyState
                  title="В пресете нет этапов"
                  description="Сначала добавьте этапы в справочнике маршрутов."
                  size="compact"
                />
              ) : (
                <ul className="divide-y divide-portal-border overflow-hidden rounded-portal-md border border-portal-border bg-portal-surface">
                  <li className="grid grid-cols-[minmax(0,1fr)_7.5rem_4.5rem] items-center gap-portal-2 bg-portal-bg px-portal-3 py-portal-2 text-portal-caption text-portal-muted">
                    <span>Операция</span>
                    <span className="text-right">Норма на 1 изд.</span>
                    <span className="text-right">Ед.</span>
                  </li>
                  {operationRows.map((row) => (
                    <li
                      key={row.key}
                      className="grid grid-cols-[minmax(0,1fr)_7.5rem_4.5rem] items-center gap-portal-2 px-portal-3 py-portal-2"
                    >
                      <p className="min-w-0 text-portal-body text-portal-text">
                        <span className="text-portal-muted">
                          {row.stage_order}.{" "}
                        </span>
                        {row.operation_label}
                      </p>
                      <div className="justify-self-end">
                        <Input
                          className="w-[6.5rem] text-right tabular-nums"
                          value={draftQty[row.key] ?? ""}
                          placeholder="—"
                          disabled={saving}
                          onChange={(event) => {
                            const value = event.target.value;
                            setDraftQty((current) => ({
                              ...current,
                              [row.key]: value,
                            }));
                            setError("");
                          }}
                          aria-label={`Норма на 1 изд. · ${row.operation_label}`}
                        />
                      </div>
                      <span className="text-right text-portal-caption text-portal-muted">
                        {unitLabel(row.unit)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}

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
            disabled={saving || selectedId == null}
          >
            {saving ? "Сохранение…" : "Добавить маршрут"}
          </Button>
        </footer>
      </form>
    </CreateDrawer>
  );
}
