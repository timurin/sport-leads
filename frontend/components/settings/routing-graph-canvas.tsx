"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowRightLeft, ChevronDown, ChevronUp, Expand, GripVertical, Minus, Plus, Settings2, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore, type HTMLAttributes, type ReactNode } from "react";

import { RoutingOperationDialog } from "@/components/settings/routing-operation-dialog";
import { RoutingVariantDialog, type VariantMemberDraft } from "@/components/settings/routing-variant-dialog";
import { TechOperationEditModal } from "@/components/settings/tech-operation-edit-modal";
import { ActionMenu, ActionMenuItem } from "@/components/ui/action-menu";
import { Button, IconButton } from "@/components/ui/button";
import { presentRouteReadiness, type RouteNodeReadiness } from "@/lib/route-readiness";
import { calculationModeLabel, operationReadiness } from "@/lib/tech-operation-ux";
import type { CapacityResource } from "@/lib/tech-operation-capacity";
import type { ProductionStage } from "@/lib/production-stages";
import type { TechOperation } from "@/lib/tech-operations";
import type { WorkCenter } from "@/lib/shop-routings";
import {
  addOperation,
  addParallelOperation,
  addVariantGroup,
  addWorkshop,
  assignOperation,
  calendarPreview,
  deleteVariantGroup,
  effectiveEdges,
  insertOperationBetween,
  kanbanPreview,
  moveGroupBefore,
  moveNode,
  removeEdge,
  removeNode,
  removeVariantMember,
  removeVisit,
  reorderVariantMember,
  reorderVisits,
  replaceVariantMembers,
  shiftGroup,
  updateVariantGroup,
  variantGroupStatus,
  visitDisplayBlocks,
  type RoutingEditorDraft,
  type RoutingEditorNode,
  type RoutingGraphIssue,
  type VisitDisplayBlock,
} from "@/lib/routing-graph-editor";

type RoutingGraphCanvasProps = {
  draft: RoutingEditorDraft;
  onChange: (draft: RoutingEditorDraft) => void;
  productionStages: ProductionStage[];
  techOperations: TechOperation[];
  workCenters: WorkCenter[];
  resources: CapacityResource[];
  materialOptions?: Array<{ id: number; name: string; unit: string; is_active: boolean }>;
  issues: RoutingGraphIssue[];
  nodeReadiness?: RouteNodeReadiness[];
  diagnosticFocus?: { operationId: number; fieldId: string; tab: "main" | "capacity" | "equipment" | "schedule" | "exceptions"; token: number } | null;
  focusRequest?: { key: string; token: number } | null;
  disabled?: boolean;
};

function blockAnchor(draft: RoutingEditorDraft, block: VisitDisplayBlock): string | null {
  if (block.kind === "node") return block.nodeKey;
  if (block.kind === "parallel") return block.nodeKeys[0] ?? null;
  return draft.variantGroups.find((group) => group.id === block.groupId)?.memberKeys.at(-1) ?? null;
}

function blockSortableIds(draft: RoutingEditorDraft, visitKey: string): string[] {
  return visitDisplayBlocks(draft, visitKey).flatMap((block) => {
    if (block.kind === "variant") return [`group:${block.groupId}`];
    if (block.kind === "node") return [`node:${block.nodeKey}`];
    return block.nodeKeys.map((key) => `node:${key}`);
  });
}

type AddIntent = {
  title: string;
  workshopId: number;
  visitKey: string;
  placement: "end" | "after" | "parallel" | "assign";
  beforeKey?: string;
  afterKey?: string | null;
  nodeKey?: string;
  creating?: boolean;
};

function readinessOf(
  operation: TechOperation | undefined,
  resources: CapacityResource[],
  demand: RouteNodeReadiness | null = null,
) {
  if (!operation) return { status: "missing" as const, label: "Операция не выбрана", issues: [] as string[] };
  const presented = presentRouteReadiness(operationReadiness(operation, resources), demand);
  return { status: presented.status === "ready" ? "ready" as const : "warning" as const, label: presented.label, issues: presented.issues };
}

