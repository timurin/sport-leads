import { LeadCardSlider } from "@/components/sales/lead-card-slider";
import { LeadPage } from "@/components/sales/lead-page";

import { loadLeadRoute } from "@/app/(workspace)/sales/leads/[leadId]/lead-route-data";

type LeadSliderRouteProps = {
  params: Promise<{ leadId: string }>;
};

export default async function LeadSliderIntercept({ params }: LeadSliderRouteProps) {
  const { leadId } = await params;
  const model = await loadLeadRoute(leadId);

  return (
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
  );
}
