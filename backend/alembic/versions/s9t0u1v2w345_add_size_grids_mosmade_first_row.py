"""add size grids and mosmade men first row

Revision ID: s9t0u1v2w345
Revises: r8s9t0u1v234
"""

import sqlalchemy as sa
from alembic import op


revision = "s9t0u1v2w345"
down_revision = "r8s9t0u1v234"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "size_grids",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("size_type", sa.String(length=20), nullable=False),
        sa.Column("source_note", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "size_type IN ('men', 'women', 'kids')",
            name="ck_size_grids_size_type",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name", name="uq_size_grids_name"),
    )
    op.create_index("ix_size_grids_name", "size_grids", ["name"])
    op.create_index("ix_size_grids_size_type", "size_grids", ["size_type"])

    op.create_table(
        "size_grid_rows",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("size_grid_id", sa.Integer(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("ru_size", sa.String(length=32), nullable=False),
        sa.Column("int_label", sa.String(length=32), nullable=False),
        sa.Column("chest_min", sa.Numeric(precision=6, scale=1), nullable=False),
        sa.Column("chest_max", sa.Numeric(precision=6, scale=1), nullable=False),
        sa.Column("waist_min", sa.Numeric(precision=6, scale=1), nullable=False),
        sa.Column("waist_max", sa.Numeric(precision=6, scale=1), nullable=False),
        sa.Column("hip_min", sa.Numeric(precision=6, scale=1), nullable=False),
        sa.Column("hip_max", sa.Numeric(precision=6, scale=1), nullable=False),
        sa.Column("height_s_min", sa.Numeric(precision=6, scale=1), nullable=True),
        sa.Column("height_s_max", sa.Numeric(precision=6, scale=1), nullable=True),
        sa.Column("height_n_min", sa.Numeric(precision=6, scale=1), nullable=True),
        sa.Column("height_n_max", sa.Numeric(precision=6, scale=1), nullable=True),
        sa.Column("height_t_min", sa.Numeric(precision=6, scale=1), nullable=True),
        sa.Column("height_t_max", sa.Numeric(precision=6, scale=1), nullable=True),
        sa.CheckConstraint("sort_order >= 0", name="ck_size_grid_rows_sort_order"),
        sa.CheckConstraint("chest_min <= chest_max", name="ck_size_grid_rows_chest"),
        sa.CheckConstraint("waist_min <= waist_max", name="ck_size_grid_rows_waist"),
        sa.CheckConstraint("hip_min <= hip_max", name="ck_size_grid_rows_hip"),
        sa.ForeignKeyConstraint(
            ["size_grid_id"],
            ["size_grids.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "size_grid_id",
            "ru_size",
            "int_label",
            name="uq_size_grid_rows_grid_ru_int",
        ),
    )
    op.create_index(
        "ix_size_grid_rows_size_grid_id",
        "size_grid_rows",
        ["size_grid_id"],
    )

    conn = op.get_bind()
    grid_id = conn.execute(
        sa.text(
            """
            INSERT INTO size_grids (name, size_type, source_note)
            VALUES (:name, :size_type, :source_note)
            RETURNING id
            """
        ),
        {
            "name": "Мужская (Mosmade)",
            "size_type": "men",
            "source_note": "https://mosmade.ru/about/tablitsy-razmerov/",
        },
    ).scalar_one()
    conn.execute(
        sa.text(
            """
            INSERT INTO size_grid_rows (
                size_grid_id, sort_order, ru_size, int_label,
                chest_min, chest_max, waist_min, waist_max, hip_min, hip_max,
                height_s_min, height_s_max, height_n_min, height_n_max,
                height_t_min, height_t_max
            ) VALUES (
                :size_grid_id, 0, '46', 'S',
                92.0, 96.0, 80.0, 84.0, 96.0, 99.0,
                158.0, 164.0, 164.0, 170.0, 170.0, 176.0
            )
            """
        ),
        {"size_grid_id": grid_id},
    )


def downgrade() -> None:
    op.drop_index("ix_size_grid_rows_size_grid_id", table_name="size_grid_rows")
    op.drop_table("size_grid_rows")
    op.drop_index("ix_size_grids_size_type", table_name="size_grids")
    op.drop_index("ix_size_grids_name", table_name="size_grids")
    op.drop_table("size_grids")
