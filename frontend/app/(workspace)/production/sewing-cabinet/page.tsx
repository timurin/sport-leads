import { SewingCabinetWorkspace } from "@/components/production/sewing-cabinet-workspace";
import { getSewingCabinet } from "@/lib/production/sewing-cabinet-api";
import { parseSewingPeriodPreset } from "@/lib/production/sewing-cabinet";

export default async function SewingCabinetPage({
  searchParams,
}: {
  searchParams: Promise<{
    period?: string;
    date_from?: string;
    date_to?: string;
  }>;
}) {
  const params = await searchParams;
  const period = parseSewingPeriodPreset(params.period);
  const loaded = await getSewingCabinet({
    period,
    dateFrom: params.date_from,
    dateTo: params.date_to,
  });
  return (
    <SewingCabinetWorkspace
      cabinet={loaded.ok ? loaded.cabinet : null}
      loadError={loaded.ok ? undefined : loaded.message}
      basePath="/production/sewing-cabinet"
      period={period}
      dateFrom={params.date_from}
      dateTo={params.date_to}
    />
  );
}
