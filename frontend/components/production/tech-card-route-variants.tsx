"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  changeTechnicalCardRouteVariant,
  scheduleTechnicalCardAction,
} from "@/app/(workspace)/production/tech-cards/tech-card-actions";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  SCHEDULE_ACTION_LABEL,
  SCHEDULE_PENDING_LABEL,
  type ProductionSchedule,
} from "@/lib/production/tech-card-schedule";
import { managerBlockers, snapshotOperationName } from "@/lib/production/tech-card-route-choice";
import {
  VARIANT_CONFIRMED_HELP,
  VARIANT_PRELIMINARY_HELP,
  VARIANT_REPLAN_HINT,
  variantStatusLabel,
  type RouteVariantRecord,
} from "@/lib/route-variants";
import type { ApiTechnicalCard, ApiTechnicalCardOperationLine, ApiTechnicalCardStageResult } from "@/lib/sales/order-tech-cards-api";
import type { WorkCenter } from "@/lib/shop-routings";

function memberName(nodeId: string, stages: ApiTechnicalCardStageResult[], lines: ApiTechnicalCardOperationLine[]): string {
  return snapshotOperationName(nodeId, stages, lines);
}

function workCenterName(nodeId: string, stages: ApiTechnicalCardStageResult[], workCenters: WorkCenter[]): string | null {
  const match = /^snapshot:(\d+)$/.exec(nodeId);
  if (!match) return null;
  const stage = stages.find((item) => item.id === Number(match[1]));
  if (stage?.work_center_id == null) return null;
  return workCenters.find((center) => center.id === stage.work_center_id)?.name ?? null;
}

export function TechCardRouteVariants({
  card,
  variants,
  workCenters,
  disabled = false,
  plain = false,
  onPlan,
  onRows,
}: {
  card: ApiTechnicalCard;
  variants: RouteVariantRecord[];
  workCenters: WorkCenter[];
  disabled?: boolean;
  plain?: boolean;
  onPlan?: (plan: ProductionSchedule | null) => void;
  onRows?: (rows: RouteVariantRecord[]) => void;
}) {
  const router = useRouter();
  const stages = card.stage_results ?? [];
  const lines = card.operation_lines ?? [];
  const signature = JSON.stringify(variants);
  const [synced, setSynced] = useState(signature);
  const [rows, setRows] = useState(variants);
  if (signature !== synced) {
    setSynced(signature);
    setRows(variants);
  }
  const [pending, setPending] = useState<"save" | "schedule" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [plan, setPlan] = useState<ProductionSchedule | null>(null);
  async function commit(row: RouteVariantRecord, nodeId: string, status: "preliminary" | "confirmed") {
    if (
      row.selection_status === "confirmed"
      && nodeId !== row.selected_operation_snapshot_node_id
      && !window.confirm(`Вариант «${row.group.name}» уже подтверждён производством. Сменить операцию?`)
    ) {
      return;
    }
    setPending("save");
    setError(null);
    const result = await changeTechnicalCardRouteVariant(card.id, row.group.id, {
      selected_operation_snapshot_node_id: nodeId,
      selection_status: status,
    });
    setPending(null);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    const nextRows = rows.map((item) => item.group.id === row.group.id ? result.selection : item);
    setRows(nextRows);
    onRows?.(nextRows);
    setPlan(result.plan);
    onPlan?.(result.plan);
    setNotice(result.requiresReplan ? VARIANT_REPLAN_HINT : null);
    router.refresh();
  }

  async function recalculate() {
    setPending("schedule");
    setError(null);
    const result = await scheduleTechnicalCardAction(card.id);
    setPending(null);
    if (!result.ok) {
      setError(result.message ?? "Не удалось пересчитать план");
      return;
    }
    setPlan(result.schedule);
    onPlan?.(result.schedule);
    setNotice(null);
    router.refresh();
  }

  const blockers = plan ? managerBlockers(plan.deviations, plan.steps, stages, lines) : null;
  const content = (
    <>
      {rows.length === 0 ? <p className="text-portal-caption text-portal-muted">В маршруте нет групп вариантов.</p> : null}
      <div className="space-y-portal-3">
        {rows.map((row) => {
          const selected = row.selected_operation_snapshot_node_id;
          const confirmed = row.selection_status === "confirmed";
          return (
            <article key={row.group.id} className="rounded-portal-md border border-portal-border p-portal-3">
              <div className="flex flex-wrap items-start justify-between gap-portal-2">
                <div>
                  <h3 className="font-medium">{row.group.name}</h3>
                  <p className="text-portal-body">{selected ? memberName(selected, stages, lines) : "Вариант не выбран"}</p>
                  <p className="text-portal-caption text-portal-muted">{confirmed ? VARIANT_CONFIRMED_HELP : VARIANT_PRELIMINARY_HELP}</p>
                </div>
                <StatusBadge size="compact" tone={confirmed ? "success" : "warning"}>{variantStatusLabel(row.selection_status)}</StatusBadge>
              </div>
              <ul className="mt-portal-3 space-y-1">
                {[...row.group.members].sort((left, right) => left.position - right.position).map((member) => {
                  const center = workCenterName(member.operation_node_id, stages, workCenters);
                  const isDefault = member.operation_node_id === row.group.default_operation_node_id;
                  const checked = member.operation_node_id === selected;
                  return (
                    <li key={member.operation_node_id}>
                      <label className={`flex items-start gap-portal-2 rounded-portal-md px-portal-2 py-1 ${checked ? "bg-portal-primary-soft" : "hover:bg-portal-state-hover"}`}>
                        <input
                          type="radio"
                          name={`route-variant-${row.group.id}`}
                          checked={checked}
                          disabled={disabled || pending != null}
                          onChange={() => { if (!checked) void commit(row, member.operation_node_id, "preliminary"); }}
                        />
                        <span>
                          <span className="block">{memberName(member.operation_node_id, stages, lines)}{isDefault ? " · по умолчанию" : ""}</span>
                          {center ? <span className="block text-portal-caption text-portal-muted">Оборудование: {center}</span> : null}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
              {confirmed ? null : (
                <div className="mt-portal-3">
                  <Button type="button" variant="primary" size="compact" disabled={disabled || pending != null || !selected} onClick={() => { if (selected) void commit(row, selected, "confirmed"); }}>
                    Подтвердить
                  </Button>
                </div>
              )}
            </article>
          );
        })}
      </div>
      {notice ? <p className="mt-portal-3 text-portal-body">{notice}</p> : null}
      {plain ? null : blockers?.headline ? <p className="mt-portal-2 font-medium">{blockers.headline}</p> : null}
      {plain ? null : blockers?.items.map((item) => <p key={item} className="mt-1 text-portal-caption text-portal-warning">{item}</p>)}
      {notice ? (
        <Button type="button" className="mt-portal-3" variant="primary" disabled={disabled || pending != null} onClick={() => void recalculate()}>
          {pending === "schedule" ? SCHEDULE_PENDING_LABEL : SCHEDULE_ACTION_LABEL}
        </Button>
      ) : null}
      {error ? <p className="mt-portal-3 text-portal-body text-portal-danger" role="alert">{error}</p> : null}
    </>
  );
  if (plain) return content;
  return <SectionCard title="Варианты маршрута" size="compact">{content}</SectionCard>;
}
