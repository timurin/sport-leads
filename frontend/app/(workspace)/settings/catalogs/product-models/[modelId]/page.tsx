import { notFound } from "next/navigation";

import { ProductModelCard } from "@/components/settings/product-model-card";
import { productModelReference } from "@/lib/demo-data/product-model-reference";

type ProductModelRouteProps = {
  params: Promise<{ modelId: string }>;
};

export default async function ProductModelRoute({ params }: ProductModelRouteProps) {
  const { modelId } = await params;
  if (modelId !== productModelReference.id) {
    notFound();
  }
  return <ProductModelCard model={productModelReference} />;
}
