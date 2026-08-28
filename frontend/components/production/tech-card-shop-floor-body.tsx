"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";

import { TechCardMediaCarousel } from "@/components/production/tech-card-media-carousel";
import { Button, IconButton } from "@/components/ui/button";
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
import { Field, Input, Select, Textarea } from "@/components/ui/form-controls";
import { InlineAlert } from "@/components/ui/inline-alert";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import type { ShopStageModule } from "@/lib/production/shop-stage-modules";
import {
  shopStageFinishedGoodsHint,
  shopStageIsFinishedGoods,
  shopStageRequiresMaterialFact,
} from "@/lib/production/shop-stage-modules";
import {
  formatDesiredDate,
  formatTechCardDateTime,
  formatVolumeUnit,
  stageResultStatusLabel,
  techCardModelLabel,
  unitLineSizeTypeLabel,
} from "@/lib/production/tech-cards";
import { techCardVisibleNumber } from "@/lib/production/tech-card-display";
import type {
  ApiTechnicalCard,
  ApiTechnicalCardAssemblySewingOp,
  ApiTechnicalCardCompositionLine,
  ApiTechnicalCardMedia,
  ApiTechnicalCardOperationLine,
  ApiTechnicalCardStageResult,
} from "@/lib/sales/order-tech-cards-api";
import type { WorkCenter } from "@/lib/shop-routings";
import { formatAssemblyCost } from "@/lib/product-models";

type TechCardShopFloorBodyProps = {
  card: ApiTechnicalCard;
  shopStage: ShopStageModule;
  shopStageMatchesCurrent: boolean;
  /** Hide stage fact editor when a completion form is open (avoid duplicate blocks). */
  hideStageFact?: boolean;
  mediaItems: ApiTechnicalCardMedia[];
  shopMaterialLines: ApiTechnicalCardCompositionLine[];
  shopMissingFactCount: number;
  shopFactDrafts: Record<number, string>;
  setShopFactDrafts: (
    updater: (current: Record<number, string>) => Record<number, string>,
  ) => void;
  activeStage: ApiTechnicalCardStageResult | null;
  stageResults: ApiTechnicalCardStageResult[];
  busy: boolean;
  canStartActiveStage: boolean;
  canCompleteActiveStage: boolean;
  canRollbackActiveStage: boolean;
  factPerformer: string;
  factPerformerOptions: { value: string; label: string }[];
  factPerformerSource?: "api" | "demo";
  factWorkDone: string;
  factDuration: string;
  scrapQty: string;
  reworkQty: string;
  stageNotes: string;
  setFactPerformer: (value: string) => void;
  setFactWorkDone: (value: string) => void;
  setFactDuration: (value: string) => void;
  setScrapQty: (value: string) => void;
  setReworkQty: (value: string) => void;
  setStageNotes: (value: string) => void;
  factWorkCenterId?: string;
  setFactWorkCenterId?: (value: string) => void;
  workCenters?: WorkCenter[];
  shopOperationLines?: ApiTechnicalCardOperationLine[];
  opVolumeDrafts?: Record<number, string>;
  setOpVolumeDrafts?: (
    updater: (current: Record<number, string>) => Record<number, string>,
  ) => void;
  onSaveOpVolume?: (lineId: number) => void;
  assemblySewingOps?: ApiTechnicalCardAssemblySewingOp[];
  onExpandMedia: (src: string) => void;
  onSetPrimaryMedia: (item: ApiTechnicalCardMedia) => void;
  onDeleteMedia: (item: ApiTechnicalCardMedia) => void;
  onReplaceMedia: (item: ApiTechnicalCardMedia, file: File) => void;
  onAddMedia: (files: File[]) => void;
  onSaveShopFactQty: (lineId: number) => void;
  onSaveAllShopFactQty?: () => void;
  onDeleteShopMaterial?: (lineId: number) => void;
  onSaveAllOpVolumes?: () => void;
  onSaveStageFact: () => void;
  onStartActiveStage: () => void;
  onCompleteActiveStage: () => void;
  onRollbackActiveStage: () => void;
};

