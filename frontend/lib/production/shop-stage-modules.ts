import type {
  KanbanCardData,
  KanbanColumnData,
} from "@/components/kanban/kanban-types";
import type { ApiTechnicalCardListItem } from "@/lib/sales/order-tech-cards-api";
import { productionQuantityLabel } from "./tech-card-display.ts";
import { currentWorkshopStatusLabel } from "./production-state-label.ts";

const STAGE_RESULT_BADGE_LABEL: Record<string, string> = {
  pending: "Ожидает",
  in_progress: "В работе",
  completed: "Завершён",
  skipped: "Пропущен",
};

export function shopCurrentFactStatus(card: ApiTechnicalCardListItem): string {
  if (card.production_state) {
    return card.production_state.workshop_state === "waiting" ? "pending" : card.production_state.workshop_state;
  }
  const stages = card.stage_results ?? [];
  if (card.current_stage_order != null) {
    const byOrder = stages.find((row) => row.stage_order === card.current_stage_order);
    if (byOrder) return String(byOrder.status);
  }
  const label = card.current_stage_label?.trim().toLowerCase() ?? "";
  if (label) {
    const byLabel = stages.find(
      (row) => row.stage_label.trim().toLowerCase() === label,
    );
    if (byLabel) return String(byLabel.status);
  }
  if (card.current_stage_label || card.current_stage_order != null) return "pending";
  return String(card.status);
}

export type ShopStageCode = string;

export type ShopStageModule = {
  workshopId?: number;
  code: ShopStageCode;
  title: string;
  href: string;
};

export type ShopStageKanbanStatus = ShopStageCode | "unassigned";

export type ShopStageCatalogRow = {
  code: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  id?: number;
};

/** Seed defaults (fallback when catalog empty / offline). Order matches ADR-017 seed. */
export const SHOP_STAGE_MODULES: ShopStageModule[] = [
  { code: "design", title: "Дизайн", href: "/production/stages/design" },
  { code: "cutting", title: "Раскрой", href: "/production/stages/cutting" },
  { code: "print", title: "Печать", href: "/production/stages/print" },
  { code: "sewing", title: "Пошив", href: "/production/stages/sewing" },
  { code: "wto", title: "ВТО", href: "/production/stages/wto" },
  { code: "qc", title: "ОТК", href: "/production/stages/qc" },
  { code: "packaging", title: "Упаковка", href: "/production/stages/packaging" },
  {
    code: "ready_to_ship",
    title: "Готовы к отгрузке",
    href: "/production/stages/ready_to_ship",
  },
  { code: "shipped", title: "Отгружены", href: "/production/stages/shipped" },
];

const COLUMN_ACCENTS_BY_KNOWN_CODE: Record<string, string> = {
  unassigned: "bg-portal-surface-secondary",
  design: "bg-sky-500/15",
  cutting: "bg-amber-500/15",
  print: "bg-violet-500/15",
  sewing: "bg-emerald-500/15",
  wto: "bg-cyan-500/15",
  qc: "bg-rose-500/15",
  packaging: "bg-lime-500/15",
  ready_to_ship: "bg-indigo-500/15",
  shipped: "bg-slate-500/15",
};

const COLUMN_ACCENTS_FALLBACK: ReadonlyArray<string> = [
  "bg-sky-500/15",
  "bg-amber-500/15",
  "bg-violet-500/15",
  "bg-emerald-500/15",
  "bg-cyan-500/15",
  "bg-rose-500/15",
  "bg-lime-500/15",
];

function accentClassForStageCode(code: string): string {
  const normalized = code.trim().toLowerCase();
  return (
    COLUMN_ACCENTS_BY_KNOWN_CODE[normalized] ??
    (() => {
      // Stable deterministic fallback for unknown stage codes.
      let hash = 0;
      for (let i = 0; i < normalized.length; i++) {
        hash = (hash * 31 + normalized.charCodeAt(i)) >>> 0;
      }
      return COLUMN_ACCENTS_FALLBACK[hash % COLUMN_ACCENTS_FALLBACK.length];
    })()
  );
}

/**
 * Build цеховые modules from ProductionStage catalog (`sort_order` SoT).
 * Includes any active stage codes; inactive rows skipped.
 * Falls back to seed only when catalog is empty/offline.
 */
