export function normalizeCitySuggestionQuery(value: string): string {
  return value.trim().toLocaleLowerCase("ru-RU").replaceAll("ё", "е");
}

export function rankCitySuggestions(
  query: string,
  cities: readonly string[],
  limit = 8,
): string[] {
  const normalizedQuery = normalizeCitySuggestionQuery(query);
  if (normalizedQuery.length < 2 || limit < 1) {
    return [];
  }

  const uniqueCities = Array.from(
    new Map(
      cities
        .map((city) => city.trim())
        .filter(Boolean)
        .map((city) => [city, city]),
    ).values(),
  );

  return uniqueCities
    .map((city, index) => ({
      city,
      index,
      normalized: normalizeCitySuggestionQuery(city),
    }))
    .filter((item) => item.normalized.includes(normalizedQuery))
    .sort((left, right) => {
      const leftStarts = left.normalized.startsWith(normalizedQuery);
      const rightStarts = right.normalized.startsWith(normalizedQuery);
      if (leftStarts !== rightStarts) {
        return leftStarts ? -1 : 1;
      }
      return left.index - right.index;
    })
    .slice(0, limit)
    .map((item) => item.city);
}

export function toPlatformCitySuggestionsPath(
  query: string,
  limit = 8,
): string {
  const params = new URLSearchParams();
  params.set("q", query.trim());
  params.set("limit", String(limit));
  return `/api/platform-directories/city-suggestions?${params.toString()}`;
}

export function readPlatformCitySuggestionNames(payload: unknown): string[] {
  if (!Array.isArray(payload)) {
    return [];
  }
  return payload
    .filter((item): item is { name: string } => {
      if (typeof item !== "object" || item === null) {
        return false;
      }
      return typeof (item as { name?: unknown }).name === "string";
    })
    .map((item) => item.name.trim())
    .filter(Boolean);
}
