"use client";

import { RefreshCw } from "lucide-react";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  changeTechnicalCardRouteVariant,
  scheduleTechnicalCardAction,
} from "@/app/(workspace)/production/tech-cards/tech-card-actions";
import { ReadinessStickers } from "@/components/production/readiness-stickers";
import { Button, IconButton } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/form-controls";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { RouteReviewNotice } from "@/components/production/route-review-notice";
import { routeReviewPresentation } from "@/lib/production/route-review";
import {
  SCHEDULE_ACTION_LABEL,
  SCHEDULE_PENDING_LABEL,
  deadlineStatusText,
  type ProductionSchedule,
} from "@/lib/production/tech-card-schedule";
import {
  diagnosticAdminHref,
  diagnosticCardAnchor,
  readDiagnostics,
  type ProductionDiagnostic,
} from "@/lib/production/readiness-stickers";
import {
  FORECAST_EMPTY,
  buildRouteScheme,
  formatReadyDate,
  recommendationEarlierText,
  routeChoiceRecommendation,
  type RouteSchemeStep,
} from "@/lib/production/tech-card-route-choice";
import { VARIANT_REPLAN_HINT, variantStatusLabel, type RouteVariantRecord } from "@/lib/route-variants";
import type { ApiTechnicalCard, ApiTechnicalCardStageResult } from "@/lib/sales/order-tech-cards-api";
import type { WorkCenter } from "@/lib/shop-routings";

type RoutingOption = {
  id: number;
  name: string;
  code: string | null;
  is_active: boolean;
};

function workCenterName(nodeId: string, stages: ApiTechnicalCardStageResult[], workCenters: WorkCenter[]): string | null {
  const match = /^snapshot:(\d+)$/.exec(nodeId);
  if (!match) return null;
  const stage = stages.find((item) => item.id === Number(match[1]));
  if (stage?.work_center_id == null) return null;
  return workCenters.find((center) => center.id === stage.work_center_id)?.name ?? null;
}

const SCHEME_TONES = [
  "bg-portal-success-soft",
  "bg-portal-primary-soft",
  "bg-portal-danger-soft",
  "bg-portal-warning-soft",
];

function riskLabel(schedule: Pick<ProductionSchedule, "on_time" | "buffer_days" | "delay_days">): string | null {
  const text = deadlineStatusText(schedule);
  if (!text) return null;
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
}

