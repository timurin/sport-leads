import { notFound } from "next/navigation";

import { LeadPage } from "@/components/sales/lead-page";
import { getLeadDetails } from "@/lib/sales/lead-details";

type LeadRouteProps = {
  params: Promise<{ leadId: string }>;
};

export default async function LeadRoute({ params }: LeadRouteProps) {
  const { leadId } = await params;
  const lead = await getLeadDetails(leadId);

  if (!lead) {
    notFound();
  }

  return <LeadPage key={lead.id} lead={lead} />;
}
