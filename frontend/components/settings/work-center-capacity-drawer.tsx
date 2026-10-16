"use client";

import { useEffect, useRef, useState } from "react";

import {
  deleteWorkCenterCapacityException,
  loadWorkCenterCapacity,
  saveWorkCenterCapacity,
  saveWorkCenterCapacityException,
} from "@/app/(workspace)/settings/catalogs/work-centers/work-center-actions";
import { Button } from "@/components/ui/button";
import { CreateDrawer } from "@/components/ui/create-drawer";
import { Checkbox, Field, Input, Select } from "@/components/ui/form-controls";
import { WEEKDAY_LABELS_RU } from "@/lib/production/tech-card-due-date";
import type { WorkCenter } from "@/lib/shop-routings";
import {
  CAPACITY_UNIT_LABEL,
  removeCapacityException,
  toggleWorkingDay,
  upsertCapacityException,
  validateCapacityException,
  type CapacityException,
  type CapacityResource,
  type CapacityUnit,
} from "@/lib/tech-operation-capacity";
import { efficiencyFromPercent, efficiencyPercentInput, formatEfficiencyPercent, resourceCalculationGuide } from "@/lib/tech-operation-ux";

const MACHINE_UNITS = ["linear_meter", "item", "machine_hour"] as const;

type EquipmentDraft = {
  key: string;
  capacity_unit: (typeof MACHINE_UNITS)[number];
  base_rate: string | null;
  hours_per_day: string | null;
  shifts_per_day: number;
  efficiency: string;
  working_days: number[];
  include_in_calendar_load: boolean;
  note: string | null;
  exceptions: CapacityException[];
};

const emptyException = (): CapacityException => ({ date: "", unavailable: false, capacity: "", note: "" });

function emptyDraft(): EquipmentDraft {
  return {
    key: "",
    capacity_unit: "linear_meter",
    base_rate: null,
    hours_per_day: null,
    shifts_per_day: 1,
    efficiency: "1",
    working_days: [0, 1, 2, 3, 4],
    include_in_calendar_load: true,
    note: null,
    exceptions: [],
  };
}

function fromResource(resource: CapacityResource): EquipmentDraft {
  const unit = MACHINE_UNITS.includes(resource.capacity_unit as (typeof MACHINE_UNITS)[number])
    ? resource.capacity_unit as (typeof MACHINE_UNITS)[number]
    : "linear_meter";
  return {
    key: resource.key,
    capacity_unit: unit,
    base_rate: resource.base_rate,
    hours_per_day: resource.hours_per_day,
    shifts_per_day: resource.shifts_per_day,
    efficiency: resource.efficiency,
    working_days: resource.working_days,
    include_in_calendar_load: resource.include_in_calendar_load,
    note: resource.note,
    exceptions: resource.exceptions,
  };
}

function asResource(center: WorkCenter, draft: EquipmentDraft): CapacityResource {
  const hourly = draft.capacity_unit === "machine_hour";
  return {
    key: draft.key || `work_center_${center.id}`,
    name: center.name,
    production_stage_id: center.production_stage_id,
    work_center_id: center.id,
    resource_type: "machine",
    capacity_unit: draft.capacity_unit,
    base_rate: hourly ? null : draft.base_rate,
    resource_count: null,
    hours_per_day: draft.hours_per_day,
    shifts_per_day: draft.shifts_per_day,
    efficiency: draft.efficiency,
    working_days: draft.working_days,
    include_in_calendar_load: draft.include_in_calendar_load,
    calculation_mode: hourly ? "explicit_hours" : "rate",
    note: draft.note,
    exceptions: draft.exceptions,
  };
}

