"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import { ChevronDown, Plus, Save } from "lucide-react";

import {
  removeNomenclatureCustomField,
  saveNomenclatureCustomField,
} from "@/app/(workspace)/settings/catalogs/custom-fields/custom-fields-actions";
import {
  deleteNomenclatureMedia,
  updateNomenclatureMedia,
  uploadNomenclatureMedia,
} from "@/app/(workspace)/settings/catalogs/nomenclature/characteristics-actions";
import { updateNomenclatureRequisites } from "@/app/(workspace)/settings/catalogs/nomenclature/nomenclature-actions";
import { CatalogVersionedCardLayout } from "@/components/entity/catalog-versioned-card-layout";
import { VersionedWorkspace } from "@/components/entity/versioned-workspace";
import { NomenclatureAddCustomFieldForm } from "@/components/settings/nomenclature-add-custom-field-form";
import { NomenclatureAvailableModelsBlock } from "@/components/settings/nomenclature-available-models-block";
import { NomenclatureMediaCarousel } from "@/components/settings/nomenclature-media-carousel";
import { ProductModelToolbarActions } from "@/components/settings/product-model-toolbar-actions";
import { EntityHeader } from "@/components/ui/entity-header";
import { IconButton } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form-controls";
import { ImageLightbox } from "@/components/ui/image-lightbox";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { checkboxClassName, controlClassName } from "@/lib/design-system/control-styles";
import { buildCategoryTreeRows } from "@/lib/nomenclature-category-tree";
import {
  NOMENCLATURE_CURRENCY_OPTIONS,
  NOMENCLATURE_IMAGE_RULE,
  NOMENCLATURE_TYPE_LABELS,
  NOMENCLATURE_TYPE_OPTIONS,
  categoryPathLabel,
  categoryDisplayLabel,
  isNomenclatureRequisitesDirty,
  nomenclatureStatusLabel,
  nomenclatureStatusTone,
  resolveNomenclatureCategoryId,
  resolveNomenclatureCategoryLabel,
  resolveNomenclatureUnitSymbol,
  toNomenclatureRequisitesDraft,
  validateNomenclatureImageFile,
  validateNomenclatureRequisitesDraft,
  type CharacteristicDefinition,
  type CustomFieldOption,
  type Nomenclature,
  type NomenclatureAvailableModel,
  type NomenclatureCategory,
  type NomenclatureFieldValue,
  type NomenclatureMedia,
  type NomenclatureRequisitesDraft,
  type NomenclatureType,
  type UnitOfMeasure,
} from "@/lib/nomenclature";
import type { ProductModel } from "@/lib/product-models";
import type { ProductType } from "@/lib/product-types";

const COLUMN_GAP = "gap-[14px]";
const DIRTY_LEAVE_MESSAGE =
  "Есть несохранённые изменения. Уйти без сохранения?";

type SaveStatus = "idle" | "saving" | "saved" | "error";

function RequisiteRead({
  label,
  accent = false,
  children,
  className = "",
}: {
  label: string;
  accent?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={[
        "min-w-0 border-l-2 pl-portal-3",
        accent ? "border-portal-primary/40" : "border-portal-border",
        className,
      ].join(" ")}
    >
      <p className="text-portal-caption font-medium text-portal-muted">{label}</p>
      <div className="mt-1 text-portal-body font-semibold text-portal-text">
        {children}
      </div>
    </div>
  );
}

function fieldDisplayValue(
  field: NomenclatureFieldValue,
  options: CustomFieldOption[],
): string {
  const value = field.value;
  const fieldKind = field.kind ?? field.data_type ?? "STRING";
  if (Array.isArray(value)) return value.join(", ");
  if (value === null || value === "") return "Не указано";
  if (
    (fieldKind === "LIST" ||
      fieldKind === "MULTI_SELECT" ||
      fieldKind === "COLOR") &&
    options.length
  ) {
    const match = options.find((option) => String(option.id) === String(value));
    return match?.label ?? String(value);
  }
  return String(value);
}

