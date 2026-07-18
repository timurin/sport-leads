"use server";

import { saveLeadStages } from "@/lib/sales/lead-stage-api";
import { validateLeadStages, type LeadStageConfig } from "@/lib/sales/lead-stages";

export async function saveLeadStageConfiguration(
  stages: LeadStageConfig[],
  transfers: Readonly<Record<string, string>>,
) {
  if (!validateLeadStages(stages)) {
    return { ok: false as const, message: "Конфигурация стадий содержит недопустимые значения." };
  }
  return saveLeadStages(stages, transfers);
}
