"use client";

import { Boxes, FilterX, Gauge, Package, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import {
  deleteTechOperation,
} from "@/app/(workspace)/settings/catalogs/tech-operations/tech-operation-actions";
import { TechOperationEditModal } from "@/components/settings/tech-operation-edit-modal";
import { TechOperationCreateDrawer } from "@/components/settings/tech-operation-create-drawer";
import { Button, IconButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Select } from "@/components/ui/form-controls";
import { ListTotals } from "@/components/ui/list-pagination";
import { PageToolbar } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  CALCULATION_MODE_LABEL,
  formatOperationCapacity,
  type CalculationMode,
  type CapacityResource,
} from "@/lib/tech-operation-capacity";
import {
  matchesCatalog,
  operationMode,
  operationReadiness,
  type CatalogChip,
  type OperationEditorTab,
} from "@/lib/tech-operation-ux";
import {
  filterTechOperations,
  formatTechOperationVolumeUnit,
  type TechOperation,
} from "@/lib/tech-operations";
import type { ProductionStage } from "@/lib/production-stages";
import type { WorkCenter } from "@/lib/shop-routings";
import { TechOperationMaterialsDrawer } from "@/components/settings/tech-operation-materials-drawer";
import { ReadinessStickers } from "@/components/production/readiness-stickers";
import { diagnosticEditorTarget, readDiagnostics } from "@/lib/production/readiness-stickers";

