"use client";

import Link from "next/link";
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  ExternalLink,
  Play,
  Printer,
  RotateCcw,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
  applyRoutingAction,
  assignPlannedWorkCenterAction,
  completeTechnicalCardStageAction,
  deleteCompositionLineAction,
  deleteTechCardMediaAction,
  importUnitLinesAction,
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
import { TechCardShopFloorBody } from "@/components/production/tech-card-shop-floor-body";
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
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/components/ui/toast";
import {
  buildShopStageModulesFromCatalog,
  getShopStageModule,
  shopStageCardHref,
  shopStageCodeByTitle,
} from "@/lib/production/shop-stage-modules";
import {
  asTechCardUiStatus,
  buildCompositionReplaceLines,
  buildTechCardHistoryEntries,
  compositionLineKindLabel,
  findSewingHostRoutingLineIndex,
  formatDesiredDate,
  formatTechCardDateTime,
  formatVolumeUnit,
  groupOperationLinesBySource,
  materialDraftsFromComposition,
  stageResultStatusLabel,
  techCardAllowsStageExecution,
  techCardDocumentNumberLabel,
  techCardModelLabel,
  techCardShowsCurrentStageBadge,
  techCardStatusTone,
  TECH_CARD_MEDIA_MAX,
  unitLineSizeTypeLabel,
  type TechCardMaterialDraftLine,
  validateTechCardImageFile,
} from "@/lib/production/tech-cards";
import type {
  ApiTechnicalCard,
  ApiTechnicalCardCompositionLine,
  ApiTechnicalCardMedia,
  ApiTechnicalCardOperationLine,
  ApiTechnicalCardStageResult,
  TechnicalCardUnitLineAggregateImportRow,
} from "@/lib/sales/order-tech-cards-api";
import type { WorkCenter } from "@/lib/shop-routings";
import { techCardStatusLabel } from "@/lib/sales/order-tech-cards";
import {
  assemblyOperationLineTotal,
  formatAssemblyCost,
} from "@/lib/product-models";

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
};

