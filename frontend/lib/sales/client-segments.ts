/**
 * Client segment tags + duplicate match helpers (`2.3.2` / `SL-CLIENT-SEGMENTS-v1`).
 */

export const MAX_CLIENT_SEGMENTS = 32;
export const MAX_SEGMENT_NAME_LENGTH = 64;

export function normalizeSegmentName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

export function mergeSegmentTags(current: string[], incoming: string): string[] {
  const name = normalizeSegmentName(incoming);
  if (!name) return current;
  if (name.length > MAX_SEGMENT_NAME_LENGTH) return current;
  const key = name.toLocaleLowerCase("ru");
  if (current.some((item) => item.toLocaleLowerCase("ru") === key)) {
    return current;
  }
  if (current.length >= MAX_CLIENT_SEGMENTS) return current;
  return [...current, name];
}

export function validateSegmentName(raw: string): string | null {
  const name = normalizeSegmentName(raw);
  if (!name) return "Укажите название сегмента";
  if (name.length > MAX_SEGMENT_NAME_LENGTH) {
    return "Сегмент не длиннее 64 символов";
  }
  return null;
}

export type ClientDuplicateCandidate = {
  id: number;
  company_name: string | null;
  contact_name: string;
  phone: string | null;
  inn: string | null;
  matched_on: string[];
};

export function duplicateMatchLabel(code: string): string {
  if (code === "name") return "имя";
  if (code === "phone") return "телефон";
  if (code === "inn") return "ИНН";
  return code;
}
