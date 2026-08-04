import { redirect } from "next/navigation";

/** Legacy catalogs path → platform directories (`18.2.4`). */
export default function LegacyCitiesRedirectPage() {
  redirect("/settings/platform-directories/cities");
}
