"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { loadPlatformHealth } from "@/app/(workspace)/platform-health-actions";
import { PlatformDiagnosticCard } from "@/components/platform/platform-diagnostic-card";
import { Button } from "@/components/ui/button";
import {
  buildDebugLog,
  debugContextFromPath,
  debugLogFilename,
  filterHealthDiagnostics,
  type HealthCategoryFilter,
  type PlatformDebugContext,
  type PlatformHealthView,
} from "@/lib/platform-debug";

const FILTERS: Array<{ id: HealthCategoryFilter; label: string }> = [
  { id: "all", label: "Все" },
  { id: "CONFIGURATION", label: "Configuration" },
  { id: "DATA_FLOW", label: "Data Flow" },
  { id: "RUNTIME", label: "Runtime" },
  { id: "INTEGRITY", label: "Integrity" },
];

export function PlatformDebugCenter({ pathname, onClose }: { pathname: string; onClose: () => void }) {
  const initialContext = debugContextFromPath(pathname);
  const [context, setContext] = useState<PlatformDebugContext | null>(initialContext);
  const [filter, setFilter] = useState<HealthCategoryFilter>("all");
  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const [pending, setPending] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<PlatformHealthView | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const result = await loadPlatformHealth({
          category: filter === "all" ? null : filter,
          module: context?.module ?? null,
          entityType: context?.entityType ?? null,
          entityId: context?.entityId ?? null,
          offset,
        });
        if (cancelled) return;
        setPending(false);
        if (!result.ok) {
          setError(result.message);
          return;
        }
        setError(null);
        setHealth(result.health);
      } catch (caught) {
        if (cancelled) return;
        setPending(false);
        setError(caught instanceof Error ? caught.message : "Не удалось проверить платформу");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [context, filter, offset, nonce]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const visible = useMemo(
    () => filterHealthDiagnostics(health?.diagnostics ?? [], "all", query),
    [health, query],
  );

  function downloadLog() {
    const generatedAt = new Date();
    const payload = buildDebugLog({
      generatedAt,
      page: pathname,
      context,
      category: filter,
      query,
      offset: health?.offset ?? offset,
      total: health?.total ?? 0,
      diagnostics: visible,
    });
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = window.document.createElement("a");
    anchor.href = url;
    anchor.download = debugLogFilename(generatedAt);
    anchor.rel = "noopener";
    window.document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function reload(next?: { filter?: HealthCategoryFilter; context?: PlatformDebugContext | null; offset?: number }) {
    setPending(true);
    setError(null);
    if (next?.filter) setFilter(next.filter);
    if (next && "context" in next) setContext(next.context ?? null);
    if (next?.offset != null) setOffset(next.offset);
    setNonce((current) => current + 1);
  }

  const dialog = (
    <div className="fixed inset-0 z-portal-modal-2 flex items-center justify-center p-portal-4" role="presentation">
      <button type="button" className="absolute inset-0 bg-[#101828]/40" aria-label="Закрыть диагностику" onClick={onClose} />
      <section role="dialog" aria-modal="true" aria-labelledby="platform-debug-title" data-platform-debug-center className="relative flex max-h-[min(88vh,860px)] w-full max-w-4xl flex-col overflow-hidden rounded-portal-lg border border-portal-border bg-portal-surface shadow-portal-overlay">
        <header className="flex items-start justify-between gap-portal-3 border-b border-portal-border px-portal-4 py-portal-3">
          <div>
            <h2 id="platform-debug-title" className="text-portal-body font-semibold">Диагностика платформы</h2>
            <p className="text-portal-caption text-portal-muted">{context ? context.label : "Вся платформа"} · scope {health?.scope ?? "production"}</p>
          </div>
          <Button type="button" size="compact" variant="secondary" onClick={onClose}>Закрыть</Button>
        </header>
        <div className="grid gap-portal-3 overflow-y-auto px-portal-4 py-portal-3">
          {health ? (
            <div className="flex flex-wrap gap-portal-2 text-portal-caption">
              <Count label="Ошибки" value={health.countsBySeverity.error} />
              <Count label="Предупреждения" value={health.countsBySeverity.warning} />
              <Count label="Info" value={health.countsBySeverity.info} />
              {Object.entries(health.countsByCategory).map(([key, value]) => <Count key={key} label={key} value={value} />)}
              {Object.entries(health.countsByModule).map(([key, value]) => <Count key={`module-${key}`} label={key} value={value} />)}
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-portal-2">
            {FILTERS.map((item) => (
              <button key={item.id} type="button" className={chipClass(filter === item.id)} aria-pressed={filter === item.id} onClick={() => reload({ filter: item.id, offset: 0 })}>
                {item.label}
              </button>
            ))}
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Поиск"
              aria-label="Поиск диагностики"
              className="h-portal-control-compact min-w-40 rounded-portal-md border border-portal-border bg-portal-surface px-portal-3 text-portal-caption"
            />
            <Button type="button" size="compact" variant="secondary" disabled={pending} onClick={() => reload()}>
              {pending ? "Проверяем..." : "Проверить платформу"}
            </Button>
            <Button type="button" size="compact" variant="secondary" data-debug-log-download disabled={pending} onClick={downloadLog}>
              Скачать log
            </Button>
            {context ? (
              <Button type="button" size="compact" variant="secondary" onClick={() => reload({ context: null, offset: 0 })}>
                Показать все ошибки платформы
              </Button>
            ) : null}
          </div>
          {health && health.total > health.diagnostics.length ? (
            <p className="text-portal-caption text-portal-muted">
              Показаны {health.offset + 1}–{health.offset + health.diagnostics.length} из {health.total}. Поиск идёт по этой странице.
            </p>
          ) : null}
          {error ? <p role="alert" className="text-portal-caption text-portal-danger">{error}</p> : null}
          {health && health.total === 0 ? <p className="text-portal-caption text-portal-muted">Ошибок и предупреждений не обнаружено.</p> : null}
          {health && health.total > 0 && visible.length === 0 ? <p className="text-portal-caption text-portal-muted">Нет записей по этому фильтру.</p> : null}
          <div className="grid gap-portal-2">
            {visible.map((row) => <PlatformDiagnosticCard key={`${row.code}|${row.entity_type}|${row.entity_id}|${row.field}|${row.operation_id ?? ""}|${row.resource_key ?? ""}`} row={row} />)}
          </div>
          {health && health.offset + health.diagnostics.length < health.total ? (
            <Button type="button" size="compact" variant="secondary" onClick={() => reload({ offset: health.offset + health.limit })}>
              Дальше
            </Button>
          ) : null}
        </div>
      </section>
    </div>
  );

  return createPortal(dialog, document.body);
}

function Count({ label, value }: { label: string; value: number | undefined }) {
  return <span className="rounded-portal-full bg-portal-surface-secondary px-portal-2 py-0.5">{label}: {value ?? 0}</span>;
}

function chipClass(selected: boolean): string {
  return `rounded-portal-full px-portal-3 py-1 text-portal-caption font-medium ${selected ? "bg-portal-primary-soft text-portal-primary" : "bg-portal-surface-secondary text-portal-muted"}`;
}
