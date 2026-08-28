"use client";

import Link from "next/link";
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  ExternalLink,
  FileDown,
  Play,
  Plus,
  Printer,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition, useSyncExternalStore } from "react";

import {
  applyRoutingAction,
  assignPlannedWorkCenterAction,
  completeTechnicalCardStageAction,
  deleteCompositionLineAction,
  deleteTechCardMediaAction,
  generateTechnicalCardPrintForm,
  importUnitLinesFileAction,
  replaceUnitLinesAction,
  replaceCompositionAction,
  rollbackTechnicalCardStageAction,
  rollbackTechnicalCardStageKanbanAction,
  setCompositionFactQtyAction,
  setTechCardMediaPrimaryAction,
  startTechnicalCardAction,
  startTechnicalCardStageAction,
  updateOperationLineVolumeAction,
  updateStageFactAction,
  uploadTechCardMediaAction,
} from "@/app/(workspace)/production/tech-cards/tech-card-actions";
import { TechCardMediaCarousel } from "@/components/production/tech-card-media-carousel";
import { TechCardOrderDataCard } from "@/components/production/tech-card-order-data-card";
import { TechCardModelRouteCard } from "@/components/production/tech-card-model-route-card";
import { TechCardProductNameHeader } from "@/components/production/tech-card-product-name-header";
import { StandaloneTechCardLinkPanel } from "@/components/production/standalone-tech-card-link-panel";
import { TechCardShopFloorBody } from "@/components/production/tech-card-shop-floor-body";
import { OrderCollaborationPanel } from "@/components/sales/order-collaboration-panel";
import { DocumentCard } from "@/components/entity/document-card";
import { Button, IconButton } from "@/components/ui/button";
import { ActivityTimeline, ActivityTimelineItem } from "@/components/ui/activity-timeline";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableFrame,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
} from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { EntityHeader } from "@/components/ui/entity-header";
import { Field, Input, Select, Textarea } from "@/components/ui/form-controls";
import { ImageLightbox } from "@/components/ui/image-lightbox";
import { CompactTabs } from "@/components/ui/compact-tabs";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/components/ui/toast";
import {
  buildShopStageModulesFromCatalog,
  getShopStageModule,
  shopStageCardHref,
  shopStageCodeByTitle,
} from "@/lib/production/shop-stage-modules";
import { buildTechnicalCardPrintRequest } from "@/lib/production/tech-card-print";
import {
  asTechCardUiStatus,
  buildCompositionReplaceLines,
  buildTechCardHistoryEntries,
  compositionLineKindLabel,
  formatTechCardDateTime,
  formatVolumeUnit,
  groupOperationLinesBySource,
  materialDraftsFromComposition,
  stageResultStatusLabel,
  techCardAllowsStageExecution,
  techCardShowsCurrentStageBadge,
  techCardStatusTone,
  TECH_CARD_MEDIA_MAX,
  unitLineSizeTypeLabel,
  type TechCardMaterialDraftLine,
  validateTechCardImageFile,
} from "@/lib/production/tech-cards";
import { techCardVisibleNumber } from "@/lib/production/tech-card-display";
import type {
  ApiTechnicalCard,
  ApiTechnicalCardCompositionLine,
  ApiTechnicalCardMedia,
  ApiTechnicalCardOperationLine,
  ApiTechnicalCardStageResult,
  ApiTechnicalCardUnitLine,
} from "@/lib/sales/order-tech-cards-api";
import type { WorkCenter } from "@/lib/shop-routings";
import { techCardStatusLabel } from "@/lib/sales/order-tech-cards";
import { techCardWipStatusLabel } from "@/lib/production/tech-card-scan";
import type { SizeGrid } from "@/lib/size-grids";
import {
  assemblyOperationLineTotal,
  formatAssemblyCost,
} from "@/lib/product-models";

const XL_COLLAB_MQ = "(min-width: 1280px)";

const MANAGER_DOC_TABS = [
  { id: "operations", label: "Операции" },
  { id: "scheme", label: "Схема" },
  { id: "assembly", label: "Сборки" },
  { id: "materials", label: "Материалы" },
  { id: "route", label: "Маршрут" },
] as const;

type ManagerDocTabId = (typeof MANAGER_DOC_TABS)[number]["id"];

function useXlCollabRail() {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(XL_COLLAB_MQ);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(XL_COLLAB_MQ).matches,
    () => false,
  );
}

const COLLAB_RAIL_STICKY =
  "xl:sticky xl:top-3 xl:max-h-[calc(100vh-5rem)] xl:overflow-auto";

function TechCardOrderCollaboration({
  card,
  surface,
}: {
  card: ApiTechnicalCard;
  surface: "manager" | "shop";
}) {
  const hasSalesOrder = card.sales_order_id != null;
  const isStandalone = card.order_group_id != null && !hasSalesOrder;
  if (!hasSalesOrder && !isStandalone) {
    return null;
  }
  const isXl = useXlCollabRail();
  const place =
    surface === "manager"
      ? `order-1 md:order-2 xl:order-none xl:col-start-2 xl:row-start-1 xl:row-span-2 ${COLLAB_RAIL_STICKY}`
      : `order-1 xl:order-none xl:col-start-2 xl:row-start-1 ${COLLAB_RAIL_STICKY}`;
  const panel = hasSalesOrder && card.sales_order_id != null ? (
    <OrderCollaborationPanel
      orderId={card.sales_order_id}
      technicalCardId={card.id}
      title={`Переписка · ${card.number}`}
      deepLinkHref={`/sales/orders/${card.sales_order_id}?view=communication`}
    />
  ) : (
    <OrderCollaborationPanel
      standaloneCardId={card.id}
      technicalCardId={card.id}
      title={`Переписка · ${card.number}`}
    />
  );
  if (isXl) {
    return (
      <aside
        data-tech-card-collab-rail
        data-standalone-tech-card-collab={isStandalone ? "true" : undefined}
        aria-label={isStandalone ? "Сотрудничество по техкарте" : "Сотрудничество по заказу"}
        className={`tech-card-doc-collab min-w-0 ${place}`}
      >
        <SectionCard
          title={isStandalone ? "Сотрудничество" : "Сотрудничество по заказу"}
          description="Внутренняя переписка с контекстом этой техкарты (ADR-026)."
          size="compact"
        >
          {panel}
        </SectionCard>
      </aside>
    );
  }
  return (
    <details
      data-tech-card-collab-collapse
      data-standalone-tech-card-collab={isStandalone ? "true" : undefined}
      className={`tech-card-doc-collab min-w-0 rounded-portal-lg border border-portal-border bg-portal-surface p-portal-3 shadow-portal-card ${place}`}
    >
      <summary className="cursor-pointer text-sm font-semibold text-portal-text">
        Переписка
      </summary>
      <div className="mt-3 min-w-0">{panel}</div>
    </details>
  );
}

export type TechCardRoutingOption = {
  id: number;
  name: string;
  code: string | null;
  is_active: boolean;
};

export type TechCardMaterialOption = {
  id: number;
  name: string;
  unit: string;
  is_active: boolean;
};

export type TechCardProductionStageOption = {
  id: number;
  name: string;
  code: string;
  is_active: boolean;
};

type TechCardDetailWorkspaceProps = {
  card: ApiTechnicalCard;
  routings: TechCardRoutingOption[];
  materials: TechCardMaterialOption[];
  productionStages: TechCardProductionStageOption[];
  listOrderId?: string;
  /** When opened from a цех queue (`?stage=`), scopes actions and material fact UI. */
  shopStageCode?: string;
  /** Active work centers for print shop (`11.6`). */
  workCenters?: WorkCenter[];
  unitSizeGrid?: SizeGrid | null;
};

type UnitLineDraft = {
  id: number;
  unit_index: number;
  size_type?: string | null;
  size?: string | null;
  personalization?: string | null;
  print_number?: string | null;
  notes?: string | null;
};

let materialDraftKeySeq = 0;
let unitLineDraftTempIdSeq = -1;
function nextMaterialDraftKey(): string {
  materialDraftKeySeq += 1;
  return `new-${materialDraftKeySeq}`;
}

function nextUnitLineDraftId(): number {
  const next = unitLineDraftTempIdSeq;
  unitLineDraftTempIdSeq -= 1;
  return next;
}

function stageTone(status: string): "neutral" | "primary" | "success" | "warning" {
  if (status === "in_progress") return "primary";
  if (status === "completed") return "success";
  if (status === "skipped") return "warning";
  return "neutral";
}

function sortMedia(items: ApiTechnicalCardMedia[]): ApiTechnicalCardMedia[] {
  return [...items].sort(
    (a, b) =>
      Number(b.is_primary) - Number(a.is_primary) ||
      a.sort_order - b.sort_order ||
      a.id - b.id,
  );
}

function unitLineToDraft(line: ApiTechnicalCardUnitLine): UnitLineDraft {
  return {
    id: line.id,
    unit_index: line.unit_index,
    size_type: line.size_type ?? null,
    size: line.size ?? null,
    personalization: line.personalization ?? null,
    print_number: line.print_number ?? null,
    notes: line.notes ?? null,
  };
}

