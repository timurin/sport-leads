"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { updateTechnicalCardPlanningAction } from "@/app/(workspace)/production/tech-cards/tech-card-actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form-controls";
import { InlineAlert } from "@/components/ui/inline-alert";
import { SectionCard } from "@/components/ui/section-card";
import { checkboxClassName } from "@/lib/design-system/control-styles";
import { planningWriteBody } from "@/lib/production/tech-card-schedule";
import type { ApiTechnicalCard } from "@/lib/sales/order-tech-cards-api";

export function TechCardProductionPlan({
  card,
  disabled = false,
  embedded = false,
  showHeading = true,
  onSaved,
}: {
  card: ApiTechnicalCard;
  disabled?: boolean;
  embedded?: boolean;
  showHeading?: boolean;
  onSaved?: () => void;
}) {
  const router = useRouter();
  const [planningStart, setPlanningStart] = useState(card.planning_start_date ?? "");
  const [shippingDate, setShippingDate] = useState(card.shipping_date ?? "");
  const [priority, setPriority] = useState(card.priority == null ? "" : String(card.priority));
  const [planLocked, setPlanLocked] = useState(card.plan_locked === true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const locked = card.plan_locked === true;

  async function onSave() {
    const payload = planningWriteBody({
      planningStartDate: planningStart,
      shippingDate,
      priority,
      planLocked,
    });
    if (!payload.ok) {
      setError(payload.message);
      return;
    }
    setPending(true);
    setError(null);
    const saved = await updateTechnicalCardPlanningAction(card.id, payload.body);
    setPending(false);
    if (!saved.ok || !saved.card) {
      setError(saved.message ?? "Не удалось сохранить даты плана");
      return;
    }
    onSaved?.();
    router.refresh();
  }

  const fields = (
    <div id="tech-card-planning" data-tech-card-production-plan className={embedded ? "grid gap-portal-3" : "grid gap-3"}>
      {embedded && showHeading ? <h3 className="text-portal-body font-semibold text-portal-text">Даты плана</h3> : null}
      {locked ? (
        <InlineAlert tone="warning" size="compact">Даты плана зафиксированы. Снимите фиксацию, чтобы пересчёт мог сдвинуть их.</InlineAlert>
      ) : null}
      <div className={embedded ? "grid gap-portal-3" : "grid gap-3 sm:grid-cols-2 xl:grid-cols-4"}>
        <Field label="Начало плана" htmlFor={`plan-start-${card.id}`}>
          <Input id={`plan-start-${card.id}`} type="date" value={planningStart} disabled={disabled || pending} data-preflight-field="planning-start" onChange={(event) => setPlanningStart(event.target.value)} />
        </Field>
        <Field label="Дата отгрузки" htmlFor={`plan-ship-${card.id}`}>
          <Input id={`plan-ship-${card.id}`} type="date" value={shippingDate} disabled={disabled || pending} data-preflight-field="shipping-date" onChange={(event) => setShippingDate(event.target.value)} />
        </Field>
        <Field label="Приоритет" htmlFor={`plan-priority-${card.id}`} help="Меньше — выше. Пусто допустимо.">
          <Input id={`plan-priority-${card.id}`} inputMode="numeric" value={priority} disabled={disabled || pending} onChange={(event) => setPriority(event.target.value)} />
        </Field>
        <label className={`grid gap-1 text-sm text-portal-text ${embedded ? "items-start" : "items-end pb-2"}`}>
          <span className="flex items-center gap-2">
            <input
              type="checkbox"
              className={checkboxClassName()}
              checked={planLocked}
              disabled={disabled || pending}
              onChange={(event) => setPlanLocked(event.target.checked)}
            />
            Зафиксировать даты
          </span>
          <span className="text-portal-caption text-portal-muted">Пока включено, пересчёт не меняет сохранённые даты.</span>
        </label>
      </div>
      {error ? <InlineAlert tone="danger" size="compact">{error}</InlineAlert> : null}
      <div>
        <Button type="button" size="compact" disabled={disabled || pending} onClick={() => void onSave()}>
          Сохранить даты
        </Button>
      </div>
    </div>
  );

  if (embedded) {
    return <div className="rounded-portal-lg bg-portal-surface-secondary p-portal-3">{fields}</div>;
  }

  return (
    <SectionCard title="Даты плана" size="compact" className="mt-portal-4">
      {fields}
    </SectionCard>
  );
}
