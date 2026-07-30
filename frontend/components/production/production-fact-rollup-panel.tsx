"use client";

import type { ReactNode } from "react";
import { useId, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
} from "@/components/ui/data-table";
import { MetricCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  formatRollupQty,
  type ProductionFactRollup,
} from "@/lib/production/production-orders";
import { formatVolumeUnit } from "@/lib/production/tech-cards";
import { formatDurationMinutesSeconds } from "@/lib/sewing-operations";

function qtyNumber(value: string | null | undefined): number | null {
  if (value == null || value.trim() === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function NestedPanel({
  title,
  children,
  className = "",
  defaultCollapsed = false,
  summary,
}: {
  title: string;
  children: ReactNode;
  className?: string;
  defaultCollapsed?: boolean;
  /** Short hint shown when collapsed. */
  summary?: string;
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const panelId = useId();

  return (
    <div
      className={`min-w-0 rounded-portal-lg border border-portal-border bg-portal-surface-secondary/40 ${className}`}
    >
<button
        type="button"
        className="flex w-full min-h-11 items-center justify-between gap-portal-3 rounded-portal-lg px-portal-4 py-portal-3 text-left transition-colors hover:bg-portal-state-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-focus-ring"
        aria-expanded={!collapsed}
        aria-controls={panelId}
        onClick={() => setCollapsed((current) => !current)}
      >
        <span className="min-w-0">
          <span className="block text-portal-caption font-semibold tracking-wide text-portal-muted uppercase">
            {title}
          </span>
          {collapsed && summary ? (
            <span className="mt-0.5 block truncate text-portal-caption text-portal-text">
              {summary}
            </span>
          ) : null}
        </span>
        <span className="inline-flex shrink-0 items-center gap-1 text-portal-caption text-portal-muted">
          {collapsed ? "Развернуть" : "Свернуть"}
          {collapsed ? (
            <ChevronRight className="size-4" aria-hidden="true" />
          ) : (
            <ChevronDown className="size-4" aria-hidden="true" />
          )}
        </span>
      </button>
      {collapsed ? null : (
        <div id={panelId} className="border-t border-portal-border px-portal-3 py-portal-3">
          {children}
        </div>
      )}
    </div>
  );
}

/** Read-only aggregate fact panel (ADR-018 §8 / 11.2.1.3) — visual KPI + tables. */
export function ProductionFactRollupPanel({
  rollup,
  title = "Сводка факта",
}: {
  rollup: ProductionFactRollup;
  title?: string;
}) {
  const empty = rollup.technical_card_count === 0;
  const scrap = qtyNumber(rollup.scrap_qty_total) ?? 0;
  const rework = qtyNumber(rollup.rework_qty_total) ?? 0;
  const hasScrapOrRework = scrap > 0 || rework > 0;

  if (empty) {
    return (
      <div className="rounded-portal-lg border border-dashed border-portal-border bg-portal-surface-secondary/50 px-portal-4 py-portal-5 text-center">
        <p className="text-portal-body font-medium text-portal-text">{title}</p>
        <p className="mt-1 text-portal-caption text-portal-muted">
          Нет привязанных техкарт — сводка пуста.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-portal-4">
      <div className="flex flex-wrap items-center justify-between gap-portal-2">
        <p className="text-portal-caption font-medium text-portal-muted">{title}</p>
        <div className="flex flex-wrap gap-portal-2">
          <StatusBadge size="compact" tone="success" dot>
            готово {rollup.cards_completed}
          </StatusBadge>
          <StatusBadge size="compact" tone="primary" dot>
            в работе {rollup.cards_in_progress}
          </StatusBadge>
          {rollup.cards_other > 0 ? (
            <StatusBadge size="compact" tone="neutral" dot>
              прочие {rollup.cards_other}
            </StatusBadge>
          ) : null}
        </div>
      </div>

      <div className="grid gap-portal-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          size="compact"
          label="Техкарты"
          value={String(rollup.technical_card_count)}
          detail={`объём qty ${formatRollupQty(rollup.quantity_total)}`}
        />
        <MetricCard
          size="compact"
          label="Количество"
          value={formatRollupQty(rollup.quantity_total)}
          detail={`${rollup.technical_card_count} ТК`}
          tone="primary"
        />
        <MetricCard
          size="compact"
          label="Время"
          value={
            rollup.duration_seconds_total > 0
              ? formatDurationMinutesSeconds(rollup.duration_seconds_total)
              : "—"
          }
          detail={
            rollup.duration_seconds_total > 0
              ? `${rollup.duration_seconds_total} с суммарно`
              : "нет факта длительности"
          }
        />
        <MetricCard
          size="compact"
          label="Брак / переделка"
          value={`${formatRollupQty(rollup.scrap_qty_total)} / ${formatRollupQty(rollup.rework_qty_total)}`}
          detail={hasScrapOrRework ? "есть отклонения" : "без отклонений"}
          tone={hasScrapOrRework ? "danger" : "default"}
        />
      </div>

      <div className="grid gap-portal-3 lg:grid-cols-2">
        <NestedPanel
          title="Исполнители"
          summary={`${rollup.performers.length} чел.`}
        >
          {rollup.performers.length === 0 ? (
            <p className="text-portal-caption text-portal-muted">Нет исполнителей в факте.</p>
          ) : (
            <ul className="flex flex-wrap gap-portal-2">
              {rollup.performers.map((item) => (
                <li
                  key={item.performer_name}
                  className="min-w-0 max-w-full rounded-portal-lg border border-portal-border bg-portal-surface px-portal-3 py-portal-2 shadow-portal-sm"
                >
                  <p className="truncate text-portal-body font-semibold text-portal-text">
                    {item.performer_name}
                  </p>
                  {item.stage_labels.length > 0 ? (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {item.stage_labels.map((label) => (
                        <StatusBadge key={label} size="compact" tone="neutral">
                          {label}
                        </StatusBadge>
                      ))}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </NestedPanel>

        <NestedPanel
          title="Материалы"
          summary={`${rollup.materials.length} поз.`}
        >
          {rollup.materials.length === 0 ? (
            <p className="text-portal-caption text-portal-muted">Нет MATERIAL-строк с фактом.</p>
          ) : (
            <div className="overflow-x-auto rounded-portal-md border border-portal-border bg-portal-surface">
              <DataTable minWidthClassName="min-w-[18rem]">
                <DataTableHead>
                  <tr>
                    <DataTableHeaderCell>Наименование</DataTableHeaderCell>
                    <DataTableHeaderCell align="right">План</DataTableHeaderCell>
                    <DataTableHeaderCell align="right">Факт</DataTableHeaderCell>
                  </tr>
                </DataTableHead>
                <DataTableBody>
                  {rollup.materials.map((line) => {
                    const planned = qtyNumber(line.planned_qty);
                    const fact = qtyNumber(line.fact_qty);
                    const over =
                      planned != null && fact != null && fact > planned;
                    return (
                      <DataTableRow
                        key={`${line.nomenclature_id ?? "x"}-${line.snapshot_name}-${line.unit ?? ""}`}
                      >
                        <DataTableCell>
                          <span className="font-medium text-portal-text">
                            {line.snapshot_name}
                          </span>
                          {line.unit ? (
                            <span className="mt-0.5 block text-portal-caption text-portal-muted">
                              {line.unit}
                            </span>
                          ) : null}
                        </DataTableCell>
                        <DataTableCell
                          align="right"
                          className="tabular-nums text-portal-muted"
                        >
                          {formatRollupQty(line.planned_qty)}
                        </DataTableCell>
                        <DataTableCell
                          align="right"
                          className={`tabular-nums font-medium ${
                            over ? "text-portal-warning" : "text-portal-text"
                          }`}
                        >
                          {formatRollupQty(line.fact_qty)}
                        </DataTableCell>
                      </DataTableRow>
                    );
                  })}
                </DataTableBody>
              </DataTable>
            </div>
          )}
        </NestedPanel>
      </div>

      <NestedPanel
        title="Операции"
        summary={`${rollup.operations.length} оп.`}
      >
        {rollup.operations.length === 0 ? (
          <p className="text-portal-caption text-portal-muted">Нет операций в сводке.</p>
        ) : (
          <div className="overflow-x-auto rounded-portal-md border border-portal-border bg-portal-surface">
            <DataTable minWidthClassName="min-w-[22rem]">
              <DataTableHead>
                <tr>
                  <DataTableHeaderCell>Операция</DataTableHeaderCell>
                  <DataTableHeaderCell>Этап</DataTableHeaderCell>
                  <DataTableHeaderCell align="right">Объём</DataTableHeaderCell>
                </tr>
              </DataTableHead>
              <DataTableBody>
                {rollup.operations.map((line) => (
                  <DataTableRow
                    key={`${line.operation_name}-${line.stage_order ?? "x"}-${line.volume_unit ?? ""}-${line.stage_label ?? ""}`}
                  >
                    <DataTableCell className="font-medium text-portal-text">
                      {line.operation_name}
                    </DataTableCell>
                    <DataTableCell>
                      {line.stage_label ? (
                        <StatusBadge size="compact" tone="neutral">
                          {line.stage_label}
                        </StatusBadge>
                      ) : (
                        <span className="text-portal-muted">—</span>
                      )}
                    </DataTableCell>
                    <DataTableCell align="right" className="tabular-nums">
                      <span className="font-semibold text-portal-text">
                        {formatRollupQty(line.volume)}
                      </span>
                      {line.volume_unit ? (
                        <span className="ml-1 text-portal-caption text-portal-muted">
                          {formatVolumeUnit(line.volume_unit)}
                        </span>
                      ) : null}
                    </DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          </div>
        )}
      </NestedPanel>
    </div>
  );
}
