import { notFound } from "next/navigation";

import { SpecificationCard } from "@/components/production/specification-card";
import { getSpecificationDetail } from "@/lib/production/specifications-api";

export default async function ProductionSpecificationDetailPage({
  params,
}: {
  params: Promise<{ specificationId: string }>;
}) {
  const { specificationId } = await params;
  const result = await getSpecificationDetail(specificationId);
  if (!result.ok && result.notFound) notFound();
  if (!result.ok || result.specification == null) {
    throw new Error(result.message);
  }
  return <SpecificationCard specification={result.specification} />;
}
