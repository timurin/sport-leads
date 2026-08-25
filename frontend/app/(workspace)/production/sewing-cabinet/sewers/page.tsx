import { SewingCabinetSewersWorkspace } from "@/components/production/sewing-cabinet-sewers-workspace";
import { getSewingSewers } from "@/lib/production/sewing-cabinet-api";
import { parseSewingPeriodPreset } from "@/lib/production/sewing-cabinet";

export default async function SewingCabinetSewersPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const params = await searchParams;
  const period = parseSewingPeriodPreset(params.period);
  const loaded = await getSewingSewers({ period });
  return (
    <SewingCabinetSewersWorkspace
      items={loaded.ok ? loaded.items : []}
      loadError={loaded.ok ? undefined : loaded.message}
      period={period}
    />
  );
}
