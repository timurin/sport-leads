"use client";

import { X } from "lucide-react";
import { useState } from "react";

import { createTechOperation } from "@/app/(workspace)/settings/catalogs/tech-operations/tech-operation-actions";
import { Button, IconButton } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form-controls";
import { presentRouteReadiness, type RouteNodeReadiness } from "@/lib/route-readiness";
import { operationReadiness } from "@/lib/tech-operation-ux";
import type { CapacityResource } from "@/lib/tech-operation-capacity";
import type { ProductionStage } from "@/lib/production-stages";
import type { TechOperation } from "@/lib/tech-operations";

type RoutingOperationDialogProps = {
  title: string;
  workshopId: number;
  workshopName: string;
  productionStages: ProductionStage[];
  operations: TechOperation[];
  resources: CapacityResource[];
  demandByOperation?: Map<number, RouteNodeReadiness>;
  initialCreating?: boolean;
  onClose: () => void;
  onSelect: (operation: TechOperation) => void;
};

export function RoutingOperationDialog({
  title,
  workshopId,
  workshopName,
  productionStages,
  operations,
  resources,
  demandByOperation,
  initialCreating = false,
  onClose,
  onSelect,
}: RoutingOperationDialogProps) {
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(initialCreating);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [stageId, setStageId] = useState(String(workshopId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const needle = query.trim().toLocaleLowerCase("ru");
  const rows = operations.filter((operation) => {
    const sameWorkshop = operation.production_stage_id == null || operation.production_stage_id === workshopId;
    if (!sameWorkshop) return false;
    if (!needle) return true;
    return `${operation.name} ${operation.code}`.toLocaleLowerCase("ru").includes(needle);
  });

  async function submitCreate() {
    setSaving(true);
    setError(null);
    try {
      const result = await createTechOperation({
        name,
        code,
        volume_unit: "pieces",
        production_stage_id: Number(stageId) || null,
        is_active: true,
        required_materials: [],
        capacity_resource_keys: [],
      });
      if (!result.ok) {
        setError(result.message);
        setSaving(false);
        return;
      }
      onSelect(result.operation);
    } catch {
      setError("Не удалось связаться с API. Операция не создана.");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-portal-4" role="presentation" onClick={(event) => { event.stopPropagation(); onClose(); }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="routing-operation-dialog-title"
        className="max-h-[80vh] w-full max-w-md overflow-auto rounded-portal-lg border border-portal-border bg-portal-surface p-portal-4 shadow-portal-overlay"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-portal-3">
          <div className="min-w-0">
            <h2 id="routing-operation-dialog-title" className="text-portal-body font-semibold">{title}</h2>
            <p className="mt-1 text-portal-caption text-portal-muted">Цех: {workshopName}</p>
          </div>
          <IconButton label="Закрыть окно" variant="secondary" onClick={onClose}>
            <X className="size-4" aria-hidden="true" />
          </IconButton>
        </div>
        {error ? <p className="mt-portal-3 text-portal-body text-portal-danger" role="alert">{error}</p> : null}
        {creating ? (
          <div className="mt-portal-4 grid gap-portal-3">
            <Field label="Наименование" required>
              <Input autoFocus value={name} onChange={(event) => setName(event.target.value)} maxLength={255} />
            </Field>
            <Field label="Код" required>
              <Input value={code} onChange={(event) => setCode(event.target.value)} maxLength={64} />
            </Field>
            <Field label="Цех" required>
              <Select value={stageId} onChange={(event) => setStageId(event.target.value)}>
                {productionStages.map((stage) => (
                  <option key={stage.id} value={stage.id}>{stage.name}</option>
                ))}
              </Select>
            </Field>
            <p className="text-portal-caption text-portal-muted">Ресурс, мощность и оборудование настраиваются позже через «Настроить операцию».</p>
            <div className="flex justify-end gap-portal-2">
              <Button type="button" variant="secondary" disabled={saving} onClick={() => { setCreating(false); setError(null); }}>Назад</Button>
              <Button type="button" variant="primary" disabled={saving} onClick={() => void submitCreate()}>{saving ? "Сохранение…" : "Сохранить"}</Button>
            </div>
          </div>
        ) : (
          <div className="mt-portal-4">
            <label className="text-portal-caption text-portal-muted" htmlFor="routing-operation-picker-search">Поиск</label>
            <Input id="routing-operation-picker-search" autoFocus className="mt-1" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Название или код" />
            <ul className="mt-portal-3 max-h-64 space-y-1 overflow-auto">
              {rows.map((operation) => {
                const shown = presentRouteReadiness(operationReadiness(operation, resources), demandByOperation?.get(operation.id) ?? null);
                return (
                  <li key={operation.id}>
                    <button type="button" className="flex w-full items-center gap-portal-2 rounded-portal-md px-portal-2 py-portal-2 text-left hover:bg-portal-state-hover" onClick={() => onSelect(operation)}>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{operation.name}</span>
                        <span className="block text-portal-caption text-portal-muted">{operation.code}</span>
                      </span>
                      <span className="shrink-0 text-portal-caption text-portal-muted" title={shown.issues[0]}>{shown.label}</span>
                    </button>
                  </li>
                );
              })}
              {rows.length === 0 ? <li className="px-portal-2 py-portal-2 text-portal-caption text-portal-muted">В этом цехе ничего не найдено</li> : null}
            </ul>
            <Button type="button" className="mt-portal-3" variant="secondary" onClick={() => setCreating(true)}>+ Создать новую техоперацию</Button>
          </div>
        )}
      </div>
    </div>
  );
}
