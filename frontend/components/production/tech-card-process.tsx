"use client";

import { Check, Lock, RefreshCw } from "lucide-react";
import { cloneElement, isValidElement, useEffect, useRef, useState, type MutableRefObject, type ReactElement, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  changeTechnicalCardRouteVariant,
  scheduleTechnicalCardAction,
} from "@/app/(workspace)/production/tech-cards/tech-card-actions";
import { ReadinessStickers } from "@/components/production/readiness-stickers";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/form-controls";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { RouteReviewNotice } from "@/components/production/route-review-notice";
import { routeReviewPresentation } from "@/lib/production/route-review";
import {
  SCHEDULE_ACTION_LABEL,
  SCHEDULE_PENDING_LABEL,
  scheduleBlockedMessage,
  type ProductionSchedule,
} from "@/lib/production/tech-card-schedule";
import { formatTechCardDateTime } from "@/lib/production/tech-cards";
import { fetchPlanningHealth, formatHealthDate, healthDayLabel, planningHealthBadge, planningHealthSummaryLines, type PlanningHealth } from "@/lib/production/planning-health";
import { presentPlanSummary, presentRouteMap, routeOperationCountLabel, type PresentedRouteColumn, type RouteMapTone } from "@/lib/production/tech-card-route-map";
import {
  diagnosticAdminHref,
  diagnosticCardAnchor,
  readDiagnostics,
  type ProductionDiagnostic,
} from "@/lib/production/readiness-stickers";
import {
  buildRouteScheme,
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

function workshopSurface(tone: RouteMapTone, current: boolean): string {
  const edge = current ? "border-2" : "border";
  if (tone === "completed") return `${edge} border-portal-success/50 bg-portal-success-soft`;
  if (tone === "active") return `${edge} border-portal-primary bg-portal-primary-soft`;
  if (tone === "waiting") return `${edge} border-portal-warning/60 bg-portal-warning-soft`;
  if (tone === "warning") return `${edge} border-portal-danger/40 bg-portal-danger-soft`;
  return `${edge} border-portal-border bg-portal-surface`;
}

function PlanDatesModal({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);
  return createPortal(
    <div className="fixed inset-0 z-portal-modal-2 flex items-center justify-center p-portal-4">
      <button type="button" className="absolute inset-0 bg-[#101828]/40" aria-label="Закрыть" onClick={onClose} />
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Даты плана"
        data-tech-card-dates-editor
        className="relative max-h-[90vh] w-full max-w-lg overflow-auto rounded-portal-lg border border-portal-border bg-portal-surface p-portal-4 shadow-portal-overlay"
      >
        <div className="mb-portal-3 flex items-center justify-between gap-portal-2">
          <h2 className="text-portal-body font-semibold text-portal-text">Даты плана</h2>
          <Button type="button" size="compact" variant="ghost" onClick={onClose}>Закрыть</Button>
        </div>
        {children}
      </section>
    </div>,
    document.body,
  );
}

function StepDetail({ step }: { step: PresentedRouteColumn["steps"][number] }) {
  const rows = [
    step.performer ? `Исполнитель: ${step.performer}` : null,
    step.startedAt ? `Начало: ${formatTechCardDateTime(step.startedAt)}` : null,
    step.completedAt ? `Завершение: ${formatTechCardDateTime(step.completedAt)}` : null,
    step.equipment ? `Оборудование: ${step.equipment}` : null,
    step.fact,
    step.isProtected ? "Защищена от переноса" : null,
    step.healthWarning,
    step.issue,
    step.fixAction,
  ].filter((row): row is string => Boolean(row));
  if (rows.length === 0) return <p className="text-portal-caption text-portal-muted">{step.statusLabel}</p>;
  return (
    <div className="mt-1 grid gap-0.5 text-portal-caption text-portal-muted">
      {rows.map((row) => <p key={row}>{row}</p>)}
    </div>
  );
}

function WorkshopSteps({
  column,
  open,
  variantStep,
}: {
  column: PresentedRouteColumn;
  open: boolean;
  variantStep: (step: Extract<RouteSchemeStep, { kind: "variant" }>) => ReactNode;
}) {
  const visible = column.steps.filter((step) => !(step.step.kind === "operation" && column.steps.length === 1 && step.step.label === column.workshop));
  const hiddenTwin = visible.length === 0 ? column.steps[0] : null;
  return (
    <div className="mt-portal-2 grid gap-1">
      {visible.map((step) => (
        step.step.kind === "operation" ? (
          <div key={step.step.key}>
            <p className="flex items-baseline justify-between gap-portal-2 text-portal-caption">
              <span className="min-w-0 text-portal-text">{step.step.label}{step.isProtected ? <Lock className="ml-1 inline size-3" aria-label="Защищена" /> : null}</span>
              <span className="shrink-0 text-portal-muted">{step.statusLabel}{step.planLabel ? ` · ${step.planLabel}` : ""}</span>
            </p>
            {step.equipment ? <p className="text-portal-caption text-portal-muted">{step.equipment}</p> : null}
            {open ? <StepDetail step={step} /> : null}
          </div>
        ) : (
          <div key={step.step.key}>{variantStep(step.step)}</div>
        )
      ))}
      {hiddenTwin && open ? <StepDetail step={hiddenTwin} /> : null}
    </div>
  );
}

export function TechCardProcess({
  card,
  routings,
  variants,
  diagnostics = [],
  workCenters,
  disabled = false,
  onApplyRouting,
  beforeSchedule,
  scheduleBridgeRef,
  planningActions = true,
  children,
}: {
  card: ApiTechnicalCard;
  routings: RoutingOption[];
  variants: RouteVariantRecord[];
  diagnostics?: ProductionDiagnostic[];
  workCenters: WorkCenter[];
  disabled?: boolean;
  onApplyRouting: (routingTemplateId: number) => void;
  beforeSchedule?: () => boolean;
  scheduleBridgeRef?: MutableRefObject<(() => void) | null>;
  planningActions?: boolean;
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
  const [datesOpen, setDatesOpen] = useState(false);
  const [openWorkshop, setOpenWorkshop] = useState<string | null>(null);
  const [health, setHealth] = useState<PlanningHealth | null>(null);
  const [healthState, setHealthState] = useState<"loading" | "ready" | "error">("loading");
  const healthRequest = `${card.id}:${persistedSignature}:${plan?.planned_completion_date ?? ""}:${plan?.status ?? ""}`;
  const [healthRequestSeen, setHealthRequestSeen] = useState(healthRequest);
  if (healthRequestSeen !== healthRequest) {
    setHealthRequestSeen(healthRequest);
    setHealth(null);
    setHealthState("loading");
  }
  const signature = JSON.stringify(variants);
  const [synced, setSynced] = useState(signature);
  const [liveVariants, setLiveVariants] = useState(variants);
  if (signature !== synced) {
    setSynced(signature);
    setLiveVariants(variants);
  }
  useEffect(() => {
    const controller = new AbortController();
    fetchPlanningHealth(card.id, controller.signal)
      .then((loaded) => {
        if (controller.signal.aborted) return;
        setHealth(loaded);
        setHealthState("ready");
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setHealth(null);
        setHealthState("error");
      });
    return () => controller.abort();
  }, [card.id, healthRequest]);
  const stages = card.stage_results ?? [];
  const lines = card.operation_lines ?? [];
  const columns = buildRouteScheme(lines, stages, liveVariants);
  const recommendation = routeChoiceRecommendation({});
  const diagnosticRows = readDiagnostics(diagnostics);
  const routeReview = routeReviewPresentation(diagnosticRows.find((row) => row.code === "route_requires_review_before_planning"));
  const blocked = diagnosticRows.some((row) => row.severity === "error");
  const forecast = plan
    ? {
        ...card.planning_summary,
        planned_completion_date: plan.planned_completion_date ?? card.planning_summary?.planned_completion_date ?? null,
        on_time: plan.on_time ?? card.planning_summary?.on_time ?? null,
        buffer_days: plan.buffer_days ?? card.planning_summary?.buffer_days ?? null,
        delay_days: plan.delay_days ?? card.planning_summary?.delay_days ?? null,
        planning_state: plan.status === "planned" ? "planned" as const : card.planning_summary?.planning_state,
        replan_required: plan.status === "planned" ? false : card.planning_summary?.replan_required,
      }
    : card.planning_summary;
  const planView = presentPlanSummary(forecast, card.shipping_date);
  const routeMap = presentRouteMap({
    lines,
    stages,
    columns,
    assemblyName: card.assembly_variant_name,
    currentStageLabel: card.production_state?.current_stage_label ?? card.current_stage_label,
    currentStageOrder: card.production_state?.current_stage_order ?? card.current_stage_order,
    workshopState: card.production_state?.workshop_state ?? null,
    diagnostics: diagnosticRows,
    workCenters: workCenters.map((center) => ({ id: center.id, name: center.name })),
    planSteps: plan?.steps ?? [],
    healthOperations: health?.operations,
  });
  const operationCount = routeMap.columns.reduce((sum, column) => sum + column.steps.length, 0);
  const routingValue = card.routing_template_id != null ? String(card.routing_template_id) : "";
  const routeName = routings.find((row) => row.id === card.routing_template_id)?.name ?? card.routing_template_name ?? null;
  const routeBadge = !routingValue ? "Не выбран" : blocked ? "Требует настройки" : "Выбран";
  const scheduleLabel = pending === "schedule"
    ? SCHEDULE_PENDING_LABEL
    : planView.mode === "ready"
      ? SCHEDULE_ACTION_LABEL
      : planView.actionLabel;

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

  async function recalculate(skipPreflight = false) {
    if (!skipPreflight && beforeSchedule && !beforeSchedule()) return;
    setPending("schedule");
    setError(null);
    const result = await scheduleTechnicalCardAction(card.id);
    setPending(null);
    if (!result.ok || !result.schedule) {
      setError(result.message ?? "Не удалось пересчитать план");
      return;
    }
    const blocked = scheduleBlockedMessage(result.schedule);
    if (blocked) {
      setError(blocked);
      return;
    }
    setPlan(result.schedule);
    setNotice(null);
    router.refresh();
  }

  const recalculateRef = useRef(recalculate);
  useEffect(() => {
    recalculateRef.current = recalculate;
  });
  useEffect(() => {
    if (!scheduleBridgeRef) return;
    scheduleBridgeRef.current = () => { void recalculateRef.current(true); };
    return () => { scheduleBridgeRef.current = null; };
  }, [scheduleBridgeRef]);

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

  const dateEditor = datesOpen
    ? isValidElement(children)
      ? cloneElement(children as ReactElement<{ onSaved?: () => void; showHeading?: boolean }>, { onSaved: () => setDatesOpen(false), showHeading: false })
      : children
    : null;

  return (
    <SectionCard
      id="tech-card-route"
      size="compact"
      className="mt-portal-4"
      title={(
        <span className="inline-flex flex-wrap items-center gap-portal-2">
          <span>План производства</span>
          {routeName ? <span className="font-normal text-portal-muted">{routeName}</span> : null}
          {operationCount > 0 ? <span className="font-normal text-portal-muted" data-tech-card-route-count>{routeOperationCountLabel(operationCount)}</span> : null}
          <StatusBadge size="compact" tone={blocked ? "warning" : routingValue ? "success" : "neutral"}>{routeBadge}</StatusBadge>
        </span>
      )}
      actions={(
        <div className="flex min-w-0 flex-wrap items-center gap-portal-2" data-tech-card-plan-summary>
          {health && healthState === "ready" ? (
            <p className="text-portal-caption text-portal-muted" data-tech-card-plan-metrics data-planning-health>
              {`ETA ${formatHealthDate(health.eta)} · Отгрузка ${formatHealthDate(health.shipping_date)} · Запас ${health.slack_days == null ? "—" : healthDayLabel(health.slack_days)}`}
              <StatusBadge className="ml-portal-2" size="compact" tone={health.risk_level === "late" || health.has_overdue_operations ? "danger" : health.replan_required ? "warning" : "success"}>{planningHealthBadge(health, "card").label}</StatusBadge>
            </p>
          ) : healthState === "error" ? (
            <span className="text-portal-caption text-portal-muted">Сводка плана недоступна.</span>
          ) : (
            <span className="text-portal-caption text-portal-muted">Загрузка сводки…</span>
          )}
          {planningActions ? (
            <>
              <Button type="button" size="compact" variant="secondary" disabled={disabled || pending != null} onClick={() => setDatesOpen(true)}>
                Изменить даты
              </Button>
              <Button
                type="button"
                size="compact"
                variant="primary"
                disabled={disabled || pending != null}
                data-tech-card-schedule-cta
                onClick={() => void recalculate()}
              >
                <RefreshCw className={`size-3.5 ${pending === "schedule" ? "animate-spin" : ""}`} />
                {scheduleLabel}
              </Button>
            </>
          ) : null}
        </div>
      )}
      afterTitle={(
        <div className="mt-portal-2 grid gap-1">
          {health && healthState === "ready" ? (
            <div data-planning-health-summary className="grid gap-0.5 text-portal-caption text-portal-muted sm:grid-cols-2">
              {planningHealthSummaryLines(health).map((line) => <p key={line}>{line}</p>)}
            </div>
          ) : null}
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
      <div className="grid min-w-0 gap-portal-3">
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

        {routeMap.assembly ? (
          <p className="text-portal-caption text-portal-muted" data-tech-card-assembly>Сборка: {routeMap.assembly}</p>
        ) : null}

        {routeMap.columns.length > 0 ? (
          <div className="min-w-0 xl:overflow-x-auto" aria-label="Схема технологического процесса" data-tech-card-route-map data-tech-card-route-scheme>
            <ol className="flex min-w-0 flex-col gap-portal-2 md:flex-row md:flex-wrap md:items-stretch xl:flex-nowrap">
              {routeMap.columns.map((column, index) => (
                <li key={column.key} className="flex w-full min-w-0 items-stretch gap-portal-2 md:w-auto">
                  {index > 0 ? (
                    <span className="hidden shrink-0 self-center text-portal-muted md:inline" aria-hidden="true">→</span>
                  ) : null}
                  <article
                    className={`h-full w-full rounded-portal-md px-portal-3 py-portal-2 md:w-56 md:shrink-0 ${workshopSurface(column.tone, column.current)}`}
                    data-route-workshop={column.workshop}
                    data-route-tone={column.tone}
                    data-route-current={column.current ? "true" : "false"}
                  >
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-portal-2 text-left"
                      aria-expanded={openWorkshop === column.key}
                      onClick={() => setOpenWorkshop((current) => current === column.key ? null : column.key)}
                    >
                      <span className="flex min-w-0 items-center gap-1 text-portal-caption font-semibold text-portal-text">
                        {column.tone === "completed" ? <Check className="size-3.5 shrink-0" aria-hidden="true" /> : null}
                        {column.workshop}
                      </span>
                      <span className="shrink-0 text-portal-caption text-portal-muted">{column.statusLabel}</span>
                    </button>
                    {column.steps.some((step) => step.issue) ? (
                      <p className="mt-1 text-portal-caption text-portal-warning">Нужна настройка</p>
                    ) : null}
                    <WorkshopSteps column={column} open={openWorkshop === column.key} variantStep={variantStep} />
                  </article>
                </li>
              ))}
            </ol>
          </div>
        ) : (
          <p className="text-portal-caption text-portal-muted">Выберите маршрут, чтобы увидеть схему.</p>
        )}

        {recommendation.supported ? (
          <div className="flex flex-wrap items-center gap-portal-2">
            <p className="text-portal-caption">Рекомендуем: {recommendation.name}. {recommendationEarlierText(recommendation.daysEarlier)}</p>
            {recommendation.nodeId && recommendation.groupId ? (
              <Button type="button" size="compact" variant="secondary" disabled={disabled || pending != null} onClick={() => void chooseRecommendation()}>
                Выбрать
              </Button>
            ) : null}
          </div>
        ) : null}
        {notice ? <p className="text-portal-caption">{notice}</p> : null}
        {error ? <p className="text-portal-caption text-portal-danger" role="alert">{error}</p> : null}
        {dateEditor ? <PlanDatesModal onClose={() => setDatesOpen(false)}>{dateEditor}</PlanDatesModal> : null}
      </div>
    </SectionCard>
  );
}
