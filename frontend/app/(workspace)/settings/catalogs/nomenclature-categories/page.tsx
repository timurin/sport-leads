import { redirect } from "next/navigation";

/** Categories directory absorbed by warehouse tree (`4.10.5`). */
export default function NomenclatureCategoriesRedirectPage() {
  redirect("/warehouse/stock");
}
