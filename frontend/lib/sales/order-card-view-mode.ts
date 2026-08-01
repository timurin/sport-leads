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

export function getOrderCardSectionVisibility(mode: OrderCardViewMode): OrderCardSectionVisibility {
  if (mode === "info") {
    return {
      info: true,
      metrics: true,
      items: false,
      history: false,
      comments: true,
      tasks: true,
      communication: false,
      documents: false,
      techCards: false,
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
      documents: false,
      // Gap #4: line-adjacent tech-card strip next to Товары (`9.4.1.1`)
      techCards: true,
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
      documents: false,
      techCards: false,
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
    // Documents only via dedicated filter (`3.5.9`)
    documents: false,
    techCards: true,
  };
}
