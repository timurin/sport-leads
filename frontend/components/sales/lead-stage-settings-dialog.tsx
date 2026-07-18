"use client";

import { ArrowDown, ArrowUp, Plus, RotateCcw, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  LEAD_STAGE_ACCENTS,
  createLeadStageId,
  getDefaultLeadStages,
  getStageDeactivationIssue,
  sortLeadStages,
  validateLeadStages,
  type LeadStageAccent,
  type LeadStageConfig,
} from "@/lib/sales/lead-stages";

type Props = {
  stages: readonly LeadStageConfig[];
  leadCounts: Readonly<Record<string, number>>;
  onClose: () => void;
  onSave: (stages: LeadStageConfig[], transfers: Readonly<Record<string, string>>) => Promise<string | null>;
  onReset: (transfers: Readonly<Record<string, string>>) => Promise<string | null>;
};

const fieldClass = "h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-400";

export function LeadStageSettingsDialog({
  stages,
  leadCounts,
  onClose,
  onSave,
  onReset,
}: Props) {
  const [draftStages, setDraftStages] = useState<LeadStageConfig[]>(() => sortLeadStages(stages));
  const [transfers, setTransfers] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  function updateStage(stageId: string, changes: Partial<LeadStageConfig>) {
    setDraftStages((current) => current.map((stage) => (
      stage.id === stageId ? { ...stage, ...changes } : stage
    )));
    setError("");
  }

  function moveStage(stageId: string, direction: -1 | 1) {
    setDraftStages((current) => {
      const ordered = sortLeadStages(current);
      const index = ordered.findIndex((stage) => stage.id === stageId);
      const targetIndex = index + direction;

      if (index < 0 || targetIndex < 0 || targetIndex >= ordered.length) {
        return current;
      }

      [ordered[index], ordered[targetIndex]] = [ordered[targetIndex], ordered[index]];
      return ordered.map((stage, sortOrder) => ({ ...stage, sortOrder }));
    });
  }

  function toggleStage(stageId: string) {
    const stage = draftStages.find((item) => item.id === stageId);

    if (!stage) {
      return;
    }

    if (stage.isActive) {
      const leadStageIds = Object.entries(leadCounts).flatMap(([id, count]) => (
        Array.from({ length: count }, () => id)
      ));
      const issue = getStageDeactivationIssue(draftStages, stageId, leadStageIds);

      if (issue === "last-active-stage") {
        setError("Должна остаться хотя бы одна активная рабочая стадия.");
        return;
      }
    } else {
      setTransfers((current) => {
        const next = { ...current };
        delete next[stageId];
        return next;
      });
    }

    updateStage(stageId, { isActive: !stage.isActive });
  }

  function addStage() {
    const id = createLeadStageId(draftStages);

    setDraftStages((current) => [
      ...sortLeadStages(current),
      {
        id,
        title: "Новая стадия",
        accentClass: "bg-slate-500",
        isActive: true,
        sortOrder: current.length,
        isSystem: false,
      },
    ]);
    setError("");
  }

  async function save() {
    const normalized = sortLeadStages(draftStages).map((stage, sortOrder) => ({
      ...stage,
      title: stage.title.trim(),
      sortOrder,
    }));

    if (!validateLeadStages(normalized)) {
      setError("Проверьте названия, идентификаторы и активные стадии.");
      return;
    }

    for (const stage of normalized) {
      if (stage.isActive || !leadCounts[stage.id]) {
        continue;
      }

      const target = normalized.find((item) => item.id === transfers[stage.id]);

      if (!target || !target.isActive || target.id === stage.id) {
        setError(`Выберите активную стадию для переноса лидов из «${stage.title}».`);
        return;
      }
    }

    setIsSaving(true);
    const saveError = await onSave(normalized, transfers);
    setIsSaving(false);
    if (saveError) {
      setError(saveError);
    }
  }

  async function reset() {
    const defaultIds = new Set(getDefaultLeadStages().map((stage) => stage.id));
    const affectedStageIds = draftStages
      .filter((stage) => !defaultIds.has(stage.id) && leadCounts[stage.id])
      .map((stage) => stage.id);
    const resetTransfers = Object.fromEntries(affectedStageIds.map((stageId) => [stageId, "new"]));
    const warning = affectedStageIds.length
      ? "Лиды из пользовательских стадий будут перенесены в стадию «Новый». Продолжить?"
      : "Восстановить стандартные названия, порядок, цвета и активность стадий?";

    if (window.confirm(warning)) {
      setIsSaving(true);
      const resetError = await onReset(resetTransfers);
      setIsSaving(false);
      if (resetError) {
        setError(resetError);
      }
    }
  }

  const orderedStages = sortLeadStages(draftStages);
  const activeTargets = orderedStages.filter((stage) => stage.isActive);

  return (
    <div
      className="fixed inset-0 z-[210] flex items-center justify-center bg-slate-950/40 p-4"
      role="presentation"
      onMouseDown={onClose}
    >
      <section
        className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-6 text-slate-900 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lead-stage-settings-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="lead-stage-settings-title" className="text-xl font-semibold text-slate-950">
              Настройка стадий
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Настройки сохраняются в backend и применяются ко всем лидам.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            aria-label="Закрыть настройку стадий"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-5 space-y-3">
          {orderedStages.map((stage, index) => {
            const leadsCount = leadCounts[stage.id] ?? 0;

            return (
              <article key={stage.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="grid items-center gap-3 md:grid-cols-[minmax(0,1fr)_170px_auto_auto]">
                  <label className="text-xs font-medium text-slate-600">
                    Название
                    <input
                      value={stage.title}
                      onChange={(event) => updateStage(stage.id, { title: event.target.value })}
                      className={`mt-1 w-full ${fieldClass}`}
                    />
                  </label>
                  <label className="text-xs font-medium text-slate-600">
                    Цвет
                    <select
                      value={stage.accentClass}
                      onChange={(event) => updateStage(stage.id, { accentClass: event.target.value as LeadStageAccent })}
                      className={`mt-1 w-full ${fieldClass}`}
                    >
                      {LEAD_STAGE_ACCENTS.map((accent) => (
                        <option key={accent.value} value={accent.value}>{accent.label}</option>
                      ))}
                    </select>
                  </label>
                  <div className="flex items-center gap-1 self-end">
                    <button
                      type="button"
                      onClick={() => moveStage(stage.id, -1)}
                      disabled={index === 0}
                      className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                      aria-label={`Переместить стадию «${stage.title}» вверх`}
                    >
                      <ArrowUp size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveStage(stage.id, 1)}
                      disabled={index === orderedStages.length - 1}
                      className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                      aria-label={`Переместить стадию «${stage.title}» вниз`}
                    >
                      <ArrowDown size={16} />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleStage(stage.id)}
                    className={`h-9 self-end rounded-lg px-3 text-sm font-medium ${
                      stage.isActive
                        ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                        : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                    }`}
                  >
                    {stage.isActive ? "Активна" : "Отключена"}
                  </button>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                  <span>ID: {stage.id}</span>
                  <span>Лидов: {leadsCount}</span>
                </div>

                {!stage.isActive && leadsCount > 0 ? (
                  <label className="mt-3 block rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    В этой стадии есть лиды. Выберите активную стадию для переноса:
                    <select
                      value={transfers[stage.id] ?? ""}
                      onChange={(event) => {
                        setTransfers((current) => ({ ...current, [stage.id]: event.target.value }));
                        setError("");
                      }}
                      className={`mt-2 w-full ${fieldClass}`}
                    >
                      <option value="">Выберите стадию</option>
                      {activeTargets.filter((target) => target.id !== stage.id).map((target) => (
                        <option key={target.id} value={target.id}>{target.title}</option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </article>
            );
          })}
        </div>

        {error ? <p className="mt-4 text-sm text-red-700" role="alert">{error}</p> : null}

        <div className="mt-5 flex flex-wrap justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={addStage} disabled={isSaving}><Plus size={16} />Добавить стадию</Button>
            <Button type="button" onClick={reset} disabled={isSaving}><RotateCcw size={16} />По умолчанию</Button>
          </div>
          <div className="flex gap-2">
            <Button type="button" onClick={onClose} disabled={isSaving}>Отмена</Button>
            <Button type="button" variant="primary" onClick={save} disabled={isSaving}>
              {isSaving ? "Сохранение…" : "Сохранить"}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
