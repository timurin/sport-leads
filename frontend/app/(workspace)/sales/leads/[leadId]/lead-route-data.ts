import { notFound } from "next/navigation";

import {
  listLeadWorkTasks,
  listWorkTaskFilterUsers,
} from "@/app/(workspace)/sales/tasks/work-task-actions";
import { getMe } from "@/lib/auth/session";
import { hasPermission, PERM_LEADS_CARD_FIELDS_MANAGE } from "@/lib/auth/session-mapping";
import { getLeadDetails, type LeadDetails } from "@/lib/sales/lead-details";
import { getLeadStages } from "@/lib/sales/lead-stage-api";
import { getProductionStages } from "@/lib/production-stages";
import type { LeadStageConfig } from "@/lib/sales/lead-stages";
import type { WorkTaskListItem } from "@/lib/work-tasks";

export type LeadRouteModel = {
  lead: LeadDetails;
  stages: LeadStageConfig[];
  workTasks: WorkTaskListItem[];
  workTasksError: string | null;
  workTaskStages: Array<{ id: number; label: string }>;
  workTaskUsers: Array<{ id: number; label: string }>;
  viewerUserId: number | null;
  canManageCardFields: boolean;
};

export async function loadLeadRoute(leadId: string): Promise<LeadRouteModel> {
  if (!/^\d+$/.test(leadId)) {
    notFound();
  }

  const [me, lead, stageResult, workTasksLoaded, stagesCatalog, usersLoaded] =
    await Promise.all([
      getMe(),
      getLeadDetails(leadId),
      getLeadStages(),
      listLeadWorkTasks(Number(leadId)),
      getProductionStages({ active_only: true, limit: 200 }).catch(() => []),
      listWorkTaskFilterUsers(),
    ]);

  if (!lead) {
    notFound();
  }
  if (!stageResult.ok) {
    throw new Error(stageResult.message);
  }

  return {
    lead,
    stages: stageResult.stages,
    workTasks: workTasksLoaded.ok ? workTasksLoaded.data : [],
    workTasksError: workTasksLoaded.ok ? null : workTasksLoaded.message,
    workTaskStages: stagesCatalog.map((stage) => ({
      id: stage.id,
      label: stage.name,
    })),
    workTaskUsers: usersLoaded.ok ? usersLoaded.data : [],
    viewerUserId: me?.id ?? null,
    canManageCardFields: hasPermission(me, PERM_LEADS_CARD_FIELDS_MANAGE),
  };
}
