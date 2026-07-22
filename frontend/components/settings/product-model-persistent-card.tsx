"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type MouseEvent } from "react";

import {
  archiveProductModel,
  activateProductModel,
  copyProductModel,
  deleteProductModelMedia,
  replaceProductModelMedia,
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
import { Input, Select, Textarea } from "@/components/ui/form-controls";
import { ImageLightbox } from "@/components/ui/image-lightbox";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  PRODUCT_MODEL_IMAGE_RULE,
  PRODUCT_MODEL_SIZE_TYPE_LABELS,
  PRODUCT_MODEL_STATUS_FILTER_ITEMS,
  PRODUCT_MODEL_STATUS_LABELS,
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
  type ProductModelSizeType,
  type ProductModelStatus,
  type ProductModelVersionView,
} from "@/lib/product-models";
import type { SewingOperation } from "@/lib/sewing-operations";

const COLUMN_GAP = "gap-[14px]";

const DIRTY_LEAVE_MESSAGE =
  "Есть несохранённые изменения. Уйти без сохранения?";

/** PT-08 + DS-PT-08-CATALOG product-model card (`6.1.8` / `6.1.10`). */
export function ProductModelPersistentCard({
  model,
  versions,
  media,
  history,
  assemblyVariants,
  sewingOperations,
  initialEditing = false,
}: {
  model: ProductModel;
  versions: ProductModelVersionView[];
  media: ProductModelMedia[];
  history: ProductModelHistoryEntry[];
  assemblyVariants: AssemblyVariant[];
  sewingOperations: SewingOperation[];
  initialEditing?: boolean;
}) {
  const router = useRouter();
  const initialActive =
    versions.find((version) => version.isActive)?.id ?? versions[0]?.id ?? "";
  const [activeVersionId, setActiveVersionId] = useState(initialActive);
  const [trackedModel, setTrackedModel] = useState(model);
  const [current, setCurrent] = useState(model);
  const [trackedMedia, setTrackedMedia] = useState(media);
  const [items, setItems] = useState(media);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
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

  const activeVersion = useMemo(
    () => versions.find((version) => version.id === activeVersionId),
    [activeVersionId, versions],
  );
  const publishedBaseline = versions.find((version) => version.isPublishedBaseline);
  const sizeTypeLocked = current.status !== "draft";
  const dirty =
    editing && draft != null && isProductModelRequisitesDirty(current, draft);

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
      setActionError("Нельзя вернуть модель в статус «Черновик»");
      return;
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
          : await archiveProductModel(current.id);
      setCurrent(updated);
      router.refresh();
    } catch (caught) {
      setActionError(
        caught instanceof Error ? caught.message : "Не удалось сменить статус",
      );
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
                <div className="grid min-w-0 gap-portal-3 text-portal-body sm:grid-cols-2">
                  <label className="grid min-w-0 gap-1">
                    <span className="text-portal-caption text-portal-muted">
                      Состояние
                    </span>
                    <Select
                      value={current.status}
                      disabled={busy}
                      onChange={(event) => void onStatusChange(event.target.value)}
                      aria-label="Состояние"
                    >
                      {PRODUCT_MODEL_STATUS_FILTER_ITEMS.map((item) => (
                        <option
                          key={item.id}
                          value={item.id}
                          disabled={
                            item.id === "draft" && current.status !== "draft"
                          }
                        >
                          {item.label}
                        </option>
                      ))}
                    </Select>
                  </label>

                  {editing && draft ? (
                    <>
                      <label className="grid min-w-0 gap-1">
                        <span className="text-portal-caption text-portal-muted">
                          Артикул
                        </span>
                        <Input
                          value={draft.article}
                          onChange={(event) =>
                            setDraft({ ...draft, article: event.target.value })
                          }
                          aria-label="Артикул"
                        />
                      </label>
                      <label className="grid min-w-0 gap-1">
                        <span className="text-portal-caption text-portal-muted">
                          Название
                        </span>
                        <Input
                          value={draft.name}
                          onChange={(event) =>
                            setDraft({ ...draft, name: event.target.value })
                          }
                          aria-label="Название"
                        />
                      </label>
                      <label className="grid min-w-0 gap-1">
                        <span className="text-portal-caption text-portal-muted">
                          Тип размерной сетки
                        </span>
                        <Select
                          value={draft.size_type}
                          disabled={sizeTypeLocked}
                          onChange={(event) =>
                            setDraft({
                              ...draft,
                              size_type: event.target.value as ProductModelSizeType,
                            })
                          }
                          aria-label="Тип размерной сетки"
                        >
                          {Object.entries(PRODUCT_MODEL_SIZE_TYPE_LABELS).map(
                            ([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ),
                          )}
                        </Select>
                        {sizeTypeLocked ? (
                          <span className="text-portal-caption text-portal-muted">
                            Тип сетки меняется только у черновика
                          </span>
                        ) : null}
                      </label>
                      <label className="grid min-w-0 gap-1 sm:col-span-2">
                        <span className="text-portal-caption text-portal-muted">
                          Описание
                        </span>
                        <Textarea
                          value={draft.description}
                          onChange={(event) =>
                            setDraft({ ...draft, description: event.target.value })
                          }
                          rows={4}
                          aria-label="Описание"
                        />
                      </label>
                    </>
                  ) : (
                    <>
                      <div className="min-w-0">
                        <p className="text-portal-caption text-portal-muted">
                          Артикул
                        </p>
                        <p className="mt-1 font-medium text-portal-text">
                          {current.article}
                        </p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-portal-caption text-portal-muted">
                          Тип размерной сетки
                        </p>
                        <p className="mt-1 font-medium text-portal-text">
                          {PRODUCT_MODEL_SIZE_TYPE_LABELS[current.size_type]}
                        </p>
                      </div>
                      <div className="min-w-0 sm:col-span-2">
                        <p className="text-portal-caption text-portal-muted">
                          Описание
                        </p>
                        <p className="mt-1 whitespace-pre-wrap text-portal-text">
                          {current.description?.trim()
                            ? current.description
                            : "—"}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </SectionCard>

              <AssemblyVariantsBlock
                modelId={current.id}
                variants={assemblyVariants}
                sewingOperations={sewingOperations}
              />

              <SectionCard
                title="Рабочая область версии"
                description={
                  activeVersion
                    ? `Активная: ${activeVersion.label}${
                        publishedBaseline && activeVersion.id !== publishedBaseline.id
                          ? ` · база: ${publishedBaseline.label}`
                          : ""
                      }`
                    : "Версия не выбрана"
                }
                size="compact"
              >
                <p className="text-portal-body text-portal-muted">
                  Здесь появятся размерная сетка после этапа 6.2. Операции пошива — отдельный справочник (`/settings/catalogs/sewing_operations`).
                </p>
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
          versions={
            <SectionCard title="История изменений" size="compact">
              {history.length > 0 ? (
                <ul className="grid gap-portal-2">
                  {history.map((entry) => (
                    <li
                      key={entry.id}
                      className="rounded-portal-md border border-portal-border bg-portal-surface-secondary px-portal-3 py-portal-2"
                    >
                      <p className="text-portal-body text-portal-text">{entry.action}</p>
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
          }
        />
      </VersionedWorkspace>
    </>
  );
}
