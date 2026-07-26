import { VatRatesPageShell } from "@/components/settings/vat-rates-workspace";
import { getVatRates } from "@/lib/vat-rates";

export default async function VatRatesListPage() {
  const rates = await getVatRates();
  return <VatRatesPageShell rates={rates} />;
}
