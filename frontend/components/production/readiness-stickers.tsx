"use client";

import { useState } from "react";

import {
  previewDiagnostics,
  stickerLabel,
  stickerMark,
  diagnosticKey,
  type ProductionDiagnostic,
} from "@/lib/production/readiness-stickers";

const TONE = {
  error: "bg-portal-danger-soft text-portal-danger",
  warning: "bg-portal-warning-soft text-portal-warning",
  info: "bg-portal-surface-secondary text-portal-muted",
} as const;

export function ReadinessStickers({
  diagnostics,
  onSelect,
}: {
  diagnostics: ProductionDiagnostic[];
  onSelect?: (row: ProductionDiagnostic) => void;
}) {
  const [open, setOpen] = useState(false);
  const preview = previewDiagnostics(diagnostics);
  if (preview.shown.length === 0 && preview.hidden === 0) return null;
  const rows = open ? previewDiagnostics(diagnostics, diagnostics.length).shown : preview.shown;
  return (
    <div className="flex flex-wrap items-center gap-1" data-readiness-stickers>
      {rows.map((row) => (
        <button
          key={diagnosticKey(row)}
          type="button"
          title={row.message}
          data-diagnostic-code={row.code}
          data-diagnostic-field={row.field}
          className={`inline-flex max-w-full items-center gap-1 rounded-portal-full px-portal-2 py-0.5 text-left text-portal-caption ${TONE[row.severity]}`}
          onClick={() => onSelect?.(row)}
        >
          <span aria-hidden="true">{stickerMark(row.severity)}</span>
          <span className="truncate">{stickerLabel(row)}</span>
        </button>
      ))}
      {!open && preview.hidden > 0 ? (
        <button type="button" className="rounded-portal-full bg-portal-surface-secondary px-portal-2 py-0.5 text-portal-caption text-portal-text" onClick={() => setOpen(true)}>
          Ещё {preview.hidden}
        </button>
      ) : null}
    </div>
  );
}
