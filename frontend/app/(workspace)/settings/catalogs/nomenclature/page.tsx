import { redirect } from "next/navigation";

/** Settings list absorbed by warehouse PT-04 (`4.10.5`). Card stays at `[id]`. */
export default function NomenclatureListRedirectPage() {
  redirect("/warehouse/stock");
}