export function buildShopStageModulesFromCatalog(
  stages: ReadonlyArray<ShopStageCatalogRow>,
  options: { activeOnly?: boolean } = {},
): ShopStageModule[] {
  const activeOnly = options.activeOnly !== false;
  const seedByCode = new Map<ShopStageCode, ShopStageModule>(
    SHOP_STAGE_MODULES.map((stage) => [stage.code, stage] as const),
  );

  // When catalog fetch fails / is offline we want the hardcoded defaults.
  if (stages.length === 0) {
    return [...SHOP_STAGE_MODULES];
  }

  const ordered = [...stages]
    .filter((stage) => {
      if (!stage.code?.trim()) return false;
      if (activeOnly && !stage.is_active) return false;
      return true;
    })
    .sort(
      (a, b) =>
        a.sort_order - b.sort_order ||
        (a.id ?? 0) - (b.id ?? 0) ||
        a.code.localeCompare(b.code),
    );

  if (ordered.length === 0) {
    // Catalog exists but nothing is active: reflect "removal" by returning none.
    return [];
  }

  return ordered.map((stage) => {
    const code = stage.code.trim().toLowerCase() as ShopStageCode;
    const seed = seedByCode.get(code);
    const title = stage.name.trim() || seed?.title || code;
    return {
      workshopId: stage.id,
      code,
      title,
      href: `/production/stages/${code}`,
    };
  });
}

export function getShopStageModule(
  stageCode: string,
  modules: ReadonlyArray<ShopStageModule> = SHOP_STAGE_MODULES,
): ShopStageModule | null {
  const normalized = stageCode.trim().toLowerCase();
  return modules.find((stage) => stage.code === normalized) ?? null;
}

/** Hard material-fact gate applies to cutting/print only (`9.3.4` / `11.3.1`). */
export function shopStageRequiresMaterialFact(stageCode: string): boolean {
  return stageCode === "cutting" || stageCode === "print";
}

/** Post-packaging FG stages linked to warehouse receipt/issue (ADR-019 / 11.2.2). */
export function shopStageIsFinishedGoods(stageCode: string): boolean {
  const code = stageCode.trim().toLowerCase();
  return code === "ready_to_ship" || code === "shipped";
}

export function shopStageFinishedGoodsHint(stageCode: string): string | null {
  const code = stageCode.trim().toLowerCase();
  if (code === "ready_to_ship") {
    return "Приход ГП на склад создаётся автоматически при завершении этапа.";
  }
  if (code === "shipped") {
    return "Списание со склада создаётся автоматически при завершении этапа.";
  }
  return null;
}

export function shopStageCardHref(
  stageCode: string,
  cardId: number | string,
): string {
  return `/production/tech-cards/${cardId}?stage=${encodeURIComponent(stageCode)}`;
}

export function shopStageCodeByTitle(
  title: string | null | undefined,
  modules: ReadonlyArray<ShopStageModule> = SHOP_STAGE_MODULES,
): ShopStageCode | null {
  const normalized = title?.trim().toLowerCase() ?? "";
  if (!normalized) return null;
  const fromModules =
    modules.find((stage) => stage.title.toLowerCase() === normalized)?.code ??
    null;
  if (fromModules) return fromModules;
  // Seed aliases (e.g. renamed «ОТК» → «Контроль качества» still matches cards).
  const fromSeed =
    SHOP_STAGE_MODULES.find((stage) => stage.title.toLowerCase() === normalized)
      ?.code ?? null;
  if (fromSeed) return fromSeed;
  if (normalized === "контроль качества" || normalized === "отк") {
    const qcCode =
      modules.find((stage) => stage.code.trim().toLowerCase() === "qc")?.code ??
      "qc";
    return qcCode;
  }
  return null;
}

/** Adjacent forward/back only — no skipping columns (9.2.2 gate order). */
export function shopStageTransitionKind(
  fromCode: ShopStageKanbanStatus,
  toCode: ShopStageKanbanStatus,
  modules: ReadonlyArray<ShopStageModule> = SHOP_STAGE_MODULES,
): "forward" | "backward" | null {
  if (fromCode === toCode) return null;
  if (fromCode === "unassigned" || toCode === "unassigned") return null;

  const fromIndex = modules.findIndex((stage) => stage.code === fromCode);
  const toIndex = modules.findIndex((stage) => stage.code === toCode);
  if (fromIndex < 0 || toIndex < 0) return null;
  if (toIndex === fromIndex + 1) return "forward";
  if (toIndex === fromIndex - 1) return "backward";
  return null;
}

