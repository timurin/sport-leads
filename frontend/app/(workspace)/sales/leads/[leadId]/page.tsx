import { notFound } from "next/navigation";

import {
  listLeadWorkTasks,
  listWorkTaskFilterUsers,
} from "@/app/(workspace)/sales/tasks/work-task-actions";
import { LeadPage } from "@/components/sales/lead-page";
import { getMe } from "@/lib/auth/session";
import { getLeadDetails } from "@/lib/sales/lead-details";
import { getLeadStages } from "@/lib/sales/lead-stage-api";
import { getProductionStages } from "@/lib/production-stages";

type LeadRouteProps = {
  params: Promise<{ leadId: string }>;
};

export default async function LeadRoute({ params }: LeadRouteProps) {
  const { leadId } = await params;
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

  return (
    <LeadPage
      key={lead.id}
      lead={lead}
      stages={stageResult.stages}
      workTasks={workTasksLoaded.ok ? workTasksLoaded.data : []}
      workTasksError={workTasksLoaded.ok ? null : workTasksLoaded.message}
      workTaskStages={stagesCatalog.map((stage) => ({
        id: stage.id,
        label: stage.name,
      }))}
      workTaskUsers={usersLoaded.ok ? usersLoaded.data : []}
      viewerUserId={me?.id ?? null}
    />
  );
}
