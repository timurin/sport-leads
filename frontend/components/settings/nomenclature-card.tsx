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
import { ChevronDown, FileUp, Pencil, Plus, Save, Trash2, X } from "lucide-react";

import {
  addNomenclatureCharacteristicWithValue,
  deleteNomenclatureMedia,
  removeNomenclatureCharacteristicValue,
  saveNomenclatureCharacteristicValue,
  updateNomenclatureMedia,
  uploadNomenclatureMedia,
} from "@/app/(workspace)/settings/catalogs/nomenclature/characteristics-actions";
import { copyNomenclature, updateNomenclatureRequisites } from "@/app/(workspace)/settings/catalogs/nomenclature/nomenclature-actions";
import { CatalogVersionedCardLayout } from "@/components/entity/catalog-versioned-card-layout";
import { VersionedWorkspace } from "@/components/entity/versioned-workspace";
import {
  NomenclatureAddCharacteristicForm,
  type NomenclatureCharacteristicDraft,
} from "@/components/settings/nomenclature-add-characteristic-form";
import { NomenclatureAvailableModelsBlock } from "@/components/settings/nomenclature-available-models-block";
import { NomenclatureMediaCarousel } from "@/components/settings/nomenclature-media-carousel";
import { NomenclatureVariantsBlock } from "@/components/settings/nomenclature-variants-block";
import { ProductModelToolbarActions } from "@/components/settings/product-model-toolbar-actions";
import { EntityHeader } from "@/components/ui/entity-header";
import { Button, IconButton } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form-controls";
import { ImageLightbox } from "@/components/ui/image-lightbox";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { checkboxClassName, controlClassName } from "@/lib/design-system/control-styles";
import { currencyOptionLabel, formatAmountWithCurrency } from "@/lib/money";
import { buildCategoryTreeRows } from "@/lib/nomenclature-category-tree";
import {
  NOMENCLATURE_CURRENCY_OPTIONS,
  NOMENCLATURE_FILE_ACCEPT,
  NOMENCLATURE_FILE_RULE,
  NOMENCLATURE_IMAGE_RULE,
  NOMENCLATURE_TYPE_LABELS,
  NOMENCLATURE_TYPE_OPTIONS,
  categoryPathLabel,
  categoryDisplayLabel,
  guessNomenclatureAttachmentMime,
  isNomenclatureImageMime,
  isNomenclatureRequisitesDirty,
  nomenclatureMediaUrl,
  nomenclatureStatusLabel,
  nomenclatureStatusTone,
  resolveNomenclatureCategoryId,
  resolveNomenclatureCategoryLabel,
  resolveNomenclatureUnitSymbol,
  toNomenclatureRequisitesDraft,
  validateNomenclatureAttachmentFile,
  validateNomenclatureImageFile,
  validateNomenclatureRequisitesDraft,
  type CharacteristicDefinition,
  type CharacteristicOption,
  type Nomenclature,
  type NomenclatureAvailableModel,
  type NomenclatureCategory,
  type NomenclatureCharacteristicValue,
  type NomenclatureHistoryEntry,
  type NomenclatureMedia,
  type NomenclatureRequisitesDraft,
  type NomenclatureType,
  type NomenclatureVariant,
  type UnitOfMeasure,
} from "@/lib/nomenclature";
import type { ProductModel } from "@/lib/product-models";
import type { ProductType } from "@/lib/product-types";

const COLUMN_GAP = "gap-[14px]";
const DIRTY_LEAVE_MESSAGE =
  "Есть несохранённые изменения. Уйти без сохранения?";
const UNSAVED_FIELDS_MESSAGE = "Данные не сохранены";

type SaveStatus = "idle" | "saving" | "saved" | "error";

