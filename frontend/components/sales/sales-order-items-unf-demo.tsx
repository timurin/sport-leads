"use client";

import {
  ArrowDown,
  ArrowUp,
  Clock3,
  Copy,
  Eye,
  FileSpreadsheet,
  MoreVertical,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";

import {
  createOrderItemPayload,
  deleteOrderItem,
  updateOrderItemPayload,
  type OrderItemPayload,
} from "@/app/(workspace)/sales/orders/[orderId]/order-item-actions";
import {
  loadNomenclatureAvailableModels,
  loadProductModelActiveAssemblyVariants,
} from "@/app/(workspace)/sales/orders/[orderId]/order-item-catalog-actions";
import { NomenclaturePickModal } from "@/components/sales/nomenclature-pick-modal";
import { Button } from "@/components/ui/button";
import { CompactTabs } from "@/components/ui/compact-tabs";
import { Input, Select } from "@/components/ui/form-controls";
import { ListTotals } from "@/components/ui/list-pagination";
import { SectionCard } from "@/components/ui/section-card";
import {
  nomenclatureLabel,
  type Nomenclature,
  type NomenclatureAvailableModel,
  type NomenclatureCategory,
} from "@/lib/nomenclature";
import {
  formatAssemblyCost,
  type AssemblyVariant,
} from "@/lib/product-models";
import type { SalesOrderItem } from "@/lib/sales/order-details";
import {
  calculateInclusiveVatAmount,
  formatVatRatePercent,
  vatRateLabel,
  type VatRate,
} from "@/lib/vat-rates";

type WorkspaceTab = "goods" | "delivery";

type DraftRow = {
  id: number;
  position: number;
  nomenclatureId: number | null;
  productModelId: number | null;
  productModelArticle: string;
  productModelName: string;
  assemblyVariantId: number | null;
  assemblyVariantName: string;
  vatRateId: number | null;
  vatRatePercent: number;
  snapshotName: string;
  unit: string;
  quantity: string;
  unitPrice: string;
  lineAmount: number;
};

const moneyFormatter = new Intl.NumberFormat("ru-RU", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatMoney(value: number): string {
  return moneyFormatter.format(Number.isFinite(value) ? value : 0);
}

function parseDecimal(value: string): number {
  const amount = Number(String(value).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(amount) ? amount : 0;
}

function defaultVatRateId(rates: VatRate[]): number | null {
  const five = rates.find((rate) => Number(rate.rate_percent) === 5 && rate.is_active);
  if (five) return five.id;
  return rates.find((rate) => rate.is_active)?.id ?? null;
}

function ratePercentById(rates: VatRate[], vatRateId: number | null): number {
  if (vatRateId === null) return 0;
  const rate = rates.find((entry) => entry.id === vatRateId);
  return rate ? Number(rate.rate_percent) : 0;
}

function toDraft(item: SalesOrderItem, index: number, rates: VatRate[]): DraftRow {
  const vatRateId = item.vatRateId;
  return {
    id: item.id,
    position: index + 1,
    nomenclatureId: item.nomenclatureId,
    productModelId: item.productModelId,
    productModelArticle: item.productModelArticle,
    productModelName: item.productModelName,
    assemblyVariantId: item.assemblyVariantId,
    assemblyVariantName: item.assemblyVariantName,
    vatRateId,
    vatRatePercent: item.vatRatePercent
      ? Number(item.vatRatePercent)
      : ratePercentById(rates, vatRateId),
    snapshotName: item.snapshotName,
    unit: item.unit,
    quantity: item.quantity,
    unitPrice: item.unitPriceValue,
    lineAmount: parseDecimal(item.lineAmountValue),
  };
}

function NomenclatureCellField({
  items,
  value,
  disabled,
  onOpen,
}: {
  items: Nomenclature[];
  value: number | null;
  disabled?: boolean;
  onOpen: () => void;
}) {
  const selected = items.find((item) => item.id === value) ?? null;
  const label = selected ? nomenclatureLabel(selected) : "";

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onOpen();
      }}
      aria-label="Выбрать номенклатуру"
      title={label || "Выбрать номенклатуру"}
      className={[
        "flex min-h-8 min-w-[10rem] w-full items-center rounded-portal-md border border-portal-border bg-portal-surface px-portal-2 text-left text-portal-meta transition-colors",
        disabled
          ? "cursor-not-allowed opacity-60"
          : "hover:border-portal-primary hover:bg-portal-surface-secondary",
        label ? "text-portal-text" : "text-portal-muted",
      ].join(" ")}
    >
      <span className="truncate">{label || "Номенклатура…"}</span>
    </button>
  );
}

