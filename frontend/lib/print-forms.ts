/**
 * Print-form registry helpers (Stage 18.3.5 frontend).
 */

export type PrintFormBindingType = "model" | "directory" | "document_type";
export type PrintFormStatus = "draft" | "active" | "archived";
export type PrintFormOutputFormat = "html" | "pdf" | "xlsx";
export type PrintFormVersionStatus = "draft" | "published" | "archived";
export type PrintFormVersionStorageKind = "inline_text" | "file_ref";

export type PrintFormVersion = {
  id: number;
  print_form_id: number;
  version_no: number;
  template_label: string;
  storage_kind: string;
  template_source: string;
  status: string;
  is_current: boolean;
  created_at: string;
  updated_at: string;
};

export type PrintForm = {
  id: number;
  code: string;
  title: string;
  description: string | null;
  binding_type: string;
  binding_key: string;
  status: string;
  output_format: string;
  versioning_mode: string;
  created_at: string;
  updated_at: string;
  versions: PrintFormVersion[];
};

export type PrintFormDraft = {
  code: string;
  title: string;
  description: string;
  binding_type: PrintFormBindingType;
  binding_key: string;
  output_format: PrintFormOutputFormat;
};

export type PrintFormVersionDraft = {
  template_label: string;
  storage_kind: PrintFormVersionStorageKind;
  template_source: string;
};

export type PrintFormPreview = {
  print_form_id: number;
  print_form_code: string;
  version_id: number;
  version_no: number;
  output_format: string;
  content_type: string;
  file_name: string;
  content: string;
  is_preview: boolean;
};

export const printFormBindingTypeOptions: Array<{
  value: PrintFormBindingType;
  label: string;
}> = [
  { value: "model", label: "Модель" },
  { value: "directory", label: "Справочник" },
  { value: "document_type", label: "Тип документа" },
];

export const printFormOutputFormatOptions: Array<{
  value: PrintFormOutputFormat;
  label: string;
}> = [
  { value: "html", label: "HTML" },
  { value: "pdf", label: "PDF" },
  { value: "xlsx", label: "XLSX" },
];

export const printFormVersionStatusLabels: Record<string, string> = {
  draft: "Черновик",
  published: "Опубликована",
  archived: "Архив",
};

export const printFormStatusLabels: Record<string, string> = {
  draft: "Черновик",
  active: "Активна",
  archived: "Архив",
};

export function emptyPrintFormDraft(): PrintFormDraft {
  return {
    code: "",
    title: "",
    description: "",
    binding_type: "model",
    binding_key: "",
    output_format: "html",
  };
}

export function printFormToDraft(printForm: PrintForm): PrintFormDraft {
  return {
    code: printForm.code,
    title: printForm.title,
    description: printForm.description ?? "",
    binding_type: normalizeBindingType(printForm.binding_type),
    binding_key: printForm.binding_key,
    output_format: normalizeOutputFormat(printForm.output_format),
  };
}

export function emptyPrintFormVersionDraft(): PrintFormVersionDraft {
  return {
    template_label: "",
    storage_kind: "inline_text",
    template_source: "",
  };
}

export function validatePrintFormDraft(draft: PrintFormDraft): string | null {
  if (!draft.code.trim()) return "Укажите код печатной формы";
  if (!/^[a-z0-9_]+$/.test(draft.code.trim())) {
    return "Код должен содержать только латиницу, цифры и подчёркивания";
  }
  if (!draft.title.trim()) return "Укажите название печатной формы";
  if (!draft.binding_key.trim()) return "Укажите ключ привязки";
  if (!/^[a-z0-9_]+$/.test(draft.binding_key.trim())) {
    return "Ключ привязки должен содержать только латиницу, цифры и подчёркивания";
  }
  if (draft.title.trim().length > 160) {
    return "Название не длиннее 160 символов";
  }
  if (draft.description.trim().length > 2000) {
    return "Описание не длиннее 2000 символов";
  }
  return null;
}

export function validatePrintFormVersionDraft(
  draft: PrintFormVersionDraft,
): string | null {
  if (!draft.template_label.trim()) return "Укажите метку версии";
  if (!draft.template_source.trim()) return "Укажите текст шаблона";
  if (draft.template_label.trim().length > 160) {
    return "Метка версии не длиннее 160 символов";
  }
  return null;
}

export function filterPrintForms(
  rows: PrintForm[],
  query: string,
  activeOnly: boolean,
): PrintForm[] {
  const needle = query.trim().toLowerCase();
  return rows.filter((row) => {
    if (activeOnly && row.status !== "active") return false;
    if (!needle) return true;
    return (
      row.code.toLowerCase().includes(needle) ||
      row.title.toLowerCase().includes(needle) ||
      row.binding_key.toLowerCase().includes(needle)
    );
  });
}

export function getCurrentVersion(
  printForm: PrintForm,
): PrintFormVersion | null {
  return printForm.versions.find((version) => version.is_current) ?? null;
}

function normalizeBindingType(value: string): PrintFormBindingType {
  if (value === "directory" || value === "document_type") return value;
  return "model";
}

function normalizeOutputFormat(value: string): PrintFormOutputFormat {
  if (value === "pdf" || value === "xlsx") return value;
  return "html";
}
