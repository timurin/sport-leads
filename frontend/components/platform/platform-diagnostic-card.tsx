"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  diagnosticTechnicalRows,
  formatDebugValue,
  safeFixHref,
  traceChain,
} from "@/lib/platform-debug";
import { diagnosticCardAnchor, diagnosticKey, type ProductionDiagnostic } from "@/lib/production/readiness-stickers";

const SEVERITY_LABEL = { error: "ERROR", warning: "WARNING", info: "INFO" } as const;

export function PlatformDiagnosticCard({
  row,
  onReveal,
}: {
  row: ProductionDiagnostic;
  onReveal?: (anchor: string) => void;
}) {
  const tone = row.severity === "warning" ? "border-portal-warning" : row.severity === "info" ? "border-portal-border" : "border-portal-danger";
  const href = safeFixHref(row.fix_url);
  const anchor = diagnosticCardAnchor(row);
  const source = formatDebugValue(row.source_value);
  const actual = formatDebugValue(row.actual_value);
  const chain = traceChain(row.trace);
  const details = diagnosticTechnicalRows(row);
  return (
    <article className={`rounded-portal-md border ${tone} bg-portal-surface px-portal-3 py-portal-3`} data-debug-code={row.code} data-debug-severity={row.severity} data-diagnostic-key={diagnosticKey(row)}>
      <p className="text-portal-caption font-medium">
        {SEVERITY_LABEL[row.severity]}
        {row.category ? ` · ${row.category}` : ""}
        {row.module ? ` · ${row.module}` : ""}
      </p>
      <p className="text-portal-body">{row.entity_name} · {row.field_label}</p>
      <p className="text-portal-caption">{row.message}</p>
      <dl className="mt-portal-2 grid gap-1 text-portal-caption">
        {row.expected_source ? <div><dt className="text-portal-muted">Ожидаемый источник</dt><dd>{row.expected_source}</dd></div> : null}
        {source ? <div><dt className="text-portal-muted">Значение источника</dt><dd>{source}</dd></div> : null}
        {actual ? <div><dt className="text-portal-muted">Фактическое значение</dt><dd>{actual}</dd></div> : null}
        {row.fix_action ? <div><dt className="text-portal-muted">Что сделать</dt><dd>{row.fix_action}</dd></div> : null}
      </dl>
      <div className="mt-portal-3 flex flex-wrap items-center gap-portal-2" data-diagnostic-trace>
        {chain.map((node, index) => (
          <span key={node.id} className="flex items-center gap-portal-2">
            {index > 0 ? <span aria-hidden="true" className="text-portal-muted">→</span> : null}
            <span
              data-trace-node={node.id}
              data-trace-state={node.state}
              className={[
                "rounded-portal-full border px-portal-2 py-0.5 text-portal-caption",
                node.state === "broken" ? "border-portal-danger bg-portal-danger-soft text-portal-danger" : "border-portal-border text-portal-muted",
              ].join(" ")}
            >
              {node.id}
            </span>
          </span>
        ))}
      </div>
      {(row.trace ?? []).length === 0 ? <p className="mt-1 text-portal-caption text-portal-muted">Трассировка в ответе пуста.</p> : (
        <ul className="mt-1 grid gap-1 text-portal-caption text-portal-muted">
          {(row.trace ?? []).map((step, index) => {
            const value = formatDebugValue(step.value);
            return <li key={`${step.source}-${index}`}>{step.broken ? "broken" : "ok"} · {step.source}{value ? ` · ${value}` : ""}</li>;
          })}
        </ul>
      )}
      <div className="mt-portal-2 flex flex-wrap gap-portal-2">
        {anchor && onReveal ? (
          <Button type="button" size="compact" variant="secondary" onClick={() => onReveal(anchor)}>Показать в техкарте</Button>
        ) : null}
        {href ? (
          <Link href={href} className="portal-focus-ring inline-flex h-portal-control-compact items-center rounded-portal-md border border-portal-border px-portal-3 text-portal-caption">Перейти</Link>
        ) : null}
      </div>
      {details.length > 0 ? (
        <details className="mt-portal-2">
          <summary className="cursor-pointer text-portal-caption text-portal-muted">Технические данные</summary>
          <dl className="mt-1 grid gap-1 text-portal-caption">
            {details.map(([key, value]) => (
              <div key={key} className="flex gap-portal-2">
                <dt className="text-portal-muted">{key}:</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </details>
      ) : null}
    </article>
  );
}
