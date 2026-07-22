"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { ChevronDown } from "lucide-react";

import {
  archiveProductModel,
  activateProductModel,
  copyProductModel,
  deleteProductModelMedia,
  replaceProductModelMedia,
  revertProductModelToDraft,
  setProductModelMediaPrimary,
  updateProductModelRequisites,
  uploadProductModelMedia,
} from "@/app/(workspace)/settings/catalogs/product-models/product-model-actions";
import { CatalogVersionedCardLayout } from "@/components/entity/catalog-versioned-card-layout";
import { VersionedWorkspace } from "@/components/entity/versioned-workspace";
import { AssemblyVariantsBlock } from "@/components/settings/assembly-variants-block";
import { ProductModelMediaCarousel } from "@/components/settings/product-model-media-carousel";
import { ProductModelToolbarActions } from "@/components/settings/product-model-toolbar-actions";
import { EntityHeader } from "@/components/ui/entity-header";
import { Field, Input, Select, Textarea } from "@/components/ui/form-controls";
import { ImageLightbox } from "@/components/ui/image-lightbox";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  PRODUCT_MODEL_IMAGE_RULE,
  PRODUCT_MODEL_SIZE_TYPE_LABELS,
  PRODUCT_MODEL_STATUS_FILTER_ITEMS,
  PRODUCT_MODEL_STATUS_LABELS,
  MODEL_OPERATIONS_WARNING,
  formatAssemblyVariantCostRange,
  isProductModelRequisitesDirty,
  productModelStatusTone,
  toProductModelRequisitesDraft,
  validateProductModelCreateDraft,
  validateProductModelImageFile,
  type AssemblyVariant,
  type ProductModel,
  type ProductModelHistoryEntry,
  type ProductModelMedia,
  type ProductModelRequisitesDraft,
  type ProductModelStatus,
  type ProductModelVersionView,
} from "@/lib/product-models";
import type { SewingOperation } from "@/lib/sewing-operations";
import type { SizeGridListItem } from "@/lib/size-grids";

const COLUMN_GAP = "gap-[14px]";

const DIRTY_LEAVE_MESSAGE =
  "Есть несохранённые изменения. Уйти без сохранения?";

