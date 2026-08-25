import type {
  ApiTechnicalCard,
  ApiTechnicalCardAssemblySewingOp,
  ApiTechnicalCardCompositionLine,
  ApiTechnicalCardOperationLine,
} from "../sales/order-tech-cards-api";

export type TechnicalCardPrintRequest = {
  binding_type: "model";
  binding_key: "technical_card";
  output_format: "html" | "pdf";
  payload: Record<string, unknown>;
};

const VOLUME_UNIT_LABEL: Record<string, string> = {
  linear_meters: "п.м.",
  pieces: "шт.",
};

const SIZE_TYPE_LABEL: Record<string, string> = {
  male: "Мужской",
  female: "Женский",
  men: "Мужской",
  women: "Женский",
  kids: "Детский",
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Черновик",
  in_progress: "В работе",
  completed: "Завершена",
  cancelled: "Отменена",
  missing: "Нет",
};

function renderQrBlock(card: ApiTechnicalCard): string {
  const svg = card.scan_qr_svg?.trim();
  if (svg) return svg;
  const url = card.scan_url?.trim();
  if (url) {
    return `<div class="pf-empty">QR: ${escapeHtml(url)}</div>`;
  }
  return `<div class="pf-empty">QR не сформирован</div>`;
}

function formatVolumeUnit(unit: string): string {
  return VOLUME_UNIT_LABEL[unit] ?? unit;
}

function unitLineSizeTypeLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return SIZE_TYPE_LABEL[value] ?? value;
}

function techCardModelLabel(card: {
  product_model_article: string | null;
  product_model_name: string | null;
}): string {
  return (
    [card.product_model_article, card.product_model_name].filter(Boolean).join(" · ") ||
    "—"
  );
}

function formatDesiredDate(value: string | null | undefined): string {
  if (!value?.trim()) return "—";
  const raw = value.trim();
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (dateOnly) {
    const [, y, m, d] = dateOnly;
    return `${d}.${m}.${y}`;
  }
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function techCardStatusLabel(status: string): string {
  return STATUS_LABEL[status] ?? status;
}

function formatDurationSeconds(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value) || value < 0) return "—";
  const total = Math.floor(value);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatMoney(value: string | number | null | undefined): string {
  if (value == null || value === "") return "—";
  const raw = String(value).trim();
  if (!raw) return "—";
  const num = Number(raw);
  if (!Number.isFinite(num)) return raw;
  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

function apiBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SPORT_LEADS_API_URL ??
    process.env.SPORT_LEADS_API_URL ??
    "http://127.0.0.1:8000"
  ).replace(/\/$/, "");
}

/** Resolve media URL for print HTML (mirrors order-tech-cards-api helper). */
function technicalCardMediaContentUrl(
  url: string | null | undefined,
): string | null {
  if (!url?.trim()) return null;
  const value = url.trim();
  if (
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("blob:")
  ) {
    return value;
  }
  if (
    value.startsWith("/technical-cards/") &&
    value.includes("/media/") &&
    value.includes("/content")
  ) {
    return `${apiBaseUrl()}${value}`;
  }
  if (value.startsWith("/")) return value;
  return `/${value.replace(/^\.\//, "")}`;
}

function productModelImageUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  const value = url.trim();
  if (
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("blob:")
  ) {
    return value;
  }
  if (
    value.startsWith("/product-models/") &&
    (value.includes("/cover/") || value.includes("/media/"))
  ) {
    return `${apiBaseUrl()}${value}`;
  }
  if (value.startsWith("/")) return value;
  return `/${value.replace(/^\.\//, "")}`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttr(value: string): string {
  return escapeHtml(value).replaceAll("`", "&#96;");
}

