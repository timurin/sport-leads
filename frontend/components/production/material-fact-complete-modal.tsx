"use client";

import { X } from "lucide-react";
import { useEffect, useId, useState } from "react";

import { Button, IconButton } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Input } from "@/components/ui/form-controls";
import {
  validateMaterialFactQty,
  type MaterialFactDraft,
} from "@/lib/production/material-fact-complete";

export type MaterialFactSubmitResult = {
  ok: boolean;
  fieldErrors?: Record<number, string>;
  formError?: string | null;
};

export function MaterialFactCompleteModal({
  lines,
  onCancel,
  onSave,
  onSaveAndComplete,
}: {
  lines: MaterialFactDraft[];
  onCancel: () => void;
  onSave: (rows: MaterialFactDraft[]) => Promise<MaterialFactSubmitResult>;
  onSaveAndComplete: (rows: MaterialFactDraft[]) => Promise<MaterialFactSubmitResult>;
}) {
  const titleId = useId();
  const [rows, setRows] = useState(lines);
  const [fieldErrors, setFieldErrors] = useState<Record<number, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"save" | "complete" | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && busy == null) onCancel();
    };
    window.addEventListener("keydown", onKeyDown);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previous;
    };
  }, [busy, onCancel]);

  const validate = (next: MaterialFactDraft[]) => {
    const errors: Record<number, string> = {};
    for (const row of next) {
      const message = validateMaterialFactQty(row.factQty);
      if (message) errors[row.lineId] = message;
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const submit = async (mode: "save" | "complete") => {
    if (busy) return;
    if (!validate(rows)) return;
    setBusy(mode);
    setFormError(null);
    const result = mode === "save" ? await onSave(rows) : await onSaveAndComplete(rows);
    setBusy(null);
    if (!result.ok) {
      setFieldErrors(result.fieldErrors ?? {});
      setFormError(result.formError ?? null);
    }
  };

  return (
    <div className="fixed inset-0 z-portal-modal-2 flex items-center justify-center p-portal-4">
      <button
        type="button"
        className="absolute inset-0 bg-[#101828]/40"
        aria-label="Закрыть"
        disabled={busy != null}
        onClick={() => {
          if (busy == null) onCancel();
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 flex max-h-[min(90vh,44rem)] w-full max-w-[40rem] flex-col overflow-hidden rounded-portal-md border border-portal-border bg-portal-surface shadow-portal-overlay"
      >
        <header className="flex shrink-0 items-start justify-between gap-portal-3 border-b border-portal-border px-portal-5 py-portal-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-portal-page font-semibold text-portal-text">
              Фактический расход материалов
            </h2>
            <p className="mt-1 text-portal-caption text-portal-muted">
              Проверьте фактический расход материалов перед завершением операции.
            </p>
          </div>
          <IconButton label="Закрыть" disabled={busy != null} onClick={onCancel}>
            <X size={19} aria-hidden="true" />
          </IconButton>
        </header>
        <div className="min-h-0 flex-1 space-y-portal-3 overflow-y-auto p-portal-5">
          {formError ? <InlineAlert tone="danger">{formError}</InlineAlert> : null}
          <div className="overflow-hidden rounded-portal-md border border-portal-border">
            <table className="w-full border-collapse text-left">
              <thead className="bg-portal-surface-secondary text-portal-caption text-portal-muted">
                <tr>
                  <th className="px-portal-3 py-portal-2 font-medium">Материал</th>
                  <th className="px-portal-3 py-portal-2 font-medium">Ед.</th>
                  <th className="px-portal-3 py-portal-2 font-medium">План</th>
                  <th className="px-portal-3 py-portal-2 font-medium">Факт</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const inputId = `material-fact-${row.lineId}`;
                  const error = fieldErrors[row.lineId];
                  return (
                    <tr key={row.lineId} className="border-t border-portal-border">
                      <td className="px-portal-3 py-portal-2 text-portal-body text-portal-text">
                        <label htmlFor={inputId}>{row.name}</label>
                      </td>
                      <td className="px-portal-3 py-portal-2 text-portal-body text-portal-muted">
                        {row.unit}
                      </td>
                      <td className="px-portal-3 py-portal-2 text-portal-body text-portal-text">
                        {row.plannedQty || "—"}
                      </td>
                      <td className="px-portal-3 py-portal-2">
                        <Input
                          id={inputId}
                          size="compact"
                          inputMode="decimal"
                          autoComplete="off"
                          value={row.factQty}
                          invalid={Boolean(error)}
                          aria-invalid={Boolean(error)}
                          disabled={busy != null}
                          onChange={(event) => {
                            const factQty = event.target.value;
                            setRows((current) => current.map((item) => (
                              item.lineId === row.lineId ? { ...item, factQty } : item
                            )));
                            if (error) {
                              setFieldErrors((current) => {
                                const next = { ...current };
                                delete next[row.lineId];
                                return next;
                              });
                            }
                          }}
                        />
                        {error ? (
                          <p className="mt-1 text-portal-caption text-portal-danger" role="alert">
                            {error}
                          </p>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        <footer className="flex shrink-0 flex-wrap items-center justify-end gap-portal-2 border-t border-portal-border px-portal-5 py-portal-4">
          <Button type="button" variant="ghost" disabled={busy != null} onClick={onCancel}>
            Отмена
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={busy != null}
            onClick={() => void submit("save")}
          >
            {busy === "save" ? "Сохраняем..." : "Сохранить"}
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={busy != null}
            onClick={() => void submit("complete")}
          >
            {busy === "complete" ? "Сохраняем..." : "Сохранить и завершить"}
          </Button>
        </footer>
      </div>
    </div>
  );
}
