export type OrderCardViewMode =
  | "all"
  | "info"
  | "items"
  | "communication"
  | "documents"
  | "techCards";

export const orderCardViewModeOptions: { id: OrderCardViewMode; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "info", label: "Сведения о заказе" },
  { id: "items", label: "Товары" },
  { id: "communication", label: "Коммуникация" },
  { id: "documents", label: "Документы" },
  { id: "techCards", label: "Тех карты" },
];

export type OrderCardSectionVisibility = {
  info: boolean;
  metrics: boolean;
  items: boolean;
  history: boolean;
  comments: boolean;
  tasks: boolean;
  communication: boolean;
  documents: boolean;
  techCards: boolean;
};

const hiddenExtras = {
  documents: false,
  techCards: false,
} as const;

export function getOrderCardSectionVisibility(mode: OrderCardViewMode): OrderCardSectionVisibility {
  if (mode === "info") {
    return {
      info: true,
      metrics: true,
      items: false,
      history: false,
      comments: false,
      tasks: false,
      communication: false,
      ...hiddenExtras,
    };
  }
  if (mode === "items") {
    return {
      info: false,
      metrics: false,
      items: true,
      history: false,
      comments: false,
      tasks: false,
      communication: false,
      ...hiddenExtras,
    };
  }
  if (mode === "communication") {
    return {
      info: false,
      metrics: false,
      items: false,
      history: false,
      comments: false,
      tasks: false,
      communication: true,
      ...hiddenExtras,
    };
  }
  if (mode === "documents") {
    return {
      info: false,
      metrics: false,
      items: false,
      history: false,
      comments: false,
      tasks: false,
      communication: false,
      documents: true,
      techCards: false,
    };
  }
  if (mode === "techCards") {
    return {
      info: false,
      metrics: false,
      items: false,
      history: false,
      comments: false,
      tasks: false,
      communication: false,
      documents: false,
      techCards: true,
    };
  }
  return {
    info: true,
    metrics: true,
    items: true,
    history: true,
    comments: true,
    tasks: true,
    communication: true,
    documents: true,
    techCards: true,
  };
}
