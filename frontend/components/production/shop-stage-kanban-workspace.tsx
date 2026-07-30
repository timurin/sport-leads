"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { moveShopStageKanbanCardAction } from "@/app/(workspace)/production/kanban/shop-kanban-actions";
import { KanbanBoard } from "@/components/kanban/kanban-board";
import { cloneKanbanColumns } from "@/components/kanban/kanban-state";
import type { KanbanMove } from "@/components/kanban/kanban-types";
import { EmptyState } from "@/components/ui/empty-state";
import { InlineAlert } from "@/components/ui/inline-alert";
import { PageToolbar } from "@/components/ui/page-header";
import { Input } from "@/components/ui/form-controls";
import {
  buildShopStageKanbanColumns,
  isAllowedShopStageKanbanMove,
  type ShopStageKanbanStatus,
  type ShopStageModule,
} from "@/lib/production/shop-stage-modules";
import type { ApiTechnicalCardListItem } from "@/lib/sales/order-tech-cards-api";

export function ShopStageKanbanWorkspace({
  cards,
  shopModules,
}: {
  cards: ApiTechnicalCardListItem[];
  shopModules: ShopStageModule[];
}) {
  const router = useRouter();
  const initialColumns = useMemo(
    () => buildShopStageKanbanColumns(cards, shopModules),
    [cards, shopModules],
  );
  const [columns, setColumns] = useState(() => cloneKanbanColumns(initialColumns));
  const [boardRevision, setBoardRevision] = useState(0);
  const [query, setQuery] = useState("");
  const [moveError, setMoveError] = useState<string | null>(null);

  useEffect(() => {
    setColumns(cloneKanbanColumns(buildShopStageKanbanColumns(cards, shopModules)));
    setBoardRevision((value) => value + 1);
  }, [cards, shopModules]);

  const onMove = (move: KanbanMove<ShopStageKanbanStatus>) => {
    const previousColumns = cloneKanbanColumns(columns);
    const sourceCard = previousColumns
      .flatMap((column) => column.cards)
      .find((card) => card.id === move.cardId);
    if (!sourceCard || sourceCard.status === move.targetColumnId) {
      return;
    }

    if (
      !isAllowedShopStageKanbanMove(
        sourceCard.status,
        move.targetColumnId,
        shopModules,
      )
    ) {
      setMoveError(
        "Перемещение разрешено только на соседний цех по маршруту (без пропуска этапов).",
      );
      setColumns(previousColumns);
      setBoardRevision((value) => value + 1);
      return;
    }

    setMoveError(null);
    void moveShopStageKanbanCardAction({
      cardId: Number(move.cardId),
      fromStageCode: sourceCard.status,
      toStageCode: move.targetColumnId,
    }).then((result) => {
      if (result.ok) {
        router.refresh();
        return;
      }
      setColumns(previousColumns);
      setBoardRevision((value) => value + 1);
      setMoveError(result.message ?? "Не удалось переместить техкарту");
    }).catch(() => {
      setColumns(previousColumns);
      setBoardRevision((value) => value + 1);
      setMoveError("Не удалось связаться с backend. Перемещение отменено.");
    });
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
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

      <div className="min-w-0 flex-1 overflow-auto p-portal-4 lg:p-portal-6">
        <InlineAlert className="mb-portal-4" tone="warning">
          DnD временно открыт для всех пользователей (отладка `11.3.6`). Ролевой gate —
          `17.1.2.7`. Переход только на соседний цех; complete/rollback через API `9.2.2`
          без обхода hard-gate.
        </InlineAlert>
        {moveError ? (
          <InlineAlert className="mb-portal-4" tone="danger">
            {moveError}
          </InlineAlert>
        ) : null}
        {columns.every((column) => column.cards.length === 0) ? (
          <EmptyState
            title="Нет активных техкарт"
            description="Канбан строится из реальных ТК с текущим ProductionStage."
          />
        ) : (
          <KanbanBoard
            key={boardRevision}
            columns={columns}
            query={query}
            selectedFilters={{}}
            onColumnsChange={setColumns}
            onMove={onMove}
          />
        )}
      </div>
    </div>
  );
}
