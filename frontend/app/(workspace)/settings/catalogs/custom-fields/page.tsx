import { redirect } from "next/navigation";

/** Former «Дополнительные реквизиты» catalog — unified into product-characteristics (4.8.5). */
export default function CustomFieldsRedirectPage() {
  redirect("/settings/catalogs/product-characteristics");
}
