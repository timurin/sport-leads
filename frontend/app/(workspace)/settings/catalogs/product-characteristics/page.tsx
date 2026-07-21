import { ProductCharacteristicsWorkspace } from "@/components/settings/product-characteristics-workspace";
import { getCharacteristicDefinitions, getCharacteristicOptions } from "@/lib/nomenclature";

export default async function ProductCharacteristicsPage() {
  const definitions = await getCharacteristicDefinitions();
  const options = await Promise.all(definitions.map(async (definition) => [definition.id, (await getCharacteristicOptions(definition.id)).length] as const));
  return <ProductCharacteristicsWorkspace definitions={definitions} optionCounts={Object.fromEntries(options)} />;
}
