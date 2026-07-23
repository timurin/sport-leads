"""Unique custom field definition names (case-insensitive).

Revision ID: b2c3d4e5f678
Revises: a1b2c3d4e567

Merges duplicate lower(name) rows onto the lowest id, then adds
unique index uq_custom_field_definitions_name_lower.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy import text

revision = "b2c3d4e5f678"
down_revision = "a1b2c3d4e567"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    duplicates = conn.execute(
        text(
            """
            SELECT lower(name) AS name_key, array_agg(id ORDER BY id) AS ids
            FROM custom_field_definitions
            GROUP BY lower(name)
            HAVING COUNT(*) > 1
            """
        )
    ).mappings().all()

    for row in duplicates:
        ids = list(row["ids"])
        keeper = ids[0]
        for dup_id in ids[1:]:
            # Prefer keeper row when both assigned to same nomenclature.
            conn.execute(
                text(
                    """
                    DELETE FROM nomenclature_field_values AS dup
                    WHERE dup.field_definition_id = :dup_id
                      AND EXISTS (
                        SELECT 1
                        FROM nomenclature_field_values AS keep
                        WHERE keep.nomenclature_id = dup.nomenclature_id
                          AND keep.field_definition_id = :keeper
                      )
                    """
                ),
                {"dup_id": dup_id, "keeper": keeper},
            )
            conn.execute(
                text(
                    """
                    UPDATE nomenclature_field_values
                    SET field_definition_id = :keeper
                    WHERE field_definition_id = :dup_id
                    """
                ),
                {"dup_id": dup_id, "keeper": keeper},
            )
            conn.execute(
                text(
                    """
                    DELETE FROM category_fields AS dup
                    WHERE dup.field_definition_id = :dup_id
                      AND EXISTS (
                        SELECT 1
                        FROM category_fields AS keep
                        WHERE keep.category_id = dup.category_id
                          AND keep.field_definition_id = :keeper
                      )
                    """
                ),
                {"dup_id": dup_id, "keeper": keeper},
            )
            conn.execute(
                text(
                    """
                    UPDATE category_fields
                    SET field_definition_id = :keeper
                    WHERE field_definition_id = :dup_id
                    """
                ),
                {"dup_id": dup_id, "keeper": keeper},
            )
            # Clear option FKs that would block delete of duplicate definition.
            conn.execute(
                text(
                    """
                    UPDATE nomenclature_field_values
                    SET option_id = NULL
                    WHERE option_id IN (
                      SELECT id FROM custom_field_options
                      WHERE field_definition_id = :dup_id
                    )
                    """
                ),
                {"dup_id": dup_id},
            )
            conn.execute(
                text(
                    """
                    UPDATE category_fields
                    SET default_option_id = NULL
                    WHERE default_option_id IN (
                      SELECT id FROM custom_field_options
                      WHERE field_definition_id = :dup_id
                    )
                    """
                ),
                {"dup_id": dup_id},
            )
            conn.execute(
                text(
                    """
                    DELETE FROM nomenclature_field_value_options
                    WHERE option_id IN (
                      SELECT id FROM custom_field_options
                      WHERE field_definition_id = :dup_id
                    )
                    """
                ),
                {"dup_id": dup_id},
            )
            conn.execute(
                text(
                    """
                    DELETE FROM category_field_default_options
                    WHERE option_id IN (
                      SELECT id FROM custom_field_options
                      WHERE field_definition_id = :dup_id
                    )
                    """
                ),
                {"dup_id": dup_id},
            )
            conn.execute(
                text(
                    "DELETE FROM custom_field_options WHERE field_definition_id = :dup_id"
                ),
                {"dup_id": dup_id},
            )
            conn.execute(
                text("DELETE FROM custom_field_definitions WHERE id = :dup_id"),
                {"dup_id": dup_id},
            )

    op.create_index(
        "uq_custom_field_definitions_name_lower",
        "custom_field_definitions",
        [sa.text("lower(name)")],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index(
        "uq_custom_field_definitions_name_lower",
        table_name="custom_field_definitions",
    )
