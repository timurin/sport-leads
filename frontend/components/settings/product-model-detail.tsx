import { notFound } from "next/navigation";

import { ProductModelPersistentCard } from "@/components/settings/product-model-persistent-card";
import { loadProductModelDetailData } from "@/lib/product-model-detail-data";

export async function ProductModelDetail({
  modelId,
  initialEditing = false,
}: {
  modelId: number;
  initialEditing?: boolean;
}) {
  const data = await loadProductModelDetailData(modelId);
  if (!data) notFound();
  return <ProductModelPersistentCard {...data} initialEditing={initialEditing} />;
}
