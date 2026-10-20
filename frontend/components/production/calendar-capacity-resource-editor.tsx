"use client";

import { useState } from "react";

import {
  deleteCapacityResourceException,
  saveCapacityResource,
  saveCapacityResourceException,
} from "@/app/(workspace)/settings/catalogs/tech-operations/capacity-resource-actions";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input } from "@/components/ui/form-controls";
import { resourceAfterException, resourceAfterExceptionRemoval, resourcesAfterSave } from "@/lib/production/capacity-live";
import { WEEKDAY_LABELS_RU } from "@/lib/production/tech-card-due-date";
import {
  efficiencyFromPercent,
  efficiencyPercentInput,
  formatEfficiencyPercent,
  showsResourceCount,
} from "@/lib/tech-operation-ux";
import {
  CALCULATION_MODE_LABEL,
  CAPACITY_UNIT_LABEL,
  toggleWorkingDay,
  validateCapacityException,
  validateCapacityResource,
  type CapacityException,
  type CapacityResource,
} from "@/lib/tech-operation-capacity";

const emptyException = (date: string): CapacityException => ({ date, unavailable: false, capacity: "", note: "" });

export function CalendarCapacityResourceEditor({
  resource,
  date,
  onSaved,
}: {
  resource: CapacityResource;
  date: string;
  onSaved: (resource: CapacityResource) => void;
}) {
  const [draft, setDraft] = useState(resource);
  const [exception, setException] = useState<CapacityException>(() => emptyException(date));
  const [exceptionDate, setExceptionDate] = useState(date);
  const [saving, setSaving] = useState<"base" | "exception" | "delete" | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  if (exceptionDate !== date) {
    setExceptionDate(date);
    setException(emptyException(date));
  }

  const milestone = draft.resource_type === "milestone" || draft.calculation_mode === "milestone";
  const percent = formatEfficiencyPercent(draft.efficiency);

  async function saveBase() {
    setSaving("base");
    setError("");
    setSaved("");
    const validationError = validateCapacityResource(draft);
    if (validationError) {
      setSaving(null);
      setError(validationError);
      return;
    }
    const result = await saveCapacityResource(draft);
    const next = resourcesAfterSave([draft], result);
    setSaving(null);
    if (next.error || !result.ok) {
      setError(next.error || "Не удалось сохранить график.");
      return;
    }
    setDraft(result.resource);
    setSaved("График сохранён и прочитан из API.");
    onSaved(result.resource);
  }

  async function saveException() {
    setSaving("exception");
    setError("");
    setSaved("");
    const validationError = validateCapacityException(exception);
    if (validationError) {
      setSaving(null);
      setError(validationError);
      return;
    }
    const result = await saveCapacityResourceException(draft.key, exception);
    const next = resourceAfterException(draft, result);
    setSaving(null);
    if (next.error || !result.ok) {
      setError(next.error || "Не удалось сохранить исключение.");
      return;
    }
    setDraft(next.resource);
    setException(emptyException(date));
    setSaved("Исключение сохранено и прочитано из API.");
    onSaved(next.resource);
  }

  async function removeException(day: string) {
    setSaving("delete");
    setError("");
    setSaved("");
    const result = await deleteCapacityResourceException(draft.key, day);
    const next = resourceAfterExceptionRemoval(draft, result.ok ? { ok: true, date: day } : result);
    setSaving(null);
    if (next.error) {
      setError(next.error);
      return;
    }
    setDraft(next.resource);
    setSaved("Исключение удалено.");
    onSaved(next.resource);
  }

  return (
    <div className="space-y-portal-4">
      <p className="text-portal-caption text-portal-muted">
        {draft.capacity_unit ? CAPACITY_UNIT_LABEL[draft.capacity_unit] : "Без единицы"}
        {" · "}
        {CALCULATION_MODE_LABEL[draft.calculation_mode]}
        . Норма и привязка к операции остаются в каталоге операций.
      </p>
      {milestone ? <p>Контрольная точка — часовая мощность и исключение не задаются.</p> : (
        <>
          <div className="grid gap-portal-3 sm:grid-cols-2">
            <Field label="Рабочих часов в день">
              <Input disabled={saving != null} inputMode="decimal" value={draft.hours_per_day ?? ""} onChange={(event) => setDraft({ ...draft, hours_per_day: event.target.value })} />
            </Field>
            <Field label="Смен в день">
              <Input disabled={saving != null} type="number" min="1" max="24" value={draft.shifts_per_day} onChange={(event) => setDraft({ ...draft, shifts_per_day: Number(event.target.value) })} />
            </Field>
            <Field label={<>Коэффициент эффективности{percent ? <span className="font-normal text-portal-muted"> {percent}</span> : null}</>}>
              <Input
                disabled={saving != null}
                inputMode="decimal"
                value={efficiencyPercentInput(draft.efficiency)}
                onChange={(event) => {
                  const next = efficiencyFromPercent(event.target.value);
                  if (next) setDraft({ ...draft, efficiency: next });
                }}
              />
            </Field>
            {showsResourceCount(draft) ? (
              <Field label="Количество сотрудников">
                <Input
                  disabled={saving != null || draft.key === "packing_team"}
                  type="number"
                  min="0"
                  value={draft.resource_count ?? ""}
                  onChange={(event) => setDraft({ ...draft, resource_count: event.target.value === "" ? null : Number(event.target.value) })}
                />
              </Field>
            ) : null}
          </div>
          <fieldset className="space-y-portal-2">
            <legend className="text-portal-caption font-medium">Рабочие дни</legend>
            <div className="flex flex-wrap gap-portal-2">
              {WEEKDAY_LABELS_RU.map((label, day) => (
                <Checkbox
                  key={label}
                  label={label}
                  disabled={saving != null}
                  checked={draft.working_days.includes(day)}
                  onChange={() => setDraft({ ...draft, working_days: toggleWorkingDay(draft.working_days, day) })}
                />
              ))}
            </div>
          </fieldset>
          <Checkbox
            label="Учитывать при планировании"
            disabled={saving != null}
            checked={draft.include_in_calendar_load}
            onChange={(event) => setDraft({ ...draft, include_in_calendar_load: event.target.checked })}
          />
          <Button type="button" disabled={saving != null} onClick={() => void saveBase()}>
            {saving === "base" ? "Сохранение…" : "Сохранить график"}
          </Button>
          <section className="space-y-portal-3" aria-label="Исключение на дату">
            <h3 className="font-medium">Исключение на дату</h3>
            <div className="grid gap-portal-3 sm:grid-cols-2">
              <Field label="Дата">
                <Input disabled={saving != null} type="date" value={exception.date} onChange={(event) => setException({ ...exception, date: event.target.value })} />
              </Field>
              <Field label="Мощность на дату">
                <Input disabled={saving != null || exception.unavailable} inputMode="decimal" value={exception.capacity ?? ""} onChange={(event) => setException({ ...exception, capacity: event.target.value })} />
              </Field>
            </div>
            <Checkbox
              label="Недоступен"
              disabled={saving != null}
              checked={exception.unavailable}
              onChange={(event) => setException({ ...exception, unavailable: event.target.checked, capacity: event.target.checked ? null : exception.capacity })}
            />
            <Field label="Примечание">
              <Input disabled={saving != null} maxLength={2000} value={exception.note ?? ""} onChange={(event) => setException({ ...exception, note: event.target.value })} />
            </Field>
            <Button type="button" variant="secondary" disabled={saving != null} onClick={() => void saveException()}>
              {saving === "exception" ? "Сохранение…" : "Сохранить исключение"}
            </Button>
            <ul className="space-y-portal-2">
              {draft.exceptions.map((item) => (
                <li key={item.date} className="flex flex-wrap items-center justify-between gap-portal-2 text-portal-caption">
                  <span>{item.date}: {item.unavailable ? "недоступен" : item.capacity ?? "—"}{item.note ? ` · ${item.note}` : ""}</span>
                  <Button type="button" size="compact" variant="ghost" disabled={saving != null} onClick={() => void removeException(item.date)}>Удалить</Button>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
      {error ? <p role="alert" className="text-portal-danger">{error}</p> : null}
      {saved ? <p role="status">{saved}</p> : null}
    </div>
  );
}
