import { redirect } from "next/navigation";

/** Compatibility URL; the dispatcher UI remains implemented by /planning. */
export default async function ManualPlanningAlias({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (Array.isArray(value)) value.forEach((item) => query.append(key, item));
    else if (value !== undefined) query.set(key, value);
  }
  const suffix = query.toString();
  redirect(`/production/calendar/planning${suffix ? `?${suffix}` : ""}`);
}
