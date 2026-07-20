import { PageHeader } from "@/components/ui/page-header";
import { UnitsOfMeasureWorkspace } from "@/components/settings/units-of-measure-workspace";
import { getUnitsOfMeasure } from "@/lib/nomenclature";

export default async function UnitsOfMeasurePage() {
  return <><PageHeader title="Единицы измерения" description="Базовые единицы хранения номенклатуры" /><UnitsOfMeasureWorkspace units={await getUnitsOfMeasure()} /></>;
}
