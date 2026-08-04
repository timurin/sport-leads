import { notFound } from "next/navigation";

import { SizeGridCard } from "@/components/settings/size-grid-card";
import { getSizeGridAuditEvents } from "@/lib/audit-events";
import { getMe } from "@/lib/auth/session";
import {
  hasPermission,
  PERM_AUDIT_READ,
  PERM_SIZE_GRIDS_WRITE,
} from "@/lib/auth/session-mapping";
import { getSizeGrid, parseSizeGridRouteId } from "@/lib/size-grids";

type SizeGridCardRouteProps = {
  params: Promise<{ gridId: string }>;
};

export default async function SizeGridCardPage({ params }: SizeGridCardRouteProps) {
  const { gridId: rawId } = await params;
  const gridId = parseSizeGridRouteId(rawId);
  if (gridId == null) notFound();

  const [grid, me] = await Promise.all([getSizeGrid(gridId), getMe()]);
  if (!grid) notFound();

  const canReadAudit = hasPermission(me, PERM_AUDIT_READ);
  const auditEvents = canReadAudit
    ? await getSizeGridAuditEvents(gridId)
    : [];

  return (
    <SizeGridCard
      grid={grid}
      canWrite={hasPermission(me, PERM_SIZE_GRIDS_WRITE)}
      canReadAudit={canReadAudit}
      auditEvents={auditEvents}
    />
  );
}
