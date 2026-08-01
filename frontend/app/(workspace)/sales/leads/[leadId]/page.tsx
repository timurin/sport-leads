import { notFound } from "next/navigation";

import { LeadPage } from "@/components/sales/lead-page";
import { getLeadDetails } from "@/lib/sales/lead-details";
import { getLeadStages } from "@/lib/sales/lead-stage-api";

type LeadRouteProps = {
  params: Promise<{ leadId: string }>;
};

export default async function LeadRoute({ params }: LeadRouteProps) {
  const { leadId } = await params;
  if (!/^\d+$/.test(leadId)) {
    notFound();
  }

  const [lead, stageResult] = await Promise.all([
    getLeadDetails(leadId),
    getLeadStages(),
  ]);

  if (!lead) {
    notFound();
  }
  if (!stageResult.ok) {
    throw new Error(stageResult.message);
  }

  return <LeadPage key={lead.id} lead={lead} stages={stageResult.stages} />;
}
