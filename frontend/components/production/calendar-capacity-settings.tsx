"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  loadCapacityResource,
  saveCapacityResource,
  saveCapacityResourceException,
  deleteCapacityResourceException,
} from "@/app/(workspace)/settings/catalogs/tech-operations/capacity-resource-actions";
import { PageContent } from "@/components/layout/page-layout";
import { CalendarToolbar } from "@/components/production/calendar-toolbar";
import { CapacityResourceFields } from "@/components/settings/tech-operation-capacity-fields";
import { Button } from "@/components/ui/button";
import type { ProductionStage } from "@/lib/production-stages";
import type { WorkCenter } from "@/lib/shop-routings";
import {
  formatResourceRate,
  isSharedResource,
  removeCapacityException,
  upsertCapacityException,
  type CapacityResource,
} from "@/lib/tech-operation-capacity";
import type { TechOperation } from "@/lib/tech-operations";

const panelClass = "min-w-0 rounded-portal-lg border border-portal-border bg-portal-surface p-portal-4";

function stageName(resource: CapacityResource, stages: ProductionStage[]): string {
  return stages.find((stage) => stage.id === resource.production_stage_id)?.name ?? "Без цеха";
}

function linkedOperations(resource: CapacityResource, operations: TechOperation[]): TechOperation[] {
  return operations.filter((operation) => (operation.capacity_resource_keys ?? []).includes(resource.key));
}

