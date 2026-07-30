"""add warehouses directory with default seed Основной

Revision ID: y6z7a8b9c012
Revises: x5y6z7a8b901
"""

import sqlalchemy as sa
from alembic import op


revision = "y6z7a8b9c012"
down_revision = "x5y6z7a8b901"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "warehouses",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("code", sa.String(length=64), nullable=False),
        sa.Column(
            "is_active",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
        sa.Column(
            "is_default",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.UniqueConstraint("name", name="uq_warehouses_name"),
        sa.UniqueConstraint("code", name="uq_warehouses_code"),
    )
    op.create_index("ix_warehouses_name", "warehouses", ["name"])
    op.create_index("ix_warehouses_code", "warehouses", ["code"])
    op.create_index("ix_warehouses_is_active", "warehouses", ["is_active"])
    op.create_index("ix_warehouses_is_default", "warehouses", ["is_default"])

    warehouses = sa.table(
        "warehouses",
        sa.column("name", sa.String),
        sa.column("code", sa.String),
        sa.column("is_active", sa.Boolean),
        sa.column("is_default", sa.Boolean),
    )
    op.bulk_insert(
        warehouses,
        [
            {
                "name": "Основной",
                "code": "main",
                "is_active": True,
                "is_default": True,
            },
        ],
    )


def downgrade() -> None:
    op.drop_index("ix_warehouses_is_default", table_name="warehouses")
    op.drop_index("ix_warehouses_is_active", table_name="warehouses")
    op.drop_index("ix_warehouses_code", table_name="warehouses")
    op.drop_index("ix_warehouses_name", table_name="warehouses")
    op.drop_table("warehouses")
