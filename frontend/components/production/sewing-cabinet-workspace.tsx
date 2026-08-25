"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  completeSewingWorkAction,
  releaseSewingWorkAction,
  takeSewingWorkAction,
} from "@/app/(workspace)/production/sewing-cabinet/sewing-cabinet-actions";
import { PageContent, PageLayout } from "@/components/layout/page-layout";
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
import { Input } from "@/components/ui/form-controls";
import { InlineAlert } from "@/components/ui/inline-alert";
import { PageToolbar } from "@/components/ui/page-header";
import { MetricCard, SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatAmountWithCurrency } from "@/lib/money";
import {
  sewingQueueCardTitle,
  sewingWorkKindLabel,
  sewingWorkStatusLabel,
  type SewingCabinet,
  type SewingPeriodPreset,
  type SewingQueueCard,
  type SewingWorkEntry,
} from "@/lib/production/sewing-cabinet";
import { userInitials } from "@/lib/platform-users";

const PERIODS: { value: SewingPeriodPreset; label: string }[] = [
  { value: "day", label: "День" },
  { value: "week", label: "Неделя" },
  { value: "month", label: "Месяц" },
  { value: "custom", label: "Период" },
];

function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusTone(status: SewingWorkEntry["status"]) {
  if (status === "completed") return "success" as const;
  if (status === "released") return "neutral" as const;
  return "warning" as const;
}

