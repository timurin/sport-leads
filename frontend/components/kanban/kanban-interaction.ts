export const KANBAN_INTERACTIVE_SELECTOR = [
  "a",
  "button",
  "input",
  "select",
  "textarea",
  "[contenteditable='true']",
  "[data-kanban-no-drag]",
].join(",");
export const KANBAN_CARD_LINK_SELECTOR = "[data-kanban-card-link]";

type ClosestTarget = {
  closest?: (selector: string) => unknown;
  parentElement?: ClosestTarget | null;
};

export function isKanbanInteractiveTarget(target: unknown): boolean {
  const candidate = target as ClosestTarget | null;
  const element = typeof candidate?.closest === "function"
    ? candidate
    : candidate?.parentElement;

  return Boolean(element?.closest?.(KANBAN_INTERACTIVE_SELECTOR));
}

export function canStartKanbanDrag(target: unknown): boolean {
  const candidate = target as ClosestTarget | null;
  const element = typeof candidate?.closest === "function"
    ? candidate
    : candidate?.parentElement;

  return Boolean(element?.closest?.(KANBAN_CARD_LINK_SELECTOR))
    || !isKanbanInteractiveTarget(target);
}

export function shouldOpenKanbanCard(
  target: unknown,
  wasDragging: boolean,
  href?: string,
): boolean {
  return Boolean(href) && !wasDragging && !isKanbanInteractiveTarget(target);
}