/** PT-08 + DS-PT-08-CATALOG product-model card (`6.1.8` / `6.1.10`). */
export function ProductModelPersistentCard({
  model,
  media,
  history,
  assemblyVariants,
  sewingOperations,
  sizeGrids,
  initialEditing = false,
}: {
  model: ProductModel;
  /** Reserved for PT-08 version bar; history lives in main column. */
  versions?: ProductModelVersionView[];
  media: ProductModelMedia[];
  history: ProductModelHistoryEntry[];
  assemblyVariants: AssemblyVariant[];
  sewingOperations: SewingOperation[];
  sizeGrids: SizeGridListItem[];
  initialEditing?: boolean;
}) {
  const router = useRouter();
  const [trackedModel, setTrackedModel] = useState(model);
  const [current, setCurrent] = useState(model);
  const [trackedMedia, setTrackedMedia] = useState(media);
  const [items, setItems] = useState(media);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [editing, setEditing] = useState(initialEditing);
  const [draft, setDraft] = useState<ProductModelRequisitesDraft | null>(() =>
    initialEditing ? toProductModelRequisitesDraft(model) : null,
  );

  if (model.id !== trackedModel.id) {
    setTrackedModel(model);
    setCurrent(model);
    setEditing(false);
    setDraft(null);
    setActionError(null);
  } else if (model !== trackedModel && !editing) {
    setTrackedModel(model);
    setCurrent(model);
  }

  if (media !== trackedMedia) {
    setTrackedMedia(media);
    setItems(media);
  }

  const hasJournalOperations = Boolean(current.has_journal_operations);
  const sizeContourLocked = hasJournalOperations;
  const canRevertToDraft = !hasJournalOperations && current.status !== "draft";
  const dirty =
    editing && draft != null && isProductModelRequisitesDirty(current, draft);
  const linkedSizeGrid = useMemo(() => {
    const gridId =
      editing && draft ? draft.size_grid_id : current.size_grid_id;
    if (gridId == null) return null;
    return sizeGrids.find((grid) => grid.id === gridId) ?? null;
  }, [current.size_grid_id, draft, editing, sizeGrids]);
  const historySummary =
    history.length === 0
      ? "Записей пока нет"
      : `${history.length} ${history.length === 1 ? "запись" : history.length < 5 ? "записи" : "записей"}`;
  const costRangeLabel = formatAssemblyVariantCostRange(assemblyVariants);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const uploadFiles = async (files: File[]) => {
    for (const file of files) {
      const ruleError = validateProductModelImageFile(file);
      if (ruleError) {
        setWarning(ruleError);
        return;
      }
    }

    setBusy(true);
    setWarning(null);
    try {
      const makePrimary = items.length === 0;
      const data = new FormData();
      data.append("model_id", String(current.id));
      if (makePrimary) data.append("is_primary", "1");
      for (const file of files) data.append("files", file);
      const uploaded = await uploadProductModelMedia(data);
      setItems((currentItems) => [...currentItems, ...uploaded]);
      router.refresh();
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "Не удалось загрузить изображение";
      setWarning(
        message === PRODUCT_MODEL_IMAGE_RULE || message.includes("10 МБ") || message.includes("JPEG")
          ? PRODUCT_MODEL_IMAGE_RULE
          : message,
      );
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async (item: ProductModelMedia) => {
    if (!window.confirm(`Удалить фото «${item.filename}»?`)) return;
    setBusy(true);
    setWarning(null);
    try {
      const data = new FormData();
      data.append("model_id", String(current.id));
      data.append("media_id", String(item.id));
      await deleteProductModelMedia(data);
      setItems((currentItems) => {
        const remaining = currentItems.filter((row) => row.id !== item.id);
        if (item.is_primary && remaining.length > 0 && !remaining.some((row) => row.is_primary)) {
          return remaining.map((row, index) =>
            index === 0 ? { ...row, is_primary: true } : row,
          );
        }
        return remaining;
      });
      router.refresh();
    } catch (caught) {
      setWarning(caught instanceof Error ? caught.message : "Не удалось удалить изображение");
    } finally {
      setBusy(false);
    }
  };

  const onSetPrimary = async (item: ProductModelMedia) => {
    if (item.is_primary) return;
    setBusy(true);
    setWarning(null);
    try {
      const data = new FormData();
      data.append("model_id", String(current.id));
      data.append("media_id", String(item.id));
      await setProductModelMediaPrimary(data);
      setItems((currentItems) =>
        currentItems.map((row) => ({ ...row, is_primary: row.id === item.id })),
      );
      router.refresh();
    } catch (caught) {
      setWarning(
        caught instanceof Error ? caught.message : "Не удалось назначить основное фото",
      );
    } finally {
      setBusy(false);
    }
  };

  const onReplace = async (item: ProductModelMedia, file: File) => {
    const ruleError = validateProductModelImageFile(file);
    if (ruleError) {
      setWarning(ruleError);
      return;
    }
    setBusy(true);
    setWarning(null);
    try {
      const data = new FormData();
      data.append("model_id", String(current.id));
      data.append("media_id", String(item.id));
      data.append("file", file);
      if (item.is_primary) data.append("is_primary", "1");
      const created = await replaceProductModelMedia(data);
      setItems((currentItems) =>
        currentItems.map((row) => {
          if (row.id === item.id) return created;
          if (created.is_primary) return { ...row, is_primary: false };
          return row;
        }),
      );
      router.refresh();
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "Не удалось заменить изображение";
      setWarning(
        message === PRODUCT_MODEL_IMAGE_RULE ||
          message.includes("10 МБ") ||
          message.includes("JPEG")
          ? PRODUCT_MODEL_IMAGE_RULE
          : message,
      );
    } finally {
      setBusy(false);
    }
  };

  const startEdit = () => {
    setEditing(true);
    setDraft(toProductModelRequisitesDraft(current));
    setActionError(null);
  };

  const cancelEdit = () => {
    if (
      draft &&
      isProductModelRequisitesDirty(current, draft) &&
      !window.confirm(DIRTY_LEAVE_MESSAGE)
    ) {
      return;
    }
    setEditing(false);
    setDraft(null);
    setActionError(null);
  };

  const onSave = async () => {
    if (!draft) return;
    const validationError = validateProductModelCreateDraft(draft);
    if (validationError) {
      setActionError(validationError);
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      const updated = await updateProductModelRequisites(current.id, {
        article: draft.article,
        name: draft.name,
        size_type: draft.size_type,
        description: draft.description || null,
        size_grid_id: draft.size_grid_id,
      });
      setCurrent(updated);
      setEditing(false);
      setDraft(null);
      router.refresh();
    } catch (caught) {
      setActionError(
        caught instanceof Error ? caught.message : "Не удалось сохранить",
      );
    } finally {
      setBusy(false);
    }
  };

  const onBackToList = (event: MouseEvent<HTMLAnchorElement>) => {
    if (dirty && !window.confirm(DIRTY_LEAVE_MESSAGE)) {
      event.preventDefault();
    }
  };

  const onArchive = async () => {
    if (current.status === "archived") return;
    if (!window.confirm(`Архивировать модель «${current.name}»?`)) return;
    setBusy(true);
    setActionError(null);
    try {
      const updated = await archiveProductModel(current.id);
      setCurrent(updated);
      setEditing(false);
      setDraft(null);
      router.refresh();
    } catch (caught) {
      setActionError(
        caught instanceof Error ? caught.message : "Не удалось архивировать",
      );
    } finally {
      setBusy(false);
    }
  };

  const onStatusChange = async (nextStatus: string) => {
    if (busy) return;
    const status = nextStatus as ProductModelStatus;
    if (status === current.status) return;
    if (status === "draft") {
      if (hasJournalOperations) {
        window.alert(MODEL_OPERATIONS_WARNING);
        return;
      }
      if (!window.confirm(`Вернуть модель «${current.name}» в черновик?`)) {
        return;
      }
    }
    if (
      status === "archived" &&
      !window.confirm(`Перевести модель «${current.name}» в архив?`)
    ) {
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      const updated =
        status === "active"
          ? await activateProductModel(current.id)
          : status === "draft"
            ? await revertProductModelToDraft(current.id)
            : await archiveProductModel(current.id);
      setCurrent(updated);
      router.refresh();
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "Не удалось сменить статус";
      if (message.includes("были операции")) {
        window.alert(MODEL_OPERATIONS_WARNING);
      }
      setActionError(message);
    } finally {
      setBusy(false);
    }
  };

  const onCopy = async () => {
    setBusy(true);
    setActionError(null);
    try {
      const created = await copyProductModel(current.id);
      router.push(`/settings/catalogs/product-models/${created.id}`);
      router.refresh();
    } catch (caught) {
      setActionError(
        caught instanceof Error ? caught.message : "Не удалось скопировать",
      );
      setBusy(false);
    }
  };

  const onPrint = () => {
    window.alert(
      "Печать будет доступна после настройки шаблона в Администрирование → Печатные формы.",
    );
  };

  return (
    <>
      {previewSrc ? (
        <ImageLightbox
          src={previewSrc}
          alt={`Фото: ${current.name}`}
          onClose={() => setPreviewSrc(null)}
        />
      ) : null}

      <VersionedWorkspace
        header={
          <div className="rounded-portal-lg border border-portal-border bg-portal-surface p-portal-4 shadow-portal-card sm:p-portal-5">
            <EntityHeader
              eyebrow={
                <Link
                  href="/settings/catalogs/product-models"
                  onClick={onBackToList}
                  className="inline-flex items-center gap-1.5 font-medium text-portal-primary hover:underline"
                >
                  ← Модели изделий
                </Link>
              }
              title={editing && draft ? draft.name || current.name : current.name}
              status={
                <StatusBadge
                  size="compact"
                  tone={productModelStatusTone(current.status)}
                >
                  {PRODUCT_MODEL_STATUS_LABELS[current.status]}
                </StatusBadge>
              }
              description={
                editing
                  ? dirty
                    ? "Редактирование · есть несохранённые изменения"
                    : "Редактирование основных реквизитов"
                  : undefined
              }
              actions={
                <div className="flex flex-col items-stretch gap-1 sm:items-end">
                  <ProductModelToolbarActions
                    disabled={busy}
                    editing={editing}
                    canArchive={current.status !== "archived"}
                    canSave={Boolean(dirty)}
                    onEdit={startEdit}
                    onCancel={cancelEdit}
                    onArchive={onArchive}
                    onSave={onSave}
                    onCopy={onCopy}
                    onPrint={onPrint}
                  />
                  {actionError ? (
                    <p className="text-portal-caption text-portal-danger" role="alert">
                      {actionError}
                    </p>
                  ) : null}
                </div>
              }
            />
          </div>
        }
      >
        <CatalogVersionedCardLayout
          gapClassName={COLUMN_GAP}
          main={
            <>
              <SectionCard title="Основные реквизиты" size="compact">
                {editing && draft ? (
                  <div className="grid min-w-0 gap-portal-4">
                    <div className="grid min-w-0 gap-portal-3 min-[1300px]:grid-cols-2 min-[1700px]:grid-cols-4">
                      <Field
                        label="Наименование"
                        className="order-1 min-w-0"
                      >
                        <Input
                          value={draft.name}
                          size="compact"
                          onChange={(event) =>
                            setDraft({ ...draft, name: event.target.value })
                          }
                          aria-label="Наименование"
                        />
                      </Field>
                      <Field label="Артикул" className="order-2 min-w-0">
                        <Input
                          value={draft.article}
                          size="compact"
                          onChange={(event) =>
                            setDraft({ ...draft, article: event.target.value })
                          }
                          aria-label="Артикул"
                        />
                      </Field>
                      <Field
                        label="Размерная сетка"
                        className="order-3 min-w-0 min-[1700px]:order-4"
                        help={
                          sizeContourLocked
                            ? MODEL_OPERATIONS_WARNING
                            : sizeGrids.length === 0
                              ? "Нет сеток в каталоге — заведите в «Размерные сетки»"
                              : "Тип (муж/жен/дет) определяется выбранной сеткой"
                        }
                      >
                        <Select
                          value={
                            draft.size_grid_id == null
                              ? ""
                              : String(draft.size_grid_id)
                          }
                          size="compact"
                          disabled={busy || sizeContourLocked}
                          onChange={(event) => {
                            if (sizeContourLocked) {
                              window.alert(MODEL_OPERATIONS_WARNING);
                              return;
                            }
                            const raw = event.target.value;
                            if (raw === "") {
                              setDraft({
                                ...draft,
                                size_grid_id: null,
                              });
                              return;
                            }
                            const gridId = Number(raw);
                            const grid = sizeGrids.find((row) => row.id === gridId);
                            if (!grid) return;
                            setDraft({
                              ...draft,
                              size_grid_id: gridId,
                              size_type: grid.size_type,
                            });
                          }}
                          aria-label="Размерная сетка"
                        >
                          <option
                            value=""
                            disabled={current.status !== "draft"}
                          >
                            Не выбрана
                          </option>
                          {sizeGrids.map((grid) => (
                            <option key={grid.id} value={grid.id}>
                              {grid.name} ·{" "}
                              {PRODUCT_MODEL_SIZE_TYPE_LABELS[grid.size_type]} ·{" "}
                              {grid.row_count} разм.
                            </option>
                          ))}
                        </Select>
                      </Field>
                      <Field
                        label="Состояние"
                        className="order-4 min-w-0 min-[1700px]:order-3"
                      >
                        <Select
                          value={current.status}
                          disabled={busy}
                          size="compact"
                          onChange={(event) =>
                            void onStatusChange(event.target.value)
                          }
                          aria-label="Состояние"
                        >
                          {PRODUCT_MODEL_STATUS_FILTER_ITEMS.map((item) => (
                            <option
                              key={item.id}
                              value={item.id}
                              disabled={
                                item.id === "draft" &&
                                current.status !== "draft" &&
                                !canRevertToDraft
                              }
                            >
                              {item.label}
                            </option>
                          ))}
                        </Select>
                      </Field>
                    </div>
                    <div className="grid min-w-0 gap-portal-3 min-[1700px]:grid-cols-4">
                      <Field
                        label="Описание"
                        className="min-w-0 min-[1700px]:col-span-3"
                      >
                        <Textarea
                          value={draft.description}
                          size="compact"
                          onChange={(event) =>
                            setDraft({
                              ...draft,
                              description: event.target.value,
                            })
                          }
                          rows={4}
                          aria-label="Описание"
                        />
                      </Field>
                      <Field
                        label="Стоимость"
                        className="min-w-0"
                        help="мин / макс по вариантам сборки"
                      >
                        <p className="mt-1 text-portal-body font-semibold text-portal-text">
                          {costRangeLabel}
                        </p>
                      </Field>
                    </div>
                  </div>
                ) : (
                  <div className="grid min-w-0 gap-portal-4">
                    <div className="grid min-w-0 gap-portal-3 min-[1300px]:grid-cols-2 min-[1700px]:grid-cols-4">
                      <div className="order-1 min-w-0 border-l-2 border-portal-primary/40 pl-portal-3">
                        <p className="text-portal-caption font-medium text-portal-muted">
                          Наименование
                        </p>
                        <p className="mt-1 text-portal-body font-semibold text-portal-text">
                          {current.name}
                        </p>
                      </div>
                      <div className="order-2 min-w-0 border-l-2 border-portal-primary/40 pl-portal-3">
                        <p className="text-portal-caption font-medium text-portal-muted">
                          Артикул
                        </p>
                        <p className="mt-1 font-mono text-portal-body font-semibold tracking-wide text-portal-text">
                          {current.article}
                        </p>
                      </div>
                      <div className="order-3 min-w-0 border-l-2 border-portal-border pl-portal-3 min-[1700px]:order-4">
                        <p className="text-portal-caption font-medium text-portal-muted">
                          Размерная сетка
                        </p>
                        {linkedSizeGrid ? (
                          <p className="mt-1 text-portal-body font-semibold text-portal-text">
                            <Link
                              href={`/settings/catalogs/size-grids/${linkedSizeGrid.id}`}
                              className="text-portal-primary hover:underline"
                            >
                              {linkedSizeGrid.name}
                            </Link>
                            <span className="ml-2 font-normal text-portal-muted">
                              · {PRODUCT_MODEL_SIZE_TYPE_LABELS[linkedSizeGrid.size_type]}
                            </span>
                          </p>
                        ) : (
                          <p className="mt-1 text-portal-body text-portal-muted">
                            Не привязана
                            {current.status === "draft"
                              ? " — нужна для активации"
                              : ""}
                          </p>
                        )}
                      </div>
                      <div className="order-4 min-w-0 border-l-2 border-portal-border pl-portal-3 min-[1700px]:order-3">
                        <p className="text-portal-caption font-medium text-portal-muted">
                          Состояние
                        </p>
                        <div className="mt-1">
                          <StatusBadge
                            tone={productModelStatusTone(current.status)}
                            size="compact"
                            dot
                          >
                            {PRODUCT_MODEL_STATUS_LABELS[current.status]}
                          </StatusBadge>
                        </div>
                      </div>
                    </div>
                    <div className="grid min-w-0 gap-portal-3 min-[1700px]:grid-cols-4">
                      <div className="min-w-0 border-l-2 border-portal-primary/40 pl-portal-3 min-[1700px]:col-span-3">
                        <p className="text-portal-caption font-medium text-portal-muted">
                          Описание
                        </p>
                        {current.description?.trim() ? (
                          <p className="mt-1 whitespace-pre-wrap text-portal-body leading-relaxed font-semibold text-portal-text">
                            {current.description}
                          </p>
                        ) : (
                          <p className="mt-1 text-portal-body leading-relaxed text-portal-muted">
                            Описание пока не заполнено
                          </p>
                        )}
                      </div>
                      <div className="min-w-0 border-l-2 border-portal-border pl-portal-3">
                        <p className="text-portal-caption font-medium text-portal-muted">
                          Стоимость
                        </p>
                        <p className="mt-1 text-portal-body font-semibold text-portal-text">
                          {costRangeLabel}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </SectionCard>

              <AssemblyVariantsBlock
                modelId={current.id}
                variants={assemblyVariants}
                sewingOperations={sewingOperations}
              />

              <SectionCard
                title="История изменений"
                description={historySummary}
                size="compact"
                collapsed={!historyOpen}
                actions={
                  <button
                    type="button"
                    className="portal-focus-ring inline-flex items-center gap-1 rounded-portal-md border border-portal-border bg-portal-surface px-portal-3 py-1.5 text-portal-caption font-medium text-portal-text hover:bg-portal-state-hover"
                    aria-expanded={historyOpen}
                    onClick={() => setHistoryOpen((open) => !open)}
                  >
                    {historyOpen ? "Свернуть" : "Развернуть"}
                    <ChevronDown
                      className={[
                        "size-4 transition-transform",
                        historyOpen ? "rotate-180" : "",
                      ].join(" ")}
                      aria-hidden="true"
                    />
                  </button>
                }
              >
                {history.length > 0 ? (
                  <ul className="grid gap-portal-2">
                    {history.map((entry) => (
                      <li
                        key={entry.id}
                        className="rounded-portal-md border border-portal-border bg-portal-surface-secondary px-portal-3 py-portal-2"
                      >
                        <p className="text-portal-body text-portal-text">
                          {entry.action}
                        </p>
                        <p className="mt-1 text-portal-caption text-portal-muted">
                          {entry.actor} ·{" "}
                          {new Date(entry.created_at).toLocaleString("ru-RU")}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-portal-caption text-portal-muted">
                    Записей пока нет.
                  </p>
                )}
              </SectionCard>
            </>
          }
          media={
            <SectionCard title="Карточка" size="compact" className="w-full min-[1900px]:w-[300px]">
              <div className="grid gap-portal-3 text-portal-body text-portal-text">
                <ProductModelMediaCarousel
                  items={items}
                  busy={busy}
                  onExpand={setPreviewSrc}
                  onSetPrimary={onSetPrimary}
                  onDelete={onDelete}
                  onReplace={onReplace}
                  onAdd={uploadFiles}
                />
                {warning ? (
                  <p className="text-center text-portal-caption text-portal-danger" role="alert">
                    {warning}
                  </p>
                ) : null}
              </div>
            </SectionCard>
          }
        />
      </VersionedWorkspace>
    </>
  );
}
