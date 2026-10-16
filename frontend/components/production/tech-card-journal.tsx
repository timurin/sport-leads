"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { refreshTechnicalCardDiagnostics } from "@/app/(workspace)/production/tech-cards/tech-card-actions";
import { PlatformDiagnosticCard } from "@/components/platform/platform-diagnostic-card";
import { ActivityTimeline, ActivityTimelineItem } from "@/components/ui/activity-timeline";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  DEBUG_BACKEND_GAPS,
  debugErrorCount,
  filterDiagnostics,
  type DebugFilter,
} from "@/lib/production/tech-card-debug";
import { readDiagnostics, type ProductionDiagnostic } from "@/lib/production/readiness-stickers";
import type { TechCardHistoryEntry } from "@/lib/production/tech-cards";

const FILTERS: Array<{ id: DebugFilter; label: string }> = [
  { id: "all", label: "Все" },
  { id: "error", label: "Ошибки" },
  { id: "warning", label: "Предупреждения" },
];

export function TechCardJournal({
  cardId,
  entries,
  diagnostics,
}: {
  cardId: number;
  entries: TechCardHistoryEntry[];
  diagnostics: ProductionDiagnostic[];
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"journal" | "debug">("journal");
  const [filter, setFilter] = useState<DebugFilter>("all");
  const [pending, setPending] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const incoming = JSON.stringify(diagnostics);
  const [seen, setSeen] = useState(incoming);
  const [rows, setRows] = useState(() => readDiagnostics(diagnostics));
  if (incoming !== seen) {
    setSeen(incoming);
    setRows(readDiagnostics(diagnostics));
  }
  const errorCount = debugErrorCount(rows);
  const visible = filterDiagnostics(rows, filter);

  async function refresh() {
    setPending(true);
    setRefreshError(null);
    const result = await refreshTechnicalCardDiagnostics(cardId);
    setPending(false);
    if (!result.ok) {
      setRefreshError(result.message);
      return;
    }
    setRows(readDiagnostics(result.diagnostics));
    router.refresh();
  }

  function reveal(anchor: string) {
    document.querySelector(`[data-${anchor}]`)?.scrollIntoView({ block: "nearest" });
  }

  return (
    <div className="grid gap-portal-3" data-tech-card-journal>
      <div className="flex flex-wrap gap-portal-2" role="tablist" aria-label="Журнал техкарты">
        <button type="button" role="tab" aria-selected={mode === "journal"} className={tabClass(mode === "journal")} onClick={() => setMode("journal")}>
          Журнал
        </button>
        <button type="button" role="tab" aria-selected={mode === "debug"} className={tabClass(mode === "debug")} onClick={() => setMode("debug")}>
          {errorCount > 0 ? `Debug ${errorCount}` : "Debug"}
        </button>
      </div>
      {mode === "journal" ? (
        entries.length === 0 ? (
          <EmptyState title="История пока пуста" description="События техкарты появятся здесь." />
        ) : (
          <ActivityTimeline label="История техкарты">
            {entries.map((entry) => (
              <ActivityTimelineItem key={entry.key} title={entry.title} description={entry.description} meta={entry.meta} />
            ))}
          </ActivityTimeline>
        )
      ) : (
        <div className="grid gap-portal-3" data-tech-card-debug>
          <div className="flex flex-wrap items-center gap-portal-2">
            {FILTERS.map((item) => (
              <button key={item.id} type="button" className={tabClass(filter === item.id)} aria-pressed={filter === item.id} onClick={() => setFilter(item.id)}>
                {item.label}
              </button>
            ))}
            <Button type="button" size="compact" variant="secondary" disabled={pending} onClick={() => void refresh()}>
              {pending ? "Обновляем..." : "Обновить диагностику"}
            </Button>
          </div>
          {refreshError ? <p role="alert" className="text-portal-caption text-portal-danger">{refreshError}</p> : null}
          {rows.length === 0 ? (
            <p className="text-portal-caption text-portal-muted">Ошибок и предупреждений не обнаружено.</p>
          ) : visible.length === 0 ? (
            <p className="text-portal-caption text-portal-muted">Нет записей по этому фильтру.</p>
          ) : (
            <div className="grid gap-portal-2">
              {visible.map((row) => (
                <PlatformDiagnosticCard key={`${row.code}|${row.entity_type}|${row.entity_id}|${row.field}|${row.operation_id ?? ""}|${row.resource_key ?? ""}`} row={row} onReveal={reveal} />
              ))}
            </div>
          )}
          <ul className="grid gap-1 text-portal-caption text-portal-muted">
            {DEBUG_BACKEND_GAPS.map((line) => <li key={line}>{line}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

function tabClass(selected: boolean): string {
  return `rounded-portal-full px-portal-3 py-1 text-portal-caption font-medium ${selected ? "bg-portal-primary-soft text-portal-primary" : "bg-portal-surface-secondary text-portal-muted"}`;
}
