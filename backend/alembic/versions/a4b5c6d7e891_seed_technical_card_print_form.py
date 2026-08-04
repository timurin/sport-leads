"""seed technical card print form

Revision ID: a4b5c6d7e891
Revises: z3a4b5c6d789
Create Date: 2026-08-02 14:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a4b5c6d7e891"
down_revision: Union[str, Sequence[str], None] = "z3a4b5c6d789"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


PRINT_FORM_CODE = "technical_card_a4_x2"
PRINT_FORM_TITLE = "Техкарта A4 ×2"
PRINT_FORM_DESCRIPTION = (
    "Печатная форма техкарты: сторона 1 — шапка, макет, размерная матрица; "
    "сторона 2 — номенклатура, материалы, операции/объёмы."
)
TEMPLATE_LABEL = "v1 A4 x2"
TEMPLATE_SOURCE = """<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <title>{{ document_number }}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Arial, sans-serif; color: #111827; }
    .pf-sheet { min-height: 273mm; page-break-after: always; display: flex; flex-direction: column; gap: 12px; }
    .pf-sheet:last-child { page-break-after: auto; }
    .pf-head { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
    .pf-title { font-size: 24px; font-weight: 700; margin: 0 0 6px; }
    .pf-meta { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px 16px; font-size: 12px; }
    .pf-meta div { display: flex; gap: 6px; }
    .pf-label { color: #6b7280; min-width: 92px; }
    .pf-block { border: 1px solid #d1d5db; border-radius: 10px; padding: 10px 12px; }
    .pf-subtitle { font-size: 14px; font-weight: 700; margin-bottom: 8px; }
    .pf-mockup { min-height: 120mm; display: flex; align-items: center; justify-content: center; background: #f9fafb; border-radius: 8px; overflow: hidden; }
    .pf-mockup img { max-width: 100%; max-height: 118mm; object-fit: contain; display: block; }
    .pf-empty { padding: 24px; text-align: center; color: #6b7280; background: #f9fafb; border-radius: 8px; font-size: 13px; }
    .pf-grid-2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    .pf-table { width: 100%; border-collapse: collapse; font-size: 12px; }
    .pf-table th, .pf-table td { border: 1px solid #d1d5db; padding: 6px 8px; vertical-align: top; text-align: left; }
    .pf-table th { background: #f3f4f6; font-weight: 700; }
    .pf-text { margin: 0; font-size: 12px; line-height: 1.45; white-space: pre-wrap; }
    .pf-notes ul { margin: 8px 0 0; padding-left: 18px; font-size: 12px; }
  </style>
</head>
<body>
  <section class="pf-sheet">
    <div class="pf-head">
      <div>
        <h1 class="pf-title">Техкарта A4×2</h1>
        <div class="pf-text">{{ document_number }}</div>
      </div>
      <div class="pf-text">{{ header.status_label }}</div>
    </div>
    <div class="pf-block">
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
    <div class="pf-block">
      <div class="pf-subtitle">Макет</div>
      {{ html.mockup_block }}
    </div>
    <div class="pf-block">
      <div class="pf-subtitle">Размерная матрица</div>
      {{ html.size_matrix_table }}
    </div>
  </section>
  <section class="pf-sheet">
    <div class="pf-block">
      <div class="pf-subtitle">Номенклатура и модель</div>
      <div class="pf-grid-2">
        <div class="pf-text">Номенклатура: {{ model.nomenclature_name }}</div>
        <div class="pf-text">Модель: {{ model.product_model_label }}</div>
        <div class="pf-text">Вариант сборки: {{ model.assembly_variant_name }}</div>
        <div class="pf-text">Тип размера: {{ model.product_model_size_type }}</div>
      </div>
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
    """Upgrade schema."""
    bind = op.get_bind()

    form_id = bind.execute(
        sa.text("SELECT id FROM print_forms WHERE code = :code"),
        {"code": PRINT_FORM_CODE},
    ).scalar()

    if form_id is None:
        form_id = bind.execute(
            sa.text(
                """
                INSERT INTO print_forms (
                    code,
                    title,
                    description,
                    binding_type,
                    binding_key,
                    status,
                    output_format,
                    versioning_mode
                )
                VALUES (
                    :code,
                    :title,
                    :description,
                    'model',
                    'technical_card',
                    'active',
                    'html',
                    'single_active'
                )
                RETURNING id
                """
            ),
            {
                "code": PRINT_FORM_CODE,
                "title": PRINT_FORM_TITLE,
                "description": PRINT_FORM_DESCRIPTION,
            },
        ).scalar_one()

    version_id = bind.execute(
        sa.text(
            """
            SELECT id
            FROM print_form_versions
            WHERE print_form_id = :print_form_id AND template_label = :template_label
            """
        ),
        {"print_form_id": form_id, "template_label": TEMPLATE_LABEL},
    ).scalar()

    if version_id is None:
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

    bind.execute(
        sa.text(
            """
            UPDATE print_forms
            SET
                binding_type = 'model',
                binding_key = 'technical_card',
                output_format = 'html',
                versioning_mode = 'single_active',
                status = 'active'
            WHERE id = :print_form_id
            """
        ),
        {"print_form_id": form_id},
    )


def downgrade() -> None:
    """Downgrade schema."""
    bind = op.get_bind()
    form_id = bind.execute(
        sa.text("SELECT id FROM print_forms WHERE code = :code"),
        {"code": PRINT_FORM_CODE},
    ).scalar()
    if form_id is None:
        return

    bind.execute(
        sa.text("DELETE FROM print_form_versions WHERE print_form_id = :print_form_id"),
        {"print_form_id": form_id},
    )
    bind.execute(
        sa.text("DELETE FROM print_forms WHERE id = :print_form_id"),
        {"print_form_id": form_id},
    )