function WorkCenterCapacityForm({
  workCenter,
  onClose,
  onSaved,
}: {
  workCenter: WorkCenter;
  onClose: () => void;
  onSaved?: (resource: CapacityResource) => void;
}) {
  const [draft, setDraft] = useState<EquipmentDraft>(emptyDraft);
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [exception, setException] = useState<{ draft: CapacityException; error: string }>({ draft: emptyException(), error: "" });

  useEffect(() => {
    let cancelled = false;
    void loadWorkCenterCapacity(workCenter.id).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setDraft(fromResource(result.resource));
        setConfigured(true);
      } else if (result.missing) {
        setDraft(emptyDraft());
        setConfigured(false);
      } else {
        setDraft(emptyDraft());
        setError(result.message);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [workCenter.id]);

  async function save() {
    if (!workCenter) return;
    setSaving(true);
    setError("");
    const result = await saveWorkCenterCapacity(workCenter.id, asResource(workCenter, draft));
    setSaving(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setDraft(fromResource(result.resource));
    setConfigured(true);
    onSaved?.(result.resource);
  }

  async function addException() {
    if (!workCenter) return;
    const next = { ...exception.draft, capacity: exception.draft.unavailable ? null : exception.draft.capacity };
    const validationError = validateCapacityException(next);
    if (validationError) {
      setException({ draft: exception.draft, error: validationError });
      return;
    }
    setSaving(true);
    const result = await saveWorkCenterCapacityException(workCenter.id, next);
    setSaving(false);
    if (!result.ok) {
      setException({ draft: exception.draft, error: result.message });
      return;
    }
    setDraft((current) => ({ ...current, exceptions: upsertCapacityException(current.exceptions, result.exception) }));
    setException({ draft: emptyException(), error: "" });
  }

  async function removeException(date: string) {
    if (!workCenter) return;
    setSaving(true);
    setError("");
    const result = await deleteWorkCenterCapacityException(workCenter.id, date);
    setSaving(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setDraft((current) => ({ ...current, exceptions: removeCapacityException(current.exceptions, date) }));
  }

  const guide = resourceCalculationGuide(asResource(workCenter, draft));
  const hourly = draft.capacity_unit === "machine_hour";
  const efficiencyPercent = formatEfficiencyPercent(draft.efficiency);

  return (
    <div className="flex min-h-0 flex-col">
          <div className="min-h-0 flex-1 space-y-portal-4 overflow-y-auto p-portal-6">
            {error ? <p role="alert" className="text-portal-body text-portal-danger">{error}</p> : null}
            {loading ? <p className="text-portal-body text-portal-muted">Загрузка мощности…</p> : null}
            {workCenter.production_stage_id == null ? (
              <p className="text-portal-body">Сначала привяжите оборудование к цеху. Мощность хранится только на оборудовании.</p>
            ) : (
              <>
                <section className="space-y-portal-2 rounded-portal-md border border-portal-border p-portal-3" aria-label="Как считается">
                  <h3 className="font-medium">Как считается</h3>
                  <p className="text-portal-caption"><span className="font-medium">Как определяется потребность заказа. </span>{guide.demand}</p>
                  {guide.capacity ? <p className="text-portal-caption"><span className="font-medium">Как определяется доступная мощность. </span>{guide.capacity}</p> : null}
                  {guide.notes.map((note) => <p key={note} className="text-portal-caption text-portal-muted">{note}</p>)}
                </section>
                <div className="grid gap-portal-4 sm:grid-cols-2">
                  <Field label="В чём измеряется загрузка" help="чел.-ч — труд сотрудников; шт. — изделия; м.п. — погонные метры; маш.-ч — время оборудования.">
                    <Select
                      disabled={saving || loading}
                      value={draft.capacity_unit}
                      onChange={(event) => {
                        const capacity_unit = event.target.value as CapacityUnit & (typeof MACHINE_UNITS)[number];
                        setDraft((current) => ({
                          ...current,
                          capacity_unit,
                          base_rate: capacity_unit === "machine_hour" ? null : current.base_rate,
                        }));
                      }}
                    >
                      {MACHINE_UNITS.map((unit) => <option key={unit} value={unit}>{CAPACITY_UNIT_LABEL[unit]}</option>)}
                    </Select>
                  </Field>
                  {hourly ? null : (
                    <Field label="Производительность в час" required help="Сколько единиц ресурс способен выполнить за один час.">
                      <Input disabled={saving || loading} inputMode="decimal" title="Сколько единиц ресурс способен выполнить за один час." value={draft.base_rate ?? ""} onChange={(event) => setDraft((current) => ({ ...current, base_rate: event.target.value }))} />
                    </Field>
                  )}
                  <Field label="Рабочих часов в день" help="Сколько часов ресурс доступен в обычный рабочий день.">
                    <Input disabled={saving || loading} inputMode="decimal" title="Используется только для расчёта доступной мощности ресурса." value={draft.hours_per_day ?? ""} onChange={(event) => setDraft((current) => ({ ...current, hours_per_day: event.target.value }))} />
                  </Field>
                  <Field label="Смен в день" help="Используется при расчёте доступной мощности за день.">
                    <Input disabled={saving || loading} type="number" min="1" max="24" value={draft.shifts_per_day} onChange={(event) => setDraft((current) => ({ ...current, shifts_per_day: Number(event.target.value) }))} />
                  </Field>
                  <Field label={<>Коэффициент эффективности{efficiencyPercent ? <span className="font-normal text-portal-muted"> {efficiencyPercent}</span> : null}</>} help="Учитывает плановые потери рабочего времени. 1,00 = 100%.">
                    <Input
                      disabled={saving || loading}
                      inputMode="decimal"
                      title="Плановая доля полезного рабочего времени."
                      value={efficiencyPercentInput(draft.efficiency)}
                      onChange={(event) => {
                        const next = efficiencyFromPercent(event.target.value);
                        if (next) setDraft((current) => ({ ...current, efficiency: next }));
                      }}
                    />
                  </Field>
                  <div>
                    <Checkbox label="Учитывать при планировании" checked={draft.include_in_calendar_load} disabled={saving || loading} onChange={(event) => setDraft((current) => ({ ...current, include_in_calendar_load: event.target.checked }))} />
                    <p className="text-portal-caption text-portal-muted">Если выключено, Scheduler не резервирует мощность этого ресурса.</p>
                  </div>
                </div>
                <fieldset disabled={saving || loading} className="space-y-portal-2">
                  <legend className="text-portal-caption font-medium text-portal-muted">Рабочие дни</legend>
                  <div className="flex flex-wrap gap-portal-2">
                    {WEEKDAY_LABELS_RU.map((label, index) => (
                      <Checkbox key={label} label={label} checked={draft.working_days.includes(index)} onChange={() => setDraft((current) => ({ ...current, working_days: toggleWorkingDay(current.working_days, index) }))} />
                    ))}
                  </div>
                </fieldset>
                <Field label="Примечание">
                  <Input disabled={saving || loading} maxLength={2000} value={draft.note ?? ""} onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))} />
                </Field>
                <section className="space-y-portal-3" aria-label="Исключения по датам">
                  <h3 className="font-medium">Исключения по датам</h3>
                  {configured ? null : <p className="text-portal-caption text-portal-muted">Сначала сохраните мощность. Исключения хранятся на этом оборудовании.</p>}
                  <div className="grid gap-portal-3 sm:grid-cols-2">
                    <Field label="Дата">
                      <Input disabled={!configured || saving} type="date" value={exception.draft.date} onChange={(event) => setException({ draft: { ...exception.draft, date: event.target.value }, error: "" })} />
                    </Field>
                    <Field label="Мощность на дату">
                      <Input disabled={!configured || saving || exception.draft.unavailable} inputMode="decimal" value={exception.draft.capacity ?? ""} onChange={(event) => setException({ draft: { ...exception.draft, capacity: event.target.value }, error: "" })} />
                    </Field>
                    <Checkbox
                      label="Недоступно"
                      checked={exception.draft.unavailable}
                      disabled={!configured || saving}
                      onChange={(event) => setException({
                        draft: { ...exception.draft, unavailable: event.target.checked, capacity: event.target.checked ? null : exception.draft.capacity },
                        error: "",
                      })}
                    />
                    <Field label="Комментарий">
                      <Input disabled={!configured || saving} maxLength={2000} value={exception.draft.note ?? ""} onChange={(event) => setException({ draft: { ...exception.draft, note: event.target.value }, error: "" })} />
                    </Field>
                  </div>
                  {exception.error ? <p role="alert" className="text-portal-caption text-portal-danger">{exception.error}</p> : null}
                  <Button type="button" size="compact" disabled={!configured || saving} onClick={() => void addException()}>+ Добавить исключение</Button>
                  <ul className="space-y-portal-2">
                    {draft.exceptions.map((item) => (
                      <li key={item.date} className="flex items-center justify-between gap-portal-3 text-portal-caption">
                        <span>{item.date} · {item.unavailable ? "недоступно" : item.capacity}{item.note ? ` · ${item.note}` : ""}</span>
                        <Button type="button" size="compact" disabled={saving} onClick={() => void removeException(item.date)}>Удалить</Button>
                      </li>
                    ))}
                  </ul>
                </section>
              </>
            )}
          </div>
          <footer className="flex justify-end gap-portal-2 border-t border-portal-border bg-portal-surface px-portal-6 py-portal-4">
            <Button type="button" onClick={onClose} disabled={saving}>Закрыть</Button>
            {workCenter.production_stage_id == null ? null : (
              <Button type="button" variant="primary" disabled={saving || loading} onClick={() => void save()}>
                {saving ? "Сохранение…" : "Сохранить мощность"}
              </Button>
            )}
          </footer>
    </div>
  );
}

