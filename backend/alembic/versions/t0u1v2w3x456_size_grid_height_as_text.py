"""size grid height S/N/T as reference text

Revision ID: t0u1v2w3x456
Revises: s9t0u1v2w345
"""

import sqlalchemy as sa
from alembic import op


revision = "t0u1v2w3x456"
down_revision = "s9t0u1v2w345"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "size_grid_rows",
        sa.Column("height_s", sa.String(length=64), nullable=True),
    )
    op.add_column(
        "size_grid_rows",
        sa.Column("height_n", sa.String(length=64), nullable=True),
    )
    op.add_column(
        "size_grid_rows",
        sa.Column("height_t", sa.String(length=64), nullable=True),
    )

    # Collapse previous numeric pairs into Mosmade-style reference text (e.g. 158-164).
    op.execute(
        sa.text(
            """
            UPDATE size_grid_rows
            SET
              height_s = CASE
                WHEN height_s_min IS NOT NULL AND height_s_max IS NOT NULL
                  THEN trunc(height_s_min)::int::text || '-' || trunc(height_s_max)::int::text
                ELSE NULL
              END,
              height_n = CASE
                WHEN height_n_min IS NOT NULL AND height_n_max IS NOT NULL
                  THEN trunc(height_n_min)::int::text || '-' || trunc(height_n_max)::int::text
                ELSE NULL
              END,
              height_t = CASE
                WHEN height_t_min IS NOT NULL AND height_t_max IS NOT NULL
                  THEN trunc(height_t_min)::int::text || '-' || trunc(height_t_max)::int::text
                ELSE NULL
              END
            """
        )
    )

    op.drop_column("size_grid_rows", "height_s_min")
    op.drop_column("size_grid_rows", "height_s_max")
    op.drop_column("size_grid_rows", "height_n_min")
    op.drop_column("size_grid_rows", "height_n_max")
    op.drop_column("size_grid_rows", "height_t_min")
    op.drop_column("size_grid_rows", "height_t_max")


def downgrade() -> None:
    op.add_column(
        "size_grid_rows",
        sa.Column("height_s_min", sa.Numeric(precision=6, scale=1), nullable=True),
    )
    op.add_column(
        "size_grid_rows",
        sa.Column("height_s_max", sa.Numeric(precision=6, scale=1), nullable=True),
    )
    op.add_column(
        "size_grid_rows",
        sa.Column("height_n_min", sa.Numeric(precision=6, scale=1), nullable=True),
    )
    op.add_column(
        "size_grid_rows",
        sa.Column("height_n_max", sa.Numeric(precision=6, scale=1), nullable=True),
    )
    op.add_column(
        "size_grid_rows",
        sa.Column("height_t_min", sa.Numeric(precision=6, scale=1), nullable=True),
    )
    op.add_column(
        "size_grid_rows",
        sa.Column("height_t_max", sa.Numeric(precision=6, scale=1), nullable=True),
    )

    # Best-effort split "158-164" → min/max; leave null if format unexpected.
    op.execute(
        sa.text(
            """
            UPDATE size_grid_rows
            SET
              height_s_min = NULLIF(split_part(height_s, '-', 1), '')::numeric,
              height_s_max = NULLIF(split_part(height_s, '-', 2), '')::numeric,
              height_n_min = NULLIF(split_part(height_n, '-', 1), '')::numeric,
              height_n_max = NULLIF(split_part(height_n, '-', 2), '')::numeric,
              height_t_min = NULLIF(split_part(height_t, '-', 1), '')::numeric,
              height_t_max = NULLIF(split_part(height_t, '-', 2), '')::numeric
            WHERE height_s LIKE '%-%'
               OR height_n LIKE '%-%'
               OR height_t LIKE '%-%'
            """
        )
    )

    op.drop_column("size_grid_rows", "height_s")
    op.drop_column("size_grid_rows", "height_n")
    op.drop_column("size_grid_rows", "height_t")
