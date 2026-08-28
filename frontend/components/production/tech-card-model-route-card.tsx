"use client";

import { Pencil, Save, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useState } from "react";

import {
  listTechnicalCardAssemblyCandidates,
  listTechnicalCardModelCandidates,
  updateTechnicalCardModelAssemblyAction,
  type TechnicalCardAssemblyCandidate,
  type TechnicalCardModelCandidate,
} from "@/app/(workspace)/production/tech-cards/tech-card-actions";
import { IconButton } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/form-controls";
import { InlineAlert } from "@/components/ui/inline-alert";
import { SectionCard } from "@/components/ui/section-card";
import { controlClassName } from "@/lib/design-system/control-styles";
import { techCardModelLabel } from "@/lib/production/tech-cards";
import type { ApiTechnicalCard } from "@/lib/sales/order-tech-cards-api";

type RoutingOption = {
  id: number;
  name: string;
  code: string | null;
  is_active: boolean;
};

type TechCardModelRouteCardProps = {
  card: ApiTechnicalCard;
  routings: RoutingOption[];
  disabled?: boolean;
  onApplyRouting: (routingTemplateId: number) => void;
};

function modelLabel(row: Pick<TechnicalCardModelCandidate, "article" | "name" | "label">): string {
  return row.label || [row.article, row.name].filter(Boolean).join(" · ") || "Модель";
}

