"""size grid chest/waist/hip as reference text

Revision ID: u1v2w3x4y567
Revises: t0u1v2w3x456
"""

import sqlalchemy as sa
from alembic import op


revision = "u1v2w3x4y567"
down_revision = "t0u1v2w3x456"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "size_grid_rows",
        sa.Column("chest", sa.String(length=64), nullable=True),
    )
    op.add_column(
        "size_grid_rows",
        sa.Column("waist", sa.String(length=64), nullable=True),
    )
    op.add_column(
        "size_grid_rows",
        sa.Column("hip", sa.String(length=64), nullable=True),
    )

    op.execute(
        sa.text(
            """
            UPDATE size_grid_rows
            SET
              chest = trunc(chest_min)::int::text || '-' || trunc(chest_max)::int::text,
              waist = trunc(waist_min)::int::text || '-' || trunc(waist_max)::int::text,
              hip = trunc(hip_min)::int::text || '-' || trunc(hip_max)::int::text
            """
        )
    )

    op.alter_column("size_grid_rows", "chest", nullable=False)
    op.alter_column("size_grid_rows", "waist", nullable=False)
    op.alter_column("size_grid_rows", "hip", nullable=False)

    op.drop_constraint("ck_size_grid_rows_chest", "size_grid_rows", type_="check")
    op.drop_constraint("ck_size_grid_rows_waist", "size_grid_rows", type_="check")
    op.drop_constraint("ck_size_grid_rows_hip", "size_grid_rows", type_="check")

    op.drop_column("size_grid_rows", "chest_min")
    op.drop_column("size_grid_rows", "chest_max")
    op.drop_column("size_grid_rows", "waist_min")
    op.drop_column("size_grid_rows", "waist_max")
    op.drop_column("size_grid_rows", "hip_min")
    op.drop_column("size_grid_rows", "hip_max")


def downgrade() -> None:
    op.add_column(
        "size_grid_rows",
        sa.Column("chest_min", sa.Numeric(precision=6, scale=1), nullable=True),
    )
    op.add_column(
        "size_grid_rows",
        sa.Column("chest_max", sa.Numeric(precision=6, scale=1), nullable=True),
    )
    op.add_column(
        "size_grid_rows",
        sa.Column("waist_min", sa.Numeric(precision=6, scale=1), nullable=True),
    )
    op.add_column(
        "size_grid_rows",
        sa.Column("waist_max", sa.Numeric(precision=6, scale=1), nullable=True),
    )
    op.add_column(
        "size_grid_rows",
        sa.Column("hip_min", sa.Numeric(precision=6, scale=1), nullable=True),
    )
    op.add_column(
        "size_grid_rows",
        sa.Column("hip_max", sa.Numeric(precision=6, scale=1), nullable=True),
    )

    op.execute(
        sa.text(
            """
            UPDATE size_grid_rows
            SET
              chest_min = NULLIF(split_part(chest, '-', 1), '')::numeric,
              chest_max = NULLIF(split_part(chest, '-', 2), '')::numeric,
              waist_min = NULLIF(split_part(waist, '-', 1), '')::numeric,
              waist_max = NULLIF(split_part(waist, '-', 2), '')::numeric,
              hip_min = NULLIF(split_part(hip, '-', 1), '')::numeric,
              hip_max = NULLIF(split_part(hip, '-', 2), '')::numeric
            """
        )
    )

    op.alter_column("size_grid_rows", "chest_min", nullable=False)
    op.alter_column("size_grid_rows", "chest_max", nullable=False)
    op.alter_column("size_grid_rows", "waist_min", nullable=False)
    op.alter_column("size_grid_rows", "waist_max", nullable=False)
    op.alter_column("size_grid_rows", "hip_min", nullable=False)
    op.alter_column("size_grid_rows", "hip_max", nullable=False)

    op.create_check_constraint(
        "ck_size_grid_rows_chest",
        "size_grid_rows",
        "chest_min <= chest_max",
    )
    op.create_check_constraint(
        "ck_size_grid_rows_waist",
        "size_grid_rows",
        "waist_min <= waist_max",
    )
    op.create_check_constraint(
        "ck_size_grid_rows_hip",
        "size_grid_rows",
        "hip_min <= hip_max",
    )

    op.drop_column("size_grid_rows", "chest")
    op.drop_column("size_grid_rows", "waist")
    op.drop_column("size_grid_rows", "hip")
