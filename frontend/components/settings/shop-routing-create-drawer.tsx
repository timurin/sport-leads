"use client";

import { type FormEvent, useState } from "react";

import {
  createShopRouting,
  type ShopRoutingActionResult,
} from "@/app/(workspace)/settings/catalogs/routings/routing-actions";
import { Button } from "@/components/ui/button";
import { CreateDrawer } from "@/components/ui/create-drawer";
import { Checkbox, Field, Input, Select } from "@/components/ui/form-controls";
import { useToast } from "@/components/ui/toast";
import {
  validateShopRoutingCreateDraft,
  type ShopRoutingCreateDraft,
  type ShopRoutingStageDraft,
  type ShopRoutingTemplate,
} from "@/lib/shop-routings";
import type { ProductionStage } from "@/lib/production-stages";

const defaultStage = (): ShopRoutingStageDraft => ({
  stage_order: 1,
  production_stage_id: null,
  stage_label: "",
  tech_operation_id: null,
  work_center_id: null,
  is_quality_checkpoint: false,
});

const emptyDraft: ShopRoutingCreateDraft = {
  name: "",
  code: "",
  is_active: true,
  stages: [defaultStage()],
};

type ShopRoutingCreateDrawerProps = {
  open: boolean;
  onClose: () => void;
  onCreated?: (routing: ShopRoutingTemplate) => void;
  productionStages: ProductionStage[];
};

/** CreateDrawer host for shop routing templates. */
export function ShopRoutingCreateDrawer({
  open,
  onClose,
  onCreated,
  productionStages,
}: ShopRoutingCreateDrawerProps) {
  const { push: pushToast } = useToast();
  const [draft, setDraft] = useState<ShopRoutingCreateDraft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function handleClose() {
    if (saving) return;
    setDraft(emptyDraft);
    setError("");
    onClose();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validateShopRoutingCreateDraft(draft);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError("");
    try {
      const result: ShopRoutingActionResult = await createShopRouting(draft);
      if (result.ok) {
        setDraft(emptyDraft);
        setSaving(false);
        pushToast("Маршрут создан", "success");
        onCreated?.(result.routing);
        onClose();
        return;
      }
      setError(result.message);
    } catch {
      setError("Не удалось связаться с API. Маршрут не создан.");
    }
    setSaving(false);
  }

  const stage = draft.stages[0] ?? defaultStage();

  return (
    <CreateDrawer
      open={open}
      title="Новый маршрут"
      description="Шаблон маршрута с хотя бы одним цехом. Детали этапов — в карточке маршрута."
      onClose={handleClose}
      variant="overlay"
    >
      <form onSubmit={submit} className="flex h-full min-h-0 flex-col">
        <div className="min-h-0 flex-1 space-y-portal-5 overflow-y-auto p-portal-6">
          <div className="border-t border-portal-border pt-portal-5">
            <h3 className="mb-portal-4 text-portal-body font-semibold text-portal-text">
              Реквизиты
            </h3>
            <div className="grid gap-portal-4">
              <Field label="Наименование" required>
                <Input
                  autoFocus
                  required
                  maxLength={255}
                  value={draft.name}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, name: event.target.value }))
                  }
                  disabled={saving}
                />
              </Field>
              <Field label="Код">
                <Input
                  maxLength={64}
                  value={draft.code}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, code: event.target.value }))
                  }
                  disabled={saving}
                />
              </Field>
              <Checkbox
                checked={draft.is_active}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    is_active: event.target.checked,
                  }))
                }
                disabled={saving}
                label="Активен"
              />
            </div>
          </div>

          <div className="border-t border-portal-border pt-portal-5">
            <h3 className="mb-portal-4 text-portal-body font-semibold text-portal-text">
              Первый цех
            </h3>
            <div className="grid gap-portal-4">
              <Field label="Цех" required>
                <Select
                  required
                  value={
                    stage.production_stage_id == null
                      ? ""
                      : String(stage.production_stage_id)
                  }
                  onChange={(event) => {
                    const productionStageId = event.target.value
                      ? Number(event.target.value)
                      : null;
                    const selected = productionStages.find(
                      (item) => item.id === productionStageId,
                    );
                    setDraft((current) => ({
                      ...current,
                      stages: [
                        {
                          ...stage,
                          production_stage_id: productionStageId,
                          stage_label: selected?.name ?? "",
                        },
                      ],
                    }));
                  }}
                  disabled={saving}
                >
                  <option value="">Выберите цех</option>
                  {productionStages
                    .filter((item) => item.is_active)
                    .sort(
                      (a, b) =>
                        a.sort_order - b.sort_order ||
                        a.name.localeCompare(b.name, "ru"),
                    )
                    .map((productionStage) => (
                      <option key={productionStage.id} value={productionStage.id}>
                        {productionStage.name}
                      </option>
                    ))}
                </Select>
              </Field>
              <Checkbox
                checked={stage.is_quality_checkpoint}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    stages: [
                      {
                        ...stage,
                        is_quality_checkpoint: event.target.checked,
                      },
                    ],
                  }))
                }
                disabled={saving}
                label="Контроль качества"
              />
            </div>
          </div>

          {error ? (
            <p className="text-portal-body text-portal-danger" role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <footer className="flex items-center justify-end gap-portal-2 border-t border-portal-border bg-portal-surface px-portal-6 py-portal-4">
          <Button type="button" onClick={handleClose} disabled={saving}>
            Отмена
          </Button>
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? "Создание…" : "Создать"}
          </Button>
        </footer>
      </form>
    </CreateDrawer>
  );
}
