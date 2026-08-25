import { TechCardScanWorkspace } from "@/components/production/tech-card-scan-workspace";
import { getTechCardScan } from "@/lib/production/tech-card-scan-api";

export default async function TechCardScanPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const loaded = await getTechCardScan(token);
  return (
    <TechCardScanWorkspace
      token={token}
      scan={loaded.ok ? loaded.scan : null}
      loadError={loaded.ok ? undefined : loaded.message}
    />
  );
}
