export type OrderCardViewMode =
  | "all"
  | "items"
  | "documents"
  | "techCards";

export const orderCardViewModeOptions: { id: OrderCardViewMode; label: string }[] = [
  { id: "all", label: "Документ" },
  { id: "items", label: "Товары" },
  { id: "documents", label: "Документы" },
  { id: "techCards", label: "Тех карты" },
];

export type OrderCardSectionVisibility = {
  info: boolean;
  /** Always true — finance rail stays visible (Stage 22.2 / Design v1.0). */
  metrics: boolean;
  items: boolean;
  history: boolean;
  comments: boolean;
  tasks: boolean;
  communication: boolean;
  documents: boolean;
  techCards: boolean;
};

/** View filters hide left content only; finance `metrics` is always on. */
export function getOrderCardSectionVisibility(mode: OrderCardViewMode): OrderCardSectionVisibility {
  if (mode === "items") {
    return {
      info: false,
      metrics: true,
      items: true,
      history: false,
      comments: false,
      tasks: false,
      communication: false,
      documents: false,
      techCards: true,
    };
  }
  if (mode === "documents") {
    return {
      info: false,
      metrics: true,
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
      metrics: true,
      items: false,
      history: false,
      comments: false,
      tasks: false,
      communication: false,
      documents: false,
      techCards: true,
    };
  }
  // Document default: items left; party/need/CRM in right tabs.
  return {
    info: false,
    metrics: true,
    items: true,
    history: false,
    comments: false,
    tasks: false,
    communication: false,
    documents: false,
    techCards: false,
  };
}
