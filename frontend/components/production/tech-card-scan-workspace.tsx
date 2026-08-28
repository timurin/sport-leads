"use client";

import { useMemo, useState, useTransition } from "react";

import { runTechCardScanCommandAction } from "@/app/(workspace)/production/scan/[token]/scan-actions";
import { PageContent, PageLayout } from "@/components/layout/page-layout";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form-controls";
import { InlineAlert } from "@/components/ui/inline-alert";
import { PageToolbar } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import type { TechCardScan } from "@/lib/production/tech-card-scan";
import { techCardWipStatusLabel } from "@/lib/production/tech-card-scan";

function wipTone(status: string): "danger" | "success" | "warning" | "primary" {
  if (status === "return") return "danger";
  if (status === "ready") return "success";
  if (status === "partial_ready") return "warning";
  return "primary";
}

export function TechCardScanWorkspace({
  token,
  scan,
  loadError,
}: {
  token: string;
  scan: TechCardScan | null;
  loadError?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [current, setCurrent] = useState<TechCardScan | null>(scan);
  const [error, setError] = useState<string | null>(loadError ?? null);
  const stages = current?.allowed_stages ?? [];
  const defaultStageId = stages[0]?.production_stage_id ?? 0;
  const [stageId, setStageId] = useState<number>(defaultStageId);
  const [selected, setSelected] = useState<Set<number>>(
    () => new Set((scan?.units ?? []).map((row) => row.id)),
  );
  const [performer, setPerformer] = useState("");
  const [workDone, setWorkDone] = useState("");
  const [duration, setDuration] = useState("");
  const [materialQty, setMaterialQty] = useState<Record<number, string>>({});

  const chosen = stages.find((row) => row.production_stage_id === stageId) ?? stages[0];
  const sewing = chosen?.stage_code === "sewing";
  const needsMaterials =
    chosen?.stage_code === "cutting" || chosen?.stage_code === "print";
  const materials = useMemo(
    () =>
      (current?.material_lines ?? []).filter(
        (row) =>
          chosen != null && row.production_stage_id === chosen.production_stage_id,
      ),
    [current, chosen],
  );

  function toggleUnit(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function run(action: "accept" | "complete-transfer" | "return") {
    if (!current || !chosen) return;
    const unitIds = current.units
      .filter((row) => selected.has(row.id))
      .map((row) => row.id);
    const durationSeconds = duration.trim()
      ? Number.parseInt(duration, 10)
      : undefined;
    const materialFacts = needsMaterials
      ? materials
          .map((row) => ({
            composition_line_id: row.composition_line_id,
            fact_qty: (materialQty[row.composition_line_id] || String(row.fact_qty ?? "")).trim(),
          }))
          .filter((row) => row.fact_qty !== "")
      : [];
    setError(null);
    startTransition(async () => {
      const result = await runTechCardScanCommandAction(token, action, {
        production_stage_id: chosen.production_stage_id,
        unit_line_ids: unitIds,
        performer_name: performer.trim() || undefined,
        work_done: workDone.trim() || undefined,
        duration_seconds:
          durationSeconds != null && Number.isFinite(durationSeconds)
            ? durationSeconds
            : undefined,
        material_facts: materialFacts,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setCurrent(result.scan);
      setSelected(new Set(result.scan.units.map((row) => row.id)));
    });
  }

  return (
    <PageLayout className="flex min-h-0 flex-1 flex-col">
      <PageToolbar
        start={
          <p className="text-portal-body font-semibold text-portal-text">
            {current ? `Скан ${current.display_number ?? current.number}` : "Скан техкарты"}
          </p>
        }
      />
      {error ? (
        <InlineAlert
          className="rounded-none border-x-0 border-t-0 border-b"
          tone="danger"
          size="compact"
        >
          {error}
        </InlineAlert>
      ) : null}
      <PageContent size="compact" className="flex min-h-0 flex-1 flex-col gap-portal-4">
        {!current ? (
          <InlineAlert tone="neutral">Откройте QR после входа в свою учётку.</InlineAlert>
        ) : (
          <div className="flex flex-col gap-portal-4">
            <div className="flex flex-wrap items-center gap-portal-2">
              <StatusBadge size="compact" tone={wipTone(current.wip_status)}>
                {current.wip_status_label || techCardWipStatusLabel(current.wip_status)}
              </StatusBadge>
              {current.restricted_sewing_only ? (
                <StatusBadge size="compact" tone="neutral">
                  Только Пошив
                </StatusBadge>
              ) : null}
            </div>
            <SectionCard title="Цех" size="compact">
              {stages.length > 1 ? (
                <Field label="Доступный цех">
                  <Select
                    value={String(chosen?.production_stage_id ?? "")}
                    onChange={(event) => setStageId(Number(event.target.value))}
                  >
                    {stages.map((row) => (
                      <option key={row.production_stage_id} value={row.production_stage_id}>
                        {row.stage_label}
                        {row.relation === "next" ? " (следующий)" : " (текущий)"}
                      </option>
                    ))}
                  </Select>
                </Field>
              ) : (
                <p className="text-portal-body text-portal-text">
                  {chosen?.stage_label ?? "Нет доступного цеха"}
                </p>
              )}
            </SectionCard>
            <SectionCard title="Штуки" description="Частичный скан = подмножество строк" size="compact">
              <ul className="flex flex-col gap-portal-2">
                {current.units.map((row) => (
                  <li key={row.id}>
                    <label className="flex items-center gap-portal-2 text-portal-body">
                      <input
                        type="checkbox"
                        checked={selected.has(row.id)}
                        onChange={() => toggleUnit(row.id)}
                      />
                      <span>
                        #{row.unit_index}
                        {row.size ? ` · ${row.size}` : ""}
                        {row.personalization ? ` · ${row.personalization}` : ""}
                        {row.stage_label ? ` · ${row.stage_label}` : ""}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </SectionCard>
            {!sewing ? (
              <SectionCard title="Факт цеха" size="compact">
                <div className="grid grid-cols-1 gap-portal-3 md:grid-cols-2">
                  <Field label="Исполнитель">
                    <Input
                      value={performer}
                      onChange={(event) => setPerformer(event.target.value)}
                    />
                  </Field>
                  <Field label="Длительность, сек">
                    <Input
                      inputMode="numeric"
                      value={duration}
                      onChange={(event) => setDuration(event.target.value)}
                    />
                  </Field>
                </div>
                <Field label="Что сделано" className="mt-portal-3">
                  <Textarea
                    rows={3}
                    value={workDone}
                    onChange={(event) => setWorkDone(event.target.value)}
                  />
                </Field>
                {needsMaterials
                  ? materials.map((row) => (
                      <Field
                        key={row.composition_line_id}
                        label={`${row.snapshot_name}${row.unit ? `, ${row.unit}` : ""}`}
                        className="mt-portal-3"
                      >
                        <Input
                          value={
                            materialQty[row.composition_line_id] ??
                            (row.fact_qty == null ? "" : String(row.fact_qty))
                          }
                          onChange={(event) =>
                            setMaterialQty((prev) => ({
                              ...prev,
                              [row.composition_line_id]: event.target.value,
                            }))
                          }
                        />
                      </Field>
                    ))
                  : null}
              </SectionCard>
            ) : (
              <InlineAlert tone="neutral">
                Пошив пишет журнал кабинета швеи: принять = take, передать = complete, возврат =
                release.
              </InlineAlert>
            )}
            <div className="flex flex-wrap gap-portal-2">
              <Button
                type="button"
                variant="primary"
                disabled={pending || selected.size === 0}
                onClick={() => run("accept")}
              >
                Принята в работу
              </Button>
              <Button
                type="button"
                disabled={pending || selected.size === 0}
                onClick={() => run("complete-transfer")}
              >
                Готова и передана
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={pending || selected.size === 0}
                onClick={() => run("return")}
              >
                Возврат
              </Button>
            </div>
          </div>
        )}
      </PageContent>
    </PageLayout>
  );
}
