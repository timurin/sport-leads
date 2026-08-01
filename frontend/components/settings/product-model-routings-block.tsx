"use client";

import Link from "next/link";
import {
  Archive,
  ArchiveRestore,
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Plus,
  Star,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
  deleteProductModelRouting,
  reorderProductModelRoutings,
  replaceProductModelRoutingNorms,
  setProductModelDefaultRouting,
  updateProductModelRouting,
} from "@/app/(workspace)/settings/catalogs/product-models/product-model-actions";
import { ProductModelRoutingAddDrawer } from "@/components/settings/product-model-routing-add-drawer";
import { Button, IconButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/form-controls";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  buildRoutingNormRows,
  parseNormQtyInput,
  type ProductModelRoutingLink,
  type RoutingNormRow,
} from "@/lib/product-model-routings";
import type { ProductionStage } from "@/lib/production-stages";
import type { ShopRoutingTemplate } from "@/lib/shop-routings";
import {
  formatTechOperationVolumeUnit,
  type TechOperation,
  type TechOperationVolumeUnit,
} from "@/lib/tech-operations";

type ProductModelRoutingsBlockProps = {
  modelId: number;
  defaultRoutingTemplateId: number | null;
  links: ProductModelRoutingLink[];
  shopRoutings: ShopRoutingTemplate[];
  /** Reserved / page wiring; operation rows come from routing preset stage lines. */
  productionStages?: ProductionStage[];
  techOperations: TechOperation[];
};

