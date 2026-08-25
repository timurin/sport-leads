import { notFound } from "next/navigation";

import { SewingCabinetWorkspace } from "@/components/production/sewing-cabinet-workspace";
import { getSewingCabinet } from "@/lib/production/sewing-cabinet-api";
import { parseSewingPeriodPreset } from "@/lib/production/sewing-cabinet";

export default async function SewingCabinetUserPage({
  params,
  searchParams,
}: {
  params: Promise<{ platformUserId: string }>;
  searchParams: Promise<{
    period?: string;
    date_from?: string;
    date_to?: string;
  }>;
}) {
  const { platformUserId } = await params;
  if (!/^\d+$/.test(platformUserId)) {
    notFound();
  }
  const query = await searchParams;
  const period = parseSewingPeriodPreset(query.period);
  const loaded = await getSewingCabinet({
    platformUserId: Number(platformUserId),
    period,
    dateFrom: query.date_from,
    dateTo: query.date_to,
  });
  return (
    <SewingCabinetWorkspace
      cabinet={loaded.ok ? loaded.cabinet : null}
      loadError={loaded.ok ? undefined : loaded.message}
      basePath={`/production/sewing-cabinet/${platformUserId}`}
      period={period}
      dateFrom={query.date_from}
      dateTo={query.date_to}
    />
  );
}
