"""add lead contacts

Revision ID: b6c4e2f91a07
Revises: 9c47a12e6b02
Create Date: 2026-07-17
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "b6c4e2f91a07"
down_revision: str | Sequence[str] | None = "9c47a12e6b02"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "lead_contacts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("lead_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("position", sa.String(length=255), nullable=True),
        sa.Column("phone", sa.String(length=50), nullable=True),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column(
            "preferred_channel",
            sa.Enum(
                "phone", "email", "telegram", "whatsapp", "vk", "unspecified",
                name="lead_contact_channel",
                native_enum=False,
            ),
            server_default="unspecified",
            nullable=False,
        ),
        sa.Column("is_primary", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(["lead_id"], ["leads.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_lead_contacts_lead_id"), "lead_contacts", ["lead_id"])
    op.create_index(op.f("ix_lead_contacts_phone"), "lead_contacts", ["phone"])
    op.create_index(op.f("ix_lead_contacts_email"), "lead_contacts", ["email"])
    op.create_index(
        "uq_lead_contacts_primary_per_lead",
        "lead_contacts",
        ["lead_id"],
        unique=True,
        postgresql_where=sa.text("is_primary"),
    )
    op.execute(
        sa.text(
            """
            INSERT INTO lead_contacts
                (lead_id, name, phone, email, preferred_channel, is_primary)
            SELECT id, contact_name, phone, email, 'unspecified', true
            FROM leads
            """
        )
    )


def downgrade() -> None:
    op.drop_index("uq_lead_contacts_primary_per_lead", table_name="lead_contacts")
    op.drop_index(op.f("ix_lead_contacts_email"), table_name="lead_contacts")
    op.drop_index(op.f("ix_lead_contacts_phone"), table_name="lead_contacts")
    op.drop_index(op.f("ix_lead_contacts_lead_id"), table_name="lead_contacts")
    op.drop_table("lead_contacts")
