import { notFound } from "next/navigation";

import { ProductModelCard } from "@/components/settings/product-model-card";
import { ProductModelPersistentCard } from "@/components/settings/product-model-persistent-card";
import { productModelReference } from "@/lib/demo-data/product-model-reference";
import {
  getProductModelById,
  getProductModelHistory,
  getProductModelMedia,
  getProductModelVersions,
  parseProductModelRouteId,
  toProductModelVersionViews,
} from "@/lib/product-models";

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
  if (id == null) {
    notFound();
  }

  const model = await getProductModelById(id);
  if (!model) {
    notFound();
  }

  const [versions, media, history] = await Promise.all([
    getProductModelVersions(id),
    getProductModelMedia(id),
    getProductModelHistory(id),
  ]);

  return (
    <ProductModelPersistentCard
      model={model}
      versions={toProductModelVersionViews(versions)}
      media={media}
      history={history}
      initialEditing={initialEditing}
    />
  );
}