export function TechCardProcess({
  card,
  routings,
  variants,
  diagnostics = [],
  workCenters,
  disabled = false,
  onApplyRouting,
  children,
}: {
  card: ApiTechnicalCard;
  routings: RoutingOption[];
  variants: RouteVariantRecord[];
  diagnostics?: ProductionDiagnostic[];
  workCenters: WorkCenter[];
  disabled?: boolean;
  onApplyRouting: (routingTemplateId: number) => void;
  children?: ReactNode;
}) {
  const router = useRouter();
  const [plan, setPlan] = useState<ProductionSchedule | null>(null);
  const persistedSignature = JSON.stringify(card.planning_summary);
  const [syncedPlan, setSyncedPlan] = useState(persistedSignature);
  if (syncedPlan !== persistedSignature) {
    setSyncedPlan(persistedSignature);
    setPlan(null);
  }
  const [pending, setPending] = useState<"save" | "schedule" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [setupHref, setSetupHref] = useState<string | null>(null);
  const signature = JSON.stringify(variants);
  const [synced, setSynced] = useState(signature);
  const [liveVariants, setLiveVariants] = useState(variants);
  if (signature !== synced) {
    setSynced(signature);
    setLiveVariants(variants);
  }
  const stages = card.stage_results ?? [];
  const lines = card.operation_lines ?? [];
  const columns = buildRouteScheme(lines, stages, liveVariants);
  const recommendation = routeChoiceRecommendation({});
  const diagnosticRows = readDiagnostics(diagnostics);
  const routeReview = routeReviewPresentation(diagnosticRows.find((row) => row.code === "route_requires_review_before_planning"));
  const blocked = diagnosticRows.some((row) => row.severity === "error");
  const forecast = plan ?? card.planning_summary;
  const ready = formatReadyDate(forecast?.planned_completion_date);
  const shipping = formatReadyDate(card.shipping_date);
  const risk = forecast ? riskLabel(forecast) : null;
  const routingValue = card.routing_template_id != null ? String(card.routing_template_id) : "";
  const routeBadge = !routingValue ? "Не выбран" : blocked ? "Требует настройки" : "Выбран";

  function focusDiagnostic(row: ProductionDiagnostic) {
    const anchor = diagnosticCardAnchor(row);
    if (anchor) document.querySelector(`[data-${anchor}]`)?.scrollIntoView({ block: "nearest" });
    setSetupHref(diagnosticAdminHref(row));
  }

  async function commit(row: RouteVariantRecord, nodeId: string) {
    if (
      row.selection_status === "confirmed"
      && nodeId !== row.selected_operation_snapshot_node_id
      && !window.confirm(`Вариант «${row.group.name}» уже подтверждён производством. Сменить операцию?`)
    ) {
      return;
    }
    setPending("save");
    setError(null);
    const status = nodeId === row.selected_operation_snapshot_node_id ? "confirmed" : "preliminary";
    const result = await changeTechnicalCardRouteVariant(card.id, row.group.id, {
      selected_operation_snapshot_node_id: nodeId,
      selection_status: status,
    });
    setPending(null);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setLiveVariants((current) => current.map((item) => item.group.id === row.group.id ? result.selection : item));
    setPlan(result.plan);
    setNotice(result.requiresReplan ? VARIANT_REPLAN_HINT : null);
    router.refresh();
  }

  async function confirmCurrent(row: RouteVariantRecord) {
    const selected = row.selected_operation_snapshot_node_id;
    if (!selected) return;
    setPending("save");
    setError(null);
    const result = await changeTechnicalCardRouteVariant(card.id, row.group.id, {
      selected_operation_snapshot_node_id: selected,
      selection_status: "confirmed",
    });
    setPending(null);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setLiveVariants((current) => current.map((item) => item.group.id === row.group.id ? result.selection : item));
    setPlan(result.plan);
    setNotice(result.requiresReplan ? VARIANT_REPLAN_HINT : null);
    router.refresh();
  }

  async function chooseRecommendation() {
    if (!recommendation.supported || !recommendation.nodeId || !recommendation.groupId) return;
    const row = liveVariants.find((item) => item.group.id === recommendation.groupId);
    if (!row) return;
    await commit(row, recommendation.nodeId);
  }

  async function recalculate() {
    setPending("schedule");
    setError(null);
    const result = await scheduleTechnicalCardAction(card.id);
    setPending(null);
    if (!result.ok || !result.schedule) {
      setError(result.message ?? "Не удалось пересчитать план");
      return;
    }
    setPlan(result.schedule);
    setNotice(null);
    router.refresh();
  }

  function variantStep(step: Extract<RouteSchemeStep, { kind: "variant" }>) {
    const row = liveVariants.find((item) => item.group.id === step.key);
    if (!row) return null;
    return (
      <div className="mt-portal-2 rounded-portal-md bg-portal-surface/80 p-portal-2">
        <div className="flex flex-wrap items-center gap-portal-2">
          <p className="text-portal-caption font-medium text-portal-text">{step.name}</p>
          <StatusBadge size="compact" tone={step.status === "confirmed" ? "success" : "warning"}>{variantStatusLabel(step.status)}</StatusBadge>
        </div>
        <p className="mt-1 text-portal-caption text-portal-muted">{step.caption}</p>
        <div className="mt-portal-2 flex flex-col gap-1" role="radiogroup" aria-label={step.name}>
          {step.options.map((option) => {
            const center = workCenterName(option.nodeId, stages, workCenters);
            return (
              <label
                key={option.nodeId}
                title={center ?? undefined}
                className={`flex items-center gap-portal-2 text-portal-caption ${option.selected ? "font-medium text-portal-text" : "text-portal-muted"}`}
              >
                <input
                  type="radio"
                  name={`route-variant-${step.key}`}
                  checked={option.selected}
                  disabled={disabled || pending != null}
                  onChange={() => { if (!option.selected) void commit(row, option.nodeId); }}
                />
                <span>{option.label}</span>
                {option.isDefault ? <span className="text-portal-muted">по умолчанию</span> : null}
              </label>
            );
          })}
        </div>
        {step.status === "preliminary" && row.selected_operation_snapshot_node_id ? (
          <Button type="button" className="mt-portal-2" size="compact" variant="primary" disabled={disabled || pending != null} onClick={() => void confirmCurrent(row)}>
            Подтвердить
          </Button>
        ) : null}
      </div>
    );
  }

  const scheduleLabel = pending === "schedule" ? SCHEDULE_PENDING_LABEL : SCHEDULE_ACTION_LABEL;

  return (
    <SectionCard
      id="tech-card-route"
      size="compact"
      className="mt-portal-4"
      title={(
        <span className="inline-flex flex-wrap items-center gap-portal-2">
          <span>Технологический процесс</span>
          <StatusBadge size="compact" tone={blocked ? "warning" : routingValue ? "success" : "neutral"}>{routeBadge}</StatusBadge>
          <IconButton
            label={scheduleLabel}
            variant="secondary"
            disabled={disabled || pending != null}
            data-tech-card-schedule-cta
            onClick={() => void recalculate()}
          >
            <RefreshCw className={`size-4 ${pending === "schedule" ? "animate-spin" : ""}`} />
          </IconButton>
        </span>
      )}
      afterTitle={(
        <div className="mt-portal-2 grid gap-1">
          {routeReview ? (
            <RouteReviewNotice presentation={routeReview} routeId={card.routing_template_id ?? null}
              disabled={disabled || pending != null} onRefresh={() => card.routing_template_id && onApplyRouting(card.routing_template_id)} />
          ) : null}
          <ReadinessStickers diagnostics={diagnosticRows} onSelect={focusDiagnostic} />
          {setupHref ? (
            <Link href={setupHref} className="text-portal-caption text-portal-primary hover:underline">
              Открыть настройку
            </Link>
          ) : null}
        </div>
      )}
    >
      <div className="grid min-w-0 gap-portal-4">
        <Field label="Маршрут производства">
            <Select
              value={routingValue}
              disabled={disabled || pending != null}
              data-tech-card-routing-select
              onChange={(event) => {
                const next = Number(event.target.value);
                if (!Number.isSafeInteger(next) || next <= 0 || next === card.routing_template_id) return;
                onApplyRouting(next);
              }}
            >
              <option value="">Выберите маршрут…</option>
              {routings.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.code ? `${row.code} — ${row.name}` : row.name}
                  {row.is_active ? "" : " (неактивен)"}
                </option>
              ))}
            </Select>
        </Field>

        <div className="grid min-w-0 items-start gap-portal-4 lg:grid-cols-[minmax(0,1fr)_17.5rem]">
          {columns.length > 0 ? (
            <div className="min-w-0" aria-label="Схема технологического процесса" data-tech-card-route-scheme>
              <ol className="mx-auto flex w-full max-w-sm flex-col">
                {columns.map((column, index) => (
                  <li key={column.key} className="flex flex-col">
                    {index > 0 ? (
                      <span className="flex flex-col items-center py-1 text-portal-muted" aria-hidden="true">
                        <span className="h-3 w-px bg-portal-border" />
                        <span className="text-portal-caption leading-none">↓</span>
                      </span>
                    ) : null}
                    <article className={`flex min-h-36 w-full flex-col rounded-portal-lg p-portal-3 ${SCHEME_TONES[index % SCHEME_TONES.length]}`}>
                      <h3 className="text-portal-body font-semibold text-portal-text">{column.workshop}</h3>
                      <div className="mt-portal-2 flex flex-1 flex-col gap-1">
                        {column.steps.map((step) => (
                          step.kind === "operation" ? (
                            <p key={step.key} className="text-portal-caption text-portal-text">{step.label}</p>
                          ) : (
                            <div key={step.key}>{variantStep(step)}</div>
                          )
                        ))}
                      </div>
                    </article>
                  </li>
                ))}
              </ol>
            </div>
          ) : (
            <p className="text-portal-caption text-portal-muted">Выберите маршрут, чтобы увидеть схему.</p>
          )}

          <aside className="grid min-w-0 content-start gap-portal-3">
            {ready ? (
              <div className="rounded-portal-lg bg-portal-primary-soft p-portal-3">
                <p className="text-portal-caption text-portal-muted">Ожидаемая готовность</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums leading-none text-portal-text">{ready}</p>
                  {!plan && card.planning_summary?.planned_start_date ? <p className="text-portal-caption text-portal-muted">Начало плана {formatReadyDate(card.planning_summary.planned_start_date)}</p> : null}
                <p className="mt-portal-2 text-portal-caption text-portal-muted">{shipping ? `Отгрузка ${shipping}` : "Дата отгрузки не задана"}</p>
                {risk ? <p className="text-portal-caption text-portal-text">{risk}</p> : null}
                {!plan && card.planning_summary?.replan_required ? <p role="status" className="text-portal-caption text-portal-danger">Сохранённый план не актуален. Требуется пересчёт.</p> : null}
              </div>
            ) : (
              <p className="text-portal-caption text-portal-muted">{FORECAST_EMPTY}</p>
            )}
            {recommendation.supported ? (
              <div className="grid gap-portal-2 rounded-portal-lg bg-portal-success-soft p-portal-3">
                <p className="text-portal-caption font-medium">Рекомендуем: {recommendation.name}</p>
                <p className="text-portal-caption">{recommendationEarlierText(recommendation.daysEarlier)}</p>
                {recommendation.nodeId && recommendation.groupId ? (
                  <Button type="button" className="self-start" size="compact" variant="secondary" disabled={disabled || pending != null} onClick={() => void chooseRecommendation()}>
                    Выбрать
                  </Button>
                ) : null}
              </div>
            ) : null}
            {notice ? <p className="text-portal-caption">{notice}</p> : null}
            {error ? <p className="text-portal-caption text-portal-danger" role="alert">{error}</p> : null}
            {children}
          </aside>
        </div>
      </div>
    </SectionCard>
  );
}
