"use client";

import { CalendarClock, ExternalLink, Lock, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { PageContent } from "@/components/layout/page-layout";
import { CalendarToolbar } from "@/components/production/calendar-toolbar";
import { TechnicalCardFullCardModal } from "@/components/production/technical-card-full-card-modal";
import { Button, IconButton } from "@/components/ui/button";
import { calendarWeekPath } from "@/lib/production/calendar";
import {
  FACT_STEP_LABEL, ManualReplanRequestError, REPLAN_DOWNSTREAM_HINT,
  canApplyReplan, formatPlanDate, planningQuantityLabel, postManualReplan, readReplanPreview,
  replanApplyBody, replanDownstreamLines, replanPreviewBody, replanRiskLabel, replanSelectedLine, replanSlackLabel,
  type ReplanMode, type ReplanPreview,
} from "@/lib/production/manual-planning";
import {
  fetchManualPlanningCards, fetchPlanningHealth, filterPlanningHealth, healthDayLabel, operationHealthStatus,
  operationPlanLabel, operationWarningLabel, planningAttentionLine, planningHealthBadge, planningHealthCounts, planningHealthEmpty,
  planningProgressText, planningScheduleText, planningWorkshopOptions,
  type ManualPlanningCardHealth, type OperationPlanningHealth, type PlanningHealth, type PlanningHealthBadge,
  type PlanningHealthFilters, type PlanningListIdentity,
} from "@/lib/production/planning-health";

const inputClass = "w-full min-w-0 rounded-portal-md border border-portal-border bg-portal-surface px-portal-3 py-portal-2 text-portal-body";
function dateLabel(date: string): string {
  const [year, month, day] = date.split("-");
  return day && month && year ? `${day}.${month}.${year}` : date;
}

const badgeClass: Record<PlanningHealthBadge["tone"], string> = {
  danger: "bg-portal-danger-soft text-portal-danger",
  risk: "bg-portal-warning-soft text-portal-warning",
  replan: "border border-portal-warning text-portal-warning",
  ok: "bg-portal-success-soft text-portal-success",
  neutral: "bg-portal-surface-secondary text-portal-muted",
};

function HealthBadge({ summary, surface }: { summary: ManualPlanningCardHealth | PlanningHealth; surface: "list" | "card" }) {
  const badge = planningHealthBadge(summary, surface);
  return (
    <span data-planning-badge={badge.tone} className={`inline-block max-w-full break-words rounded-portal-md px-2 py-0.5 text-portal-caption font-semibold ${badgeClass[badge.tone]}`}>
      {badge.label}
    </span>
  );
}

export function CalendarManualScheduling({ date, invalidAssignment = false }: {
  date: string;
  invalidAssignment?: boolean;
}) {
  const router = useRouter();
  const [revision, setRevision] = useState(0);
  const [notice, setNotice] = useState("");
  const [focusCardId, setFocusCardId] = useState<number | null>(null);
  return (
    <PageContent size="compact" width="full">
      <div className="space-y-portal-3">
        <CalendarToolbar current="/production/calendar/planning" />
        <header className="flex flex-wrap items-center justify-between gap-portal-3">
          <div>
            <h1 className="text-portal-title font-semibold">Ручное планирование</h1>
            <p className="text-portal-caption text-portal-muted">Какие техкарты требуют внимания и какую операцию можно перенести</p>
          </div>
          <Link href={calendarWeekPath(date)} className="text-portal-caption font-medium text-portal-primary underline">Вернуться в очередь</Link>
        </header>
        {notice ? <p role="status" className="text-portal-primary">{notice}</p> : null}
        {invalidAssignment ? (
          <p role="alert" className="text-portal-danger">Некорректный номер назначения. Откройте техкарту из списка.</p>
        ) : (
          <PlanningDesk key={revision} focusCardId={focusCardId} onRetry={() => setRevision((value) => value + 1)} onMoved={(cardId) => { setNotice("План обновлён"); setFocusCardId(cardId); setRevision((value) => value + 1); router.refresh(); }} />
        )}
      </div>
    </PageContent>
  );
}

function PlanningDesk({ focusCardId, onRetry, onMoved }: {
  focusCardId: number | null;
  onRetry: () => void;
  onMoved: (cardId: number) => void;
}) {
  const [cards, setCards] = useState<ManualPlanningCardHealth[] | null>(null);
  const [identities, setIdentities] = useState<Map<number, PlanningListIdentity>>(new Map());
  const [error, setError] = useState("");
  const [filters, setFilters] = useState<PlanningHealthFilters>({ search: "", stageId: null, attention: "all", shippingDate: "" });
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [opened, setOpened] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetchManualPlanningCards(controller.signal)
      .then(async (loaded) => {
        if (controller.signal.aborted) return;
        const loadedIdentities = await loadPlanningIdentities(loaded.map((card) => card.technical_card_id), controller.signal);
        if (controller.signal.aborted) return;
        setCards(loaded);
        setIdentities(loadedIdentities);
      })
      .catch((failure: unknown) => {
        if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Не удалось загрузить план");
      });
    return () => controller.abort();
  }, []);

  const visible = useMemo(() => filterPlanningHealth(cards ?? [], identities, filters), [cards, identities, filters]);
  const selected = cards?.find((card) => card.technical_card_id === selectedId) ?? null;
  const workshops = useMemo(() => planningWorkshopOptions(cards ?? []), [cards]);
  const counts = planningHealthCounts(cards ?? []);

  if (cards && !opened) {
    setOpened(true);
    if (focusCardId != null && cards.some((card) => card.technical_card_id === focusCardId)) setSelectedId(focusCardId);
  }

  if (error) return <div role="alert" className="text-portal-danger">{error} <Button onClick={onRetry}>Повторить</Button></div>;
  if (!cards) return <p role="status">Загрузка техкарт…</p>;
  return (
    <div className="flex min-w-0 flex-col gap-portal-3">
      <div className={selected ? "max-lg:hidden" : ""}>
        <PlanningFiltersBar workshops={workshops} filters={filters} counts={counts} total={cards.length} onChange={setFilters} />
      </div>
      <div className="grid min-w-0 items-start gap-portal-3 lg:grid-cols-[minmax(22rem,42%)_minmax(0,1fr)] lg:items-stretch">
        <section className={`${selected ? "max-lg:hidden" : ""} min-w-0 lg:max-h-[calc(100dvh-13rem)] lg:overflow-y-auto lg:pr-1`} aria-label="Техкарты">
          {!visible.length ? <p data-planning-empty className="rounded-portal-md border border-dashed border-portal-border px-portal-3 py-portal-4 text-portal-body text-portal-muted">{planningHealthEmpty(filters.attention)}</p> : (
            <ul className="flex flex-col gap-portal-2">
              {visible.map((card) => {
                const identity = identities.get(card.technical_card_id);
                const reason = planningAttentionLine(card, "list");
                return (
                  <li key={card.technical_card_id}>
                    <button type="button" data-planning-card={card.technical_card_id} aria-current={card.technical_card_id === selectedId ? "true" : undefined}
                      className={`block w-full min-w-0 rounded-portal-md border px-portal-3 py-portal-3 text-left ${card.technical_card_id === selectedId ? "border-portal-primary bg-portal-primary-soft" : "border-portal-border bg-portal-surface hover:bg-portal-surface-secondary"}`}
                      onClick={() => setSelectedId(card.technical_card_id)}>
                      <span className="flex items-start justify-between gap-2">
                        <span className="min-w-0">
                          <span className="text-portal-body font-semibold">{card.number}</span>
                          <span className="mt-0.5 block text-portal-caption text-portal-muted">{identity?.orderNumber?.trim() || "—"}</span>
                        </span>
                        <HealthBadge summary={card} surface="list" />
                      </span>
                      <span className="mt-1 block text-portal-caption">{identity?.model?.trim() || "—"} · {identity?.quantity ? planningQuantityLabel(identity.quantity) : "—"}</span>
                      <span className="mt-1 block text-portal-caption text-portal-muted">{card.current_workshop_name?.trim() || "Участок не назначен"} · {planningProgressText(card)}</span>
                      <span className="mt-1 block text-portal-caption text-portal-muted">{planningScheduleText(card)}</span>
                      {reason ? <span className="mt-1 block text-portal-caption text-portal-text" data-planning-earliest>{reason}</span> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        <section className={`${!selected ? "max-lg:hidden" : ""} min-w-0 rounded-portal-md border border-portal-border bg-portal-surface p-portal-3 lg:max-h-[calc(100dvh-13rem)] lg:overflow-y-auto`} aria-label="Маршрут техкарты">
          {selected ? (
            <CardPlan card={selected} identity={identities.get(selected.technical_card_id) ?? null} onBack={() => setSelectedId(null)} onMoved={onMoved} />
          ) : <p className="text-portal-body text-portal-muted">Выберите техкарту слева, чтобы увидеть маршрут и изменить будущие операции.</p>}
        </section>
      </div>
    </div>
  );
}

function routeStatusClass(status: string): string {
  if (status === "completed" || status === "skipped") return "text-portal-caption text-portal-muted";
  if (status === "in_progress") return "text-portal-caption font-semibold text-portal-primary";
  return "text-portal-caption text-portal-text";
}

function PlanningFiltersBar({ workshops, filters, counts, total, onChange }: {
  workshops: { id: number; name: string }[];
  filters: PlanningHealthFilters;
  counts: { overdue: number; risk: number; replan: number };
  total: number;
  onChange: (next: PlanningHealthFilters) => void;
}) {
  const attention = [
    ["all", "Все", total],
    ["overdue", "Просроченные", counts.overdue],
    ["risk", "В риске", counts.risk],
    ["replan", "Требуют перепланирования", counts.replan],
    ["clear", "Без проблем", null],
  ] as const;
  return (
    <div className="sticky top-0 z-10 space-y-portal-2 bg-portal-page py-1">
      <div data-planning-counts className="flex flex-wrap items-center gap-1" aria-label="Состояние плана">
        {attention.map(([value, label, count]) => (
          <button key={value} type="button" aria-pressed={filters.attention === value}
            className={`rounded-portal-md px-2 py-1 text-portal-caption ${filters.attention === value ? "bg-portal-primary text-portal-primary-on" : "bg-portal-surface-secondary text-portal-text"}`}
            onClick={() => onChange({ ...filters, attention: value })}>
            {label}{count == null ? "" : ` ${count}`}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-portal-2 lg:grid-cols-3">
      <label className="min-w-0 text-portal-caption font-semibold text-portal-muted">Поиск
        <input className={inputClass} value={filters.search} onChange={(event) => onChange({ ...filters, search: event.target.value })} />
      </label>
      <label className="min-w-0 text-portal-caption font-semibold text-portal-muted">Участок
        <select className={inputClass} value={filters.stageId ?? ""} onChange={(event) => onChange({ ...filters, stageId: event.target.value ? Number(event.target.value) : null })}>
          <option value="">Все участки</option>
          {workshops.map((stage) => <option key={stage.id} value={stage.id}>{stage.name}</option>)}
        </select>
      </label>
      <label className="col-span-2 min-w-0 text-portal-caption font-semibold text-portal-muted lg:col-span-1">Дата отгрузки
        <input type="date" className={inputClass} value={filters.shippingDate} onChange={(event) => onChange({ ...filters, shippingDate: event.target.value })} />
      </label>
      </div>
    </div>
  );
}

function CardPlan({ card, identity, onBack, onMoved }: {
  card: ManualPlanningCardHealth;
  identity: PlanningListIdentity | null;
  onBack: () => void;
  onMoved: (cardId: number) => void;
}) {
  const [health, setHealth] = useState<PlanningHealth | null>(null);
  const [detailError, setDetailError] = useState("");
  const [operationId, setOperationId] = useState<number | null>(null);
  const [cardOpen, setCardOpen] = useState(false);
  const [seenCardId, setSeenCardId] = useState(card.technical_card_id);
  if (seenCardId !== card.technical_card_id) {
    setSeenCardId(card.technical_card_id);
    setHealth(null);
    setDetailError("");
    setOperationId(null);
  }
  useEffect(() => {
    const controller = new AbortController();
    fetchPlanningHealth(card.technical_card_id, controller.signal)
      .then((loaded) => { if (!controller.signal.aborted) setHealth(loaded); })
      .catch((failure: unknown) => {
        if (!controller.signal.aborted) setDetailError(failure instanceof Error ? failure.message : "Не удалось открыть техкарту");
      });
    return () => controller.abort();
  }, [card.technical_card_id]);
  const summary = health ?? card;
  const route = health?.operations ?? [];
  const operation = route.find((item) => item.snapshot_node_id === operationId) ?? null;
  return (
    <div className="space-y-portal-3">
      <button type="button" className="text-portal-body text-portal-primary underline lg:hidden" onClick={onBack}>← К списку</button>
      <div className="flex flex-wrap items-start justify-between gap-portal-2 break-words">
        <div>
          <h2 className="text-portal-subtitle font-semibold">{card.number}</h2>
          <p className="text-portal-caption text-portal-muted">{identity?.orderNumber?.trim() || "—"}</p>
          <p className="text-portal-body">{identity?.model?.trim() || "—"} · {identity?.quantity ? planningQuantityLabel(identity.quantity) : "—"} · {summary.current_workshop_name?.trim() || "Участок не назначен"}</p>
        </div>
        <div className="flex items-start gap-1">
          <HealthBadge summary={summary} surface="card" />
          <IconButton label="Открыть ТК" variant="secondary" onClick={() => setCardOpen(true)}>
            <ExternalLink className="size-4" aria-hidden="true" />
          </IconButton>
        </div>
      </div>
      <p data-planning-summary className="text-portal-caption text-portal-muted">{planningScheduleText(summary)} · {planningProgressText(summary)}</p>
      {planningAttentionLine(summary, "card") ? <p className="text-portal-body">{planningAttentionLine(summary, "card")}</p> : null}
      {detailError ? <p role="alert" className="text-portal-danger">{detailError}</p> : null}
      {!health && !detailError ? <p role="status">Открываем маршрут…</p> : null}
      {route.length ? (
        <ol data-planning-route className="flex flex-col gap-1">
          {route.map((step, index) => {
            const status = operationHealthStatus(step);
            const plan = operationPlanLabel(step);
            const done = step.operation_status === "completed" || step.operation_status === "skipped";
            const current = step.operation_status === "in_progress";
            const earlier = route.slice(0, index);
            const futureStarts = !done && !current && earlier.length > 0 && earlier.every((item) => item.operation_status === "completed" || item.operation_status === "skipped" || item.operation_status === "in_progress");
            const tone = done ? "border-portal-border bg-portal-surface-secondary text-portal-muted" : step.is_overdue ? "border-portal-danger bg-portal-danger-soft" : current ? "border-portal-primary bg-portal-primary-soft" : "border-portal-border bg-portal-surface";
            return (
              <li key={step.snapshot_node_id} className="min-w-0">
                {futureStarts && index > 0 ? <p className="mb-1 mt-2 text-portal-caption text-portal-muted">Дальше</p> : null}
                <div className={`flex items-center justify-between gap-portal-2 rounded-portal-md border px-portal-3 py-portal-2 ${tone}`}>
                  <div className="min-w-0">
                    <p className="break-words font-medium">{step.operation_name}{step.is_protected ? <Lock className="ml-1 inline size-3.5" aria-label="Защищена" /> : null}</p>
                    <p className="text-portal-caption text-portal-muted">{step.workshop_name}{plan ? ` · ${plan}` : ""}</p>
                    <p data-route-state={step.is_overdue ? "overdue" : step.operation_status} title={done || current ? FACT_STEP_LABEL : operationWarningLabel(step.warning_code) ?? undefined} className={routeStatusClass(step.operation_status)}>{status}{step.is_overdue ? ` · ${healthDayLabel(step.overdue_days)}` : ""}</p>
                  </div>
                  {step.can_replan ? (
                    <IconButton label="Изменить дату готовности" variant="ghost" className="shrink-0" onClick={() => setOperationId(step.snapshot_node_id)}>
                      <CalendarClock className="size-4" aria-hidden="true" />
                    </IconButton>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      ) : null}
      {operation ? (
        <PlanningMoveModal onClose={() => setOperationId(null)}>
          <MoveEditor key={operation.snapshot_node_id} operation={operation} cardId={card.technical_card_id} onCancel={() => setOperationId(null)} onMoved={() => onMoved(card.technical_card_id)} />
        </PlanningMoveModal>
      ) : null}
      {cardOpen ? <TechnicalCardFullCardModal cardId={card.technical_card_id} onClose={() => setCardOpen(false)} /> : null}
    </div>
  );
}

function PlanningMoveModal({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
    };
    window.addEventListener("keydown", onKeyDown, true);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = previous;
    };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-portal-modal-2 flex items-center justify-center p-portal-4">
      <button type="button" className="absolute inset-0 bg-[#101828]/40" aria-label="Закрыть перенос" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label="Перенос операции" data-planning-move-modal className="relative max-h-[90vh] w-full max-w-xl overflow-auto rounded-portal-lg border border-portal-border bg-portal-page p-portal-4 shadow-portal-overlay">
        <div className="mb-portal-2 flex justify-end">
          <IconButton label="Закрыть окно" variant="secondary" onClick={onClose}>
            <X className="size-4" aria-hidden="true" />
          </IconButton>
        </div>
        {children}
      </div>
    </div>
  );
}

function MoveEditor({ operation, cardId, onCancel, onMoved }: {
  operation: OperationPlanningHealth;
  cardId: number;
  onCancel: () => void;
  onMoved: () => void;
}) {
  const snapshotNodeId = operation.snapshot_node_id;
  const operationName = operation.operation_name;
  const [mode, setMode] = useState<ReplanMode>("single");
  const [nextDate, setNextDate] = useState(operation.planned_start ?? "");
  const [preview, setPreview] = useState<ReplanPreview | null>(null);
  const [busy, setBusy] = useState<null | "preview" | "apply">(null);
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const form = { snapshotNodeId: snapshotNodeId ?? 0, targetDate: nextDate, mode };
  const allowed = snapshotNodeId != null && busy == null && canApplyReplan(preview, form);
  const suggestDownstream = mode === "single" && ((preview?.blockers.length ?? 0) > 0 || errorCode === "manual_replan_dependency");
  function chooseMode(next: ReplanMode) {
    setMode(next);
    setPreview(null);
    setError("");
    setErrorCode(null);
  }
  async function loadPreview() {
    if (snapshotNodeId == null || busy != null || !/^\d{4}-\d{2}-\d{2}$/.test(nextDate)) return;
    setBusy("preview");
    setError("");
    setErrorCode(null);
    setPreview(null);
    try {
      const payload = await postManualReplan("preview", replanPreviewBody({
        technicalCardId: cardId,
        snapshotNodeId,
        targetDate: nextDate,
        mode,
      }));
      const parsed = readReplanPreview(payload);
      if (!parsed) {
        setError("Сервер вернул неполный предпросмотр.");
        return;
      }
      setPreview(parsed);
    } catch (failure) {
      if (failure instanceof ManualReplanRequestError) {
        setError(failure.message);
        setErrorCode(failure.code);
        if (failure.stale) setPreview(null);
      } else {
        setError(failure instanceof Error ? failure.message : "Не удалось получить предпросмотр");
      }
    } finally {
      setBusy(null);
    }
  }
  async function apply() {
    if (!allowed || !preview || snapshotNodeId == null || busy != null) return;
    setBusy("apply");
    setError("");
    setErrorCode(null);
    try {
      const payload = await postManualReplan("apply", replanApplyBody(preview, replanPreviewBody({
        technicalCardId: cardId,
        snapshotNodeId,
        targetDate: nextDate,
        mode,
      })));
      if (!readReplanPreview((payload as { preview?: unknown } | null)?.preview)) {
        setPreview(null);
        setError("Сервер не подтвердил сохранённый план. Повторите предпросмотр.");
        setBusy(null);
        return;
      }
      onMoved();
    } catch (failure) {
      if (failure instanceof ManualReplanRequestError) {
        setError(failure.message);
        setErrorCode(failure.code);
        if (failure.stale) setPreview(null);
      } else {
        setError(failure instanceof Error ? failure.message : "Не удалось перенести операцию");
      }
      setBusy(null);
    }
  }
  return (
    <form data-planning-editor className="min-w-0 space-y-portal-3" onSubmit={(event) => { event.preventDefault(); apply(); }}>
      <h3 className="font-semibold">Перенос операции</h3>
      <dl className="grid gap-portal-2 text-portal-body sm:grid-cols-2">
        <div><dt className="text-portal-caption text-portal-muted">Операция</dt><dd className="break-words">{operationName}</dd></div>
        <div><dt className="text-portal-caption text-portal-muted">Участок</dt><dd className="break-words">{operation.workshop_name}</dd></div>
        <div><dt className="text-portal-caption text-portal-muted">Текущая дата</dt><dd>{operation.planned_start ? dateLabel(operation.planned_start) : "—"}</dd></div>
        <label>Новая дата
          <input type="date" required className={inputClass} value={nextDate} onChange={(event) => { setNextDate(event.target.value); setPreview(null); }} />
        </label>
      </dl>
      <fieldset data-planning-replan-mode className="grid gap-portal-2 text-portal-body">
        <legend className="text-portal-caption font-semibold text-portal-muted">Режим</legend>
        <label className="flex items-center gap-2"><input type="radio" name="replan-mode" checked={mode === "single"} onChange={() => chooseMode("single")} /> Только эту операцию</label>
        <label className="flex items-center gap-2"><input type="radio" name="replan-mode" checked={mode === "downstream"} onChange={() => chooseMode("downstream")} /> Эту и последующие</label>
      </fieldset>
      {snapshotNodeId == null ? <p role="alert" className="text-portal-danger">У операции нет узла маршрута, перенос недоступен.</p> : null}
      {preview ? (
        <div data-planning-preview className="min-w-0 space-y-portal-2 rounded-portal-md bg-portal-surface p-portal-3 text-portal-body">
          <p className="font-semibold">Что изменится</p>
          <p className="break-words">{replanSelectedLine(preview, operationName)}</p>
          <div>
            <p className="font-semibold">Последующие операции</p>
            {replanDownstreamLines(preview).length ? (
              <ul className="mt-1 space-y-1">
                {replanDownstreamLines(preview).map((line) => <li key={line} className="break-words">{line}</li>)}
              </ul>
            ) : <p>Нет сдвига последующих операций.</p>}
          </div>
          <p>ETA: {formatPlanDate(preview.old_eta)} → {formatPlanDate(preview.new_eta)}</p>
          <p>Отгрузка {formatPlanDate(preview.shipping_date)}</p>
          <p>Запас: {replanSlackLabel(preview.old_slack)} → {replanSlackLabel(preview.new_slack)}</p>
          <p>Риск: {replanRiskLabel(preview.risk_before)} → {replanRiskLabel(preview.risk_after)}</p>
          {[...preview.capacity_warnings, ...preview.dependency_warnings]
            .filter((item) => !preview.blockers.some((blocker) => blocker.message === item.message))
            .map((item, index) => <p key={"warning-" + index} className="break-words text-portal-muted">{item.message}</p>)}
          {preview.blockers.map((item, index) => <p key={"blocker-" + index} role="alert" className="break-words text-portal-danger">{item.message}</p>)}
        </div>
      ) : null}
      {error ? <p role="alert" className="break-words text-portal-danger">{error}</p> : null}
      {suggestDownstream ? <p className="text-portal-body">{REPLAN_DOWNSTREAM_HINT}</p> : null}
      <div className="flex flex-wrap gap-portal-2 max-lg:sticky max-lg:bottom-0 max-lg:z-10 max-lg:bg-portal-page max-lg:py-2">
        <Button type="button" variant="secondary" disabled={busy != null || snapshotNodeId == null} onClick={loadPreview}>{busy === "preview" ? "Проверяем…" : "Проверить перенос"}</Button>
        <Button type="submit" variant="primary" disabled={!allowed}>{busy === "apply" ? "Перенос…" : "Применить перенос"}</Button>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={busy != null}>Отмена</Button>
      </div>
    </form>
  );
}

type PlanningCardIdentitySource = {
  id: number;
  order_number: string | null;
  product_model_name?: string | null;
  nomenclature_name?: string | null;
  quantity?: string | number | null;
};

async function loadPlanningIdentities(ids: readonly number[], signal: AbortSignal): Promise<Map<number, PlanningListIdentity>> {
  const wanted = new Set(ids);
  const found = new Map<number, PlanningListIdentity>();
  for (let offset = 0; offset <= 4500 && found.size < wanted.size; offset += 500) {
    const response = await fetch(`/api/technical-cards?limit=500&offset=${offset}`, {
      cache: "no-store",
      credentials: "include",
      signal,
    });
    if (!response.ok) throw new Error("Не удалось загрузить заказы техкарт.");
    const page = (await response.json()) as PlanningCardIdentitySource[];
    if (!Array.isArray(page)) throw new Error("Сервер вернул неполный список техкарт.");
    if (signal.aborted) return found;
    for (const item of page) {
      if (wanted.has(item.id)) found.set(item.id, planningIdentity(item));
    }
    if (page.length < 500) break;
  }
  return found;
}

function planningIdentity(item: PlanningCardIdentitySource): PlanningListIdentity {
  return {
    orderNumber: item.order_number,
    model: item.product_model_name?.trim() || item.nomenclature_name?.trim() || null,
    quantity: item.quantity == null ? null : String(item.quantity),
  };
}
