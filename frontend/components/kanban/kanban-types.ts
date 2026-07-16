export type KanbanBadgeTone = "blue" | "amber" | "emerald" | "red" | "slate" | "violet";

export type KanbanDetail = {
  label: string;
  value: string;
};

export type KanbanCardData<TStatus extends string = string> = {
  id: string;
  status: TStatus;
  title: string;
  subtitle?: string;
  amount?: string;
  badge?: {
    label: string;
    tone: KanbanBadgeTone;
  };
  responsible?: string;
  nextAction?: string;
  details?: KanbanDetail[];
  filters?: Record<string, string>;
  metricValues?: Record<string, number>;
  draggable?: boolean;
  actionLabel?: string;
};

export type KanbanColumnData<TStatus extends string = string> = {
  id: TStatus;
  title: string;
  accentClass: string;
  metric?: string;
  cards: KanbanCardData<TStatus>[];
};

export type KanbanFilter = {
  id: string;
  label: string;
  options: string[];
};

type KanbanMetricSelection<TStatus extends string> = {
  statuses?: readonly TStatus[];
  excludeStatuses?: readonly TStatus[];
};

type KanbanMetricBase = {
  label: string;
  hint?: string;
};

export type KanbanMetricDefinition<TStatus extends string = string> =
  KanbanMetricBase & (
    | ({ kind: "count" } & KanbanMetricSelection<TStatus>)
    | ({
      kind: "sum";
      valueKey: string;
      format: "currency" | "number";
    } & KanbanMetricSelection<TStatus>)
    | {
      kind: "ratio";
      numerator: KanbanMetricSelection<TStatus>;
      denominator: KanbanMetricSelection<TStatus>;
    }
  );

export type KanbanMove<TStatus extends string = string> = {
  cardId: string;
  targetColumnId: TStatus;
  targetIndex: number;
  visibleTargetCardIds: string[];
};

export type KanbanMoveHandler<TStatus extends string = string> = (
  move: KanbanMove<TStatus>,
) => void;
