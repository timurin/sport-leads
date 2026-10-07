"use client";

import { FilterX, Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import {
  deleteTechOperation,
} from "@/app/(workspace)/settings/catalogs/tech-operations/tech-operation-actions";
import { TechOperationEditModal } from "@/components/settings/tech-operation-edit-modal";
import { TechOperationCreateDrawer } from "@/components/settings/tech-operation-create-drawer";
import { IconButton } from "@/components/ui/button";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableFrame,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
} from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/form-controls";
import { ListTotals } from "@/components/ui/list-pagination";
import { PageToolbar } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  formatOperationCapacity,
  type CapacityResource,
} from "@/lib/tech-operation-capacity";
import {
  filterTechOperations,
  formatTechOperationVolumeUnit,
  type TechOperation,
} from "@/lib/tech-operations";
import type { ProductionStage } from "@/lib/production-stages";
import type { WorkCenter } from "@/lib/shop-routings";
import { TechOperationMaterialsDrawer } from "@/components/settings/tech-operation-materials-drawer";

/** PT-02 tech-operations catalog list (`DS-PT-02-CATALOG`, etalon sewing-operations). */
export function TechOperationsWorkspace({
  operations,
  productionStages,
  workCenters,
  resources: initialResources,
  materialOptions,
}: {
  operations: TechOperation[];
  productionStages: ProductionStage[];
  workCenters: WorkCenter[];
  resources: CapacityResource[];
  materialOptions: Array<{ id: number; name: string; unit: string; is_active: boolean }>;
}) {
  const router = useRouter();
  const [created, setCreated] = useState<TechOperation[]>([]);
  const [patched, setPatched] = useState<Record<number, TechOperation>>({});
  const [removedIds, setRemovedIds] = useState<Set<number>>(() => new Set());
  const [query, setQuery] = useState("");
  const [editingOperation, setEditingOperation] = useState<TechOperation | null>(null);
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

  const filtered = useMemo(
    () => filterTechOperations(rows, query),
    [query, rows],
  );

  const clearFilters = () => setQuery("");

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
          onClose={() => setEditingOperation(null)}
          onSaved={(operation) => {
            setPatched((prev) => ({ ...prev, [operation.id]: operation }));
            setEditingOperation(null);
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

      <PageToolbar
        start={
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Поиск по наименованию или коду"
            className="min-w-0 w-full flex-1"
            aria-label="Поиск технологических операций"
          />
        }
        end={
          <div className="flex flex-wrap items-center gap-1">
            <IconButton
              label="Создать операцию"
              variant="primary"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="size-4" aria-hidden="true" />
            </IconButton>
            <IconButton
              label="Сбросить фильтры"
              variant="secondary"
              onClick={clearFilters}
            >
              <FilterX className="size-4" aria-hidden="true" />
            </IconButton>
          </div>
        }
      />

      <section className="min-h-0 min-w-0 flex-1 overflow-auto bg-portal-surface">
        {rowError ? (
          <p
            className="border-b border-portal-danger/30 bg-portal-danger-soft px-portal-4 py-portal-2 text-portal-caption text-portal-danger"
            role="alert"
          >
            {rowError}
          </p>
        ) : null}

        <div className="hidden min-w-0 md:block">
          <DataTableFrame className="rounded-none border-x-0 border-b-0 shadow-none">
            <DataTable minWidthClassName="min-w-[1040px]">
              <DataTableHead>
                <tr>
                  <DataTableHeaderCell>Наименование</DataTableHeaderCell>
                  <DataTableHeaderCell className="w-36">Код</DataTableHeaderCell>
                  <DataTableHeaderCell className="w-28">
                    Ед. объёма
                  </DataTableHeaderCell>
                  <DataTableHeaderCell>Необходимые материалы</DataTableHeaderCell>
                  <DataTableHeaderCell className="w-44">Цех</DataTableHeaderCell>
                  <DataTableHeaderCell className="w-40">Мощность</DataTableHeaderCell>
                  <DataTableHeaderCell className="w-28">Статус</DataTableHeaderCell>
                  <DataTableHeaderCell className="w-28">
                    Действия
                  </DataTableHeaderCell>
                </tr>
              </DataTableHead>
              <DataTableBody>
                {filtered.map((row) => {
                  return (
                    <DataTableRow key={row.id}>
                      <DataTableCell>
                        <span className="font-medium text-portal-text">
                            {row.name}
                          </span>
                      </DataTableCell>
                      <DataTableCell>
                        <span className="font-mono text-portal-caption text-portal-muted">
                            {row.code}
                          </span>
                      </DataTableCell>
                      <DataTableCell>
                        {(
                          formatTechOperationVolumeUnit(row.volume_unit)
                        )}
                      </DataTableCell>
                      <DataTableCell>
                        {row.required_materials.length > 0 ? (
                          <div className="space-y-1 text-portal-caption">
                            {row.required_materials.map((item) => (
                              <div key={item.id ?? item.nomenclature_id}>
                                {item.nomenclature_name ?? `#${item.nomenclature_id}`} —{" "}
                                {item.quantity} {item.unit ?? ""}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-portal-muted">—</span>
                        )}
                      </DataTableCell>
                      <DataTableCell>
                        {(
                          productionStages.find(
                            (stage) => stage.id === row.production_stage_id,
                          )?.name ?? "—"
                        )}
                      </DataTableCell>
                      <DataTableCell>{formatOperationCapacity(row.capacity_resource_keys ?? [], resources)}</DataTableCell>
                      <DataTableCell>
                        <StatusBadge
                            size="compact"
                            tone={row.is_active ? "success" : "neutral"}
                          >
                            {row.is_active ? "Активна" : "Отключена"}
                          </StatusBadge>
                      </DataTableCell>
                      <DataTableCell>
                        <div className="flex items-center gap-1">
                          <>
                              <IconButton
                                label="Редактировать"
                                disabled={saving}
                                onClick={() => setEditingOperation(row)}
                              >
                                <Pencil className="size-4" aria-hidden="true" />
                              </IconButton>
                              <IconButton
                                label="Материалы"
                                disabled={saving}
                                onClick={() => setMaterialsEditing(row)}
                              >
                                <Plus className="size-4" aria-hidden="true" />
                              </IconButton>
                              <IconButton
                                label="Удалить"
                                disabled={saving}
                                onClick={() => void onDelete(row)}
                              >
                                <Trash2 className="size-4" aria-hidden="true" />
                              </IconButton>
                            </>
                        </div>
                      </DataTableCell>
                    </DataTableRow>
                  );
                })}
              </DataTableBody>
            </DataTable>
          </DataTableFrame>
        </div>

        <div className="space-y-portal-3 p-portal-4 md:hidden">
          {filtered.map((row) => {
            return (
              <article
                key={row.id}
                className="rounded-portal-md border border-portal-border bg-portal-surface p-portal-4"
              >
                <div className="flex items-start justify-between gap-portal-3">
                    <div>
                      <p className="font-medium text-portal-text">{row.name}</p>
                      <p className="text-portal-caption text-portal-muted">
                        {row.code} · {formatTechOperationVolumeUnit(row.volume_unit)} ·{" "}
                        {productionStages.find(
                          (stage) => stage.id === row.production_stage_id,
                        )?.name ?? "Цех не указан"}
                      </p>
                      <p className="mt-1 text-portal-caption text-portal-muted">{formatOperationCapacity(row.capacity_resource_keys ?? [], resources)}</p>
                      {row.required_materials.length > 0 ? (
                        <p className="mt-1 text-portal-caption text-portal-muted">
                          {row.required_materials
                            .map(
                              (item) =>
                                `${item.nomenclature_name ?? `#${item.nomenclature_id}`} — ${item.quantity} ${item.unit ?? ""}`,
                            )
                            .join("; ")}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex gap-1">
                      <IconButton
                        label="Редактировать"
                        disabled={saving}
                        onClick={() => setEditingOperation(row)}
                      >
                        <Pencil className="size-4" aria-hidden="true" />
                      </IconButton>
                      <IconButton
                        label="Материалы"
                        disabled={saving}
                        onClick={() => setMaterialsEditing(row)}
                      >
                        <Plus className="size-4" aria-hidden="true" />
                      </IconButton>
                      <IconButton
                        label="Удалить"
                        disabled={saving}
                        onClick={() => void onDelete(row)}
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                      </IconButton>
                    </div>
                  </div>
              </article>
            );
          })}
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            title="Операции не найдены"
            description={emptyDescription}
          />
        ) : null}
      </section>


      <ListTotals primary={`Всего: ${filtered.length} операций`} />
    </div>
  );
}
