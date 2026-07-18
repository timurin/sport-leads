import type { LeadStageConfig } from "@/lib/sales/lead-stages";

export type ApiLeadStage = {
  id: string;
  title: string;
  accent_class: string;
  is_active: boolean;
  sort_order: number;
  is_system: boolean;
};

export function fromApiLeadStage(stage: ApiLeadStage): LeadStageConfig {
  return {
    id: stage.id,
    title: stage.title,
    accentClass: stage.accent_class as LeadStageConfig["accentClass"],
    isActive: stage.is_active,
    sortOrder: stage.sort_order,
    isSystem: stage.is_system,
  };
}

export function toApiLeadStageConfiguration(
  stages: readonly LeadStageConfig[],
  transfers: Readonly<Record<string, string>>,
) {
  return {
    stages: stages.map((stage) => ({
      id: stage.id,
      title: stage.title,
      accent_class: stage.accentClass,
      is_active: stage.isActive,
      sort_order: stage.sortOrder,
    })),
    transfers: { ...transfers },
  };
}
