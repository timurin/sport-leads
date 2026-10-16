"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  deleteCapacityResourceException,
  loadCapacityResource,
  saveCapacityResource,
  saveCapacityResourceException,
  setOperationCapacityResources,
} from "@/app/(workspace)/settings/catalogs/tech-operations/capacity-resource-actions";
import { WorkCenterCapacityDialog } from "@/components/settings/work-center-capacity-drawer";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select } from "@/components/ui/form-controls";
import { highlightClass, type HighlightTone } from "@/lib/production/readiness-highlight";
import { WEEKDAY_LABELS_RU } from "@/lib/production/tech-card-due-date";
import type { ProductionStage } from "@/lib/production-stages";
import type { WorkCenter } from "@/lib/shop-routings";
import {
  baseRateFieldLabel,
  efficiencyFromPercent,
  efficiencyPercentInput,
  equipmentCapacityHref,
  formatEfficiencyPercent,
  isBrigadeResource,
  resourceCalculationGuide,
  resourceSchedule,
  showsResourceCount,
} from "@/lib/tech-operation-ux";
import {
  CALCULATION_MODE_LABEL,
  CALCULATION_MODES,
  CAPACITY_UNIT_LABEL,
  MILESTONE_CAPTION,
  MILESTONE_HINT,
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

const UNIT_LOAD_HELP = "чел.-ч — труд сотрудников; шт. — изделия; м.п. — погонные метры; маш.-ч — время оборудования.";
const HOURS_HELP = "Сколько часов ресурс доступен в обычный рабочий день.";
const HOURS_TITLE = "Используется только для расчёта доступной мощности ресурса.";
const SHIFTS_HELP = "Используется при расчёте доступной мощности за день.";
const EFFICIENCY_HELP = "Учитывает плановые потери рабочего времени. 1,00 = 100%.";
const EFFICIENCY_TITLE = "Плановая доля полезного рабочего времени.";
const DEMAND_HELP = "Определяет, откуда система получает объём работы для конкретной техкарты.";
const RATE_TITLE = "Сколько единиц ресурс способен выполнить за один час.";
const PLANNING_HELP = "Если выключено, Scheduler не резервирует мощность этого ресурса.";

function HoursField({
  value,
  disabled,
  onChange,
  marked = false,
  message = null,
  tone = null,
}: {
  value: string | null;
  disabled?: boolean;
  onChange: (hours: string) => void;
  marked?: boolean;
  message?: string | null;
  tone?: HighlightTone | null;
}) {
  return (
    <Field label="Рабочих часов в день" help={marked ? undefined : HOURS_HELP} error={marked ? message ?? undefined : undefined} className={marked && tone ? highlightClass(tone) : undefined}>
      <Input data-diagnostic-field="hours_per_day" invalid={marked && tone === "danger"} disabled={disabled} inputMode="decimal" title={HOURS_TITLE} value={value ?? ""} onChange={(event) => onChange(event.target.value)} />
    </Field>
  );
}

function ShiftsField({
  value,
  disabled,
  onChange,
}: {
  value: number;
  disabled?: boolean;
  onChange: (shifts: number) => void;
}) {
  return (
    <Field label="Смен в день" help={SHIFTS_HELP}>
      <Input disabled={disabled} type="number" min="1" max="24" value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </Field>
  );
}

function EfficiencyField({
  value,
  disabled,
  onChange,
}: {
  value: string;
  disabled?: boolean;
  onChange: (efficiency: string) => void;
}) {
  const percent = formatEfficiencyPercent(value);
  return (
    <Field label={<>Коэффициент эффективности{percent ? <span className="font-normal text-portal-muted"> {percent}</span> : null}</>} help={EFFICIENCY_HELP}>
      <Input
        disabled={disabled}
        inputMode="decimal"
        title={EFFICIENCY_TITLE}
        value={efficiencyPercentInput(value)}
        onChange={(event) => {
          const next = efficiencyFromPercent(event.target.value);
          if (next) onChange(next);
        }}
      />
    </Field>
  );
}

function ResourceGuide({ resource }: { resource: CapacityResource }) {
  const guide = resourceCalculationGuide(resource);
  return (
    <section className="space-y-portal-2 rounded-portal-md border border-portal-border p-portal-3" aria-label="Как считается">
      <h4 className="font-medium">Как считается</h4>
      <p className="text-portal-caption"><span className="font-medium">Как определяется потребность заказа. </span>{guide.demand}</p>
      {guide.capacity ? <p className="text-portal-caption"><span className="font-medium">Как определяется доступная мощность. </span>{guide.capacity}</p> : null}
      {guide.notes.map((note) => <p key={note} className="text-portal-caption text-portal-muted">{note}</p>)}
      {guide.warning ? <p className="text-portal-caption">{guide.warning}</p> : null}
    </section>
  );
}

const MODES_FOR_NEW: CalculationMode[] = ["explicit_hours", "rate", "milestone"];

export function CapacityResourceFields({
  value,
  productionStages,
  disabled,
  lockKey = false,
  showHeading = true,
  focus = "full",
  onChange,
  onPendingExceptionChange,
  onSaveException,
  onRemoveException,
  markedField = null,
  markedMessage = null,
  markedTone = null,
}: {
  value: CapacityResource;
  productionStages: ProductionStage[];
  disabled?: boolean;
  lockKey?: boolean;
  showHeading?: boolean;
  focus?: "full" | "capacity" | "schedule" | "exceptions";
  onChange: (value: CapacityResource) => void;
  onPendingExceptionChange?: (dirty: boolean) => void;
  onSaveException?: (exception: CapacityException) => Promise<string | null>;
  onRemoveException?: (date: string) => Promise<string | null>;
  markedField?: string | null;
  markedMessage?: string | null;
  markedTone?: HighlightTone | null;
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

  const showIdentity = focus === "full" || focus === "capacity";
  const showRates = focus === "full" || focus === "capacity";
  const showSchedule = focus === "full" || focus === "schedule";
  const showExceptions = focus === "full" || focus === "exceptions";
  const modes = CALCULATION_MODES.filter((mode) => MODES_FOR_NEW.includes(mode) || mode === value.calculation_mode);
  const units = capacityUnitChoices(value);
  const brigade = isBrigadeResource(value);
  const rateLabel = baseRateFieldLabel(value.calculation_mode);
  const operationTypes = CAPACITY_RESOURCE_TYPES.filter((type) => type !== "machine");

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

  if (value.resource_type === "machine" || (value.work_center_id != null && value.work_center_id > 0)) {
    return (
      <p className="text-portal-body">
        Мощность, график и исключения задаются в каталоге «Оборудование».
        {value.work_center_id != null && value.work_center_id > 0 ? (
          <> <Link className="font-medium text-portal-primary underline" href={equipmentCapacityHref(value.work_center_id)}>Открыть оборудование</Link></>
        ) : null}
      </p>
    );
  }

  return (
    <div className="space-y-portal-4">
      {showHeading ? <h3 className="font-semibold">Мощность и планирование</h3> : null}
      {milestone && focus !== "exceptions" && focus !== "schedule" ? (
        <p className="text-portal-body" title={MILESTONE_HINT}>{MILESTONE_CAPTION}. Этап не требует производственной мощности и не занимает время ресурса.</p>
      ) : null}
      {value.calculation_mode === "cutting_methods" && showRates ? (
        <p className="text-portal-caption text-portal-muted">Способ раскроя задаётся на техкарте. Нормы «поштучно» и «настил» в ответе ресурса не приходят, поэтому здесь их нельзя показать.</p>
      ) : null}
      {focus !== "exceptions" ? <ResourceGuide resource={value} /> : null}
      {showIdentity || showRates ? <div className="grid min-w-0 gap-portal-4 sm:grid-cols-2">
        {showIdentity ? <Field label="Наименование ресурса" required>
          <Input maxLength={255} disabled={disabled} value={value.name} onChange={(event) => change({ ...value, name: event.target.value })} />
        </Field> : null}
        {showIdentity ? <Field label="Код ресурса" required>
          <Input maxLength={64} disabled={disabled || lockKey} value={value.key} onChange={(event) => change({ ...value, key: event.target.value.trim() })} />
        </Field> : null}
        {showIdentity ? <Field label="Цех ресурса" required>
          <Select
            disabled={disabled}
            value={value.production_stage_id ?? ""}
            onChange={(event) => change({ ...value, production_stage_id: event.target.value ? Number(event.target.value) : null, work_center_id: null })}
          >
            <option value="">Выберите цех</option>
            {productionStages.map((stage) => <option key={stage.id} value={stage.id}>{stage.name}</option>)}
          </Select>
        </Field> : null}
        {showIdentity && brigade ? (
          <Field label="Вид ресурса" help="Производительность указана для всей бригады.">
            <p className="text-portal-body">Бригада</p>
          </Field>
        ) : null}
        {showIdentity && !brigade ? <Field label="Вид ресурса" help={milestone ? MILESTONE_HINT : undefined}>
          <Select
            disabled={disabled}
            value={value.resource_type}
            onChange={(event) => change(withResourceType(value, event.target.value as CapacityResourceType))}
          >
            {operationTypes.map((type) => <option key={type} value={type}>{RESOURCE_TYPE_LABEL[type]}</option>)}
          </Select>
        </Field> : null}
        {milestone || !showRates ? null : (
          <>
            <Field label="В чём измеряется загрузка" help={UNIT_LOAD_HELP}>
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
            <Field label="Как рассчитывается потребность" help={DEMAND_HELP}>
              <Select
                disabled={disabled}
                title={value.calculation_mode}
                value={value.calculation_mode}
                onChange={(event) => change({ ...value, calculation_mode: event.target.value as CapacityResource["calculation_mode"] })}
              >
                {modes.filter((mode) => mode !== "milestone").map((mode) => <option key={mode} value={mode}>{CALCULATION_MODE_LABEL[mode]}</option>)}
              </Select>
            </Field>
            {rateLabel ? (
              <Field
                label={rateLabel}
                help={markedField === "base_rate" ? undefined : RATE_TITLE}
                error={markedField === "base_rate" ? markedMessage ?? undefined : undefined}
                className={markedField === "base_rate" && markedTone ? highlightClass(markedTone) : undefined}
              >
                <Input data-diagnostic-field="base_rate" invalid={markedField === "base_rate" && markedTone === "danger"} disabled={disabled} inputMode="decimal" title={RATE_TITLE} value={value.base_rate ?? ""} onChange={(event) => change({ ...value, base_rate: event.target.value })} />
              </Field>
            ) : null}
            {showsResourceCount(value) ? (
              <Field label="Количество сотрудников">
                <Input
                  disabled={disabled}
                  type="number"
                  min={0}
                  max={10000}
                  value={value.resource_count ?? ""}
                  onChange={(event) => change({ ...value, resource_count: event.target.value === "" ? null : Number(event.target.value) })}
                />
              </Field>
            ) : null}
            <HoursField value={value.hours_per_day} disabled={disabled} marked={markedField === "hours_per_day"} message={markedMessage} tone={markedTone} onChange={(hours) => change({ ...value, hours_per_day: hours })} />
            <ShiftsField value={value.shifts_per_day} disabled={disabled} onChange={(shifts) => change({ ...value, shifts_per_day: shifts })} />
            <EfficiencyField value={value.efficiency} disabled={disabled} onChange={(efficiency) => change({ ...value, efficiency })} />
          </>
        )}
        {showRates ? (
          <div>
            <Checkbox label="Учитывать при планировании" checked={value.include_in_calendar_load} disabled={disabled} onChange={(event) => change({ ...value, include_in_calendar_load: event.target.checked })} />
            <p className="text-portal-caption text-portal-muted">{PLANNING_HELP}</p>
          </div>
        ) : null}
      </div> : null}
      {showSchedule ? <fieldset disabled={disabled} className="space-y-portal-2">
        <legend className="text-portal-caption font-medium text-portal-muted">Рабочие дни</legend>
        {focus === "schedule" && !milestone ? (
          <div className="grid gap-portal-3 sm:grid-cols-3">
            <HoursField value={value.hours_per_day} disabled={disabled} marked={markedField === "hours_per_day"} message={markedMessage} tone={markedTone} onChange={(hours) => change({ ...value, hours_per_day: hours })} />
            <ShiftsField value={value.shifts_per_day} disabled={disabled} onChange={(shifts) => change({ ...value, shifts_per_day: shifts })} />
            <EfficiencyField value={value.efficiency} disabled={disabled} onChange={(efficiency) => change({ ...value, efficiency })} />
          </div>
        ) : null}
        <div className="flex flex-wrap gap-portal-2">
          {WEEKDAY_LABELS_RU.map((label, index) => (
            <Checkbox key={label} label={label} checked={value.working_days.includes(index)} onChange={() => change({ ...value, working_days: toggleWorkingDay(value.working_days, index) })} />
          ))}
        </div>
      </fieldset> : null}
      {showIdentity ? <Field label="Примечание">
        <Input disabled={disabled} maxLength={2000} value={value.note ?? ""} onChange={(event) => change({ ...value, note: event.target.value })} />
      </Field> : null}
      {showExceptions ? <section className="space-y-portal-3" aria-label="Исключения по датам">
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
        <Button type="button" size="compact" disabled={disabled} onClick={() => void addException()}>+ Добавить исключение</Button>
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
      </section> : null}
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
  view = "full",
  onKeysChange,
  onResourceSaved,
  onPendingExceptionChange,
  onDraftDirty,
  diagnosticField = null,
  diagnosticResourceKey = null,
  diagnosticMessage = null,
  diagnosticTone = null,
  onDiagnosticReady,
}: {
  operationId: number | null;
  resourceKeys: string[];
  resources: CapacityResource[];
  operations: Array<{ id: number; name: string; capacity_resource_keys?: string[] }>;
  productionStages: ProductionStage[];
  workCenters: WorkCenter[];
  disabled?: boolean;
  view?: "full" | "capacity" | "equipment" | "schedule" | "exceptions";
  onKeysChange: (keys: string[]) => void;
  onResourceSaved: (resource: CapacityResource) => void;
  onPendingExceptionChange?: (dirty: boolean) => void;
  onDraftDirty?: (dirty: boolean) => void;
  diagnosticField?: string | null;
  diagnosticResourceKey?: string | null;
  diagnosticMessage?: string | null;
  diagnosticTone?: HighlightTone | null;
  onDiagnosticReady?: () => void;
}) {
  const [selectedKey, setSelectedKey] = useState("");
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<CapacityResource | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [connectId, setConnectId] = useState("");
  const [quickEditId, setQuickEditId] = useState<number | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const baseline = useRef("");
  useEffect(() => {
    onDraftDirty?.(draft != null && JSON.stringify(draft) !== baseline.current);
  }, [draft, onDraftDirty]);
  const sharedWith = operationId == null
    ? [...operations, { id: -1, name: "", capacity_resource_keys: resourceKeys }]
    : operations.map((item) => item.id === operationId ? { ...item, capacity_resource_keys: resourceKeys } : item);
  const linked = resourceKeys.map((key) => resources.find((resource) => resource.key === key) ?? { ...defaultCapacityResource(key), name: key });
  const available = resources.filter((resource) => !resourceKeys.includes(resource.key) && resource.work_center_id == null && resource.resource_type !== "machine");

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

  const openEditor = useCallback(async (key: string) => {
    const known = resources.find((item) => item.key === key);
    if (known != null && (known.resource_type === "machine" || known.work_center_id != null)) {
      setError("Мощность оборудования задаётся в каталоге «Оборудование».");
      return;
    }
    setCreating(false);
    setError("");
    const loaded = await loadCapacityResource(key);
    const resource = loaded.ok ? loaded.resource : known ?? defaultCapacityResource(key);
    if (resource.resource_type === "machine" || resource.work_center_id != null) {
      if (loaded.ok) onResourceSaved(loaded.resource);
      setError("Мощность оборудования задаётся в каталоге «Оборудование».");
      return;
    }
    if (loaded.ok) onResourceSaved(loaded.resource);
    setEditingKey(key);
    baseline.current = JSON.stringify(resource);
    setDraft(resource);
  }, [onResourceSaved, resources]);

  const openedDiagnostic = useRef<string | null>(null);
  useEffect(() => {
    if (!diagnosticField || !diagnosticResourceKey) return;
    if (view === "equipment" || view === "exceptions") return;
    const editorFields = new Set(["hours_per_day", "shifts_per_day", "efficiency", "working_days", "base_rate", "resource_count", "capacity_unit", "include_in_calendar_load"]);
    if (!editorFields.has(diagnosticField)) return;
    const token = `${view}:${diagnosticResourceKey}:${diagnosticField}`;
    if (openedDiagnostic.current === token) return;
    openedDiagnostic.current = token;
    void openEditor(diagnosticResourceKey).finally(() => onDiagnosticReady?.());
  }, [diagnosticField, diagnosticResourceKey, openEditor, view, onDiagnosticReady]);

  async function connectWorkCenter() {
    const center = workCenters.find((item) => item.id === Number(connectId));
    if (!center) return;
    const existing = resources.find((resource) => resource.work_center_id === center.id);
    setBusy(true);
    setError("");
    if (!existing) {
      setError("Сначала задайте мощность в каталоге «Оборудование».");
      setBusy(false);
      return;
    }
    const ok = await applyKeys(linkResource(resourceKeys, existing.key));
    if (ok) onResourceSaved(existing);
    setConnectId("");
    setBusy(false);
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
    baseline.current = JSON.stringify(result.resource);
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
      {view === "full" ? <h3 className="font-semibold">Мощность и планирование</h3> : null}
      {error ? <p role="alert" className="text-portal-caption text-portal-danger">{error}</p> : null}
      {view === "equipment" ? (
        <div className={diagnosticField === "work_center_id" && diagnosticTone ? highlightClass(diagnosticTone) : "space-y-portal-3"} data-diagnostic-section="work_center_id">
          {diagnosticField === "work_center_id" && diagnosticMessage ? <p className="text-portal-caption">{diagnosticMessage}</p> : null}
          <table className="w-full text-left text-portal-body">
            <thead>
              <tr className="text-portal-caption text-portal-muted">
                <th className="py-portal-2 pr-portal-2 font-medium">Оборудование</th>
                <th className="py-portal-2 pr-portal-2 font-medium">Цех</th>
                <th className="py-portal-2 pr-portal-2 font-medium">Производительность</th>
                <th className="py-portal-2 pr-portal-2 font-medium">Состояние</th>
                <th className="py-portal-2 font-medium">Действия</th>
              </tr>
            </thead>
            <tbody>
              {linked.filter((resource) => resource.work_center_id != null).map((resource) => {
                const center = workCenters.find((item) => item.id === resource.work_center_id);
                const stage = productionStages.find((item) => item.id === (center?.production_stage_id ?? resource.production_stage_id));
                return (
                  <tr key={resource.key} className="border-t border-portal-border">
                    <td className="py-portal-2 pr-portal-2">{center?.name ?? resource.name}</td>
                    <td className="py-portal-2 pr-portal-2">{stage?.name ?? "—"}</td>
                    <td className="py-portal-2 pr-portal-2">{formatResourceRate(resource)}</td>
                    <td className="py-portal-2 pr-portal-2">{center?.is_active === false ? "Отключено" : "Активно"}</td>
                    <td className="py-portal-2">
                      <div className="flex gap-portal-2">
                        {center ? <Button type="button" size="compact" disabled={disabled || busy} onClick={() => setQuickEditId(center.id)}>Изменить</Button> : null}
                        <Button type="button" size="compact" disabled={disabled || busy} onClick={() => void unlink(resource.key)}>Отвязать</Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {linked.every((resource) => resource.work_center_id == null) ? <p className="text-portal-caption text-portal-muted">Оборудование не подключено.</p> : null}
          <div className="flex flex-wrap items-end gap-portal-3">
            <Field label="Существующее оборудование">
              <Select data-diagnostic-field="work_center_id" disabled={disabled || busy} value={connectId} onChange={(event) => setConnectId(event.target.value)}>
                <option value="">Выберите оборудование</option>
                {workCenters.filter((center) => center.is_active).map((center) => <option key={center.id} value={center.id}>{center.name}</option>)}
              </Select>
            </Field>
            <Button type="button" size="compact" disabled={disabled || busy || !connectId} onClick={() => void connectWorkCenter()}>+ Подключить оборудование</Button>
          </div>
          <p className="text-portal-caption text-portal-muted">Новое оборудование, его мощность, график и исключения задаются в каталоге «Оборудование». Здесь операция только подключается к уже настроенной записи.</p>
        </div>
      ) : null}
      {view === "schedule" ? (
        <div className="space-y-portal-4">
          <p className="text-portal-caption text-portal-muted">Часы — одно значение для всех рабочих дней. Планировщик читает те же рабочие дни и часы.</p>
          {linked.filter((resource) => resource.resource_type !== "milestone" && resource.calculation_mode !== "milestone").length === 0 ? (
            <p className="text-portal-caption text-portal-muted">Ресурсы с графиком не связаны.</p>
          ) : null}
          {linked.filter((resource) => resource.resource_type !== "milestone" && resource.calculation_mode !== "milestone").map((resource) => {
            const shown = draft?.key === resource.key ? draft : resource;
            const schedule = resourceSchedule(shown);
            const equipment = shown.work_center_id != null;
            const center = equipment ? workCenters.find((item) => item.id === shown.work_center_id) : null;
            return (
              <div key={resource.key} className="space-y-portal-2">
                <p className="font-medium">{equipment ? (center?.name ?? shown.name) : shown.name}</p>
                {schedule.workingDays.length === 0 ? <p className="text-portal-caption text-portal-muted">Не задан график работы.</p> : null}
                {schedule.hoursPerDay == null ? <p className="text-portal-caption text-portal-muted">Не указано количество рабочих часов.</p> : null}
                <table className="w-full text-left text-portal-caption">
                  <thead>
                    <tr>{["", ...WEEKDAY_LABELS_RU].map((label) => <th key={label || "kind"} className="px-portal-2 py-portal-1 font-medium">{label}</th>)}</tr>
                  </thead>
                  <tbody>
                    <tr>
                      <th className="px-portal-2 py-portal-1 text-left font-medium">Работа</th>
                      {WEEKDAY_LABELS_RU.map((_, index) => <td key={index} className="px-portal-2 py-portal-1">{schedule.workingDays.includes(index) ? "✓" : "–"}</td>)}
                    </tr>
                    <tr>
                      <th className="px-portal-2 py-portal-1 text-left font-medium">Часы</th>
                      {WEEKDAY_LABELS_RU.map((_, index) => (
                        <td key={index} className="px-portal-2 py-portal-1">{schedule.workingDays.includes(index) ? (schedule.hoursPerDay ?? "–") : "–"}</td>
                      ))}
                    </tr>
                  </tbody>
                </table>
                {equipment && center ? (
                  <Button type="button" size="compact" disabled={disabled || busy} onClick={() => setQuickEditId(center.id)}>Изменить</Button>
                ) : equipment ? null : (
                  <Button type="button" size="compact" disabled={disabled || busy} onClick={() => { setScheduleOpen(true); if (draft?.key !== shown.key) void openEditor(shown.key); }}>Изменить график</Button>
                )}
              </div>
            );
          })}
          {scheduleOpen && draft && draft.work_center_id == null ? <p className="text-portal-caption text-portal-muted">Изменения графика сохраняются вместе с ресурсом мощности.</p> : null}
        </div>
      ) : null}
      {view !== "equipment" && linked.length === 0 ? <p className="text-portal-caption text-portal-muted">Ресурсы не связаны.</p> : null}
      {view === "equipment" ? null : <ul className="space-y-portal-2">
        {linked.map((resource) => {
          const equipment = resource.work_center_id != null || resource.resource_type === "machine";
          return (
            <li key={resource.key} className="flex flex-wrap items-center justify-between gap-portal-2 rounded-portal-md border border-portal-border p-portal-3">
              <div className="min-w-0">
                <p className="font-medium">{resource.name} <span className="text-portal-caption text-portal-muted">{formatResourceRate(resource)}</span></p>
                {equipment ? <p className="text-portal-caption text-portal-muted">Мощность задаётся в каталоге оборудования.</p> : null}
                {!equipment && isSharedResource(sharedWith, resource.key) ? <p className="text-portal-caption text-portal-muted">Общий ресурс — изменения видны у всех связанных операций.</p> : null}
              </div>
              <div className="flex gap-portal-2">
                {equipment && resource.work_center_id != null && workCenters.some((center) => center.id === resource.work_center_id) ? (
                  <Button type="button" size="compact" disabled={disabled || busy} onClick={() => setQuickEditId(resource.work_center_id)}>Изменить</Button>
                ) : equipment ? null : (
                  <Button type="button" size="compact" disabled={disabled || busy} onClick={() => void openEditor(resource.key)}>Изменить</Button>
                )}
                <Button type="button" size="compact" disabled={disabled || busy} onClick={() => void unlink(resource.key)}>Отвязать</Button>
              </div>
            </li>
          );
        })}
      </ul>}
      {view === "equipment" ? null : <div className="flex flex-wrap items-end gap-portal-3">
        <Field label="Привязать ресурс мощности" help="Ресурс мощности — сотрудники, бригада или другой общий ресурс, используемый этой операцией при планировании.">
          <Select disabled={disabled || busy} value={selectedKey} onChange={(event) => setSelectedKey(event.target.value)}>
            <option value="">Выберите ресурс мощности</option>
            {available.map((resource) => <option key={resource.key} value={resource.key}>{resource.name}</option>)}
          </Select>
        </Field>
        <Button type="button" size="compact" disabled={disabled || busy || !selectedKey} onClick={() => void addExisting()}>Привязать</Button>
        <Button type="button" size="compact" disabled={disabled || busy} onClick={() => {
          setCreating(true);
          setEditingKey(null);
          baseline.current = "";
          setDraft(defaultCapacityResource("", productionStages[0]?.id ?? null));
        }}>Создать ресурс</Button>
      </div>}
      {draft && view !== "equipment" ? (
        <div className="rounded-portal-md border border-portal-border p-portal-3">
          <CapacityResourceFields
            value={draft}
            productionStages={productionStages}
            disabled={disabled || busy}
            lockKey={!creating}
            showHeading={false}
            focus={view === "full" ? "full" : view}
            markedField={draft.key === diagnosticResourceKey || diagnosticResourceKey == null ? diagnosticField : null}
            markedMessage={diagnosticMessage}
            markedTone={diagnosticTone}
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
          {draft.resource_type === "machine" || draft.work_center_id != null ? null : (
            <Button className="mt-portal-3" type="button" variant="primary" size="compact" disabled={disabled || busy} onClick={() => void saveDraft()}>
              {creating ? "Создать и связать" : "Сохранить ресурс"}
            </Button>
          )}
        </div>
      ) : null}
      <WorkCenterCapacityDialog
        workCenter={workCenters.find((center) => center.id === quickEditId) ?? null}
        onClose={() => setQuickEditId(null)}
        onSaved={onResourceSaved}
      />
    </section>
  );
}