export function isAllowedShopStageKanbanMove(
  fromCode: ShopStageKanbanStatus,
  toCode: ShopStageKanbanStatus,
  modules: ReadonlyArray<ShopStageModule> = SHOP_STAGE_MODULES,
): boolean {
  return shopStageTransitionKind(fromCode, toCode, modules) != null;
}

export function buildShopStageKanbanColumns(
  cards: ApiTechnicalCardListItem[],
  modules: ReadonlyArray<ShopStageModule> = SHOP_STAGE_MODULES,
  options: { factActions?: boolean } = {},
): KanbanColumnData<ShopStageKanbanStatus>[] {
  const buckets = new Map<ShopStageKanbanStatus, KanbanCardData<ShopStageKanbanStatus>[]>();
  buckets.set("unassigned", []);
  for (const stage of modules) {
    buckets.set(stage.code, []);
  }

  for (const card of cards) {
    const lifecycle = card.production_state?.lifecycle_status ?? String(card.status);
    if (lifecycle === "cancelled" || lifecycle === "completed") {
      continue;
    }
    const workshopId = card.production_state?.current_workshop_id ?? card.current_workshop_id;
    const workshopName = card.production_state?.current_workshop_name ?? card.current_stage_label;
    const byId = workshopId != null
      ? modules.find((stage) => stage.workshopId === workshopId)?.code
      : undefined;
    const byName = byId ? undefined : shopStageCodeByTitle(workshopName, modules);
    const code = (byId && buckets.has(byId) ? byId : byName && buckets.has(byName) ? byName : undefined) ?? "unassigned";
    const columnCards = buckets.get(code) ?? [];
    const stageStatus = shopCurrentFactStatus(card);
    const stateBadge = card.production_state
      ? currentWorkshopStatusLabel({
        lifecycleStatus: card.production_state.lifecycle_status,
        workshopState: card.production_state.workshop_state,
      })
      : null;
    const canAct = options.factActions === true
      && (card.production_state?.current_stage_order ?? card.current_stage_order) != null
      && (stageStatus === "pending" || stageStatus === "in_progress");
    columnCards.push({
      id: String(card.id),
      status: code,
      title: card.display_number?.trim() || card.number,
      href:
        code === "unassigned"
          ? `/production/tech-cards/${card.id}`
          : shopStageCardHref(code, card.id),
      subtitle:
        card.order_number?.trim() ||
        (card.sales_order_id != null ? `Заказ #${card.sales_order_id}` : "Без заказа"),
      amount: productionQuantityLabel(card.quantity),
      badge: {
        label: stateBadge ?? STAGE_RESULT_BADGE_LABEL[stageStatus] ?? stageStatus,
        tone:
          stateBadge === "Запланирована"
            ? "violet"
            : stageStatus === "in_progress"
            ? "blue"
            : stageStatus === "pending"
              ? "amber"
              : stageStatus === "completed"
                ? "emerald"
                : "slate",
      },
      details: [
        {
          label: "Участок",
          value: workshopName?.trim() || "Участок ещё не определён",
        },
        {
          label: "Позиция",
          value: card.nomenclature_name ?? `Строка #${card.sales_order_item_id}`,
        },
        {
          label: "Модель",
          value:
            [card.product_model_article, card.product_model_name]
              .filter(Boolean)
              .join(" · ") || "—",
        },
      ],
      filters: {
        status: stageStatus,
      },
      metricValues: {
        quantity: Number(card.quantity) || 0,
      },
      draggable: false,
      factStageOrder: card.production_state?.current_stage_order ?? card.current_stage_order ?? undefined,
      factStatus: stageStatus,
      actionLabel: canAct
        ? (stageStatus === "in_progress" ? "Завершить" : "Принять в работу")
        : undefined,
    });
    buckets.set(code, columnCards);
  }

  const columns: KanbanColumnData<ShopStageKanbanStatus>[] = [
    {
      id: "unassigned",
      title: "Без этапа",
      accentClass: COLUMN_ACCENTS_BY_KNOWN_CODE.unassigned,
      metric: `${buckets.get("unassigned")?.length ?? 0}`,
      cards: buckets.get("unassigned") ?? [],
    },
  ];

  for (const stage of modules) {
    const stageCards = buckets.get(stage.code) ?? [];
    columns.push({
      id: stage.code,
      title: stage.title,
      accentClass: accentClassForStageCode(stage.code),
      metric: `${stageCards.length}`,
      cards: stageCards,
    });
  }

  return columns;
}