/** PT-02 tech-operations catalog list (`DS-PT-02-CATALOG`, etalon sewing-operations). */
export function TechOperationsWorkspace({
  operations,
  productionStages,
  workCenters,
  resources: initialResources,
  materialOptions,
  initialOperationId = null,
  initialTab = "main",
}: {
  operations: TechOperation[];
  productionStages: ProductionStage[];
  workCenters: WorkCenter[];
  resources: CapacityResource[];
  materialOptions: Array<{ id: number; name: string; unit: string; is_active: boolean }>;
  initialOperationId?: number | null;
  initialTab?: OperationEditorTab;
}) {
  const router = useRouter();
  const [created, setCreated] = useState<TechOperation[]>([]);
  const [patched, setPatched] = useState<Record<number, TechOperation>>({});
  const [removedIds, setRemovedIds] = useState<Set<number>>(() => new Set());
  const [query, setQuery] = useState("");
  const [chip, setChip] = useState<CatalogChip>("all");
  const [stageId, setStageId] = useState<number | "all">("all");
  const [mode, setMode] = useState<CalculationMode | "all">("all");
  const [editingId, setEditingId] = useState<number | null>(initialOperationId);
  const [editorTab, setEditorTab] = useState<OperationEditorTab>(initialTab);
  const [focusField, setFocusField] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [materialsEditing, setMaterialsEditing] = useState<TechOperation | null>(null);
  const [resources, setResources] = useState(initialResources);
  const [seenResources, setSeenResources] = useState(initialResources);
  if (seenResources !== initialResources) {
    setSeenResources(initialResources);
    setResources(initialResources);
  }

  const rows = useMemo(() => {
    const byId = new Map<number, TechOperation>();
    for (const row of operations) byId.set(row.id, row);
    for (const row of created) byId.set(row.id, row);
    for (const row of Object.values(patched)) byId.set(row.id, row);
    return Array.from(byId.values())
      .filter((row) => !removedIds.has(row.id))
      .sort((a, b) => {
        if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
        return a.name.localeCompare(b.name, "ru");
      });
  }, [created, operations, patched, removedIds]);

  const searched = useMemo(
    () => filterTechOperations(rows, query),
    [query, rows],
  );
  const filtered = useMemo(
    () => searched.filter((row) => matchesCatalog(row, resources, chip, stageId, mode)),
    [chip, mode, resources, searched, stageId],
  );
  const editingOperation = rows.find((row) => row.id === editingId) ?? null;
  const stageChips = productionStages.filter((stage) => rows.some((row) => row.production_stage_id === stage.id));

  const clearFilters = () => {
    setQuery("");
    setChip("all");
    setStageId("all");
    setMode("all");
  };

  function openEditor(row: TechOperation, tab: OperationEditorTab, fieldId: string | null = null) {
    setEditorTab(tab);
    setFocusField(fieldId);
    setEditingId(row.id);
  }

  const onDelete = async (row: TechOperation) => {
    if (!window.confirm(`Удалить тех операцию «${row.name}»?`)) return;
    setSaving(true);
    setRowError(null);
    try {
      const result = await deleteTechOperation(row.id);
      if (!result.ok) {
        setRowError(result.message);
        setSaving(false);
        return;
      }
      setRemovedIds((prev) => new Set(prev).add(row.id));
      router.refresh();
    } catch {
      setRowError("Не удалось удалить операцию.");
    }
    setSaving(false);
  };

  const emptyDescription =
    rows.length === 0
      ? "Каталог пуст. Создайте первую операцию через кнопку «+»."
      : "Измените поисковый запрос или сбросьте фильтры.";

  const handleCreated = (operation: TechOperation) => {
    setCreated((prev) => [
      operation,
      ...prev.filter((row) => row.id !== operation.id),
    ]);
    router.refresh();
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {editingOperation ? (
        <TechOperationEditModal
          key={editingOperation.id}
          operation={editingOperation}
          productionStages={productionStages}
          workCenters={workCenters}
          resources={resources}
          operations={rows}
          materialOptions={materialOptions}
          initialTab={editorTab}
          focusField={focusField}
          onClose={() => setEditingId(null)}
          onSaved={(operation) => {
            setPatched((prev) => ({ ...prev, [operation.id]: operation }));
            setEditingId(null);
            router.refresh();
          }}
          onResourceSaved={(resource) => {
            setResources((current) => [
              ...current.filter((item) => item.key !== resource.key),
              resource,
            ]);
          }}
          onOperationKeys={(operationId, keys) => {
            const current = rows.find((row) => row.id === operationId);
            if (!current) return;
            setPatched((prev) => ({ ...prev, [operationId]: { ...current, capacity_resource_keys: keys } }));
          }}
        />
      ) : null}
      <TechOperationCreateDrawer
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={handleCreated}
        productionStages={productionStages}
        workCenters={workCenters}
        resources={resources}
        operations={rows}
        materialOptions={materialOptions}
        onResourceSaved={(resource) => {
          setResources((current) => [
            ...current.filter((item) => item.key !== resource.key),
            resource,
          ]);
        }}
      />
      <TechOperationMaterialsDrawer
        operation={materialsEditing}
        materialOptions={materialOptions}
        onClose={() => setMaterialsEditing(null)}
        onSaved={(operation) => {
          setPatched((prev) => ({ ...prev, [operation.id]: operation }));
          setMaterialsEditing(null);
          router.refresh();
        }}
      />

      <header className="border-b border-portal-border px-portal-4 py-portal-4">
        <h1 className="text-portal-title font-semibold">Технологические операции</h1>
      </header>
      <PageToolbar
        start={
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-portal-2">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Поиск по наименованию или коду"
              className="min-w-0 w-full flex-1"
              aria-label="Поиск технологических операций"
            />
            <Select aria-label="Фильтр по цеху" value={stageId === "all" ? "" : String(stageId)} onChange={(event) => setStageId(event.target.value ? Number(event.target.value) : "all")}>
              <option value="">Все цеха</option>
              {stageChips.map((stage) => <option key={stage.id} value={stage.id}>{stage.name}</option>)}
            </Select>
            <Select aria-label="Фильтр по типу мощности" value={mode} onChange={(event) => setMode(event.target.value as CalculationMode | "all")}>
              <option value="all">Все типы мощности</option>
              {(Object.keys(CALCULATION_MODE_LABEL) as CalculationMode[]).map((item) => <option key={item} value={item}>{CALCULATION_MODE_LABEL[item]}</option>)}
            </Select>
          </div>
        }
        end={
          <div className="flex flex-wrap items-center gap-1">
            <Button type="button" variant="primary" size="compact" onClick={() => setCreateOpen(true)}>+ Добавить операцию</Button>
            <IconButton label="Сбросить фильтры" variant="secondary" onClick={clearFilters}>
              <FilterX className="size-4" aria-hidden="true" />
            </IconButton>
          </div>
        }
      />
      <div className="flex flex-wrap gap-portal-2 border-b border-portal-border px-portal-4 py-portal-3">
        {([
          ["all", "Все", rows.length],
          ["needs_setup", "Требуют настройки", rows.filter((row) => operationReadiness(row, resources).status === "needs_setup").length],
          ["no_capacity", "Без мощности", rows.filter((row) => matchesCatalog(row, resources, "no_capacity", "all", "all")).length],
        ] as const).map(([id, label, count]) => (
          <button key={id} type="button" className={`rounded-portal-full px-portal-3 py-portal-1 text-portal-caption ${chip === id ? "bg-portal-primary text-portal-primary-on" : "bg-portal-surface-secondary text-portal-text"}`} onClick={() => setChip(id)}>{label} {count}</button>
        ))}
        {stageChips.map((stage) => (
          <button key={stage.id} type="button" className={`rounded-portal-full px-portal-3 py-portal-1 text-portal-caption ${stageId === stage.id ? "bg-portal-primary text-portal-primary-on" : "bg-portal-surface-secondary text-portal-text"}`} onClick={() => { setStageId(stage.id); setChip("all"); }}>{stage.name}</button>
        ))}
      </div>

      <section className="min-h-0 min-w-0 flex-1 overflow-auto bg-portal-surface">
        {rowError ? (
          <p
            className="border-b border-portal-danger/30 bg-portal-danger-soft px-portal-4 py-portal-2 text-portal-caption text-portal-danger"
            role="alert"
          >
            {rowError}
          </p>
        ) : null}

        <div className="space-y-portal-3 p-portal-4">
          {filtered.map((row) => {
            const readiness = operationReadiness(row, resources);
            const modeLabel = operationMode(row.capacity_resource_keys ?? [], resources);
            const stageName = productionStages.find((stage) => stage.id === row.production_stage_id)?.name ?? "Цех не указан";
            const centers = (row.capacity_resource_keys ?? [])
              .map((key) => resources.find((resource) => resource.key === key))
              .map((resource) => workCenters.find((center) => center.id === resource?.work_center_id)?.name)
              .filter((name): name is string => Boolean(name));
            return (
              <article key={row.id} className="rounded-portal-md border border-portal-border bg-portal-surface p-portal-4">
                <div className="flex items-start justify-between gap-portal-3">
                  <div className="min-w-0">
                    <button type="button" className="min-w-0 text-left" onClick={() => openEditor(row, "main")}>
                      <p className="font-medium text-portal-text">{row.name}</p>
                      <p className="text-portal-caption text-portal-muted">{row.code} · {stageName} · {formatTechOperationVolumeUnit(row.volume_unit)}</p>
                      <p className="mt-1 text-portal-caption text-portal-muted">{modeLabel ? CALCULATION_MODE_LABEL[modeLabel] : "Способ расчёта не задан"} · {formatOperationCapacity(row.capacity_resource_keys ?? [], resources)}</p>
                      {centers.length > 0 ? <p className="mt-1 text-portal-caption">{centers.join(" · ")}</p> : null}
                    </button>
                    <div className="mt-portal-2">
                      <ReadinessStickers
                        diagnostics={readDiagnostics(row.diagnostics)}
                        onSelect={(item) => {
                          const target = diagnosticEditorTarget(item);
                          openEditor(row, target.tab, target.fieldId);
                        }}
                      />
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
                    <StatusBadge size="compact" tone={readiness.status === "ready" ? "success" : readiness.status === "no_capacity" ? "neutral" : "warning"}>{readiness.label}</StatusBadge>
                    <IconButton label="Редактировать" disabled={saving} onClick={() => openEditor(row, "main")}><Pencil className="size-4" aria-hidden="true" /></IconButton>
                    <IconButton label="Мощность" disabled={saving} onClick={() => openEditor(row, "capacity")}><Gauge className="size-4" aria-hidden="true" /></IconButton>
                    <IconButton label="Ресурсы" disabled={saving} onClick={() => openEditor(row, "equipment")}><Boxes className="size-4" aria-hidden="true" /></IconButton>
                    <IconButton label="Материалы" disabled={saving} onClick={() => setMaterialsEditing(row)}><Package className="size-4" aria-hidden="true" /></IconButton>
                    <IconButton label="Удалить" variant="danger" disabled={saving} onClick={() => void onDelete(row)}><Trash2 className="size-4" aria-hidden="true" /></IconButton>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        {filtered.length === 0 ? (
          <EmptyState title="Операции не найдены" description={emptyDescription} />
        ) : null}
      </section>
      <ListTotals primary={`Всего: ${filtered.length} операций`} />
    </div>
  );
}
