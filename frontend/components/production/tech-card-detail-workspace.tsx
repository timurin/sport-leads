"use client";

import Link from "next/link";
import { Printer, RotateCcw, Play, CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import {
  completeTechnicalCardStageAction,
  rollbackTechnicalCardStageAction,
  startTechnicalCardAction,
  startTechnicalCardStageAction,
} from "@/app/(workspace)/production/tech-cards/tech-card-actions";
import { DocumentCard } from "@/components/entity/document-card";
import { Button } from "@/components/ui/button";
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
import { EntityHeader } from "@/components/ui/entity-header";
import { EntityLink } from "@/components/ui/entity-link";
import { Field, Input, Textarea } from "@/components/ui/form-controls";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/components/ui/toast";
import {
  asTechCardUiStatus,
  compositionLineKindLabel,
  formatTechCardDateTime,
  formatVolumeUnit,
  stageResultStatusLabel,
  techCardModelLabel,
  techCardOrderLabel,
  techCardPositionLabel,
  techCardStatusTone,
} from "@/lib/production/tech-cards";
import type {
  ApiTechnicalCard,
  ApiTechnicalCardStageResult,
} from "@/lib/sales/order-tech-cards-api";
import { techCardStatusLabel } from "@/lib/sales/order-tech-cards";

type TechCardDetailWorkspaceProps = {
  card: ApiTechnicalCard;
  orderNumber?: string | null;
  listOrderId?: string;
};

function stageTone(status: string): "neutral" | "primary" | "success" | "warning" {
  if (status === "in_progress") return "primary";
  if (status === "completed") return "success";
  if (status === "skipped") return "warning";
  return "neutral";
}

/** PT-07 technical card document workspace. */
export function TechCardDetailWorkspace({
  card,
  orderNumber,
  listOrderId,
}: TechCardDetailWorkspaceProps) {
  const router = useRouter();
  const { push: pushToast } = useToast();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [completingStageOrder, setCompletingStageOrder] = useState<number | null>(null);
  const [performerName, setPerformerName] = useState("");
  const [scrapQty, setScrapQty] = useState("");
  const [reworkQty, setReworkQty] = useState("");
  const [stageNotes, setStageNotes] = useState("");

  const status = asTechCardUiStatus(String(card.status));
  const compositionLines = card.composition_lines ?? [];
  const unitLines = [...(card.unit_lines ?? [])].sort(
    (a, b) => a.unit_index - b.unit_index,
  );
  const operationLines = [...(card.operation_lines ?? [])].sort(
    (a, b) => a.sequence - b.sequence,
  );
  const stageResults = useMemo(
    () =>
      [...(card.stage_results ?? [])].sort(
        (a, b) => a.stage_order - b.stage_order || a.id - b.id,
      ),
    [card.stage_results],
  );

  const currentStage = stageResults.find(
    (stage) => stage.stage_order === card.current_stage_order,
  );
  const activeStage =
    currentStage ??
    stageResults.find((stage) => stage.status === "in_progress") ??
    stageResults.find((stage) => stage.status === "pending") ??
    null;

  const listHref = listOrderId
    ? `/production/tech-cards?orderId=${encodeURIComponent(listOrderId)}`
    : "/production/tech-cards";

  const completingStage =
    stageResults.find((stage) => stage.stage_order === completingStageOrder) ?? null;

  const canStartCard = status === "draft" && stageResults.length > 0;

  const canCompleteActiveStage =
    activeStage != null &&
    (activeStage.status === "in_progress" || activeStage.status === "pending") &&
    status !== "cancelled" &&
    status !== "completed";

  const canRollbackActiveStage =
    activeStage != null &&
    activeStage.status === "completed" &&
    status !== "cancelled";

  const canStartActiveStage =
    activeStage != null &&
    activeStage.status === "pending" &&
    status !== "cancelled" &&
    status !== "completed";

  const openCompleteForm = (stageOrder: number) => {
    setCompletingStageOrder(stageOrder);
    setCompleteOpen(true);
  };

  const runAction = async (action: () => Promise<{ ok: boolean; message: string | null }>) => {
    setBusy(true);
    setActionError(null);
    try {
      const result = await action();
      if (!result.ok) {
        setActionError(result.message ?? "Ошибка действия");
        setBusy(false);
        return;
      }
      if (result.message) pushToast(result.message, "success");
      setCompleteOpen(false);
      setCompletingStageOrder(null);
      setPerformerName("");
      setScrapQty("");
      setReworkQty("");
      setStageNotes("");
      router.refresh();
    } catch {
      setActionError("Не удалось выполнить действие");
    }
    setBusy(false);
  };

  const onPrint = () => {
    pushToast("Печать техкарты — скоро", "neutral");
  };

  const onStartCard = () =>
    runAction(() =>
      startTechnicalCardAction(card.id, card.sales_order_id),
    );

  const onStartStage = (stageOrder: number) => {
    void runAction(() =>
      startTechnicalCardStageAction(
        card.id,
        stageOrder,
        performerName.trim() ? { performer_name: performerName.trim() } : {},
        card.sales_order_id,
      ),
    );
  };

  const onCompleteStage = () => {
    if (!completingStage) return;
    void runAction(() =>
      completeTechnicalCardStageAction(
        card.id,
        completingStage.stage_order,
        {
          performer_name: performerName.trim() || null,
          scrap_qty: scrapQty.trim() || null,
          rework_qty: reworkQty.trim() || null,
          notes: stageNotes.trim() || null,
        },
        card.sales_order_id,
      ),
    );
  };

  const onRollbackStage = (stageOrder: number) => {
    void runAction(() =>
      rollbackTechnicalCardStageAction(
        card.id,
        stageOrder,
        card.sales_order_id,
      ),
    );
  };

  return (
    <DocumentCard
      header={
        <EntityHeader
          eyebrow={
            <Link href={listHref} className="text-portal-primary hover:underline">
              Техкарты
            </Link>
          }
          title={`${card.number} · ${techCardPositionLabel(card)}`}
          description={techCardModelLabel(card)}
          status={
            <>
              <StatusBadge size="compact" tone={techCardStatusTone(status)}>
                {techCardStatusLabel(status)}
              </StatusBadge>
              {card.current_stage_label ? (
                <StatusBadge size="compact" tone="neutral">
                  {card.current_stage_label}
                </StatusBadge>
              ) : null}
            </>
          }
          meta={
            <>
              <span>
                Заказ:{" "}
                <EntityLink href={`/sales/orders/${card.sales_order_id}`}>
                  {techCardOrderLabel({
                    order_number: orderNumber,
                    sales_order_id: card.sales_order_id,
                  })}
                </EntityLink>
              </span>
              <span>Кол-во: {card.quantity}</span>
              <span>Создана: {formatTechCardDateTime(card.created_at)}</span>
              <span>Обновлена: {formatTechCardDateTime(card.updated_at)}</span>
            </>
          }
          actions={
            <div className="flex flex-wrap gap-portal-2">
              <Link
                href={listHref}
                className="portal-focus-ring inline-flex h-portal-control-default items-center justify-center gap-portal-2 rounded-portal-md border border-portal-border bg-portal-surface px-portal-4 text-portal-body font-medium text-portal-text hover:bg-portal-state-hover"
              >
                ← К списку
              </Link>
              <Link
                href={`/sales/orders/${card.sales_order_id}`}
                className="portal-focus-ring inline-flex h-portal-control-default items-center justify-center gap-portal-2 rounded-portal-md border border-portal-border bg-portal-surface px-portal-4 text-portal-body font-medium text-portal-text hover:bg-portal-state-hover"
              >
                Открыть заказ
              </Link>
              <Button type="button" variant="secondary" disabled={busy} onClick={onPrint}>
                <Printer className="size-4" aria-hidden="true" />
                Печать
              </Button>
              {canStartCard ? (
                <Button type="button" variant="primary" disabled={busy} onClick={() => void onStartCard()}>
                  <Play className="size-4" aria-hidden="true" />
                  Запустить ТК
                </Button>
              ) : null}
              {canStartActiveStage && activeStage ? (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => onStartStage(activeStage.stage_order)}
                >
                  <Play className="size-4" aria-hidden="true" />
                  Начать этап
                </Button>
              ) : null}
              {canCompleteActiveStage && activeStage ? (
                <Button
                  type="button"
                  variant="primary"
                  disabled={busy}
                  onClick={() => openCompleteForm(activeStage.stage_order)}
                >
                  <CheckCircle2 className="size-4" aria-hidden="true" />
                  Завершить этап
                </Button>
              ) : null}
              {canRollbackActiveStage && activeStage ? (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => onRollbackStage(activeStage.stage_order)}
                >
                  <RotateCcw className="size-4" aria-hidden="true" />
                  Откатить этап
                </Button>
              ) : null}
            </div>
          }
        />
      }
    >
      {actionError ? (
        <p
          className="rounded-portal-md border border-portal-danger/30 bg-portal-danger-soft px-portal-4 py-portal-2 text-portal-body text-portal-danger"
          role="alert"
        >
          {actionError}
        </p>
      ) : null}

      {completeOpen && completingStage ? (
        <SectionCard
          title={`Завершение этапа ${completingStage.stage_order}: ${completingStage.stage_label}`}
          size="compact"
        >
          <div className="grid gap-portal-4 min-[900px]:grid-cols-2">
            <Field label="Исполнитель">
              <Input
                value={performerName}
                onChange={(event) => setPerformerName(event.target.value)}
                disabled={busy}
              />
            </Field>
            <Field label="Брак, шт">
              <Input
                value={scrapQty}
                onChange={(event) => setScrapQty(event.target.value)}
                disabled={busy}
                inputMode="decimal"
              />
            </Field>
            <Field label="Доработка, шт">
              <Input
                value={reworkQty}
                onChange={(event) => setReworkQty(event.target.value)}
                disabled={busy}
                inputMode="decimal"
              />
            </Field>
            <Field label="Примечание" className="min-[900px]:col-span-2">
              <Textarea
                value={stageNotes}
                onChange={(event) => setStageNotes(event.target.value)}
                disabled={busy}
                rows={3}
              />
            </Field>
          </div>
          <div className="mt-portal-4 flex flex-wrap gap-portal-2">
            <Button type="button" variant="primary" disabled={busy} onClick={onCompleteStage}>
              {busy ? "Сохранение…" : "Подтвердить завершение"}
            </Button>
            <Button
              type="button"
              disabled={busy}
              onClick={() => setCompleteOpen(false)}
            >
              Отмена
            </Button>
          </div>
        </SectionCard>
      ) : null}

      <SectionCard
        title="Состав"
        description="Материалы и лекала по спецификации / модели."
        size="compact"
      >
        {compositionLines.length === 0 ? (
          <EmptyState title="Состав пуст" description="Строки состава не заполнены." />
        ) : (
          <DataTableFrame>
            <DataTable minWidthClassName="min-w-[720px]">
              <DataTableHead>
                <tr>
                  <DataTableHeaderCell className="w-12">#</DataTableHeaderCell>
                  <DataTableHeaderCell className="w-28">Тип</DataTableHeaderCell>
                  <DataTableHeaderCell>Наименование</DataTableHeaderCell>
                  <DataTableHeaderCell className="w-24">Кол-во</DataTableHeaderCell>
                  <DataTableHeaderCell className="w-20">Ед.</DataTableHeaderCell>
                </tr>
              </DataTableHead>
              <DataTableBody>
                {compositionLines.map((line) => (
                  <DataTableRow key={line.id}>
                    <DataTableCell>{line.sequence}</DataTableCell>
                    <DataTableCell>{compositionLineKindLabel(String(line.line_kind))}</DataTableCell>
                    <DataTableCell>{line.snapshot_name}</DataTableCell>
                    <DataTableCell className="tabular-nums">{line.quantity ?? "—"}</DataTableCell>
                    <DataTableCell>{line.unit ?? "—"}</DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          </DataTableFrame>
        )}

        <dl className="mt-portal-4 grid gap-portal-3 sm:grid-cols-2">
          <div>
            <dt className="text-portal-caption text-portal-muted">Модель</dt>
            <dd className="mt-1 text-portal-body">{techCardModelLabel(card)}</dd>
          </div>
          <div>
            <dt className="text-portal-caption text-portal-muted">Вариант сборки</dt>
            <dd className="mt-1 text-portal-body">{card.assembly_variant_name ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-portal-caption text-portal-muted">Спецификация</dt>
            <dd className="mt-1 text-portal-body">
              {card.specification_version_label ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-portal-caption text-portal-muted">Маршрут</dt>
            <dd className="mt-1 text-portal-body">{card.routing_template_name ?? "—"}</dd>
          </div>
        </dl>
      </SectionCard>

      <SectionCard title="Поштучно" description="Размеры и персонализация по единицам." size="compact">
        {unitLines.length === 0 ? (
          <EmptyState title="Строки не заполнены" description="Поштучные данные отсутствуют." />
        ) : (
          <DataTableFrame>
            <DataTable minWidthClassName="min-w-[880px]">
              <DataTableHead>
                <tr>
                  <DataTableHeaderCell className="w-12">#</DataTableHeaderCell>
                  <DataTableHeaderCell className="w-24">Размер</DataTableHeaderCell>
                  <DataTableHeaderCell>Персонализация</DataTableHeaderCell>
                  <DataTableHeaderCell className="w-24">Номер</DataTableHeaderCell>
                  <DataTableHeaderCell className="w-28">Цвет</DataTableHeaderCell>
                  <DataTableHeaderCell>Примечание</DataTableHeaderCell>
                </tr>
              </DataTableHead>
              <DataTableBody>
                {unitLines.map((line) => (
                  <DataTableRow key={line.id}>
                    <DataTableCell>{line.unit_index}</DataTableCell>
                    <DataTableCell>{line.size ?? "—"}</DataTableCell>
                    <DataTableCell>{line.personalization ?? "—"}</DataTableCell>
                    <DataTableCell>{line.print_number ?? "—"}</DataTableCell>
                    <DataTableCell>{line.color ?? "—"}</DataTableCell>
                    <DataTableCell className="text-portal-muted">{line.notes ?? "—"}</DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          </DataTableFrame>
        )}
      </SectionCard>

      <SectionCard title="Операции / объёмы" description="Техоперации и объёмы по этапам." size="compact">
        {operationLines.length === 0 ? (
          <EmptyState title="Операции не заданы" description="Строки операций отсутствуют." />
        ) : (
          <DataTableFrame>
            <DataTable minWidthClassName="min-w-[760px]">
              <DataTableHead>
                <tr>
                  <DataTableHeaderCell className="w-12">#</DataTableHeaderCell>
                  <DataTableHeaderCell>Операция</DataTableHeaderCell>
                  <DataTableHeaderCell className="w-28">Объём</DataTableHeaderCell>
                  <DataTableHeaderCell className="w-20">Ед.</DataTableHeaderCell>
                  <DataTableHeaderCell className="w-16">Этап</DataTableHeaderCell>
                  <DataTableHeaderCell className="w-36">Участок</DataTableHeaderCell>
                </tr>
              </DataTableHead>
              <DataTableBody>
                {operationLines.map((line) => (
                  <DataTableRow key={line.id}>
                    <DataTableCell>{line.sequence}</DataTableCell>
                    <DataTableCell>{line.operation_name}</DataTableCell>
                    <DataTableCell className="tabular-nums">{line.volume}</DataTableCell>
                    <DataTableCell>{formatVolumeUnit(String(line.volume_unit))}</DataTableCell>
                    <DataTableCell>{line.stage_order ?? "—"}</DataTableCell>
                    <DataTableCell className="text-portal-muted">
                      {line.stage_label ?? "—"}
                    </DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          </DataTableFrame>
        )}
      </SectionCard>

      <SectionCard title="Маршрут / участки" description="Ход выполнения по этапам маршрута." size="compact">
        {stageResults.length === 0 ? (
          <EmptyState
            title="Маршрут не назначен"
            description="Назначьте маршрут при формировании техкарты."
          />
        ) : (
          <div className="space-y-portal-3">
            {stageResults.map((stage) => (
              <StageTimelineRow
                key={stage.id}
                stage={stage}
                isCurrent={stage.stage_order === card.current_stage_order}
                busy={busy}
                onStart={() => onStartStage(stage.stage_order)}
                onComplete={() => openCompleteForm(stage.stage_order)}
                onRollback={() => onRollbackStage(stage.stage_order)}
              />
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="История" description="Журнал событий по техкарте." size="compact">
        <EmptyState
          title="События появятся позже"
          description="API журнала активности для техкарт пока не подключён."
        />
      </SectionCard>
    </DocumentCard>
  );
}

function StageTimelineRow({
  stage,
  isCurrent,
  busy,
  onStart,
  onComplete,
  onRollback,
}: {
  stage: ApiTechnicalCardStageResult;
  isCurrent: boolean;
  busy: boolean;
  onStart: () => void;
  onComplete: () => void;
  onRollback: () => void;
}) {
  const status = String(stage.status);
  const canStart = status === "pending";
  const canComplete = status === "pending" || status === "in_progress";
  const canRollback = status === "completed";

  return (
    <article
      className={[
        "rounded-portal-md border px-portal-4 py-portal-3",
        isCurrent ? "border-portal-primary/40 bg-portal-primary-soft/20" : "border-portal-border",
      ].join(" ")}
    >
      <div className="flex flex-wrap items-start justify-between gap-portal-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-portal-2">
            <span className="font-semibold text-portal-text">
              {stage.stage_order}. {stage.stage_label}
            </span>
            <StatusBadge size="compact" tone={stageTone(status)}>
              {stageResultStatusLabel(status)}
            </StatusBadge>
            {isCurrent ? (
              <StatusBadge size="compact" tone="primary">
                Текущий
              </StatusBadge>
            ) : null}
          </div>
          <dl className="mt-portal-2 grid gap-portal-1 text-portal-caption text-portal-muted sm:grid-cols-2">
            <div>
              Исполнитель: {stage.performer_name ?? "—"}
            </div>
            <div>
              Начало: {formatTechCardDateTime(stage.started_at)}
            </div>
            <div>
              Завершение: {formatTechCardDateTime(stage.completed_at)}
            </div>
            <div>
              Брак / доработка: {stage.scrap_qty ?? "—"} / {stage.rework_qty ?? "—"}
            </div>
          </dl>
          {stage.notes ? (
            <p className="mt-portal-2 text-portal-body text-portal-muted">{stage.notes}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-portal-2">
          {canStart ? (
            <Button type="button" size="compact" disabled={busy} onClick={onStart}>
              Начать
            </Button>
          ) : null}
          {canComplete ? (
            <Button type="button" size="compact" variant="primary" disabled={busy} onClick={onComplete}>
              Завершить
            </Button>
          ) : null}
          {canRollback ? (
            <Button type="button" size="compact" disabled={busy} onClick={onRollback}>
              Откатить
            </Button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
