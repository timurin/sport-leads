"use client";

import { useEffect, useState } from "react";

import {
  deleteCapacityResourceException,
  loadCapacityResource,
  saveCapacityResource,
  saveCapacityResourceException,
  setOperationCapacityResources,
} from "@/app/(workspace)/settings/catalogs/tech-operations/capacity-resource-actions";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select } from "@/components/ui/form-controls";
import { WEEKDAY_LABELS_RU } from "@/lib/production/tech-card-due-date";
import type { ProductionStage } from "@/lib/production-stages";
import type { WorkCenter } from "@/lib/shop-routings";
import {
  CALCULATION_MODE_LABEL,
  CALCULATION_MODES,
  CAPACITY_UNIT_LABEL,
  capacityUnitChoices,
  RESOURCE_TYPE_LABEL,
  CAPACITY_RESOURCE_TYPES,
  defaultCapacityResource,
  formatResourceRate,
  isSharedResource,
  linkResource,
  removeCapacityException,
  toggleWorkingDay,
  unlinkResource,
  upsertCapacityException,
  validateCapacityException,
  withResourceType,
  type CalculationMode,
  type CapacityException,
  type CapacityResource,
  type CapacityResourceType,
  type CapacityUnit,
} from "@/lib/tech-operation-capacity";

const emptyException = (): CapacityException => ({ date: "", unavailable: false, capacity: "", note: "" });

const MODES_FOR_NEW: CalculationMode[] = ["explicit_hours", "rate", "milestone"];