/** PT-08 block: model routing whitelist + plan-hint norms (`6.1.17.4`). */
export function ProductModelRoutingsBlock({
  modelId,
  defaultRoutingTemplateId,
  links,
  shopRoutings,
  techOperations,
}: ProductModelRoutingsBlockProps) {
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(() => new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const templateById = useMemo(() => {
    const map = new Map<number, ShopRoutingTemplate>();
    for (const row of shopRoutings) map.set(row.id, row);
    return map;
  }, [shopRoutings]);

  const opById = useMemo(() => {
    const map = new Map<number, TechOperation>();
    for (const row of techOperations) map.set(row.id, row);
    return map;
  }, [techOperations]);

  const ordered = useMemo(
    () => [...links].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id),
    [links],
  );

  const run = async (
    action: () => Promise<{ ok: true } | { ok: false; message: string }>,
  ) => {
    setBusy(true);
    setError(null);
    const result = await action();
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return false;
    }
    router.refresh();
    return true;
  };

  const toggleExpanded = (linkId: number) => {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(linkId)) next.delete(linkId);
      else next.add(linkId);
      return next;
    });
  };

  const onMove = async (linkId: number, direction: -1 | 1) => {
    const ids = ordered.map((row) => row.id);
    const index = ids.indexOf(linkId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ids.length) return;
    const next = [...ids];
    const [row] = next.splice(index, 1);
    next.splice(target, 0, row);
    await run(() => reorderProductModelRoutings(modelId, next));
  };

  const onArchive = async (link: ProductModelRoutingLink) => {
    if (link.is_active) {
      if (
        !window.confirm(
          `Скрыть маршрут «${link.shop_routing_template_name ?? link.shop_routing_template_id}» из выбора?\nСвязь останется в whitelist.`,
        )
      ) {
        return;
      }
      await run(() =>
        updateProductModelRouting(modelId, link.id, { is_active: false }),
      );
      return;
    }
    await run(() =>
      updateProductModelRouting(modelId, link.id, { is_active: true }),
    );
  };

  const onDelete = async (link: ProductModelRoutingLink) => {
    const title = link.shop_routing_template_name ?? `#${link.shop_routing_template_id}`;
    if (
      !window.confirm(
        `Убрать маршрут «${title}» из whitelist модели?\nСам пресет в справочнике не удалится.`,
      )
    ) {
      return;
    }
    await run(() => deleteProductModelRouting(modelId, link.id));
  };

  const onSetDefault = async (link: ProductModelRoutingLink) => {
    await run(() =>
      setProductModelDefaultRouting(modelId, link.shop_routing_template_id),
    );
  };

  const onReplaceNorms = async (
    link: ProductModelRoutingLink,
    norms: Array<{
      production_stage_id: number | null;
      tech_operation_id: number | null;
      norm_qty_per_item: string;
      unit: string;
    }>,
  ) => {
    await run(() => replaceProductModelRoutingNorms(modelId, link.id, norms));
  };

  return (
    <SectionCard
      title="Варианты маршрутов"
      description="Whitelist цеховых пресетов модели и нормы расхода на 1 изделие (план). Справочник маршрутов не дублируется."
      size="compact"
      actions={
        <IconButton
          label="Добавить маршрут"
          variant="primary"
          disabled={busy}
          onClick={() => {
            setDrawerOpen(true);
            setError(null);
          }}
        >
          <Plus className="size-4" />
        </IconButton>
      }
    >
      <div className="grid min-w-0 gap-portal-3">
        <p className="text-portal-caption text-portal-muted">
          Мастер маршрутов:{" "}
          <Link
            href="/settings/catalogs/routings"
            className="text-portal-accent underline-offset-2 hover:underline"
          >
            Администрирование → Маршруты
          </Link>
        </p>

        {error ? (
          <p className="text-portal-caption text-portal-danger" role="alert">
            {error}
          </p>
        ) : null}

        {ordered.length === 0 ? (
          <EmptyState
            title="Маршрутов пока нет"
            description="Нажмите «+» и выберите пресеты из справочника маршрутов."
            size="compact"
          />
        ) : (
          <ul className="grid gap-portal-2">
            {ordered.map((link, index) => {
              const expanded = expandedIds.has(link.id);
              const archived = !link.is_active;
              const isDefault =
                defaultRoutingTemplateId != null &&
                defaultRoutingTemplateId === link.shop_routing_template_id;
              const template = templateById.get(link.shop_routing_template_id);
              const stageCount = template?.stage_lines?.length ?? 0;
              const title =
                link.shop_routing_template_name ??
                template?.name ??
                `Маршрут #${link.shop_routing_template_id}`;
              return (
                <li
                  key={link.id}
                  className="rounded-portal-md border border-portal-border bg-portal-surface-secondary"
                >
                  <div className="flex flex-wrap items-center gap-portal-2 px-portal-3 py-portal-2">
                    <IconButton
                      label={
                        expanded ? "Свернуть операции" : "Развернуть операции"
                      }
                      variant="ghost"
                      disabled={busy}
                      onClick={() => toggleExpanded(link.id)}
                    >
                      {expanded ? (
                        <ChevronDown className="size-4" />
                      ) : (
                        <ChevronRight className="size-4" />
                      )}
                    </IconButton>

                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => toggleExpanded(link.id)}
                    >
                      <div className="flex flex-wrap items-center gap-portal-2">
                        <span className="font-semibold text-portal-text">
                          {title}
                        </span>
                        <StatusBadge
                          size="compact"
                          tone={archived ? "neutral" : "success"}
                        >
                          {archived ? "Скрыт" : "Активен"}
                        </StatusBadge>
                        {isDefault ? (
                          <StatusBadge size="compact" tone="primary">
                            По умолчанию
                          </StatusBadge>
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-portal-caption text-portal-muted">
                        {stageCount} оп.
                        {link.operation_norms.length > 0
                          ? ` · норм заполнено ${link.operation_norms.length}`
                          : ""}
                        {!expanded && stageCount > 0 ? " · свёрнуто" : ""}
                      </p>
                    </button>

                    <div
                      className="flex flex-wrap items-center gap-1"
                      role="toolbar"
                      aria-label={`Действия маршрута ${title}`}
                    >
                      <IconButton
                        label="Выше"
                        variant="secondary"
                        disabled={busy || index === 0}
                        onClick={() => void onMove(link.id, -1)}
                      >
                        <ArrowUp className="size-4" />
                      </IconButton>
                      <IconButton
                        label="Ниже"
                        variant="secondary"
                        disabled={busy || index === ordered.length - 1}
                        onClick={() => void onMove(link.id, 1)}
                      >
                        <ArrowDown className="size-4" />
                      </IconButton>
                      <IconButton
                        label="Сделать по умолчанию"
                        variant="secondary"
                        disabled={busy || archived || isDefault}
                        onClick={() => void onSetDefault(link)}
                      >
                        <Star className="size-4" />
                      </IconButton>
                      <IconButton
                        label={archived ? "Вернуть в выбор" : "Скрыть"}
                        variant="secondary"
                        disabled={busy}
                        onClick={() => void onArchive(link)}
                      >
                        {archived ? (
                          <ArchiveRestore className="size-4" />
                        ) : (
                          <Archive className="size-4" />
                        )}
                      </IconButton>
                      <IconButton
                        label="Убрать из whitelist"
                        variant="danger"
                        disabled={busy}
                        onClick={() => void onDelete(link)}
                      >
                        <Trash2 className="size-4" />
                      </IconButton>
                    </div>
                  </div>

                  {expanded ? (
                    <RoutingOperationsTable
                      link={link}
                      template={template ?? null}
                      busy={busy}
                      archived={archived}
                      opById={opById}
                      onSave={(norms) => void onReplaceNorms(link, norms)}
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}

        <ProductModelRoutingAddDrawer
          open={drawerOpen}
          modelId={modelId}
          shopRoutings={shopRoutings}
          links={links}
          techOperations={techOperations}
          onClose={() => setDrawerOpen(false)}
          onSaved={() => router.refresh()}
        />
      </div>
    </SectionCard>
  );
}

function RoutingOperationsTable({
  link,
  template,
  busy,
  archived,
  opById,
  onSave,
}: {
  link: ProductModelRoutingLink;
  template: ShopRoutingTemplate | null;
  busy: boolean;
  archived: boolean;
  opById: Map<number, TechOperation>;
  onSave: (
    norms: Array<{
      production_stage_id: number | null;
      tech_operation_id: number | null;
      norm_qty_per_item: string;
      unit: string;
    }>,
  ) => void;
}) {
  const baseRows = useMemo(() => {
    if (!template) return [] as RoutingNormRow[];
    const opsMap = new Map(
      [...opById.entries()].map(([id, op]) => [
        id,
        { name: op.name, volume_unit: op.volume_unit },
      ]),
    );
    return buildRoutingNormRows(
      template.stage_lines ?? [],
      link.operation_norms,
      opsMap,
    );
  }, [link.operation_norms, opById, template]);

  const [draftQty, setDraftQty] = useState<Record<string, string>>({});
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const row of baseRows) {
      next[row.key] = row.norm_qty_per_item;
    }
    setDraftQty(next);
    setLocalError(null);
  }, [baseRows]);

  const unitLabel = (unit: string) => {
    if (unit === "linear_meters" || unit === "pieces") {
      return formatTechOperationVolumeUnit(unit as TechOperationVolumeUnit);
    }
    return unit;
  };

  const save = () => {
    const payload: Array<{
      production_stage_id: number | null;
      tech_operation_id: number | null;
      norm_qty_per_item: string;
      unit: string;
    }> = [];

    for (const row of baseRows) {
      if (row.production_stage_id == null && row.tech_operation_id == null) {
        continue;
      }
      const raw = (draftQty[row.key] ?? "").trim();
      if (!raw) continue;
      const parsed = parseNormQtyInput(raw);
      if (parsed == null) {
        setLocalError(
          `Некорректная норма для «${row.operation_label}» (число ≥ 0, до 3 знаков)`,
        );
        return;
      }
      payload.push({
        production_stage_id: row.production_stage_id,
        tech_operation_id: row.tech_operation_id,
        norm_qty_per_item: parsed,
        unit: row.unit,
      });
    }

    setLocalError(null);
    onSave(payload);
  };

  if (!template) {
    return (
      <div className="border-t border-portal-border px-portal-3 py-portal-3">
        <p className="text-portal-caption text-portal-muted">
          Пресет маршрута не найден в каталоге — откройте{" "}
          <Link
            href={`/settings/catalogs/routings/${link.shop_routing_template_id}`}
            className="text-portal-accent underline-offset-2 hover:underline"
          >
            карточку маршрута
          </Link>
          .
        </p>
      </div>
    );
  }

  if (baseRows.length === 0) {
    return (
      <div className="border-t border-portal-border px-portal-3 py-portal-3">
        <p className="text-portal-caption text-portal-muted">
          В пресете нет этапов. Добавьте этапы в{" "}
          <Link
            href={`/settings/catalogs/routings/${template.id}`}
            className="text-portal-accent underline-offset-2 hover:underline"
          >
            справочнике маршрутов
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="border-t border-portal-border px-portal-3 py-portal-3">
      <ul className="divide-y divide-portal-border overflow-hidden rounded-portal-md border border-portal-border bg-portal-surface">
        <li className="grid grid-cols-[minmax(0,1fr)_7.5rem_4.5rem] items-center gap-portal-2 bg-portal-bg px-portal-3 py-portal-2 text-portal-caption text-portal-muted">
          <span>Операция</span>
          <span className="text-right">Норма на 1 изд.</span>
          <span className="text-right">Ед.</span>
        </li>
        {baseRows.map((row) => (
          <li
            key={row.key}
            className="grid grid-cols-[minmax(0,1fr)_7.5rem_4.5rem] items-center gap-portal-2 px-portal-3 py-portal-2"
          >
            <p className="min-w-0 text-portal-body text-portal-text">
              <span className="text-portal-muted">{row.stage_order}. </span>
              {row.operation_label}
            </p>
            <div className="justify-self-end">
              <Input
                className="w-[6.5rem] text-right tabular-nums"
                value={draftQty[row.key] ?? ""}
                placeholder="—"
                disabled={busy || archived}
                onChange={(event) => {
                  const value = event.target.value;
                  setDraftQty((current) => ({ ...current, [row.key]: value }));
                  setLocalError(null);
                }}
                aria-label={`Норма на 1 изд. · ${row.operation_label}`}
              />
            </div>
            <span className="text-right text-portal-caption text-portal-muted">
              {unitLabel(row.unit)}
            </span>
          </li>
        ))}
      </ul>

      {localError ? (
        <p className="mt-portal-2 text-portal-caption text-portal-danger" role="alert">
          {localError}
        </p>
      ) : (
        <p className="mt-portal-2 text-portal-caption text-portal-muted">
          Операции взяты из пресета маршрута. Пустая норма не сохраняется.
        </p>
      )}

      {!archived ? (
        <div className="mt-portal-3 flex justify-end">
          <Button type="button" size="compact" disabled={busy} onClick={save}>
            Сохранить нормы
          </Button>
        </div>
      ) : null}
    </div>
  );
}
