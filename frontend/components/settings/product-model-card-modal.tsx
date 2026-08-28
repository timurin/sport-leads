"use client";

import Link from "next/link";
import { ExternalLink, Pencil, Save, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

import {
  loadProductModelCardModal,
  saveProductModelCardModalRequisites,
  type ProductModelCardModalBundle,
} from "@/app/(workspace)/settings/catalogs/product-models/product-model-actions";
import { IconButton } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form-controls";
import { InlineAlert } from "@/components/ui/inline-alert";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  PRODUCT_MODEL_SIZE_TYPE_LABELS,
  PRODUCT_MODEL_STATUS_LABELS,
  isProductModelRequisitesDirty,
  productModelCoverUrl,
  productModelFolderSelectOptions,
  productModelStatusTone,
  toProductModelRequisitesDraft,
  validateProductModelCreateDraft,
  type ProductModel,
  type ProductModelRequisitesDraft,
} from "@/lib/product-models";

type ProductModelCardModalProps = {
  modelId: number | null;
  open: boolean;
  onClose: () => void;
  onSaved?: (model: ProductModel) => void;
};

/**
 * Centered product-model card modal: view by default; Edit / Save / Cancel icons.
 * Stage `26.12.2`.
 */
export function ProductModelCardModal({
  modelId,
  open,
  onClose,
  onSaved,
}: ProductModelCardModalProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bundle, setBundle] = useState<ProductModelCardModalBundle | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ProductModelRequisitesDraft | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open || modelId == null) {
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setEditing(false);
    setDraft(null);
    setBundle(null);
    void (async () => {
      const result = await loadProductModelCardModal(modelId);
      if (cancelled) return;
      setLoading(false);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setBundle(result.bundle);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, modelId]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      requestClose();
    };
    window.addEventListener("keydown", onKeyDown);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previous;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- close helpers depend on latest dirty/editing
  }, [open, editing, draft, bundle]);

  const model = bundle?.model ?? null;
  const photoSrc = useMemo(() => {
    if (!bundle) return null;
    const primary =
      bundle.media.find((item) => item.is_primary) ?? bundle.media[0] ?? null;
    if (primary?.content_url) {
      return productModelCoverUrl(primary.content_url);
    }
    return productModelCoverUrl(bundle.model.cover_image_url);
  }, [bundle]);
  const dirty =
    editing &&
    model != null &&
    draft != null &&
    isProductModelRequisitesDirty(model, draft);

  const folderOptions = useMemo(
    () => productModelFolderSelectOptions(bundle?.folders ?? []),
    [bundle?.folders],
  );

  const linkedSizeGrid = useMemo(() => {
    const gridId = editing && draft ? draft.size_grid_id : model?.size_grid_id;
    if (gridId == null) return null;
    return bundle?.sizeGrids.find((row) => row.id === gridId) ?? null;
  }, [bundle?.sizeGrids, draft, editing, model?.size_grid_id]);

  const linkedProductType = useMemo(() => {
    const typeId =
      editing && draft ? draft.product_type_id : model?.product_type_id;
    if (typeId == null) return null;
    return (
      bundle?.productTypes.find((row) => row.id === typeId) ??
      (model?.product_type_name
        ? { id: typeId, name: model.product_type_name }
        : null)
    );
  }, [
    bundle?.productTypes,
    draft,
    editing,
    model?.product_type_id,
    model?.product_type_name,
  ]);

  const linkedFolder = useMemo(() => {
    const folderId = editing && draft ? draft.folder_id ?? null : model?.folder_id;
    if (folderId == null) return null;
    return bundle?.folders.find((row) => row.id === folderId) ?? null;
  }, [bundle?.folders, draft, editing, model?.folder_id]);

  const linkedRouting = useMemo(() => {
    const routingId =
      editing && draft
        ? draft.default_routing_template_id
        : model?.default_routing_template_id;
    if (routingId == null) return null;
    return bundle?.shopRoutings.find((row) => row.id === routingId) ?? null;
  }, [
    bundle?.shopRoutings,
    draft,
    editing,
    model?.default_routing_template_id,
  ]);

  const beginEdit = () => {
    if (!model) return;
    setDraft(toProductModelRequisitesDraft(model));
    setError(null);
    setEditing(true);
  };

  const cancelEdit = () => {
    if (dirty && !window.confirm("Есть несохранённые изменения. Отменить?")) {
      return;
    }
    setEditing(false);
    setDraft(null);
    setError(null);
  };

  const requestClose = () => {
    if (editing && dirty) {
      if (!window.confirm("Есть несохранённые изменения. Закрыть без сохранения?")) {
        return;
      }
    }
    setEditing(false);
    setDraft(null);
    setError(null);
    onClose();
  };

  const onCancelClick = () => {
    if (editing) {
      cancelEdit();
      return;
    }
    requestClose();
  };

  const onSave = async () => {
    if (!model || !draft) return;
    const validation = validateProductModelCreateDraft(draft);
    if (validation) {
      setError(validation);
      return;
    }
    setBusy(true);
    setError(null);
    const result = await saveProductModelCardModalRequisites(model.id, {
      article: draft.article,
      name: draft.name,
      size_type: draft.size_type,
      description: draft.description,
      size_grid_id: draft.size_grid_id,
      product_type_id: draft.product_type_id,
      default_routing_template_id: draft.default_routing_template_id,
      patterns_path: draft.patterns_path,
      constructor_name: draft.constructor_name,
      patterns_created_on: draft.patterns_created_on,
      folder_id: draft.folder_id ?? null,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setBundle((current) =>
      current ? { ...current, model: result.model } : current,
    );
    setEditing(false);
    setDraft(null);
    onSaved?.(result.model);
    router.refresh();
  };

  if (!open || !mounted) {
    return null;
  }

  const title = model?.name?.trim() || "Карточка модели";

  return createPortal(
    <>
      <button
        type="button"
        className="fixed inset-0 z-portal-modal bg-[#101828]/40"
        aria-label="Закрыть карточку модели"
        onClick={requestClose}
      />
      <div className="fixed inset-0 z-portal-modal-1 flex items-center justify-center p-portal-4 pointer-events-none">
        <div
          className="pointer-events-auto flex max-h-[min(92vh,48rem)] w-full max-w-[44rem] flex-col overflow-hidden rounded-portal-lg border border-portal-border bg-portal-surface shadow-portal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="product-model-card-modal-title"
          data-product-model-card-modal
          data-editing={editing ? "true" : "false"}
        >
          <header className="flex shrink-0 items-start justify-between gap-portal-3 border-b border-portal-border px-portal-5 py-portal-4">
            <div className="min-w-0">
              <h2
                id="product-model-card-modal-title"
                className="truncate text-portal-page font-semibold text-portal-text"
              >
                {title}
              </h2>
              <p className="mt-1 text-portal-caption text-portal-muted">
                {editing
                  ? dirty
                    ? "Редактирование · есть несохранённые изменения"
                    : "Редактирование основных реквизитов"
                  : "Просмотр · редактирование закрыто"}
              </p>
            </div>
            <div
              className="flex shrink-0 flex-wrap items-center gap-1"
              role="toolbar"
              aria-label="Действия карточки модели"
            >
              <IconButton
                label="Редактировать"
                variant="secondary"
                disabled={busy || loading || !model || editing}
                onClick={beginEdit}
                data-product-model-card-modal-edit
              >
                <Pencil className="size-4" aria-hidden="true" />
              </IconButton>
              <IconButton
                label="Сохранить"
                variant="primary"
                disabled={busy || loading || !editing || !draft || !dirty}
                onClick={() => void onSave()}
                data-product-model-card-modal-save
              >
                <Save className="size-4" aria-hidden="true" />
              </IconButton>
              <IconButton
                label={editing ? "Отменить редактирование" : "Отмена"}
                variant="secondary"
                disabled={busy || loading}
                onClick={onCancelClick}
                data-product-model-card-modal-cancel
              >
                <X className="size-4" aria-hidden="true" />
              </IconButton>
              {model ? (
                <Link
                  href={`/settings/catalogs/product-models/${model.id}`}
                  className="portal-focus-ring inline-flex size-portal-control-icon items-center justify-center rounded-portal-md border border-portal-border bg-portal-surface text-portal-text hover:bg-portal-state-hover"
                  aria-label="Открыть полную карточку модели"
                  title="Полная карточка"
                >
                  <ExternalLink className="size-4" aria-hidden="true" />
                </Link>
              ) : null}
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-auto px-portal-5 py-portal-4">
            {loading ? (
              <p className="text-portal-body text-portal-muted">Загрузка…</p>
            ) : null}
            {error ? (
              <InlineAlert tone="danger" className="mb-portal-3">
                {error}
              </InlineAlert>
            ) : null}
            {model && !loading ? (
              <div className="grid gap-portal-4">
                <div
                  className="overflow-hidden rounded-portal-md border border-portal-border bg-portal-surface-secondary"
                  data-product-model-card-modal-photo
                >
                  {photoSrc ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photoSrc}
                      alt={`Фото модели ${model.name}`}
                      className="mx-auto max-h-64 w-full object-contain bg-portal-surface"
                    />
                  ) : (
                    <div
                      className="flex min-h-40 items-center justify-center px-portal-4 py-portal-6 text-center text-portal-body text-portal-muted"
                      aria-label="Фото не загружено"
                    >
                      Фото скоро будет
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-portal-2">
                  <StatusBadge
                    size="compact"
                    tone={productModelStatusTone(model.status)}
                    dot
                  >
                    {PRODUCT_MODEL_STATUS_LABELS[model.status]}
                  </StatusBadge>
                  <span className="font-mono text-portal-caption text-portal-muted">
                    {editing && draft ? draft.article : model.article}
                  </span>
                </div>

                {editing && draft ? (
                  <div className="grid gap-portal-3 sm:grid-cols-2">
                    <Field label="Наименование" className="sm:col-span-2">
                      <Input
                        value={draft.name}
                        size="compact"
                        disabled={busy}
                        onChange={(event) =>
                          setDraft({ ...draft, name: event.target.value })
                        }
                        aria-label="Наименование"
                      />
                    </Field>
                    <Field label="Артикул">
                      <Input
                        value={draft.article}
                        size="compact"
                        disabled={busy}
                        onChange={(event) =>
                          setDraft({ ...draft, article: event.target.value })
                        }
                        aria-label="Артикул"
                      />
                    </Field>
                    <Field label="Размерная сетка">
                      <Select
                        value={
                          draft.size_grid_id == null
                            ? ""
                            : String(draft.size_grid_id)
                        }
                        size="compact"
                        disabled={busy}
                        onChange={(event) => {
                          const raw = event.target.value;
                          const nextId = raw ? Number(raw) : null;
                          const grid = bundle?.sizeGrids.find(
                            (row) => row.id === nextId,
                          );
                          setDraft({
                            ...draft,
                            size_grid_id: nextId,
                            size_type: grid?.size_type ?? draft.size_type,
                          });
                        }}
                        aria-label="Размерная сетка"
                      >
                        <option value="">Не выбрана</option>
                        {(bundle?.sizeGrids ?? []).map((grid) => (
                          <option key={grid.id} value={grid.id}>
                            {grid.name} ·{" "}
                            {PRODUCT_MODEL_SIZE_TYPE_LABELS[grid.size_type]}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Категория">
                      <Select
                        value={
                          draft.folder_id == null ? "" : String(draft.folder_id)
                        }
                        size="compact"
                        disabled={busy}
                        onChange={(event) => {
                          const raw = event.target.value;
                          setDraft({
                            ...draft,
                            folder_id: raw ? Number(raw) : null,
                          });
                        }}
                        aria-label="Категория"
                      >
                        <option value="">Без категории</option>
                        {folderOptions.map((folder) => (
                          <option key={folder.id} value={folder.id}>
                            {"\u00A0".repeat(folder.depth * 2)}
                            {folder.name}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Вид изделия">
                      <Select
                        value={
                          draft.product_type_id == null
                            ? ""
                            : String(draft.product_type_id)
                        }
                        size="compact"
                        disabled={busy}
                        onChange={(event) => {
                          const raw = event.target.value;
                          setDraft({
                            ...draft,
                            product_type_id: raw ? Number(raw) : null,
                          });
                        }}
                        aria-label="Вид изделия"
                      >
                        <option value="">Не указан</option>
                        {(bundle?.productTypes ?? []).map((row) => (
                          <option key={row.id} value={row.id}>
                            {row.name}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Маршрут по умолчанию" className="sm:col-span-2">
                      <Select
                        value={
                          draft.default_routing_template_id == null
                            ? ""
                            : String(draft.default_routing_template_id)
                        }
                        size="compact"
                        disabled={busy}
                        onChange={(event) => {
                          const raw = event.target.value;
                          setDraft({
                            ...draft,
                            default_routing_template_id: raw
                              ? Number(raw)
                              : null,
                          });
                        }}
                        aria-label="Маршрут по умолчанию"
                      >
                        <option value="">Не указан</option>
                        {(bundle?.shopRoutings ?? []).map((row) => (
                          <option key={row.id} value={row.id}>
                            {row.code ? `${row.code} — ${row.name}` : row.name}
                            {row.is_active ? "" : " (неактивен)"}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Описание" className="sm:col-span-2">
                      <Textarea
                        value={draft.description}
                        size="compact"
                        rows={4}
                        disabled={busy}
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            description: event.target.value,
                          })
                        }
                        aria-label="Описание"
                      />
                    </Field>
                  </div>
                ) : (
                  <dl className="grid gap-portal-3 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <dt className="text-portal-caption text-portal-muted">
                        Наименование
                      </dt>
                      <dd className="mt-1 text-portal-body font-semibold text-portal-text">
                        {model.name}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-portal-caption text-portal-muted">
                        Артикул
                      </dt>
                      <dd className="mt-1 font-mono text-portal-body text-portal-text">
                        {model.article}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-portal-caption text-portal-muted">
                        Размерная сетка
                      </dt>
                      <dd className="mt-1 text-portal-body text-portal-text">
                        {linkedSizeGrid
                          ? `${linkedSizeGrid.name} · ${PRODUCT_MODEL_SIZE_TYPE_LABELS[linkedSizeGrid.size_type]}`
                          : "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-portal-caption text-portal-muted">
                        Категория
                      </dt>
                      <dd className="mt-1 text-portal-body text-portal-text">
                        {linkedFolder?.name ?? "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-portal-caption text-portal-muted">
                        Вид изделия
                      </dt>
                      <dd className="mt-1 text-portal-body text-portal-text">
                        {linkedProductType?.name ?? "—"}
                      </dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-portal-caption text-portal-muted">
                        Маршрут по умолчанию
                      </dt>
                      <dd className="mt-1 text-portal-body text-portal-text">
                        {linkedRouting
                          ? linkedRouting.code
                            ? `${linkedRouting.code} — ${linkedRouting.name}`
                            : linkedRouting.name
                          : "—"}
                      </dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-portal-caption text-portal-muted">
                        Описание
                      </dt>
                      <dd className="mt-1 whitespace-pre-wrap text-portal-body text-portal-text">
                        {model.description?.trim() || "—"}
                      </dd>
                    </div>
                  </dl>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}
