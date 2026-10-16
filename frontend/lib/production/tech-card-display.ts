/** Live display `{stored}/{N}` (Stage 28). Stored number stays `{orderNo}-{seq}`. */
export function formatTechCardDisplayNumber(
  storedNumber: string,
  plannedCount: number | null | undefined,
): string {
  const number = storedNumber.trim();
  if (plannedCount != null && plannedCount >= 1) {
    return `${number}/${plannedCount}`;
  }
  return number;
}

export function techCardVisibleNumber(card: {
  number: string;
  display_number?: string | null;
  tech_cards_planned_count?: number | null;
}): string {
  const display = card.display_number?.trim();
  if (display) return display;
  return formatTechCardDisplayNumber(card.number, card.tech_cards_planned_count);
}

/** Canonical piece count. `4.000` and `4` are the same production quantity. */
export function productionQuantityLabel(value: string | number | null | undefined): string {
  if (value == null) return "—";
  const text = String(value).trim();
  if (!text) return "—";
  const parsed = Number(text);
  if (!Number.isFinite(parsed)) return text;
  return String(parsed);
}
