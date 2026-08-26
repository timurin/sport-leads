import type { NomenclatureAvailableModel } from "@/lib/nomenclature";
import type { ProductModel } from "@/lib/product-models";

/** Active models of the selected Вид изделия — picker source, not card body. */
export function matchingActiveModelsForProductType(
  activeModels: ReadonlyArray<Pick<ProductModel, "id" | "article" | "product_type_id">>,
  productTypeId: number | null,
): Array<Pick<ProductModel, "id" | "article" | "product_type_id">> {
  if (productTypeId == null) return [];
  return activeModels
    .filter((model) => model.product_type_id === productTypeId)
    .slice()
    .sort((left, right) => left.article.localeCompare(right.article, "ru"));
}

/** Models still addable to the nomenclature whitelist. */
export function nomenclatureModelPickerOptions<
  T extends Pick<ProductModel, "id" | "article" | "product_type_id">,
>(
  activeModels: ReadonlyArray<T>,
  productTypeId: number | null,
  linkedProductModelIds: ReadonlySet<number>,
): T[] {
  return matchingActiveModelsForProductType(
    activeModels,
    productTypeId,
  ).filter((model) => !linkedProductModelIds.has(model.id)) as T[];
}

export function sortNomenclatureAvailableModelLinks(
  links: ReadonlyArray<NomenclatureAvailableModel>,
): NomenclatureAvailableModel[] {
  return links
    .slice()
    .sort((left, right) => left.sort_order - right.sort_order || left.article.localeCompare(right.article, "ru"));
}
