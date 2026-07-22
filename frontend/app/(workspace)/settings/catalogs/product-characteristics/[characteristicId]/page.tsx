import { notFound } from "next/navigation";

import { CharacteristicCard } from "@/components/settings/characteristic-card";
import {
  getCharacteristicDefinitions,
  getCharacteristicOptions,
} from "@/lib/nomenclature";

export default async function ProductCharacteristicPage({
  params,
}: {
  params: Promise<{ characteristicId: string }>;
}) {
  const { characteristicId } = await params;
  const id = Number(characteristicId);
  if (!Number.isFinite(id) || id <= 0) {
    notFound();
  }

  const [definitions, options] = await Promise.all([
    getCharacteristicDefinitions(),
    getCharacteristicOptions(id),
  ]);
  const definition = definitions.find((item) => item.id === id);

  if (!definition) {
    notFound();
  }

  return <CharacteristicCard definition={definition} options={options} />;
}
