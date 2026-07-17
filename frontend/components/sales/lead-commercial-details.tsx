"use client";

import { useState } from "react";

import { saveLeadCommercialDetails } from "@/app/(workspace)/sales/leads/[leadId]/lead-commercial-actions";
import { Button } from "@/components/ui/button";
import {
  formatCommercialDate,
  formatCurrency,
  formatQuantity,
  getEventDateWarning,
  parseNonNegativeNumber,
  parsePercent,
  parsePositiveInteger,
  validateCommercialDates,
} from "@/lib/sales/lead-commercial";
import {
  deliveryMethods,
  leadDirections,
  productCategories,
  productTypes,
  sports,
  type LeadCommercialDetailsData,
  type Priority,
} from "@/types/sales";

const fieldClass = "mt-1 h-10 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
const priorityOptions: ReadonlyArray<{ value: Priority; label: string }> = [
  { value: "low", label: "Низкий" },
  { value: "medium", label: "Средний" },
  { value: "high", label: "Высокий" },
  { value: "urgent", label: "Срочный" },
];
const priorityLabels = Object.fromEntries(priorityOptions.map((option) => [option.value, option.label])) as Record<Priority, string>;
const priorityClasses: Record<Priority, string> = {
  low: "bg-slate-100 text-slate-700",
  medium: "bg-amber-50 text-amber-800",
  high: "bg-orange-50 text-orange-800",
  urgent: "bg-red-50 text-red-700",
};

type CommercialDraft = {
  direction: string;
  sport: string;
  productCategory: string;
  productType: string;
  needDescription: string;
  estimatedQuantity: string;
  kitQuantity: string;
  sizeComment: string;
  preliminaryBudget: string;
  estimatedAmount: string;
  discountPercent: string;
  probability: string;
  plannedOrderDate: string;
  desiredReadyDate: string;
  eventDate: string;
  deliveryCity: string;
  deliveryAddress: string;
  deliveryMethod: string;
  deliveryComment: string;
  source: string;
  campaign: string;
  utmDescription: string;
  priority: string;
};

type CommercialErrors = Partial<Record<
  "estimatedQuantity" | "kitQuantity" | "preliminaryBudget" | "estimatedAmount" | "discountPercent" | "probability" | "desiredReadyDate",
  string
>>;

type LeadCommercialChange = {
  commercial: LeadCommercialDetailsData;
  source: string | null;
  estimatedAmount: number | null;
  probability: number | null;
};

function optionalText(value: string) {
  return value.trim() || undefined;
}

function createDraft(
  commercial: LeadCommercialDetailsData,
  source: string | null,
  estimatedAmount: number | null,
  probability: number | null,
): CommercialDraft {
  return {
    direction: commercial.direction ?? "",
    sport: commercial.sport ?? "",
    productCategory: commercial.productCategory ?? "",
    productType: commercial.productType ?? "",
    needDescription: commercial.needDescription ?? "",
    estimatedQuantity: commercial.estimatedQuantity?.toString() ?? "",
    kitQuantity: commercial.kitQuantity?.toString() ?? "",
    sizeComment: commercial.sizeComment ?? "",
    preliminaryBudget: commercial.preliminaryBudget?.toString() ?? "",
    estimatedAmount: estimatedAmount?.toString() ?? "",
    discountPercent: commercial.discountPercent?.toString() ?? "",
    probability: probability?.toString() ?? "",
    plannedOrderDate: commercial.plannedOrderDate ?? "",
    desiredReadyDate: commercial.desiredReadyDate ?? "",
    eventDate: commercial.eventDate ?? "",
    deliveryCity: commercial.deliveryCity ?? "",
    deliveryAddress: commercial.deliveryAddress ?? "",
    deliveryMethod: commercial.deliveryMethod ?? "",
    deliveryComment: commercial.deliveryComment ?? "",
    source: source ?? "",
    campaign: commercial.campaign ?? "",
    utmDescription: commercial.utmDescription ?? "",
    priority: commercial.priority ?? "",
  };
}

function display(value?: string | null) {
  return value?.trim() || "Не указано";
}