export function CalendarCapacitySettings({
  resources: initialResources,
  operations,
  productionStages,
  workCenters,
}: {
  resources: CapacityResource[];
  operations: TechOperation[];
  productionStages: ProductionStage[];
  workCenters: WorkCenter[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initialResources);
  const [seen, setSeen] = useState(initialResources);
  const [selectedKey, setSelectedKey] = useState<string | null>(initialResources[0]?.key ?? null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  if (seen !== initialResources) {
    setSeen(initialResources);
    setRows(initialResources);
  }

  const selected = rows.find((item) => item.key === selectedKey) ?? rows[0] ?? null;

  function selectResource(key: string) {
    setSelectedKey(key);
    setError("");
    setStatus("");
  }

  return (
    <PageContent>
      <div className="space-y-portal-4">
        <CalendarToolbar current="/production/calendar/capacity" />
        <header className="flex flex-wrap items-center justify-between gap-portal-3">
          <div>
            <h1 className="text-portal-title font-semibold">Мощности</h1>
            <p className="text-portal-caption text-portal-muted">Те же ресурсы, что у тех операций. Отдельного каталога мощности нет.</p>
          </div>
          <div className="flex flex-wrap gap-portal-3">
            <Link href="/settings/catalogs/tech-operations" className="text-portal-body font-medium text-portal-primary underline">Справочник операций</Link>
            <Link href="/production/calendar" className="text-portal-body font-medium text-portal-primary underline">Вернуться в очередь</Link>
          </div>
        </header>
        {status ? <p role="status" className="text-portal-caption text-portal-primary">{status}</p> : <p role="status" className="sr-only">Список ресурсов мощности</p>}
        {error ? <div role="alert" className={panelClass}><p className="text-portal-danger">{error}</p></div> : null}
        {!rows.length ? <p className={panelClass}>Мощности ещё не заданы.</p> : selected ? (
          <div className="grid min-w-0 gap-portal-4 lg:grid-cols-[minmax(16rem,22rem)_minmax(0,1fr)]">
            <section className={panelClass} aria-label="Ресурсы мощности">
              <div className="space-y-portal-4 md:hidden">
                {Array.from(new Set(rows.map((item) => stageName(item, productionStages)))).map((section) => (
                  <div key={section}>
                    <h2 className="mb-portal-2 text-portal-caption font-semibold text-portal-muted">{section}</h2>
                    <ul className="space-y-portal-2">
                      {rows.filter((item) => stageName(item, productionStages) === section).map((item) => (
                        <li key={item.key}>
                          <button type="button" className={`w-full rounded-portal-md border p-portal-3 text-left ${item.key === selected.key ? "border-portal-primary bg-portal-primary-soft" : "border-portal-border"}`} aria-current={item.key === selected.key ? "true" : undefined} onClick={() => selectResource(item.key)}>
                            <span className="block font-medium">{item.name}</span>
                            <span className="block text-portal-caption text-portal-muted">{formatResourceRate(item)}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-left text-portal-body">
                  <thead>
                    <tr className="text-portal-caption text-portal-muted">
                      <th className="py-portal-2 pr-portal-2 font-medium">Ресурс</th>
                      <th className="py-portal-2 font-medium">Операции</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((item) => (
                      <tr key={item.key} className="border-t border-portal-border">
                        <td className="py-portal-2 pr-portal-2">
                          <button type="button" className="text-left font-medium" aria-current={item.key === selected.key ? "true" : undefined} onClick={() => selectResource(item.key)}>
                            {item.name}
                          </button>
                          <span className="block text-portal-caption text-portal-muted">{formatResourceRate(item)}</span>
                        </td>
                        <td className="py-portal-2">{linkedOperations(item, operations).map((operation) => operation.name).join(", ") || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
            <CapacityEditor
              key={selected.key}
              resource={selected}
              operations={operations}
              productionStages={productionStages}
              workCenters={workCenters}
              onSaved={(resource) => {
                setRows((current) => current.map((item) => item.key === resource.key ? resource : item));
                setStatus(`Сохранено: ${resource.name}`);
                setError("");
                router.refresh();
              }}
              onError={setError}
            />
          </div>
        ) : null}
      </div>
    </PageContent>
  );
}

function CapacityEditor({
  resource,
  operations,
  productionStages,
  workCenters,
  onSaved,
  onError,
}: {
  resource: CapacityResource;
  operations: TechOperation[];
  productionStages: ProductionStage[];
  workCenters: WorkCenter[];
  onSaved: (resource: CapacityResource) => void;
  onError: (message: string) => void;
}) {
  const [draft, setDraft] = useState(resource);
  const [busy, setBusy] = useState(false);
  const dirty = useRef(false);
  const names = linkedOperations(resource, operations).map((operation) => operation.name);

  useEffect(() => {
    let cancelled = false;
    dirty.current = false;
    void loadCapacityResource(resource.key).then((result) => {
      if (cancelled || dirty.current) return;
      if (!result.ok) {
        onError(result.message);
        return;
      }
      setDraft(result.resource);
    });
    return () => {
      cancelled = true;
    };
  }, [onError, resource.key]);

  async function save() {
    setBusy(true);
    onError("");
    const result = await saveCapacityResource(draft);
    setBusy(false);
    if (!result.ok) {
      onError(result.message);
      return;
    }
    setDraft(result.resource);
    onSaved(result.resource);
  }

  return (
    <section className={panelClass} aria-label={`Мощность ${resource.name}`}>
      <p className="mb-portal-3 text-portal-caption text-portal-muted">
        Операции: {names.length ? names.join(", ") : "не связаны"}
        {isSharedResource(operations, resource.key) ? " · Общий ресурс" : ""}
      </p>
      <CapacityResourceFields
        value={draft}
        productionStages={productionStages}
        workCenters={workCenters}
        disabled={busy}
        lockKey
        onChange={(next) => {
          dirty.current = true;
          setDraft(next);
        }}
        onSaveException={async (exception) => {
          const result = await saveCapacityResourceException(resource.key, exception);
          if (!result.ok) return result.message;
          const next = { ...draft, exceptions: upsertCapacityException(draft.exceptions, result.exception) };
          setDraft(next);
          onSaved(next);
          return null;
        }}
        onRemoveException={async (date) => {
          const result = await deleteCapacityResourceException(resource.key, date);
          if (!result.ok) return result.message;
          const next = { ...draft, exceptions: removeCapacityException(draft.exceptions, date) };
          setDraft(next);
          onSaved(next);
          return null;
        }}
      />
      <Button className="mt-portal-4" variant="primary" disabled={busy} onClick={() => void save()}>
        {busy ? "Сохранение…" : "Сохранить мощность"}
      </Button>
    </section>
  );
}