export function RoutingGraphCanvas({
  draft,
  onChange,
  productionStages,
  techOperations,
  workCenters,
  resources,
  materialOptions = [],
  issues,
  nodeReadiness = [],
  diagnosticFocus = null,
  focusRequest = null,
  disabled = false,
}: RoutingGraphCanvasProps) {
  const [workshopQuery, setWorkshopQuery] = useState("");
  const [operationQuery, setOperationQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [seenFocus, setSeenFocus] = useState(0);
  const [seenDiagnostic, setSeenDiagnostic] = useState(0);
  const [editorField, setEditorField] = useState<string | null>(null);
  const [editorTab, setEditorTab] = useState<"main" | "capacity" | "equipment" | "schedule" | "exceptions">("main");
  if (focusRequest && focusRequest.token !== seenFocus) {
    setSeenFocus(focusRequest.token);
    setSelected(focusRequest.key);
  }
  const demandByOperation = useMemo(() => {
    const map = new Map<number, RouteNodeReadiness>();
    for (const row of nodeReadiness) {
      const current = map.get(row.operation_id);
      if (!current || (row.status === "blocked" && current.status !== "blocked")) map.set(row.operation_id, row);
    }
    return map;
  }, [nodeReadiness]);
  const [zoom, setZoom] = useState(1);
  const dndReady = useSyncExternalStore(() => () => {}, () => true, () => false);
  const [extraOperations, setExtraOperations] = useState<TechOperation[]>([]);
  const [addIntent, setAddIntent] = useState<AddIntent | null>(null);
  const [groupIntent, setGroupIntent] = useState<{ visitKey: string; groupId: string | null } | null>(null);
  const [moveKey, setMoveKey] = useState<string | null>(null);
  const [moveGroupId, setMoveGroupId] = useState<string | null>(null);
  const [editingOperationId, setEditingOperationId] = useState<number | null>(null);
  if (diagnosticFocus && diagnosticFocus.token !== seenDiagnostic) {
    setSeenDiagnostic(diagnosticFocus.token);
    setEditingOperationId(diagnosticFocus.operationId);
    setEditorField(diagnosticFocus.fieldId);
    setEditorTab(diagnosticFocus.tab);
    const node = draft.nodes.find((item) => item.operationId === diagnosticFocus.operationId);
    if (node) setSelected(node.key);
  }
  const [operationPatches, setOperationPatches] = useState<TechOperation[]>([]);
  const [resourceOverrides, setResourceOverrides] = useState<CapacityResource[]>([]);
  const router = useRouter();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const catalog = useMemo(() => {
    const byId = new Map<number, TechOperation>();
    for (const operation of techOperations) byId.set(operation.id, operation);
    for (const operation of extraOperations) byId.set(operation.id, operation);
    for (const operation of operationPatches) byId.set(operation.id, operation);
    return [...byId.values()];
  }, [techOperations, extraOperations, operationPatches]);
  const shownResources = useMemo(() => {
    if (resourceOverrides.length === 0) return resources;
    const byKey = new Map(resources.map((resource) => [resource.key, resource]));
    for (const resource of resourceOverrides) byKey.set(resource.key, resource);
    return [...byKey.values()];
  }, [resources, resourceOverrides]);
  const workshopNeedle = workshopQuery.trim().toLocaleLowerCase("ru");
  const operationNeedle = operationQuery.trim().toLocaleLowerCase("ru");
  const stages = productionStages.filter((stage) => !workshopNeedle || stage.name.toLocaleLowerCase("ru").includes(workshopNeedle));
  const catalogOperations = catalog.filter((operation) => !operationNeedle || `${operation.name} ${operation.code}`.toLocaleLowerCase("ru").includes(operationNeedle));
  const names = useMemo(() => new Map(productionStages.map((stage) => [stage.id, stage.name])), [productionStages]);
  const operationById = useMemo(() => new Map(catalog.map((operation) => [operation.id, operation])), [catalog]);
  const usedWorkshops = useMemo(() => new Set(draft.visits.map((visit) => visit.workshopId)), [draft.visits]);
  const selectedNode = draft.nodes.find((node) => node.key === selected) ?? null;
  const editingOperation = editingOperationId == null ? null : operationById.get(editingOperationId) ?? null;
  const selectedVisit = draft.visits.find((visit) => visit.key === selected) ?? null;
  const edges = effectiveEdges(draft);
  const issuesFor = (nodeKey: string) => issues.filter((issue) => issue.nodeKey === nodeKey);

  useEffect(() => {
    if (!focusRequest?.key) return;
    const target = document.getElementById(`routing-block-${focusRequest.key}`) ?? document.getElementById(focusRequest.key);
    target?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [focusRequest]);
  useEffect(() => {
    if (!diagnosticFocus) return;
    const node = draft.nodes.find((item) => item.operationId === diagnosticFocus.operationId);
    if (!node) return;
    document.getElementById(`routing-block-${node.key}`)?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [diagnosticFocus, draft.nodes]);

  function onDragEnd(event: DragEndEvent) {
    const active = event.active.data.current as { type?: string; visitKey?: string; nodeKey?: string; groupId?: string } | undefined;
    const over = event.over?.data.current as { type?: string; visitKey?: string; nodeKey?: string; groupId?: string } | undefined;
    if (!active || !over || disabled) return;
    if (active.type === "visit" && over.type === "visit" && active.visitKey && over.visitKey) {
      onChange(reorderVisits(draft, active.visitKey, over.visitKey));
      return;
    }
    if (active.type === "group" && active.groupId && over.visitKey && active.groupId !== over.groupId) {
      const overGroup = over.groupId ? draft.variantGroups.find((group) => group.id === over.groupId) : null;
      onChange(moveGroupBefore(draft, active.groupId, over.visitKey, over.nodeKey ?? overGroup?.memberKeys[0] ?? null));
      return;
    }
    if (active.type !== "node" || !active.nodeKey || !over.visitKey) return;
    const visit = draft.visits.find((item) => item.key === over.visitKey);
    if (!visit) return;
    const overGroup = over.groupId ? draft.variantGroups.find((group) => group.id === over.groupId) : null;
    const index = overGroup ? visit.nodeKeys.indexOf(overGroup.memberKeys[0] ?? "") : over.nodeKey ? visit.nodeKeys.indexOf(over.nodeKey) : visit.nodeKeys.length;
    onChange(moveNode(draft, active.nodeKey, over.visitKey, index < 0 ? visit.nodeKeys.length : index));
  }

  function confirmRemoveVisit(visitKey: string, title: string, count: number) {
    if (!window.confirm(`Удалить цех «${title}» из маршрута? Будет удалено операций: ${count}. Справочник цехов не изменится.`)) return;
    onChange(removeVisit(draft, visitKey));
    setSelected(null);
  }

  function remember(operation: TechOperation) {
    setExtraOperations((current) => current.some((item) => item.id === operation.id) ? current : [...current, operation]);
  }

  function acceptOperation(operation: TechOperation) {
    if (!addIntent) return;
    remember(operation);
    const stageId = operation.production_stage_id && operation.production_stage_id > 0 ? operation.production_stage_id : addIntent.workshopId;
    if (stageId !== addIntent.workshopId) {
      let next = draft;
      let visit = next.visits.find((item) => item.workshopId === stageId);
      if (!visit) {
        next = addWorkshop(next, stageId);
        visit = next.visits.at(-1);
      }
      if (!visit) return;
      onChange(addOperation(next, visit.key, operation.id, stageId));
    } else if (addIntent.placement === "after" && addIntent.beforeKey) {
      onChange(insertOperationBetween(draft, addIntent.beforeKey, addIntent.afterKey ?? null, operation.id));
    } else if (addIntent.placement === "parallel" && addIntent.nodeKey) {
      onChange(addParallelOperation(draft, addIntent.nodeKey, operation.id));
    } else if (addIntent.placement === "assign" && addIntent.nodeKey) {
      onChange(assignOperation(draft, addIntent.nodeKey, operation.id));
    } else {
      onChange(addOperation(draft, addIntent.visitKey, operation.id, stageId));
    }
    setAddIntent(null);
    setSelected(null);
  }

  function saveGroup(value: { name: string; code: string; members: VariantMemberDraft[]; defaultKey: string | null; defaultOperationId: number }) {
    if (!groupIntent) return;
    if (!groupIntent.groupId) {
      onChange(addVariantGroup(draft, groupIntent.visitKey, {
        name: value.name,
        code: value.code || null,
        operationIds: value.members.map((member) => member.operationId),
        defaultOperationId: value.defaultOperationId,
      }));
    } else {
      const named = updateVariantGroup(draft, groupIntent.groupId, { name: value.name, code: value.code || null });
      onChange(replaceVariantMembers(named, groupIntent.groupId, value.members, value.defaultOperationId, value.defaultKey));
    }
    setGroupIntent(null);
  }

  function moveToWorkshop(nodeKey: string, workshopId: number) {
    let next = draft;
    let visit = next.visits.find((item) => item.workshopId === workshopId);
    if (!visit) {
      next = addWorkshop(next, workshopId);
      visit = next.visits.at(-1);
    }
    if (!visit) return;
    onChange(moveNode(next, nodeKey, visit.key, visit.nodeKeys.length));
    setMoveKey(null);
  }

  function moveGroupToWorkshop(groupId: string, workshopId: number) {
    let next = draft;
    let visit = next.visits.find((item) => item.workshopId === workshopId);
    if (!visit) {
      next = addWorkshop(next, workshopId);
      visit = next.visits.at(-1);
    }
    if (!visit) return;
    onChange(moveGroupBefore(next, groupId, visit.key, null));
    setMoveGroupId(null);
  }

  const VisitView = dndReady ? SortableVisit : VisitCard;
  const NodeView = dndReady ? SortableNode : NodeCard;
  const GroupView = dndReady ? SortableGroup : GroupCard;

  function nodeCard(nodeKey: string, visitKey: string, branch: boolean) {
    const visit = draft.visits.find((item) => item.key === visitKey);
    const node = draft.nodes.find((item) => item.key === nodeKey);
    if (!visit || !node) return null;
    const operation = node.operationId == null ? undefined : operationById.get(node.operationId);
    const readiness = readinessOf(operation, shownResources, node.operationId == null ? null : demandByOperation.get(node.operationId) ?? null);
    const nodeIssues = issuesFor(nodeKey);
    const index = visit.nodeKeys.indexOf(nodeKey);
    return (
      <NodeView
        key={nodeKey}
        node={node}
        visitKey={visit.key}
        title={operation?.name ?? "Операция не выбрана"}
        code={operation?.code ?? ""}
        readiness={readiness.label}
        readinessStatus={nodeIssues.length || !operation ? "error" : readiness.status}
        branch={branch}
        issues={[...nodeIssues.map((issue) => issue.message), ...readiness.issues]}
        selected={selected === nodeKey}
        disabled={disabled}
        canUp={index > 0}
        canDown={index >= 0 && index < visit.nodeKeys.length - 1}
        onEdit={operation ? () => setEditingOperationId(operation.id) : undefined}
        onSelect={() => setSelected(nodeKey)}
        onChoose={() => setAddIntent({
          title: `Добавить операцию в «${names.get(visit.workshopId) ?? "Цех"}»`,
          workshopId: visit.workshopId,
          visitKey: visit.key,
          placement: "assign",
          nodeKey,
        })}
        onMove={() => setMoveKey(nodeKey)}
        onUp={() => {
          const index = visit.nodeKeys.indexOf(nodeKey);
          if (index <= 0) return;
          onChange(moveNode(draft, nodeKey, visit.key, index - 1));
        }}
        onDown={() => {
          const index = visit.nodeKeys.indexOf(nodeKey);
          if (index < 0 || index >= visit.nodeKeys.length - 1) return;
          onChange(moveNode(draft, nodeKey, visit.key, index + 1));
        }}
        onRemove={() => {
          onChange(removeNode(draft, nodeKey));
          setSelected(null);
        }}
      />
    );
  }
  const kanban = kanbanPreview(draft, (id) => names.get(id) ?? "Цех");
  const calendar = calendarPreview(draft, (id) => (id == null ? "Операция не выбрана" : operationById.get(id)?.name ?? "Операция"));
  const moveNodeRow = moveKey ? draft.nodes.find((node) => node.key === moveKey) : null;

  return (
    <div className="grid gap-portal-4" onKeyDown={(event) => { if (event.key === "Escape") setSelected(null); }}>
      <div className="grid gap-portal-4 min-[1024px]:grid-cols-[220px_minmax(0,1fr)_260px]">
        <aside className="rounded-portal-md border border-portal-border bg-portal-surface p-portal-3" aria-label="Справочники маршрута">
          <section>
            <h2 className="text-portal-caption font-semibold uppercase text-portal-muted">Цеха</h2>
            <label className="sr-only" htmlFor="routing-workshop-search">Поиск цеха</label>
            <input id="routing-workshop-search" value={workshopQuery} onChange={(event) => setWorkshopQuery(event.target.value)} placeholder="Поиск цеха" className="mt-portal-2 w-full rounded-portal-md border border-portal-border px-portal-2 py-1 text-portal-caption" />
            <ul className="mt-portal-2 max-h-36 space-y-0.5 overflow-auto">
              {stages.map((stage) => {
                const used = usedWorkshops.has(stage.id);
                return (
                  <li key={stage.id}>
                    <button
                      type="button"
                      disabled={disabled}
                      className={`flex w-full items-center justify-between gap-2 rounded-portal-md px-portal-2 py-1 text-left text-portal-caption hover:bg-portal-state-hover ${used ? "bg-portal-primary-soft text-portal-text" : ""}`}
                      onClick={() => {
                        const visit = draft.visits.find((item) => item.workshopId === stage.id);
                        if (visit) setSelected(visit.key);
                        else onChange(addWorkshop(draft, stage.id));
                      }}
                    >
                      <span className="truncate">{stage.name}</span>
                      {used ? <span className="shrink-0 text-portal-caption text-portal-primary">в маршруте</span> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
          <section className="mt-portal-4 border-t border-portal-border pt-portal-3">
            <h2 className="text-portal-caption font-semibold uppercase text-portal-muted">Технологические операции</h2>
            <label className="sr-only" htmlFor="routing-operation-search">Поиск операции</label>
            <input id="routing-operation-search" value={operationQuery} onChange={(event) => setOperationQuery(event.target.value)} placeholder="Поиск операции" className="mt-portal-2 w-full rounded-portal-md border border-portal-border px-portal-2 py-1 text-portal-caption" />
            <ul className="mt-portal-2 max-h-64 space-y-0.5 overflow-auto">
              {catalogOperations.map((operation) => {
                const readiness = readinessOf(operation, resources, demandByOperation.get(operation.id) ?? null);
                return (
                  <li key={operation.id} className="flex items-center gap-2 px-portal-2 py-1">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-portal-body">{operation.name}</span>
                      <span className="block truncate text-portal-caption text-portal-muted">{operation.code}</span>
                    </span>
                    <span className={`shrink-0 text-portal-caption ${readiness.status === "ready" ? "text-portal-success" : "text-portal-warning"}`}>{readiness.label}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        </aside>

        <section id="routing-canvas" className="min-w-0 rounded-portal-md border border-portal-border bg-portal-surface p-portal-3" aria-label="Схема маршрута">
          <div className="mb-portal-3 flex items-center gap-1">
            <IconButton label="Уменьшить" variant="secondary" disabled={disabled || zoom <= 0.6} onClick={() => setZoom((value) => Math.max(0.6, Number((value - 0.1).toFixed(2))))}><Minus className="size-4" /></IconButton>
            <IconButton label="Увеличить" variant="secondary" disabled={disabled || zoom >= 1.6} onClick={() => setZoom((value) => Math.min(1.6, Number((value + 0.1).toFixed(2))))}><Plus className="size-4" /></IconButton>
            <IconButton label="По размеру" variant="secondary" disabled={disabled} onClick={() => setZoom(1)}><Expand className="size-4" /></IconButton>
            <span className="ml-1 text-portal-caption text-portal-muted">{Math.round(zoom * 100)}%</span>
          </div>
          <div className="max-h-[70vh] overflow-auto">
            <div style={{ transform: `scale(${zoom})`, transformOrigin: "top left" }}>
              <DndRoot enabled={dndReady} sensors={sensors} onDragEnd={onDragEnd} visitIds={draft.visits.map((visit) => `visit:${visit.key}`)}>
                  <div className="space-y-portal-4 pr-portal-6">
                    {draft.visits.map((visit) => (
                      <VisitView
                        key={visit.key}
                        visitKey={visit.key}
                        title={names.get(visit.workshopId) ?? "Цех"}
                        count={visit.nodeKeys.length}
                        selected={selected === visit.key}
                        invalid={issues.some((issue) => issue.visitKey === visit.key)}
                        disabled={disabled}
                        onSelect={() => setSelected(visit.key)}
                        onRemove={() => confirmRemoveVisit(visit.key, names.get(visit.workshopId) ?? "Цех", visit.nodeKeys.length)}
                        onAdd={() => setAddIntent({
                          title: `Добавить операцию в «${names.get(visit.workshopId) ?? "Цех"}»`,
                          workshopId: visit.workshopId,
                          visitKey: visit.key,
                          placement: "end",
                        })}
                        onAddGroup={() => setGroupIntent({ visitKey: visit.key, groupId: null })}
                        onUp={() => {
                          const index = draft.visits.findIndex((item) => item.key === visit.key);
                          if (index <= 0) return;
                          onChange(reorderVisits(draft, visit.key, draft.visits[index - 1].key));
                        }}
                        onDown={() => {
                          const index = draft.visits.findIndex((item) => item.key === visit.key);
                          if (index < 0 || index >= draft.visits.length - 1) return;
                          onChange(reorderVisits(draft, visit.key, draft.visits[index + 1].key));
                        }}
                      >
                        <NodeList enabled={dndReady} ids={blockSortableIds(draft, visit.key)}>
                          {visitDisplayBlocks(draft, visit.key).map((block, rowIndex, rows) => {
                            const next = rows[rowIndex + 1];
                            const anchor = blockAnchor(draft, block);
                            const nextAnchor = next ? blockAnchor(draft, next) : null;
                            return (
                              <div key={block.kind === "variant" ? block.groupId : block.kind === "node" ? block.nodeKey : block.nodeKeys.join("-")}>
                                {block.join ? <p className="pb-1 text-center text-portal-caption text-portal-muted">Соединение</p> : null}
                                {block.kind === "variant" ? (
                                  <GroupView
                                    groupId={block.groupId}
                                    visitKey={visit.key}
                                    draft={draft}
                                    operationById={operationById}
                                    resources={shownResources}
                                    onConfigure={setEditingOperationId}
                                    demandByOperation={demandByOperation}
                                    selected={selected === block.groupId}
                                    disabled={disabled}
                                    onSelect={() => setSelected(block.groupId)}
                                    onDefault={(nodeKey) => onChange(updateVariantGroup(draft, block.groupId, { defaultNodeKey: nodeKey }))}
                                    onMemberUp={(nodeKey) => onChange(reorderVariantMember(draft, block.groupId, nodeKey, -1))}
                                    onMemberDown={(nodeKey) => onChange(reorderVariantMember(draft, block.groupId, nodeKey, 1))}
                                    onDetach={(nodeKey) => onChange(removeVariantMember(draft, block.groupId, nodeKey))}
                                    onEdit={() => setGroupIntent({ visitKey: visit.key, groupId: block.groupId })}
                                    onUp={() => onChange(shiftGroup(draft, block.groupId, -1))}
                                    onDown={() => onChange(shiftGroup(draft, block.groupId, 1))}
                                    onMove={() => setMoveGroupId(block.groupId)}
                                    onRemove={() => {
                                      const group = draft.variantGroups.find((item) => item.id === block.groupId);
                                      if (!group) return;
                                      if (!window.confirm(`Удалить группу «${group.name}»? Операции останутся в цехе, справочник операций не изменится.`)) return;
                                      onChange(deleteVariantGroup(draft, block.groupId));
                                      setSelected(null);
                                    }}
                                  />
                                ) : (
                                  <div className={block.kind === "parallel" ? "grid grid-cols-2 gap-2 rounded-portal-md border border-dashed border-portal-border p-2" : ""}>
                                    {block.kind === "parallel" ? <p className="col-span-2 text-portal-caption text-portal-muted" title="Параллельная ветка: эти операции выполняются все.">Выполняются все операции</p> : null}
                                    {(block.kind === "node" ? [block.nodeKey] : block.nodeKeys).map((nodeKey) => nodeCard(nodeKey, visit.key, block.kind === "parallel"))}
                                  </div>
                                )}
                                {next ? (
                                  <Connector
                                    disabled={disabled}
                                    onSequential={() => setAddIntent({
                                      title: `Добавить операцию в «${names.get(visit.workshopId) ?? "Цех"}»`,
                                      workshopId: visit.workshopId,
                                      visitKey: visit.key,
                                      placement: "after",
                                      beforeKey: anchor ?? undefined,
                                      afterKey: next.kind === "node" ? next.nodeKey : nextAnchor,
                                    })}
                                    onParallel={() => {
                                      const nodeKey = next.kind === "variant" ? null : next.kind === "node" ? next.nodeKey : next.nodeKeys[0];
                                      if (!nodeKey) return;
                                      setAddIntent({
                                        title: `Добавить операцию в «${names.get(visit.workshopId) ?? "Цех"}»`,
                                        workshopId: visit.workshopId,
                                        visitKey: visit.key,
                                        placement: "parallel",
                                        nodeKey,
                                      });
                                    }}
                                    allowParallel={next.kind !== "variant"}
                                    onVariant={() => setGroupIntent({ visitKey: visit.key, groupId: null })}
                                  />
                                ) : null}
                              </div>
                            );
                          })}
                        </NodeList>
                      </VisitView>
                    ))}
                  </div>
              </DndRoot>
            </div>
          </div>
          {draft.dependencyMode === "explicit" ? (
            <ul className="mt-portal-3 space-y-1 text-portal-caption">
              {edges.map((edge) => (
                <li key={`${edge.from}-${edge.to}`} className="flex items-center justify-between gap-2">
                  <span>{operationById.get(draft.nodes.find((node) => node.key === edge.from)?.operationId ?? -1)?.name ?? "Узел"} → {operationById.get(draft.nodes.find((node) => node.key === edge.to)?.operationId ?? -1)?.name ?? "Узел"}</span>
                  <button type="button" className="text-portal-danger" disabled={disabled} onClick={() => onChange(removeEdge(draft, edge.from, edge.to))}>Удалить зависимость</button>
                </li>
              ))}
            </ul>
          ) : <p className="mt-portal-3 text-portal-caption text-portal-muted">Стрелки показывают последовательный порядок по умолчанию.</p>}
        </section>

        <aside className="rounded-portal-md border border-portal-border bg-portal-surface p-portal-3" aria-label="Свойства выбранного блока">
          {selectedNode ? (
            selectedNode.operationId == null ? (
              <div className="space-y-portal-3">
                <h3 className="font-medium">Операция не выбрана</h3>
                <p className="text-portal-caption text-portal-muted">Цех: {names.get(selectedNode.workshopId) ?? "Цех"}</p>
                <Button type="button" variant="secondary" disabled={disabled} onClick={() => {
                  const visit = draft.visits.find((item) => item.nodeKeys.includes(selectedNode.key));
                  if (!visit) return;
                  setAddIntent({
                    title: `Добавить операцию в «${names.get(visit.workshopId) ?? "Цех"}»`,
                    workshopId: visit.workshopId,
                    visitKey: visit.key,
                    placement: "assign",
                    nodeKey: selectedNode.key,
                  });
                }}>Выбрать операцию</Button>
                <Button type="button" variant="secondary" disabled={disabled} onClick={() => {
                  const visit = draft.visits.find((item) => item.nodeKeys.includes(selectedNode.key));
                  if (!visit) return;
                  setAddIntent({
                    title: `Добавить операцию в «${names.get(visit.workshopId) ?? "Цех"}»`,
                    workshopId: visit.workshopId,
                    visitKey: visit.key,
                    placement: "assign",
                    nodeKey: selectedNode.key,
                    creating: true,
                  });
                }}>+ Создать новую техоперацию</Button>
              </div>
            ) : (
              <NodeInspector
                node={selectedNode}
                workshopName={names.get(selectedNode.workshopId) ?? "Цех"}
                operation={operationById.get(selectedNode.operationId)}
                resources={shownResources}
                onConfigure={() => {
                  if (selectedNode.operationId != null) setEditingOperationId(selectedNode.operationId);
                }}
                demand={selectedNode.operationId == null ? null : demandByOperation.get(selectedNode.operationId) ?? null}
                workCenters={workCenters}
                predecessors={edges.filter((edge) => edge.to === selectedNode.key)}
                successors={edges.filter((edge) => edge.from === selectedNode.key)}
                nodeName={(key) => operationById.get(draft.nodes.find((node) => node.key === key)?.operationId ?? -1)?.name ?? "Узел"}
              />
            )
          ) : selectedVisit ? (
            <div>
              <h3 className="text-portal-body font-medium">{names.get(selectedVisit.workshopId) ?? "Цех"}</h3>
              <p className="mt-portal-2 text-portal-caption text-portal-muted">{selectedVisit.nodeKeys.length} операций</p>
            </div>
          ) : <p className="text-portal-caption text-portal-muted">Выберите цех или операцию.</p>}
        </aside>
      </div>

      <div className="grid gap-portal-4 min-[1024px]:grid-cols-2">
        <section className="rounded-portal-md border border-portal-border p-portal-3">
          <h3 className="text-portal-body font-medium">Kanban</h3>
          <p className="mt-portal-2 text-portal-body">{kanban.length ? kanban.join(" → ") : "Цеха ещё не добавлены"}</p>
        </section>
        <section className="rounded-portal-md border border-portal-border p-portal-3">
          <h3 className="text-portal-body font-medium">Календарь</h3>
          <ul className="mt-portal-2 space-y-1">
            {calendar.map((row) => (
              <li key={row.key} className={row.branch ? "border-l-2 border-portal-primary pl-portal-2" : undefined}>
                {row.branch ? "Ветка: " : ""}{row.label}
                {row.options ? (
                  <ul className="mt-1 space-y-0.5 text-portal-caption text-portal-muted">
                    {row.options.map((option) => (
                      <li key={`${row.key}-${option.label}`}>{option.label}{option.isDefault ? " [по умолчанию]" : ""}</li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      </div>
      {editingOperation ? (
        <TechOperationEditModal
          key={editingOperation.id}
          operation={editingOperation}
          productionStages={productionStages}
          workCenters={workCenters}
          resources={shownResources}
          operations={catalog}
          materialOptions={materialOptions}
          initialTab={editorTab}
          focusField={editorField}
          onClose={() => setEditingOperationId(null)}
          onSaved={(operation) => {
            setOperationPatches((current) => [...current.filter((item) => item.id !== operation.id), operation]);
            setEditingOperationId(null);
            router.refresh();
          }}
          onResourceSaved={(resource) => {
            setResourceOverrides((current) => [...current.filter((item) => item.key !== resource.key), resource]);
          }}
          onOperationKeys={(operationId, keys) => {
            const current = catalog.find((item) => item.id === operationId);
            if (!current) return;
            setOperationPatches((rows) => [...rows.filter((item) => item.id !== operationId), { ...current, capacity_resource_keys: keys }]);
          }}
        />
      ) : null}
      {addIntent ? (
        <RoutingOperationDialog
          title={addIntent.title}
          workshopId={addIntent.workshopId}
          workshopName={names.get(addIntent.workshopId) ?? "Цех"}
          productionStages={productionStages}
          operations={catalog}
          resources={shownResources}
          demandByOperation={demandByOperation}
          initialCreating={addIntent.creating}
          onClose={() => setAddIntent(null)}
          onSelect={acceptOperation}
        />
      ) : null}
      {groupIntent ? (
        <RoutingVariantDialog
          title={groupIntent.groupId ? "Группа вариантов" : "Новая группа вариантов"}
          workshopId={draft.visits.find((visit) => visit.key === groupIntent.visitKey)?.workshopId ?? 0}
          workshopName={names.get(draft.visits.find((visit) => visit.key === groupIntent.visitKey)?.workshopId ?? 0) ?? "Цех"}
          productionStages={productionStages}
          operations={catalog}
          resources={shownResources}
          initialName={draft.variantGroups.find((group) => group.id === groupIntent.groupId)?.name ?? ""}
          initialCode={draft.variantGroups.find((group) => group.id === groupIntent.groupId)?.code ?? ""}
          initialMembers={(draft.variantGroups.find((group) => group.id === groupIntent.groupId)?.memberKeys ?? []).flatMap((key) => {
            const operationId = draft.nodes.find((node) => node.key === key)?.operationId;
            return operationId == null ? [] : [{ key, operationId }];
          })}
          initialDefaultKey={draft.variantGroups.find((group) => group.id === groupIntent.groupId)?.defaultNodeKey ?? null}
          canDelete={groupIntent.groupId != null}
          onClose={() => setGroupIntent(null)}
          onDelete={() => {
            if (!groupIntent.groupId) return;
            const group = draft.variantGroups.find((item) => item.id === groupIntent.groupId);
            if (!group) return;
            if (!window.confirm(`Удалить группу «${group.name}»? Операции останутся в цехе, справочник операций не изменится.`)) return;
            onChange(deleteVariantGroup(draft, groupIntent.groupId));
            setGroupIntent(null);
          }}
          onSave={saveGroup}
        />
      ) : null}
      {moveNodeRow ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-portal-4" onClick={() => setMoveKey(null)}>
          <div role="dialog" aria-modal="true" aria-label="Переместить в другой цех" className="w-full max-w-sm rounded-portal-lg border border-portal-border bg-portal-surface p-portal-4" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-portal-3">
              <h2 className="font-semibold">Переместить в другой цех</h2>
              <IconButton label="Закрыть окно" variant="secondary" onClick={() => setMoveKey(null)}>
                <X className="size-4" aria-hidden="true" />
              </IconButton>
            </div>
            <ul className="mt-portal-3 max-h-64 space-y-1 overflow-auto">
              {productionStages.filter((stage) => stage.id !== moveNodeRow.workshopId).map((stage) => (
                <li key={stage.id}>
                  <button type="button" className="w-full rounded-portal-md px-portal-2 py-1 text-left hover:bg-portal-state-hover" onClick={() => moveToWorkshop(moveNodeRow.key, stage.id)}>{stage.name}</button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
      {moveGroupId ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-portal-4" onClick={() => setMoveGroupId(null)}>
          <div role="dialog" aria-modal="true" aria-label="Переместить группу в другой цех" className="w-full max-w-sm rounded-portal-lg border border-portal-border bg-portal-surface p-portal-4" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-portal-3">
              <h2 className="font-semibold">Переместить группу в другой цех</h2>
              <IconButton label="Закрыть окно" variant="secondary" onClick={() => setMoveGroupId(null)}>
                <X className="size-4" aria-hidden="true" />
              </IconButton>
            </div>
            <p className="mt-1 text-portal-caption text-portal-muted">Все варианты группы переходят в выбранный цех. Сохранение проверит, что операции относятся к этому цеху.</p>
            <ul className="mt-portal-3 max-h-64 space-y-1 overflow-auto">
              {productionStages.filter((stage) => stage.id !== draft.variantGroups.find((group) => group.id === moveGroupId)?.workshopId).map((stage) => (
                <li key={stage.id}>
                  <button type="button" className="w-full rounded-portal-md px-portal-2 py-1 text-left hover:bg-portal-state-hover" onClick={() => moveGroupToWorkshop(moveGroupId, stage.id)}>{stage.name}</button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DndRoot({
  enabled, sensors, onDragEnd, visitIds, children,
}: {
  enabled: boolean;
  sensors: ReturnType<typeof useSensors>;
  onDragEnd: (event: DragEndEvent) => void;
  visitIds: string[];
  children: ReactNode;
}) {
  if (!enabled) return children;
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={visitIds} strategy={verticalListSortingStrategy}>{children}</SortableContext>
    </DndContext>
  );
}

function NodeList({ enabled, ids, children }: { enabled: boolean; ids: string[]; children: ReactNode }) {
  if (!enabled) return children;
  return <SortableContext items={ids} strategy={verticalListSortingStrategy}>{children}</SortableContext>;
}

function Connector({ disabled, onSequential, onParallel, onVariant, allowParallel = true }: { disabled: boolean; onSequential: () => void; onParallel: () => void; onVariant: () => void; allowParallel?: boolean }) {
  return (
    <div className="flex flex-col items-center py-1">
      <span className="h-3 w-px bg-portal-border" aria-hidden="true" />
      <details className="relative">
        <summary aria-label="Добавить операцию" className="flex size-6 cursor-pointer list-none items-center justify-center rounded-full border border-portal-border bg-portal-surface text-portal-body leading-none hover:bg-portal-state-hover [&::-webkit-details-marker]:hidden">+</summary>
        <div className="absolute left-1/2 z-20 mt-1 w-56 -translate-x-1/2 rounded-portal-md border border-portal-border bg-portal-surface p-1 shadow-portal-overlay">
          <button type="button" className="block w-full rounded-portal-md px-portal-2 py-1 text-left text-portal-caption hover:bg-portal-state-hover" disabled={disabled} onClick={onSequential}>Добавить операцию</button>
          {allowParallel ? <button type="button" className="block w-full rounded-portal-md px-portal-2 py-1 text-left text-portal-caption hover:bg-portal-state-hover" disabled={disabled} onClick={onParallel}>Параллельная ветка</button> : null}
          <button type="button" className="block w-full rounded-portal-md px-portal-2 py-1 text-left text-portal-caption hover:bg-portal-state-hover" disabled={disabled} onClick={onVariant}>Добавить группу вариантов</button>
        </div>
      </details>
      <span className="h-3 w-px bg-portal-border" aria-hidden="true" />
    </div>
  );
}

type VisitCardProps = {
  visitKey: string;
  title: string;
  count: number;
  selected: boolean;
  invalid: boolean;
  disabled: boolean;
  onSelect: () => void;
  onRemove: () => void;
  onAdd: () => void;
  onAddGroup: () => void;
  onUp: () => void;
  onDown: () => void;
  children: ReactNode;
};

function SortableVisit(props: VisitCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: `visit:${props.visitKey}`, data: { type: "visit", visitKey: props.visitKey }, disabled: props.disabled });
  return (
    <VisitCard
      {...props}
      setNodeRef={setNodeRef}
      attributes={attributes}
      listeners={listeners}
      transform={transform}
      transition={transition ?? undefined}
    />
  );
}

function VisitCard({
  visitKey, title, count, selected, invalid, disabled, onSelect, onRemove, onAdd, onAddGroup, onUp, onDown, children,
  setNodeRef, attributes, listeners, transform, transition,
}: VisitCardProps & {
  setNodeRef?: (element: HTMLElement | null) => void;
  attributes?: HTMLAttributes<HTMLButtonElement>;
  listeners?: HTMLAttributes<HTMLButtonElement>;
  transform?: { x: number; y: number; scaleX: number; scaleY: number } | null;
  transition?: string;
}) {
  return (
    <article
      id={`routing-block-${visitKey}`}
      ref={setNodeRef}
      style={setNodeRef ? { transform: CSS.Transform.toString(transform ?? null), transition } : undefined}
      className={`rounded-portal-md border bg-portal-surface-secondary p-portal-3 ${invalid ? "border-portal-danger" : selected ? "border-portal-primary" : "border-portal-border"}`}
      onClick={onSelect}
    >
      <header className="mb-portal-3 flex items-center gap-portal-2 border-b border-portal-border pb-portal-2">
        <button type="button" className="cursor-grab text-portal-muted" aria-label={`Переместить цех ${title}`} {...attributes} {...listeners}><GripVertical className="size-4" /></button>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-portal-body font-semibold uppercase">{title}</h3>
          <p className="text-portal-caption text-portal-muted">{count} операций</p>
        </div>
        <Button type="button" variant="secondary" size="compact" disabled={disabled} onClick={(event) => { event.stopPropagation(); onAdd(); }}>+ Операция</Button>
        <Button type="button" variant="secondary" size="compact" disabled={disabled} onClick={(event) => { event.stopPropagation(); onAddGroup(); }}>+ Группа вариантов</Button>
        <ActionMenu label={`Действия цеха ${title}`}>
          <ActionMenuItem onClick={(event) => { event.stopPropagation(); onUp(); }}>Выше</ActionMenuItem>
          <ActionMenuItem onClick={(event) => { event.stopPropagation(); onDown(); }}>Ниже</ActionMenuItem>
          <ActionMenuItem tone="danger" onClick={(event) => { event.stopPropagation(); onRemove(); }}>Удалить из маршрута</ActionMenuItem>
        </ActionMenu>
      </header>
      {children}
    </article>
  );
}

type NodeCardProps = {
  node: RoutingEditorNode;
  visitKey: string;
  title: string;
  code: string;
  readiness: string;
  readinessStatus: "ready" | "warning" | "error" | "missing";
  branch: boolean;
  issues: string[];
  selected: boolean;
  disabled: boolean;
  canUp: boolean;
  canDown: boolean;
  onEdit?: () => void;
  onSelect: () => void;
  onChoose: () => void;
  onMove: () => void;
  onUp: () => void;
  onDown: () => void;
  onRemove: () => void;
};

function SortableNode(props: NodeCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: `node:${props.node.key}`, data: { type: "node", visitKey: props.visitKey, nodeKey: props.node.key }, disabled: props.disabled });
  return (
    <NodeCard
      {...props}
      setNodeRef={setNodeRef}
      attributes={attributes}
      listeners={listeners}
      transform={transform}
      transition={transition ?? undefined}
    />
  );
}

function OperationIconActions({
  disabled,
  canUp = true,
  canDown = true,
  onEdit,
  onMove,
  onUp,
  onDown,
  onRemove,
  removeLabel = "Удалить из маршрута",
}: {
  disabled: boolean;
  canUp?: boolean;
  canDown?: boolean;
  onEdit?: () => void;
  onMove?: () => void;
  onUp: () => void;
  onDown: () => void;
  onRemove: () => void;
  removeLabel?: string;
}) {
  return (
    <div className="flex shrink-0 items-center" onClick={(event) => event.stopPropagation()}>
      {onEdit ? <IconButton label="Настроить операцию" disabled={disabled} onClick={onEdit}><Settings2 className="size-4" aria-hidden="true" /></IconButton> : null}
      {onMove ? <IconButton label="Переместить в другой цех" disabled={disabled} onClick={onMove}><ArrowRightLeft className="size-4" aria-hidden="true" /></IconButton> : null}
      <IconButton label="Выше" disabled={disabled || !canUp} onClick={onUp}><ChevronUp className="size-4" aria-hidden="true" /></IconButton>
      <IconButton label="Ниже" disabled={disabled || !canDown} onClick={onDown}><ChevronDown className="size-4" aria-hidden="true" /></IconButton>
      <IconButton label={removeLabel} variant="danger" disabled={disabled} onClick={onRemove}><Trash2 className="size-4" aria-hidden="true" /></IconButton>
    </div>
  );
}

function NodeCard({
  node, title, code, readiness, readinessStatus, branch, issues, selected, disabled, canUp, canDown, onEdit, onSelect, onChoose, onMove, onUp, onDown, onRemove,
  setNodeRef, attributes, listeners, transform, transition,
}: NodeCardProps & {
  setNodeRef?: (element: HTMLElement | null) => void;
  attributes?: HTMLAttributes<HTMLButtonElement>;
  listeners?: HTMLAttributes<HTMLButtonElement>;
  transform?: { x: number; y: number; scaleX: number; scaleY: number } | null;
  transition?: string;
}) {
  const tone = readinessStatus === "error" || readinessStatus === "missing"
    ? "border-portal-danger"
    : readinessStatus === "warning"
      ? "border-portal-warning"
      : selected
        ? "border-portal-primary"
        : "border-portal-border";
  const readinessClass = readinessStatus === "ready" ? "text-portal-success" : readinessStatus === "warning" ? "text-portal-warning" : "text-portal-danger";
  return (
    <div
      id={`routing-block-${node.key}`}
      ref={setNodeRef}
      style={setNodeRef ? { transform: CSS.Transform.toString(transform ?? null), transition } : undefined}
      className={`rounded-portal-md border bg-portal-surface px-portal-2 py-1.5 ${tone}`}
      onClick={(event) => { event.stopPropagation(); onSelect(); }}
    >
      <div className="flex items-center gap-portal-2">
        <button type="button" className="cursor-grab text-portal-muted" aria-label={`Переместить операцию ${title}`} {...attributes} {...listeners}><GripVertical className="size-4" /></button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-portal-caption font-medium">{title}</p>
          {code ? <p className="truncate text-portal-caption text-portal-muted">{code}</p> : null}
          {node.operationId == null ? (
            <button type="button" className="text-portal-caption text-portal-primary hover:underline" onClick={(event) => { event.stopPropagation(); onChoose(); }}>Выбрать операцию</button>
          ) : (
            <p className={`text-portal-caption ${readinessClass}`} title={issues.join(", ")}>{readiness}{branch ? " · ветка" : ""}</p>
          )}
        </div>
        <OperationIconActions
          disabled={disabled}
          canUp={canUp}
          canDown={canDown}
          onEdit={onEdit}
          onMove={onMove}
          onUp={onUp}
          onDown={onDown}
          onRemove={onRemove}
        />
      </div>
    </div>
  );
}

function NodeInspector({
  node, workshopName, operation, resources, demand, workCenters, predecessors, successors, nodeName, onConfigure,
}: {
  node: RoutingEditorNode;
  workshopName: string;
  operation: TechOperation | undefined;
  resources: CapacityResource[];
  demand: RouteNodeReadiness | null;
  workCenters: WorkCenter[];
  predecessors: { from: string }[];
  successors: { to: string }[];
  nodeName: (key: string) => string;
  onConfigure?: () => void;
}) {
  const readiness = readinessOf(operation, resources, demand);
  const linked = (operation?.capacity_resource_keys ?? []).map((key) => resources.find((resource) => resource.key === key)).filter((resource) => resource != null);
  const centers = linked.map((resource) => workCenters.find((center) => center.id === resource.work_center_id)?.name).filter((name): name is string => Boolean(name));
  if (node.workCenterId != null) {
    const own = workCenters.find((center) => center.id === node.workCenterId)?.name;
    if (own) centers.push(own);
  }
  const mode = linked[0]?.calculation_mode;
  const readinessClass = readiness.status === "ready" ? "text-portal-success" : readiness.status === "warning" ? "text-portal-warning" : "text-portal-danger";
  return (
    <div className="space-y-portal-2 text-portal-body">
      <h3 className="font-medium">{operation?.name ?? "Операция не выбрана"}</h3>
      <p>Цех: {workshopName}</p>
      <p>Расчёт: {mode ? calculationModeLabel(mode) : "не задан"}</p>
      <p>Ресурс: {linked.map((resource) => resource.name).join(", ") || "не выбран"}</p>
      <p>Оборудование: {[...new Set(centers)].join(", ") || "не указано"}</p>
      <p className={readinessClass} title={readiness.issues.join(", ")}>Готовность: {readiness.label}</p>
      <p>До: {predecessors.map((edge) => nodeName(edge.from)).join(", ") || "нет"}</p>
      <p>После: {successors.map((edge) => nodeName(edge.to)).join(", ") || "нет"}</p>
      {operation && onConfigure ? <button type="button" className="text-portal-primary hover:underline" onClick={onConfigure}>Настроить операцию</button> : null}
    </div>
  );
}

type GroupCardProps = {
  groupId: string;
  visitKey: string;
  draft: RoutingEditorDraft;
  operationById: Map<number, TechOperation>;
  resources: CapacityResource[];
  demandByOperation: Map<number, RouteNodeReadiness>;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
  onDefault: (nodeKey: string) => void;
  onMemberUp: (nodeKey: string) => void;
  onMemberDown: (nodeKey: string) => void;
  onDetach: (nodeKey: string) => void;
  onEdit: () => void;
  onConfigure: (operationId: number) => void;
  onUp: () => void;
  onDown: () => void;
  onMove: () => void;
  onRemove: () => void;
};

function SortableGroup(props: GroupCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: `group:${props.groupId}`,
    data: { type: "group", visitKey: props.visitKey, groupId: props.groupId },
    disabled: props.disabled,
  });
  return (
    <GroupCard
      {...props}
      setNodeRef={setNodeRef}
      attributes={attributes}
      listeners={listeners}
      transform={transform}
      transition={transition ?? undefined}
    />
  );
}

function GroupCard({
  groupId, draft, operationById, resources, demandByOperation, selected, disabled, onSelect, onDefault, onMemberUp, onMemberDown, onDetach, onEdit, onConfigure, onUp, onDown, onMove, onRemove,
  setNodeRef, attributes, listeners, transform, transition,
}: GroupCardProps & {
  setNodeRef?: (element: HTMLElement | null) => void;
  attributes?: HTMLAttributes<HTMLButtonElement>;
  listeners?: HTMLAttributes<HTMLButtonElement>;
  transform?: { x: number; y: number; scaleX: number; scaleY: number } | null;
  transition?: string;
}) {
  const group = draft.variantGroups.find((item) => item.id === groupId);
  if (!group) return null;
  const status = variantGroupStatus(group, draft.nodes, (operationId) => {
    const operation = operationId == null ? undefined : operationById.get(operationId);
    return readinessOf(operation, resources, operationId == null ? null : demandByOperation.get(operationId) ?? null).status === "ready";
  });
  return (
    <div
      id={`routing-block-${groupId}`}
      ref={setNodeRef}
      style={setNodeRef ? { transform: CSS.Transform.toString(transform ?? null), transition } : undefined}
      className={`rounded-portal-md border bg-portal-surface p-portal-2 ${selected ? "border-portal-primary" : "border-portal-border"}`}
      onClick={(event) => { event.stopPropagation(); onSelect(); }}
    >
      <div className="flex items-start gap-portal-2">
        <button type="button" className="cursor-grab text-portal-muted" aria-label={`Переместить группу ${group.name}`} {...attributes} {...listeners}><GripVertical className="size-4" /></button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-portal-caption font-medium">{group.name}</p>
          <p className="text-portal-caption text-portal-muted" title="Из группы выполняется только выбранный вариант.">Выполняется один вариант</p>
          <p className={status === "ready" ? "text-portal-caption text-portal-success" : "text-portal-caption text-portal-warning"}>{status === "ready" ? "Готово" : "Требует настройки"}</p>
        </div>
        <ActionMenu label={`Действия группы ${group.name}`}>
          <ActionMenuItem disabled={disabled} onClick={(event) => { event.stopPropagation(); onEdit(); }}>Изменить</ActionMenuItem>
          <ActionMenuItem disabled={disabled} onClick={(event) => { event.stopPropagation(); onMove(); }}>Переместить в другой цех</ActionMenuItem>
          <ActionMenuItem disabled={disabled} onClick={(event) => { event.stopPropagation(); onUp(); }}>Выше</ActionMenuItem>
          <ActionMenuItem disabled={disabled} onClick={(event) => { event.stopPropagation(); onDown(); }}>Ниже</ActionMenuItem>
          <ActionMenuItem tone="danger" disabled={disabled} onClick={(event) => { event.stopPropagation(); onRemove(); }}>Удалить группу</ActionMenuItem>
        </ActionMenu>
      </div>
      <ul className="mt-portal-2 space-y-1">
        {group.memberKeys.map((nodeKey, index) => {
          const node = draft.nodes.find((item) => item.key === nodeKey);
          const operation = node?.operationId == null ? undefined : operationById.get(node.operationId);
          const isDefault = nodeKey === group.defaultNodeKey;
          return (
            <li key={nodeKey} className="flex items-center gap-portal-2 rounded-portal-md bg-portal-surface-secondary px-portal-2 py-1">
              <label className="flex min-w-0 flex-1 items-center gap-portal-2">
                <input type="radio" name={`variant-${group.id}`} checked={isDefault} disabled={disabled} onChange={() => onDefault(nodeKey)} />
                <span className="min-w-0">
                  <span className="block truncate text-portal-caption">{operation?.name ?? "Операция не выбрана"}</span>
                  <span className="block text-portal-caption text-portal-muted">{isDefault ? "По умолчанию" : "Вариант"}</span>
                </span>
              </label>
              <OperationIconActions
                disabled={disabled}
                canUp={index > 0}
                canDown={index < group.memberKeys.length - 1}
                onEdit={operation ? () => onConfigure(operation.id) : undefined}
                onUp={() => onMemberUp(nodeKey)}
                onDown={() => onMemberDown(nodeKey)}
                onRemove={() => onDetach(nodeKey)}
                removeLabel="Убрать из группы"
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