function DataItem({ label, children, emphasized = false }: { label: string; children: React.ReactNode; emphasized?: boolean }) {
  return (
    <div className="lead-detail-pair min-w-0">
      <dt className="min-w-0 text-xs font-medium text-slate-500">{label}</dt>
      <dd className={`mt-1 min-w-0 break-words ${emphasized ? "text-base font-semibold text-slate-950" : "text-sm font-medium text-slate-900"}`}>{children}</dd>
    </div>
  );
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="border-t border-slate-200 pt-4 first:border-t-0 first:pt-0">
      <legend className="mb-3 text-sm font-semibold text-slate-950">{title}</legend>
      <div className="grid min-w-0 gap-3 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

function TextField({ id, label, value, type = "text", min, max, step, error, onChange }: {
  id: string;
  label: string;
  value: string;
  type?: "text" | "date" | "number";
  min?: number;
  max?: number;
  step?: number;
  error?: string;
  onChange: (value: string) => void;
}) {
  const errorId = `${id}-error`;
  return (
    <label htmlFor={id} className="min-w-0 text-sm font-medium text-slate-700">
      {label}
      <input
        id={id}
        type={type}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={fieldClass}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
      />
      {error ? <span id={errorId} className="mt-1 block text-xs text-red-700">{error}</span> : null}
    </label>
  );
}

function SelectField({ id, label, value, options, onChange }: {
  id: string;
  label: string;
  value: string;
  options: ReadonlyArray<string | { value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label htmlFor={id} className="min-w-0 text-sm font-medium text-slate-700">
      {label}
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)} className={fieldClass}>
        <option value="">Не указано</option>
        {options.map((option) => {
          const value = typeof option === "string" ? option : option.value;
          const label = typeof option === "string" ? option : option.label;
          return <option key={value} value={value}>{label}</option>;
        })}
      </select>
    </label>
  );
}

