"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  completeTechnicalCardStageAction,
  loadStageMaterialFactsAction,
  setCompositionFactQtyAction,
  startTechnicalCardStageAction,
} from "@/app/(workspace)/production/tech-cards/tech-card-actions";
import { KanbanBoard } from "@/components/kanban/kanban-board";
import { MaterialFactCompleteModal } from "@/components/production/material-fact-complete-modal";
import { EmptyState } from "@/components/ui/empty-state";
import { InlineAlert } from "@/components/ui/inline-alert";
import { PageToolbar } from "@/components/ui/page-header";
import { Input } from "@/components/ui/form-controls";
import {
  MATERIAL_FACT_OPERATOR_MESSAGE,
  isMaterialFactGateError,
  materialFactSaveError,
  type MaterialFactDraft,
} from "@/lib/production/material-fact-complete";
import {
  buildShopStageKanbanColumns,
  type ShopStageModule,
} from "@/lib/production/shop-stage-modules";
import type { ApiTechnicalCardListItem } from "@/lib/sales/order-tech-cards-api";

export function ShopStageKanbanWorkspace({
  cards,
  shopModules,
  canTransition = false,
  hideToolbar = false,
}: {
  cards: ApiTechnicalCardListItem[];
  shopModules: ShopStageModule[];
  canTransition?: boolean;
  hideToolbar?: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [factPrompt, setFactPrompt] = useState<{
    cardId: number;
    stageOrder: number;
    lines: MaterialFactDraft[];
  } | null>(null);
  const columns = useMemo(
    () => buildShopStageKanbanColumns(cards, shopModules, { factActions: canTransition }),
    [cards, shopModules, canTransition],
  );
  const boardColumns = useMemo(() => {
    if (!busyId) return columns;
    return columns.map((column) => ({
      ...column,
      cards: column.cards.map((card) => (
        card.id === busyId ? { ...card, actionLabel: "Сохраняем..." } : card
      )),
    }));
  }, [busyId, columns]);

  const onFactAction = async (cardId: string) => {
    if (busyId) return;
    const card = columns.flatMap((column) => column.cards).find((row) => row.id === cardId);
    if (!card?.factStageOrder || (card.factStatus !== "pending" && card.factStatus !== "in_progress")) {
      return;
    }
    setBusyId(cardId);
    setError(null);
    const cardNumber = Number(cardId);
    const result = card.factStatus === "in_progress"
      ? await completeTechnicalCardStageAction(cardNumber, card.factStageOrder, {})
      : await startTechnicalCardStageAction(cardNumber, card.factStageOrder, {});
    setBusyId(null);
    if (!result.ok) {
      if (card.factStatus === "in_progress" && isMaterialFactGateError(result.message)) {
        const loaded = await loadStageMaterialFactsAction(cardNumber, card.factStageOrder);
        if (loaded.ok) {
          setFactPrompt({
            cardId: cardNumber,
            stageOrder: card.factStageOrder,
            lines: loaded.lines,
          });
          return;
        }
        setError(MATERIAL_FACT_OPERATOR_MESSAGE);
        return;
      }
      setError(result.message ?? "Не удалось записать факт");
      return;
    }
    router.refresh();
  };

  const saveMaterialFacts = async (rows: MaterialFactDraft[]) => {
    if (!factPrompt) return { ok: false, formError: MATERIAL_FACT_OPERATOR_MESSAGE };
    for (const row of rows) {
      const saved = await setCompositionFactQtyAction(
        factPrompt.cardId,
        row.lineId,
        row.factQty.trim(),
      );
      if (!saved.ok) {
        return {
          ok: false,
          fieldErrors: { [row.lineId]: materialFactSaveError(saved.message) },
        };
      }
    }
    return { ok: true };
  };

  const onSaveFacts = async (rows: MaterialFactDraft[]) => {
    const saved = await saveMaterialFacts(rows);
    if (!saved.ok) return saved;
    setFactPrompt(null);
    router.refresh();
    return { ok: true };
  };

  const onSaveFactsAndComplete = async (rows: MaterialFactDraft[]) => {
    if (!factPrompt) return { ok: false, formError: MATERIAL_FACT_OPERATOR_MESSAGE };
    const saved = await saveMaterialFacts(rows);
    if (!saved.ok) return saved;
    const completed = await completeTechnicalCardStageAction(
      factPrompt.cardId,
      factPrompt.stageOrder,
      {},
    );
    if (!completed.ok) {
      return {
        ok: false,
        formError: isMaterialFactGateError(completed.message)
          ? MATERIAL_FACT_OPERATOR_MESSAGE
          : materialFactSaveError(completed.message),
      };
    }
    setFactPrompt(null);
    router.refresh();
    return { ok: true };
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {hideToolbar ? (
        <div className="border-b border-portal-border px-portal-4 py-portal-2">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Поиск по № ТК / заказу"
            size="compact"
            className="min-w-0 w-full"
            aria-label="Поиск канбана цехов"
          />
        </div>
      ) : (
        <PageToolbar
          start={
            <div className="flex min-w-0 flex-1 flex-col gap-portal-2 md:flex-row md:items-center">
              <p className="shrink-0 text-portal-body font-semibold text-portal-text">
                Канбан цехов
              </p>
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Поиск по № ТК / заказу"
                size="compact"
                className="min-w-0 flex-1"
                aria-label="Поиск канбана цехов"
              />
            </div>
          }
        />
      )}

      <div className="min-w-0 flex-1 overflow-auto p-portal-4 lg:p-portal-6">
        <InlineAlert className="mb-portal-4" tone="neutral">
          Колонка — текущий участок по факту. Плановые дни календаря карточку не переносят.
        </InlineAlert>
        {error ? (
          <InlineAlert className="mb-portal-4" tone="danger">
            {error}
          </InlineAlert>
        ) : null}
        {boardColumns.every((column) => column.cards.length === 0) ? (
          <EmptyState
            title="Нет активных техкарт"
            description="Канбан показывает техкарты в текущем участке."
          />
        ) : (
          <KanbanBoard
            columns={boardColumns}
            query={query}
            selectedFilters={{}}
            dragEnabled={false}
            onCardSelect={(cardId) => void onFactAction(cardId)}
          />
        )}
      </div>
      {factPrompt ? (
        <MaterialFactCompleteModal
          lines={factPrompt.lines}
          onCancel={() => setFactPrompt(null)}
          onSave={onSaveFacts}
          onSaveAndComplete={onSaveFactsAndComplete}
        />
      ) : null}
    </div>
  );
}