export function CapacityResourceFields({
  value,
  productionStages,
  workCenters,
  disabled,
  lockKey = false,
  showHeading = true,
  onChange,
  onPendingExceptionChange,
  onSaveException,
  onRemoveException,
}: {
  value: CapacityResource;
  productionStages: ProductionStage[];
  workCenters: WorkCenter[];
  disabled?: boolean;
  lockKey?: boolean;
  showHeading?: boolean;
  onChange: (value: CapacityResource) => void;
  onPendingExceptionChange?: (dirty: boolean) => void;
  onSaveException?: (exception: CapacityException) => Promise<string | null>;
  onRemoveException?: (date: string) => Promise<string | null>;
}) {
  const milestone = value.resource_type === "milestone";
  const [exception, setException] = useState<{ draft: CapacityException; error: string }>({ draft: emptyException(), error: "" });
  useEffect(() => {
    if (value.key === "packing_team" && value.resource_count !== 1) onChange({ ...value, resource_count: 1 });
  }, [onChange, value]);
  useEffect(() => {
    const pending = exception.draft;
    onPendingExceptionChange?.(Boolean(pending.date || pending.capacity || pending.note || pending.unavailable));
  }, [exception.draft, onPendingExceptionChange]);

  function change(next: CapacityResource) {
    onChange(next.key === "packing_team" ? { ...next, resource_count: 1 } : next);
  }

  const modes = CALCULATION_MODES.filter((mode) => MODES_FOR_NEW.includes(mode) || mode === value.calculation_mode);
  const units = capacityUnitChoices(value);
  const packingTeam = value.key === "packing_team";
  const centers = workCenters.filter((center) => center.production_stage_id === value.production_stage_id);

  async function addException() {
    const next = {
      ...exception.draft,
      capacity: exception.draft.unavailable ? null : exception.draft.capacity,
    };
    const validationError = validateCapacityException(next);
    if (validationError) {
      setException({ draft: exception.draft, error: validationError });
      return;
    }
    if (onSaveException) {
      const message = await onSaveException(next);
      if (message) {
        setException({ draft: exception.draft, error: message });
        return;
      }
    }
    change({ ...value, exceptions: upsertCapacityException(value.exceptions, next) });
    setException({ draft: emptyException(), error: "" });
  }

  return (
    <div className="space-y-portal-4">
      {showHeading ? <h3 className="font-semibold">Мощность и планирование</h3> : null}
      <div className="grid min-w-0 gap-portal-4 sm:grid-cols-2">
        <Field label="Наименование ресурса" required>
          <Input maxLength={255} disabled={disabled} value={value.name} onChange={(event) => change({ ...value, name: event.target.value })} />
        </Field>
        <Field label="Код ресурса" required>
          <Input maxLength={64} disabled={disabled || lockKey} value={value.key} onChange={(event) => change({ ...value, key: event.target.value.trim() })} />
        </Field>
        <Field label="Цех ресурса" required>
          <Select
            disabled={disabled}
            value={value.production_stage_id ?? ""}
            onChange={(event) => change({ ...value, production_stage_id: event.target.value ? Number(event.target.value) : null, work_center_id: null })}
          >
            <option value="">Выберите цех</option>
            {productionStages.map((stage) => <option key={stage.id} value={stage.id}>{stage.name}</option>)}
          </Select>
        </Field>
        <Field label="Тип ресурса">
          <Select
            disabled={disabled}
            value={value.resource_type}
            onChange={(event) => change(withResourceType(value, event.target.value as CapacityResourceType))}
          >
            {CAPACITY_RESOURCE_TYPES.map((type) => <option key={type} value={type}>{RESOURCE_TYPE_LABEL[type]}</option>)}
          </Select>
        </Field>
        {milestone ? null : (
          <>
            <Field label="Единица мощности">
              <Select
                disabled={disabled}
                value={value.capacity_unit ?? ""}
                onChange={(event) => {
                  const capacityUnit = event.target.value as CapacityUnit;
                  const naturalMachine = value.resource_type === "machine" && (capacityUnit === "linear_meter" || capacityUnit === "item");
                  change({
                    ...value,
                    capacity_unit: capacityUnit,
                    calculation_mode: naturalMachine ? "rate" : value.calculation_mode,
                  });
                }}
              >
                {units.map((unit) => <option key={unit} value={unit}>{CAPACITY_UNIT_LABEL[unit]}</option>)}
              </Select>
            </Field>
            <Field label="Режим расчёта">
              <Select
                disabled={disabled}
                value={value.calculation_mode}
                onChange={(event) => change({ ...value, calculation_mode: event.target.value as CapacityResource["calculation_mode"] })}
              >
                {modes.filter((mode) => mode !== "milestone").map((mode) => <option key={mode} value={mode}>{CALCULATION_MODE_LABEL[mode]}</option>)}
              </Select>
            </Field>
            <Field label="Базовая норма">
              <Input disabled={disabled} inputMode="decimal" value={value.base_rate ?? ""} onChange={(event) => change({ ...value, base_rate: event.target.value })} />
            </Field>
            {value.resource_type === "machine" ? (
              <Field label="Рабочий центр" required>
                <Select
                  disabled={disabled}
                  value={value.work_center_id ?? ""}
                  onChange={(event) => change({ ...value, work_center_id: event.target.value ? Number(event.target.value) : null })}
                >
                  <option value="">Выберите рабочий центр</option>
                  {centers.map((center) => <option key={center.id} value={center.id}>{center.name}</option>)}
                </Select>
              </Field>
            ) : (
              <Field label="Количество ресурсов" help={packingTeam ? "Производительность указана для всей бригады" : undefined}>
                <Input
                  disabled={disabled || packingTeam}
                  type="number"
                  min={packingTeam ? 1 : 0}
                  max={packingTeam ? 1 : 10000}
                  value={packingTeam ? 1 : (value.resource_count ?? "")}
                  onChange={(event) => change({ ...value, resource_count: event.target.value === "" ? null : Number(event.target.value) })}
                />
              </Field>
            )}
            <Field label="Часов в день">
              <Input disabled={disabled} inputMode="decimal" value={value.hours_per_day ?? ""} onChange={(event) => change({ ...value, hours_per_day: event.target.value })} />
            </Field>
            <Field label="Смен в день">
              <Input disabled={disabled} type="number" min="1" max="24" value={value.shifts_per_day} onChange={(event) => change({ ...value, shifts_per_day: Number(event.target.value) })} />
            </Field>
            <Field label="Эффективность">
              <Input disabled={disabled} inputMode="decimal" value={value.efficiency} onChange={(event) => change({ ...value, efficiency: event.target.value })} />
            </Field>
          </>
        )}
        <Checkbox label="Учитывать в загрузке календаря" checked={value.include_in_calendar_load} disabled={disabled} onChange={(event) => change({ ...value, include_in_calendar_load: event.target.checked })} />
      </div>
      <fieldset disabled={disabled} className="space-y-portal-2">
        <legend className="text-portal-caption font-medium text-portal-muted">Рабочие дни</legend>
        <div className="flex flex-wrap gap-portal-2">
          {WEEKDAY_LABELS_RU.map((label, index) => (
            <Checkbox key={label} label={label} checked={value.working_days.includes(index)} onChange={() => change({ ...value, working_days: toggleWorkingDay(value.working_days, index) })} />
          ))}
        </div>
      </fieldset>
      <Field label="Примечание">
        <Input disabled={disabled} maxLength={2000} value={value.note ?? ""} onChange={(event) => change({ ...value, note: event.target.value })} />
      </Field>
      <section className="space-y-portal-3" aria-label="Исключения по датам">
        <h4 className="font-medium">Исключения по датам</h4>
        <p className="text-portal-caption text-portal-muted">Исключение хранится на ресурсе и действует для всех связанных операций.</p>
        <div className="grid min-w-0 gap-portal-3 sm:grid-cols-2">
          <Field label="Дата">
            <Input disabled={disabled} type="date" value={exception.draft.date} onChange={(event) => setException({ draft: { ...exception.draft, date: event.target.value }, error: "" })} />
          </Field>
          <Field label="Мощность на дату">
            <Input disabled={disabled || exception.draft.unavailable} inputMode="decimal" value={exception.draft.capacity ?? ""} onChange={(event) => setException({ draft: { ...exception.draft, capacity: event.target.value }, error: "" })} />
          </Field>
          <Checkbox
            label="Недоступно"
            checked={exception.draft.unavailable}
            disabled={disabled}
            onChange={(event) => setException({
              draft: { ...exception.draft, unavailable: event.target.checked, capacity: event.target.checked ? null : exception.draft.capacity },
              error: "",
            })}
          />
          <Field label="Комментарий">
            <Input disabled={disabled} maxLength={2000} value={exception.draft.note ?? ""} onChange={(event) => setException({ draft: { ...exception.draft, note: event.target.value }, error: "" })} />
          </Field>
        </div>
        {exception.error ? <p role="alert" className="text-portal-caption text-portal-danger">{exception.error}</p> : null}
        <Button type="button" size="compact" disabled={disabled} onClick={() => void addException()}>Добавить исключение</Button>
        <ul className="space-y-portal-2">
          {value.exceptions.map((item) => (
            <li key={item.date} className="flex items-center justify-between gap-portal-3 text-portal-caption">
              <span>{item.date} · {item.unavailable ? "недоступно" : item.capacity}{item.note ? ` · ${item.note}` : ""}</span>
              <Button type="button" size="compact" disabled={disabled} onClick={() => {
                if (onRemoveException) {
                  void onRemoveException(item.date).then((message) => {
                    if (message) setException({ draft: exception.draft, error: message });
                    else change({ ...value, exceptions: removeCapacityException(value.exceptions, item.date) });
                  });
                  return;
                }
                change({ ...value, exceptions: removeCapacityException(value.exceptions, item.date) });
              }}>Удалить</Button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export function TechOperationResourcesPanel({
  operationId,
  resourceKeys,
  resources,
  operations,
  productionStages,
  workCenters,
  disabled,
  onKeysChange,
  onResourceSaved,
  onPendingExceptionChange,
}: {
  operationId: number | null;
  resourceKeys: string[];
  resources: CapacityResource[];
  operations: Array<{ id: number; name: string; capacity_resource_keys?: string[] }>;
  productionStages: ProductionStage[];
  workCenters: WorkCenter[];
  disabled?: boolean;
  onKeysChange: (keys: string[]) => void;
  onResourceSaved: (resource: CapacityResource) => void;
  onPendingExceptionChange?: (dirty: boolean) => void;
}) {
  const [selectedKey, setSelectedKey] = useState("");
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<CapacityResource | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const sharedWith = operationId == null
    ? [...operations, { id: -1, name: "", capacity_resource_keys: resourceKeys }]
    : operations.map((item) => item.id === operationId ? { ...item, capacity_resource_keys: resourceKeys } : item);
  const linked = resourceKeys.map((key) => resources.find((resource) => resource.key === key) ?? { ...defaultCapacityResource(key), name: key });
  const available = resources.filter((resource) => !resourceKeys.includes(resource.key));

  async function applyKeys(next: string[]) {
    if (operationId == null) {
      onKeysChange(next);
      return true;
    }
    const result = await setOperationCapacityResources(operationId, next);
    if (!result.ok) {
      setError(result.message);
      return false;
    }
    onKeysChange(result.capacity_resource_keys);
    return true;
  }

  async function addExisting() {
    if (!selectedKey || resourceKeys.includes(selectedKey)) return;
    setBusy(true);
    setError("");
    const existing = resources.find((resource) => resource.key === selectedKey);
    await applyKeys(linkResource(resourceKeys, selectedKey));
    if (existing) onResourceSaved(existing);
    setSelectedKey("");
    setBusy(false);
  }

  async function unlink(key: string) {
    if (!window.confirm("Отвязать ресурс от операции? Сам ресурс не удаляется.")) return;
    setBusy(true);
    setError("");
    const ok = await applyKeys(unlinkResource(resourceKeys, key));
    if (ok && editingKey === key) {
      setEditingKey(null);
      setDraft(null);
    }
    setBusy(false);
  }

  async function openEditor(key: string) {
    setCreating(false);
    setError("");
    const loaded = await loadCapacityResource(key);
    const resource = loaded.ok ? loaded.resource : resources.find((item) => item.key === key) ?? defaultCapacityResource(key);
    if (loaded.ok) onResourceSaved(loaded.resource);
    setEditingKey(key);
    setDraft(resource);
  }

  async function saveDraft() {
    if (!draft) return;
    setBusy(true);
    setError("");
    if (creating && resources.some((resource) => resource.key === draft.key)) {
      const existing = resources.find((resource) => resource.key === draft.key)!;
      const linkedOk = await applyKeys(linkResource(resourceKeys, existing.key));
      if (linkedOk) {
        onResourceSaved(existing);
        setCreating(false);
        setEditingKey(existing.key);
        setDraft(existing);
      }
      setBusy(false);
      return;
    }
    const existed = resources.some((resource) => resource.key === draft.key);
    const result = await saveCapacityResource(draft);
    if (!result.ok) {
      setError(result.message);
      setBusy(false);
      return;
    }
    onResourceSaved(result.resource);
    if (!existed || !resourceKeys.includes(result.resource.key)) {
      await applyKeys(linkResource(resourceKeys, result.resource.key));
    }
    setCreating(false);
    setEditingKey(result.resource.key);
    setDraft(result.resource);
    setBusy(false);
  }

  return (
    <section className="space-y-portal-4" aria-label="Мощность и планирование">
      <h3 className="font-semibold">Мощность и планирование</h3>
      {error ? <p role="alert" className="text-portal-caption text-portal-danger">{error}</p> : null}
      {linked.length === 0 ? <p className="text-portal-caption text-portal-muted">Ресурсы не связаны.</p> : null}
      <ul className="space-y-portal-2">
        {linked.map((resource) => (
          <li key={resource.key} className="flex flex-wrap items-center justify-between gap-portal-2 rounded-portal-md border border-portal-border p-portal-3">
            <div className="min-w-0">
              <p className="font-medium">{resource.name} <span className="text-portal-caption text-portal-muted">{formatResourceRate(resource)}</span></p>
              {isSharedResource(sharedWith, resource.key) ? <p className="text-portal-caption text-portal-muted">Общий ресурс — изменения видны у всех связанных операций.</p> : null}
            </div>
            <div className="flex gap-portal-2">
              <Button type="button" size="compact" disabled={disabled || busy} onClick={() => void openEditor(resource.key)}>Изменить</Button>
              <Button type="button" size="compact" disabled={disabled || busy} onClick={() => void unlink(resource.key)}>Отвязать</Button>
            </div>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-end gap-portal-3">
        <Field label="Существующий ресурс">
          <Select disabled={disabled || busy} value={selectedKey} onChange={(event) => setSelectedKey(event.target.value)}>
            <option value="">Выберите ресурс</option>
            {available.map((resource) => <option key={resource.key} value={resource.key}>{resource.name}</option>)}
          </Select>
        </Field>
        <Button type="button" size="compact" disabled={disabled || busy || !selectedKey} onClick={() => void addExisting()}>Связать</Button>
        <Button type="button" size="compact" disabled={disabled || busy} onClick={() => {
          setCreating(true);
          setEditingKey(null);
          setDraft(defaultCapacityResource("", productionStages[0]?.id ?? null));
        }}>Создать ресурс</Button>
      </div>
      {draft ? (
        <div className="rounded-portal-md border border-portal-border p-portal-3">
          <CapacityResourceFields
            value={draft}
            productionStages={productionStages}
            workCenters={workCenters}
            disabled={disabled || busy}
            lockKey={!creating}
            showHeading={false}
            onChange={setDraft}
            onPendingExceptionChange={onPendingExceptionChange}
            onSaveException={editingKey ? async (exception) => {
              const result = await saveCapacityResourceException(editingKey, exception);
              if (!result.ok) return result.message;
              const next = { ...draft, exceptions: upsertCapacityException(draft.exceptions, result.exception) };
              setDraft(next);
              onResourceSaved(next);
              return null;
            } : undefined}
            onRemoveException={editingKey ? async (date) => {
              const result = await deleteCapacityResourceException(editingKey, date);
              if (!result.ok) return result.message;
              const next = { ...draft, exceptions: removeCapacityException(draft.exceptions, date) };
              setDraft(next);
              onResourceSaved(next);
              return null;
            } : undefined}
          />
          <Button className="mt-portal-3" type="button" variant="primary" size="compact" disabled={disabled || busy} onClick={() => void saveDraft()}>
            {creating ? "Создать и связать" : "Сохранить ресурс"}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