export function LeadCommercialDetails({
  commercial,
  source,
  estimatedAmount,
  probability,
  leadId,
  persistence,
  onChange,
  embedded = false,
  compact = false,
}: {
  commercial: LeadCommercialDetailsData;
  source: string | null;
  estimatedAmount: number | null;
  probability: number | null;
  leadId: string;
  persistence: "api" | "local";
  onChange: (change: LeadCommercialChange) => void;
  embedded?: boolean;
  compact?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => createDraft(commercial, source, estimatedAmount, probability));
  const [errors, setErrors] = useState<CommercialErrors>({});
  const [notice, setNotice] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);

  function updateDraft(field: keyof CommercialDraft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setNotice("");
    setSaveError("");
  }

  function startEditing() {
    setDraft(createDraft(commercial, source, estimatedAmount, probability));
    setErrors({});
    setNotice("");
    setSaveError("");
    setEditing(true);
  }

  function cancelEditing() {
    setDraft(createDraft(commercial, source, estimatedAmount, probability));
    setErrors({});
    setSaveError("");
    setEditing(false);
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const estimatedQuantity = parsePositiveInteger(draft.estimatedQuantity);
    const kitQuantity = parsePositiveInteger(draft.kitQuantity);
    const preliminaryBudget = parseNonNegativeNumber(draft.preliminaryBudget);
    const nextEstimatedAmount = parseNonNegativeNumber(draft.estimatedAmount);
    const discountPercent = parsePercent(draft.discountPercent);
    const nextProbability = parsePercent(draft.probability);
    const desiredReadyDateError = validateCommercialDates(draft.plannedOrderDate, draft.desiredReadyDate);
    const nextErrors: CommercialErrors = {
      estimatedQuantity: estimatedQuantity.error,
      kitQuantity: kitQuantity.error,
      preliminaryBudget: preliminaryBudget.error,
      estimatedAmount: nextEstimatedAmount.error,
      discountPercent: discountPercent.error,
      probability: nextProbability.error,
      desiredReadyDate: desiredReadyDateError,
    };
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) {
      return;
    }

    let change: LeadCommercialChange = {
      source: draft.source.trim() || null,
      estimatedAmount: nextEstimatedAmount.value ?? null,
      probability: nextProbability.value ?? null,
      commercial: {
        direction: draft.direction ? draft.direction as LeadCommercialDetailsData["direction"] : undefined,
        sport: draft.sport ? draft.sport as LeadCommercialDetailsData["sport"] : undefined,
        productCategory: draft.productCategory ? draft.productCategory as LeadCommercialDetailsData["productCategory"] : undefined,
        productType: draft.productType ? draft.productType as LeadCommercialDetailsData["productType"] : undefined,
        needDescription: optionalText(draft.needDescription),
        estimatedQuantity: estimatedQuantity.value,
        kitQuantity: kitQuantity.value,
        sizeComment: optionalText(draft.sizeComment),
        preliminaryBudget: preliminaryBudget.value,
        discountPercent: discountPercent.value,
        plannedOrderDate: optionalText(draft.plannedOrderDate),
        desiredReadyDate: optionalText(draft.desiredReadyDate),
        eventDate: optionalText(draft.eventDate),
        deliveryCity: optionalText(draft.deliveryCity),
        deliveryAddress: optionalText(draft.deliveryAddress),
        deliveryMethod: draft.deliveryMethod ? draft.deliveryMethod as LeadCommercialDetailsData["deliveryMethod"] : undefined,
        deliveryComment: optionalText(draft.deliveryComment),
        campaign: optionalText(draft.campaign),
        utmDescription: optionalText(draft.utmDescription),
        priority: draft.priority ? draft.priority as Priority : undefined,
      },
    };

    if (persistence === "api") {
      setSaving(true);
      setSaveError("");
      const result = await saveLeadCommercialDetails(leadId, {
        source: change.source,
        sport: change.commercial.sport,
        productCategory: change.commercial.productCategory,
        needDescription: change.commercial.needDescription,
        estimatedQuantity: change.commercial.estimatedQuantity,
        estimatedAmount: change.estimatedAmount,
        desiredReadyDate: change.commercial.desiredReadyDate,
        deliveryCity: change.commercial.deliveryCity,
      });
      setSaving(false);
      if (!result.ok) {
        setSaveError(result.message);
        return;
      }
      change = {
        ...change,
        source: result.persisted.source,
        estimatedAmount: result.persisted.estimatedAmount,
        commercial: { ...change.commercial, ...result.persisted.commercial },
      };
    }

    onChange(change);
    setEditing(false);
    setNotice(persistence === "api"
      ? "Основные коммерческие параметры сохранены в backend. Расширенные поля пока локальны."
      : "Demo-режим: коммерческие параметры сохранены только локально.");
  }

  const hasData = Boolean(
    Object.values(commercial).some((value) => value !== undefined && value !== "")
    || source
    || estimatedAmount !== null
    || probability !== null,
  );
  const dateWarning = getEventDateWarning(commercial.desiredReadyDate ?? "", commercial.eventDate ?? "");

  return (
    <section className={`${embedded ? `min-w-0 ${compact ? "p-3.5" : "p-4 sm:p-5"}` : "min-w-0 rounded-xl border border-slate-200 bg-white p-4 sm:p-5"} lead-commercial-details ${compact ? "lead-compact-details" : ""}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-bold text-slate-950">{compact ? "B) Потребность клиента" : "Коммерческие параметры"}</h2>
          {!compact ? <p className="mt-1 text-sm text-slate-500">Потребность клиента и предварительные условия будущего заказа.</p> : null}
        </div>
        {!editing && hasData ? <Button type="button" onClick={startEditing} className={compact ? "h-8 px-2.5 text-xs" : ""}>Редактировать</Button> : null}
      </div>

      {editing ? (
        <form onSubmit={save} className="mt-4 space-y-5">
          <FormSection title="Классификация потребности">
            <SelectField id="commercial-direction" label="Направление" value={draft.direction} options={leadDirections} onChange={(value) => updateDraft("direction", value)} />
            <SelectField id="commercial-sport" label="Вид спорта" value={draft.sport} options={sports} onChange={(value) => updateDraft("sport", value)} />
            <SelectField id="commercial-category" label="Категория продукции" value={draft.productCategory} options={productCategories} onChange={(value) => updateDraft("productCategory", value)} />
            <SelectField id="commercial-product" label="Тип продукции" value={draft.productType} options={productTypes} onChange={(value) => updateDraft("productType", value)} />
            <label htmlFor="commercial-description" className="min-w-0 text-sm font-medium text-slate-700 sm:col-span-2">
              Описание потребности
              <textarea id="commercial-description" rows={4} maxLength={3000} value={draft.needDescription} onChange={(event) => updateDraft("needDescription", event.target.value)} className="mt-1 w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
              <span className="mt-1 block text-right text-xs text-slate-500">{draft.needDescription.length} / 3000</span>
            </label>
          </FormSection>

          <FormSection title="Количество и бюджет">
            <TextField id="commercial-quantity" label="Количество изделий" type="number" min={1} step={1} value={draft.estimatedQuantity} error={errors.estimatedQuantity} onChange={(value) => updateDraft("estimatedQuantity", value)} />
            <TextField id="commercial-kit-quantity" label="Количество комплектов" type="number" min={1} step={1} value={draft.kitQuantity} error={errors.kitQuantity} onChange={(value) => updateDraft("kitQuantity", value)} />
            <TextField id="commercial-budget" label="Предварительный бюджет, ₽" type="number" min={0} step={0.01} value={draft.preliminaryBudget} error={errors.preliminaryBudget} onChange={(value) => updateDraft("preliminaryBudget", value)} />
            <TextField id="commercial-amount" label="Предполагаемая сумма, ₽" type="number" min={0} step={0.01} value={draft.estimatedAmount} error={errors.estimatedAmount} onChange={(value) => updateDraft("estimatedAmount", value)} />
            <TextField id="commercial-discount" label="Скидка, %" type="number" min={0} max={100} step={0.01} value={draft.discountPercent} error={errors.discountPercent} onChange={(value) => updateDraft("discountPercent", value)} />
            <TextField id="commercial-probability" label="Вероятность сделки, %" type="number" min={0} max={100} step={0.01} value={draft.probability} error={errors.probability} onChange={(value) => updateDraft("probability", value)} />
            <div className="sm:col-span-2"><TextField id="commercial-sizes" label="Размерный ряд или комментарий" value={draft.sizeComment} onChange={(value) => updateDraft("sizeComment", value)} /></div>
          </FormSection>

          <FormSection title="Сроки">
            <TextField id="commercial-order-date" label="Планируемая дата заказа" type="date" value={draft.plannedOrderDate} onChange={(value) => updateDraft("plannedOrderDate", value)} />
            <TextField id="commercial-ready-date" label="Желаемая дата готовности" type="date" value={draft.desiredReadyDate} error={errors.desiredReadyDate} onChange={(value) => updateDraft("desiredReadyDate", value)} />
            <TextField id="commercial-event-date" label="Дата мероприятия" type="date" value={draft.eventDate} onChange={(value) => updateDraft("eventDate", value)} />
            {getEventDateWarning(draft.desiredReadyDate, draft.eventDate) ? <p className="text-sm text-amber-800 sm:col-span-2" role="status">{getEventDateWarning(draft.desiredReadyDate, draft.eventDate)}</p> : null}
          </FormSection>

          <FormSection title="Доставка">
            <TextField id="commercial-delivery-city" label="Город доставки" value={draft.deliveryCity} onChange={(value) => updateDraft("deliveryCity", value)} />
            <TextField id="commercial-delivery-address" label="Адрес доставки" value={draft.deliveryAddress} onChange={(value) => updateDraft("deliveryAddress", value)} />
            <SelectField id="commercial-delivery-method" label="Способ доставки" value={draft.deliveryMethod} options={deliveryMethods} onChange={(value) => updateDraft("deliveryMethod", value)} />
            <div className="sm:col-span-2"><TextField id="commercial-delivery-comment" label="Комментарий по доставке" value={draft.deliveryComment} onChange={(value) => updateDraft("deliveryComment", value)} /></div>
          </FormSection>

          <FormSection title="Источник и приоритет">
            <TextField id="commercial-source" label="Источник лида" value={draft.source} onChange={(value) => updateDraft("source", value)} />
            <TextField id="commercial-campaign" label="Рекламная кампания" value={draft.campaign} onChange={(value) => updateDraft("campaign", value)} />
            <SelectField id="commercial-priority" label="Приоритет" value={draft.priority} options={priorityOptions} onChange={(value) => updateDraft("priority", value)} />
            <div className="sm:col-span-2"><TextField id="commercial-utm" label="Метка или UTM-описание" value={draft.utmDescription} onChange={(value) => updateDraft("utmDescription", value)} /></div>
          </FormSection>

          {persistence === "api" ? (
            <p className="text-xs text-slate-500">Backend сохраняет вид спорта, категорию, описание, количество, сумму, дату готовности, источник и город. Остальные поля остаются в текущей сессии.</p>
          ) : null}
          {saveError ? <p className="text-sm text-red-700" role="alert">{saveError}</p> : null}

          <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
            <Button type="button" onClick={cancelEditing} disabled={saving}>Отмена</Button>
            <Button type="submit" variant="primary" disabled={saving}>{saving ? "Сохранение…" : "Сохранить"}</Button>
          </div>
        </form>
      ) : hasData ? (
        <div className="mt-4 space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-950">Потребность</h3>
            <dl className="mt-2.5 grid gap-x-5 gap-y-3 sm:grid-cols-2">
              <DataItem label="Направление">{display(commercial.direction)}</DataItem>
              <DataItem label="Вид спорта">{display(commercial.sport)}</DataItem>
              <DataItem label="Категория">{display(commercial.productCategory)}</DataItem>
              <DataItem label="Тип продукции">{display(commercial.productType)}</DataItem>
              <DataItem label="Количество изделий">{formatQuantity(commercial.estimatedQuantity)}</DataItem>
              <DataItem label="Количество комплектов">{formatQuantity(commercial.kitQuantity, "kit")}</DataItem>
              <div className="sm:col-span-2"><DataItem label="Размеры">{display(commercial.sizeComment)}</DataItem></div>
            </dl>
          </div>
          <div className="border-t border-slate-200 pt-3">
            <h3 className="text-sm font-semibold text-slate-950">Финансовые параметры</h3>
            <dl className="mt-2.5 grid gap-x-5 gap-y-3 sm:grid-cols-2">
              <DataItem label="Предварительный бюджет" emphasized>{formatCurrency(commercial.preliminaryBudget)}</DataItem>
              <DataItem label="Предполагаемая сумма" emphasized>{formatCurrency(estimatedAmount)}</DataItem>
              <DataItem label="Скидка" emphasized>{commercial.discountPercent === undefined ? "Не указано" : `${commercial.discountPercent}%`}</DataItem>
              <DataItem label="Вероятность" emphasized>{probability === null ? "Не указано" : `${probability}%`}</DataItem>
            </dl>
          </div>
          <details open={!compact} className="border-t border-slate-200 pt-3">
            <summary className={`${compact ? "cursor-pointer text-xs font-semibold text-blue-700" : "sr-only"}`}>Дополнительные коммерческие параметры</summary>
          <div className={`${compact ? "mt-3" : ""} grid gap-5 sm:grid-cols-2`}>
            <div>
              <h3 className="text-sm font-semibold text-slate-950">Сроки</h3>
              <dl className="mt-3 grid gap-4 sm:grid-cols-2">
                <DataItem label="Дата заказа">{formatCommercialDate(commercial.plannedOrderDate)}</DataItem>
                <DataItem label="Дата готовности">{formatCommercialDate(commercial.desiredReadyDate)}</DataItem>
                <DataItem label="Дата мероприятия">{formatCommercialDate(commercial.eventDate)}</DataItem>
              </dl>
              {dateWarning ? <p className="mt-3 text-sm text-amber-800">{dateWarning}</p> : null}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-950">Доставка</h3>
              <dl className="mt-3 grid gap-4 sm:grid-cols-2">
                <DataItem label="Город">{display(commercial.deliveryCity)}</DataItem>
                <DataItem label="Способ">{display(commercial.deliveryMethod)}</DataItem>
                <div className="sm:col-span-2"><DataItem label="Адрес">{display(commercial.deliveryAddress)}</DataItem></div>
                <div className="sm:col-span-2"><DataItem label="Комментарий">{display(commercial.deliveryComment)}</DataItem></div>
              </dl>
            </div>
          </div>
          <div className="mt-4 border-t border-slate-200 pt-4">
            <h3 className="text-sm font-semibold text-slate-950">Источник и приоритет</h3>
            <dl className="mt-2.5 grid gap-x-5 gap-y-3 sm:grid-cols-2">
              <DataItem label="Источник">{display(source)}</DataItem>
              <DataItem label="Кампания">{display(commercial.campaign)}</DataItem>
              <DataItem label="UTM-описание">{display(commercial.utmDescription)}</DataItem>
              <DataItem label="Приоритет">{commercial.priority ? <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${priorityClasses[commercial.priority]}`}>{priorityLabels[commercial.priority]}</span> : "Не указано"}</DataItem>
            </dl>
          </div>
          </details>
          <div className="border-t border-slate-200 pt-4">
            <h3 className="text-sm font-semibold text-slate-950">Описание потребности</h3>
            <p className="mt-2 max-w-5xl whitespace-pre-wrap text-sm leading-6 text-slate-600">{display(commercial.needDescription)}</p>
          </div>
        </div>
      ) : (
        <div className="mt-5 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
          <p className="text-sm font-medium text-slate-700">Коммерческие параметры пока не заполнены</p>
          <Button type="button" onClick={startEditing} className="mt-4">Добавить параметры</Button>
        </div>
      )}

      {notice ? <p className="mt-4 text-sm text-slate-600" role="status" aria-live="polite">{notice}</p> : null}
    </section>
  );
}