export function SewingCabinetWorkspace({
  cabinet,
  loadError,
  basePath,
  period,
  dateFrom,
  dateTo,
}: {
  cabinet: SewingCabinet | null;
  loadError?: string;
  basePath: string;
  period: SewingPeriodPreset;
  dateFrom?: string;
  dateTo?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [customFrom, setCustomFrom] = useState(dateFrom ?? "");
  const [customTo, setCustomTo] = useState(dateTo ?? "");

  function periodHref(next: SewingPeriodPreset) {
    const params = new URLSearchParams();
    params.set("period", next);
    if (next === "custom" && customFrom && customTo) {
      params.set("date_from", customFrom);
      params.set("date_to", customTo);
    }
    return `${basePath}?${params.toString()}`;
  }

  function runAction(task: () => Promise<{ ok: boolean; message: string | null }>) {
    startTransition(async () => {
      const result = await task();
      if (!result.ok) {
        setMessage(result.message ?? "Не удалось выполнить действие");
        return;
      }
      setMessage(null);
      router.refresh();
    });
  }

  return (
    <PageLayout className="flex min-h-0 flex-1 flex-col">
      <PageToolbar
        start={
          <p className="text-portal-body font-semibold text-portal-text">
            {cabinet ? cabinet.profile.display_name : "Кабинет швеи"}
          </p>
        }
        end={
          cabinet?.can_manage ? (
            <Link
              href="/production/sewing-cabinet/sewers"
              className="inline-flex h-portal-control-compact items-center rounded-portal-sm border border-portal-border bg-portal-surface px-portal-3 text-portal-caption font-medium text-portal-text"
            >
              Кабинеты швей
            </Link>
          ) : null
        }
      />
      {loadError ? (
        <InlineAlert
          className="rounded-none border-x-0 border-t-0 border-b"
          tone="danger"
          size="compact"
        >
          {loadError}
        </InlineAlert>
      ) : null}
      {message ? (
        <InlineAlert
          className="rounded-none border-x-0 border-t-0 border-b"
          tone="danger"
          size="compact"
        >
          {message}
        </InlineAlert>
      ) : null}

      <PageContent className="flex min-h-0 flex-1 flex-col gap-portal-4">
        {!cabinet ? (
          <EmptyState
            title="Кабинет недоступен"
            description={loadError ?? "Нет данных кабинета."}
          />
        ) : (
          <>
            <SectionCard title="Профиль" size="compact">
              <div className="flex min-w-0 items-center gap-portal-3">
                <div className="flex size-12 items-center justify-center rounded-portal-md bg-portal-primary-soft text-portal-body font-semibold text-portal-primary">
                  {userInitials(cabinet.profile.display_name)}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-portal-text">
                    {cabinet.profile.display_name}
                  </p>
                  <p className="text-portal-caption text-portal-muted">
                    @{cabinet.profile.login}
                  </p>
                  <p className="text-portal-caption text-portal-muted">
                    Фото профиля появится из кабинета пользователя (Stage 21).
                  </p>
                </div>
              </div>
            </SectionCard>

            <div className="flex min-w-0 flex-wrap gap-portal-2">
              {PERIODS.map((item) => (
                <Link
                  key={item.value}
                  href={periodHref(item.value)}
                  className={`rounded-portal-full px-portal-3 py-1 text-portal-caption font-medium ring-1 ${
                    period === item.value
                      ? "bg-portal-primary-soft text-portal-primary ring-portal-primary/20"
                      : "bg-portal-surface text-portal-muted ring-portal-border"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
            {period === "custom" ? (
              <form
                className="flex min-w-0 flex-wrap items-end gap-portal-2"
                action={periodHref("custom")}
              >
                <label className="text-portal-caption text-portal-muted">
                  С
                  <Input
                    type="date"
                    value={customFrom}
                    onChange={(event) => setCustomFrom(event.target.value)}
                    className="mt-1"
                  />
                </label>
                <label className="text-portal-caption text-portal-muted">
                  По
                  <Input
                    type="date"
                    value={customTo}
                    onChange={(event) => setCustomTo(event.target.value)}
                    className="mt-1"
                  />
                </label>
                <Link
                  href={`${basePath}?period=custom&date_from=${customFrom}&date_to=${customTo}`}
                  className="inline-flex h-portal-control-compact items-center rounded-portal-sm bg-portal-primary px-portal-3 text-portal-caption font-medium text-portal-primary-on"
                >
                  Показать
                </Link>
              </form>
            ) : null}

            <MetricCard
              label="Заработок за период"
              value={formatAmountWithCurrency(cabinet.earnings_completed)}
              detail="Σ qty × снимок цены по отшитым строкам"
              tone="success"
            />

            <SectionCard title="Сейчас в работе" size="compact">
              {cabinet.reserved.length === 0 ? (
                <EmptyState
                  size="compact"
                  title="Нет резерва"
                  description="Возьмите штуки или операции из очереди пошива."
                />
              ) : (
                <EntryTable
                  rows={cabinet.reserved}
                  canWrite={cabinet.can_write}
                  pending={pending}
                  onComplete={(id) =>
                    runAction(() => completeSewingWorkAction(id))
                  }
                  onRelease={(id) => runAction(() => releaseSewingWorkAction(id))}
                />
              )}
            </SectionCard>

            {cabinet.queue ? (
              <SectionCard title="Очередь пошива" size="compact">
                {cabinet.queue.length === 0 ? (
                  <EmptyState
                    size="compact"
                    title="Нет техкарт на пошиве"
                    description="В очередь попадают ТК, у которых текущий шаг маршрута — Пошив."
                  />
                ) : (
                  <div className="flex flex-col gap-portal-3">
                    {cabinet.queue.map((card) => (
                      <QueueCard
                        key={card.technical_card_id}
                        card={card}
                        canWrite={cabinet.can_write}
                        pending={pending}
                        onTake={(kind, qty, operationLineId) =>
                          runAction(() =>
                            takeSewingWorkAction({
                              technical_card_id: card.technical_card_id,
                              kind,
                              qty,
                              operation_line_id: operationLineId,
                            }),
                          )
                        }
                      />
                    ))}
                  </div>
                )}
              </SectionCard>
            ) : null}

            <SectionCard title="История" size="compact">
              {cabinet.history.length === 0 ? (
                <EmptyState
                  size="compact"
                  title="Пустая история"
                  description="Отшитые и отказные строки выбранного периода появятся здесь."
                />
              ) : (
                <EntryTable rows={cabinet.history} canWrite={false} pending={pending} />
              )}
            </SectionCard>
          </>
        )}
      </PageContent>
    </PageLayout>
  );
}

function EntryTable({
  rows,
  canWrite,
  pending,
  onComplete,
  onRelease,
}: {
  rows: SewingWorkEntry[];
  canWrite: boolean;
  pending: boolean;
  onComplete?: (id: number) => void;
  onRelease?: (id: number) => void;
}) {
  return (
    <DataTableFrame>
      <DataTable>
        <DataTableHead>
          <DataTableRow>
            <DataTableHeaderCell>ТК</DataTableHeaderCell>
            <DataTableHeaderCell>Вид</DataTableHeaderCell>
            <DataTableHeaderCell>Подпись</DataTableHeaderCell>
            <DataTableHeaderCell>Кол-во</DataTableHeaderCell>
            <DataTableHeaderCell>Снимок</DataTableHeaderCell>
            <DataTableHeaderCell>Статус</DataTableHeaderCell>
            <DataTableHeaderCell>Когда</DataTableHeaderCell>
            {canWrite ? <DataTableHeaderCell>Действия</DataTableHeaderCell> : null}
          </DataTableRow>
        </DataTableHead>
        <DataTableBody>
          {rows.map((row) => (
            <DataTableRow key={row.id}>
              <DataTableCell>{row.technical_card_number}</DataTableCell>
              <DataTableCell>{sewingWorkKindLabel(row.kind)}</DataTableCell>
              <DataTableCell>{row.price_label}</DataTableCell>
              <DataTableCell>{row.qty}</DataTableCell>
              <DataTableCell>
                {formatAmountWithCurrency(row.unit_price)}
              </DataTableCell>
              <DataTableCell>
                <StatusBadge tone={statusTone(row.status)} size="compact">
                  {sewingWorkStatusLabel(row.status)}
                </StatusBadge>
              </DataTableCell>
              <DataTableCell>
                {formatWhen(row.completed_at ?? row.released_at ?? row.taken_at)}
              </DataTableCell>
              {canWrite ? (
                <DataTableCell>
                  <div className="flex flex-wrap gap-portal-1">
                    <Button
                      size="compact"
                      disabled={pending}
                      onClick={() => onComplete?.(row.id)}
                    >
                      Отшить
                    </Button>
                    <Button
                      size="compact"
                      variant="secondary"
                      disabled={pending}
                      onClick={() => onRelease?.(row.id)}
                    >
                      Отказаться
                    </Button>
                  </div>
                </DataTableCell>
              ) : null}
            </DataTableRow>
          ))}
        </DataTableBody>
      </DataTable>
    </DataTableFrame>
  );
}

function QueueCard({
  card,
  canWrite,
  pending,
  onTake,
}: {
  card: SewingQueueCard;
  canWrite: boolean;
  pending: boolean;
  onTake: (
    kind: "piece" | "operation",
    qty: string,
    operationLineId?: number,
  ) => void;
}) {
  const [pieceQty, setPieceQty] = useState("1");
  const [opQty, setOpQty] = useState<Record<number, string>>({});
  return (
    <article className="rounded-portal-md border border-portal-border p-portal-3">
      <p className="font-semibold text-portal-text">{sewingQueueCardTitle(card)}</p>
      <p className="text-portal-caption text-portal-muted">{card.number}</p>
      <div className="mt-portal-3 flex min-w-0 flex-wrap items-end gap-portal-2">
        <p className="text-portal-body text-portal-text">
          Штуки: остаток {card.piece_remaining} из {card.piece_cap}
          {card.piece_unit_price
            ? ` · ${formatAmountWithCurrency(card.piece_unit_price)}`
            : " · нет цены варианта"}
        </p>
        {canWrite ? (
          <>
            <Input
              type="number"
              min="1"
              step="1"
              value={pieceQty}
              onChange={(event) => setPieceQty(event.target.value)}
              aria-label={`Количество штук ${card.number}`}
              className="w-24"
            />
            <Button
              size="compact"
              disabled={pending || !card.piece_unit_price}
              onClick={() => onTake("piece", pieceQty)}
            >
              Взять штуки
            </Button>
          </>
        ) : null}
      </div>
      {card.operations.length === 0 ? (
        <p className="mt-portal-2 text-portal-caption text-portal-muted">
          Нет операций пошива на техкарте.
        </p>
      ) : (
        <ul className="mt-portal-2 flex flex-col gap-portal-2">
          {card.operations.map((operation) => (
            <li
              key={operation.operation_line_id}
              className="flex min-w-0 flex-wrap items-end gap-portal-2"
            >
              <p className="min-w-0 flex-1 text-portal-body text-portal-text">
                {operation.operation_name}: остаток {operation.remaining} из{" "}
                {operation.volume}
                {operation.unit_price
                  ? ` · ${formatAmountWithCurrency(operation.unit_price)}`
                  : ""}
              </p>
              {canWrite ? (
                <>
                  <Input
                    type="number"
                    min="0.001"
                    step="0.001"
                    value={opQty[operation.operation_line_id] ?? "1"}
                    onChange={(event) =>
                      setOpQty((current) => ({
                        ...current,
                        [operation.operation_line_id]: event.target.value,
                      }))
                    }
                    aria-label={`Количество ${operation.operation_name}`}
                    className="w-24"
                  />
                  <Button
                    size="compact"
                    disabled={pending || operation.unit_price == null}
                    onClick={() =>
                      onTake(
                        "operation",
                        opQty[operation.operation_line_id] ?? "1",
                        operation.operation_line_id,
                      )
                    }
                  >
                    Взять операцию
                  </Button>
                </>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
