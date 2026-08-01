import {
  NOMENCLATURE_TYPE_LABELS,
  type NomenclatureType,
} from "@/lib/nomenclature";

export type TechnicalCardSettings = {
  id: number;
  eligible_nomenclature_types: NomenclatureType[];
  numbering_template: string;
  unit_field_size_type_enabled: boolean;
  unit_field_size_enabled: boolean;
  unit_field_personalization_enabled: boolean;
  unit_field_print_number_enabled: boolean;
  unit_field_notes_enabled: boolean;
  stage_label_binding_mode: "snapshot";
  created_at: string;
  updated_at: string;
};

export type TechnicalCardSettingsDraft = {
  eligible_nomenclature_types: NomenclatureType[];
  numbering_template: string;
  unit_field_size_type_enabled: boolean;
  unit_field_size_enabled: boolean;
  unit_field_personalization_enabled: boolean;
  unit_field_print_number_enabled: boolean;
  unit_field_notes_enabled: boolean;
  stage_label_binding_mode: "snapshot";
};

export const TECHNICAL_CARD_ELIGIBLE_TYPE_OPTIONS: Array<{
  value: NomenclatureType;
  label: string;
}> = [
  { value: "PRODUCT", label: NOMENCLATURE_TYPE_LABELS.PRODUCT },
  { value: "GOODS", label: NOMENCLATURE_TYPE_LABELS.GOODS },
  { value: "SERVICE", label: NOMENCLATURE_TYPE_LABELS.SERVICE },
  { value: "MATERIAL", label: NOMENCLATURE_TYPE_LABELS.MATERIAL },
];

export const TECHNICAL_CARD_UNIT_FIELD_OPTIONS = [
  {
    key: "unit_field_size_type_enabled",
    label: "Тип размера",
    description: "Поле `size_type` в построчном документе и импорте.",
  },
  {
    key: "unit_field_size_enabled",
    label: "Размер",
    description: "Поле `size` для поштучной матрицы изделий.",
  },
  {
    key: "unit_field_personalization_enabled",
    label: "Персонализация",
    description: "ФИО, надпись или иная пользовательская персонализация.",
  },
  {
    key: "unit_field_print_number_enabled",
    label: "Номер печати",
    description: "Игровой номер или иной печатный номер на единицу.",
  },
  {
    key: "unit_field_notes_enabled",
    label: "Примечание",
    description: "Свободный комментарий по конкретной единице.",
  },
] as const satisfies Array<{
  key: keyof Pick<
    TechnicalCardSettingsDraft,
    | "unit_field_size_type_enabled"
    | "unit_field_size_enabled"
    | "unit_field_personalization_enabled"
    | "unit_field_print_number_enabled"
    | "unit_field_notes_enabled"
  >;
  label: string;
  description: string;
}>;

function apiBaseUrl(): string {
  return (process.env.SPORT_LEADS_API_URL ?? "http://127.0.0.1:8000").replace(
    /\/$/,
    "",
  );
}

export function toTechnicalCardSettingsDraft(
  settings: TechnicalCardSettings,
): TechnicalCardSettingsDraft {
  return {
    eligible_nomenclature_types: [...settings.eligible_nomenclature_types],
    numbering_template: settings.numbering_template,
    unit_field_size_type_enabled: settings.unit_field_size_type_enabled,
    unit_field_size_enabled: settings.unit_field_size_enabled,
    unit_field_personalization_enabled:
      settings.unit_field_personalization_enabled,
    unit_field_print_number_enabled: settings.unit_field_print_number_enabled,
    unit_field_notes_enabled: settings.unit_field_notes_enabled,
    stage_label_binding_mode: settings.stage_label_binding_mode,
  };
}

export function isTechnicalCardSettingsDirty(
  settings: TechnicalCardSettings,
  draft: TechnicalCardSettingsDraft,
): boolean {
  return (
    settings.numbering_template !== draft.numbering_template ||
    settings.stage_label_binding_mode !== draft.stage_label_binding_mode ||
    settings.unit_field_size_type_enabled !==
      draft.unit_field_size_type_enabled ||
    settings.unit_field_size_enabled !== draft.unit_field_size_enabled ||
    settings.unit_field_personalization_enabled !==
      draft.unit_field_personalization_enabled ||
    settings.unit_field_print_number_enabled !==
      draft.unit_field_print_number_enabled ||
    settings.unit_field_notes_enabled !== draft.unit_field_notes_enabled ||
    settings.eligible_nomenclature_types.join(",") !==
      draft.eligible_nomenclature_types.join(",")
  );
}

export function validateTechnicalCardSettingsDraft(
  draft: TechnicalCardSettingsDraft,
): string | null {
  if (draft.eligible_nomenclature_types.length === 0) {
    return "Выберите хотя бы один тип номенклатуры для генерации техкарт";
  }
  if (!draft.numbering_template.trim()) {
    return "Укажите шаблон нумерации";
  }
  if (draft.numbering_template.trim().length > 120) {
    return "Шаблон нумерации не длиннее 120 символов";
  }
  if (
    !draft.numbering_template.includes("{orderNo}") ||
    !draft.numbering_template.includes("{cardSeq}")
  ) {
    return "Шаблон нумерации должен содержать {orderNo} и {cardSeq}";
  }
  if (draft.stage_label_binding_mode !== "snapshot") {
    return "Режим подписи этапа пока поддерживает только snapshot";
  }
  return null;
}

export async function getTechnicalCardSettings(): Promise<TechnicalCardSettings> {
  const response = await fetch(`${apiBaseUrl()}/technical-card-settings`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(
      `Не удалось загрузить настройки техкарт (${response.status}).`,
    );
  }
  return (await response.json()) as TechnicalCardSettings;
}
