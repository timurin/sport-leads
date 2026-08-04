import { redirect } from "next/navigation";

/** Templates live in fullscreen modal on sewing operations (`6.3.12` owner UX). */
export default function SewingOperationTemplatesRedirectPage() {
  redirect("/settings/catalogs/sewing_operations");
}
