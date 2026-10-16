"use client";

import { AlertTriangle, Check, Circle, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  roadmapView,
  type FixTarget,
  type RoadmapRow,
  type TechnicalCardReadiness,
} from "@/lib/production/tech-card-readiness";

const CHIP_CLASS = {
  success: "border-portal-success/30 bg-portal-success-soft text-portal-success",
  warning: "border-portal-warning/40 bg-portal-warning-soft text-portal-warning",
  danger: "border-portal-danger/30 bg-portal-danger-soft text-portal-danger",
  neutral: "border-portal-primary/30 bg-portal-primary-soft text-portal-primary",
} as const;

function Marker({ marker }: { marker: RoadmapRow["marker"] }) {
  if (marker === "check") return <Check className="size-3" aria-hidden="true" />;
  if (marker === "warning") return <AlertTriangle className="size-3" aria-hidden="true" />;
  if (marker === "blocked") return <X className="size-3" aria-hidden="true" />;
  return <Circle className="size-3" aria-hidden="true" />;
}

function FixControl({
  target,
  onSection,
}: {
  target: FixTarget;
  onSection: (target: Extract<FixTarget, { kind: "section" }>) => void;
}) {
  if (target.kind === "url") {
    return (
      <Link href={target.href} className="text-portal-caption font-medium text-portal-primary hover:underline">
        {target.label}
      </Link>
    );
  }
  if (target.kind === "section") {
    return (
      <Button type="button" size="compact" variant="secondary" onClick={() => onSection(target)}>
        {target.label}
      </Button>
    );
  }
  return null;
}

export function TechCardReadinessRoadmap({
  readiness,
  debugMode = false,
  cardPath,
  onSection,
}: {
  readiness: TechnicalCardReadiness | null;
  debugMode?: boolean;
  cardPath: string;
  onSection: (target: Extract<FixTarget, { kind: "section" }>) => void;
}) {
  const [openCode, setOpenCode] = useState<string | null>(null);
  const view = readiness ? roadmapView(readiness, { debugMode, cardPath }) : null;
  const openRow = view?.rows.find((row) => row.code === openCode) ?? null;

  return (
    <section
      id="tech-card-readiness"
      data-tech-card-readiness={readiness ? "stickers" : "unavailable"}
      className="rounded-portal-lg border border-portal-border bg-portal-surface px-portal-3 py-portal-2 shadow-portal-card"
    >
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-portal-2 gap-y-0.5">
        <h2 className="text-portal-caption font-semibold text-portal-text">Готовность техкарты</h2>
        {view ? (
          <p className="text-portal-caption text-portal-muted" data-readiness-progress={view.progress}>
            {view.progress}
            <span className="mx-1">·</span>
            {view.overall}
          </p>
        ) : (
          <p className="text-portal-caption text-portal-muted">Готовность техкарты сейчас недоступна.</p>
        )}
      </div>
      {view ? (
        <div className="mt-portal-2 flex flex-wrap gap-1" data-readiness-stickers>
          {view.rows.map((row) => {
            const selected = openCode === row.code;
            return (
              <button
                key={row.code}
                type="button"
                data-readiness-step={row.code}
                data-readiness-status={row.status}
                aria-expanded={selected}
                title={row.title}
                className={`inline-flex max-w-full items-center gap-1 rounded-portal-full border px-2 py-0.5 text-portal-caption font-medium ${CHIP_CLASS[row.tone]} ${selected ? "ring-1 ring-portal-primary" : ""}`}
                onClick={() => setOpenCode((current) => (current === row.code ? null : row.code))}
              >
                <Marker marker={row.marker} />
                <span className="truncate">{row.sticker}</span>
              </button>
            );
          })}
        </div>
      ) : null}
      {openRow ? (
        <div className="mt-portal-2 grid gap-1 border-t border-portal-border pt-portal-2" data-readiness-detail={openRow.code}>
          {openRow.issues.length === 0 ? (
            <p className="text-portal-caption text-portal-muted">{openRow.summary}</p>
          ) : openRow.issues.map((issue, index) => (
            <div key={`${openRow.code}-${index}`} className="grid gap-1">
              <p className="text-portal-caption text-portal-text">{issue.message}</p>
              {issue.fixAction ? (
                <p className="text-portal-caption text-portal-muted">Как исправить: {issue.fixAction}</p>
              ) : null}
              <FixControl target={issue.navigation} onSection={onSection} />
              {issue.diagnostic ? (
                <p className="text-portal-caption text-portal-muted">
                  {issue.diagnostic.category ? `${issue.diagnostic.category}: ` : ""}
                  {issue.diagnostic.code}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
