export const LEAD_STAGE_STORAGE_KEY = "sport-leads.sales.lead-stages.v1";

export const LEAD_STAGE_ACCENTS = [
  { value: "bg-blue-500", label: "Синий" },
  { value: "bg-cyan-500", label: "Бирюзовый" },
  { value: "bg-violet-500", label: "Фиолетовый" },
  { value: "bg-amber-500", label: "Жёлтый" },
  { value: "bg-orange-500", label: "Оранжевый" },
  { value: "bg-emerald-500", label: "Зелёный" },
  { value: "bg-rose-500", label: "Розовый" },
  { value: "bg-slate-500", label: "Серый" },
] as const;

export type LeadStageAccent = (typeof LEAD_STAGE_ACCENTS)[number]["value"];

export type LeadStageConfig = {
  id: string;
  title: string;
  accentClass: LeadStageAccent;
  isActive: boolean;
  sortOrder: number;
  isSystem: boolean;
};

export const DEFAULT_LEAD_STAGES: readonly LeadStageConfig[] = [
  { id: "new", title: "Новый", accentClass: "bg-blue-500", isActive: true, sortOrder: 0, isSystem: true },
  { id: "contact", title: "Первичный контакт", accentClass: "bg-cyan-500", isActive: true, sortOrder: 1, isSystem: true },
  { id: "qualification", title: "Квалификация", accentClass: "bg-violet-500", isActive: true, sortOrder: 2, isSystem: true },
  { id: "proposal", title: "Предложение", accentClass: "bg-amber-500", isActive: true, sortOrder: 3, isSystem: true },
  { id: "waiting", title: "Ожидание решения", accentClass: "bg-orange-500", isActive: true, sortOrder: 4, isSystem: true },
];

const RESERVED_STAGE_IDS = new Set(["converted", "rejected"]);
const ACCENT_CLASSES = new Set<string>(LEAD_STAGE_ACCENTS.map((accent) => accent.value));
const STAGE_ID_PATTERN = /^[a-z][a-z0-9-]{0,63}$/;

export function getDefaultLeadStages(): LeadStageConfig[] {
  return DEFAULT_LEAD_STAGES.map((stage) => ({ ...stage }));
}

export function sortLeadStages(stages: readonly LeadStageConfig[]): LeadStageConfig[] {
  return stages
    .map((stage) => ({ ...stage }))
    .sort((first, second) => first.sortOrder - second.sortOrder || first.id.localeCompare(second.id));
}

export function getActiveLeadStages(stages: readonly LeadStageConfig[]): LeadStageConfig[] {
  return sortLeadStages(stages).filter((stage) => stage.isActive);
}

export function parseStoredLeadStages(rawValue: string | null): LeadStageConfig[] {
  if (!rawValue) {
    return getDefaultLeadStages();
  }
  try {
    const parsed: unknown = JSON.parse(rawValue);
    return validateLeadStages(parsed) ? sortLeadStages(parsed) : getDefaultLeadStages();
  } catch {
    return getDefaultLeadStages();
  }
}

export function loadLeadStages(storage: Pick<Storage, "getItem">): LeadStageConfig[] {
  try {
    return parseStoredLeadStages(storage.getItem(LEAD_STAGE_STORAGE_KEY));
  } catch {
    return getDefaultLeadStages();
  }
}

export function validateLeadStages(value: unknown): value is LeadStageConfig[] {
  if (!Array.isArray(value) || value.length === 0) {
    return false;
  }

  const ids = new Set<string>();
  let activeStages = 0;

  for (const item of value) {
    if (!item || typeof item !== "object") {
      return false;
    }

    const stage = item as Partial<LeadStageConfig>;
    const title = typeof stage.title === "string" ? stage.title.trim() : "";

    if (
      typeof stage.id !== "string"
      || !STAGE_ID_PATTERN.test(stage.id)
      || RESERVED_STAGE_IDS.has(stage.id)
      || ids.has(stage.id)
      || !title
      || !ACCENT_CLASSES.has(String(stage.accentClass))
      || typeof stage.isActive !== "boolean"
      || !Number.isInteger(stage.sortOrder)
      || Number(stage.sortOrder) < 0
      || typeof stage.isSystem !== "boolean"
    ) {
      return false;
    }

    ids.add(stage.id);
    activeStages += stage.isActive ? 1 : 0;
  }

  return activeStages > 0 && DEFAULT_LEAD_STAGES.every((stage) => ids.has(stage.id));
}

export function createLeadStageId(stages: readonly LeadStageConfig[]): string {
  const ids = new Set(stages.map((stage) => stage.id));
  let sequence = 1;

  while (ids.has(`custom-${sequence}`)) {
    sequence += 1;
  }

  return `custom-${sequence}`;
}

export type StageDeactivationIssue =
  | "last-active-stage"
  | "transfer-required"
  | "invalid-transfer-stage";

export function getStageDeactivationIssue(
  stages: readonly LeadStageConfig[],
  stageId: string,
  leadStageIds: readonly string[],
  transferStageId?: string,
): StageDeactivationIssue | null {
  const stage = stages.find((item) => item.id === stageId);

  if (!stage || !stage.isActive) {
    return null;
  }

  if (stages.filter((item) => item.isActive).length === 1) {
    return "last-active-stage";
  }

  if (!leadStageIds.includes(stageId)) {
    return null;
  }

  if (!transferStageId) {
    return "transfer-required";
  }

  const target = stages.find((item) => item.id === transferStageId);

  return !target || !target.isActive || target.id === stageId
    ? "invalid-transfer-stage"
    : null;
}

export function renameLeadStage(
  stages: readonly LeadStageConfig[],
  stageId: string,
  title: string,
): LeadStageConfig[] {
  return stages.map((stage) => (
    stage.id === stageId ? { ...stage, title } : { ...stage }
  ));
}
