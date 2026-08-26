import { LeadWorkspace } from "@/components/sales/lead-workspace";
import { LeadCardSlider } from "@/components/sales/lead-card-slider";
import { LeadPage } from "@/components/sales/lead-page";
import { getLeadList } from "@/lib/sales/lead-list-api";
import { getLeadStages } from "@/lib/sales/lead-stage-api";

import { loadLeadRoute } from "./lead-route-data";

type LeadRouteProps = {
  params: Promise<{ leadId: string }>;
};

export default async function LeadRoute({ params }: LeadRouteProps) {
  const { leadId } = await params;
  const [model, leadList, leadStages] = await Promise.all([
    loadLeadRoute(leadId),
    getLeadList(),
    getLeadStages(),
  ]);
  const loadError = [
    leadList.ok ? null : leadList.message,
    leadStages.ok ? null : leadStages.message,
  ].filter(Boolean).join(" ") || undefined;

  return (
    <>
      <LeadWorkspace
        initialLeads={leadList.leads}
        initialStages={leadStages.stages}
        loadError={loadError}
      />
      <LeadCardSlider>
        <LeadPage
          key={model.lead.id}
          lead={model.lead}
          stages={model.stages}
          workTasks={model.workTasks}
          workTasksError={model.workTasksError}
          workTaskStages={model.workTaskStages}
          workTaskUsers={model.workTaskUsers}
          viewerUserId={model.viewerUserId}
        canManageCardFields={model.canManageCardFields}
        />
      </LeadCardSlider>
    </>
  );
}
