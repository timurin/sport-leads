export type SewingOperationTemplateLine = {
  id: number;
  sewing_operation_id: number;
  sequence: number;
  operation_name: string | null;
  cost: string | null;
  quantity_per_item: number | null;
  duration_seconds: number | null;
};

export type SewingOperationTemplate = {
  id: number;
  name: string;
  lines: SewingOperationTemplateLine[];
  created_at: string;
  updated_at: string;
};

function apiBaseUrl(): string {
  return (process.env.SPORT_LEADS_API_URL ?? "http://127.0.0.1:8000").replace(
    /\/$/,
    "",
  );
}

function normalizeTemplate(
  row: SewingOperationTemplate,
): SewingOperationTemplate {
  return {
    ...row,
    lines: Array.isArray(row.lines)
      ? row.lines.map((line) => ({
          ...line,
          sewing_operation_id: Number(line.sewing_operation_id),
          sequence: Number(line.sequence),
          quantity_per_item:
            line.quantity_per_item == null
              ? null
              : Number(line.quantity_per_item),
          duration_seconds:
            line.duration_seconds == null
              ? null
              : Number(line.duration_seconds),
        }))
      : [],
  };
}

export async function getSewingOperationTemplates(): Promise<
  SewingOperationTemplate[]
> {
  const response = await fetch(`${apiBaseUrl()}/sewing-operation-templates`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(
      `Не удалось загрузить шаблоны операций пошива (${response.status}).`,
    );
  }
  const rows = (await response.json()) as SewingOperationTemplate[];
  return rows.map(normalizeTemplate);
}

export function filterSewingOperationTemplates(
  templates: SewingOperationTemplate[],
  query: string,
): SewingOperationTemplate[] {
  const needle = query.trim().toLocaleLowerCase("ru");
  if (!needle) return templates;
  return templates.filter((row) =>
    row.name.toLocaleLowerCase("ru").includes(needle),
  );
}

export function validateSewingOperationTemplateName(
  name: string,
): string | null {
  const trimmed = name.trim();
  if (!trimmed) return "Укажите наименование шаблона";
  if (trimmed.length > 255) return "Наименование не длиннее 255 символов";
  return null;
}

export function moveIdInList(
  ids: number[],
  id: number,
  direction: "up" | "down",
): number[] {
  const index = ids.indexOf(id);
  if (index < 0) return ids;
  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= ids.length) return ids;
  const next = [...ids];
  const [item] = next.splice(index, 1);
  next.splice(target, 0, item);
  return next;
}

/** Merge template op ids into drawer selection (`6.3.13` create/append UX). */
export function mergeTemplateOperationIds(
  currentIds: number[],
  templateOperationIds: number[],
  options: {
    mode: "append" | "replace";
    excludedIds?: number[];
  },
): number[] {
  const excluded = new Set(options.excludedIds ?? []);
  const fromTemplate: number[] = [];
  const seenTemplate = new Set<number>();
  for (const id of templateOperationIds) {
    if (excluded.has(id) || seenTemplate.has(id)) continue;
    seenTemplate.add(id);
    fromTemplate.push(id);
  }
  if (options.mode === "replace") {
    return fromTemplate;
  }
  const next = [...currentIds];
  const seen = new Set(currentIds);
  for (const id of fromTemplate) {
    if (seen.has(id)) continue;
    next.push(id);
    seen.add(id);
  }
  return next;
}
