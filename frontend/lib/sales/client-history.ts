export type ClientHistoryKind = "lead" | "order";
export type ClientHistoryFilter = "all" | ClientHistoryKind;

export type ApiClientHistoryItem = {
  kind: ClientHistoryKind;
  id: number;
  occurred_at: string;
  title: string;
  status: string;
  amount: number | string | null;
  sport: string | null;
  source: string | null;
};

export type ApiClientHistory = {
  items: ApiClientHistoryItem[];
  total: number;
};

export type ClientHistoryItemView = {
  kind: ClientHistoryKind;
  id: string;
  title: string;
  statusLabel: string;
  occurredAtLabel: string;
  amountLabel: string | null;
  sport: string;
  source: string | null;
  href: string;
};

const leadStatusLabels: Record<string, string> = {
  new: "Новый",
  contact: "Контакт",
  qualification: "Квалификация",
  proposal: "Предложение",
  waiting: "Ожидание",
  completed: "Завершён",
  won: "Выигран",
  unqualified: "Неквалифицирован",
};

const orderStatusLabels: Record<string, string> = {
  new: "Новый",
  confirmed: "Подтверждён",
  production: "В производстве",
  ready: "Готов",
  shipped: "Отгружен",
  completed: "Завершён",
  cancelled: "Отменён",
};

function formatAmount(amount: number | string | null) {
  if (amount === null || amount === "") return null;
  const value = Number(amount);
  if (!Number.isFinite(value)) return null;
  return `${new Intl.NumberFormat("ru-RU").format(value)} ₽`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeZone: "Europe/Moscow",
  }).format(new Date(value));
}

export function fromApiClientHistoryItem(
  item: ApiClientHistoryItem,
): ClientHistoryItemView {
  const labels = item.kind === "lead" ? leadStatusLabels : orderStatusLabels;
  return {
    kind: item.kind,
    id: String(item.id),
    title: item.title,
    statusLabel: labels[item.status] ?? item.status,
    occurredAtLabel: formatDate(item.occurred_at),
    amountLabel: item.kind === "order" ? formatAmount(item.amount) : null,
    sport: item.sport ?? "Не указан",
    source: item.source,
    href:
      item.kind === "lead"
        ? `/sales/leads/${item.id}`
        : `/sales/orders/${item.id}`,
  };
}

export function filterClientHistoryItems(
  items: ClientHistoryItemView[],
  kind: ClientHistoryFilter,
): ClientHistoryItemView[] {
  if (kind === "all") return items;
  return items.filter((item) => item.kind === kind);
}
