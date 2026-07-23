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
  updateAssemblyVariant,
} from "@/app/(workspace)/settings/catalogs/product-models/product-model-actions";
import { AssemblyVariantSewingOpsDrawer } from "@/components/settings/assembly-variant-sewing-ops-drawer";
import { Button, IconButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  formatAssemblyCost,
  sumAssemblyVariantDurationSeconds,
  type AssemblyVariant,
} from "@/lib/product-models";
import {
  formatDurationMinutesSeconds,
  formatDurationSecondsLabel,
  type SewingOperation,
} from "@/lib/sewing-operations";

type AssemblyVariantsBlockProps = {
  modelId: number;
  variants: AssemblyVariant[];
  sewingOperations: SewingOperation[];
};

/** PT-08 main-slot block: assembly variants as sewing-operation groups (`6.1.12` / `6.3.6`). */
export function AssemblyVariantsBlock({
  modelId,
  variants,
  sewingOperations,
}: AssemblyVariantsBlockProps) {
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [appendVariantId, setAppendVariantId] = useState<number | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(() => new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
                        {variant.operation_lines.map((line) => (
                          <li
                            key={line.id}
                            className="flex flex-wrap items-center justify-between gap-portal-2 px-portal-3 py-portal-2"
                          >
                            <p className="min-w-0 text-portal-body text-portal-text">
                              <span className="text-portal-muted">
                                {line.sequence}.{" "}
                              </span>
                              {line.operation_name}
                            </p>
                            <div className="flex items-center gap-portal-2">
                              <span className="text-portal-caption text-portal-muted">
                                {formatDurationSecondsLabel(
                                  line.duration_seconds,
                                )}
                              </span>
                              <span className="text-portal-body font-medium text-portal-text">
                                {formatAssemblyCost(line.cost)} ₽
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
                            </div>
                          </li>
                        ))}
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