function normalizeUnitLineValue(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

function normalizeUnitSizeValue(value: string | null | undefined): string {
  const raw = value?.trim() ?? "";
  if (!raw) return "";
  const parts = raw.split("/");
  if (parts.length !== 2) return raw;
  const [ru, intLabel] = parts;
  const left = ru?.trim() ?? "";
  const right = intLabel?.trim() ?? "";
  if (!left || !right) return raw;
  return `${left} / ${right}`;
}

function reindexUnitLineDrafts(lines: UnitLineDraft[]): UnitLineDraft[] {
  return lines.map((line, index) => ({
    ...line,
    unit_index: index + 1,
  }));
}

function unitLineDraftsEqual(left: UnitLineDraft[], right: UnitLineDraft[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((draft, index) => {
    const other = right[index];
    if (!other) return false;
    return (
      draft.id === other.id &&
      draft.unit_index === other.unit_index &&
      normalizeUnitLineValue(draft.size_type) === normalizeUnitLineValue(other.size_type) &&
      normalizeUnitSizeValue(draft.size) === normalizeUnitSizeValue(other.size) &&
      normalizeUnitLineValue(draft.personalization) ===
        normalizeUnitLineValue(other.personalization) &&
      normalizeUnitLineValue(draft.print_number) ===
        normalizeUnitLineValue(other.print_number) &&
      normalizeUnitLineValue(draft.notes) === normalizeUnitLineValue(other.notes)
    );
  });
}

function openGeneratedPrintForm(
  render: {
  output_format: string;
  content: string;
  content_type: string;
  file_name: string;
  content_encoding?: string;
},
  options?: { autoPrint?: boolean },
): string | null {
  if (render.output_format === "html") {
    const printToolbar = `
<style>
  .sl-print-toolbar {
    position: fixed;
    top: 12px;
    right: 12px;
    z-index: 2147483647;
    display: flex;
    gap: 8px;
    align-items: center;
    padding: 8px 10px;
    border-radius: 999px;
    background: rgba(17, 24, 39, 0.92);
    box-shadow: 0 10px 30px rgba(15, 23, 42, 0.22);
    color: #fff;
    font: 500 12px/1.2 Arial, sans-serif;
  }
  .sl-print-toolbar__hint {
    white-space: nowrap;
  }
  .sl-print-toolbar__button {
    appearance: none;
    border: 0;
    border-radius: 999px;
    padding: 8px 12px;
    background: #fff;
    color: #111827;
    font: inherit;
    cursor: pointer;
  }
  .sl-print-toolbar__button:hover {
    background: #e5e7eb;
  }
  @media print {
    .sl-print-toolbar {
      display: none !important;
    }
  }
</style>
<div class="sl-print-toolbar" data-print-toolbar>
  <span class="sl-print-toolbar__hint">A4 / PDF</span>
  <button type="button" class="sl-print-toolbar__button" onclick="window.print()">PDF</button>
</div>`;
    const printScript = `
<script>
  window.addEventListener("load", () => {
    document.title = ${JSON.stringify(render.file_name.replace(/\.[^.]+$/, ""))};
    ${
      options?.autoPrint
        ? 'window.setTimeout(() => window.print(), 150);'
        : ""
    }
  });
</script>`;
    const html = render.content.includes("</body>")
      ? render.content.replace("</body>", `${printToolbar}${printScript}</body>`)
      : `${render.content}${printToolbar}${printScript}`;
    const blob = new Blob([html], { type: render.content_type });
    const url = URL.createObjectURL(blob);
    const popup = window.open(url, "_blank", "noopener,noreferrer");
    if (!popup) {
      URL.revokeObjectURL(url);
      return "Браузер заблокировал окно печати. Разрешите popup и повторите.";
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return null;
  }

  const blob =
    render.content_encoding === "base64"
      ? new Blob(
          [
            Uint8Array.from(atob(render.content), (char) => char.charCodeAt(0)),
          ],
          { type: render.content_type },
        )
      : new Blob([render.content], { type: render.content_type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = render.file_name;
  link.click();
  URL.revokeObjectURL(url);
  return null;
}

/** PT-07 technical card document workspace. */
export function TechCardDetailWorkspace({
  card,
  routings,
  materials,
  productionStages,
  listOrderId,
  shopStageCode,
  workCenters = [],
  unitSizeGrid,
}: TechCardDetailWorkspaceProps) {
  const router = useRouter();
  const { push: pushToast } = useToast();
  const [isPrintPending, startPrintTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [completingStageOrder, setCompletingStageOrder] = useState<number | null>(null);
  const [performerName, setPerformerName] = useState("");
  const [scrapQty, setScrapQty] = useState("");
  const [reworkQty, setReworkQty] = useState("");
  const [stageNotes, setStageNotes] = useState("");
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const unitImportInputRef = useRef<HTMLInputElement>(null);
  const [materialDrafts, setMaterialDrafts] = useState<TechCardMaterialDraftLine[]>(() =>
    materialDraftsFromComposition(card.composition_lines ?? []),
  );
  const [unitLineDrafts, setUnitLineDrafts] = useState<UnitLineDraft[]>(() =>
    [...(card.unit_lines ?? [])]
      .sort((a, b) => a.unit_index - b.unit_index)
      .map(unitLineToDraft),
  );
  const [unitImportOpen, setUnitImportOpen] = useState(false);
  const [unitImportFile, setUnitImportFile] = useState<File | null>(null);
  const [managerDocTab, setManagerDocTab] = useState<ManagerDocTabId>("operations");
  const [collapsedBlocks, setCollapsedBlocks] = useState({
    history: true,
  });
  const [shopFactDrafts, setShopFactDrafts] = useState<Record<number, string>>({});
  const [shopFactPerformer, setShopFactPerformer] = useState("");
  const [shopFactWorkDone, setShopFactWorkDone] = useState("");
  const [shopFactDuration, setShopFactDuration] = useState("");
  const [shopFactWorkCenterId, setShopFactWorkCenterId] = useState("");
  const [opVolumeDrafts, setOpVolumeDrafts] = useState<Record<number, string>>({});

  // Demo performers (until platform user-per-stage permissions are available).
  const factPerformerOptions = useMemo(
    () => [
      { value: "Мастер", label: "Мастер" },
      { value: "Иванов", label: "Иванов" },
      { value: "Петров", label: "Петров" },
      { value: "Сидоров", label: "Сидоров" },
      { value: "Анна", label: "Анна" },
      { value: "Мария", label: "Мария" },
    ],
    [],
  );

  const shopModules = useMemo(
    () =>
      buildShopStageModulesFromCatalog(
        productionStages.map((row, index) => ({
          code: row.code,
          name: row.name,
          sort_order: index,
          is_active: row.is_active,
          id: row.id,
        })),
        { activeOnly: false },
      ),
    [productionStages],
  );
  const shopStage = shopStageCode
    ? getShopStageModule(shopStageCode, shopModules)
    : null;
  const isShopContext = shopStage != null;
  const shopProductionStage = shopStage
    ? productionStages.find((row) => row.code === shopStage.code) ?? null
    : null;

  const status = asTechCardUiStatus(String(card.status));
  const compositionLines = card.composition_lines ?? [];
  const nonMaterialLines = compositionLines.filter(
    (line) => String(line.line_kind) !== "material",
  );
  const unitLines = [...(card.unit_lines ?? [])].sort(
    (a, b) => a.unit_index - b.unit_index,
  );
  const operationLines = [...(card.operation_lines ?? [])].sort(
    (a, b) => a.sequence - b.sequence,
  );
  const { routing: routingOps, sewing: sewingOps } =
    groupOperationLinesBySource(operationLines);
  const assemblySewingOps = card.assembly_sewing_operations ?? [];
  const mediaItems = sortMedia(card.media_items ?? []);

  const toggleBlock = (key: keyof typeof collapsedBlocks) => {
    setCollapsedBlocks((current) => ({
      ...current,
      [key]: !current[key],
    }));
  };

  useEffect(() => {
    setMaterialDrafts(materialDraftsFromComposition(card.composition_lines ?? []));
  }, [card.id, card.updated_at]);

  useEffect(() => {
    setUnitLineDrafts(
      [...(card.unit_lines ?? [])]
        .sort((a, b) => a.unit_index - b.unit_index)
        .map(unitLineToDraft),
    );
  }, [card.id, card.unit_lines, card.updated_at]);

  useEffect(() => {
    if (!shopProductionStage) {
      setShopFactDrafts({});
      return;
    }
    const next: Record<number, string> = {};
    for (const line of card.composition_lines ?? []) {
      if (
        String(line.line_kind) === "material" &&
        line.production_stage_id === shopProductionStage.id
      ) {
        next[line.id] = line.fact_qty == null ? "" : String(line.fact_qty);
      }
    }
    setShopFactDrafts(next);
  }, [card.composition_lines, card.id, card.updated_at, shopProductionStage]);

  const compositionEditable =
    !isShopContext && status !== "cancelled" && status !== "completed";
  const unitLinesEditable = compositionEditable;
  const persistedUnitLineDrafts = useMemo(
    () => unitLines.map(unitLineToDraft),
    [unitLines],
  );
  const unitLineDraftsDirty = !unitLineDraftsEqual(
    unitLineDrafts,
    persistedUnitLineDrafts,
  );
  const expectedUnitLineCount = Math.max(0, Number(card.quantity) || 0);
  const unitLineCountMatches = unitLineDrafts.length === expectedUnitLineCount;
  const unitSizeOptions = useMemo(() => {
    const seen = new Set<string>();
    const options: string[] = [];
    for (const row of unitSizeGrid?.rows ?? []) {
      const value = normalizeUnitSizeValue(`${row.ru_size} / ${row.int_label}`);
      if (!value || seen.has(value)) continue;
      seen.add(value);
      options.push(value);
    }
    return options;
  }, [unitSizeGrid]);

  const shopMaterialLines = useMemo(() => {
    if (!shopProductionStage) return [] as ApiTechnicalCardCompositionLine[];
    return (card.composition_lines ?? []).filter(
      (line) =>
        String(line.line_kind) === "material" &&
        line.production_stage_id === shopProductionStage.id,
    );
  }, [card.composition_lines, shopProductionStage]);

  const shopOperationLines = useMemo(() => {
    if (!shopProductionStage) return [] as ApiTechnicalCardOperationLine[];
    return (card.operation_lines ?? []).filter(
      (line) =>
        String(line.source_kind ?? "routing") === "routing" &&
        line.production_stage_id === shopProductionStage.id,
    );
  }, [card.operation_lines, shopProductionStage]);

  const shopMissingFactCount = shopMaterialLines.filter(
    (line) => line.fact_qty == null || String(line.fact_qty).trim() === "",
  ).length;

  const materialOptions = useMemo(() => {
    const selectedIds = new Set(
      materialDrafts
        .map((row) => row.nomenclature_id)
        .filter((id): id is number => id != null),
    );
    return materials.filter((row) => row.is_active || selectedIds.has(row.id));
  }, [materials, materialDrafts]);

  const stageResults = useMemo(
    () =>
      [...(card.stage_results ?? [])].sort(
        (a, b) => a.stage_order - b.stage_order || a.id - b.id,
      ),
    [card.stage_results],
  );
  const historyEntries = useMemo(() => buildTechCardHistoryEntries(card), [card]);

  const currentStage = stageResults.find(
    (stage) => stage.stage_order === card.current_stage_order,
  );
  const activeStage =
    currentStage ??
    stageResults.find((stage) => stage.status === "in_progress") ??
    stageResults.find((stage) => stage.status === "pending") ??
    null;

  useEffect(() => {
    if (!shopStage || !activeStage) {
      return;
    }
    if (
      shopStageCodeByTitle(activeStage.stage_label, shopModules) !== shopStage.code
    ) {
      return;
    }
    setShopFactPerformer(activeStage.performer_name ?? "");
    setShopFactWorkDone(activeStage.work_done ?? "");
    setShopFactDuration(
      activeStage.duration_seconds == null ? "" : String(activeStage.duration_seconds),
    );
    setShopFactWorkCenterId(
      activeStage.work_center_id == null ? "" : String(activeStage.work_center_id),
    );
  }, [activeStage, card.id, card.updated_at, shopModules, shopStage]);

  useEffect(() => {
    if (!shopProductionStage) {
      setOpVolumeDrafts({});
      return;
    }
    const next: Record<number, string> = {};
    for (const line of card.operation_lines ?? []) {
      if (
        String(line.source_kind ?? "routing") === "routing" &&
        line.production_stage_id === shopProductionStage.id
      ) {
        next[line.id] = String(line.volume ?? "");
      }
    }
    setOpVolumeDrafts(next);
  }, [card.id, card.operation_lines, card.updated_at, shopProductionStage]);

  const shopStageMatchesCurrent =
    shopStage != null &&
    (shopStageCodeByTitle(card.current_stage_label, shopModules) ===
      shopStage.code ||
      shopStageCodeByTitle(activeStage?.stage_label, shopModules) ===
        shopStage.code);
  const shopActionsAllowed = !isShopContext || shopStageMatchesCurrent;

  const listHref = shopStage
    ? shopStage.href
    : listOrderId
      ? `/production/tech-cards?orderId=${encodeURIComponent(listOrderId)}`
      : "/production/tech-cards";
  const listLabel = shopStage ? `← ${shopStage.title}` : "← Техкарты";

  const completingStage =
    stageResults.find((stage) => stage.stage_order === completingStageOrder) ?? null;

  const canStartCard =
    !isShopContext && status === "draft" && stageResults.length > 0;

  const stageExecutionAllowed = techCardAllowsStageExecution(status);

  const canCompleteActiveStage =
    shopActionsAllowed &&
    stageExecutionAllowed &&
    activeStage != null &&
    (activeStage.status === "in_progress" || activeStage.status === "pending");

  const canRollbackActiveStage =
    shopActionsAllowed &&
    stageExecutionAllowed &&
    activeStage != null &&
    activeStage.status === "completed";

  const canStartActiveStage =
    shopActionsAllowed &&
    stageExecutionAllowed &&
    activeStage != null &&
    activeStage.status === "pending";

  const showCurrentStageBadge =
    techCardShowsCurrentStageBadge(status) && Boolean(card.current_stage_label);

  const documentNumber = techCardVisibleNumber(card);
  const hasSalesOrder = card.sales_order_id != null;
  const showCollabRail = hasSalesOrder || card.order_group_id != null;

  const managerDocTabItems = useMemo(
    () =>
      MANAGER_DOC_TABS.map((tab) => {
        let count: number | undefined;
        switch (tab.id) {
          case "operations":
            count = routingOps.length;
            break;
          case "scheme":
            count =
              assemblySewingOps.length > 0
                ? assemblySewingOps.length
                : sewingOps.length;
            break;
          case "assembly":
            count = unitLineDrafts.length;
            break;
          case "materials":
            count = materialDrafts.length;
            break;
          case "route":
            count = stageResults.length;
            break;
        }
        return { ...tab, count };
      }),
    [
      assemblySewingOps.length,
      materialDrafts.length,
      routingOps.length,
      sewingOps.length,
      stageResults.length,
      unitLineDrafts.length,
    ],
  );

  const onImportUnitLines = () => {
    if (!unitImportFile) {
      setActionError("Выберите XLSX-файл для импорта");
      return;
    }
    const formData = new FormData();
    formData.append("file", unitImportFile);
    void runAction(() =>
      importUnitLinesFileAction(card.id, formData, card.sales_order_id),
    ).then((result) => {
      if (!result?.ok) return;
      setUnitImportFile(null);
      if (unitImportInputRef.current) {
        unitImportInputRef.current.value = "";
      }
    });
  };

  const updateUnitLineDraft = (
    lineId: number,
    field: keyof Omit<UnitLineDraft, "id" | "unit_index">,
    value: string,
  ) => {
    setUnitLineDrafts((current) =>
      current.map((line) =>
        line.id === lineId
          ? {
              ...line,
              [field]: value,
            }
          : line,
      ),
    );
    setActionError(null);
  };

  const resetUnitLineDrafts = () => {
    setUnitLineDrafts(persistedUnitLineDrafts);
    setActionError(null);
  };

  const addUnitLineDraft = () => {
    setUnitLineDrafts((current) =>
      reindexUnitLineDrafts([
        ...current,
        {
          id: nextUnitLineDraftId(),
          unit_index: current.length + 1,
          size_type: current[0]?.size_type ?? null,
          size: null,
          personalization: null,
          print_number: null,
          notes: null,
        },
      ]),
    );
    setActionError(null);
  };

  const removeUnitLineDraft = (lineId: number) => {
    setUnitLineDrafts((current) =>
      reindexUnitLineDrafts(current.filter((line) => line.id !== lineId)),
    );
    setActionError(null);
  };

  const onSaveUnitLines = () => {
    void runAction(
      () =>
        replaceUnitLinesAction(
          card.id,
          unitLineDrafts.map((line) => ({
            unit_index: line.unit_index,
            size_type: normalizeUnitLineValue(line.size_type) || null,
            size: normalizeUnitSizeValue(line.size) || null,
            personalization: normalizeUnitLineValue(line.personalization) || null,
            print_number: normalizeUnitLineValue(line.print_number) || null,
            notes: normalizeUnitLineValue(line.notes) || null,
          })),
          card.sales_order_id,
        ),
      { skipRefresh: true },
    ).then((result) => {
      if (!result?.ok) return;
      const nextCard = result.card;
      if (!nextCard) return;
      setUnitLineDrafts(
        [...(nextCard.unit_lines ?? [])]
          .sort((a, b) => a.unit_index - b.unit_index)
          .map(unitLineToDraft),
      );
    });
  };

  const openCompleteForm = (stageOrder: number) => {
    if (
      isShopContext &&
      (!shopStageMatchesCurrent || activeStage?.stage_order !== stageOrder)
    ) {
      setActionError(
        `Действия доступны только для текущего этапа цеха «${shopStage?.title ?? ""}». Обход порядка этапов запрещён.`,
      );
      return;
    }
    setCompletingStageOrder(stageOrder);
    setCompleteOpen(true);
  };

  const assertShopStageAction = (stageOrder: number): boolean => {
    if (!isShopContext) return true;
    if (!shopStageMatchesCurrent || activeStage?.stage_order !== stageOrder) {
      setActionError(
        `Действия доступны только для текущего этапа цеха «${shopStage?.title ?? ""}». Обход порядка этапов запрещён.`,
      );
      return false;
    }
    return true;
  };

  const runAction = async (
    action: () => Promise<{
      ok: boolean;
      message: string | null;
      card?: ApiTechnicalCard | null;
    }>,
    options?: { skipRefresh?: boolean },
  ) => {
    setBusy(true);
    setActionError(null);
    try {
      const result = await action();
      if (!result.ok) {
        setActionError(result.message ?? "Ошибка действия");
        setBusy(false);
        return result;
      }
      if (result.message) pushToast(result.message, "success");
      setCompleteOpen(false);
      setCompletingStageOrder(null);
      setPerformerName("");
      setScrapQty("");
      setReworkQty("");
      setStageNotes("");
      if (!options?.skipRefresh) {
        router.refresh();
      }
      setBusy(false);
      return result;
    } catch {
      setActionError("Не удалось выполнить действие");
      setBusy(false);
      return { ok: false, message: "Не удалось выполнить действие", card: null };
    }
  };

  const onPrint = () => {
    startPrintTransition(async () => {
      const result = await generateTechnicalCardPrintForm(
        buildTechnicalCardPrintRequest(card),
      );
      if (result.ok && result.render) {
        const clientMessage = openGeneratedPrintForm(result.render);
        if (clientMessage) {
          pushToast(clientMessage, "danger");
        } else {
          pushToast(result.message, "success");
        }
        return;
      }
      pushToast(result.message, "danger");
    });
  };

  const onSavePdf = () => {
    startPrintTransition(async () => {
      const result = await generateTechnicalCardPrintForm(
        buildTechnicalCardPrintRequest(card, "pdf"),
      );
      if (result.ok && result.render) {
        if (result.render.output_format !== "pdf") {
          pushToast(
            "Сервер вернул не PDF. Проверьте настройки печатной формы техкарты.",
            "danger",
          );
          return;
        }
        const clientMessage = openGeneratedPrintForm(result.render);
        if (clientMessage) {
          pushToast(clientMessage, "danger");
        } else {
          pushToast("PDF сохранён", "success");
        }
        return;
      }
      pushToast(result.message, "danger");
    });
  };

  const onStartCard = () =>
    runAction(() => startTechnicalCardAction(card.id, card.sales_order_id));

  const onStartStage = (stageOrder: number) => {
    if (!assertShopStageAction(stageOrder)) return;
    void runAction(() =>
      startTechnicalCardStageAction(
        card.id,
        stageOrder,
        performerName.trim() ? { performer_name: performerName.trim() } : {},
        card.sales_order_id,
      ),
    );
  };

  const onCompleteStage = () => {
    if (!completingStage) return;
    if (!assertShopStageAction(completingStage.stage_order)) return;
    void (async () => {
      const result = await runAction(
        () =>
          completeTechnicalCardStageAction(
            card.id,
            completingStage.stage_order,
            {
              performer_name: performerName.trim() || null,
              scrap_qty: scrapQty.trim() || null,
              rework_qty: reworkQty.trim() || null,
              notes: stageNotes.trim() || null,
            },
            card.sales_order_id,
            shopStage?.code,
          ),
        { skipRefresh: true },
      );
      if (!result?.ok) return;
      const nextCard = result.card ?? null;
      if (isShopContext && nextCard) {
        if (String(nextCard.status) === "completed") {
          router.push(`/production/tech-cards/${card.id}`);
          return;
        }
        const nextCode = shopStageCodeByTitle(
          nextCard.current_stage_label,
          shopModules,
        );
        if (nextCode && nextCode !== shopStage?.code) {
          router.push(shopStageCardHref(nextCode, card.id));
          return;
        }
      }
      router.refresh();
    })();
  };

  // Shop UX: clicking "Завершить этап" from the "Этап" block must not open
  // the "Завершение этапа ..." confirmation block. For tests we complete
  // immediately using stage-fact performer and null scrap/rework/notes.
  const onCompleteShopStageDirect = (stageOrder: number) => {
    if (!assertShopStageAction(stageOrder)) return;
    void (async () => {
      const durationRaw = shopFactDuration.trim();
      let durationSeconds: number | null = null;
      if (durationRaw) {
        const parsed = Number(durationRaw);
        if (!Number.isInteger(parsed) || parsed < 0) {
          setActionError("Длительность должна быть целым числом секунд ≥ 0");
          return;
        }
        durationSeconds = parsed;
      }
      const result = await runAction(
        () =>
          completeTechnicalCardStageAction(
            card.id,
            stageOrder,
            {
              performer_name: shopFactPerformer.trim() || null,
              work_done: shopFactWorkDone.trim() || null,
              duration_seconds: durationSeconds,
              scrap_qty: scrapQty.trim() || null,
              rework_qty: reworkQty.trim() || null,
              notes: stageNotes.trim() || null,
            },
            card.sales_order_id,
            shopStage?.code,
          ),
        { skipRefresh: true },
      );
      if (!result?.ok) return;
      const nextCard = result.card ?? null;
      if (isShopContext && nextCard) {
        if (String(nextCard.status) === "completed") {
          router.push(`/production/tech-cards/${card.id}`);
          return;
        }
        const nextCode = shopStageCodeByTitle(nextCard.current_stage_label, shopModules);
        if (nextCode && nextCode !== shopStage?.code) {
          router.push(shopStageCardHref(nextCode, card.id));
          return;
        }
      }
      router.refresh();
    })();
  };

  const onRollbackStage = (stageOrder: number) => {
    if (!assertShopStageAction(stageOrder)) return;
    void runAction(() =>
      rollbackTechnicalCardStageKanbanAction(
        card.id,
        stageOrder,
        card.sales_order_id,
      ),
    );
  };

  const onSaveShopFactQty = (lineId: number) => {
    const value = (shopFactDrafts[lineId] ?? "").trim();
    if (!value) {
      setActionError("Укажите фактическое количество материала");
      return;
    }
    void runAction(() =>
      setCompositionFactQtyAction(
        card.id,
        lineId,
        value,
        card.sales_order_id,
        shopStage?.code,
      ),
    );
  };

  const onSaveAllShopFactQty = () => {
    void (async () => {
      setBusy(true);
      setActionError(null);
      try {
        // Stage fact fields first (performer / work / duration / equipment).
        if (activeStage && shopStage && shopStageMatchesCurrent) {
          const durationRaw = shopFactDuration.trim();
          let durationSeconds: number | null = null;
          if (durationRaw) {
            const parsed = Number(durationRaw);
            if (!Number.isInteger(parsed) || parsed < 0) {
              setActionError("Длительность должна быть целым числом секунд ≥ 0");
              setBusy(false);
              return;
            }
            durationSeconds = parsed;
          }
          const stageResult = await updateStageFactAction(
            card.id,
            activeStage.stage_order,
            {
              performer_name: shopFactPerformer.trim() || null,
              work_done: shopFactWorkDone.trim() || null,
              duration_seconds: durationSeconds,
              work_center_id: shopFactWorkCenterId
                ? Number(shopFactWorkCenterId)
                : null,
              shop_stage_code: shopStage.code,
            },
            card.sales_order_id,
            shopStage.code,
          );
          if (!stageResult.ok) {
            setActionError(stageResult.message ?? "Не удалось сохранить факт этапа");
            setBusy(false);
            return;
          }
        }

        for (const line of shopMaterialLines) {
          const value = (shopFactDrafts[line.id] ?? "").trim();
          if (!value) continue;
          const result = await setCompositionFactQtyAction(
            card.id,
            line.id,
            value,
            card.sales_order_id,
            shopStage?.code,
          );
          if (!result.ok) {
            setActionError(result.message ?? "Не удалось сохранить факт материалов");
            setBusy(false);
            return;
          }
        }

        if (shopStage?.code === "print") {
          for (const line of shopOperationLines) {
            const value = (opVolumeDrafts[line.id] ?? "").trim();
            if (!value) continue;
            const result = await updateOperationLineVolumeAction(
              card.id,
              line.id,
              value,
              card.sales_order_id,
              shopStage.code,
            );
            if (!result.ok) {
              setActionError(result.message ?? "Не удалось сохранить объёмы операций");
              setBusy(false);
              return;
            }
          }
        }

        pushToast("Факт цеха сохранён", "success");
        router.refresh();
      } catch {
        setActionError("Не удалось сохранить факт цеха");
      }
      setBusy(false);
    })();
  };

  const onDeleteShopMaterial = (lineId: number) => {
    void runAction(() =>
      deleteCompositionLineAction(
        card.id,
        lineId,
        card.sales_order_id,
        shopStage?.code,
      ),
    );
  };

  const onSaveShopStageFact = () => {
    if (!activeStage || !shopStage) return;
    if (!shopStageMatchesCurrent) {
      setActionError(
        `Факт цеха «${shopStage.title}» доступен только на текущем этапе маршрута.`,
      );
      return;
    }
    const durationRaw = shopFactDuration.trim();
    let durationSeconds: number | null = null;
    if (durationRaw) {
      const parsed = Number(durationRaw);
      if (!Number.isInteger(parsed) || parsed < 0) {
        setActionError("Длительность должна быть целым числом секунд ≥ 0");
        return;
      }
      durationSeconds = parsed;
    }
    void runAction(() =>
      updateStageFactAction(
        card.id,
        activeStage.stage_order,
        {
          performer_name: shopFactPerformer.trim() || null,
          work_done: shopFactWorkDone.trim() || null,
          duration_seconds: durationSeconds,
          scrap_qty: scrapQty.trim() || null,
          rework_qty: reworkQty.trim() || null,
          notes: stageNotes.trim() || null,
          work_center_id: shopFactWorkCenterId
            ? Number(shopFactWorkCenterId)
            : null,
          shop_stage_code: shopStage.code,
        },
        card.sales_order_id,
        shopStage.code,
      ),
    );
  };

  const onSaveOpVolume = (lineId: number) => {
    const value = (opVolumeDrafts[lineId] ?? "").trim();
    if (!value) {
      setActionError("Укажите фактический объём операции");
      return;
    }
    void runAction(() =>
      updateOperationLineVolumeAction(
        card.id,
        lineId,
        value,
        card.sales_order_id,
        shopStage?.code,
      ),
    );
  };

  const onSaveAllOpVolumes = () => {
    onSaveAllShopFactQty();
  };

  const onApplyRouting = (routingTemplateId: number) => {
    void runAction(() =>
      applyRoutingAction(card.id, routingTemplateId, card.sales_order_id),
    );
  };

  const onAddMaterialRow = () => {
    setMaterialDrafts((rows) => [
      ...rows,
      {
        key: nextMaterialDraftKey(),
        nomenclature_id: null,
        snapshot_name: "",
        quantity: "",
        fact_qty: "",
        unit: "",
        production_stage_id: null,
        notes: "",
      },
    ]);
  };

  const onRemoveMaterialRow = (key: string) => {
    setMaterialDrafts((rows) => rows.filter((row) => row.key !== key));
  };

  const onMaterialNomenclatureChange = (key: string, nomenclatureId: number | null) => {
    const selected =
      nomenclatureId == null
        ? null
        : materials.find((row) => row.id === nomenclatureId) ?? null;
    setMaterialDrafts((rows) =>
      rows.map((row) =>
        row.key === key
          ? {
              ...row,
              nomenclature_id: selected?.id ?? null,
              snapshot_name: selected?.name ?? "",
              unit: selected?.unit ?? "",
            }
          : row,
      ),
    );
  };

  const onMaterialFieldChange = (
    key: string,
    field: "quantity" | "unit",
    value: string,
  ) => {
    setMaterialDrafts((rows) =>
      rows.map((row) => (row.key === key ? { ...row, [field]: value } : row)),
    );
  };

  const onMaterialStageChange = (key: string, productionStageId: number | null) => {
    setMaterialDrafts((rows) =>
      rows.map((row) =>
        row.key === key ? { ...row, production_stage_id: productionStageId } : row,
      ),
    );
  };

  const stageLabel = (stageId: number | null) => {
    if (stageId == null) return "—";
    const stage = productionStages.find((row) => row.id === stageId);
    return stage ? stage.name : `#${stageId}`;
  };

  const onSaveComposition = () => {
    const incomplete = materialDrafts.some(
      (row) =>
        (row.nomenclature_id == null &&
          (row.snapshot_name.trim() || row.quantity.trim() || row.unit.trim())) ||
        (row.nomenclature_id != null && !row.snapshot_name.trim()),
    );
    if (incomplete) {
      setActionError("Выберите номенклатуру типа «Материал» для каждой заполняемой строки");
      return;
    }
    const lines = buildCompositionReplaceLines(compositionLines, materialDrafts);
    void runAction(() =>
      replaceCompositionAction(card.id, lines, card.sales_order_id),
    );
  };

  const onAddMedia = (files: File[]) => {
    void (async () => {
      const invalid = files.map(validateTechCardImageFile).find(Boolean);
      if (invalid) {
        setActionError(invalid);
        return;
      }
      if (mediaItems.length + files.length > TECH_CARD_MEDIA_MAX) {
        setActionError(`Можно загрузить не более ${TECH_CARD_MEDIA_MAX} изображений`);
        return;
      }
      setBusy(true);
      setActionError(null);
      try {
        const formData = new FormData();
        for (const file of files) formData.append("files", file);
        if (mediaItems.length === 0) formData.set("is_primary", "1");
        const result = await uploadTechCardMediaAction(card.id, formData, {
          currentCount: mediaItems.length,
          orderId: card.sales_order_id,
        });
        if (!result.ok) {
          setActionError(result.message ?? "Ошибка загрузки");
          setBusy(false);
          return;
        }
        if (result.message) pushToast(result.message, "success");
        router.refresh();
      } catch {
        setActionError("Не удалось загрузить изображение");
      }
      setBusy(false);
    })();
  };

  const onReplaceMedia = (item: ApiTechnicalCardMedia, file: File) => {
    void (async () => {
      const invalid = validateTechCardImageFile(file);
      if (invalid) {
        setActionError(invalid);
        return;
      }
      setBusy(true);
      setActionError(null);
      try {
        // Delete first so max-3 cards can replace without hitting the cap.
        const deleted = await deleteTechCardMediaAction(
          card.id,
          item.id,
          card.sales_order_id,
        );
        if (!deleted.ok) {
          setActionError(deleted.message ?? "Не удалось удалить старое изображение");
          setBusy(false);
          return;
        }
        const formData = new FormData();
        formData.append("files", file);
        if (item.is_primary) formData.set("is_primary", "1");
        const uploaded = await uploadTechCardMediaAction(card.id, formData, {
          currentCount: Math.max(0, mediaItems.length - 1),
          orderId: card.sales_order_id,
        });
        if (!uploaded.ok) {
          setActionError(uploaded.message ?? "Старое удалено, новое не загружено");
          setBusy(false);
          router.refresh();
          return;
        }
        pushToast("Изображение заменено", "success");
        router.refresh();
      } catch {
        setActionError("Не удалось заменить изображение");
      }
      setBusy(false);
    })();
  };

  const onSetPrimaryMedia = (item: ApiTechnicalCardMedia) => {
    void runAction(async () => {
      const result = await setTechCardMediaPrimaryAction(
        card.id,
        item.id,
        card.sales_order_id,
      );
      return { ok: result.ok, message: result.message };
    });
  };

  const onDeleteMedia = (item: ApiTechnicalCardMedia) => {
    void runAction(async () => {
      const result = await deleteTechCardMediaAction(
        card.id,
        item.id,
        card.sales_order_id,
      );
      return { ok: result.ok, message: result.message };
    });
  };

  return (
    <DocumentCard
      header={
        <div className="rounded-portal-lg border border-portal-border bg-portal-surface p-portal-4 shadow-portal-card sm:p-portal-5">
          <EntityHeader
            eyebrow={
              <Link href={listHref} className="text-portal-primary hover:underline">
                {listLabel}
              </Link>
            }
            title={card.number}
            description={
              <TechCardProductNameHeader
                card={card}
                allowEdit={!isShopContext}
                disabled={busy || status === "cancelled"}
              />
            }
            status={
              <>
                {isShopContext && activeStage ? (
                  <StatusBadge
                    size="compact"
                    tone={
                      activeStage.status === "in_progress"
                        ? "primary"
                        : activeStage.status === "completed"
                          ? "success"
                          : activeStage.status === "pending"
                            ? "warning"
                            : "neutral"
                    }
                  >
                    {stageResultStatusLabel(String(activeStage.status))}
                  </StatusBadge>
                ) : (
                  <StatusBadge size="compact" tone={techCardStatusTone(status)}>
                    {techCardStatusLabel(status)}
                  </StatusBadge>
                )}
                {showCurrentStageBadge ? (
                  <StatusBadge size="compact" tone="neutral">
                    {card.current_stage_label}
                  </StatusBadge>
                ) : null}
                {card.wip_status ? (
                  <StatusBadge
                    size="compact"
                    tone={
                      card.wip_status === "return"
                        ? "danger"
                        : card.wip_status === "ready"
                          ? "success"
                          : card.wip_status === "partial_ready"
                            ? "warning"
                            : "primary"
                    }
                  >
                    {techCardWipStatusLabel(card.wip_status)}
                  </StatusBadge>
                ) : null}
              </>
            }
            actions={
              <div className="flex flex-wrap items-center gap-portal-2">
                {canStartCard ? (
                  <IconButton
                    label="Запустить ТК"
                    variant="primary"
                    disabled={busy}
                    onClick={() => void onStartCard()}
                  >
                    <Play className="size-4" aria-hidden="true" />
                  </IconButton>
                ) : null}
                {canStartActiveStage && activeStage ? (
                  <IconButton
                    label="Начать этап"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => onStartStage(activeStage.stage_order)}
                  >
                    <Play className="size-4" aria-hidden="true" />
                  </IconButton>
                ) : null}
                {canCompleteActiveStage && activeStage ? (
                  <IconButton
                    label="Завершить этап"
                    variant="primary"
                    disabled={busy}
                    onClick={() => openCompleteForm(activeStage.stage_order)}
                  >
                    <CheckCircle2 className="size-4" aria-hidden="true" />
                  </IconButton>
                ) : null}
                {canRollbackActiveStage && activeStage ? (
                  <IconButton
                    label="Откатить этап"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => onRollbackStage(activeStage.stage_order)}
                  >
                    <RotateCcw className="size-4" aria-hidden="true" />
                  </IconButton>
                ) : null}
                <IconButton
                  label="Печать"
                  variant="secondary"
                  disabled={busy || isPrintPending}
                  onClick={onPrint}
                >
                  <Printer className="size-4" aria-hidden="true" />
                </IconButton>
                <IconButton
                  label="PDF"
                  variant="secondary"
                  disabled={busy || isPrintPending}
                  onClick={onSavePdf}
                >
                  <FileDown className="size-4" aria-hidden="true" />
                </IconButton>
                {hasSalesOrder ? (
                <Link
                  href={`/sales/orders/${card.sales_order_id}`}
                  className="portal-focus-ring inline-flex size-portal-control-icon items-center justify-center rounded-portal-md border border-portal-border bg-portal-surface text-portal-text hover:bg-portal-state-hover"
                  aria-label="Открыть заказ"
                  title="Открыть заказ"
                >
                  <ExternalLink className="size-4" aria-hidden="true" />
                </Link>
                ) : null}
              </div>
            }
          />
        </div>
      }
    >
      {previewSrc ? (
        <ImageLightbox
          src={previewSrc}
          alt={`Макет: ${card.number}`}
          onClose={() => setPreviewSrc(null)}
        />
      ) : null}

      {actionError ? (
        <p
          className="rounded-portal-md border border-portal-danger/30 bg-portal-danger-soft px-portal-4 py-portal-2 text-portal-body text-portal-danger"
          role="alert"
        >
          {actionError}
        </p>
      ) : null}

      {completeOpen && completingStage ? (
        <SectionCard
          title={`Завершение этапа ${completingStage.stage_order}: ${completingStage.stage_label}`}
          size="compact"
        >
          <div className="grid gap-portal-4 min-[900px]:grid-cols-2">
            <Field label="Исполнитель">
              <Input
                value={performerName}
                onChange={(event) => setPerformerName(event.target.value)}
                disabled={busy}
              />
            </Field>
            <Field label="Брак, шт">
              <Input
                value={scrapQty}
                onChange={(event) => setScrapQty(event.target.value)}
                disabled={busy}
                inputMode="decimal"
              />
            </Field>
            <Field label="Доработка, шт">
              <Input
                value={reworkQty}
                onChange={(event) => setReworkQty(event.target.value)}
                disabled={busy}
                inputMode="decimal"
              />
            </Field>
            <Field label="Примечание" className="min-[900px]:col-span-2">
              <Textarea
                value={stageNotes}
                onChange={(event) => setStageNotes(event.target.value)}
                disabled={busy}
                rows={3}
              />
            </Field>
          </div>
          <div className="mt-portal-4 flex flex-wrap gap-portal-2">
            <Button type="button" variant="primary" disabled={busy} onClick={onCompleteStage}>
              {busy ? "Сохранение…" : "Подтвердить завершение"}
            </Button>
            <Button type="button" disabled={busy} onClick={() => setCompleteOpen(false)}>
              Отмена
            </Button>
          </div>
        </SectionCard>
      ) : null}

      {isShopContext && shopStage ? (
        <div
          className={`tech-card-doc-layout grid min-w-0 items-start gap-4 ${
            showCollabRail ? "xl:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)]" : ""
          }`}
          data-tech-card-doc-layout="shop"
        >
          <TechCardOrderCollaboration card={card} surface="shop" />
          <div className="tech-card-doc-rest order-2 min-w-0 xl:order-none xl:col-start-1 xl:row-start-1">
        <TechCardShopFloorBody
          card={card}
          shopStage={shopStage}
          shopStageMatchesCurrent={shopStageMatchesCurrent}
          hideStageFact={completeOpen}
          mediaItems={mediaItems}
          shopMaterialLines={shopMaterialLines}
          shopMissingFactCount={shopMissingFactCount}
          shopFactDrafts={shopFactDrafts}
          setShopFactDrafts={setShopFactDrafts}
          activeStage={activeStage}
          stageResults={stageResults}
          busy={busy}
          canStartActiveStage={canStartActiveStage}
          canCompleteActiveStage={canCompleteActiveStage}
          canRollbackActiveStage={canRollbackActiveStage}
          factPerformer={shopFactPerformer}
          factPerformerOptions={factPerformerOptions}
          factWorkDone={shopFactWorkDone}
          factDuration={shopFactDuration}
          scrapQty={scrapQty}
          reworkQty={reworkQty}
          stageNotes={stageNotes}
          setFactPerformer={setShopFactPerformer}
          setFactWorkDone={setShopFactWorkDone}
          setFactDuration={setShopFactDuration}
          setScrapQty={setScrapQty}
          setReworkQty={setReworkQty}
          setStageNotes={setStageNotes}
          factWorkCenterId={shopFactWorkCenterId}
          setFactWorkCenterId={setShopFactWorkCenterId}
          workCenters={workCenters}
          shopOperationLines={shopOperationLines}
          opVolumeDrafts={opVolumeDrafts}
          setOpVolumeDrafts={setOpVolumeDrafts}
          onSaveOpVolume={onSaveOpVolume}
          onSaveAllOpVolumes={onSaveAllOpVolumes}
          assemblySewingOps={assemblySewingOps}
          onExpandMedia={setPreviewSrc}
          onSetPrimaryMedia={onSetPrimaryMedia}
          onDeleteMedia={onDeleteMedia}
          onReplaceMedia={onReplaceMedia}
          onAddMedia={onAddMedia}
          onSaveShopFactQty={onSaveShopFactQty}
          onSaveAllShopFactQty={onSaveAllShopFactQty}
          onDeleteShopMaterial={onDeleteShopMaterial}
          onSaveStageFact={onSaveShopStageFact}
          onStartActiveStage={() => {
            if (activeStage) onStartStage(activeStage.stage_order);
          }}
          onCompleteActiveStage={() => {
            if (activeStage) onCompleteShopStageDirect(activeStage.stage_order);
          }}
          onRollbackActiveStage={() => {
            if (activeStage) onRollbackStage(activeStage.stage_order);
          }}
        />
          </div>
        </div>
      ) : (
      <div
        className={`tech-card-doc-layout grid min-w-0 items-start gap-4 ${
          showCollabRail ? "xl:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)]" : ""
        }`}
        data-tech-card-doc-layout="manager"
      >
      <div className="tech-card-doc-row1 order-2 min-w-0 md:order-1 xl:order-none xl:col-start-1 xl:row-start-1">
      {!hasSalesOrder ? (
        <div className="mb-portal-4">
          <StandaloneTechCardLinkPanel cardId={card.id} disabled={busy} />
        </div>
      ) : null}
      <div className="grid grid-cols-1 gap-portal-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,4fr)_minmax(0,4fr)]">
        <SectionCard
          title="Макет"
          size="compact"
          collapsed={false}
        >
          <TechCardMediaCarousel
            items={mediaItems}
            busy={busy}
            onExpand={setPreviewSrc}
            onSetPrimary={onSetPrimaryMedia}
            onDelete={onDeleteMedia}
            onReplace={onReplaceMedia}
            onAdd={onAddMedia}
          />
        </SectionCard>

        <TechCardOrderDataCard
          card={card}
          documentNumber={documentNumber}
          disabled={busy || status === "cancelled"}
        />

        <TechCardModelRouteCard
          card={card}
          routings={routings}
          disabled={busy || status === "cancelled"}
          onApplyRouting={onApplyRouting}
        />
      </div>
      </div>
      <TechCardOrderCollaboration card={card} surface="manager" />
      <div className="tech-card-doc-rest order-3 min-w-0 flex flex-col gap-portal-4 xl:order-none xl:col-start-1 xl:row-start-2">

      <div
        data-tech-card-doc-tabs
        className="min-w-0 rounded-portal-lg border border-portal-border bg-portal-surface p-portal-4 shadow-portal-card"
      >
        <CompactTabs
          label="Разделы техкарты"
          items={managerDocTabItems}
          value={managerDocTab}
          onChange={(id) => setManagerDocTab(id as ManagerDocTabId)}
          wrap
          variant="pills"
          size="default"
        />

        <div
          role="tabpanel"
          data-tech-card-doc-tab-panel={managerDocTab}
          className="mt-portal-4 min-w-0"
        >
          {managerDocTab === "operations" ? (
            <div data-tech-card-doc-row3 data-tech-card-tab="operations">
              <SectionCard title="Операции / объёмы" size="compact" className="border-0 p-0 shadow-none">
                {routingOps.length === 0 ? (
                  <EmptyState
                    title="Операции маршрута не заданы"
                    description="Выберите маршрут, чтобы заполнить операции."
                  />
                ) : (
                  <div className="space-y-portal-3">
                    {routingOps.map((line) => (
                      <div
                        key={line.id}
                        className="rounded-portal-md border border-portal-border px-portal-4 py-portal-3"
                      >
                        <div className="grid gap-portal-2 min-[720px]:grid-cols-[3rem_minmax(0,1fr)_5rem_4rem_4rem_minmax(0,8rem)] min-[720px]:items-center">
                          <span className="tabular-nums text-portal-muted">{line.sequence}</span>
                          <span className="font-medium text-portal-text">{line.operation_name}</span>
                          <span className="tabular-nums">{line.volume}</span>
                          <span>{formatVolumeUnit(String(line.volume_unit))}</span>
                          <span className="text-portal-muted">{line.stage_order ?? "—"}</span>
                          <span className="text-portal-muted">{line.stage_label ?? "—"}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>
            </div>
          ) : null}

          {managerDocTab === "scheme" ? (
            <div data-tech-card-doc-tab="scheme">
              <SectionCard
                title="Схема сборки изделия"
                description={
                  card.assembly_variant_name
                    ? `Вариант: ${card.assembly_variant_name}`
                    : "Снимок швейных операций выбранного варианта сборки."
                }
                size="compact"
                className="border-0 p-0 shadow-none"
              >
                <AssemblySchemeBlock
                  assemblySewingOps={assemblySewingOps}
                  sewingOps={sewingOps}
                />
              </SectionCard>
            </div>
          ) : null}

          {managerDocTab === "assembly" ? (
            <div data-tech-card-doc-row2 data-tech-card-doc-tab="assembly">
              <SectionCard
                title="Персонализация"
                description="Размеры и персонализация по единицам."
                size="compact"
                className="border-0 p-0 shadow-none"
                actions={
                  <div className="flex flex-wrap items-center gap-portal-2">
                    <Button
                      type="button"
                      size="compact"
                      onClick={() => setUnitImportOpen((current) => !current)}
                      disabled={busy || !unitLinesEditable}
                    >
                      {unitImportOpen ? "Скрыть импорт" : "Импорт XLSX"}
                    </Button>
                  </div>
                }
              >
                {unitImportOpen ? (
                  <div className="mb-portal-4 grid gap-portal-3 rounded-portal-md border border-portal-border p-portal-4">
                    <Field
                      label="Файл импорта"
                      help="Загрузите XLSX по шаблону techcart_example.xlsx. Тип размера = наименование размерной сетки, размер = RU / INT."
                    >
                      <input
                        ref={unitImportInputRef}
                        type="file"
                        accept=".xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                        disabled={busy}
                        className="block w-full text-portal-body text-portal-text file:mr-portal-3 file:rounded-portal-md file:border file:border-portal-border file:bg-portal-surface file:px-portal-3 file:py-portal-2 file:text-portal-caption"
                        aria-label="Файл импорта поштучных строк"
                        onChange={(event) => {
                          setUnitImportFile(event.target.files?.[0] ?? null);
                          setActionError(null);
                        }}
                      />
                    </Field>
                    <p className="text-portal-caption text-portal-muted">
                      Количество в техкарте:{" "}
                      <span className="font-medium text-portal-text">{String(card.quantity)}</span>
                    </p>
                    {unitImportFile ? (
                      <p className="text-portal-caption text-portal-muted">
                        Выбран файл: {unitImportFile.name} ({Math.ceil(unitImportFile.size / 1024)} КБ)
                      </p>
                    ) : null}
                    <div className="flex flex-wrap gap-portal-2">
                      <Button type="button" variant="primary" size="compact" disabled={busy} onClick={onImportUnitLines}>
                        Импортировать
                      </Button>
                      <Button
                        type="button"
                        size="compact"
                        disabled={busy}
                        onClick={() => {
                          setUnitImportFile(null);
                          if (unitImportInputRef.current) {
                            unitImportInputRef.current.value = "";
                          }
                        }}
                      >
                        Очистить
                      </Button>
                    </div>
                  </div>
                ) : null}
                {unitLinesEditable && unitSizeOptions.length === 0 ? (
                  <p className="mb-portal-4 text-portal-caption text-portal-muted">
                    Размерная сетка модели не привязана или пуста. Размер можно менять вручную.
                  </p>
                ) : null}
                {unitLinesEditable ? (
                  <div className="mb-portal-4 flex flex-wrap gap-portal-2">
                    <div className="flex items-center rounded-portal-sm border border-portal-border px-portal-3 text-portal-caption text-portal-muted">
                      {unitLineDrafts.length} / {expectedUnitLineCount}
                    </div>
                    <Button
                      type="button"
                      size="compact"
                      onClick={addUnitLineDraft}
                      disabled={busy}
                    >
                      <Plus className="size-4" aria-hidden="true" />
                      Добавить
                    </Button>
                    <Button
                      type="button"
                      size="compact"
                      onClick={resetUnitLineDrafts}
                      disabled={busy || !unitLineDraftsDirty}
                    >
                      Сбросить
                    </Button>
                    <Button
                      type="button"
                      size="compact"
                      variant="primary"
                      onClick={onSaveUnitLines}
                      disabled={busy || !unitLineDraftsDirty || !unitLineCountMatches}
                    >
                      Сохранить
                    </Button>
                    {!unitLineCountMatches ? (
                      <span className="flex items-center text-portal-caption text-portal-danger">
                        Количество строк должно быть равно {expectedUnitLineCount}
                      </span>
                    ) : null}
                  </div>
                ) : null}
                {unitLineDrafts.length === 0 ? (
                  <EmptyState title="Строки не заполнены" description="Данные персонализации отсутствуют." />
                ) : (
                  <DataTableFrame>
                    <DataTable minWidthClassName="min-w-[1040px]">
                      <DataTableHead>
                        <tr>
                          <DataTableHeaderCell className="w-12">#</DataTableHeaderCell>
                          <DataTableHeaderCell className="w-28">Тип размера</DataTableHeaderCell>
                          <DataTableHeaderCell className="w-40">Размер</DataTableHeaderCell>
                          <DataTableHeaderCell>Фамилия</DataTableHeaderCell>
                          <DataTableHeaderCell className="w-24">Номер</DataTableHeaderCell>
                          <DataTableHeaderCell>Примечание</DataTableHeaderCell>
                          {unitLinesEditable ? (
                            <DataTableHeaderCell className="w-14 text-right">Г—</DataTableHeaderCell>
                          ) : null}
                        </tr>
                      </DataTableHead>
                      <DataTableBody>
                        {unitLineDrafts.map((line) => (
                          <DataTableRow key={line.id}>
                            <DataTableCell>{line.unit_index}</DataTableCell>
                            <DataTableCell>{unitLineSizeTypeLabel(line.size_type ?? null)}</DataTableCell>
                            <DataTableCell>
                              {unitLinesEditable ? (
                                unitSizeOptions.length > 0 ? (
                                  <Select
                                    value={normalizeUnitSizeValue(line.size)}
                                    disabled={busy}
                                    aria-label={`Размер строки ${line.unit_index}`}
                                    onChange={(event) =>
                                      updateUnitLineDraft(line.id, "size", event.target.value)
                                    }
                                  >
                                    <option value="">Не выбран</option>
                                    {unitSizeOptions.map((option) => (
                                      <option key={option} value={option}>
                                        {option}
                                      </option>
                                    ))}
                                  </Select>
                                ) : (
                                  <Input
                                    value={line.size ?? ""}
                                    onChange={(event) =>
                                      updateUnitLineDraft(line.id, "size", event.target.value)
                                    }
                                    disabled={busy}
                                    className="min-w-[10rem]"
                                    aria-label={`Размер строки ${line.unit_index}`}
                                  />
                                )
                              ) : (
                                line.size ?? "—"
                              )}
                            </DataTableCell>
                            <DataTableCell>
                              {unitLinesEditable ? (
                                <Input
                                  value={line.personalization ?? ""}
                                  onChange={(event) =>
                                    updateUnitLineDraft(line.id, "personalization", event.target.value)
                                  }
                                  disabled={busy}
                                  aria-label={`Фамилия строки ${line.unit_index}`}
                                />
                              ) : (
                                line.personalization ?? "—"
                              )}
                            </DataTableCell>
                            <DataTableCell>
                              {unitLinesEditable ? (
                                <Input
                                  value={line.print_number ?? ""}
                                  onChange={(event) =>
                                    updateUnitLineDraft(line.id, "print_number", event.target.value)
                                  }
                                  disabled={busy}
                                  aria-label={`Номер строки ${line.unit_index}`}
                                />
                              ) : (
                                line.print_number ?? "—"
                              )}
                            </DataTableCell>
                            <DataTableCell className="text-portal-muted">
                              {unitLinesEditable ? (
                                <Input
                                  value={line.notes ?? ""}
                                  onChange={(event) =>
                                    updateUnitLineDraft(line.id, "notes", event.target.value)
                                  }
                                  disabled={busy}
                                  aria-label={`Примечание строки ${line.unit_index}`}
                                />
                              ) : (
                                line.notes ?? "—"
                              )}
                            </DataTableCell>
                            {unitLinesEditable ? (
                              <DataTableCell className="text-right">
                                <IconButton
                                  label={`Удалить строку ${line.unit_index}`}
                                  variant="danger"
                                  disabled={busy}
                                  onClick={() => removeUnitLineDraft(line.id)}
                                >
                                  <Trash2 className="size-4" aria-hidden="true" />
                                </IconButton>
                              </DataTableCell>
                            ) : null}
                          </DataTableRow>
                        ))}
                      </DataTableBody>
                    </DataTable>
                  </DataTableFrame>
                )}
              </SectionCard>
            </div>
          ) : null}

          {managerDocTab === "materials" ? (
            <div data-tech-card-doc-tab="materials">
              <SectionCard
                title="Состав материалов"
                description="План и факт по материалам; цех обязателен для hard-gate Раскрой/Печать. Факт — только цех (read-only для менеджера)."
                size="compact"
                className="border-0 p-0 shadow-none"
              >
                {nonMaterialLines.length > 0 ? (
                  <div className="mb-portal-3 space-y-portal-1 text-portal-caption text-portal-muted">
                    {nonMaterialLines.map((line) => (
                      <div key={line.id}>
                        {compositionLineKindLabel(String(line.line_kind))}: {line.snapshot_name}
                        {line.notes ? ` — ${line.notes}` : ""}
                      </div>
                    ))}
                  </div>
                ) : null}

                {materialDrafts.length === 0 ? (
                  <EmptyState
                    title="Материалы не добавлены"
                    description="Добавьте строки номенклатуры типа «Материал» и привяжите цех."
                  />
                ) : (
                  <DataTableFrame>
                    <DataTable minWidthClassName="min-w-[720px]">
                      <DataTableHead>
                        <tr>
                          <DataTableHeaderCell className="w-10">#</DataTableHeaderCell>
                          <DataTableHeaderCell>Номенклатура (Материал)</DataTableHeaderCell>
                          <DataTableHeaderCell className="w-36">Цех</DataTableHeaderCell>
                          <DataTableHeaderCell className="w-24">План</DataTableHeaderCell>
                          <DataTableHeaderCell className="w-24">Факт</DataTableHeaderCell>
                          <DataTableHeaderCell className="w-20">Ед.</DataTableHeaderCell>
                          {compositionEditable ? (
                            <DataTableHeaderCell className="w-16" />
                          ) : null}
                        </tr>
                      </DataTableHead>
                      <DataTableBody>
                        {materialDrafts.map((line, index) => (
                          <DataTableRow key={line.key}>
                            <DataTableCell>{index + 1}</DataTableCell>
                            <DataTableCell>
                              {compositionEditable ? (
                                <div className="space-y-portal-1">
                                  <Select
                                    size="compact"
                                    value={line.nomenclature_id != null ? String(line.nomenclature_id) : ""}
                                    onChange={(event) => {
                                      const raw = event.target.value;
                                      onMaterialNomenclatureChange(
                                        line.key,
                                        raw ? Number(raw) : null,
                                      );
                                    }}
                                    aria-label={`Материал строка ${index + 1}`}
                                  >
                                    <option value="">Выберите материал…</option>
                                    {materialOptions.map((row) => (
                                      <option key={row.id} value={row.id}>
                                        {row.name}
                                        {row.is_active ? "" : " (архив)"}
                                      </option>
                                    ))}
                                  </Select>
                                  {line.notes ? (
                                    <p className="text-portal-caption text-portal-danger" role="alert">
                                      {line.notes}
                                    </p>
                                  ) : null}
                                </div>
                              ) : (
                                <div className="space-y-portal-1">
                                  <div>{line.snapshot_name || "—"}</div>
                                  {line.notes ? (
                                    <p className="text-portal-caption text-portal-danger" role="alert">
                                      {line.notes}
                                    </p>
                                  ) : null}
                                </div>
                              )}
                            </DataTableCell>
                            <DataTableCell>
                              {compositionEditable ? (
                                <Select
                                  size="compact"
                                  value={
                                    line.production_stage_id != null
                                      ? String(line.production_stage_id)
                                      : ""
                                  }
                                  onChange={(event) => {
                                    const raw = event.target.value;
                                    onMaterialStageChange(line.key, raw ? Number(raw) : null);
                                  }}
                                  aria-label={`Цех материала ${index + 1}`}
                                >
                                  <option value="">Цех…</option>
                                  {productionStages
                                    .filter((row) => row.is_active || row.id === line.production_stage_id)
                                    .map((row) => (
                                      <option key={row.id} value={row.id}>
                                        {row.name}
                                        {row.is_active ? "" : " (архив)"}
                                      </option>
                                    ))}
                                </Select>
                              ) : (
                                stageLabel(line.production_stage_id)
                              )}
                            </DataTableCell>
                            <DataTableCell>
                              {compositionEditable ? (
                                <Input
                                  size="compact"
                                  type="number"
                                  min="0"
                                  step="0.001"
                                  value={line.quantity}
                                  onChange={(event) =>
                                    onMaterialFieldChange(line.key, "quantity", event.target.value)
                                  }
                                  aria-label={`План материала ${index + 1}`}
                                />
                              ) : (
                                <span className="tabular-nums">{line.quantity || "—"}</span>
                              )}
                            </DataTableCell>
                            <DataTableCell>
                              <span className="tabular-nums text-portal-muted">
                                {line.fact_qty || "—"}
                              </span>
                            </DataTableCell>
                            <DataTableCell>
                              {compositionEditable ? (
                                <Input
                                  size="compact"
                                  value={line.unit}
                                  onChange={(event) =>
                                    onMaterialFieldChange(line.key, "unit", event.target.value)
                                  }
                                  aria-label={`Единица материала ${index + 1}`}
                                />
                              ) : (
                                line.unit || "—"
                              )}
                            </DataTableCell>
                            {compositionEditable ? (
                              <DataTableCell>
                                <Button
                                  type="button"
                                  size="compact"
                                  disabled={busy}
                                  onClick={() => onRemoveMaterialRow(line.key)}
                                >
                                  Удалить
                                </Button>
                              </DataTableCell>
                            ) : null}
                          </DataTableRow>
                        ))}
                      </DataTableBody>
                    </DataTable>
                  </DataTableFrame>
                )}

                {compositionEditable ? (
                  <div className="mt-portal-3 flex flex-wrap gap-portal-2">
                    <Button type="button" size="compact" disabled={busy} onClick={onAddMaterialRow}>
                      Добавить материал
                    </Button>
                    <Button
                      type="button"
                      size="compact"
                      variant="primary"
                      disabled={busy}
                      onClick={onSaveComposition}
                    >
                      Сохранить состав
                    </Button>
                  </div>
                ) : null}
              </SectionCard>
            </div>
          ) : null}

          {managerDocTab === "route" ? (
            <div data-tech-card-doc-tab="route">
              <SectionCard
                title="Маршрут / участки"
                description="Ход выполнения по этапам маршрута."
                size="compact"
                className="border-0 p-0 shadow-none"
              >
                {stageResults.length === 0 ? (
                  <EmptyState
                    title="Маршрут не назначен"
                    description="Назначьте маршрут при формировании техкарты."
                  />
                ) : (
                  <ol
                    data-tech-card-manager-route
                    className="flex min-w-0 flex-wrap gap-portal-3"
                  >
                    {stageResults.map((stage) => (
                      <li
                        key={stage.id}
                        className="min-w-[13.5rem] max-w-sm flex-1"
                      >
                        <StageTimelineRow
                          stage={stage}
                          isCurrent={
                            stageExecutionAllowed &&
                            stage.stage_order === card.current_stage_order
                          }
                          busy={busy}
                          allowActions={stageExecutionAllowed}
                          workCenters={workCenters}
                          onAssignWorkCenter={(workCenterId) => {
                            void runAction(() =>
                              assignPlannedWorkCenterAction(
                                card.id,
                                stage.stage_order,
                                workCenterId,
                                card.sales_order_id,
                              ),
                            );
                          }}
                          onStart={() => onStartStage(stage.stage_order)}
                          onComplete={() => openCompleteForm(stage.stage_order)}
                          onRollback={() => onRollbackStage(stage.stage_order)}
                        />
                      </li>
                    ))}
                  </ol>
                )}
              </SectionCard>
            </div>
          ) : null}
        </div>
      </div>

      <SectionCard
        title="История"
        description="Журнал событий по техкарте."
        size="compact"
        collapsed={collapsedBlocks.history}
        actions={
          <CollapseToggleButton
            collapsed={collapsedBlocks.history}
            onToggle={() => toggleBlock("history")}
          />
        }
      >
        {historyEntries.length === 0 ? (
          <EmptyState title="История пока пуста" description="События техкарты появятся здесь." />
        ) : (
          <ActivityTimeline label="История техкарты">
            {historyEntries.map((entry) => (
              <ActivityTimelineItem
                key={entry.key}
                title={entry.title}
                description={entry.description}
                meta={entry.meta}
              />
            ))}
          </ActivityTimeline>
        )}
      </SectionCard>
      </div>
      </div>
      )}
    </DocumentCard>
  );
}

function CollapseToggleButton({
  collapsed,
  onToggle,
  expandLabel = "Развернуть",
  collapseLabel = "Свернуть",
}: {
  collapsed: boolean;
  onToggle: () => void;
  expandLabel?: string;
  collapseLabel?: string;
}) {
  return (
    <Button type="button" size="compact" variant="secondary" onClick={onToggle}>
      {collapsed ? (
        <>
          <ChevronRight className="size-4" aria-hidden="true" />
          {expandLabel}
        </>
      ) : (
        <>
          <ChevronDown className="size-4" aria-hidden="true" />
          {collapseLabel}
        </>
      )}
    </Button>
  );
}

function AssemblySchemeBlock({
  assemblySewingOps,
  sewingOps,
}: {
  assemblySewingOps: NonNullable<ApiTechnicalCard["assembly_sewing_operations"]>;
  sewingOps: ApiTechnicalCardOperationLine[];
}) {
  if (assemblySewingOps.length > 0) {
    return (
      <DataTableFrame>
        <DataTable minWidthClassName="min-w-[640px]">
          <DataTableHead>
            <tr>
              <DataTableHeaderCell className="w-12">#</DataTableHeaderCell>
              <DataTableHeaderCell>Операция</DataTableHeaderCell>
              <DataTableHeaderCell className="w-28">
                Кол-во на модель
              </DataTableHeaderCell>
              <DataTableHeaderCell className="w-28">Цена</DataTableHeaderCell>
              <DataTableHeaderCell className="w-28">Сумма</DataTableHeaderCell>
            </tr>
          </DataTableHead>
          <DataTableBody>
            {assemblySewingOps.map((op) => {
              const qty = Math.max(1, Number(op.quantity_per_item) || 1);
              const lineTotal = assemblyOperationLineTotal({
                cost: String(op.cost),
                quantity_per_item: qty,
                line_total: op.line_total,
              });
              return (
                <DataTableRow key={`${op.sequence}-${op.operation_name}`}>
                  <DataTableCell>{op.sequence}</DataTableCell>
                  <DataTableCell>{op.operation_name}</DataTableCell>
                  <DataTableCell className="tabular-nums">{qty}</DataTableCell>
                  <DataTableCell className="tabular-nums">
                    {formatAssemblyCost(op.cost)} ₽
                  </DataTableCell>
                  <DataTableCell className="tabular-nums font-medium">
                    {formatAssemblyCost(lineTotal)} ₽
                  </DataTableCell>
                </DataTableRow>
              );
            })}
          </DataTableBody>
        </DataTable>
      </DataTableFrame>
    );
  }

  if (sewingOps.length > 0) {
    return (
      <DataTableFrame>
        <DataTable minWidthClassName="min-w-[560px]">
          <DataTableHead>
            <tr>
              <DataTableHeaderCell className="w-12">#</DataTableHeaderCell>
              <DataTableHeaderCell>Операция</DataTableHeaderCell>
              <DataTableHeaderCell className="w-28">Объём</DataTableHeaderCell>
              <DataTableHeaderCell className="w-20">Ед.</DataTableHeaderCell>
            </tr>
          </DataTableHead>
          <DataTableBody>
            {sewingOps.map((line) => (
              <DataTableRow key={line.id}>
                <DataTableCell>{line.sequence}</DataTableCell>
                <DataTableCell>{line.operation_name}</DataTableCell>
                <DataTableCell className="tabular-nums">{line.volume}</DataTableCell>
                <DataTableCell>
                  {formatVolumeUnit(String(line.volume_unit))}
                </DataTableCell>
              </DataTableRow>
            ))}
          </DataTableBody>
        </DataTable>
      </DataTableFrame>
    );
  }

  return (
    <EmptyState
      title="Схема сборки не задана"
      description="Операции появятся после выбора варианта сборки."
    />
  );
}

function StageTimelineRow({
  stage,
  isCurrent,
  busy,
  allowActions = true,
  workCenters = [],
  onAssignWorkCenter,
  onStart,
  onComplete,
  onRollback,
}: {
  stage: ApiTechnicalCardStageResult;
  isCurrent: boolean;
  busy: boolean;
  allowActions?: boolean;
  workCenters?: WorkCenter[];
  onAssignWorkCenter?: (workCenterId: number | null) => void;
  onStart: () => void;
  onComplete: () => void;
  onRollback: () => void;
}) {
  const status = String(stage.status);
  const canStart = allowActions && status === "pending";
  const canComplete = allowActions && (status === "pending" || status === "in_progress");
  const canRollback = allowActions && status === "completed";
  const canEditEquipment =
    allowActions &&
    onAssignWorkCenter != null &&
    (status === "pending" || status === "in_progress");
  const stageWorkCenters = workCenters.filter((row) => {
    const matchesStage =
      stage.production_stage_id == null ||
      row.production_stage_id == null ||
      row.production_stage_id === stage.production_stage_id;
    return (
      matchesStage &&
      (row.is_active || row.id === stage.work_center_id)
    );
  });
  const plannedName =
    stage.work_center_id == null
      ? null
      : stageWorkCenters.find((row) => row.id === stage.work_center_id)?.name ??
        workCenters.find((row) => row.id === stage.work_center_id)?.name ??
        `#${stage.work_center_id}`;

  return (
    <article
      className={[
        "flex h-full min-w-0 flex-col gap-portal-2 rounded-portal-md border px-portal-3 py-portal-3",
        isCurrent ? "border-portal-primary/40 bg-portal-primary-soft/20" : "border-portal-border",
      ].join(" ")}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-portal-2">
            <span className="font-semibold text-portal-text">
              {stage.stage_order}. {stage.stage_label}
            </span>
            <StatusBadge size="compact" tone={stageTone(status)}>
              {stageResultStatusLabel(status)}
            </StatusBadge>
            {isCurrent ? (
              <StatusBadge size="compact" tone="primary">
                Текущий
              </StatusBadge>
            ) : null}
      </div>
          <dl className="grid gap-portal-1 text-portal-caption text-portal-muted">
            <div>Исполнитель: {stage.performer_name ?? "—"}</div>
            <div>Начало: {formatTechCardDateTime(stage.started_at)}</div>
            <div>Завершение: {formatTechCardDateTime(stage.completed_at)}</div>
            <div>
              Брак / доработка: {stage.scrap_qty ?? "—"} / {stage.rework_qty ?? "—"}
            </div>
          </dl>
          {canEditEquipment ? (
            <div className="min-w-0">
              <Field label="Оборудование (план)">
                <Select
                  value={
                    stage.work_center_id == null
                      ? ""
                      : String(stage.work_center_id)
                  }
                  disabled={busy}
                  onChange={(event) => {
                    const raw = event.target.value;
                    onAssignWorkCenter?.(raw ? Number(raw) : null);
                  }}
                  aria-label={`Оборудование этапа ${stage.stage_order}`}
                >
                  <option value="">Не выбрано</option>
                  {stageWorkCenters.map((row) => (
                    <option key={row.id} value={String(row.id)}>
                      {row.name}
                      {row.is_active ? "" : " (архив)"}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          ) : (
            <p className="text-portal-caption text-portal-muted">
              Оборудование: {plannedName ?? "—"}
            </p>
          )}
          {stage.notes ? (
            <p className="text-portal-body text-portal-muted">{stage.notes}</p>
          ) : null}
        <div className="mt-auto flex flex-wrap gap-portal-2">
          {canStart ? (
            <Button type="button" size="compact" disabled={busy} onClick={onStart}>
              Начать
            </Button>
          ) : null}
          {canComplete ? (
            <Button
              type="button"
              size="compact"
              variant="primary"
              disabled={busy}
              onClick={onComplete}
            >
              Завершить
            </Button>
          ) : null}
          {canRollback ? (
            <Button type="button" size="compact" disabled={busy} onClick={onRollback}>
              Откатить
            </Button>
          ) : null}
        </div>
    </article>
  );
}
