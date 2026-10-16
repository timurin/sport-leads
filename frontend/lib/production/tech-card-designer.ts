export type DesignerUnitLine = {
  unit_index: number;
  size_type?: string | null;
  size?: string | null;
  personalization?: string | null;
  print_number?: string | null;
  color?: string | null;
  notes?: string | null;
};

const SIZE_TYPE_LABEL: Record<string, string> = {
  male: "Мужской",
  female: "Женский",
  men: "Мужской",
  women: "Женский",
  kids: "Детский",
};

export function designerSizeTypeLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return SIZE_TYPE_LABEL[value] ?? value;
}

export const DESIGN_REVIEW_MESSAGE = "Макет отправлен на утверждение.";

export function notesWithDesignReview(notes: string | null | undefined): string {
  const text = (notes ?? "").trim();
  if (text.includes(DESIGN_REVIEW_MESSAGE)) return text;
  return text ? `${text}\n${DESIGN_REVIEW_MESSAGE}` : DESIGN_REVIEW_MESSAGE;
}

export function isDesignReviewSubmitted(notes: string | null | undefined): boolean {
  return (notes ?? "").includes(DESIGN_REVIEW_MESSAGE);
}

export function designElapsedSeconds(
  startedAt: string | null | undefined,
  completedAt: string | null | undefined,
  now: Date,
): number | null {
  if (!startedAt) return null;
  const start = new Date(startedAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : now.getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  return Math.floor((end - start) / 1000);
}

export function formatDesignDuration(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const rest = safe % 60;
  if (hours > 0) return `${hours} ч ${minutes} мин`;
  if (minutes > 0) return `${minutes} мин ${rest} сек`;
  return `${rest} сек`;
}

function xmlCell(value: string): string {
  const text = value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
  return `<Cell><Data ss:Type="String">${text}</Data></Cell>`;
}

export function personalizationSpreadsheetXml(
  lines: ReadonlyArray<DesignerUnitLine>,
): string {
  const header = ["№", "Тип размера", "Размер", "Персонализация", "Номер", "Цвет", "Примечание"];
  const rows = [...lines].sort((a, b) => a.unit_index - b.unit_index);
  const body = rows
    .map((line) => {
      const cells = [
        String(line.unit_index),
        designerSizeTypeLabel(line.size_type) === "—" ? "" : designerSizeTypeLabel(line.size_type),
        line.size?.trim() || "",
        line.personalization?.trim() || "",
        line.print_number?.trim() || "",
        line.color?.trim() || "",
        line.notes?.trim() || "",
      ];
      return `<Row>${cells.map(xmlCell).join("")}</Row>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Worksheet ss:Name="Персонализация"><Table>
<Row>${header.map(xmlCell).join("")}</Row>
${body}
</Table></Worksheet></Workbook>`;
}
