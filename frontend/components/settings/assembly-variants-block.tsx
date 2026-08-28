"use client";

import {
  Archive,
  ArchiveRestore,
  ChevronDown,
  ChevronRight,
  Copy,
  Plus,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import {
  copyAssemblyVariant,
  deleteAssemblyOperationLine,
  deleteAssemblyVariant,
  updateAssemblyOperationLine,
  updateAssemblyVariant,
} from "@/app/(workspace)/settings/catalogs/product-models/product-model-actions";
import { AssemblyVariantSewingOpsDrawer } from "@/components/settings/assembly-variant-sewing-ops-drawer";
import { Button, IconButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/form-controls";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  assemblyOperationLineFieldPatch,
  assemblyOperationLineTotal,
  formatAssemblyCost,
  sumAssemblyVariantDurationSeconds,
  type AssemblyOperationLine,
  type AssemblyOperationLineField,
  type AssemblyVariant,
} from "@/lib/product-models";
import {
  formatDurationMinutesSeconds,
  toSewingCostInput,
  type SewingOperation,
  type SewingOperationFolder,
} from "@/lib/sewing-operations";
import type { SewingOperationTemplate } from "@/lib/sewing-operation-templates";

type AssemblyVariantsBlockProps = {
  modelId: number;
  variants: AssemblyVariant[];
  sewingOperations: SewingOperation[];
  sewingFolders?: SewingOperationFolder[];
  sewingTemplates?: SewingOperationTemplate[];
};

/** PT-08 main-slot block: assembly variants as sewing-operation groups (`6.1.12` / `6.3.6`). */
export function AssemblyVariantsBlock({
  modelId,
  variants,
  sewingOperations,
  sewingFolders = [],
  sewingTemplates = [],
}: AssemblyVariantsBlockProps) {
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [appendVariantId, setAppendVariantId] = useState<number | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(() => new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [invalidKey, setInvalidKey] = useState<string | null>(null);

  const appendExcludeIds = useMemo(() => {
    if (appendVariantId == null) return [];
    const variant = variants.find((row) => row.id === appendVariantId);
    if (!variant) return [];
    return variant.operation_lines
      .map((line) => line.sewing_operation_id)
      .filter((id): id is number => id != null);
  }, [appendVariantId, variants]);

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

  const toggleExpanded = (variantId: number) => {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(variantId)) next.delete(variantId);
      else next.add(variantId);
      return next;
    });
  };

  const onArchive = async (variant: AssemblyVariant) => {
    if (variant.is_active) {
      if (
        !window.confirm(
          `Архивировать вариант «${variant.name}»?\nОн не будет предлагаться в заказах, но останется в истории, если уже использовался.`,
        )
      ) {
        return;
      }
      await run(() =>
        updateAssemblyVariant(modelId, variant.id, { is_active: false }),
      );
      return;
    }
    await run(() =>
      updateAssemblyVariant(modelId, variant.id, { is_active: true }),
    );
  };

  const onCopy = async (variant: AssemblyVariant) => {
    await run(() => copyAssemblyVariant(modelId, variant.id));
  };

  const onDeleteVariant = async (variant: AssemblyVariant) => {
    if (
      !window.confirm(
        `Удалить вариант «${variant.name}» безвозвратно?\nЕсли вариант уже использовался в заказах, предпочтительнее архивировать.`,
      )
    ) {
      return;
    }
    await run(() => deleteAssemblyVariant(modelId, variant.id));
  };

  const onDeleteLine = async (variantId: number, lineId: number, name: string) => {
    if (!window.confirm(`Убрать операцию «${name}» из варианта?`)) return;
    await run(() => deleteAssemblyOperationLine(modelId, variantId, lineId));
  };

  const fieldValue = (
    line: AssemblyOperationLine,
    field: AssemblyOperationLineField,
  ) => {
    const key = economicsKey(line.id, field);
    if (edits[key] != null) return edits[key];
    if (field === "cost") return toSewingCostInput(line.cost);
    if (field === "duration_seconds") return String(line.duration_seconds ?? 0);
    return String(line.quantity_per_item ?? 1);
  };

  const commitField = async (
    variantId: number,
    line: AssemblyOperationLine,
    field: AssemblyOperationLineField,
  ) => {
    if (busy) return;
    const key = economicsKey(line.id, field);
    const raw = fieldValue(line, field);
    const result = assemblyOperationLineFieldPatch(line, field, raw);
    if (!result.ok) {
      setError(result.message);
      setInvalidKey(key);
      return;
    }
    setInvalidKey((current) => (current === key ? null : current));
    setError(null);
    const patch = result.patch;
    if (patch == null) return;
    const saved = await run(() =>
      updateAssemblyOperationLine(modelId, variantId, line.id, patch),
    );
    if (saved) {
      const next = patch[field];
      setEdits((current) => ({
        ...current,
        [key]: next == null ? raw : String(next),
      }));
    }
  };

  return (
    <SectionCard
      title="Варианты сборки"
      description="Варианты сборки изделия по технологическим допускам лекал"
      size="compact"
      actions={
        <IconButton
          label="Добавить вариант"
          variant="primary"
          disabled={busy}
          onClick={() => {
            setAppendVariantId(null);
            setDrawerOpen(true);
            setError(null);
          }}
        >
          <Plus className="size-4" />
        </IconButton>
      }
    >
      <div className="grid min-w-0 gap-portal-3">
      {error ? (
        <p className="text-portal-caption text-portal-danger" role="alert">
          {error}
        </p>
      ) : null}

      {variants.length === 0 ? (
        <EmptyState
          title="Вариантов пока нет"
          description="Нажмите «+», отметьте операции пошива в панели справа."
          size="compact"
        />
      ) : (
        <ul className="grid gap-portal-2">
          {variants.map((variant) => {
            const expanded = expandedIds.has(variant.id);
            const archived = !variant.is_active;
            return (
              <li
                key={variant.id}
                className="rounded-portal-md border border-portal-border bg-portal-surface-secondary"
              >
                <div className="flex flex-wrap items-center gap-portal-2 px-portal-3 py-portal-2">
                  <IconButton
                    label={expanded ? "Свернуть операции" : "Развернуть операции"}
                    variant="ghost"
                    disabled={busy}
                    onClick={() => toggleExpanded(variant.id)}
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
                    onClick={() => toggleExpanded(variant.id)}
                  >
                    <div className="flex flex-wrap items-center gap-portal-2">
                      <span className="font-semibold text-portal-text">
                        {variant.name}
                      </span>
                      <StatusBadge
                        size="compact"
                        tone={archived ? "neutral" : "success"}
                      >
                        {archived ? "Архив" : "Активен"}
                      </StatusBadge>
                    </div>
                    <p className="mt-0.5 text-portal-caption text-portal-muted">
                      Итого: {formatAssemblyCost(variant.total_cost)} ₽ · Время
                      сборки 1 изделия{" "}
                      {formatDurationMinutesSeconds(
                        sumAssemblyVariantDurationSeconds(
                          variant.operation_lines,
                        ),
                      )}{" "}
                      · {variant.operation_lines.length} оп.
                      {!expanded && variant.operation_lines.length > 0
                        ? " · свёрнуто"
                        : ""}
                    </p>
                  </button>

                  <div
                    className="flex flex-wrap items-center gap-1"
                    role="toolbar"
                    aria-label={`Действия варианта ${variant.name}`}
                  >
                    <IconButton
                      label="Добавить операции"
                      variant="secondary"
                      disabled={busy || archived}
                      onClick={() => {
                        setAppendVariantId(variant.id);
                        setDrawerOpen(true);
                        setError(null);
                        setExpandedIds((current) => new Set(current).add(variant.id));
                      }}
                    >
                      <Plus className="size-4" />
                    </IconButton>
                    <IconButton
                      label={archived ? "Вернуть из архива" : "Архив"}
                      variant="secondary"
                      disabled={busy}
                      onClick={() => void onArchive(variant)}
                    >
                      {archived ? (
                        <ArchiveRestore className="size-4" />
                      ) : (
                        <Archive className="size-4" />
                      )}
                    </IconButton>
                    <IconButton
                      label="Копировать"
                      variant="secondary"
                      disabled={busy}
                      onClick={() => void onCopy(variant)}
                    >
                      <Copy className="size-4" />
                    </IconButton>
                    <IconButton
                      label="Удалить"
                      variant="danger"
                      disabled={busy}
                      onClick={() => void onDeleteVariant(variant)}
                    >
                      <Trash2 className="size-4" />
                    </IconButton>
                  </div>
                </div>

                {expanded ? (
                  <div className="border-t border-portal-border px-portal-3 py-portal-3">
                    {variant.operation_lines.length > 0 ? (
                      <ul className="divide-y divide-portal-border overflow-hidden rounded-portal-md border border-portal-border bg-portal-surface">
                        <li className="grid grid-cols-[minmax(0,1fr)_4.5rem_5.5rem_4.5rem_5.5rem_auto] items-center gap-portal-2 bg-portal-bg px-portal-3 py-portal-2 text-portal-caption text-portal-muted">
                          <span>Операция</span>
                          <span className="text-right">Кол-во</span>
                          <span className="text-right">Цена</span>
                          <span className="text-right">Время</span>
                          <span className="text-right">Сумма</span>
                          <span className="w-8" aria-hidden="true" />
                        </li>
                        {variant.operation_lines.map((line) => {
                          const qtyRaw = fieldValue(line, "quantity_per_item");
                          const costRaw = fieldValue(line, "cost");
                          const liveTotal = assemblyOperationLineTotal({
                            cost: costRaw,
                            quantity_per_item: Number(qtyRaw) || 1,
                          });
                          return (
                          <li
                            key={line.id}
                            className="grid grid-cols-[minmax(0,1fr)_4.5rem_5.5rem_4.5rem_5.5rem_auto] items-center gap-portal-2 px-portal-3 py-portal-2"
                          >
                            <p className="min-w-0 text-portal-body text-portal-text">
                              <span className="text-portal-muted">
                                {line.sequence}.{" "}
                              </span>
                              {line.operation_name}
                            </p>
                            <EconomicsInput
                              value={qtyRaw}
                              ariaLabel="Кол-во"
                              disabled={busy || archived}
                              invalid={
                                invalidKey ===
                                economicsKey(line.id, "quantity_per_item")
                              }
                              onChange={(value) =>
                                setEdits((current) => ({
                                  ...current,
                                  [economicsKey(line.id, "quantity_per_item")]:
                                    value,
                                }))
                              }
                              onCommit={() =>
                                void commitField(
                                  variant.id,
                                  line,
                                  "quantity_per_item",
                                )
                              }
                            />
                            <EconomicsInput
                              value={costRaw}
                              ariaLabel="Цена"
                              disabled={busy || archived}
                              invalid={
                                invalidKey === economicsKey(line.id, "cost")
                              }
                              onChange={(value) =>
                                setEdits((current) => ({
                                  ...current,
                                  [economicsKey(line.id, "cost")]: value,
                                }))
                              }
                              onCommit={() =>
                                void commitField(variant.id, line, "cost")
                              }
                            />
                            <EconomicsInput
                              value={fieldValue(line, "duration_seconds")}
                              ariaLabel="Время, секунды"
                              disabled={busy || archived}
                              invalid={
                                invalidKey ===
                                economicsKey(line.id, "duration_seconds")
                              }
                              onChange={(value) =>
                                setEdits((current) => ({
                                  ...current,
                                  [economicsKey(line.id, "duration_seconds")]:
                                    value,
                                }))
                              }
                              onCommit={() =>
                                void commitField(
                                  variant.id,
                                  line,
                                  "duration_seconds",
                                )
                              }
                            />
                            <span className="text-right tabular-nums text-portal-body font-medium text-portal-text">
                              {formatAssemblyCost(liveTotal)} ₽
                            </span>
                            <IconButton
                              label={`Убрать операцию ${line.operation_name}`}
                              variant="danger"
                              disabled={busy || archived}
                              onClick={() =>
                                void onDeleteLine(
                                  variant.id,
                                  line.id,
                                  line.operation_name,
                                )
                              }
                            >
                              <Trash2 className="size-4" />
                            </IconButton>
                          </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <div className="flex flex-wrap items-center justify-between gap-portal-2">
                        <p className="text-portal-caption text-portal-muted">
                          Операций пока нет — итог 0,00 ₽.
                        </p>
                        {!archived ? (
                          <Button
                            type="button"
                            size="compact"
                            disabled={busy}
                            onClick={() => {
                              setAppendVariantId(variant.id);
                              setDrawerOpen(true);
                            }}
                          >
                            Добавить операции
                          </Button>
                        ) : null}
                      </div>
                    )}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <AssemblyVariantSewingOpsDrawer
        open={drawerOpen}
        modelId={modelId}
        sewingOperations={sewingOperations}
        folders={sewingFolders}
        templates={sewingTemplates}
        variantId={appendVariantId}
        excludeSewingOperationIds={appendExcludeIds}
        onClose={() => {
          setDrawerOpen(false);
          setAppendVariantId(null);
        }}
        onSaved={() => router.refresh()}
      />
      </div>
    </SectionCard>
  );
}

function economicsKey(lineId: number, field: AssemblyOperationLineField) {
  return `${lineId}:${field}`;
}

function EconomicsInput({
  value,
  ariaLabel,
  disabled,
  invalid,
  onChange,
  onCommit,
}: {
  value: string;
  ariaLabel: string;
  disabled: boolean;
  invalid: boolean;
  onChange: (value: string) => void;
  onCommit: () => void;
}) {
  return (
    <Input
      size="compact"
      className="text-right tabular-nums"
      value={value}
      disabled={disabled}
      invalid={invalid}
      aria-label={ariaLabel}
      inputMode="decimal"
      onChange={(event) => onChange(event.target.value)}
      onBlur={() => onCommit()}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          event.currentTarget.blur();
        }
      }}
    />
  );
}
