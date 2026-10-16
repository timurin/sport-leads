"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp } from "lucide-react";

import {
  applyWorkshopQueueAction,
  previewWorkshopQueueAction,
  refreshWorkshopQueuesAction,
} from "@/app/(workspace)/production/tech-cards/workshop-queue-actions";
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
import { EmptyState } from "@/components/ui/empty-state";
import { InlineAlert } from "@/components/ui/inline-alert";
import { StatusBadge } from "@/components/ui/status-badge";
import { diagnosticTechnicalRows } from "@/lib/platform-debug";
import { readDiagnostics } from "@/lib/production/readiness-stickers";
import {
  WORKSHOP_QUEUE_APPLY_SUCCESS,
  WORKSHOP_QUEUE_STALE_MESSAGE,
  canApplyWorkshopQueue,
  cardFactLabel,
  downstreamLabels,
  moveQueueItem,
  presentQueueItems,
  queueDateLabel,
  queueRiskLabel,
  queueStatusLabel,
  replaceWorkshopQueue,
  sameNodeOrder,
  workshopQueueApplyBody,
  workshopQueuePreviewBody,
  type WorkshopQueuePreviewView,
  type WorkshopQueueRow,
  type WorkshopQueueSection,
} from "@/lib/production/workshop-queue";
import type { ApiTechnicalCardListItem } from "@/lib/sales/order-tech-cards-api";

type HeldPreview = {
  orderedIds: number[];
  preview: WorkshopQueuePreviewView;
};

type Busy =
  | { workshopId: number; kind: "preview" | "apply" }
  | { workshopId: null; kind: "refresh" }
  | null;

function diagnosticMessages(value: unknown[]): string[] {
  return readDiagnostics(value).map((row) => row.message).filter(Boolean);
}

