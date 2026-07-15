export type KanbanBadgeTone = "blue" | "amber" | "emerald" | "red" | "slate" | "violet";

export type KanbanDetail = {
  label: string;
  value: string;
};

export type KanbanCardData = {
  id: string;
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
};

export type KanbanColumnData = {
  id: string;
  title: string;
  accentClass: string;
  metric?: string;
  cards: KanbanCardData[];
};

export type KanbanFilter = {
  id: string;
  label: string;
  options: string[];
};

export type KanbanMetric = {
  label: string;
  value: string;
  hint?: string;
};
