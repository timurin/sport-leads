"use client";

import { X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";

import { updateTechOperation } from "@/app/(workspace)/settings/catalogs/tech-operations/tech-operation-actions";
import { TechOperationResourcesPanel } from "@/components/settings/tech-operation-capacity-fields";
import { Button, IconButton } from "@/components/ui/button";
import { Checkbox, Field, Input, Select } from "@/components/ui/form-controls";
import type { CapacityResource } from "@/lib/tech-operation-capacity";
import {
  TECH_OPERATION_VOLUME_UNIT_LABELS,
  type TechOperation,
  type TechOperationDraft,
  type TechOperationVolumeUnit,
} from "@/lib/tech-operations";
import type { ProductionStage } from "@/lib/production-stages";
import type { WorkCenter } from "@/lib/shop-routings";

function operationDraft(operation: TechOperation): TechOperationDraft {
  return {
    name: operation.name, code: operation.code, volume_unit: operation.volume_unit,
    production_stage_id: operation.production_stage_id, is_active: operation.is_active,
    required_materials: operation.required_materials.map((material) => ({ ...material })),
    capacity_resource_keys: operation.capacity_resource_keys ?? [],
  };
}

export function TechOperationEditModal({ operation, productionStages, workCenters, resources, operations, materialOptions, onClose, onSaved, onResourceSaved, onOperationKeys }: {
  operation: TechOperation;
  productionStages: ProductionStage[];
  workCenters: WorkCenter[];
  resources: CapacityResource[];
  operations: TechOperation[];
  materialOptions: Array<{ id: number; name: string; unit: string; is_active: boolean }>;
  onClose: () => void;
  onSaved: (operation: TechOperation) => void;
  onResourceSaved: (resource: CapacityResource) => void;
  onOperationKeys: (operationId: number, keys: string[]) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pendingRef = useRef(false);
  const [initialDraft] = useState(() => operationDraft(operation));
  const [draft, setDraft] = useState(initialDraft);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingException, setPendingException] = useState(false);
  const dirty = pendingException || JSON.stringify(draft) !== JSON.stringify(initialDraft);

  const requestClose = useCallback(() => {
    if (pendingRef.current) return;
    if (dirty && !window.confirm("Есть несохранённые изменения. Закрыть без сохранения?")) return;
    onClose();
  }, [dirty, onClose]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const opener = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);

  useEffect(() => {
    if (!dirty && !saving) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty, saving]);

  function update<K extends keyof TechOperationDraft>(key: K, value: TechOperationDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setError(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingRef.current) return;
    if (pendingException) {
      setError("Добавьте заполненное исключение в список или очистите его поля перед сохранением.");
      return;
    }
    pendingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      const result = await updateTechOperation(operation.id, draft);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      onSaved(result.operation);
    } catch {
      setError("Не удалось сохранить изменения. Проверьте соединение и повторите попытку.");
    } finally {
      pendingRef.current = false;
      setSaving(false);
    }
  }

  const stageOptions = productionStages
    .filter((stage) => stage.is_active || stage.id === draft.production_stage_id)
    .toSorted((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, "ru"));

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="tech-operation-edit-title"
      className="fixed inset-0 m-auto max-h-[calc(100dvh_-_2rem)] w-[calc(100%_-_2rem)] max-w-4xl overflow-hidden rounded-portal-lg border border-portal-border bg-portal-surface p-0 text-portal-text shadow-portal-overlay backdrop:bg-[#101828]/40"
      onCancel={(event) => { event.preventDefault(); requestClose(); }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) requestClose();
      }}
    >
      <form onSubmit={submit} className="flex max-h-[calc(100dvh_-_2rem)] min-h-0 flex-col">
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-portal-3 border-b border-portal-border px-portal-4 py-portal-4 sm:px-portal-6">
          <div className="min-w-0 flex-1 basis-48">
            <h2 id="tech-operation-edit-title" className="text-portal-section font-semibold">Редактирование операции</h2>
            <p className="mt-1 break-words text-portal-caption text-portal-muted">{operation.name}</p>
          </div>
          <div className="flex shrink-0 items-center gap-portal-2">
            <Button type="submit" variant="primary" size="compact" disabled={saving}>{saving ? "Сохранение…" : "Сохранить"}</Button>
            <Button type="button" size="compact" disabled={saving} onClick={requestClose}>Отмена</Button>
            <IconButton label="Закрыть окно редактирования" disabled={saving} onClick={requestClose}><X className="size-4" aria-hidden="true" /></IconButton>
          </div>
        </header>
        <div className="min-h-0 space-y-portal-5 overflow-y-auto px-portal-4 py-portal-5 sm:px-portal-6">
          {error ? <p role="alert" className="rounded-portal-md bg-portal-danger-soft p-portal-3 text-portal-body text-portal-danger">{error}</p> : null}
          <fieldset disabled={saving} className="grid min-w-0 gap-portal-4 sm:grid-cols-2">
            <Field label="Наименование" htmlFor="tech-operation-name" required><Input id="tech-operation-name" autoFocus required maxLength={255} value={draft.name} onChange={(event) => update("name", event.target.value)} /></Field>
            <Field label="Код" htmlFor="tech-operation-code" required><Input id="tech-operation-code" required maxLength={64} value={draft.code} onChange={(event) => update("code", event.target.value)} /></Field>
            <Field label="Единица объёма" htmlFor="tech-operation-unit"><Select id="tech-operation-unit" value={draft.volume_unit} onChange={(event) => update("volume_unit", event.target.value as TechOperationVolumeUnit)}>
              <option value="pieces">{TECH_OPERATION_VOLUME_UNIT_LABELS.pieces}</option>
              <option value="linear_meters">{TECH_OPERATION_VOLUME_UNIT_LABELS.linear_meters}</option>
            </Select></Field>
            <Field label="Цех" htmlFor="tech-operation-stage"><Select id="tech-operation-stage" value={draft.production_stage_id ?? ""} onChange={(event) => update("production_stage_id", event.target.value ? Number(event.target.value) : null)}>
              <option value="">Не указан</option>
              {draft.production_stage_id != null && !stageOptions.some((stage) => stage.id === draft.production_stage_id) ? <option value={draft.production_stage_id}>Цех #{draft.production_stage_id} (недоступен в списке)</option> : null}
              {stageOptions.map((stage) => <option key={stage.id} value={stage.id}>{stage.name}{stage.is_active ? "" : " (отключён)"}</option>)}
            </Select></Field>
            <Checkbox label="Активна" checked={draft.is_active} onChange={(event) => update("is_active", event.target.checked)} />
          </fieldset>
          <section className="space-y-portal-3 border-t border-portal-border pt-portal-4" aria-label="Необходимые материалы">
            <div className="flex flex-wrap items-center justify-between gap-portal-2">
              <h3 className="font-semibold">Необходимые материалы</h3>
              <Button type="button" size="compact" disabled={saving} onClick={() => update("required_materials", [...draft.required_materials, { nomenclature_id: 0, quantity: "" }])}>Добавить материал</Button>
            </div>
            {draft.required_materials.length === 0 ? <p className="text-portal-caption text-portal-muted">Материалы не заданы.</p> : null}
            {draft.required_materials.map((material, index) => (
              <fieldset key={index} disabled={saving} className="grid min-w-0 items-end gap-portal-3 rounded-portal-md border border-portal-border p-portal-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                <Field label="Материал" required><Select required value={material.nomenclature_id || ""} onChange={(event) => {
                  const option = materialOptions.find((row) => row.id === Number(event.target.value));
                  update("required_materials", draft.required_materials.map((row, rowIndex) => rowIndex === index ? { ...row, nomenclature_id: Number(event.target.value), nomenclature_name: option?.name, unit: option?.unit } : row));
                }}>
                  <option value="">Выберите материал</option>
                  {!materialOptions.some((option) => option.id === material.nomenclature_id) && material.nomenclature_id > 0 ? <option value={material.nomenclature_id}>{material.nomenclature_name ?? `#${material.nomenclature_id}`}</option> : null}
                  {materialOptions.map((option) => <option key={option.id} value={option.id}>{option.name} · {option.unit}</option>)}
                </Select></Field>
                <Field label={`Расход на 1 ${TECH_OPERATION_VOLUME_UNIT_LABELS[draft.volume_unit]}`} required><Input required type="number" min="0" step="0.001" value={String(material.quantity)} onChange={(event) => update("required_materials", draft.required_materials.map((row, rowIndex) => rowIndex === index ? { ...row, quantity: event.target.value } : row))} /></Field>
                <IconButton label="Удалить материал" disabled={saving} onClick={() => update("required_materials", draft.required_materials.filter((_, rowIndex) => rowIndex !== index))}><X className="size-4" aria-hidden="true" /></IconButton>
              </fieldset>
            ))}
          </section>
          <section className="border-t border-portal-border pt-portal-4">
            <TechOperationResourcesPanel
              operationId={operation.id}
              resourceKeys={draft.capacity_resource_keys ?? []}
              resources={resources}
              operations={operations}
              productionStages={productionStages}
              workCenters={workCenters}
              disabled={saving}
              onKeysChange={(keys) => {
                update("capacity_resource_keys", keys);
                onOperationKeys(operation.id, keys);
              }}
              onResourceSaved={onResourceSaved}
              onPendingExceptionChange={setPendingException}
            />
          </section>
        </div>
      </form>
    </dialog>
  );
}