function textValue(value: string | number | null | undefined, fallback = "—"): string {
  if (value == null) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function sizeMatrix(card: ApiTechnicalCard) {
  const sizeOrder: string[] = [];
  const seenSizes = new Set<string>();
  const rows = new Map<
    string,
    { sizeType: string; values: Map<string, number>; total: number }
  >();

  for (const line of card.unit_lines) {
    const size = textValue(line.size, "—");
    if (!seenSizes.has(size)) {
      seenSizes.add(size);
      sizeOrder.push(size);
    }
    const sizeType = unitLineSizeTypeLabel(line.size_type);
    if (!rows.has(sizeType)) {
      rows.set(sizeType, { sizeType, values: new Map(), total: 0 });
    }
    const row = rows.get(sizeType)!;
    row.values.set(size, (row.values.get(size) ?? 0) + 1);
    row.total += 1;
  }

  const matrixRows = Array.from(rows.values()).map((row) => ({
    size_type: row.sizeType,
    cells: sizeOrder.map((size) => row.values.get(size) ?? 0),
    total: row.total,
  }));

  return {
    columns: sizeOrder,
    rows: matrixRows,
    total_units: card.unit_lines.length,
  };
}

function renderSizeMatrixTable(card: ApiTechnicalCard): string {
  const matrix = sizeMatrix(card);
  if (matrix.columns.length === 0 || matrix.rows.length === 0) {
    return '<div class="pf-empty">Поштучные размеры не заполнены.</div>';
  }
  const header = matrix.columns
    .map((size) => `<th>${escapeHtml(size)}</th>`)
    .join("");
  const rows = matrix.rows
    .map(
      (row) =>
        `<tr><th>${escapeHtml(row.size_type)}</th>${row.cells
          .map((value) => `<td>${value}</td>`)
          .join("")}<td>${row.total}</td></tr>`,
    )
    .join("");
  return `<table class="pf-table"><thead><tr><th>Тип</th>${header}<th>Итого</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function renderUnitLinesTable(card: ApiTechnicalCard): string {
  const lines = [...(card.unit_lines ?? [])].sort(
    (a, b) => a.unit_index - b.unit_index,
  );
  if (lines.length === 0) {
    return '<div class="pf-empty">Поштучные строки не заполнены.</div>';
  }
  const rows = lines
    .map(
      (line) =>
        `<tr><td>${line.unit_index}</td><td>${escapeHtml(
          unitLineSizeTypeLabel(line.size_type),
        )}</td><td>${escapeHtml(textValue(line.size))}</td><td>${escapeHtml(
          textValue(line.personalization),
        )}</td><td>${escapeHtml(textValue(line.print_number))}</td><td>${escapeHtml(
          textValue(line.notes),
        )}</td></tr>`,
    )
    .join("");
  return `<table class="pf-table pf-table--unit-lines"><thead><tr><th>#</th><th>Тип размера</th><th>Размер</th><th>Фамилия</th><th>Номер</th><th>Примечание</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function renderPoshtuchnoBlock(card: ApiTechnicalCard): string {
  const matrix = renderSizeMatrixTable(card);
  const unitLines = renderUnitLinesTable(card);
  return `<div class="pf-poshtuchno">${unitLines}<div class="pf-poshtuchno__matrix"><div class="pf-subtitle pf-subtitle--nested">Сводка по размерам</div>${matrix}</div></div>`;
}

function primaryMockupUrl(card: ApiTechnicalCard): string | null {
  if (card.design_mockup_url?.trim()) {
    return card.design_mockup_url.trim();
  }
  const primary =
    card.media_items?.find((item) => item.is_primary) ?? card.media_items?.[0] ?? null;
  return technicalCardMediaContentUrl(primary?.content_url);
}

function renderMockupBlock(card: ApiTechnicalCard): string {
  const url = primaryMockupUrl(card);
  if (!url) {
    return '<div class="pf-empty pf-mockup-empty">Макет не прикреплён.</div>';
  }
  return `<div class="pf-mockup"><img src="${escapeAttr(url)}" alt="Макет ${escapeAttr(
    card.number,
  )}" /></div>`;
}

function modelCoverUrl(card: ApiTechnicalCard): string | null {
  return productModelImageUrl(card.product_model_cover_image_url);
}

function renderModelPhotoBlock(card: ApiTechnicalCard): string {
  const url = modelCoverUrl(card);
  if (!url) {
    return '<div class="pf-empty pf-model-photo-empty">Фото модели не задано.</div>';
  }
  return `<div class="pf-model-photo"><img src="${escapeAttr(url)}" alt="Модель ${escapeAttr(
    techCardModelLabel(card),
  )}" /></div>`;
}

function materialLines(card: ApiTechnicalCard): ApiTechnicalCardCompositionLine[] {
  return (card.composition_lines ?? []).filter((line) => line.line_kind === "material");
}

function renderMaterialsTable(card: ApiTechnicalCard): string {
  const lines = materialLines(card);
  if (lines.length === 0) {
    return '<div class="pf-empty">Материалы не заполнены.</div>';
  }
  const rows = lines
    .map((line) => {
      const planned = textValue(line.planned_qty);
      const fact = textValue(line.fact_qty);
      const unit = textValue(line.unit);
      const stage = line.production_stage_id == null ? "—" : `#${line.production_stage_id}`;
      const notes = textValue(line.notes);
      return `<tr><td>${line.sequence}</td><td>${escapeHtml(
        textValue(line.snapshot_name),
      )}</td><td>${escapeHtml(planned)}</td><td>${escapeHtml(fact)}</td><td>${escapeHtml(
        unit,
      )}</td><td>${escapeHtml(stage)}</td><td>${escapeHtml(notes)}</td></tr>`;
    })
    .join("");
  return `<table class="pf-table"><thead><tr><th>#</th><th>Материал</th><th>План</th><th>Факт</th><th>Ед.</th><th>Этап</th><th>Примечание</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function renderCompositionNotes(card: ApiTechnicalCard): string {
  const notes = (card.composition_lines ?? []).filter((line) => line.line_kind !== "material");
  if (notes.length === 0) {
    return "";
  }
  const items = notes
    .map(
      (line) =>
        `<li><strong>${line.sequence}. ${escapeHtml(
          textValue(line.snapshot_name),
        )}</strong>${line.notes?.trim() ? ` — ${escapeHtml(line.notes.trim())}` : ""}</li>`,
    )
    .join("");
  return `<div class="pf-notes"><div class="pf-subtitle">Прочие строки состава</div><ul>${items}</ul></div>`;
}

function operationRows(card: ApiTechnicalCard): ApiTechnicalCardOperationLine[] {
  return (card.operation_lines ?? []).filter(
    (line) => String(line.source_kind ?? "routing") !== "sewing",
  );
}

function renderOperationsTable(card: ApiTechnicalCard): string {
  const lines = operationRows(card);
  if (lines.length === 0) {
    return '<div class="pf-empty">Операции не заполнены.</div>';
  }
  const rows = lines
    .map(
      (line) =>
        `<tr><td>${line.sequence}</td><td>${escapeHtml(
          textValue(line.operation_name),
        )}</td><td>${escapeHtml(textValue(line.stage_label))}</td><td>${escapeHtml(
          textValue(line.volume),
        )}</td><td>${escapeHtml(formatVolumeUnit(textValue(line.volume_unit, "")))}</td><td>${escapeHtml(
          textValue(line.source_kind),
        )}</td></tr>`,
    )
    .join("");
  return `<table class="pf-table"><thead><tr><th>#</th><th>Операция</th><th>Этап</th><th>Объём</th><th>Ед.</th><th>Источник</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function assemblySewingRows(card: ApiTechnicalCard): ApiTechnicalCardAssemblySewingOp[] {
  return card.assembly_sewing_operations ?? [];
}

function renderAssemblySchemeBlock(card: ApiTechnicalCard): string {
  const variantName = textValue(card.assembly_variant_name);
  const totalCost = formatMoney(card.assembly_variant_total_cost);
  const lines = assemblySewingRows(card);
  const meta = `<div class="pf-meta pf-meta--compact">
    <div><span class="pf-label">Вариант</span><span>${escapeHtml(variantName)}</span></div>
    <div><span class="pf-label">Стоимость</span><span>${escapeHtml(totalCost)}</span></div>
  </div>`;
  if (lines.length === 0) {
    return `${meta}<div class="pf-empty">Швейные операции сборки не заполнены.</div>`;
  }
  const rows = lines
    .map(
      (line) =>
        `<tr><td>${line.sequence}</td><td>${escapeHtml(
          textValue(line.operation_name),
        )}</td><td>${line.quantity_per_item ?? 1}</td><td>${escapeHtml(
          formatDurationSeconds(line.duration_seconds),
        )}</td><td>${escapeHtml(formatMoney(line.cost))}</td><td>${escapeHtml(
          formatMoney(line.line_total),
        )}</td></tr>`,
    )
    .join("");
  return `${meta}<table class="pf-table"><thead><tr><th>#</th><th>Операция</th><th>Кол-во</th><th>Время</th><th>Стоимость</th><th>Итого</th></tr></thead><tbody>${rows}</tbody></table>`;
}

export const TECH_CARD_PRINT_TEMPLATE_SOURCE = `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <title>{{ document_number }}</title>
  <style>
    @page { size: A4 landscape; margin: 8mm; }
    * { box-sizing: border-box; }
    html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { margin: 0; font-family: Arial, sans-serif; color: #111827; }
    .pf-sheet {
      min-height: 194mm;
      page-break-after: always;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .pf-sheet:last-child { page-break-after: auto; }
    .pf-head { display: flex; justify-content: space-between; gap: 10px; align-items: flex-start; }
    .pf-qr { width: 96px; height: 96px; flex: 0 0 96px; }
    .pf-qr svg { width: 96px; height: 96px; display: block; }
    .pf-title { font-size: 22px; font-weight: 700; margin: 0 0 4px; }
    .pf-meta { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px 14px; font-size: 12px; }
    .pf-meta--compact { grid-template-columns: repeat(2, minmax(0, 1fr)); margin-bottom: 8px; }
    .pf-meta div { display: flex; gap: 6px; }
    .pf-label { color: #6b7280; min-width: 92px; }
    .pf-block { border: 1px solid #d1d5db; border-radius: 10px; padding: 8px 10px; overflow: visible; }
    .pf-block--fill { display: flex; flex-direction: column; min-height: 70mm; }
    .pf-subtitle { font-size: 14px; font-weight: 700; margin-bottom: 8px; }
    .pf-subtitle--nested { font-size: 12px; margin-top: 10px; margin-bottom: 6px; }
    .pf-row-split {
      display: grid;
      grid-template-columns: 3fr 7fr;
      gap: 10px;
      align-items: stretch;
    }
    .pf-mockup,
    .pf-model-photo {
      flex: 1;
      min-height: 70mm;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f9fafb;
      border-radius: 8px;
      overflow: hidden;
    }
    .pf-mockup img,
    .pf-model-photo img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
      display: block;
    }
    .pf-empty {
      padding: 18px;
      text-align: center;
      color: #6b7280;
      background: #f9fafb;
      border-radius: 8px;
      font-size: 13px;
    }
    .pf-model-layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 140px;
      gap: 12px;
      align-items: start;
    }
    .pf-grid-2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
    .pf-table { width: 100%; border-collapse: collapse; font-size: 11px; }
    .pf-table--unit-lines { font-size: 10px; }
    .pf-table th, .pf-table td { border: 1px solid #d1d5db; padding: 4px 6px; vertical-align: top; text-align: left; }
    .pf-table th { background: #f3f4f6; font-weight: 700; }
    .pf-poshtuchno { display: flex; flex-direction: column; gap: 4px; }
    .pf-text { margin: 0; font-size: 12px; line-height: 1.45; white-space: pre-wrap; }
    .pf-notes ul { margin: 8px 0 0; padding-left: 18px; font-size: 12px; }
  </style>
</head>
<body>
  <section class="pf-sheet">
    <div class="pf-head">
      <div>
        <h1 class="pf-title">Техкарта</h1>
        <div class="pf-text">{{ document_number }}</div>
      </div>
      <div class="pf-qr">{{ html.qr_block }}</div>
      <div class="pf-text">{{ header.status_label }}</div>
    </div>
    <div class="pf-block">
      <div class="pf-subtitle">Информация о заказе</div>
      <div class="pf-meta">
        <div><span class="pf-label">Заказ</span><span>{{ header.order_number }}</span></div>
        <div><span class="pf-label">Техкарта</span><span>{{ header.card_number }}</span></div>
        <div><span class="pf-label">Клиент</span><span>{{ header.client_name }}</span></div>
        <div><span class="pf-label">Ответственный</span><span>{{ header.responsible_name }}</span></div>
        <div><span class="pf-label">Количество</span><span>{{ header.quantity }}</span></div>
        <div><span class="pf-label">Дата отгрузки</span><span>{{ header.desired_date }}</span></div>
        <div><span class="pf-label">Текущий этап</span><span>{{ header.current_stage_label }}</span></div>
        <div><span class="pf-label">Позиция</span><span>{{ model.nomenclature_name }}</span></div>
      </div>
    </div>
    <div class="pf-row-split">
      <div class="pf-block pf-block--fill">
        <div class="pf-subtitle">Макет</div>
        {{ html.mockup_block }}
      </div>
      <div class="pf-block pf-block--fill">
        <div class="pf-subtitle">Поштучно</div>
        {{ html.poshtuchno_block }}
      </div>
    </div>
  </section>
  <section class="pf-sheet">
    <div class="pf-block">
      <div class="pf-subtitle">Номенклатура и модель</div>
      <div class="pf-model-layout">
        <div class="pf-grid-2">
          <div class="pf-text">Номенклатура: {{ model.nomenclature_name }}</div>
          <div class="pf-text">Модель: {{ model.product_model_label }}</div>
          <div class="pf-text">Тип размера: {{ model.product_model_size_type }}</div>
          <div class="pf-text">Количество: {{ header.quantity }}</div>
        </div>
        {{ html.model_photo_block }}
      </div>
    </div>
    <div class="pf-block">
      <div class="pf-subtitle">Схема сборки изделия</div>
      {{ html.assembly_scheme_block }}
    </div>
    <div class="pf-block">
      <div class="pf-subtitle">Материалы</div>
      {{ html.materials_table }}
      {{ html.composition_notes_block }}
    </div>
    <div class="pf-block">
      <div class="pf-subtitle">Операции / объёмы</div>
      {{ html.operation_volumes_table }}
    </div>
  </section>
</body>
</html>`;

export function buildTechnicalCardPrintRequest(
  card: ApiTechnicalCard,
  outputFormat: "html" | "pdf" = "html",
): TechnicalCardPrintRequest {
  const matrix = sizeMatrix(card);
  const mockupUrl = primaryMockupUrl(card);
  const modelPhotoUrl = modelCoverUrl(card);
  const materials = materialLines(card).map((line) => ({
    sequence: line.sequence,
    snapshot_name: line.snapshot_name,
    planned_qty: line.planned_qty == null ? null : String(line.planned_qty),
    fact_qty: line.fact_qty == null ? null : String(line.fact_qty),
    unit: line.unit,
    production_stage_id: line.production_stage_id ?? null,
    notes: line.notes,
  }));
  const operations = operationRows(card).map((line) => ({
    sequence: line.sequence,
    operation_name: line.operation_name,
    stage_label: line.stage_label,
    volume: String(line.volume),
    volume_unit: line.volume_unit,
    volume_unit_label: formatVolumeUnit(String(line.volume_unit)),
    source_kind: line.source_kind ?? "routing",
  }));
  const assemblyOps = assemblySewingRows(card).map((line) => ({
    sequence: line.sequence,
    operation_name: line.operation_name,
    quantity_per_item: line.quantity_per_item ?? 1,
    duration_seconds: line.duration_seconds,
    duration_label: formatDurationSeconds(line.duration_seconds),
    cost: line.cost == null ? null : String(line.cost),
    line_total: line.line_total == null ? null : String(line.line_total),
    sewing_operation_id: line.sewing_operation_id ?? null,
  }));

  return {
    binding_type: "model",
    binding_key: "technical_card",
    output_format: outputFormat,
    payload: {
      document_kind: "technical_card",
      document_id: card.id,
      document_number: card.number,
      issued_at: card.updated_at,
      header: {
        order_number: textValue(card.order_number),
        card_number: textValue(card.number),
        client_name: textValue(card.client_name),
        responsible_name: textValue(card.responsible_name),
        desired_date: formatDesiredDate(card.desired_date),
        quantity: textValue(card.quantity),
        current_stage_label: textValue(card.current_stage_label),
        status: card.status,
        status_label: techCardStatusLabel(String(card.status)),
      },
      model: {
        nomenclature_name: textValue(card.nomenclature_name),
        product_model_label: techCardModelLabel(card),
        product_model_size_type: unitLineSizeTypeLabel(card.product_model_size_type),
        product_model_cover_image_url: modelPhotoUrl,
        assembly_variant_name: textValue(card.assembly_variant_name),
        assembly_variant_total_cost:
          card.assembly_variant_total_cost == null
            ? null
            : String(card.assembly_variant_total_cost),
      },
      mockup: {
        url: mockupUrl,
      },
      size_matrix: matrix,
      unit_lines: [...(card.unit_lines ?? [])]
        .sort((a, b) => a.unit_index - b.unit_index)
        .map((line) => ({
          unit_index: line.unit_index,
          size_type: unitLineSizeTypeLabel(line.size_type),
          size: textValue(line.size),
          personalization: textValue(line.personalization),
          print_number: textValue(line.print_number),
          notes: textValue(line.notes),
        })),
      materials,
      operation_volumes: operations,
      assembly_scheme: {
        variant_name: textValue(card.assembly_variant_name),
        total_cost:
          card.assembly_variant_total_cost == null
            ? null
            : String(card.assembly_variant_total_cost),
        operations: assemblyOps,
      },
      html: {
        mockup_block: renderMockupBlock(card),
        size_matrix_table: renderSizeMatrixTable(card),
        unit_lines_table: renderUnitLinesTable(card),
        poshtuchno_block: renderPoshtuchnoBlock(card),
        model_photo_block: renderModelPhotoBlock(card),
        assembly_scheme_block: renderAssemblySchemeBlock(card),
        materials_table: renderMaterialsTable(card),
        operation_volumes_table: renderOperationsTable(card),
        composition_notes_block: renderCompositionNotes(card),
        qr_block: renderQrBlock(card),
      },
    },
  };
}