export function WorkCenterCapacityDrawer({
  workCenter,
  onClose,
  onSaved,
}: {
  workCenter: WorkCenter | null;
  onClose: () => void;
  onSaved?: (resource: CapacityResource) => void;
}) {
  return (
    <CreateDrawer
      open={workCenter != null}
      title="Мощность оборудования"
      description={workCenter ? workCenter.name : "Мощность хранится на оборудовании"}
      onClose={onClose}
      variant="overlay"
    >
      {workCenter == null ? null : <WorkCenterCapacityForm key={workCenter.id} workCenter={workCenter} onClose={onClose} onSaved={onSaved} />}
    </CreateDrawer>
  );
}

/** Nested dialog for the operation modal. Stays in the parent dialog so it is not hidden behind it. */
export function WorkCenterCapacityDialog({
  workCenter,
  onClose,
  onSaved,
}: {
  workCenter: WorkCenter | null;
  onClose: () => void;
  onSaved?: (resource: CapacityResource) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || workCenter == null) return;
    if (!dialog.open) dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, [workCenter]);
  if (workCenter == null) return null;
  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="work-center-capacity-title"
      className="fixed inset-0 m-auto max-h-[calc(100dvh_-_2rem)] w-[calc(100%_-_2rem)] max-w-xl overflow-y-auto rounded-portal-lg border border-portal-border bg-portal-surface p-0 text-portal-text shadow-portal-overlay backdrop:bg-[#101828]/40"
      onCancel={(event) => { event.preventDefault(); onClose(); }}
    >
      <div className="border-b border-portal-border px-portal-4 py-portal-4">
        <h2 id="work-center-capacity-title" className="text-portal-section font-semibold">Мощность оборудования</h2>
        <p className="mt-1 text-portal-caption text-portal-muted">{workCenter.name}</p>
      </div>
      <WorkCenterCapacityForm key={workCenter.id} workCenter={workCenter} onClose={onClose} onSaved={onSaved} />
    </dialog>
  );
}