function stageTone(status: string): "neutral" | "primary" | "success" | "warning" {
  if (status === "in_progress") return "primary";
  if (status === "completed") return "success";
  if (status === "skipped") return "warning";
  return "neutral";
}

/** Compact цех workspace: mockup + context + fact — not the manager PT-07 document. */
export function TechCardShopFloorBody({
  card,
  shopStage,
  shopStageMatchesCurrent,
  hideStageFact = false,
  mediaItems,
  shopMaterialLines,
  shopMissingFactCount,
  shopFactDrafts,
  setShopFactDrafts,
  activeStage,
  stageResults,
  busy,
  canStartActiveStage,
  canCompleteActiveStage,
  canRollbackActiveStage,
  factPerformer,
  factPerformerOptions,
  factPerformerSource = "demo",
  factWorkDone,
  factDuration,
  scrapQty,
  reworkQty,
  stageNotes,
  setFactPerformer,
  setFactWorkDone,
  setFactDuration,
  setScrapQty,
  setReworkQty,
  setStageNotes,
  factWorkCenterId = "",
  setFactWorkCenterId,
  workCenters = [],
  shopOperationLines = [],
  opVolumeDrafts = {},
  setOpVolumeDrafts,
  onSaveOpVolume,
  assemblySewingOps = [],
  onExpandMedia,
  onSetPrimaryMedia,
  onDeleteMedia,
  onReplaceMedia,
  onAddMedia,
  onSaveShopFactQty,
  onSaveAllShopFactQty,
  onDeleteShopMaterial,
  onSaveAllOpVolumes,
  onSaveStageFact,
  onStartActiveStage,
  onCompleteActiveStage,
  onRollbackActiveStage,
}: TechCardShopFloorBodyProps) {
  const documentNumber = techCardVisibleNumber(card);
  const mediaEditable = shopStage.code === "design" && shopStageMatchesCurrent;
  const unitLines = [...(card.unit_lines ?? [])]
    .sort((a, b) => a.unit_index - b.unit_index)
    .slice(0, 12);
  const unitTotal = card.unit_lines?.length ?? 0;
  const requiresMaterialFact = shopStageRequiresMaterialFact(shopStage.code);
  const isPrintShop = shopStage.code === "print";
  const isSewingShop = shopStage.code === "sewing";
  const isPackagingShop = shopStage.code === "packaging";
  const isQcShop = shopStage.code === "qc";
  const isFgStage = shopStageIsFinishedGoods(shopStage.code);
  const fgHint = shopStageFinishedGoodsHint(shopStage.code);
  const stageWorkCenters = workCenters.filter((row) => {
    const matchesStage =
      activeStage?.production_stage_id == null ||
      row.production_stage_id == null ||
      row.production_stage_id === activeStage.production_stage_id;
    return matchesStage && (row.is_active || String(row.id) === factWorkCenterId);
  });
  const sewingOpsSorted = [...assemblySewingOps].sort(
    (a, b) => a.sequence - b.sequence,
  );
  const [materialsEditing, setMaterialsEditing] = useState(false);
  const factInputsLocked = !shopStageMatchesCurrent || !materialsEditing;

  return (
    <>
      <div
        className="rounded-portal-md border border-portal-primary/30 bg-portal-primary-soft/30 px-portal-4 py-portal-3 text-portal-body text-portal-text"
        role="status"
      >
        {isFgStage ? "Этап" : "Цех"} <strong>{shopStage.title}</strong>
        {shopStageMatchesCurrent
          ? " · текущий шаг маршрута — можно писать факт и завершать этап."
          : ` · техкарта на «${card.current_stage_label ?? "не назначен"}»; запись факта этого этапа недоступна.`}
        {requiresMaterialFact && shopMissingFactCount > 0
          ? ` Hard-gate: нет факта у ${shopMissingFactCount} материал(ов).`
          : null}
      </div>

      {fgHint ? (
        <InlineAlert tone="neutral" size="compact">
          {fgHint}
        </InlineAlert>
      ) : null}

      <div className="grid grid-cols-1 gap-portal-4 xl:grid-cols-[minmax(0,5fr)_minmax(0,4fr)]">
        <SectionCard
          title="Макет"
          description={
            shopStage.code === "design"
              ? shopStageMatchesCurrent
                ? "Рабочий макет цеха Дизайн — можно менять файлы."
                : "Этап Дизайн не текущий — макет только для просмотра."
              : "Только просмотр. Правка макета — в цехе Дизайн."
          }
          size="compact"
        >
          <TechCardMediaCarousel
            items={mediaItems}
            busy={busy}
            readOnly={!mediaEditable}
            size="shop"
            onExpand={onExpandMedia}
            onSetPrimary={onSetPrimaryMedia}
            onDelete={onDeleteMedia}
            onReplace={onReplaceMedia}
            onAdd={onAddMedia}
          />
        </SectionCard>

        <div className="grid gap-portal-4 content-start">
          <SectionCard title="Контекст" size="compact">
            <dl className="grid gap-portal-3 sm:grid-cols-2">
              <div>
                <dt className="text-portal-caption text-portal-muted">Техкарта</dt>
                <dd className="mt-1 text-portal-body font-medium">{documentNumber}</dd>
              </div>
              <div>
                <dt className="text-portal-caption text-portal-muted">Клиент</dt>
                <dd className="mt-1 text-portal-body">{card.client_name ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-portal-caption text-portal-muted">Модель</dt>
                <dd className="mt-1 text-portal-body">{techCardModelLabel(card)}</dd>
              </div>
              <div>
                <dt className="text-portal-caption text-portal-muted">Сборка</dt>
                <dd className="mt-1 text-portal-body">{card.assembly_variant_name ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-portal-caption text-portal-muted">Количество</dt>
                <dd className="mt-1 text-portal-body tabular-nums">{card.quantity}</dd>
              </div>
              <div>
                <dt className="text-portal-caption text-portal-muted">Сдача</dt>
                <dd className="mt-1 text-portal-body">{formatDesiredDate(card.desired_date)}</dd>
              </div>
            </dl>
          </SectionCard>

          {hideStageFact ? null : (
            <SectionCard
              title={`Этап · ${shopStage.title}`}
              description={
                isSewingShop
                  ? "Факт цеха Пошив: исполнитель, что сделано, длительность. Без hard-gate материалов."
                  : isPackagingShop
                    ? "Факт цеха Упаковка: исполнитель, что сделано, длительность. Без hard-gate материалов."
                    : isFgStage
                      ? shopStage.code === "ready_to_ship"
                        ? "Факт этапа «Готовы к отгрузке»: исполнитель и длительность. Завершение = приход ГП на склад."
                        : "Факт этапа «Отгружены»: исполнитель и длительность. Завершение = списание со склада."
                      : "Исполнитель, работа и длительность на stage result техкарты."
              }
              size="compact"
            >
            {!shopStageMatchesCurrent || !activeStage ? (
              <EmptyState
                title={`Этап «${shopStage.title}» не текущий`}
                description="Дождитесь прохождения маршрута до этого цеха. Обход порядка запрещён."
              />
            ) : (
              <div className="grid gap-portal-3">
                <div className="flex flex-wrap items-center gap-portal-2">
                  <StatusBadge size="compact" tone={stageTone(String(activeStage.status))}>
                    {stageResultStatusLabel(String(activeStage.status))}
                  </StatusBadge>
                  <span className="text-portal-caption text-portal-muted">
                    Начало: {formatTechCardDateTime(activeStage.started_at)}
                  </span>
                </div>
                <div className="grid gap-portal-3 sm:grid-cols-2">
                  <Field label="Исполнитель">
                    <Select
                      value={factPerformer}
                      disabled={busy}
                      onChange={(event) => setFactPerformer(event.target.value)}
                    >
                      <option value="">Не выбран</option>
                      {factPerformerOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </Select>
                    <p className="mt-1 text-portal-caption text-portal-muted">
                      {factPerformerSource === "api"
                        ? "Список из platform users (справочник / роли)."
                        : "Временный demo-список: API исполнителей недоступен — перезапустите backend :8000 и обновите страницу."}
                    </p>
                  </Field>
                  <Field label="Длительность, сек">
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      value={factDuration}
                      onChange={(event) => setFactDuration(event.target.value)}
                      disabled={busy}
                      placeholder="например, 1800"
                    />
                  </Field>
                  <Field label="Оборудование">
                    <Select
                      value={factWorkCenterId}
                      disabled={busy || !setFactWorkCenterId}
                      onChange={(event) => setFactWorkCenterId?.(event.target.value)}
                      aria-label="Плановое оборудование этапа"
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
                  {isQcShop ? (
                    <Field label="Результат" className="sm:col-span-2">
                      <Select
                        value={factWorkDone}
                        disabled={busy}
                        onChange={(event) => setFactWorkDone(event.target.value)}
                      >
                        <option value="">Не выбран</option>
                        <option value="passed">Прошёл</option>
                        <option value="failed">Не прошёл</option>
                      </Select>
                    </Field>
                  ) : (
                    <Field label="Что сделано" className="sm:col-span-2">
                      <Textarea
                        value={factWorkDone}
                        onChange={(event) => setFactWorkDone(event.target.value)}
                        disabled={busy}
                        rows={3}
                        placeholder={
                          isSewingShop
                            ? "Сборка, строчки, узлы…"
                            : isPackagingShop
                              ? "Комплект, упаковка, маркировка…"
                              : "Кратко по факту этапа…"
                        }
                      />
                    </Field>
                  )}
                </div>
                {isQcShop ? (
                  <div className="grid gap-portal-3 sm:grid-cols-2 mt-portal-2">
                    <Field label="Брак, шт">
                      <Input
                        value={scrapQty}
                        onChange={(event) => setScrapQty(event.target.value)}
                        disabled={busy}
                        inputMode="decimal"
                        placeholder="например, 0.5"
                      />
                    </Field>
                    <Field label="Доработка, шт">
                      <Input
                        value={reworkQty}
                        onChange={(event) => setReworkQty(event.target.value)}
                        disabled={busy}
                        inputMode="decimal"
                        placeholder="например, 0.2"
                      />
                    </Field>
                    <Field label="Примечание" className="sm:col-span-2">
                      <Textarea
                        value={stageNotes}
                        onChange={(event) => setStageNotes(event.target.value)}
                        disabled={busy}
                        rows={3}
                      />
                    </Field>
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-portal-2">
                  <Button
                    type="button"
                    variant="primary"
                    size="compact"
                    disabled={busy}
                    onClick={onSaveStageFact}
                  >
                    Сохранить факт
                  </Button>
                  {canStartActiveStage ? (
                    <Button
                      type="button"
                      size="compact"
                      disabled={busy}
                      onClick={onStartActiveStage}
                    >
                      Начать этап
                    </Button>
                  ) : null}
                  {canCompleteActiveStage ? (
                    <Button
                      type="button"
                      size="compact"
                      variant="primary"
                      disabled={busy}
                      onClick={onCompleteActiveStage}
                    >
                      Завершить этап
                    </Button>
                  ) : null}
                  {canRollbackActiveStage ? (
                    <Button
                      type="button"
                      size="compact"
                      disabled={busy}
                      onClick={onRollbackActiveStage}
                    >
                      Откатить
                    </Button>
                  ) : null}
                </div>
              </div>
            )}
            </SectionCard>
          )}
        </div>
      </div>

      {isPrintShop && shopOperationLines.length > 0 ? (
        <SectionCard
          title="Операции · Печать"
          description="Фактические объёмы TechOperation этого цеха. Отдельно от факта материалов."
          size="compact"
          actions={
            shopStageMatchesCurrent ? (
              <Button
                type="button"
                size="compact"
                variant="primary"
                disabled={busy || !onSaveAllOpVolumes}
                onClick={() => onSaveAllOpVolumes?.()}
              >
                Сохранить
              </Button>
            ) : null
          }
        >
          <DataTableFrame>
            <DataTable minWidthClassName="min-w-[440px]">
              <DataTableHead>
                <tr>
                  <DataTableHeaderCell>Операция</DataTableHeaderCell>
                  <DataTableHeaderCell className="w-24">Ед.</DataTableHeaderCell>
                  <DataTableHeaderCell className="w-36">Объём</DataTableHeaderCell>
                </tr>
              </DataTableHead>
              <DataTableBody>
                {shopOperationLines.map((line) => (
                  <DataTableRow key={line.id}>
                    <DataTableCell>{line.operation_name}</DataTableCell>
                    <DataTableCell>{formatVolumeUnit(String(line.volume_unit))}</DataTableCell>
                    <DataTableCell>
                      <Input
                        size="compact"
                        type="number"
                        min="0"
                        step="0.001"
                        value={opVolumeDrafts[line.id] ?? ""}
                        onChange={(event) =>
                          setOpVolumeDrafts?.((current) => ({
                            ...current,
                            [line.id]: event.target.value,
                          }))
                        }
                        aria-label={`Объём ${line.operation_name}`}
                        disabled={busy || !shopStageMatchesCurrent}
                      />
                    </DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          </DataTableFrame>
        </SectionCard>
      ) : null}

      {isSewingShop ? (
        <SectionCard
          title="Операции пошива · план"
          description="Снимок швейных операций сборки (cost contour). Факт цеха пишется в блок этапа выше, не в эти строки."
          size="compact"
        >
          {sewingOpsSorted.length === 0 ? (
            <EmptyState
              title="Нет операций пошива"
              description="Снимок появится из варианта сборки позиции заказа при формировании техкарты."
            />
          ) : (
            <DataTableFrame>
              <DataTable minWidthClassName="min-w-[560px]">
                <DataTableHead>
                  <tr>
                    <DataTableHeaderCell className="w-14">#</DataTableHeaderCell>
                    <DataTableHeaderCell>Операция</DataTableHeaderCell>
                    <DataTableHeaderCell className="w-24">Кол-во</DataTableHeaderCell>
                    <DataTableHeaderCell className="w-28">Сек.</DataTableHeaderCell>
                    <DataTableHeaderCell className="w-28">Стоимость</DataTableHeaderCell>
                  </tr>
                </DataTableHead>
                <DataTableBody>
                  {sewingOpsSorted.map((op) => (
                    <DataTableRow key={`${op.sequence}-${op.operation_name}`}>
                      <DataTableCell className="tabular-nums">{op.sequence}</DataTableCell>
                      <DataTableCell>{op.operation_name}</DataTableCell>
                      <DataTableCell className="tabular-nums">
                        {op.quantity_per_item ?? "—"}
                      </DataTableCell>
                      <DataTableCell className="tabular-nums">
                        {op.duration_seconds}
                      </DataTableCell>
                      <DataTableCell className="tabular-nums">
                        {formatAssemblyCost(op.line_total ?? op.cost)} ₽
                      </DataTableCell>
                    </DataTableRow>
                  ))}
                </DataTableBody>
              </DataTable>
            </DataTableFrame>
          )}
        </SectionCard>
      ) : null}

      {shopMaterialLines.length > 0 || requiresMaterialFact ? (
        <SectionCard
          title={`Материалы · ${shopStage.title}`}
          description={
            requiresMaterialFact
              ? "Факт обязателен для hard-gate завершения (Раскрой / Печать). План — подсказка."
              : "Факт материалов этого цеха на техкарте."
          }
          size="compact"
          actions={
            shopStageMatchesCurrent && shopMaterialLines.length > 0 ? (
              <div className="flex flex-wrap items-center gap-portal-2">
                <IconButton
                  label={
                    materialsEditing
                      ? "Завершить правку факта"
                      : "Редактировать факт"
                  }
                  variant="secondary"
                  disabled={busy}
                  onClick={() => setMaterialsEditing((current) => !current)}
                >
                  <Pencil className="size-4" aria-hidden="true" />
                </IconButton>
                <Button
                  type="button"
                  size="compact"
                  variant="primary"
                  disabled={busy || !onSaveAllShopFactQty}
                  onClick={() => {
                    onSaveAllShopFactQty?.();
                    setMaterialsEditing(false);
                  }}
                >
                  Сохранить
                </Button>
              </div>
            ) : null
          }
        >
          {shopMaterialLines.length === 0 ? (
            <EmptyState
              title="Нет материалов цеха"
              description="MATERIAL lines с привязкой к этому ProductionStage появятся из состава техкарты."
            />
          ) : (
            <DataTableFrame>
              <DataTable minWidthClassName="min-w-[520px]">
                <DataTableHead>
                  <tr>
                    <DataTableHeaderCell>Материал</DataTableHeaderCell>
                    <DataTableHeaderCell className="w-24">План</DataTableHeaderCell>
                    <DataTableHeaderCell className="w-28">Факт</DataTableHeaderCell>
                    <DataTableHeaderCell className="w-20">Ед.</DataTableHeaderCell>
                    {materialsEditing ? (
                      <DataTableHeaderCell className="w-14" />
                    ) : null}
                  </tr>
                </DataTableHead>
                <DataTableBody>
                  {shopMaterialLines.map((line) => (
                    <DataTableRow key={line.id}>
                      <DataTableCell>{line.snapshot_name}</DataTableCell>
                      <DataTableCell className="tabular-nums text-portal-muted">
                        {line.planned_qty ?? "—"}
                      </DataTableCell>
                      <DataTableCell>
                        <Input
                          size="compact"
                          type="number"
                          min="0"
                          step="0.001"
                          value={shopFactDrafts[line.id] ?? ""}
                          onChange={(event) =>
                            setShopFactDrafts((current) => ({
                              ...current,
                              [line.id]: event.target.value,
                            }))
                          }
                          aria-label={`Факт материала ${line.snapshot_name}`}
                          disabled={busy || factInputsLocked}
                        />
                      </DataTableCell>
                      <DataTableCell>{line.unit ?? "—"}</DataTableCell>
                      {materialsEditing ? (
                        <DataTableCell>
                          <IconButton
                            label={`Удалить материал ${line.snapshot_name}`}
                            variant="danger"
                            disabled={busy || !onDeleteShopMaterial}
                            onClick={() => onDeleteShopMaterial?.(line.id)}
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
      ) : null}

      {unitTotal > 0 ? (
        <SectionCard
          title="Поштучно"
          description={
            unitTotal > unitLines.length
              ? `Показаны первые ${unitLines.length} из ${unitTotal}. Полный список — в карточке менеджера.`
              : "Размеры и персонализация для исполнения."
          }
          size="compact"
        >
          <DataTableFrame>
            <DataTable minWidthClassName="min-w-[640px]">
              <DataTableHead>
                <tr>
                  <DataTableHeaderCell className="w-12">#</DataTableHeaderCell>
                  <DataTableHeaderCell className="w-28">Тип</DataTableHeaderCell>
                  <DataTableHeaderCell className="w-24">Размер</DataTableHeaderCell>
                  <DataTableHeaderCell>Фамилия</DataTableHeaderCell>
                  <DataTableHeaderCell className="w-24">Номер</DataTableHeaderCell>
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
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          </DataTableFrame>
        </SectionCard>
      ) : null}

      <SectionCard title="Маршрут" description="Только обзор; действия — в блоке этапа выше." size="compact">
        {stageResults.length === 0 ? (
          <EmptyState title="Маршрут не назначен" description="Назначьте маршрут в техкарте менеджера." />
        ) : (
          <ol className="flex flex-wrap gap-portal-2">
            {stageResults.map((stage) => {
              const isCurrent = stage.stage_order === card.current_stage_order;
              const isThisShop = stage.stage_label === shopStage.title;
              return (
                <li
                  key={stage.id}
                  className={[
                    "rounded-portal-md border px-portal-3 py-portal-2 text-portal-caption",
                    isCurrent
                      ? "border-portal-primary/40 bg-portal-primary-soft/30 font-medium text-portal-text"
                      : "border-portal-border text-portal-muted",
                    isThisShop && !isCurrent ? "ring-1 ring-portal-border" : "",
                  ].join(" ")}
                >
                  {stage.stage_order}. {stage.stage_label}
                  {" · "}
                  {stageResultStatusLabel(String(stage.status))}
                </li>
              );
            })}
          </ol>
        )}
      </SectionCard>
    </>
  );
}
