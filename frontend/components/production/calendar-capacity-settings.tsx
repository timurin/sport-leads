"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { loadEquipmentPeriod } from "@/app/(workspace)/production/calendar/capacity/load-actions";
import { PageContent } from "@/components/layout/page-layout";
import { CalendarToolbar } from "@/components/production/calendar-toolbar";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/form-controls";
import type { ProductionStage } from "@/lib/production-stages";
import type { WorkCenter } from "@/lib/shop-routings";
import type { CapacityResource } from "@/lib/tech-operation-capacity";
import {
  capacityMonitorRows,
  localIsoDate,
  operationSettingsHref,
  type EquipmentLoad,
  type MonitorRow,
} from "@/lib/tech-operation-ux";
import type { TechOperation } from "@/lib/tech-operations";

const panelClass = "min-w-0 rounded-portal-lg border border-portal-border bg-portal-surface p-portal-4";

export function CalendarCapacitySettings({
  resources,
  operations,
  productionStages,
  workCenters,
  initialLoads,
  initialDate,
}: {
  resources: CapacityResource[];
  operations: TechOperation[];
  productionStages: ProductionStage[];
  workCenters: WorkCenter[];
  initialLoads: EquipmentLoad[];
  initialDate: string;
}) {
  const [period, setPeriod] = useState<"today" | "week">("today");
  const [stageId, setStageId] = useState<number | "all">("all");
  const [kind, setKind] = useState<"all" | "work_center" | "resource">("all");
  const [overloadOnly, setOverloadOnly] = useState(false);
  const [loads, setLoads] = useState(initialLoads);
  const [details, setDetails] = useState<MonitorRow | null>(null);
  const [error, setError] = useState("");
  const anchor = initialDate || localIsoDate(new Date());

  const rows = useMemo(
    () => capacityMonitorRows({ resources, stages: productionStages, workCenters, operations, loads }).filter((row) => {
      if (stageId !== "all" && row.stageId !== stageId) return false;
      if (kind !== "all" && row.kind !== kind) return false;
      if (overloadOnly && !row.overloaded) return false;
      return true;
    }),
    [kind, loads, operations, overloadOnly, productionStages, resources, stageId, workCenters],
  );

  async function changePeriod(next: "today" | "week") {
    setPeriod(next);
    setError("");
    const ids = resources.map((resource) => resource.work_center_id).filter((id): id is number => id != null);
    try {
      setLoads(await loadEquipmentPeriod(ids, anchor, next));
    } catch {
      setError("Не удалось загрузить занятость оборудования.");
    }
  }

  return (
    <PageContent>
      <div className="space-y-portal-4">
        <CalendarToolbar current="/production/calendar/capacity" />
        <header className="space-y-portal-2">
          <h1 className="text-portal-title font-semibold">Мощности и загрузка</h1>
          <p className="text-portal-caption text-portal-muted">Наблюдение за доступностью. Параметры мощности меняются в технологической операции.</p>
        </header>
        <div className="flex flex-wrap items-center gap-portal-2">
          <Button type="button" size="compact" variant={period === "today" ? "primary" : "secondary"} onClick={() => void changePeriod("today")}>Сегодня</Button>
          <Button type="button" size="compact" variant={period === "week" ? "primary" : "secondary"} onClick={() => void changePeriod("week")}>Текущая неделя</Button>
          <Select aria-label="Фильтр по цеху" value={stageId === "all" ? "" : String(stageId)} onChange={(event) => setStageId(event.target.value ? Number(event.target.value) : "all")}>
            <option value="">Все цеха</option>
            {productionStages.map((stage) => <option key={stage.id} value={stage.id}>{stage.name}</option>)}
          </Select>
          <Select aria-label="Фильтр по виду мощности" value={kind} onChange={(event) => setKind(event.target.value as "all" | "work_center" | "resource")}>
            <option value="all">Ресурсы и оборудование</option>
            <option value="work_center">Оборудование</option>
            <option value="resource">Ресурс</option>
          </Select>
          <Button type="button" size="compact" variant={overloadOnly ? "primary" : "secondary"} onClick={() => setOverloadOnly((value) => !value)}>Перегрузка</Button>
        </div>
        {error ? <p role="alert" className="text-portal-danger">{error}</p> : <p role="status" className="sr-only">Список мощностей и загрузки</p>}
        <p className="text-portal-caption text-portal-muted">Занятость показана для оборудования с API загрузки. У трудовых ресурсов в этом списке есть только расчётная доступность по графику.</p>
        {!resources.length ? <p className={panelClass}>Мощности ещё не заданы.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-portal-body">
              <thead>
                <tr className="text-portal-caption text-portal-muted">
                  <th className="py-portal-2 pr-portal-2 font-medium">Ресурс / оборудование</th>
                  <th className="py-portal-2 pr-portal-2 font-medium">Цех</th>
                  <th className="py-portal-2 pr-portal-2 font-medium">Доступно</th>
                  <th className="py-portal-2 pr-portal-2 font-medium">Занято</th>
                  <th className="py-portal-2 pr-portal-2 font-medium">Остаток</th>
                  <th className="py-portal-2 pr-portal-2 font-medium">Загрузка</th>
                  <th className="py-portal-2 font-medium">Настройка</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.key} className="border-t border-portal-border">
                    <td className="py-portal-2 pr-portal-2">
                      <button type="button" className="text-left font-medium" onClick={() => setDetails(row)}>{row.name}</button>
                    </td>
                    <td className="py-portal-2 pr-portal-2">{row.stageName}</td>
                    <td className="py-portal-2 pr-portal-2">{row.available ?? "—"}</td>
                    <td className="py-portal-2 pr-portal-2">{row.occupied ?? "—"}</td>
                    <td className="py-portal-2 pr-portal-2">{row.remaining ?? "—"}</td>
                    <td className="py-portal-2 pr-portal-2">{row.utilization == null ? "—" : `${row.utilization}%`}</td>
                    <td className="py-portal-2">
                      {row.operationId != null ? (
                        <Link className="font-medium text-portal-primary underline" href={operationSettingsHref(row.operationId, row.kind === "work_center" ? "equipment" : "capacity")}>Настроить</Link>
                      ) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {details ? (
          <section className={panelClass} aria-label="Подробности мощности">
            <h2 className="font-semibold">{details.name}</h2>
            <p className="mt-portal-2 text-portal-caption text-portal-muted">{details.stageName}{details.workCenterName ? ` · ${details.workCenterName}` : ""}</p>
            <p className="mt-portal-2">Доступно {details.available ?? "—"}, занято {details.occupied ?? "—"}, остаток {details.remaining ?? "—"}.</p>
            {details.operationId != null ? <Link className="mt-portal-3 inline-block font-medium text-portal-primary underline" href={operationSettingsHref(details.operationId)}>Настроить</Link> : null}
          </section>
        ) : null}
      </div>
    </PageContent>
  );
}