function FieldValueRow({
  itemId,
  field,
  options,
  editing,
  onRemove,
}: {
  itemId: number;
  field: NomenclatureFieldValue;
  options: CustomFieldOption[];
  editing: boolean;
  onRemove: (formData: FormData) => Promise<void>;
}) {
  const value = field.value;
  if (!editing) {
    return (
      <div className="grid grid-cols-[minmax(120px,1fr)_2fr] gap-portal-3 border-b border-portal-border py-portal-2 text-portal-body last:border-0">
        <span className="text-portal-muted">
          {field.name}
          {field.is_required ? " *" : ""}
        </span>
        <span className="font-medium text-portal-text">
          {fieldDisplayValue(field, options)}
        </span>
      </div>
    );
  }
  const fieldKind = field.kind ?? field.data_type ?? "STRING";
  const characteristicId =
    field.characteristic_id ?? field.field_definition_id ?? 0;
  const common = controlClassName({ size: "compact" });
  const valueName = `value_${characteristicId}`;
  let control: ReactNode;
  if (fieldKind === "BOOLEAN") {
    control = (
      <input
        type="checkbox"
        name={valueName}
        defaultChecked={value === true}
        className={checkboxClassName()}
      />
    );
  } else if (fieldKind === "TEXT") {
    control = (
      <textarea
        name={valueName}
        defaultValue={typeof value === "string" ? value : ""}
        className={`${common} min-h-[72px]`}
      />
    );
  } else if (
    fieldKind === "LIST" ||
    fieldKind === "MULTI_SELECT" ||
    fieldKind === "COLOR"
  ) {
    control = (
      <select
        name={valueName}
        defaultValue={value === null ? "" : String(value)}
        className={common}
      >
        <option value="">Не выбрано</option>
        {options
          .filter((option) => option.is_active)
          .map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
      </select>
    );
  } else {
    control = (
      <input
        name={valueName}
        defaultValue={value === null ? "" : String(value)}
        type={
          fieldKind === "INTEGER" || fieldKind === "DECIMAL"
            ? "number"
            : fieldKind === "DATE"
              ? "date"
              : "text"
        }
        className={common}
      />
    );
  }
  return (
    <div className="grid grid-cols-[minmax(120px,1fr)_2fr_auto] items-center gap-portal-3 border-b border-portal-border py-portal-2 last:border-0">
      <input type="hidden" name={`kind_${characteristicId}`} value={fieldKind} />
      <span className="text-portal-caption text-portal-muted">
        {field.name}
        {field.is_required ? " *" : ""}
      </span>
      {control}
      <div className="flex justify-end">
        {field.source_category_id === null ? (
          <button
            type="button"
            className="rounded-portal-md border border-portal-danger/30 px-portal-3 py-1.5 text-portal-caption font-medium text-portal-danger"
            onClick={() => {
              const data = new FormData();
              data.set("nomenclature_id", String(itemId));
              data.set("characteristic_id", String(characteristicId));
              data.set("field_definition_id", String(characteristicId));
              void onRemove(data);
            }}
          >
            Удалить
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** PT-08 + DS-PT-08-CATALOG nomenclature card (`4.7.3` / `4.7.4`). */
export function NomenclatureCard({
  item: initialItem,
  categories,
  units,
  fields,
  fieldOptions,
  usedValuesById = {},
  characteristicDefinitions,
  media,
  availableModels = [],
  activeModels = [],
  productTypes = [],
  initialEditing = false,
}: {
  item: Nomenclature;
  categories: NomenclatureCategory[];
  units: UnitOfMeasure[];
  fields: NomenclatureFieldValue[];
  fieldOptions: Record<number, CustomFieldOption[]>;
  usedValuesById?: Record<number, string[]>;
  characteristicDefinitions: CharacteristicDefinition[];
  media: NomenclatureMedia[];
  availableModels?: NomenclatureAvailableModel[];
  activeModels?: ProductModel[];
  productTypes?: ProductType[];
  initialEditing?: boolean;
}) {
  const router = useRouter();
  const fieldsFormRef = useRef<HTMLFormElement>(null);
  const [trackedItem, setTrackedItem] = useState(initialItem);
  const [current, setCurrent] = useState(initialItem);
  const [trackedMedia, setTrackedMedia] = useState(media);
  const [items, setItems] = useState(media);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [editing, setEditing] = useState(initialEditing);
  const [draft, setDraft] = useState<NomenclatureRequisitesDraft | null>(() =>
    initialEditing
      ? toNomenclatureRequisitesDraft(initialItem, categories)
      : null,
  );

  const [fieldsOpen, setFieldsOpen] = useState(true);
  const [fieldsEditing, setFieldsEditing] = useState(false);
  const [fieldsStatus, setFieldsStatus] = useState<SaveStatus>("idle");
  const [fieldState, setFieldState] = useState(fields);
  const [addingField, setAddingField] = useState(false);

  if (initialItem.id !== trackedItem.id) {
    setTrackedItem(initialItem);
    setCurrent(initialItem);
    setEditing(false);
    setDraft(null);
    setActionError(null);
    setFieldState(fields);
    setFieldsEditing(false);
    setAddingField(false);
  } else if (initialItem !== trackedItem && !editing) {
    setTrackedItem(initialItem);
    setCurrent(initialItem);
  }

  if (media !== trackedMedia) {
    setTrackedMedia(media);
    setItems(media);
  }

  const dirty =
    editing && draft != null && isNomenclatureRequisitesDirty(current, draft);
  const typeValue =
    editing && draft ? draft.nomenclature_type : current.nomenclature_type;
  const compatibleCategories = useMemo(() => {
    const active = categories.filter((category) => category.is_active);
    const selectedId =
      editing && draft
        ? draft.category_id
        : resolveNomenclatureCategoryId(
            current.category_id,
            current.category,
            categories,
            typeValue,
          );
    if (
      selectedId != null &&
      !active.some((category) => category.id === selectedId)
    ) {
      const orphan = categories.find((category) => category.id === selectedId);
      if (orphan) {
        return [...active, orphan].sort(
          (left, right) =>
            left.sort_order - right.sort_order ||
            left.name.localeCompare(right.name, "ru"),
        );
      }
    }
    return active;
  }, [categories, current.category, current.category_id, draft, editing, typeValue]);
  const categorySelectRows = useMemo(
    () => buildCategoryTreeRows(compatibleCategories),
    [compatibleCategories],
  );
  const linkedProductType = useMemo(() => {
    const id =
      editing && draft ? draft.product_type_id : current.product_type_id;
    if (id == null) return null;
    return productTypes.find((row) => row.id === id) ?? null;
  }, [current.product_type_id, draft, editing, productTypes]);
  const productTypeOptions = useMemo(() => {
    const active = productTypes.filter((row) => row.is_active);
    if (
      linkedProductType &&
      !active.some((row) => row.id === linkedProductType.id)
    ) {
      return [...active, linkedProductType].sort(
        (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, "ru"),
      );
    }
    return active;
  }, [linkedProductType, productTypes]);
  const storageUnitLabel =
    units.find((unit) => unit.id === current.storage_unit_id)?.symbol ??
    current.unit;
  const historyEntries = [
    { id: "created", label: "Карточка создана", at: current.created_at },
    { id: "updated", label: "Последнее изменение", at: current.updated_at },
  ];
  const historySummary = `${historyEntries.length} записи`;
  const assignedFieldIds = new Set(
    fieldState.map(
      (field) => field.characteristic_id ?? field.field_definition_id ?? 0,
    ),
  );

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const startEdit = () => {
    setEditing(true);
    setDraft(toNomenclatureRequisitesDraft(current, categories));
    setActionError(null);
  };

  const cancelEdit = () => {
    if (
      draft &&
      isNomenclatureRequisitesDirty(current, draft) &&
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
    const validationError = validateNomenclatureRequisitesDraft(draft);
    if (validationError) {
      setActionError(validationError);
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      const updated = await updateNomenclatureRequisites(current.id, {
        ...draft,
        category: resolveNomenclatureCategoryLabel(
          draft.category_id,
          categories,
          current.category,
        ),
        unit: resolveNomenclatureUnitSymbol(
          draft.storage_unit_id,
          units,
          current.unit,
        ),
      });
      setCurrent(updated);
      setTrackedItem(updated);
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

  const onArchive = async () => {
    if (!current.is_active) return;
    if (!window.confirm(`Архивировать «${current.name}»?`)) return;
    setBusy(true);
    setActionError(null);
    try {
      const base = toNomenclatureRequisitesDraft(current, categories);
      const updated = await updateNomenclatureRequisites(current.id, {
        ...base,
        is_active: false,
        category: resolveNomenclatureCategoryLabel(
          base.category_id,
          categories,
          current.category,
        ),
        unit: resolveNomenclatureUnitSymbol(
          current.storage_unit_id,
          units,
          current.unit,
        ),
      });
      setCurrent(updated);
      setTrackedItem(updated);
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

  const onStatusChange = async (next: string) => {
    if (busy) return;
    const nextActive = next === "active";
    if (nextActive === current.is_active) return;
    if (
      !nextActive &&
      !window.confirm(`Перевести «${current.name}» в архив?`)
    ) {
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      const base = toNomenclatureRequisitesDraft(current, categories);
      const updated = await updateNomenclatureRequisites(current.id, {
        ...base,
        is_active: nextActive,
        category: resolveNomenclatureCategoryLabel(
          base.category_id,
          categories,
          current.category,
        ),
        unit: resolveNomenclatureUnitSymbol(
          current.storage_unit_id,
          units,
          current.unit,
        ),
      });
      setCurrent(updated);
      setTrackedItem(updated);
      if (draft) setDraft({ ...draft, is_active: nextActive });
      router.refresh();
    } catch (caught) {
      setActionError(
        caught instanceof Error ? caught.message : "Не удалось сменить статус",
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

  const onCopy = () => {
    window.alert("Копирование номенклатуры будет доступно в следующей итерации.");
  };

  const onPrint = () => {
    window.alert(
      "Печать будет доступна после настройки шаблона в Администрирование → Печатные формы.",
    );
  };

  const uploadFiles = async (files: File[]) => {
    for (const file of files) {
      const ruleError = validateNomenclatureImageFile(file);
      if (ruleError) {
        setWarning(ruleError);
        return;
      }
    }
    setBusy(true);
    setWarning(null);
    try {
      const created: NomenclatureMedia[] = [];
      for (const [index, file] of files.entries()) {
        const data = new FormData();
        data.append("nomenclature_id", String(current.id));
        data.append("file", file);
        data.append("is_primary", String(items.length === 0 && index === 0));
        data.append("sort_order", String(items.length + index));
        created.push(await uploadNomenclatureMedia(data));
      }
      setItems((currentItems) => [...currentItems, ...created]);
      router.refresh();
    } catch (caught) {
      setWarning(
        caught instanceof Error ? caught.message : "Не удалось загрузить изображение",
      );
    } finally {
      setBusy(false);
    }
  };

  const onDeleteMedia = async (item: NomenclatureMedia) => {
    if (!window.confirm(`Удалить фото «${item.filename}»?`)) return;
    setBusy(true);
    setWarning(null);
    try {
      const data = new FormData();
      data.append("nomenclature_id", String(current.id));
      data.append("media_id", String(item.id));
      await deleteNomenclatureMedia(data);
      setItems((currentItems) => currentItems.filter((row) => row.id !== item.id));
      router.refresh();
    } catch (caught) {
      setWarning(
        caught instanceof Error ? caught.message : "Не удалось удалить изображение",
      );
    } finally {
      setBusy(false);
    }
  };

  const onSetPrimary = async (item: NomenclatureMedia) => {
    if (item.is_primary) return;
    setBusy(true);
    setWarning(null);
    try {
      const data = new FormData();
      data.append("nomenclature_id", String(current.id));
      data.append("media_id", String(item.id));
      data.append("sort_order", String(item.sort_order));
      data.append("is_primary", "true");
      data.append("alt_text", item.alt_text ?? "");
      await updateNomenclatureMedia(data);
      setItems((currentItems) =>
        currentItems.map((row) => ({
          ...row,
          is_primary: row.id === item.id,
        })),
      );
      router.refresh();
    } catch (caught) {
      setWarning(
        caught instanceof Error
          ? caught.message
          : "Не удалось назначить основное фото",
      );
    } finally {
      setBusy(false);
    }
  };

  const onReplaceMedia = async (item: NomenclatureMedia, file: File) => {
    const ruleError = validateNomenclatureImageFile(file);
    if (ruleError) {
      setWarning(ruleError);
      return;
    }
    setBusy(true);
    setWarning(null);
    try {
      const uploadData = new FormData();
      uploadData.append("nomenclature_id", String(current.id));
      uploadData.append("file", file);
      uploadData.append("is_primary", String(item.is_primary));
      uploadData.append("sort_order", String(item.sort_order));
      const created = await uploadNomenclatureMedia(uploadData);
      const deleteData = new FormData();
      deleteData.append("nomenclature_id", String(current.id));
      deleteData.append("media_id", String(item.id));
      await deleteNomenclatureMedia(deleteData);
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
        message.includes("10 МБ") || message.includes("JPEG")
          ? NOMENCLATURE_IMAGE_RULE
          : message,
      );
    } finally {
      setBusy(false);
    }
  };

  const removeField = async (data: FormData) => {
    setFieldsStatus("saving");
    try {
      await removeNomenclatureCustomField(data);
      const id = Number(
        data.get("characteristic_id") ?? data.get("field_definition_id"),
      );
      setFieldState((currentFields) =>
        currentFields.filter(
          (field) =>
            (field.characteristic_id ?? field.field_definition_id) !== id,
        ),
      );
      setFieldsStatus("saved");
      router.refresh();
    } catch {
      setFieldsStatus("error");
      setActionError("Не удалось удалить характеристику");
    }
  };

  const saveAllFields = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFieldsStatus("saving");
    try {
      const formData = new FormData(event.currentTarget);
      const nextFields: NomenclatureFieldValue[] = [];
      for (const field of fieldState) {
        const id = field.characteristic_id ?? field.field_definition_id ?? 0;
        const kind = field.kind ?? field.data_type ?? "STRING";
        const raw =
          kind === "BOOLEAN"
            ? formData.get(`value_${id}`) != null
              ? "true"
              : "false"
            : String(formData.get(`value_${id}`) ?? "");
        const row = new FormData();
        row.set("nomenclature_id", String(current.id));
        row.set("characteristic_id", String(id));
        row.set("field_definition_id", String(id));
        row.set("kind", kind);
        row.set("data_type", kind);
        row.set("value", raw);
        await saveNomenclatureCustomField(row);
        nextFields.push({
          ...field,
          value:
            kind === "BOOLEAN"
              ? raw === "true"
              : kind === "INTEGER" || kind === "LIST" || kind === "COLOR"
                ? raw === ""
                  ? null
                  : Number(raw)
                : raw === ""
                  ? null
                  : raw,
        });
      }
      setFieldState(nextFields);
      setFieldsEditing(false);
      setFieldsStatus("saved");
      router.refresh();
    } catch {
      setFieldsStatus("error");
      setActionError("Не удалось сохранить характеристики");
    }
  };

  const onFieldsSaveClick = () => {
    setFieldsOpen(true);
    if (!fieldsEditing) {
      setFieldsEditing(true);
      setAddingField(false);
      setFieldsStatus("idle");
      return;
    }
    fieldsFormRef.current?.requestSubmit();
  };

  useEffect(() => {
    if (!fieldsEditing && !addingField) {
      setFieldState(fields);
    }
  }, [fields, fieldsEditing, addingField]);

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
                  href="/settings/catalogs/nomenclature"
                  onClick={onBackToList}
                  className="inline-flex items-center gap-1.5 font-medium text-portal-primary hover:underline"
                >
                  ← Номенклатура
                </Link>
              }
              title={editing && draft ? draft.name || current.name : current.name}
              status={
                <StatusBadge
                  size="compact"
                  tone={nomenclatureStatusTone(current.is_active)}
                >
                  {nomenclatureStatusLabel(current.is_active)}
                </StatusBadge>
              }
              description={
                editing
                  ? dirty
                    ? "Редактирование · есть несохранённые изменения"
                    : "Редактирование основных реквизитов"
                  : `${NOMENCLATURE_TYPE_LABELS[current.nomenclature_type]} · ${categoryDisplayLabel(current.category_id, categories, current.category)}`
              }
              actions={
                <div className="flex flex-col items-stretch gap-1 sm:items-end">
                  <ProductModelToolbarActions
                    disabled={busy}
                    editing={editing}
                    canArchive={current.is_active}
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
                      <Field label="Наименование" className="order-1 min-w-0">
                        <Input
                          value={draft.name}
                          size="compact"
                          onChange={(event) =>
                            setDraft({ ...draft, name: event.target.value })
                          }
                          aria-label="Наименование"
                        />
                      </Field>
                      <Field
                        label="Тип номенклатуры"
                        className="order-2 min-w-0 min-[1700px]:order-3"
                      >
                        <Select
                          value={draft.nomenclature_type}
                          size="compact"
                          disabled={busy}
                          onChange={(event) => {
                            const nextType = event.target
                              .value as NomenclatureType;
                            setDraft({
                              ...draft,
                              nomenclature_type: nextType,
                              product_type_id:
                                nextType === "PRODUCT"
                                  ? draft.product_type_id
                                  : null,
                            });
                          }}
                          aria-label="Тип номенклатуры"
                        >
                          {NOMENCLATURE_TYPE_OPTIONS.map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </Select>
                      </Field>
                      <Field
                        label="Состояние"
                        className="order-3 min-w-0 min-[1700px]:order-2"
                      >
                        <Select
                          value={current.is_active ? "active" : "archived"}
                          disabled={busy}
                          size="compact"
                          onChange={(event) =>
                            void onStatusChange(event.target.value)
                          }
                          aria-label="Состояние"
                        >
                          <option value="active">Активна</option>
                          <option value="archived">Архив</option>
                        </Select>
                      </Field>
                      <Field
                        label="Вид изделия"
                        className="order-4 min-w-0"
                      >
                        <Select
                          value={
                            draft.product_type_id == null
                              ? ""
                              : String(draft.product_type_id)
                          }
                          size="compact"
                          disabled={busy || draft.nomenclature_type !== "PRODUCT"}
                          onChange={(event) => {
                            const raw = event.target.value;
                            setDraft({
                              ...draft,
                              product_type_id: raw === "" ? null : Number(raw),
                            });
                          }}
                          aria-label="Вид изделия"
                        >
                          <option value="">Не выбран</option>
                          {productTypeOptions.map((row) => (
                            <option key={row.id} value={row.id}>
                              {row.name}
                            </option>
                          ))}
                        </Select>
                      </Field>
                    </div>
                    <div className="grid min-w-0 gap-portal-3 min-[1300px]:grid-cols-2 min-[1700px]:grid-cols-4">
                      <Field label="Наименование для печати" className="min-w-0">
                        <Input
                          value={draft.short_name}
                          size="compact"
                          onChange={(event) =>
                            setDraft({
                              ...draft,
                              short_name: event.target.value,
                            })
                          }
                          aria-label="Наименование для печати"
                        />
                      </Field>
                      <Field label="Категория" className="min-w-0">
                        <Select
                          value={
                            draft.category_id == null
                              ? ""
                              : String(draft.category_id)
                          }
                          size="compact"
                          disabled={busy}
                          onChange={(event) => {
                            const raw = event.target.value;
                            setDraft({
                              ...draft,
                              category_id: raw === "" ? null : Number(raw),
                            });
                          }}
                          aria-label="Категория"
                        >
                          <option value="">Без категории</option>
                          {categorySelectRows.map((row) => (
                            <option
                              key={row.category.id}
                              value={row.category.id}
                            >
                              {row.outline} —{" "}
                              {categoryPathLabel(row.category.id, categories)}
                            </option>
                          ))}
                        </Select>
                        {compatibleCategories.length === 0 ? (
                          <p className="mt-1 text-portal-caption text-portal-muted">
                            Нет активных категорий. Создайте в справочнике
                            «Категории номенклатуры».
                          </p>
                        ) : null}
                      </Field>
                      <Field label="Единица хранения" className="min-w-0">
                        <Select
                          value={
                            draft.storage_unit_id == null
                              ? ""
                              : String(draft.storage_unit_id)
                          }
                          size="compact"
                          disabled={busy}
                          onChange={(event) => {
                            const raw = event.target.value;
                            setDraft({
                              ...draft,
                              storage_unit_id: raw === "" ? null : Number(raw),
                            });
                          }}
                          aria-label="Единица хранения"
                        >
                          <option value="">Не выбрана</option>
                          {units
                            .filter((unit) => unit.is_active)
                            .map((unit) => (
                              <option key={unit.id} value={unit.id}>
                                {unit.symbol} — {unit.name}
                              </option>
                            ))}
                        </Select>
                      </Field>
                      <Field label="Цена без НДС" className="min-w-0">
                        <div className="grid grid-cols-[1fr_110px] gap-2">
                          <Input
                            value={draft.base_price}
                            size="compact"
                            type="number"
                            min="0"
                            step="0.01"
                            onChange={(event) =>
                              setDraft({
                                ...draft,
                                base_price: event.target.value,
                              })
                            }
                            aria-label="Цена без НДС"
                          />
                          <Select
                            value={draft.currency}
                            size="compact"
                            onChange={(event) =>
                              setDraft({
                                ...draft,
                                currency: event.target.value,
                              })
                            }
                            aria-label="Валюта"
                          >
                            {NOMENCLATURE_CURRENCY_OPTIONS.map((code) => (
                              <option key={code} value={code}>
                                {code}
                              </option>
                            ))}
                          </Select>
                        </div>
                      </Field>
                    </div>
                    <Field label="Описание" className="min-w-0">
                      <Textarea
                        value={draft.description}
                        size="compact"
                        rows={4}
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
                  <div className="grid min-w-0 gap-portal-4">
                    <div className="grid min-w-0 gap-portal-3 min-[1300px]:grid-cols-2 min-[1700px]:grid-cols-4">
                      <RequisiteRead label="Наименование" accent className="order-1">
                        {current.name}
                      </RequisiteRead>
                      <RequisiteRead
                        label="Тип номенклатуры"
                        className="order-2 min-[1700px]:order-3"
                      >
                        {NOMENCLATURE_TYPE_LABELS[current.nomenclature_type]}
                      </RequisiteRead>
                      <RequisiteRead
                        label="Состояние"
                        className="order-3 min-[1700px]:order-2"
                      >
                        <StatusBadge
                          tone={nomenclatureStatusTone(current.is_active)}
                          size="compact"
                          dot
                        >
                          {nomenclatureStatusLabel(current.is_active)}
                        </StatusBadge>
                      </RequisiteRead>
                      <RequisiteRead label="Вид изделия" className="order-4">
                        {current.nomenclature_type === "PRODUCT" &&
                        (linkedProductType ||
                          current.product_type_name?.trim()) ? (
                          linkedProductType?.name ?? current.product_type_name
                        ) : (
                          <span className="font-normal text-portal-muted">
                            {current.nomenclature_type === "PRODUCT"
                              ? "Не выбран"
                              : "—"}
                          </span>
                        )}
                      </RequisiteRead>
                    </div>
                    <div className="grid min-w-0 gap-portal-3 min-[1300px]:grid-cols-2 min-[1700px]:grid-cols-4">
                      <RequisiteRead label="Наименование для печати">
                        {current.short_name?.trim() ? (
                          current.short_name
                        ) : (
                          <span className="font-normal text-portal-muted">
                            Не указано
                          </span>
                        )}
                      </RequisiteRead>
                      <RequisiteRead label="Категория">
                        {categoryDisplayLabel(
                          current.category_id,
                          categories,
                          current.category,
                        )}
                      </RequisiteRead>
                      <RequisiteRead label="Единица хранения">
                        {storageUnitLabel}
                      </RequisiteRead>
                      <RequisiteRead label="Цена без НДС">
                        {current.basePrice} {current.currency}
                      </RequisiteRead>
                    </div>
                    <RequisiteRead label="Описание" accent>
                      {current.description?.trim() ? (
                        <span className="whitespace-pre-wrap font-semibold leading-relaxed">
                          {current.description}
                        </span>
                      ) : (
                        <span className="font-normal leading-relaxed text-portal-muted">
                          Описание пока не заполнено
                        </span>
                      )}
                    </RequisiteRead>
                  </div>
                )}
              </SectionCard>

              <div
                className={`grid min-w-0 grid-cols-1 ${COLUMN_GAP} lg:grid-cols-2`}
              >
                <SectionCard
                  title="Характеристики номенклатуры"
                  size="compact"
                  className="min-w-0"
                  collapsed={!fieldsOpen}
                  description={
                    fieldsStatus === "saving"
                      ? "Сохранение…"
                      : fieldsStatus === "saved"
                        ? "Сохранено"
                        : fieldsStatus === "error"
                          ? "Ошибка сохранения"
                          : undefined
                  }
                  actions={
                    <div className="flex items-center gap-1">
                      <IconButton
                        label="Добавить характеристику"
                        title="Добавить"
                        variant="secondary"
                        onClick={() => {
                          setFieldsOpen(true);
                          setAddingField((open) => !open);
                          setFieldsEditing(false);
                          setFieldsStatus("idle");
                        }}
                      >
                        <Plus className="size-4" aria-hidden="true" />
                      </IconButton>
                      <IconButton
                        label="Сохранить характеристики"
                        title="Сохранить"
                        variant="primary"
                        disabled={fieldsStatus === "saving"}
                        onClick={onFieldsSaveClick}
                      >
                        <Save className="size-4" aria-hidden="true" />
                      </IconButton>
                      <IconButton
                        label={fieldsOpen ? "Свернуть" : "Развернуть"}
                        title={fieldsOpen ? "Свернуть" : "Развернуть"}
                        variant="secondary"
                        aria-expanded={fieldsOpen}
                        onClick={() => setFieldsOpen((open) => !open)}
                      >
                        <ChevronDown
                          className={[
                            "size-4 transition-transform",
                            fieldsOpen ? "rotate-180" : "",
                          ].join(" ")}
                          aria-hidden="true"
                        />
                      </IconButton>
                    </div>
                  }
                >
                  <div>
                    {addingField ? (
                      <div className="mb-portal-3">
                        <NomenclatureAddCustomFieldForm
                          nomenclatureId={current.id}
                          definitions={characteristicDefinitions}
                          assignedIds={assignedFieldIds}
                          fieldOptions={fieldOptions}
                          usedValuesById={usedValuesById}
                          onCancel={() => setAddingField(false)}
                          onSaved={() => {
                            setAddingField(false);
                            setFieldsStatus("saved");
                            router.refresh();
                          }}
                          onError={(message) => {
                            setFieldsStatus("error");
                            setActionError(message);
                          }}
                        />
                      </div>
                    ) : null}
                    {fieldState.length ? (
                      <form ref={fieldsFormRef} onSubmit={saveAllFields}>
                        {fieldState.map((field) => (
                          <FieldValueRow
                            key={
                              field.characteristic_id ??
                              field.field_definition_id
                            }
                            itemId={current.id}
                            field={field}
                            options={
                              fieldOptions[
                                field.characteristic_id ??
                                  field.field_definition_id ??
                                  0
                              ] ?? []
                            }
                            editing={fieldsEditing}
                            onRemove={removeField}
                          />
                        ))}
                      </form>
                    ) : (
                      <p className="text-portal-body text-portal-muted">
                        Характеристики пока не назначены.
                      </p>
                    )}
                  </div>
                </SectionCard>

                {current.nomenclature_type === "PRODUCT" ? (
                  <NomenclatureAvailableModelsBlock
                    nomenclatureId={current.id}
                    productTypeId={
                      editing && draft
                        ? draft.product_type_id
                        : (current.product_type_id ?? null)
                    }
                    links={availableModels}
                    activeModels={activeModels}
                    className="min-w-0"
                  />
                ) : (
                  <div className="hidden min-w-0 lg:block" aria-hidden="true" />
                )}
              </div>

              <SectionCard
                title="История изменений"
                description={historySummary}
                size="compact"
                collapsed={!historyOpen}
                actions={
                  <div className="flex items-center gap-1">
                    <IconButton
                      label={historyOpen ? "Свернуть" : "Развернуть"}
                      title={historyOpen ? "Свернуть" : "Развернуть"}
                      variant="secondary"
                      aria-expanded={historyOpen}
                      onClick={() => setHistoryOpen((open) => !open)}
                    >
                      <ChevronDown
                        className={[
                          "size-4 transition-transform",
                          historyOpen ? "rotate-180" : "",
                        ].join(" ")}
                        aria-hidden="true"
                      />
                    </IconButton>
                  </div>
                }
              >
                <ul className="grid gap-portal-2">
                  {historyEntries.map((entry) => (
                    <li
                      key={entry.id}
                      className="rounded-portal-md border border-portal-border bg-portal-surface-secondary px-portal-3 py-portal-2"
                    >
                      <p className="text-portal-body text-portal-text">
                        {entry.label}
                      </p>
                      <p className="mt-1 text-portal-caption text-portal-muted">
                        {new Date(entry.at).toLocaleString("ru-RU")}
                      </p>
                    </li>
                  ))}
                </ul>
              </SectionCard>
            </>
          }
          media={
            <SectionCard
              title="Карточка"
              size="compact"
              className="w-full min-[1900px]:w-[300px]"
            >
              <div className="grid gap-portal-3 text-portal-body text-portal-text">
                <NomenclatureMediaCarousel
                  items={items.filter((entry) =>
                    entry.mime_type.startsWith("image/"),
                  )}
                  busy={busy}
                  onExpand={setPreviewSrc}
                  onSetPrimary={onSetPrimary}
                  onDelete={onDeleteMedia}
                  onReplace={onReplaceMedia}
                  onAdd={uploadFiles}
                />
                {warning ? (
                  <p
                    className="text-center text-portal-caption text-portal-danger"
                    role="alert"
                  >
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