export function TechCardModelRouteCard({
  card,
  routings,
  disabled = false,
  onApplyRouting,
}: TechCardModelRouteCardProps) {
  const router = useRouter();
  const listboxId = useId();
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modelCandidates, setModelCandidates] = useState<TechnicalCardModelCandidate[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<number | null>(null);
  const [modelQuery, setModelQuery] = useState("");
  const [modelOpen, setModelOpen] = useState(false);
  const [modelActiveIndex, setModelActiveIndex] = useState(0);
  const [assemblies, setAssemblies] = useState<TechnicalCardAssemblyCandidate[]>([]);
  const [selectedAssemblyId, setSelectedAssemblyId] = useState<number | null>(null);

  const defaultModelId = card.product_model_id ?? null;
  const defaultModelLabel = techCardModelLabel(card);
  const defaultAssemblyId = card.assembly_variant_id ?? null;
  const routingSelectValue =
    card.routing_template_id != null ? String(card.routing_template_id) : "";
  const controlsDisabled = disabled || pending;

  const modelOptions = useMemo(() => {
    const byId = new Map<number, TechnicalCardModelCandidate>();
    if (selectedModelId != null) {
      byId.set(selectedModelId, {
        id: selectedModelId,
        article: "",
        name: "",
        label: modelQuery.trim() || defaultModelLabel || `Модель #${selectedModelId}`,
      });
    }
    for (const row of modelCandidates) byId.set(row.id, row);
    return [...byId.values()];
  }, [defaultModelLabel, modelCandidates, modelQuery, selectedModelId]);

  const assemblyOptions = useMemo(() => {
    const byId = new Map<number, TechnicalCardAssemblyCandidate>();
    if (
      selectedAssemblyId != null &&
      selectedModelId === defaultModelId &&
      card.assembly_variant_name
    ) {
      byId.set(selectedAssemblyId, {
        id: selectedAssemblyId,
        name: card.assembly_variant_name,
        is_active: true,
      });
    }
    for (const row of assemblies) byId.set(row.id, row);
    return [...byId.values()];
  }, [
    assemblies,
    card.assembly_variant_name,
    defaultModelId,
    selectedAssemblyId,
    selectedModelId,
  ]);

  const modelExpanded = modelOpen && !disabled && !pending;

  useEffect(() => {
    if (!editing) return;
    const handle = window.setTimeout(() => {
      void (async () => {
        const result = await listTechnicalCardModelCandidates(modelQuery);
        if (!result.ok) {
          setError(result.message);
          return;
        }
        setModelCandidates(result.candidates);
      })();
    }, 200);
    return () => window.clearTimeout(handle);
  }, [editing, modelQuery]);

  useEffect(() => {
    if (!editing || selectedModelId == null) {
      setAssemblies([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      const result = await listTechnicalCardAssemblyCandidates(selectedModelId);
      if (cancelled) return;
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setAssemblies(result.candidates);
      setSelectedAssemblyId((current) => {
        if (current == null) return null;
        const exists = result.candidates.some((row) => row.id === current);
        if (exists) return current;
        if (current === defaultAssemblyId && selectedModelId === defaultModelId) {
          return current;
        }
        return null;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [defaultAssemblyId, defaultModelId, editing, selectedModelId]);

  const beginEdit = () => {
    setSelectedModelId(defaultModelId);
    setModelQuery(defaultModelLabel === "—" ? "" : defaultModelLabel);
    setSelectedAssemblyId(defaultAssemblyId);
    setError(null);
    setModelOpen(false);
    setModelActiveIndex(0);
    setEditing(true);
  };

  const onCancel = () => {
    setEditing(false);
    setError(null);
    setModelOpen(false);
    setPending(false);
  };

  const selectModel = (row: TechnicalCardModelCandidate) => {
    setSelectedModelId(row.id);
    setModelQuery(modelLabel(row));
    setModelOpen(false);
    if (row.id !== selectedModelId) {
      setSelectedAssemblyId(null);
    }
  };

  const onSave = async () => {
    setPending(true);
    setError(null);
    const result = await updateTechnicalCardModelAssemblyAction(
      card.id,
      selectedModelId,
      selectedAssemblyId,
    );
    setPending(false);
    if (!result.ok) {
      setError(result.message ?? "Не удалось сохранить модель и сборку");
      return;
    }
    setEditing(false);
    router.refresh();
  };

  return (
    <SectionCard
      title="Модель и маршрут"
      size="compact"
      collapsed={false}
      actions={
        <div
          className="flex flex-wrap items-center gap-1"
          role="toolbar"
          aria-label="Правка модели и сборки"
          data-tech-card-model-route-chrome
        >
          {editing ? (
            <>
              <IconButton
                label="Отменить редактирование"
                variant="secondary"
                disabled={controlsDisabled}
                onClick={onCancel}
                data-tech-card-model-route-cancel
              >
                <X className="size-4" aria-hidden="true" />
              </IconButton>
              <IconButton
                label="Сохранить"
                variant="primary"
                disabled={controlsDisabled}
                onClick={() => void onSave()}
                data-tech-card-model-route-save
              >
                <Save className="size-4" aria-hidden="true" />
              </IconButton>
            </>
          ) : (
            <IconButton
              label="Редактировать модель и сборку"
              variant="secondary"
              disabled={disabled}
              onClick={beginEdit}
              data-tech-card-model-route-edit
            >
              <Pencil className="size-4" aria-hidden="true" />
            </IconButton>
          )}
        </div>
      }
    >
      <div data-tech-card-model-route data-tech-card-model-route-editing={editing ? "true" : "false"}>
        {editing ? (
          <div className="grid gap-portal-3">
            {error ? <InlineAlert tone="danger">{error}</InlineAlert> : null}
            <Field label="Модель" htmlFor="tech-card-product-model">
              <div className="relative">
                <input
                  id="tech-card-product-model"
                  type="text"
                  role="combobox"
                  autoComplete="off"
                  value={modelQuery}
                  disabled={controlsDisabled}
                  placeholder="Поиск в каталоге моделей"
                  aria-autocomplete="list"
                  aria-expanded={modelExpanded}
                  aria-controls={modelExpanded ? listboxId : undefined}
                  data-tech-card-model-combobox
                  className={controlClassName()}
                  onChange={(event) => {
                    const next = event.target.value;
                    setModelQuery(next);
                    setModelOpen(true);
                    setModelActiveIndex(0);
                    if (!next.trim()) {
                      setSelectedModelId(null);
                      setSelectedAssemblyId(null);
                    }
                  }}
                  onFocus={() => setModelOpen(true)}
                  onBlur={() => setModelOpen(false)}
                  onKeyDown={(event) => {
                    if (!modelExpanded || modelOptions.length === 0) return;
                    if (event.key === "ArrowDown") {
                      event.preventDefault();
                      setModelActiveIndex((index) => (index + 1) % modelOptions.length);
                    } else if (event.key === "ArrowUp") {
                      event.preventDefault();
                      setModelActiveIndex(
                        (index) => (index - 1 + modelOptions.length) % modelOptions.length,
                      );
                    } else if (event.key === "Enter") {
                      event.preventDefault();
                      const pick = modelOptions[Math.min(modelActiveIndex, modelOptions.length - 1)];
                      if (pick) selectModel(pick);
                    }
                  }}
                />
                {modelExpanded ? (
                  <div
                    id={listboxId}
                    role="listbox"
                    className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-portal-border bg-portal-surface p-1 shadow-lg"
                  >
                    {modelOptions.length > 0 ? (
                      modelOptions.map((item, index) => {
                        const active = index === Math.min(modelActiveIndex, modelOptions.length - 1);
                        return (
                          <button
                            key={item.id}
                            type="button"
                            role="option"
                            aria-selected={active}
                            onMouseDown={(event) => event.preventDefault()}
                            onMouseEnter={() => setModelActiveIndex(index)}
                            onClick={() => selectModel(item)}
                            className={`block w-full rounded-md px-3 py-2 text-left text-sm ${
                              active
                                ? "bg-portal-surface-secondary text-portal-primary"
                                : "text-portal-text hover:bg-portal-surface-secondary"
                            }`}
                          >
                            {modelLabel(item)}
                          </button>
                        );
                      })
                    ) : (
                      <div className="px-3 py-2 text-sm text-portal-muted">Моделей не найдено</div>
                    )}
                  </div>
                ) : null}
              </div>
            </Field>
            <Field label="Сборка">
              <Select
                size="compact"
                aria-label="Сборка"
                data-tech-card-assembly-select
                disabled={controlsDisabled || selectedModelId == null}
                value={selectedAssemblyId != null ? String(selectedAssemblyId) : ""}
                onChange={(event) => {
                  const raw = event.target.value;
                  setSelectedAssemblyId(raw ? Number(raw) : null);
                }}
              >
                <option value="">Выберите сборку…</option>
                {assemblyOptions.map((row) => (
                  <option key={row.id} value={String(row.id)}>
                    {row.name}
                    {row.is_active ? "" : " (неактивна)"}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        ) : (
          <dl className="grid gap-portal-3">
            <div>
              <dt className="text-portal-caption text-portal-muted">Модель</dt>
              <dd className="mt-1 text-portal-body">{techCardModelLabel(card)}</dd>
            </div>
            <div>
              <dt className="text-portal-caption text-portal-muted">Сборка</dt>
              <dd className="mt-1 text-portal-body">{card.assembly_variant_name ?? "—"}</dd>
            </div>
          </dl>
        )}
        <Field label="Маршруты и операции" className="mt-portal-4">
          <Select
            value={routingSelectValue}
            disabled={controlsDisabled}
            data-tech-card-routing-select
            onChange={(event) => {
              const next = Number(event.target.value);
              if (!Number.isSafeInteger(next) || next <= 0) return;
              if (next === card.routing_template_id) return;
              onApplyRouting(next);
            }}
          >
            <option value="">Выберите маршрут…</option>
            {routings.map((row) => (
              <option key={row.id} value={row.id}>
                {row.code ? `${row.code} — ${row.name}` : row.name}
                {row.is_active ? "" : " (неактивен)"}
              </option>
            ))}
          </Select>
        </Field>
        {card.routing_template_name ? (
          <p className="mt-portal-2 text-portal-caption text-portal-muted">
            Текущий: {card.routing_template_name}
          </p>
        ) : null}
      </div>
    </SectionCard>
  );
}