let materialDraftKeySeq = 0;
function nextMaterialDraftKey(): string {
  materialDraftKeySeq += 1;
  return `new-${materialDraftKeySeq}`;
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

/** PT-07 technical card document workspace. */
export function TechCardDetailWorkspace({
  card,
  routings,
  materials,
  productionStages,
  listOrderId,
  shopStageCode,
  workCenters = [],
}: TechCardDetailWorkspaceProps) {
  const router = useRouter();
  const { push: pushToast } = useToast();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [completingStageOrder, setCompletingStageOrder] = useState<number | null>(null);
  const [performerName, setPerformerName] = useState("");
  const [scrapQty, setScrapQty] = useState("");
  const [reworkQty, setReworkQty] = useState("");
  const [stageNotes, setStageNotes] = useState("");
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [materialDrafts, setMaterialDrafts] = useState<TechCardMaterialDraftLine[]>(() =>
    materialDraftsFromComposition(card.composition_lines ?? []),
  );
  const [unitImportOpen, setUnitImportOpen] = useState(false);
  const [unitImportText, setUnitImportText] = useState("");
  const [collapsedBlocks, setCollapsedBlocks] = useState({
    mockup: false,
    orderData: false,
    modelRouting: false,
    operations: true,
    materials: true,
    stages: true,
    units: true,
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
      { value: "Ма", label: "Ма" },
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
  const sewingProductionStageId =
    productionStages.find((row) => row.code === "sewing")?.id ?? null;
  const sewingHostIndex = findSewingHostRoutingLineIndex(
    routingOps,
    sewingProductionStageId,
  );
  const hasSewingChildContent =
    assemblySewingOps.length > 0 || sewingOps.length > 0;
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

  const documentNumber = techCardDocumentNumberLabel(card.order_number, card.number);

  const parseUnitImport = (): TechnicalCardUnitLineAggregateImportRow[] => {
    const rows = unitImportText
      .split(/\r?\n/)
      .map((row) => row.trim())
      .filter(Boolean);
    if (rows.length === 0) {
      throw new Error("Добавьте хотя бы одну строку импорта");
    }
    return rows.map((row, index) => {
      const cells = row
        .split(/\t|;/)
        .map((cell) => cell.trim());
      if (cells.length < 6) {
        throw new Error(`Строка ${index + 1}: ожидается 6 колонок`);
      }
      const [sizeTypeLabel, size, personalization, printNumber, quantityRaw, notes] = cells;
      const quantity = Number(quantityRaw.replace(",", "."));
      if (!Number.isInteger(quantity) || quantity < 1) {
        throw new Error(`Строка ${index + 1}: количество должно быть целым числом >= 1`);
      }
      const normalizedSizeType =
        sizeTypeLabel.toLowerCase() === "мужской"
          ? "men"
          : sizeTypeLabel.toLowerCase() === "женский"
            ? "women"
            : sizeTypeLabel.toLowerCase() === "детский"
              ? "kids"
              : null;
      if (normalizedSizeType == null) {
        throw new Error(`Строка ${index + 1}: тип размера должен быть Мужской или Женский`);
      }
      return {
        size_type: normalizedSizeType,
        size,
        personalization,
        print_number: printNumber,
        quantity,
        notes,
      };
    });
  };

  const onImportUnitLines = () => {
    let lines: TechnicalCardUnitLineAggregateImportRow[];
    try {
      lines = parseUnitImport();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Ошибка импорта");
      return;
    }
    void runAction(() => importUnitLinesAction(card.id, lines, card.sales_order_id));
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
    pushToast("Печать техкарты — скоро", "neutral");
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

  const routingSelectValue =
    card.routing_template_id != null ? String(card.routing_template_id) : "";

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
                  disabled={busy}
                  onClick={onPrint}
                >
                  <Printer className="size-4" aria-hidden="true" />
                </IconButton>
                <Link
                  href={`/sales/orders/${card.sales_order_id}`}
                  className="portal-focus-ring inline-flex size-portal-control-icon items-center justify-center rounded-portal-md border border-portal-border bg-portal-surface text-portal-text hover:bg-portal-state-hover"
                  aria-label="Открыть заказ"
                  title="Открыть заказ"
                >
                  <ExternalLink className="size-4" aria-hidden="true" />
                </Link>
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
      ) : (
      <>
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

        <SectionCard
          title="Данные по заказу"
          size="compact"
          collapsed={false}
        >
          <dl className="grid gap-portal-3">
            <div>
              <dt className="text-portal-caption text-portal-muted">Номер техкарты</dt>
              <dd className="mt-1 text-portal-body font-medium">{documentNumber}</dd>
            </div>
            <div>
              <dt className="text-portal-caption text-portal-muted">Ответственный менеджер</dt>
              <dd className="mt-1 text-portal-body">{card.responsible_name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-portal-caption text-portal-muted">Клиент</dt>
              <dd className="mt-1 text-portal-body">{card.client_name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-portal-caption text-portal-muted">Дата сдачи</dt>
              <dd className="mt-1 text-portal-body">{formatDesiredDate(card.desired_date)}</dd>
            </div>
          </dl>
        </SectionCard>

        <SectionCard
          title="Модель и маршрут"
          size="compact"
          collapsed={false}
        >
          <dl className="grid gap-portal-3">
            <div>
              <dt className="text-portal-caption text-portal-muted">Модель</dt>
              <dd className="mt-1 text-portal-body">{techCardModelLabel(card)}</dd>
            </div>
            <div>
              <dt className="text-portal-caption text-portal-muted">Сборка</dt>
              <dd className="mt-1 text-portal-body">{card.assembly_variant_name ?? "—"}</dd>
            </div>
          </dl>
          <Field label="Маршруты и операции" className="mt-portal-4">
            <Select
              value={routingSelectValue}
              disabled={busy || status === "cancelled"}
              onChange={(event) => {
                const next = Number(event.target.value);
                if (!Number.isSafeInteger(next) || next <= 0) return;
                if (next === card.routing_template_id) return;
                onApplyRouting(next);
              }}
            >
              <option value="">Выберите маршрут…</option>
              {routings.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.code ? `${row.code} — ${row.name}` : row.name}
                  {row.is_active ? "" : " (неактивен)"}
                </option>
              ))}
            </Select>
          </Field>
          {card.routing_template_name ? (
            <p className="mt-portal-2 text-portal-caption text-portal-muted">
              Текущий: {card.routing_template_name}
            </p>
          ) : null}
        </SectionCard>
      </div>

      <SectionCard
        title="Операции / объёмы"
        size="compact"
        collapsed={collapsedBlocks.operations}
        actions={
          <CollapseToggleButton
            collapsed={collapsedBlocks.operations}
            onToggle={() => toggleBlock("operations")}
          />
        }
      >
        <div className="space-y-portal-3">
          <h3 className="text-portal-body font-semibold text-portal-text">
            Операции маршрута
          </h3>
          {routingOps.length === 0 ? (
            <EmptyState
              title="Операции маршрута не заданы"
              description="Выберите маршрут, чтобы заполнить операции."
            />
          ) : (
            <div className="space-y-portal-3">
              {routingOps.map((line, index) => (
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
                  {index === sewingHostIndex ? (
                    <SewingOpsChildBlock
                      assemblySewingOps={assemblySewingOps}
                      sewingOps={sewingOps}
                    />
                  ) : null}
                </div>
              ))}
            </div>
          )}
          {routingOps.length > 0 && sewingHostIndex < 0 && hasSewingChildContent ? (
            <div className="rounded-portal-md border border-dashed border-portal-border px-portal-4 py-portal-3">
              <p className="mb-portal-2 text-portal-caption text-portal-muted">
                Цех «Пошив» в маршруте не найден — операции пошива показаны отдельно.
              </p>
              <SewingOpsChildBlock
                assemblySewingOps={assemblySewingOps}
                sewingOps={sewingOps}
              />
            </div>
          ) : null}
          {routingOps.length === 0 && hasSewingChildContent ? (
            <SewingOpsChildBlock
              assemblySewingOps={assemblySewingOps}
              sewingOps={sewingOps}
            />
          ) : null}
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 gap-portal-4 min-[900px]:grid-cols-2">
        <SectionCard
          title="Состав материалов"
          description="План и факт по материалам; цех обязателен для hard-gate Раскрой/Печать. Факт — только цех (read-only для менеджера)."
          size="compact"
          collapsed={collapsedBlocks.materials}
          actions={
            <CollapseToggleButton
              collapsed={collapsedBlocks.materials}
              onToggle={() => toggleBlock("materials")}
            />
          }
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

        <SectionCard
          title="Маршрут / участки"
          description="Ход выполнения по этапам маршрута."
          size="compact"
          collapsed={collapsedBlocks.stages}
          actions={
            <CollapseToggleButton
              collapsed={collapsedBlocks.stages}
              onToggle={() => toggleBlock("stages")}
            />
          }
        >
          {stageResults.length === 0 ? (
            <EmptyState
              title="Маршрут не назначен"
              description="Назначьте маршрут при формировании техкарты."
            />
          ) : (
            <div className="space-y-portal-3">
              {stageResults.map((stage) => (
                <StageTimelineRow
                  key={stage.id}
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
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <SectionCard
        title="Поштучно"
        description="Размеры и персонализация по единицам."
        size="compact"
        collapsed={collapsedBlocks.units}
        actions={
          <div className="flex flex-wrap items-center gap-portal-2">
            <CollapseToggleButton
              collapsed={collapsedBlocks.units}
              onToggle={() => toggleBlock("units")}
            />
            {!collapsedBlocks.units ? (
              <Button
                type="button"
                size="compact"
                onClick={() => setUnitImportOpen((current) => !current)}
                disabled={busy || compositionEditable === false}
              >
                {unitImportOpen ? "Скрыть импорт" : "Импорт по столбцам"}
              </Button>
            ) : null}
          </div>
        }
      >
        {unitImportOpen ? (
          <div className="mb-portal-4 grid gap-portal-3 rounded-portal-md border border-portal-border p-portal-4">
            <Field
              label="Строки импорта"
              help="Формат: Тип размера; Размер; Фамилия; Номер; Количество; Примечание"
            >
              <Textarea
                value={unitImportText}
                onChange={(event) => setUnitImportText(event.target.value)}
                rows={6}
                disabled={busy}
                placeholder={"Мужской; M; Иванов; 10; 2; Основной состав\nЖенский; S; Петрова; 7; 1; Запас"}
              />
            </Field>
            <div className="flex flex-wrap gap-portal-2">
              <Button type="button" variant="primary" size="compact" disabled={busy} onClick={onImportUnitLines}>
                Импортировать
              </Button>
              <Button type="button" size="compact" disabled={busy} onClick={() => setUnitImportText("")}>
                Очистить
              </Button>
            </div>
          </div>
        ) : null}
        {unitLines.length === 0 ? (
          <EmptyState title="Строки не заполнены" description="Поштучные данные отсутствуют." />
        ) : (
          <DataTableFrame>
            <DataTable minWidthClassName="min-w-[880px]">
              <DataTableHead>
                <tr>
                  <DataTableHeaderCell className="w-12">#</DataTableHeaderCell>
                  <DataTableHeaderCell className="w-28">Тип размера</DataTableHeaderCell>
                  <DataTableHeaderCell className="w-24">Размер</DataTableHeaderCell>
                  <DataTableHeaderCell>Фамилия</DataTableHeaderCell>
                  <DataTableHeaderCell className="w-24">Номер</DataTableHeaderCell>
                  <DataTableHeaderCell>Примечание</DataTableHeaderCell>
                </tr>
              </DataTableHead>
              <DataTableBody>
                {unitLines.map((line) => (
                  <DataTableRow key={line.id}>
                    <DataTableCell>{line.unit_index}</DataTableCell>
                    <DataTableCell>{unitLineSizeTypeLabel(line.size_type ?? null)}</DataTableCell>
                    <DataTableCell>{line.size ?? "—"}</DataTableCell>
                    <DataTableCell>{line.personalization ?? "—"}</DataTableCell>
                    <DataTableCell>{line.print_number ?? "—"}</DataTableCell>
                    <DataTableCell className="text-portal-muted">
                      {line.notes ?? "—"}
                    </DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          </DataTableFrame>
        )}
      </SectionCard>

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
      </>
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

function SewingOpsChildBlock({
  assemblySewingOps,
  sewingOps,
}: {
  assemblySewingOps: NonNullable<ApiTechnicalCard["assembly_sewing_operations"]>;
  sewingOps: ApiTechnicalCardOperationLine[];
}) {
  return (
    <div className="mt-portal-3 rounded-portal-md border border-portal-border bg-portal-surface-secondary/40 p-portal-3">
      <h4 className="mb-portal-2 text-portal-caption font-semibold uppercase tracking-wide text-portal-muted">
        Операции пошива
      </h4>
      {assemblySewingOps.length > 0 ? (
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
      ) : sewingOps.length > 0 ? (
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
      ) : (
        <EmptyState
          title="Операции пошива не заданы"
          description="Операции появятся после выбора варианта сборки."
        />
      )}
    </div>
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
        "rounded-portal-md border px-portal-4 py-portal-3",
        isCurrent ? "border-portal-primary/40 bg-portal-primary-soft/20" : "border-portal-border",
      ].join(" ")}
    >
      <div className="flex flex-wrap items-start justify-between gap-portal-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-portal-2">
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
          <dl className="mt-portal-2 grid gap-portal-1 text-portal-caption text-portal-muted sm:grid-cols-2">
            <div>Исполнитель: {stage.performer_name ?? "—"}</div>
            <div>Начало: {formatTechCardDateTime(stage.started_at)}</div>
            <div>Завершение: {formatTechCardDateTime(stage.completed_at)}</div>
            <div>
              Брак / доработка: {stage.scrap_qty ?? "—"} / {stage.rework_qty ?? "—"}
            </div>
          </dl>
          {canEditEquipment ? (
            <div className="mt-portal-3 max-w-sm">
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
            <p className="mt-portal-2 text-portal-caption text-portal-muted">
              Оборудование: {plannedName ?? "—"}
            </p>
          )}
          {stage.notes ? (
            <p className="mt-portal-2 text-portal-body text-portal-muted">{stage.notes}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-portal-2">
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
      </div>
    </article>
  );
}
