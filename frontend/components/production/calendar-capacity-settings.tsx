"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { loadEquipmentDay } from "@/app/(workspace)/production/calendar/capacity/load-actions";
import { loadCapacityResource } from "@/app/(workspace)/settings/catalogs/tech-operations/capacity-resource-actions";
import { PageContent } from "@/components/layout/page-layout";
import { CalendarCapacityResourceEditor } from "@/components/production/calendar-capacity-resource-editor";
import { CalendarToolbar } from "@/components/production/calendar-toolbar";
import { WorkCenterCapacityDrawer } from "@/components/settings/work-center-capacity-drawer";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/form-controls";
import {
  capacityWeekDates,
  filterCapacityRows,
  liveCapacityRows,
  resourcesAfterSave,
  UNKNOWN_CAPACITY,
  type CapacityKindFilter,
  type CapacitySetupFilter,
  type LiveCapacityRow,
} from "@/lib/production/capacity-live";
import type { ProductionStage } from "@/lib/production-stages";
import type { WorkCenter } from "@/lib/shop-routings";
import type { CapacityResource } from "@/lib/tech-operation-capacity";
import { equipmentCapacityHref, localIsoDate, operationSettingsHref, type EquipmentLoad } from "@/lib/tech-operation-ux";
import type { TechOperation } from "@/lib/tech-operations";

const panelClass = "min-w-0 rounded-portal-lg border border-portal-border bg-portal-surface p-portal-4";

function boundCenterIds(resources: CapacityResource[]): number[] {
  return resources.map((resource) => resource.work_center_id).filter((id): id is number => id != null);
}

