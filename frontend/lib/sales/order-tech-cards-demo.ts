import type { SalesOrderItem } from "@/lib/sales/order-details";
import type { OrderStatus } from "@/types/sales";

export type TechCardDemoStatus =
  | "draft"
  | "in_progress"
  | "ready"
  | "completed"
  | "missing";

export type OrderTechCardDemoRow = {
  id: string;
  number: string;
  orderItemId: number;
  position: number;
  productName: string;
  modelLabel: string;
  assemblyLabel: string;
  quantity: string;
  unitLineCount: number;
  status: TechCardDemoStatus;
  statusLabel: string;
  progressPercent: number;
  currentStage: string;
};

export type OrderTechCardsSummary = {
  total: number;
  readyCount: number;
  inProgressCount: number;
  missingCount: number;
  completedCount: number;
  manufacturingComplete: boolean;
  completenessPercent: number;
  statusLabel: string;
};

const statusMeta: Record<TechCardDemoStatus, { label: string; progress: number; stage: string }> = {
  missing: { label: "Не создана", progress: 0, stage: "—" },
  draft: { label: "Черновик", progress: 12, stage: "Подготовка" },
  in_progress: { label: "В работе", progress: 55, stage: "Пошив" },
  ready: { label: "Готова", progress: 88, stage: "Контроль" },
  completed: { label: "Завершена", progress: 100, stage: "Закрыта" },
};

function demoStatusForItem(orderStatus: OrderStatus, index: number): TechCardDemoStatus {
  if (orderStatus === "new") return index === 0 ? "draft" : "missing";
  if (orderStatus === "confirmed") return index % 2 === 0 ? "draft" : "missing";
  if (orderStatus === "production") {
    const cycle: TechCardDemoStatus[] = ["in_progress", "draft", "ready"];
    return cycle[index % cycle.length]!;
  }
  if (orderStatus === "ready" || orderStatus === "shipped") {
    return index % 3 === 0 ? "completed" : "ready";
  }
  if (orderStatus === "completed") return "completed";
  return "missing";
}

export function buildOrderTechCardsDemo({
  orderId,
  orderNumber,
  orderStatus,
  items,
}: {
  orderId: string;
  orderNumber: string;
  orderStatus: OrderStatus;
  items: SalesOrderItem[];
}): { rows: OrderTechCardDemoRow[]; summary: OrderTechCardsSummary } {
  const rows: OrderTechCardDemoRow[] = items.map((item, index) => {
    const status = demoStatusForItem(orderStatus, index);
    const meta = statusMeta[status];
    const qty = Number(String(item.quantity).replace(/[^\d.-]/g, ""));
    const unitLineCount = Number.isFinite(qty) && qty > 0 ? Math.trunc(qty) : 1;
    const cardSeq = String(index + 1).padStart(2, "0");
    return {
      id: `tc-demo-${orderId}-${item.id}`,
      number: status === "missing" ? "—" : `${orderNumber}/${cardSeq}`,
      orderItemId: item.id,
      position: index + 1,
      productName: item.snapshotName || "Позиция без наименования",
      modelLabel: item.productModelArticle
        ? `${item.productModelArticle}${item.productModelName ? ` · ${item.productModelName}` : ""}`
        : "Модель не выбрана",
      assemblyLabel: item.assemblyVariantName || "Вариант не выбран",
      quantity: item.quantity,
      unitLineCount,
      status,
      statusLabel: meta.label,
      progressPercent: meta.progress,
      currentStage: meta.stage,
    };
  });

  const missingCount = rows.filter((row) => row.status === "missing").length;
  const draftOrProgress = rows.filter((row) => row.status === "draft" || row.status === "in_progress").length;
  const readyCount = rows.filter((row) => row.status === "ready").length;
  const completedCount = rows.filter((row) => row.status === "completed").length;
  const total = rows.length;
  const doneLike = readyCount + completedCount;
  const completenessPercent = total === 0 ? 0 : Math.round((doneLike / total) * 100);
  const manufacturingComplete = total > 0 && missingCount === 0 && draftOrProgress === 0;

  let statusLabel = "Нет производимых позиций";
  if (total > 0) {
    if (manufacturingComplete) statusLabel = "Производство по ТК завершено";
    else if (missingCount === total) statusLabel = "Техкарты ещё не созданы";
    else if (missingCount > 0) statusLabel = "Часть техкарт отсутствует";
    else statusLabel = "Техкарты в работе";
  }

  return {
    rows,
    summary: {
      total,
      readyCount,
      inProgressCount: draftOrProgress,
      missingCount,
      completedCount,
      manufacturingComplete,
      completenessPercent,
      statusLabel,
    },
  };
}