/**
 * UNF-style order items grid with nomenclature / product model / assembly variant / price / VAT.
 * Visual chrome from `3.2.7`; persistence via order-item API (`3.2.5.4` model+assembly + `3.3.2` VAT).
 */
export function SalesOrderItemsUnfDemo({
  orderId,
  items,
  nomenclature,
  nomenclatureCategories,
  vatRates,
  documentTotal,
}: {
  orderId: string;
  items: SalesOrderItem[];
  nomenclature: Nomenclature[];
  nomenclatureCategories: NomenclatureCategory[];
  vatRates: VatRate[];
  documentTotal: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("goods");
  const [rows, setRows] = useState<DraftRow[]>(() =>
    items.map((item, index) => toDraft(item, index, vatRates)),
  );
  const [selectedIds, setSelectedIds] = useState<number[]>(() =>
    items[0] ? [items[0].id] : [],
  );
  const [activeRowId, setActiveRowId] = useState<number | null>(items[0]?.id ?? null);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [nomenclaturePickerRowId, setNomenclaturePickerRowId] = useState<number | null>(
    null,
  );
  const [modelsByNomenclature, setModelsByNomenclature] = useState<
    Record<number, NomenclatureAvailableModel[]>
  >({});
  const [variantsByModel, setVariantsByModel] = useState<
    Record<number, AssemblyVariant[]>
  >({});

  useEffect(() => {
    setRows(items.map((item, index) => toDraft(item, index, vatRates)));
    if (items.length > 0) {
      setSelectedIds((current) => {
        const valid = current.filter((id) => items.some((item) => item.id === id));
        return valid.length > 0 ? valid : [items[0].id];
      });
      setActiveRowId((current) =>
        current && items.some((item) => item.id === current) ? current : items[0].id,
      );
    } else {
      setSelectedIds([]);
      setActiveRowId(null);
    }
  }, [items, vatRates]);

  const nomenclatureIdsKey = useMemo(
    () =>
      [
        ...new Set(
          rows
            .map((row) => row.nomenclatureId)
            .filter((id): id is number => id !== null),
        ),
      ]
        .sort((a, b) => a - b)
        .join(","),
    [rows],
  );

  const modelIdsKey = useMemo(
    () =>
      [
        ...new Set(
          rows
            .map((row) => row.productModelId)
            .filter((id): id is number => id !== null),
        ),
      ]
        .sort((a, b) => a - b)
        .join(","),
    [rows],
  );

  useEffect(() => {
    if (!nomenclatureIdsKey) return;
    const ids = nomenclatureIdsKey.split(",").map(Number);
    let cancelled = false;
    async function loadModels() {
      for (const nomenclatureId of ids) {
        setModelsByNomenclature((current) => {
          if (current[nomenclatureId]) return current;
          return current;
        });
        try {
          const models = await loadNomenclatureAvailableModels(nomenclatureId);
          if (!cancelled) {
            setModelsByNomenclature((current) =>
              current[nomenclatureId] ? current : { ...current, [nomenclatureId]: models },
            );
          }
        } catch {
          if (!cancelled) {
            setModelsByNomenclature((current) =>
              current[nomenclatureId] ? current : { ...current, [nomenclatureId]: [] },
            );
          }
        }
      }
    }
    void loadModels();
    return () => {
      cancelled = true;
    };
  }, [nomenclatureIdsKey]);

  useEffect(() => {
    if (!modelIdsKey) return;
    const ids = modelIdsKey.split(",").map(Number);
    let cancelled = false;
    async function loadVariants() {
      for (const modelId of ids) {
        try {
          const variants = await loadProductModelActiveAssemblyVariants(modelId);
          if (!cancelled) {
            setVariantsByModel((current) =>
              current[modelId] ? current : { ...current, [modelId]: variants },
            );
          }
        } catch {
          if (!cancelled) {
            setVariantsByModel((current) =>
              current[modelId] ? current : { ...current, [modelId]: [] },
            );
          }
        }
      }
    }
    void loadVariants();
    return () => {
      cancelled = true;
    };
  }, [modelIdsKey]);
  const activeVatRates = useMemo(
    () => vatRates.filter((rate) => rate.is_active),
    [vatRates],
  );

  const tabs = useMemo(
    () => [
      { id: "goods" as const, label: "Товары, услуги", count: rows.length },
      { id: "delivery" as const, label: "Доставка" },
    ],
    [rows.length],
  );

  const visibleRows = rows.filter((row) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    const nom = nomenclature.find((entry) => entry.id === row.nomenclatureId);
    const characteristic = row.productModelName || row.productModelArticle;
    return (
      (nom?.name.toLowerCase().includes(q) ?? false)
      || row.snapshotName.toLowerCase().includes(q)
      || characteristic.toLowerCase().includes(q)
      || row.assemblyVariantName.toLowerCase().includes(q)
    );
  });

  const allVisibleSelected =
    visibleRows.length > 0 && visibleRows.every((row) => selectedIds.includes(row.id));

  const linesTotal = rows.reduce((sum, row) => sum + row.lineAmount, 0);

  function toggleAllVisible() {
    if (allVisibleSelected) {
      const visible = new Set(visibleRows.map((row) => row.id));
      setSelectedIds((current) => current.filter((id) => !visible.has(id)));
      return;
    }
    setSelectedIds((current) => [
      ...new Set([...current, ...visibleRows.map((row) => row.id)]),
    ]);
  }

  function toggleRow(id: number) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  function payloadFromRow(row: DraftRow): OrderItemPayload {
    return {
      nomenclature_id: row.nomenclatureId,
      product_model_id: row.productModelId,
      product_model_article: row.productModelArticle || null,
      product_model_name: row.productModelName || null,
      assembly_variant_id: row.assemblyVariantId,
      vat_rate_id: row.vatRateId,
      snapshot_name: row.snapshotName.trim() || "Новая позиция",
      unit: row.unit || "шт",
      quantity: String(Math.max(parseDecimal(row.quantity), 0.001)),
      unit_price: String(Math.max(parseDecimal(row.unitPrice), 0)),
    };
  }

  function assemblyVariantsForModel(modelId: number | null): AssemblyVariant[] {
    if (modelId === null) return [];
    return variantsByModel[modelId] ?? [];
  }

  function variantSelectionError(row: DraftRow): string | null {
    const variants = assemblyVariantsForModel(row.productModelId);
    if (row.productModelId !== null && variants.length >= 1 && row.assemblyVariantId === null) {
      return "Выберите вариант сборки для модели изделия.";
    }
    return null;
  }

  function runSave(action: () => Promise<{ ok: boolean; message: string }>) {
    startTransition(async () => {
      const result = await action();
      setMessage(result.message);
      if (result.ok) router.refresh();
    });
  }

  function patchRow(rowId: number, patch: Partial<DraftRow>, persist = true) {
    let updated: DraftRow | null = null;
    setRows((all) => {
      const current = all.find((row) => row.id === rowId);
      if (!current) return all;
      const next: DraftRow = { ...current, ...patch };
      const qty = Math.max(parseDecimal(next.quantity), 0);
      const price = Math.max(parseDecimal(next.unitPrice), 0);
      next.lineAmount = Math.round(qty * price * 100) / 100;
      updated = next;
      return all.map((row) => (row.id === rowId ? next : row));
    });
    if (!persist || updated === null) return;
    const snapshot = updated;
    const error = variantSelectionError(snapshot);
    if (error) {
      setMessage(error);
      return;
    }
    runSave(() => updateOrderItemPayload(orderId, rowId, payloadFromRow(snapshot)));
  }

  function addRow() {
    const vatRateId = defaultVatRateId(activeVatRates);
    runSave(() =>
      createOrderItemPayload(orderId, {
        nomenclature_id: null,
        product_model_id: null,
        assembly_variant_id: null,
        vat_rate_id: vatRateId,
        snapshot_name: "Новая позиция",
        unit: "шт",
        quantity: "1",
        unit_price: "0",
      }),
    );
    setActiveTab("goods");
    setSearch("");
  }

  /** Persist all draft rows (nomenclature, model, assembly, qty, price, VAT). */
  function saveAllRows() {
    if (rows.length === 0) {
      setMessage("Нет строк для сохранения.");
      return;
    }
    for (const row of rows) {
      const error = variantSelectionError(row);
      if (error) {
        setMessage(`Строка ${row.position}: ${error}`);
        setActiveRowId(row.id);
        return;
      }
      if (row.nomenclatureId !== null) {
        const models = (modelsByNomenclature[row.nomenclatureId] ?? []).filter(
          (entry) => entry.status === "active",
        );
        if (models.length >= 1 && row.productModelId === null) {
          setMessage(`Строка ${row.position}: выберите модель изделия.`);
          setActiveRowId(row.id);
          return;
        }
      }
    }
    startTransition(async () => {
      let lastMessage = "Позиции заказа сохранены.";
      for (const row of rows) {
        const result = await updateOrderItemPayload(orderId, row.id, payloadFromRow(row));
        lastMessage = result.message;
        if (!result.ok) {
          setMessage(`Строка ${row.position}: ${result.message}`);
          setActiveRowId(row.id);
          return;
        }
      }
      setMessage(lastMessage);
      router.refresh();
    });
  }

  function copySelected() {
    const source = rows.find((row) => row.id === selectedIds[0]);
    if (!source) return;
    const error = variantSelectionError(source);
    if (error) {
      setMessage(error);
      return;
    }
    runSave(() => createOrderItemPayload(orderId, payloadFromRow(source)));
  }

  function deleteSelected() {
    const ids = selectedIds.length > 0 ? selectedIds : activeRowId ? [activeRowId] : [];
    if (ids.length === 0) return;
    startTransition(async () => {
      let lastMessage = "Позиции заказа сохранены.";
      for (const id of ids) {
        const result = await deleteOrderItem(orderId, id);
        lastMessage = result.message;
        if (!result.ok) {
          setMessage(result.message);
          return;
        }
      }
      setMessage(lastMessage);
      router.refresh();
    });
  }

  async function ensureModels(nomenclatureId: number) {
    if (modelsByNomenclature[nomenclatureId]) return modelsByNomenclature[nomenclatureId];
    const models = await loadNomenclatureAvailableModels(nomenclatureId);
    setModelsByNomenclature((current) => ({ ...current, [nomenclatureId]: models }));
    return models;
  }

  async function ensureVariants(modelId: number): Promise<AssemblyVariant[]> {
    if (variantsByModel[modelId]) return variantsByModel[modelId];
    const variants = await loadProductModelActiveAssemblyVariants(modelId);
    setVariantsByModel((current) => ({ ...current, [modelId]: variants }));
    return variants;
  }

  function onNomenclatureChange(row: DraftRow, entry: Nomenclature | null) {
    const clearedModels = {
      productModelId: null as number | null,
      productModelArticle: "",
      productModelName: "",
      assemblyVariantId: null as number | null,
      assemblyVariantName: "",
    };
    if (!entry) {
      patchRow(
        row.id,
        {
          nomenclatureId: null,
          ...clearedModels,
        },
        true,
      );
      return;
    }
    void ensureModels(entry.id);
    patchRow(
      row.id,
      {
        nomenclatureId: entry.id,
        snapshotName: entry.name,
        unit: entry.unit,
        unitPrice: entry.basePrice,
        ...clearedModels,
      },
      false,
    );
    void (async () => {
      const models = await ensureModels(entry.id);
      const activeModels = models.filter((model) => model.status === "active");
      // Empty whitelist → model optional; persist nomenclature now.
      if (activeModels.length === 0) {
        patchRow(
          row.id,
          {
            nomenclatureId: entry.id,
            snapshotName: entry.name,
            unit: entry.unit,
            unitPrice: entry.basePrice,
            ...clearedModels,
          },
          true,
        );
      } else {
        setMessage("Выберите модель изделия для номенклатуры.");
      }
    })();
  }

  function onModelChange(row: DraftRow, modelId: string) {
    if (!modelId) {
      patchRow(row.id, {
        productModelId: null,
        productModelArticle: "",
        productModelName: "",
        assemblyVariantId: null,
        assemblyVariantName: "",
      });
      return;
    }
    const models = row.nomenclatureId
      ? (modelsByNomenclature[row.nomenclatureId] ?? []).filter(
          (entry) => entry.status === "active",
        )
      : [];
    const model = models.find((entry) => entry.product_model_id === Number(modelId));
    if (!model) {
      setMessage("Модель не найдена в списке доступных для этой номенклатуры.");
      return;
    }
    const nextModelId = model.product_model_id;
    patchRow(
      row.id,
      {
        productModelId: nextModelId,
        productModelArticle: model.article,
        productModelName: model.name,
        assemblyVariantId: null,
        assemblyVariantName: "",
      },
      false,
    );
    void (async () => {
      const variants = await ensureVariants(nextModelId);
      if (variants.length === 0) {
        patchRow(row.id, {
          productModelId: nextModelId,
          productModelArticle: model.article,
          productModelName: model.name,
          assemblyVariantId: null,
          assemblyVariantName: "",
        });
        return;
      }
      if (variants.length === 1) {
        const only = variants[0];
        patchRow(row.id, {
          productModelId: nextModelId,
          productModelArticle: model.article,
          productModelName: model.name,
          assemblyVariantId: only.id,
          assemblyVariantName: only.name,
        });
        return;
      }
      setMessage("Выберите вариант сборки для модели изделия.");
    })();
  }

  function onAssemblyVariantChange(row: DraftRow, variantIdRaw: string) {
    if (!variantIdRaw) {
      const variants = assemblyVariantsForModel(row.productModelId);
      if (variants.length >= 1) {
        setMessage("Выберите вариант сборки для модели изделия.");
        patchRow(
          row.id,
          { assemblyVariantId: null, assemblyVariantName: "" },
          false,
        );
        return;
      }
      patchRow(row.id, { assemblyVariantId: null, assemblyVariantName: "" });
      return;
    }
    const variants = assemblyVariantsForModel(row.productModelId);
    const variant = variants.find((entry) => entry.id === Number(variantIdRaw));
    if (!variant) return;
    patchRow(row.id, {
      assemblyVariantId: variant.id,
      assemblyVariantName: variant.name,
    });
  }

  function onVatChange(row: DraftRow, vatRateIdRaw: string) {
    const vatRateId = vatRateIdRaw ? Number(vatRateIdRaw) : null;
    patchRow(row.id, {
      vatRateId,
      vatRatePercent: ratePercentById(activeVatRates, vatRateId),
    });
  }

  return (
    <>
    <SectionCard
      size="compact"
      title="Товарные позиции"
      description="Номенклатура → модель → вариант сборки, цена и ставка НДС"
      className="overflow-hidden"
      footer={
        activeTab === "goods" ? (
          <ListTotals
            primary={`${visibleRows.length} из ${rows.length} строк`}
            secondary={`Итого строк: ${formatMoney(linesTotal)} ₽ · документ: ${documentTotal}`}
            className="rounded-b-portal-lg border-0 px-0 py-0 lg:px-0"
          />
        ) : undefined
      }
    >
      <div className="space-y-portal-3">
        {message ? (
          <p className="text-portal-meta text-portal-muted" role="status">
            {message}
          </p>
        ) : null}

        <CompactTabs
          label="Разделы табличной части"
          size="compact"
          value={activeTab}
          onChange={(id) => setActiveTab(id as WorkspaceTab)}
          items={tabs}
        />

        {activeTab !== "goods" ? (
          <p className="rounded-portal-md border border-portal-border bg-portal-surface-secondary px-portal-4 py-portal-8 text-center text-portal-body text-portal-muted">
            Раздел «Доставка» — заглушка для визуальной проверки.
          </p>
        ) : (
          <>
            <div className="flex flex-col gap-portal-2 border-y border-portal-border bg-portal-surface-secondary px-portal-1 py-portal-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <div className="flex min-w-0 flex-wrap items-center gap-portal-1">
                <Button
                  type="button"
                  variant="primary"
                  size="compact"
                  title="Добавить строку"
                  aria-label="Добавить строку"
                  disabled={isPending}
                  onClick={addRow}
                >
                  <Plus size={14} />
                </Button>
                <Button
                  type="button"
                  size="compact"
                  title="Сохранить позиции"
                  aria-label="Сохранить позиции"
                  disabled={isPending || rows.length === 0}
                  onClick={saveAllRows}
                >
                  <Save size={14} />
                </Button>
                <Button
                  type="button"
                  size="compact"
                  title="Скопировать"
                  aria-label="Скопировать"
                  disabled={isPending || selectedIds.length === 0}
                  onClick={copySelected}
                >
                  <Copy size={14} />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="compact"
                  title="Удалить"
                  aria-label="Удалить"
                  disabled={isPending || (selectedIds.length === 0 && activeRowId === null)}
                  onClick={deleteSelected}
                  className="text-portal-danger hover:text-portal-danger"
                >
                  <X size={14} strokeWidth={2.5} />
                </Button>
                <span className="mx-portal-1 hidden h-5 w-px bg-portal-border sm:block" aria-hidden="true" />
                <Button type="button" size="compact" disabled>
                  Подобрать
                </Button>
                <Button type="button" size="compact" title="Настройка списка" aria-label="Настройка списка" disabled>
                  <Eye size={14} />
                </Button>
                <Button
                  type="button"
                  size="compact"
                  title="Обновить"
                  aria-label="Обновить"
                  disabled={isPending}
                  onClick={() => router.refresh()}
                >
                  <RefreshCw size={14} />
                </Button>
                <Button type="button" size="compact" title="Excel" aria-label="Excel" disabled>
                  <FileSpreadsheet size={14} />
                </Button>
                <span className="mx-portal-1 hidden h-5 w-px bg-portal-border sm:block" aria-hidden="true" />
                <Button type="button" size="compact" title="Вверх" aria-label="Переместить вверх" disabled>
                  <ArrowUp size={14} />
                </Button>
                <Button type="button" size="compact" title="Вниз" aria-label="Переместить вниз" disabled>
                  <ArrowDown size={14} />
                </Button>
                <Button
                  type="button"
                  size="compact"
                  title="Удалить отмеченные"
                  aria-label="Удалить отмеченные"
                  disabled={isPending || selectedIds.length === 0}
                  onClick={deleteSelected}
                >
                  <Trash2 size={14} />
                </Button>
                <Button type="button" size="compact" title="История" aria-label="История" disabled>
                  <Clock3 size={14} />
                </Button>
              </div>
              <div className="flex min-w-0 items-center gap-portal-1">
                <label className="relative flex min-w-0 flex-1 items-center sm:w-48 sm:flex-none">
                  <Search
                    size={14}
                    className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-portal-muted"
                    aria-hidden="true"
                  />
                  <span className="sr-only">Поиск</span>
                  <Input
                    size="compact"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Поиск"
                    aria-label="Поиск по позициям"
                    className="pl-8"
                  />
                </label>
                <Button type="button" size="compact" title="Ещё" aria-label="Ещё" disabled>
                  <MoreVertical size={14} />
                </Button>
              </div>
            </div>

            <div className="max-h-[min(52vh,420px)] overflow-auto rounded-portal-md border border-portal-border">
              <table className="w-max min-w-full border-collapse text-portal-dense">
                <thead>
                  <tr className="bg-portal-surface-secondary text-left text-portal-caption font-semibold text-portal-muted">
                    <th className="sticky top-0 z-[1] w-10 bg-portal-surface-secondary px-portal-2 py-2">
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={toggleAllVisible}
                        aria-label="Выбрать все видимые строки"
                        className="accent-portal-primary"
                      />
                    </th>
                    <th className="sticky top-0 z-[1] w-12 bg-portal-surface-secondary px-portal-2 py-2">N</th>
                    <th className="sticky top-0 z-[1] min-w-[11rem] bg-portal-surface-secondary px-portal-2 py-2">
                      Номенклатура
                    </th>
                    <th className="sticky top-0 z-[1] min-w-[10rem] bg-portal-surface-secondary px-portal-2 py-2">
                      Модель изделия
                    </th>
                    <th className="sticky top-0 z-[1] min-w-[10rem] bg-portal-surface-secondary px-portal-2 py-2">
                      Вариант сборки
                    </th>
                    <th className="sticky top-0 z-[1] min-w-[5.5rem] bg-portal-surface-secondary px-portal-2 py-2 text-right">
                      Количество
                    </th>
                    <th className="sticky top-0 z-[1] w-12 bg-portal-surface-secondary px-portal-2 py-2">Ед.</th>
                    <th className="sticky top-0 z-[1] min-w-[5.5rem] bg-portal-surface-secondary px-portal-2 py-2 text-right">
                      Цена
                    </th>
                    <th className="sticky top-0 z-[1] min-w-[5.5rem] bg-portal-surface-secondary px-portal-2 py-2 text-right">
                      Сумма
                    </th>
                    <th className="sticky top-0 z-[1] min-w-[5.5rem] bg-portal-surface-secondary px-portal-2 py-2 text-right">
                      % НДС
                    </th>
                    <th className="sticky top-0 z-[1] min-w-[5.5rem] bg-portal-surface-secondary px-portal-2 py-2 text-right">
                      Сумма НДС
                    </th>
                    <th className="sticky top-0 z-[1] min-w-[5.5rem] bg-portal-surface-secondary px-portal-2 py-2 text-right">
                      Всего
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={12}
                        className="px-portal-4 py-portal-8 text-center text-portal-body text-portal-muted"
                      >
                        Нет позиций. Нажмите «+», чтобы добавить строку.
                      </td>
                    </tr>
                  ) : (
                    visibleRows.map((row) => {
                      const selected = selectedIds.includes(row.id);
                      const active = activeRowId === row.id;
                      const models = (
                        row.nomenclatureId
                          ? modelsByNomenclature[row.nomenclatureId] ?? []
                          : []
                      ).filter((model) => model.status === "active");
                      const assemblyVariants = assemblyVariantsForModel(row.productModelId);
                      const variantRequired = assemblyVariants.length >= 1;
                      const vatAmount = calculateInclusiveVatAmount(
                        row.lineAmount,
                        row.vatRatePercent,
                      );
                      return (
                        <tr
                          key={row.id}
                          onClick={() => setActiveRowId(row.id)}
                          className={[
                            "border-t border-portal-border text-portal-text transition-colors",
                            selected
                              ? "bg-portal-primary-soft"
                              : "bg-portal-surface hover:bg-portal-surface-secondary",
                            active ? "shadow-[inset_3px_0_0_var(--portal-primary)]" : "",
                          ].join(" ")}
                        >
                          <td className="px-portal-2 py-1.5">
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() => toggleRow(row.id)}
                              onClick={(event) => event.stopPropagation()}
                              aria-label={`Выбрать строку ${row.position}`}
                              className="accent-portal-primary"
                            />
                          </td>
                          <td className="px-portal-2 py-1.5 tabular-nums text-portal-muted">
                            {row.position}
                          </td>
                          <td className="min-w-[11rem] px-portal-2 py-1.5">
                            <NomenclatureCellField
                              items={nomenclature}
                              value={row.nomenclatureId}
                              disabled={isPending}
                              onOpen={() => setNomenclaturePickerRowId(row.id)}
                            />
                          </td>
                          <td className="min-w-[10rem] px-portal-2 py-1.5">
                            <Select
                              size="compact"
                              value={row.productModelId ?? ""}
                              disabled={isPending || row.nomenclatureId === null}
                              aria-label={`Модель изделия строки ${row.position}`}
                              className="min-w-[9rem]"
                              onClick={(event) => event.stopPropagation()}
                              onChange={(event) => onModelChange(row, event.target.value)}
                            >
                              <option value="">Без модели</option>
                              {models.map((model) => (
                                <option
                                  key={model.product_model_id}
                                  value={model.product_model_id}
                                >
                                  {model.article} — {model.name}
                                </option>
                              ))}
                            </Select>
                          </td>
                          <td className="min-w-[10rem] px-portal-2 py-1.5">
                            {row.productModelId === null ? (
                              <span className="text-portal-muted">—</span>
                            ) : (
                              <Select
                                size="compact"
                                value={row.assemblyVariantId ?? ""}
                                disabled={isPending}
                                required={variantRequired}
                                aria-required={variantRequired}
                                aria-label={`Вариант сборки строки ${row.position}`}
                                className="min-w-[9rem]"
                                onClick={(event) => event.stopPropagation()}
                                onChange={(event) =>
                                  onAssemblyVariantChange(row, event.target.value)
                                }
                              >
                                <option value="">
                                  {variantRequired ? "Выберите вариант…" : "Без варианта"}
                                </option>
                                {assemblyVariants.map((variant) => (
                                  <option key={variant.id} value={variant.id}>
                                    {variant.name}
                                    {variant.total_cost
                                      ? ` (${formatAssemblyCost(variant.total_cost)} ₽)`
                                      : ""}
                                  </option>
                                ))}
                                {row.assemblyVariantId
                                  && !assemblyVariants.some(
                                    (variant) => variant.id === row.assemblyVariantId,
                                  )
                                  ? (
                                    <option value={row.assemblyVariantId}>
                                      {row.assemblyVariantName || `Вариант #${row.assemblyVariantId}`}
                                    </option>
                                  )
                                  : null}
                              </Select>
                            )}
                          </td>
                          <td className="px-portal-2 py-1.5 text-right">
                            <Input
                              size="compact"
                              value={row.quantity}
                              disabled={isPending}
                              aria-label={`Количество строки ${row.position}`}
                              className="w-[5.5rem] px-1 text-right"
                              onClick={(event) => event.stopPropagation()}
                              onChange={(event) =>
                                patchRow(row.id, { quantity: event.target.value }, false)
                              }
                              onBlur={(event) =>
                                patchRow(row.id, { quantity: event.target.value }, true)
                              }
                            />
                          </td>
                          <td className="px-portal-2 py-1.5 text-portal-muted">{row.unit}</td>
                          <td className="px-portal-2 py-1.5 text-right">
                            <Input
                              size="compact"
                              value={row.unitPrice}
                              disabled={isPending}
                              aria-label={`Цена строки ${row.position}`}
                              className="w-[5.5rem] px-1 text-right"
                              onClick={(event) => event.stopPropagation()}
                              onChange={(event) =>
                                patchRow(row.id, { unitPrice: event.target.value }, false)
                              }
                              onBlur={(event) =>
                                patchRow(row.id, { unitPrice: event.target.value }, true)
                              }
                            />
                          </td>
                          <td className="px-portal-2 py-1.5 text-right tabular-nums">
                            {formatMoney(row.lineAmount)}
                          </td>
                          <td className="px-portal-2 py-1.5 text-right">
                            <Select
                              size="compact"
                              value={row.vatRateId ?? ""}
                              disabled={isPending}
                              aria-label={`Ставка НДС строки ${row.position}`}
                              className="w-[5.5rem]"
                              onClick={(event) => event.stopPropagation()}
                              onChange={(event) => onVatChange(row, event.target.value)}
                            >
                              <option value="">—</option>
                              {activeVatRates.map((rate) => (
                                <option key={rate.id} value={rate.id}>
                                  {vatRateLabel(rate)}
                                </option>
                              ))}
                              {row.vatRateId
                                && !activeVatRates.some((rate) => rate.id === row.vatRateId)
                                ? (
                                  <option value={row.vatRateId}>
                                    {formatVatRatePercent(row.vatRatePercent)}
                                  </option>
                                )
                                : null}
                            </Select>
                          </td>
                          <td className="px-portal-2 py-1.5 text-right tabular-nums">
                            {formatMoney(vatAmount)}
                          </td>
                          <td className="px-portal-2 py-1.5 text-right font-semibold tabular-nums">
                            {formatMoney(row.lineAmount)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </SectionCard>
    <NomenclaturePickModal
      open={nomenclaturePickerRowId !== null}
      items={nomenclature}
      categories={nomenclatureCategories}
      value={
        nomenclaturePickerRowId === null
          ? null
          : rows.find((row) => row.id === nomenclaturePickerRowId)?.nomenclatureId ?? null
      }
      onClose={() => setNomenclaturePickerRowId(null)}
      onSelect={(entry) => {
        const rowId = nomenclaturePickerRowId;
        if (rowId === null) return;
        const row = rows.find((item) => item.id === rowId);
        if (!row) return;
        onNomenclatureChange(row, entry);
      }}
    />
    </>
  );
}