function parseFieldValue(
  kind: NomenclatureCharacteristicValue["kind"],
  raw: string,
): unknown {
  if (kind === "BOOLEAN") return raw === "true";
  if (kind === "INTEGER" || kind === "LIST" || kind === "COLOR") {
    return raw === "" ? null : Number(raw);
  }
  return raw === "" ? null : raw;
}

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
  field: NomenclatureCharacteristicValue,
  options: CharacteristicOption[],
): string {
  const value = field.value;
  const fieldKind = field.kind ?? "STRING";
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
  onDirty,
}: {
  itemId: number;
  field: NomenclatureCharacteristicValue;
  options: CharacteristicOption[];
  editing: boolean;
  onRemove: (formData: FormData) => void;
  onDirty: () => void;
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
  const fieldKind = field.kind ?? "STRING";
  const characteristicId = field.characteristic_id;
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
        onChange={onDirty}
      />
    );
  } else if (fieldKind === "TEXT") {
    control = (
      <textarea
        name={valueName}
        defaultValue={typeof value === "string" ? value : ""}
        className={`${common} min-h-[72px]`}
        onChange={onDirty}
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
        onChange={onDirty}
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
        onChange={onDirty}
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
              onRemove(data);
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
  history = [],
  variants = [],
  availableModels = [],
  activeModels = [],
  productTypes = [],
  initialEditing = false,
}: {
  item: Nomenclature;
  categories: NomenclatureCategory[];
  units: UnitOfMeasure[];
  fields: NomenclatureCharacteristicValue[];
  fieldOptions: Record<number, CharacteristicOption[]>;
  usedValuesById?: Record<number, string[]>;
  characteristicDefinitions: CharacteristicDefinition[];
  media: NomenclatureMedia[];
  history?: NomenclatureHistoryEntry[];
  variants?: NomenclatureVariant[];
  availableModels?: NomenclatureAvailableModel[];
  activeModels?: ProductModel[];
  productTypes?: ProductType[];
  initialEditing?: boolean;
}) {
  const router = useRouter();
  const fieldsFormRef = useRef<HTMLFormElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const tempCharacteristicIdRef = useRef(-1);
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
  const [fieldsDirty, setFieldsDirty] = useState(false);
  const [fieldsStatus, setFieldsStatus] = useState<SaveStatus>("idle");
  const [pendingFieldsSave, setPendingFieldsSave] = useState(false);
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
    setFieldsDirty(false);
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
  const historySummary =
    history.length === 0
      ? "записей нет"
      : `${history.length} ${
          history.length === 1
            ? "запись"
            : history.length < 5
              ? "записи"
              : "записей"
        }`;
  const imageItems = items.filter((entry) => isNomenclatureImageMime(entry.mime_type));
  const attachmentItems = items.filter(
    (entry) => !isNomenclatureImageMime(entry.mime_type),
  );
  const assignedFieldIds = new Set(
    fieldState.map((field) => field.characteristic_id),
  );

  useEffect(() => {
    if (!dirty && !fieldsDirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty, fieldsDirty]);

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
    if (
      nextActive &&
      !window.confirm(`Восстановить «${current.name}» из архива?`)
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
    if (fieldsDirty) {
      setFieldsStatus("error");
      setActionError(UNSAVED_FIELDS_MESSAGE);
      if (!window.confirm(DIRTY_LEAVE_MESSAGE)) {
        event.preventDefault();
        return;
      }
      discardFieldsDraft();
    }
    if (dirty && !window.confirm(DIRTY_LEAVE_MESSAGE)) {
      event.preventDefault();
    }
  };

  const onCopy = async () => {
    if (fieldsDirty) {
      setFieldsStatus("error");
      setActionError(UNSAVED_FIELDS_MESSAGE);
      if (!window.confirm(DIRTY_LEAVE_MESSAGE)) {
        return;
      }
      discardFieldsDraft();
    }
    if (dirty && !window.confirm(DIRTY_LEAVE_MESSAGE)) {
      return;
    }
    setBusy(true);
    setWarning(null);
    try {
      const created = await copyNomenclature(current.id);
      router.push(`/settings/catalogs/nomenclature/${created.id}`);
      router.refresh();
    } catch (caught) {
      setWarning(
        caught instanceof Error
          ? caught.message
          : "Не удалось скопировать номенклатуру",
      );
      setBusy(false);
    }
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
        data.append(
          "is_primary",
          String(imageItems.length === 0 && index === 0),
        );
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

  const uploadAttachments = async (files: File[]) => {
    for (const file of files) {
      const ruleError = validateNomenclatureAttachmentFile(file);
      if (ruleError) {
        setActionError(ruleError);
        return;
      }
    }
    setBusy(true);
    setActionError(null);
    try {
      const created: NomenclatureMedia[] = [];
      for (const [index, file] of files.entries()) {
        const data = new FormData();
        data.append("nomenclature_id", String(current.id));
        data.append("file", file);
        data.append("mime_type", guessNomenclatureAttachmentMime(file));
        data.append("is_primary", "false");
        data.append("sort_order", String(items.length + index));
        created.push(await uploadNomenclatureMedia(data));
      }
      setItems((currentItems) => [...currentItems, ...created]);
      router.refresh();
    } catch (caught) {
      setActionError(
        caught instanceof Error ? caught.message : "Не удалось загрузить файл",
      );
    } finally {
      setBusy(false);
    }
  };

  const onDeleteMedia = async (item: NomenclatureMedia) => {
    const image = isNomenclatureImageMime(item.mime_type);
    if (
      !window.confirm(
        image
          ? `Удалить фото «${item.filename}»?`
          : `Удалить файл «${item.filename}»?`,
      )
    ) {
      return;
    }
    setBusy(true);
    setWarning(null);
    setActionError(null);
    try {
      const data = new FormData();
      data.append("nomenclature_id", String(current.id));
      data.append("media_id", String(item.id));
      await deleteNomenclatureMedia(data);
      setItems((currentItems) => currentItems.filter((row) => row.id !== item.id));
      router.refresh();
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "Не удалось удалить файл";
      if (image) setWarning(message);
      else setActionError(message);
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

  const markFieldsDirty = () => {
    setFieldsDirty(true);
    setFieldsStatus("idle");
    setActionError(null);
  };

  const discardFieldsDraft = () => {
    setFieldState(fields);
    setFieldsEditing(false);
    setFieldsDirty(false);
    setAddingField(false);
    setFieldsStatus("idle");
  };

  const guardUnsavedFields = (): boolean => {
    if (!fieldsDirty) return true;
    setFieldsStatus("error");
    setActionError(UNSAVED_FIELDS_MESSAGE);
    if (!window.confirm(DIRTY_LEAVE_MESSAGE)) {
      return false;
    }
    discardFieldsDraft();
    return true;
  };

  const removeField = (data: FormData) => {
    const id = Number(data.get("characteristic_id"));
    setFieldState((currentFields) =>
      currentFields.filter((field) => field.characteristic_id !== id),
    );
    setFieldsEditing(true);
    markFieldsDirty();
  };

  const addFieldDraft = (draftField: NomenclatureCharacteristicDraft) => {
    const characteristicId =
      draftField.definition?.id ?? tempCharacteristicIdRef.current--;
    if (
      fieldState.some((field) => field.characteristic_id === characteristicId)
    ) {
      setFieldsStatus("error");
      setActionError("Эта характеристика уже добавлена на карточку");
      return;
    }
    const kind = draftField.kind ?? "STRING";
    setFieldState((currentFields) => [
      ...currentFields,
      {
        characteristic_id: characteristicId,
        code: draftField.definition?.code ?? "",
        name: draftField.name,
        kind,
        value: parseFieldValue(kind, draftField.value),
        default_value: null,
        is_required: false,
        is_visible: true,
        inherited: false,
        source_category_id: null,
      },
    ]);
    setAddingField(false);
    setFieldsEditing(true);
    markFieldsDirty();
  };

  const persistFields = async (formData: FormData) => {
    setFieldsStatus("saving");
    setActionError(null);
    try {
      const baselineIds = new Set(
        fields.map((field) => field.characteristic_id),
      );
      const currentIds = new Set(
        fieldState.map((field) => field.characteristic_id),
      );

      for (const field of fields) {
        if (currentIds.has(field.characteristic_id)) continue;
        const row = new FormData();
        row.set("nomenclature_id", String(current.id));
        row.set("characteristic_id", String(field.characteristic_id));
        await removeNomenclatureCharacteristicValue(row);
      }

      const nextFields: NomenclatureCharacteristicValue[] = [];
      for (const field of fieldState) {
        const id = field.characteristic_id;
        const kind = field.kind ?? "STRING";
        const raw =
          kind === "BOOLEAN"
            ? formData.get(`value_${id}`) != null
              ? "true"
              : "false"
            : String(formData.get(`value_${id}`) ?? "");
        const isNewAssignment = id < 0 || !baselineIds.has(id);
        if (isNewAssignment) {
          const row = new FormData();
          row.set("nomenclature_id", String(current.id));
          row.set("name", field.name);
          row.set("kind", kind);
          row.set("value", raw);
          if (id > 0) {
            row.set("characteristic_id", String(id));
          }
          await addNomenclatureCharacteristicWithValue(row);
        } else {
          const row = new FormData();
          row.set("nomenclature_id", String(current.id));
          row.set("characteristic_id", String(id));
          row.set("kind", kind);
          row.set("value", raw);
          await saveNomenclatureCharacteristicValue(row);
        }
        nextFields.push({
          ...field,
          value: parseFieldValue(kind, raw),
        });
      }
      setFieldState(nextFields);
      setFieldsEditing(false);
      setFieldsDirty(false);
      setFieldsStatus("saved");
      router.refresh();
    } catch (caught) {
      setFieldsStatus("error");
      setActionError(
        caught instanceof Error
          ? caught.message
          : "Не удалось сохранить характеристики",
      );
    }
  };

  const saveAllFields = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await persistFields(new FormData(event.currentTarget));
  };

  const startFieldsEdit = () => {
    setFieldsOpen(true);
    setAddingField(false);
    setFieldsEditing(true);
    setFieldsStatus("idle");
    setActionError(null);
  };

  const cancelFieldsEdit = () => {
    if (fieldsDirty) {
      setFieldsStatus("error");
      setActionError(UNSAVED_FIELDS_MESSAGE);
      if (!window.confirm(DIRTY_LEAVE_MESSAGE)) {
        return;
      }
    }
    discardFieldsDraft();
    setActionError(null);
  };

  const onFieldsSaveClick = () => {
    if (!fieldsEditing || !fieldsDirty || fieldsStatus === "saving") return;
    setFieldsOpen(true);
    // SectionCard unmounts the body when collapsed — submit after open if needed.
    if (fieldsFormRef.current) {
      fieldsFormRef.current.requestSubmit();
      return;
    }
    if (fieldState.length === 0) {
      void persistFields(new FormData());
      return;
    }
    setPendingFieldsSave(true);
  };

  const onFieldsCollapseToggle = () => {
    if (fieldsOpen && (fieldsEditing || fieldsDirty || addingField)) {
      if (!guardUnsavedFields()) return;
    }
    setFieldsOpen((open) => !open);
  };

  useEffect(() => {
    if (!fieldsEditing && !addingField && !fieldsDirty) {
      setFieldState(fields);
    }
  }, [fields, fieldsEditing, addingField, fieldsDirty]);

  useEffect(() => {
    if (!pendingFieldsSave || !fieldsOpen || !fieldsEditing) return;
    if (!fieldsFormRef.current) {
      setPendingFieldsSave(false);
      return;
    }
    setPendingFieldsSave(false);
    fieldsFormRef.current.requestSubmit();
  }, [pendingFieldsSave, fieldsOpen, fieldsEditing, fieldState.length]);

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
                  href="/warehouse/stock"
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
                                {currencyOptionLabel(code)}
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
                        {formatAmountWithCurrency(current.basePrice, current.currency)}
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
                          ? actionError === UNSAVED_FIELDS_MESSAGE
                            ? UNSAVED_FIELDS_MESSAGE
                            : actionError ?? "Ошибка сохранения"
                          : fieldsDirty
                            ? UNSAVED_FIELDS_MESSAGE
                            : undefined
                  }
                  actions={
                    <div className="flex items-center gap-1">
                      <IconButton
                        label="Добавить характеристику"
                        title="Добавить"
                        variant="secondary"
                        disabled={fieldsStatus === "saving"}
                        onClick={() => {
                          setFieldsOpen(true);
                          setAddingField((open) => !open);
                          setFieldsStatus("idle");
                          if (actionError === UNSAVED_FIELDS_MESSAGE) {
                            setActionError(null);
                          }
                        }}
                      >
                        <Plus className="size-4" aria-hidden="true" />
                      </IconButton>
                      {fieldsEditing ? (
                        <IconButton
                          label="Отменить редактирование характеристик"
                          title="Отменить"
                          variant="secondary"
                          disabled={fieldsStatus === "saving"}
                          onClick={cancelFieldsEdit}
                        >
                          <X className="size-4" aria-hidden="true" />
                        </IconButton>
                      ) : (
                        <IconButton
                          label="Редактировать характеристики"
                          title="Редактировать"
                          variant="secondary"
                          disabled={
                            fieldState.length === 0 || fieldsStatus === "saving"
                          }
                          onClick={startFieldsEdit}
                        >
                          <Pencil className="size-4" aria-hidden="true" />
                        </IconButton>
                      )}
                      <IconButton
                        label="Сохранить характеристики"
                        title="Сохранить"
                        variant={fieldsDirty ? "primary" : "secondary"}
                        disabled={
                          !fieldsEditing ||
                          !fieldsDirty ||
                          fieldsStatus === "saving"
                        }
                        onClick={onFieldsSaveClick}
                      >
                        <Save className="size-4" aria-hidden="true" />
                      </IconButton>
                      <IconButton
                        label={fieldsOpen ? "Свернуть" : "Развернуть"}
                        title={fieldsOpen ? "Свернуть" : "Развернуть"}
                        variant="secondary"
                        aria-expanded={fieldsOpen}
                        onClick={onFieldsCollapseToggle}
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
                        <NomenclatureAddCharacteristicForm
                          definitions={characteristicDefinitions}
                          assignedIds={assignedFieldIds}
                          fieldOptions={fieldOptions}
                          usedValuesById={usedValuesById}
                          onCancel={() => setAddingField(false)}
                          onAdd={addFieldDraft}
                          onError={(message) => {
                            setFieldsStatus("error");
                            setActionError(message);
                          }}
                        />
                      </div>
                    ) : null}
                    {fieldState.length || (fieldsEditing && fieldsDirty) ? (
                      <form ref={fieldsFormRef} onSubmit={saveAllFields}>
                        {fieldState.map((field) => (
                          <FieldValueRow
                            key={field.characteristic_id}
                            itemId={current.id}
                            field={field}
                            options={
                              fieldOptions[field.characteristic_id] ?? []
                            }
                            editing={fieldsEditing}
                            onRemove={removeField}
                            onDirty={markFieldsDirty}
                          />
                        ))}
                        {!fieldState.length ? (
                          <p className="text-portal-body text-portal-muted">
                            Все характеристики удалены из черновика. Нажмите
                            «Сохранить», чтобы применить, или «Отменить».
                          </p>
                        ) : null}
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

              <NomenclatureVariantsBlock
                nomenclatureId={current.id}
                variants={variants}
                basePrice={current.basePrice}
              />

              <SectionCard
                title="Вложения"
                description={
                  attachmentItems.length === 0
                    ? NOMENCLATURE_FILE_RULE
                    : `${attachmentItems.length} файл(ов)`
                }
                size="compact"
                actions={
                  <>
                    <input
                      ref={attachmentInputRef}
                      type="file"
                      className="hidden"
                      accept={NOMENCLATURE_FILE_ACCEPT}
                      multiple
                      onChange={(event) => {
                        const files = Array.from(event.target.files ?? []);
                        event.target.value = "";
                        if (files.length) void uploadAttachments(files);
                      }}
                    />
                    <Button
                      type="button"
                      size="compact"
                      variant="secondary"
                      disabled={busy}
                      onClick={() => attachmentInputRef.current?.click()}
                    >
                      <FileUp className="size-4" aria-hidden="true" />
                      Загрузить
                    </Button>
                  </>
                }
              >
                {attachmentItems.length > 0 ? (
                  <ul className="grid gap-portal-2">
                    {attachmentItems.map((entry) => (
                      <li
                        key={entry.id}
                        className="flex min-w-0 items-center gap-portal-2 rounded-portal-md border border-portal-border bg-portal-surface-secondary px-portal-3 py-portal-2"
                      >
                        <div className="min-w-0 flex-1">
                          <a
                            href={nomenclatureMediaUrl(entry.content_url)}
                            target="_blank"
                            rel="noreferrer"
                            className="truncate font-medium text-portal-primary hover:underline"
                          >
                            {entry.filename}
                          </a>
                          <p className="text-portal-caption text-portal-muted">
                            {entry.mime_type} ·{" "}
                            {(entry.file_size / 1024).toFixed(1)} КБ
                          </p>
                        </div>
                        <IconButton
                          label={`Удалить ${entry.filename}`}
                          variant="secondary"
                          disabled={busy}
                          onClick={() => void onDeleteMedia(entry)}
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                        </IconButton>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-portal-caption text-portal-muted">
                    Файлов пока нет.
                  </p>
                )}
              </SectionCard>

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
            <SectionCard
              title="Карточка"
              size="compact"
              className="w-full min-[1900px]:w-[300px]"
            >
              <div className="grid gap-portal-3 text-portal-body text-portal-text">
                <NomenclatureMediaCarousel
                  items={imageItems}
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
