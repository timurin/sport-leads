"use client";

import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { updateShopRouting } from "@/app/(workspace)/settings/catalogs/routings/routing-actions";
import { SimpleEntityCard } from "@/components/entity/simple-entity-card";
import { Button, IconButton } from "@/components/ui/button";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableFrame,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
} from "@/components/ui/data-table";
import { EntityHeader } from "@/components/ui/entity-header";
import { Checkbox, Field, Input, Select } from "@/components/ui/form-controls";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/components/ui/toast";
import {
  toShopRoutingStageDrafts,
  validateShopRoutingStages,
  type ShopRoutingStageDraft,
  type ShopRoutingTemplate,
  type WorkCenter,
} from "@/lib/shop-routings";
import type { TechOperation } from "@/lib/tech-operations";

type ShopRoutingDetailWorkspaceProps = {
  routing: ShopRoutingTemplate;
  techOperations: TechOperation[];
  workCenters: WorkCenter[];
};

function nextStageOrder(stages: ShopRoutingStageDraft[]): number {
  if (stages.length === 0) return 1;
  return Math.max(...stages.map((stage) => stage.stage_order)) + 1;
}

/** Shop routing detail with editable stages table. */
export function ShopRoutingDetailWorkspace({
  routing,
  techOperations,
  workCenters,
}: ShopRoutingDetailWorkspaceProps) {
  const router = useRouter();
  const { push: pushToast } = useToast();
  const [name, setName] = useState(routing.name);
  const [code, setCode] = useState(routing.code ?? "");
  const [isActive, setIsActive] = useState(routing.is_active);
  const [stages, setStages] = useState<ShopRoutingStageDraft[]>(() =>
    toShopRoutingStageDrafts(routing),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const techOpOptions = useMemo(
    () =>
      [...techOperations].sort((a, b) =>
        a.name.localeCompare(b.name, "ru"),
      ),
    [techOperations],
  );

  const workCenterOptions = useMemo(
    () =>
      [...workCenters].sort((a, b) =>
        a.name.localeCompare(b.name, "ru"),
      ),
    [workCenters],
  );

  const dirty =
    name !== routing.name ||
    code !== (routing.code ?? "") ||
    isActive !== routing.is_active ||
    JSON.stringify(stages) !== JSON.stringify(toShopRoutingStageDrafts(routing));

  const updateStage = (
    index: number,
    patch: Partial<ShopRoutingStageDraft>,
  ) => {
    setStages((current) =>
      current.map((stage, stageIndex) =>
        stageIndex === index ? { ...stage, ...patch } : stage,
      ),
    );
    setError(null);
  };

  const addStage = () => {
    setStages((current) => [
      ...current,
      {
        stage_order: nextStageOrder(current),
        stage_label: "",
        tech_operation_id: null,
        work_center_id: null,
        is_quality_checkpoint: false,
      },
    ]);
  };

  const removeStage = (index: number) => {
    setStages((current) => current.filter((_, stageIndex) => stageIndex !== index));
  };

  const save = async () => {
    const stagesError = validateShopRoutingStages(stages);
    if (stagesError) {
      setError(stagesError);
      return;
    }
    if (!name.trim()) {
      setError("Укажите наименование маршрута");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const result = await updateShopRouting(routing.id, {
        name,
        code,
        is_active: isActive,
        stages,
      });
      if (!result.ok) {
        setError(result.message);
        setSaving(false);
        return;
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
            >
              Маршруты
            </Link>
          }
          title={routing.name}
          description="Шаблон маршрута производства с этапами и привязкой тех операций."
          status={
            <StatusBadge size="compact" tone={routing.is_active ? "success" : "neutral"}>
              {routing.is_active ? "Активен" : "Отключён"}
            </StatusBadge>
          }
          actions={
            <Link
              href="/settings/catalogs/routings"
              className="portal-focus-ring inline-flex h-portal-control-default items-center justify-center gap-portal-2 rounded-portal-md border border-portal-border bg-portal-surface px-portal-4 text-portal-body font-medium text-portal-text hover:bg-portal-state-hover"
            >
              ← К списку
            </Link>
          }
        />
      }
    >
      {error ? (
        <p
          className="mb-portal-4 rounded-portal-md border border-portal-danger/30 bg-portal-danger-soft px-portal-4 py-portal-2 text-portal-body text-portal-danger"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <SectionCard
        title="Реквизиты"
        description="Наименование, код и статус маршрута."
        size="compact"
      >
        <div className="grid gap-portal-4 min-[900px]:grid-cols-3">
          <Field label="Наименование" required>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={saving}
              maxLength={255}
            />
          </Field>
          <Field label="Код">
            <Input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              disabled={saving}
              maxLength={64}
            />
          </Field>
          <div className="flex items-end pb-1">
            <Checkbox
              checked={isActive}
              onChange={(event) => setIsActive(event.target.checked)}
              disabled={saving}
              label="Активен"
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Этапы маршрута"
        description="Полная замена этапов при сохранении."
        size="compact"
        actions={
          <Button type="button" onClick={addStage} disabled={saving}>
            <Plus className="size-4" aria-hidden="true" />
            Добавить этап
          </Button>
        }
      >
        <DataTableFrame>
          <DataTable minWidthClassName="min-w-[960px]">
            <DataTableHead>
              <tr>
                <DataTableHeaderCell className="w-20">№</DataTableHeaderCell>
                <DataTableHeaderCell>Этап</DataTableHeaderCell>
                <DataTableHeaderCell className="w-52">
                  Тех операция
                </DataTableHeaderCell>
                <DataTableHeaderCell className="w-52">
                  Рабочий центр
                </DataTableHeaderCell>
                <DataTableHeaderCell className="w-28">ОТК</DataTableHeaderCell>
                <DataTableHeaderCell className="w-16" />
              </tr>
            </DataTableHead>
            <DataTableBody>
              {stages.map((stage, index) => (
                <DataTableRow key={`stage-${index}`}>
                  <DataTableCell>
                    <Input
                      value={String(stage.stage_order)}
                      inputMode="numeric"
                      onChange={(event) => {
                        const raw = event.target.value.trim();
                        const value = raw === "" ? 0 : Number(raw);
                        updateStage(index, {
                          stage_order: Number.isFinite(value) ? value : stage.stage_order,
                        });
                      }}
                      disabled={saving}
                      aria-label="Порядок этапа"
                    />
                  </DataTableCell>
                  <DataTableCell>
                    <Input
                      value={stage.stage_label}
                      onChange={(event) =>
                        updateStage(index, { stage_label: event.target.value })
                      }
                      disabled={saving}
                      aria-label="Наименование этапа"
                    />
                  </DataTableCell>
                  <DataTableCell>
                    <Select
                      value={
                        stage.tech_operation_id == null
                          ? ""
                          : String(stage.tech_operation_id)
                      }
                      onChange={(event) => {
                        const raw = event.target.value;
                        updateStage(index, {
                          tech_operation_id: raw ? Number(raw) : null,
                        });
                      }}
                      disabled={saving}
                      aria-label="Тех операция"
                    >
                      <option value="">Не указана</option>
                      {techOpOptions.map((operation) => (
                        <option key={operation.id} value={operation.id}>
                          {operation.name}
                        </option>
                      ))}
                    </Select>
                  </DataTableCell>
                  <DataTableCell>
                    <Select
                      value={
                        stage.work_center_id == null
                          ? ""
                          : String(stage.work_center_id)
                      }
                      onChange={(event) => {
                        const raw = event.target.value;
                        updateStage(index, {
                          work_center_id: raw ? Number(raw) : null,
                        });
                      }}
                      disabled={saving}
                      aria-label="Рабочий центр"
                    >
                      <option value="">Не указан</option>
                      {workCenterOptions.map((center) => (
                        <option key={center.id} value={center.id}>
                          {center.name}
                        </option>
                      ))}
                    </Select>
                  </DataTableCell>
                  <DataTableCell>
                    <Checkbox
                      checked={stage.is_quality_checkpoint}
                      onChange={(event) =>
                        updateStage(index, {
                          is_quality_checkpoint: event.target.checked,
                        })
                      }
                      disabled={saving}
                      label="ОТК"
                    />
                  </DataTableCell>
                  <DataTableCell>
                    <IconButton
                      label="Удалить этап"
                      disabled={saving || stages.length <= 1}
                      onClick={() => removeStage(index)}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </IconButton>
                  </DataTableCell>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
        </DataTableFrame>
      </SectionCard>

      <div className="flex justify-end">
        <Button
          type="button"
          variant="primary"
          disabled={saving || !dirty}
          onClick={() => void save()}
        >
          {saving ? "Сохранение…" : "Сохранить"}
        </Button>
      </div>
    </SimpleEntityCard>
  );
}
