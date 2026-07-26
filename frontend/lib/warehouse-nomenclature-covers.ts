/**
 * Pick primary (else first) media content_url for list covers.
 * Pure helper — no API imports (node:test friendly).
 */
export function primaryNomenclatureCoverContentUrl(
  media: Array<{ content_url: string; is_primary: boolean }>,
): string | null {
  const primary = media.find((row) => row.is_primary) ?? media[0] ?? null;
  return primary?.content_url ?? null;
}
