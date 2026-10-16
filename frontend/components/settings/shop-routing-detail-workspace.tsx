"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { saveShopRoutingGraph, updateShopRouting, updateShopRoutingIdentity } from "@/app/(workspace)/settings/catalogs/routings/routing-actions";
import { RoutingGraphCanvas } from "@/components/settings/routing-graph-canvas";
import { SimpleEntityCard } from "@/components/entity/simple-entity-card";
import { Button } from "@/components/ui/button";
import { EntityHeader } from "@/components/ui/entity-header";
import { Checkbox, Field, Input } from "@/components/ui/form-controls";
import { StatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/components/ui/toast";
import type { CapacityResource } from "@/lib/tech-operation-capacity";
import type { ProductionStage } from "@/lib/production-stages";
import type { TechOperation } from "@/lib/tech-operations";
import {
  applyRoutingGraph,
  draftFromTemplate,
  draftsEqual,
  routingGraphBody,
  routingSaveBody,
  validateRoutingDraft,
  type RoutingEditorDraft,
  type RoutingGraphSource,
} from "@/lib/routing-graph-editor";
import { ReadinessStickers } from "@/components/production/readiness-stickers";
import { diagnosticEditorTarget, readDiagnostics, type ProductionDiagnostic } from "@/lib/production/readiness-stickers";
import type { RouteNodeReadiness } from "@/lib/route-readiness";
import type { ShopRoutingTemplate, WorkCenter } from "@/lib/shop-routings";

type ShopRoutingDetailWorkspaceProps = {
  routing: ShopRoutingTemplate;
  techOperations: TechOperation[];
  workCenters: WorkCenter[];
  productionStages: ProductionStage[];
  resources: CapacityResource[];
  materialOptions?: Array<{ id: number; name: string; unit: string; is_active: boolean }>;
  graph?: RoutingGraphSource | null;
  nodeReadiness?: RouteNodeReadiness[];
  diagnostics?: ProductionDiagnostic[];
};

export function ShopRoutingDetailWorkspace({
  routing,
  techOperations,
  workCenters,
  productionStages,
  resources,
  materialOptions = [],
  graph = null,
  nodeReadiness = [],
  diagnostics = [],
}: ShopRoutingDetailWorkspaceProps) {
  const router = useRouter();
  const { push: pushToast } = useToast();
  const signature = `${routing.id}:${routing.updated_at}`;
  const initial = useMemo(() => applyRoutingGraph(draftFromTemplate(routing), graph), [routing, graph]);
  const [synced, setSynced] = useState(signature);
  const [name, setName] = useState(routing.name);
  const [code, setCode] = useState(routing.code ?? "");
  const [isActive, setIsActive] = useState(routing.is_active);
  const [draft, setDraft] = useState<RoutingEditorDraft>(initial);
  if (signature !== synced) {
    setSynced(signature);
    setName(routing.name);
    setCode(routing.code ?? "");
    setIsActive(routing.is_active);
    setDraft(initial);
  }
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusRequest, setFocusRequest] = useState<{ key: string; token: number } | null>(null);
  const [diagnosticFocus, setDiagnosticFocus] = useState<{ operationId: number; fieldId: string; tab: "main" | "capacity" | "equipment" | "schedule" | "exceptions"; token: number } | null>(null);
  const stageName = useMemo(() => new Map(productionStages.map((stage) => [stage.id, stage.name])), [productionStages]);
  const issues = useMemo(
    () => validateRoutingDraft(draft, techOperations),
    [draft, techOperations],
  );
  const dirty = name !== routing.name || code !== (routing.code ?? "") || isActive !== routing.is_active || !draftsEqual(draft, initial);

  useEffect(() => {
    const onLeave = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [dirty]);

  function confirmLeave(): boolean {
    if (!dirty) return true;
    return window.confirm("Есть несохранённые изменения. Закрыть без сохранения?");
  }

  const save = async () => {
    if (!name.trim()) {
      setError("Укажите наименование маршрута");
      return;
    }
    if (issues.length > 0) {
      setError(issues[0].message);
      return;
    }
    const stages = routingSaveBody(draft, (id) => stageName.get(id) ?? "Цех");
    setSaving(true);
    setError(null);
    try {
      const result = draft.variantGroups.length > 0
        ? await updateShopRoutingIdentity(routing.id, { name, code, is_active: isActive })
        : await updateShopRouting(routing.id, {
          name,
          code,
          is_active: isActive,
          ...stages,
        });
      if (!result.ok) {
        setError(result.message);
        setSaving(false);
        return;
      }
      if (draft.variantGroups.length > 0) {
        const savedGraph = await saveShopRoutingGraph(routing.id, routingGraphBody(draft));
        if (!savedGraph.ok) {
          setError(savedGraph.message);
          setSaving(false);
          return;
        }
      }
      pushToast("Маршрут сохранён", "success");
      router.refresh();
    } catch {
      setError("Не удалось сохранить маршрут.");
    }
    setSaving(false);
  };

  return (
    <SimpleEntityCard
      header={
        <EntityHeader
          eyebrow={
            <Link
              href="/settings/catalogs/routings"
              className="text-portal-primary hover:underline"
              onClick={(event) => {
                if (!confirmLeave()) event.preventDefault();
              }}
            >
              Маршруты
            </Link>
          }
          title={name || routing.name}
          description="Изменения маршрута применяются только к новым техкартам или при явном повторном применении маршрута. Уже созданные техкарты сохраняют свой снимок."
          status={
            <div className="flex flex-wrap items-center gap-portal-2">
              <StatusBadge size="compact" tone={isActive ? "success" : "neutral"}>
                {isActive ? "Активен" : "Отключён"}
              </StatusBadge>
              {dirty ? <StatusBadge size="compact" tone="warning">Есть несохранённые изменения</StatusBadge> : null}
              {issues.length ? (
                <button
                  type="button"
                  className="rounded-portal-full"
                  onClick={() => setFocusRequest({ key: issues[0].nodeKey ?? issues[0].visitKey ?? "routing-canvas", token: Date.now() })}
                >
                  <StatusBadge size="compact" tone="danger">{issues[0].message}</StatusBadge>
                </button>
              ) : (
                <StatusBadge size="compact" tone="success">Граф можно сохранить</StatusBadge>
              )}
            </div>
          }
          actions={
            <div className="flex gap-portal-2">
              <Button type="button" variant="primary" disabled={saving || !dirty} onClick={() => void save()}>
                {saving ? "Сохранение…" : "Сохранить"}
              </Button>
              <Link
                href="/settings/catalogs/routings"
                className="portal-focus-ring inline-flex h-portal-control-default items-center justify-center rounded-portal-md border border-portal-border bg-portal-surface px-portal-4 text-portal-body font-medium"
                onClick={(event) => {
                  if (!confirmLeave()) event.preventDefault();
                }}
              >
                Закрыть
              </Link>
            </div>
          }
        />
      }
    >
      <div className="mb-portal-4">
        <ReadinessStickers
          diagnostics={readDiagnostics(diagnostics)}
          onSelect={(row) => {
            if (!row.operation_id) return;
            const target = diagnosticEditorTarget(row);
            setDiagnosticFocus({ operationId: row.operation_id, fieldId: target.fieldId, tab: target.tab, token: Date.now() });
          }}
        />
      </div>
      {error ? (
        <p className="mb-portal-4 rounded-portal-md border border-portal-danger/30 bg-portal-danger-soft px-portal-4 py-portal-2 text-portal-body text-portal-danger" role="alert">
          {error}
        </p>
      ) : null}
      <div className="mb-portal-4 grid gap-portal-4 min-[900px]:grid-cols-3">
        <Field label="Наименование" required>
          <Input value={name} onChange={(event) => setName(event.target.value)} disabled={saving} maxLength={255} />
        </Field>
        <Field label="Код">
          <Input value={code} onChange={(event) => setCode(event.target.value)} disabled={saving} maxLength={64} />
        </Field>
        <div className="flex items-end pb-1">
          <Checkbox checked={isActive} onChange={(event) => setIsActive(event.target.checked)} disabled={saving} label="Активен" />
        </div>
      </div>
      <RoutingGraphCanvas
        draft={draft}
        onChange={setDraft}
        productionStages={productionStages}
        techOperations={techOperations}
        workCenters={workCenters}
        resources={resources}
        materialOptions={materialOptions}
        nodeReadiness={nodeReadiness}
        diagnosticFocus={diagnosticFocus}
        issues={issues}
        focusRequest={focusRequest}
        disabled={saving}
      />
    </SimpleEntityCard>
  );
}

