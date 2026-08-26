"use client";

import { Check, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";

import { IconButton } from "@/components/ui/button";
import { fieldsForBlock, type LeadCardField, type LeadCardFieldBlock } from "@/lib/sales/lead-card-fields";

function display(value?: string | null) {
  return value?.trim() || "Не указано";
}

export function LeadCardCustomFields({
  block,
  fields,
  editing,
  canManage,
  onAdd,
  onDelete,
  onValueChange,
}: {
  block: LeadCardFieldBlock;
  fields: LeadCardField[];
  editing: boolean;
  canManage: boolean;
  onAdd: (block: LeadCardFieldBlock, label: string) => Promise<void> | void;
  onDelete: (id: number) => Promise<void> | void;
  onValueChange: (id: number, value: string) => void;
}) {
  const rows = fieldsForBlock(fields, block);
  const [adding, setAdding] = useState(false);
  const [draftLabel, setDraftLabel] = useState("");
  const [busy, setBusy] = useState(false);

  async function submitAdd() {
    const label = draftLabel.trim();
    if (!label || busy) return;
    setBusy(true);
    try {
      await onAdd(block, label);
      setDraftLabel("");
      setAdding(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {rows.map((field) => (
        editing ? (
          <label key={field.id} className="block min-w-0 text-sm font-medium text-slate-700">
            <span className="flex items-center justify-between gap-2">
              <span>{field.label}</span>
              {canManage ? (
                <IconButton
                  type="button"
                  label={`Удалить поле ${field.label}`}
                  onClick={() => onDelete(field.id)}
                >
                  <Trash2 size={14} aria-hidden="true" />
                </IconButton>
              ) : null}
            </span>
            <input
              value={field.value}
              onChange={(event) => onValueChange(field.id, event.target.value)}
              className="mt-1 h-10 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>
        ) : (
          <div key={field.id} className="lead-detail-pair min-w-0">
            <dt className="min-w-0 text-xs font-normal text-slate-500">{field.label}</dt>
            <dd className="mt-1 min-w-0 text-sm font-normal leading-snug text-slate-800">{display(field.value)}</dd>
          </div>
        )
      ))}
      {canManage ? (
        adding ? (
          <div className="flex items-end gap-0.5">
            <label className="min-w-0 flex-1 text-sm font-medium text-slate-700">
              Новое поле
              <input
                value={draftLabel}
                onChange={(event) => setDraftLabel(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void submitAdd();
                  }
                  if (event.key === "Escape") {
                    event.preventDefault();
                    setDraftLabel("");
                    setAdding(false);
                  }
                }}
                className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
                autoFocus
              />
            </label>
            <div className="mb-px flex shrink-0 items-center gap-0.5">
              <IconButton
                type="button"
                label="Отмена"
                onClick={() => {
                  setDraftLabel("");
                  setAdding(false);
                }}
                disabled={busy}
              >
                <X size={16} aria-hidden="true" />
              </IconButton>
              <IconButton
                type="button"
                label="Сохранить"
                onClick={() => void submitAdd()}
                disabled={busy || !draftLabel.trim()}
              >
                <Check size={16} aria-hidden="true" />
              </IconButton>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="inline-flex items-center gap-1 text-sm font-medium text-blue-700 hover:underline"
            onClick={() => setAdding(true)}
          >
            <Plus size={14} aria-hidden="true" /> Добавить поле
          </button>
        )
      ) : null}
    </div>
  );
}
