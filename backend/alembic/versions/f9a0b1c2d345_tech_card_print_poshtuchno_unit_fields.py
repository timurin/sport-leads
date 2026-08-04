"""tech card print poshtuchno unit-line fields

Revision ID: f9a0b1c2d345
Revises: e8f9a0b1c234
Create Date: 2026-08-03 16:30:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f9a0b1c2d345"
down_revision: Union[str, Sequence[str], None] = "e8f9a0b1c234"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


PRINT_FORM_CODE = "technical_card_a4_x2"
PRINT_FORM_DESCRIPTION = (
    "Печатная форма техкарты (A4 landscape ×2): "
    "стр.1 — заказ 100%, макет 30% + поштучно 70% (строки + сводка размеров); "
    "стр.2 — номенклатура/модель (+фото), схема сборки изделия, материалы, операции."
)
TEMPLATE_LABEL = "v3 poshtuchno unit fields"
TEMPLATE_SOURCE = """<!doctype html>
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
</html>"""


def upgrade() -> None:
    bind = op.get_bind()
    form_id = bind.execute(
        sa.text("SELECT id FROM print_forms WHERE code = :code"),
        {"code": PRINT_FORM_CODE},
    ).scalar()
    if form_id is None:
        return

    bind.execute(
        sa.text(
            """
            UPDATE print_forms
            SET description = :description
            WHERE id = :print_form_id
            """
        ),
        {"description": PRINT_FORM_DESCRIPTION, "print_form_id": form_id},
    )

    existing = bind.execute(
        sa.text(
            """
            SELECT id
            FROM print_form_versions
            WHERE print_form_id = :print_form_id AND template_label = :template_label
            """
        ),
        {"print_form_id": form_id, "template_label": TEMPLATE_LABEL},
    ).scalar()

    if existing is None:
        next_version_no = bind.execute(
            sa.text(
                """
                SELECT COALESCE(MAX(version_no), 0) + 1
                FROM print_form_versions
                WHERE print_form_id = :print_form_id
                """
            ),
            {"print_form_id": form_id},
        ).scalar_one()

        bind.execute(
            sa.text(
                """
                UPDATE print_form_versions
                SET is_current = false
                WHERE print_form_id = :print_form_id
                """
            ),
            {"print_form_id": form_id},
        )

        bind.execute(
            sa.text(
                """
                INSERT INTO print_form_versions (
                    print_form_id,
                    version_no,
                    template_label,
                    storage_kind,
                    template_source,
                    status,
                    is_current
                )
                VALUES (
                    :print_form_id,
                    :version_no,
                    :template_label,
                    'inline_text',
                    :template_source,
                    'published',
                    true
                )
                """
            ),
            {
                "print_form_id": form_id,
                "version_no": next_version_no,
                "template_label": TEMPLATE_LABEL,
                "template_source": TEMPLATE_SOURCE,
            },
        )
    else:
        bind.execute(
            sa.text(
                """
                UPDATE print_form_versions
                SET is_current = false
                WHERE print_form_id = :print_form_id
                """
            ),
            {"print_form_id": form_id},
        )
        bind.execute(
            sa.text(
                """
                UPDATE print_form_versions
                SET
                    template_source = :template_source,
                    status = 'published',
                    is_current = true
                WHERE id = :version_id
                """
            ),
            {"template_source": TEMPLATE_SOURCE, "version_id": existing},
        )


def downgrade() -> None:
    bind = op.get_bind()
    form_id = bind.execute(
        sa.text("SELECT id FROM print_forms WHERE code = :code"),
        {"code": PRINT_FORM_CODE},
    ).scalar()
    if form_id is None:
        return

    bind.execute(
        sa.text(
            """
            DELETE FROM print_form_versions
            WHERE print_form_id = :print_form_id AND template_label = :template_label
            """
        ),
        {"print_form_id": form_id, "template_label": TEMPLATE_LABEL},
    )

    previous = bind.execute(
        sa.text(
            """
            SELECT id
            FROM print_form_versions
            WHERE print_form_id = :print_form_id
            ORDER BY version_no DESC
            LIMIT 1
            """
        ),
        {"print_form_id": form_id},
    ).scalar()
    if previous is not None:
        bind.execute(
            sa.text(
                """
                UPDATE print_form_versions
                SET is_current = false
                WHERE print_form_id = :print_form_id
                """
            ),
            {"print_form_id": form_id},
        )
        bind.execute(
            sa.text(
                """
                UPDATE print_form_versions
                SET is_current = true, status = 'published'
                WHERE id = :version_id
                """
            ),
            {"version_id": previous},
        )