export function WorkshopQueuePanel({
  sections,
  cards,
  workshopIds,
  canReorder = false,
  debugMode = false,
  loadError = null,
}: {
  sections: WorkshopQueueSection[];
  cards: ApiTechnicalCardListItem[];
  workshopIds: number[];
  canReorder?: boolean;
  debugMode?: boolean;
  loadError?: string | null;
}) {
  const router = useRouter();
  const busyRef = useRef(false);
  const signature = sections.map((section) => `${section.workshopId}:${section.revision}`).join("|");
  const [seenSignature, setSeenSignature] = useState(signature);
  const [queues, setQueues] = useState(sections);
  const [drafts, setDrafts] = useState<Record<number, WorkshopQueueRow[]>>({});
  const [previews, setPreviews] = useState<Record<number, HeldPreview>>({});
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(loadError);
  const [errorDiagnostic, setErrorDiagnostic] = useState<Record<string, unknown> | null>(null);
  const [staleWorkshopId, setStaleWorkshopId] = useState<number | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (seenSignature !== signature) {
    setSeenSignature(signature);
    setQueues(sections);
    setDrafts({});
    setPreviews({});
    setError(loadError);
    setErrorDiagnostic(null);
    setStaleWorkshopId(null);
  }

  const facts = useMemo(() => {
    const map = new Map<number, { model: string; quantity: string }>();
    for (const card of cards) map.set(card.id, cardFactLabel(card));
    return map;
  }, [cards]);

  const visible = queues
    .map((section) => ({
      section,
      rows: drafts[section.workshopId] ?? presentQueueItems(section.items, facts),
    }))
    .filter((entry) => entry.rows.length > 0);

  const clearWorkshopDraft = (workshopId: number) => {
    setDrafts((current) => {
      const next = { ...current };
      delete next[workshopId];
      return next;
    });
    setPreviews((current) => {
      const next = { ...current };
      delete next[workshopId];
      return next;
    });
  };

  const move = (workshopId: number, snapshotNodeId: number, direction: -1 | 1) => {
    if (busyRef.current) return;
    const section = queues.find((row) => row.workshopId === workshopId);
    if (!section) return;
    const current = drafts[workshopId] ?? presentQueueItems(section.items, facts);
    const next = moveQueueItem(current, snapshotNodeId, direction);
    if (!next) return;
    setSuccess(null);
    setError(null);
    setStaleWorkshopId(null);
    setPreviews((held) => {
      const copy = { ...held };
      delete copy[workshopId];
      return copy;
    });
    if (sameNodeOrder(next, section.items)) {
      clearWorkshopDraft(workshopId);
      return;
    }
    setDrafts((held) => ({ ...held, [workshopId]: next }));
  };

  const preview = async (workshopId: number, rows: WorkshopQueueRow[]) => {
    if (busyRef.current) return;
    const section = queues.find((row) => row.workshopId === workshopId);
    if (!section) return;
    const body = workshopQueuePreviewBody(section.revision, rows);
    busyRef.current = true;
    setBusy({ workshopId, kind: "preview" });
    setError(null);
    setErrorDiagnostic(null);
    setSuccess(null);
    let result: Awaited<ReturnType<typeof previewWorkshopQueueAction>>;
    try {
      result = await previewWorkshopQueueAction(workshopId, body);
    } finally {
      busyRef.current = false;
      setBusy(null);
    }
    if (!result.ok) {
      if (result.stale) {
        clearWorkshopDraft(workshopId);
        setStaleWorkshopId(workshopId);
        setError(WORKSHOP_QUEUE_STALE_MESSAGE);
      } else {
        setError(result.message);
      }
      setErrorDiagnostic(result.diagnostic);
      return;
    }
    setPreviews((held) => ({
      ...held,
      [workshopId]: { orderedIds: body.ordered_snapshot_node_ids, preview: result.data },
    }));
  };

  const apply = async (workshopId: number, rows: WorkshopQueueRow[]) => {
    if (busyRef.current) return;
    const held = previews[workshopId];
    const section = queues.find((row) => row.workshopId === workshopId);
    if (!section || !held) return;
    if (!canApplyWorkshopQueue({
      canReorder,
      busy: false,
      preview: held.preview,
      previewOrder: held.orderedIds,
      draft: rows,
    })) return;
    const body = workshopQueueApplyBody(section.revision, rows, held.preview.fingerprint);
    busyRef.current = true;
    setBusy({ workshopId, kind: "apply" });
    setError(null);
    setErrorDiagnostic(null);
    let result: Awaited<ReturnType<typeof applyWorkshopQueueAction>>;
    try {
      result = await applyWorkshopQueueAction(workshopId, body);
    } finally {
      busyRef.current = false;
      setBusy(null);
    }
    if (!result.ok) {
      if (result.stale) {
        clearWorkshopDraft(workshopId);
        setStaleWorkshopId(workshopId);
        setError(WORKSHOP_QUEUE_STALE_MESSAGE);
      } else {
        setError(result.message);
      }
      setErrorDiagnostic(result.diagnostic);
      return;
    }
    setQueues((current) => replaceWorkshopQueue(current, result.data));
    clearWorkshopDraft(workshopId);
    setStaleWorkshopId(null);
    setSuccess(WORKSHOP_QUEUE_APPLY_SUCCESS);
    router.refresh();
  };

  const refresh = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy({ workshopId: null, kind: "refresh" });
    setError(null);
    setErrorDiagnostic(null);
    let result: Awaited<ReturnType<typeof refreshWorkshopQueuesAction>>;
    try {
      result = await refreshWorkshopQueuesAction(workshopIds);
    } finally {
      busyRef.current = false;
      setBusy(null);
    }
    if (!result.ok) {
      setError(result.message);
      setErrorDiagnostic(result.diagnostic);
      return;
    }
    setQueues(result.sections);
    setSeenSignature(result.sections.map((section) => `${section.workshopId}:${section.revision}`).join("|"));
    setDrafts({});
    setPreviews({});
    setStaleWorkshopId(null);
    router.refresh();
  };

  const technical = debugMode ? readDiagnostics(errorDiagnostic ? [errorDiagnostic] : []) : [];

  return (
    <div className="grid gap-portal-4 p-portal-4" data-workshop-queue>
      <p className="text-portal-caption text-portal-muted">
        Порядок ожидающих техкарт приходит с сервера. Стрелки меняют только черновик до предпросмотра. Факт участка и канбан не меняются.
      </p>
      {success ? <InlineAlert tone="success">{success}</InlineAlert> : null}
      {staleWorkshopId != null ? (
        <InlineAlert
          tone="warning"
          action={(
            <Button type="button" variant="secondary" size="compact" data-workshop-queue-refresh onClick={() => void refresh()} disabled={busy != null}>
              {busy?.kind === "refresh" ? "Обновляем очередь..." : "Обновить очередь"}
            </Button>
          )}
        >
          {WORKSHOP_QUEUE_STALE_MESSAGE}
        </InlineAlert>
      ) : null}
      {error ? <InlineAlert tone="danger">{error}</InlineAlert> : null}
      {technical.length > 0 ? (
        <dl className="grid gap-1 text-portal-caption text-portal-muted" data-workshop-queue-debug>
          {technical.flatMap((row) => diagnosticTechnicalRows(row)).map(([key, value]) => (
            <div key={`${key}:${value}`}>
              <dt className="inline">{key}: </dt>
              <dd className="inline">{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {loadError && visible.length === 0 ? null : visible.length === 0 ? (
        <EmptyState title="Нет ожидающих техкарт" description="В очереди только техкарты, которые ещё не приняты в работу." />
      ) : (
        visible.map(({ section, rows }) => {
          const held = previews[section.workshopId];
          const changed = !sameNodeOrder(rows, section.items);
          const applyAllowed = canApplyWorkshopQueue({
            canReorder,
            busy: busy != null,
            preview: held?.preview ?? null,
            previewOrder: held?.orderedIds ?? null,
            draft: rows,
          });
          const warnings = diagnosticMessages(held?.preview.warnings ?? []);
          const blockers = diagnosticMessages(held?.preview.blockers ?? []);
          const previewBusy = busy?.workshopId === section.workshopId && busy.kind === "preview";
          const applyBusy = busy?.workshopId === section.workshopId && busy.kind === "apply";
          return (
            <section key={section.workshopId} className="grid gap-portal-2" data-workshop-queue-section={section.workshopId}>
              <h3 className="text-portal-body font-semibold">{rows[0]?.workshopName ?? "Участок"}</h3>
              {changed && canReorder ? (
                <div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="compact"
                    data-workshop-queue-preview
                    disabled={busy != null}
                    onClick={() => void preview(section.workshopId, rows)}
                  >
                    {previewBusy ? "Считаем предпросмотр..." : "Предпросмотр"}
                  </Button>
                </div>
              ) : null}
              {held ? (
                <div className="grid gap-portal-2 rounded-portal-lg border border-portal-border bg-portal-surface-secondary p-portal-3">
                  <h4 className="text-portal-body font-semibold">Предпросмотр</h4>
                  {held.preview.changes.length === 0 ? (
                    <p className="text-portal-caption text-portal-muted">Порядок не меняет план.</p>
                  ) : (
                    <ul className="grid gap-2 text-portal-caption">
                      {held.preview.changes.map((change) => {
                        const number = rows.find((row) => row.technicalCardId === change.technicalCardId)?.number ?? `#${change.technicalCardId}`;
                        const downstream = downstreamLabels(change.downstreamSnapshotNodeIds, rows);
                        return (
                          <li key={change.snapshotNodeId}>
                            {number}: {change.oldPosition} → {change.newPosition}
                            {"; начало "}{queueDateLabel(change.oldPlannedStart)} → {queueDateLabel(change.newPlannedStart)}
                            {"; окончание "}{queueDateLabel(change.oldPlannedEnd)} → {queueDateLabel(change.newPlannedEnd)}
                            {"; ETA "}{queueDateLabel(change.oldEta)} → {queueDateLabel(change.newEta)}
                            {"; риск "}{queueRiskLabel(change.oldRisk)} → {queueRiskLabel(change.newRisk)}
                            {downstream.names.length > 0 ? `; следующие: ${downstream.names.join(", ")}` : ""}
                            {debugMode && downstream.hiddenIds.length > 0 ? `; шаги ${downstream.hiddenIds.join(", ")}` : ""}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {warnings.map((message) => <InlineAlert key={message} tone="warning">{message}</InlineAlert>)}
                  {blockers.map((message) => <InlineAlert key={message} tone="danger">{message}</InlineAlert>)}
                  {!held.preview.canApply && blockers.length === 0 ? (
                    <InlineAlert tone="danger">Сервер не разрешил применить этот порядок.</InlineAlert>
                  ) : null}
                  <div>
                    <Button
                      type="button"
                      variant="primary"
                      size="compact"
                      data-workshop-queue-apply
                      disabled={!applyAllowed}
                      onClick={() => void apply(section.workshopId, rows)}
                    >
                      {applyBusy ? "Применяем..." : "Применить очередь"}
                    </Button>
                  </div>
                </div>
              ) : null}
              <DataTableFrame>
                <DataTable minWidthClassName="min-w-[960px]">
                  <DataTableHead>
                    <tr>
                      <DataTableHeaderCell className="w-16">№</DataTableHeaderCell>
                      <DataTableHeaderCell>№ ТК</DataTableHeaderCell>
                      <DataTableHeaderCell>Модель</DataTableHeaderCell>
                      <DataTableHeaderCell>Количество</DataTableHeaderCell>
                      <DataTableHeaderCell>Участок</DataTableHeaderCell>
                      <DataTableHeaderCell>Начало</DataTableHeaderCell>
                      <DataTableHeaderCell>Окончание</DataTableHeaderCell>
                      <DataTableHeaderCell>ETA</DataTableHeaderCell>
                      <DataTableHeaderCell>Риск</DataTableHeaderCell>
                      <DataTableHeaderCell>Статус</DataTableHeaderCell>
                      {canReorder ? <DataTableHeaderCell className="w-24">Порядок</DataTableHeaderCell> : null}
                    </tr>
                  </DataTableHead>
                  <DataTableBody>
                    {rows.map((row) => {
                      const movable = canReorder && !row.protected && !row.readOnly;
                      return (
                        <DataTableRow key={row.snapshotNodeId}>
                          <DataTableCell>{row.position}</DataTableCell>
                          <DataTableCell>{row.number}</DataTableCell>
                          <DataTableCell>{row.model}</DataTableCell>
                          <DataTableCell>{row.quantity}</DataTableCell>
                          <DataTableCell>{row.workshopName}</DataTableCell>
                          <DataTableCell>{queueDateLabel(row.plannedStart)}</DataTableCell>
                          <DataTableCell>{queueDateLabel(row.plannedEnd)}</DataTableCell>
                          <DataTableCell>{queueDateLabel(row.eta)}</DataTableCell>
                          <DataTableCell>{queueRiskLabel(row.risk)}</DataTableCell>
                          <DataTableCell>
                            <StatusBadge size="compact" tone={row.protected || row.readOnly ? "neutral" : "warning"}>
                              {row.protected || row.readOnly ? "Нельзя менять" : queueStatusLabel(row.status)}
                            </StatusBadge>
                          </DataTableCell>
                          {canReorder ? (
                            <DataTableCell>
                              {movable ? (
                                <div className="flex gap-1">
                                  <IconButton label={`Выше ${row.number}`} variant="secondary" onClick={() => move(section.workshopId, row.snapshotNodeId, -1)}>
                                    <ArrowUp className="size-4" aria-hidden="true" />
                                  </IconButton>
                                  <IconButton label={`Ниже ${row.number}`} variant="secondary" onClick={() => move(section.workshopId, row.snapshotNodeId, 1)}>
                                    <ArrowDown className="size-4" aria-hidden="true" />
                                  </IconButton>
                                </div>
                              ) : (
                                <span className="text-portal-caption text-portal-muted">—</span>
                              )}
                            </DataTableCell>
                          ) : null}
                        </DataTableRow>
                      );
                    })}
                  </DataTableBody>
                </DataTable>
              </DataTableFrame>
            </section>
          );
        })
      )}
    </div>
  );
}
