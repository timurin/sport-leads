import { notFound } from "next/navigation";

import { ProductModelCard } from "@/components/settings/product-model-card";
import { ProductModelDetail } from "@/components/settings/product-model-detail";
import { productModelReference } from "@/lib/demo-data/product-model-reference";
import { parseProductModelRouteId } from "@/lib/product-models";

type ProductModelRouteProps = {
  params: Promise<{ modelId: string }>;
  searchParams: Promise<{ edit?: string }>;
};

export default async function ProductModelRoute({
  params,
  searchParams,
}: ProductModelRouteProps) {
  const { modelId } = await params;
  const { edit } = await searchParams;
  const initialEditing = edit === "1" || edit === "true";

  if (modelId === productModelReference.id) {
    return <ProductModelCard model={productModelReference} />;
  }

  const id = parseProductModelRouteId(modelId);
  if (id == null) notFound();

  return <ProductModelDetail modelId={id} initialEditing={initialEditing} />;
}