export function CalendarCapacitySettings({
  resources: initialResources,
  operations,
  productionStages,
  workCenters,
  initialLoads,
  initialDate,
  initialLoadError = "",
}: {
  resources: CapacityResource[];
  operations: TechOperation[];
  productionStages: ProductionStage[];
  workCenters: WorkCenter[];
  initialLoads: EquipmentLoad[];
  initialDate: string;
  initialLoadError?: string;
}) {
  const router = useRouter();
  const [resources, setResources] = useState(initialResources);
  const [period, setPeriod] = useState<"day" | "week">("day");
  const [date, setDate] = useState(initialDate);
  const [stageId, setStageId] = useState<number | "all">("all");
  const [kind, setKind] = useState<CapacityKindFilter>("all");
  const [setup, setSetup] = useState<CapacitySetupFilter>("all");
  const [overloadOnly, setOverloadOnly] = useState(false);
  const [loads, setLoads] = useState(initialLoads);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [detailKey, setDetailKey] = useState<string | null>(null);
  const [detailError, setDetailError] = useState("");
  const [detailLoading, setDetailLoading] = useState(false);
  const [equipment, setEquipment] = useState<WorkCenter | null>(null);
  const [loadError, setLoadError] = useState(initialLoadError);
  const [loading, setLoading] = useState(false);
  const anchor = initialDate || localIsoDate(new Date());
  const weekDates = period === "week" ? capacityWeekDates(date) : [];

  const allRows = useMemo(
    () => liveCapacityRows({ resources, stages: productionStages, workCenters, operations, loads, date }),
    [date, loads, operations, productionStages, resources, workCenters],
  );
  const rows = useMemo(
    () => filterCapacityRows(allRows, { stageId, kind, setup, overloadOnly }),
    [allRows, kind, overloadOnly, setup, stageId],
  );
  const selected = rows.find((row) => row.key === selectedKey) ?? allRows.find((row) => row.key === selectedKey) ?? null;
  const selectedResource = resources.find((resource) => resource.key === selected?.resourceKey) ?? null;

  const refreshLoads = useCallback(async (nextDate: string, nextResources: CapacityResource[] = resources) => {
    setLoading(true);
    setLoadError("");
    try {
      setLoads(await loadEquipmentDay(boundCenterIds(nextResources), nextDate));
    } catch (error) {
      setLoads([]);
      setLoadError(error instanceof Error ? error.message : "Не удалось загрузить занятость оборудования.");
    } finally {
      setLoading(false);
    }
  }, [resources]);

  async function changeDate(nextDate: string) {
    setDate(nextDate);
    setLoads([]);
    await refreshLoads(nextDate);
  }

  async function openRow(key: string) {
    setSelectedKey(key);
    const row = allRows.find((item) => item.key === key);
    const resource = resources.find((item) => item.key === row?.resourceKey);
    if (!row?.resourceKey || row.kind !== "resource" || resource?.resource_type === "machine") {
      setDetailKey(null);
      setDetailError("");
      return;
    }
    setDetailLoading(true);
    setDetailError("");
    const result = await loadCapacityResource(row.resourceKey);
    setDetailLoading(false);
    if (!result.ok) {
      setDetailKey(null);
      setDetailError(result.message);
      return;
    }
    rememberResource(result.resource);
    setDetailKey(result.resource.key);
  }

  const rememberResource = useCallback((saved: CapacityResource, refresh = false) => {
    const next = resourcesAfterSave(resources, { ok: true, resource: saved }).resources;
    setResources(next);
    if (!refresh) return;
    router.refresh();
    void refreshLoads(date, next);
  }, [date, refreshLoads, resources, router]);

  return (
    <PageContent>
      <div className="min-w-0 space-y-portal-4">
        <CalendarToolbar current="/production/calendar/capacity" />
        <header className="space-y-portal-2">
          <h1 className="text-portal-title font-semibold">Мощности и загрузка</h1>
          <p className="text-portal-caption text-portal-muted">
            Оборудование показывает дневную доступность, занятость, остаток и процент из API.
            У персонала и других ресурсов занятость на дату — {UNKNOWN_CAPACITY}: сохранённые проводки по ним API не отдаёт.
          </p>
        </header>
        <div className="flex flex-wrap items-end gap-portal-2">
          <label className="text-portal-caption">
            Дата
            <input className="mt-1 block rounded-portal-md border border-portal-border bg-portal-surface px-portal-2 py-portal-1" type="date" value={date} onChange={(event) => { if (event.target.value) void changeDate(event.target.value); }} />
          </label>
          <Button type="button" size="compact" variant={period === "day" ? "primary" : "secondary"} onClick={() => setPeriod("day")}>День</Button>
          <Button type="button" size="compact" variant={period === "week" ? "primary" : "secondary"} aria-label="Показать дни недели, чтобы выбрать одну дату" onClick={() => setPeriod("week")}>Неделя</Button>
          <Button type="button" size="compact" variant="secondary" onClick={() => void changeDate(anchor)}>Сегодня</Button>
          <Select aria-label="Фильтр по цеху" value={stageId === "all" ? "" : String(stageId)} onChange={(event) => setStageId(event.target.value ? Number(event.target.value) : "all")}>
            <option value="">Все цеха</option>
            {productionStages.map((stage) => <option key={stage.id} value={stage.id}>{stage.name}</option>)}
          </Select>
          <Select aria-label="Фильтр по виду мощности" value={kind} onChange={(event) => setKind(event.target.value as CapacityKindFilter)}>
            <option value="all">Ресурсы и оборудование</option>
            <option value="work_center">Оборудование</option>
            <option value="resource">Ресурс</option>
          </Select>
          <Select aria-label="Фильтр по настройке" value={setup} onChange={(event) => setSetup(event.target.value as CapacitySetupFilter)}>
            <option value="all">Все состояния</option>
            <option value="configured">Настроено</option>
            <option value="unconfigured">Не настроено</option>
          </Select>
          <Button type="button" size="compact" variant={overloadOnly ? "primary" : "secondary"} onClick={() => setOverloadOnly((value) => !value)}>Перегрузка</Button>
          <Button type="button" size="compact" variant="secondary" disabled={loading} onClick={() => void refreshLoads(date)}>
            {loading ? "Обновление…" : "Обновить занятость"}
          </Button>
        </div>
        <p className="text-portal-caption text-portal-muted">«Сегодня» открывает текущую дату. «Неделя» показывает дни, чтобы выбрать одну дату. Сумма за неделю не считается.</p>
        {weekDates.length > 0 ? (
          <div className="flex flex-wrap gap-portal-2" aria-label="Дни выбранной недели">
            {weekDates.map((day) => (
              <Button key={day} type="button" size="compact" variant={day === date ? "primary" : "secondary"} onClick={() => void changeDate(day)}>{day.slice(8)}</Button>
            ))}
          </div>
        ) : null}
        {loadError ? (
          <p role="alert" className="text-portal-danger">
            {loadError}{" "}
            <button type="button" className="font-medium underline" onClick={() => void refreshLoads(date)}>Повторить</button>
          </p>
        ) : <p role="status" className="sr-only">{loading ? "Загрузка занятости" : "Список мощностей и загрузки"}</p>}
        {rows.length === 0 ? (
          <p className={panelClass}>{resources.length === 0 && workCenters.length === 0 ? "Мощности ещё не заданы." : "Нет мощностей с выбранным фильтром."}</p>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[880px] text-left text-portal-body">
                <thead>
                  <tr className="text-portal-caption text-portal-muted">
                    <th className="py-portal-2 pr-portal-2 font-medium">Ресурс / оборудование</th>
                    <th className="py-portal-2 pr-portal-2 font-medium">Цех</th>
                    <th className="py-portal-2 pr-portal-2 font-medium">Состояние</th>
                    <th className="py-portal-2 pr-portal-2 font-medium">Единица</th>
                    <th className="py-portal-2 pr-portal-2 font-medium">Доступно</th>
                    <th className="py-portal-2 pr-portal-2 font-medium">Занято</th>
                    <th className="py-portal-2 pr-portal-2 font-medium">Остаток</th>
                    <th className="py-portal-2 font-medium">Загрузка</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.key} className="border-t border-portal-border" data-capacity-row={row.key}>
                      <td className="py-portal-2 pr-portal-2">
                        <button type="button" className="text-left font-medium" onClick={() => void openRow(row.key)}>{row.name}</button>
                      </td>
                      <td className="py-portal-2 pr-portal-2">{row.stageName}</td>
                      <td className="py-portal-2 pr-portal-2">{row.statusLabel}</td>
                      <td className="py-portal-2 pr-portal-2">{row.unitLabel ?? "—"}</td>
                      <td className="py-portal-2 pr-portal-2">{row.availableLabel}</td>
                      <td className="py-portal-2 pr-portal-2">{row.occupiedLabel}</td>
                      <td className="py-portal-2 pr-portal-2">{row.remainingLabel}</td>
                      <td className="py-portal-2">{row.utilizationLabel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="space-y-portal-3 md:hidden">
              {rows.map((row) => <CapacityCard key={row.key} row={row} onOpen={() => void openRow(row.key)} />)}
            </div>
          </>
        )}
        {selected ? (
          <section className={panelClass} aria-label="Подробности мощности">
            <h2 className="font-semibold">{selected.name}</h2>
            <p className="mt-portal-2 text-portal-caption text-portal-muted">
              {selected.kind === "work_center" ? "Оборудование" : "Ресурс"}
              {selected.resourceName && selected.workCenterName ? ` · ресурс ${selected.resourceName}` : ""}
              {` · ${selected.stageName}`}
              {selected.unitLabel ? ` · ${selected.unitLabel}` : ""}
            </p>
            <p className="mt-portal-2">{selected.statusLabel}. Доступно {selected.availableLabel}, занято {selected.occupiedLabel}, остаток {selected.remainingLabel}, загрузка {selected.utilizationLabel}.</p>
            {selected.kind !== "work_center" ? (
              <p className="mt-portal-2 text-portal-caption text-portal-muted">Занятость этого ресурса на дату неизвестна: API дневной загрузки есть только у оборудования.</p>
            ) : null}
            <div className="mt-portal-3 flex flex-wrap gap-portal-3">
              {selected.workCenterId != null ? (
                <Button type="button" variant="secondary" onClick={() => setEquipment(workCenters.find((center) => center.id === selected.workCenterId) ?? null)}>
                  Мощность оборудования
                </Button>
              ) : null}
              {selected.operationId != null ? (
                <Link className="font-medium text-portal-primary underline" href={operationSettingsHref(selected.operationId, "capacity")}>Настроить норму в операции</Link>
              ) : null}
              {selected.workCenterId != null ? (
                <Link className="font-medium text-portal-primary underline" href={equipmentCapacityHref(selected.workCenterId)}>Карточка оборудования</Link>
              ) : null}
            </div>
            {detailLoading ? <p className="mt-portal-3 text-portal-caption text-portal-muted">Чтение ресурса…</p> : null}
            {detailError ? (
              <p role="alert" className="mt-portal-3 text-portal-danger">
                {detailError}{" "}
                <button type="button" className="font-medium underline" onClick={() => { if (selectedKey) void openRow(selectedKey); }}>Повторить</button>
              </p>
            ) : null}
            {selectedResource && detailKey === selectedResource.key && selected.kind === "resource" && selectedResource.resource_type !== "machine" ? (
              <div className="mt-portal-4">
                <CalendarCapacityResourceEditor
                  key={selectedResource.key}
                  resource={selectedResource}
                  date={date}
                  onSaved={(saved) => rememberResource(saved, true)}
                />
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
      <WorkCenterCapacityDrawer
        workCenter={equipment}
        onClose={() => setEquipment(null)}
        onSaved={(saved) => {
          rememberResource(saved, true);
          setEquipment(null);
        }}
      />
    </PageContent>
  );
}

function CapacityCard({ row, onOpen }: { row: LiveCapacityRow; onOpen: () => void }) {
  return (
    <article className={panelClass} data-capacity-row={row.key}>
      <button type="button" className="text-left font-medium" onClick={onOpen}>{row.name}</button>
      <p className="mt-portal-1 text-portal-caption text-portal-muted">{row.stageName} · {row.statusLabel}{row.unitLabel ? ` · ${row.unitLabel}` : ""}</p>
      <dl className="mt-portal-2 grid grid-cols-2 gap-portal-2 text-portal-caption">
        <div><dt className="text-portal-muted">Доступно</dt><dd>{row.availableLabel}</dd></div>
        <div><dt className="text-portal-muted">Занято</dt><dd>{row.occupiedLabel}</dd></div>
        <div><dt className="text-portal-muted">Остаток</dt><dd>{row.remainingLabel}</dd></div>
        <div><dt className="text-portal-muted">Загрузка</dt><dd>{row.utilizationLabel}</dd></div>
      </dl>
    </article>
  );
}
