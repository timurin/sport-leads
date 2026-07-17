"""add lead conversion

Revision ID: 9c47a12e6b02
Revises: 3f0f4f14ef0f
Create Date: 2026-07-16 18:00:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "9c47a12e6b02"
down_revision: Union[str, Sequence[str], None] = "3f0f4f14ef0f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


lead_status = sa.Enum(
    "new", "contact", "qualification", "proposal", "waiting", "completed",
    name="lead_status", native_enum=False,
)
lead_result = sa.Enum("converted", "rejected", name="lead_result", native_enum=False)
order_status = sa.Enum(
    "new", "confirmed", "production", "ready", "shipped", "completed", "cancelled",
    name="sales_order_status", native_enum=False,
)
event_type = sa.Enum(
    "lead_created", "lead_status_changed", "lead_converted", "lead_rejected",
    "order_created", "comment_added", "task_created", "task_completed",
    name="lead_event_type", native_enum=False,
)
task_status = sa.Enum(
    "open", "completed", "cancelled", name="lead_task_status", native_enum=False
)


REJECTION_REASONS = [
    ("unreachable", "Не выходит на связь", "Клиент", False),
    ("changed_mind", "Передумал", "Клиент", False),
    ("no_budget", "Нет бюджета", "Клиент", False),
    ("postponed", "Отложил заказ", "Клиент", False),
    ("competitor", "Выбрал конкурента", "Клиент", True),
    ("high_price", "Высокая цена", "Цена и условия", False),
    ("bad_timing", "Не устроили сроки", "Цена и условия", False),
    ("bad_payment_terms", "Не устроили условия оплаты", "Цена и условия", False),
    ("bad_delivery", "Не устроила доставка", "Цена и условия", False),
    ("unsupported_product", "Не производим нужный товар", "Производство", False),
    ("small_run", "Недостаточный тираж", "Производство", False),
    ("impossible_deadline", "Невозможный срок", "Производство", False),
    ("technical_limit", "Нет технической возможности", "Производство", False),
    ("duplicate", "Дубликат", "Качество лида", False),
    ("spam", "Спам", "Качество лида", False),
    ("mistaken_request", "Ошибочное обращение", "Качество лида", False),
    ("not_target", "Нецелевой клиент", "Качество лида", False),
    ("other", "Другое", "Качество лида", True),
]


def upgrade() -> None:
    op.create_table(
        "sales_users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "clients",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("company_name", sa.String(length=255), nullable=True),
        sa.Column("contact_name", sa.String(length=255), nullable=False),
        sa.Column("phone", sa.String(length=50), nullable=True),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("city", sa.String(length=150), nullable=True),
        sa.Column("responsible_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["responsible_id"], ["sales_users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_clients_company_name"), "clients", ["company_name"])
    op.create_index(op.f("ix_clients_email"), "clients", ["email"])
    op.create_index(op.f("ix_clients_phone"), "clients", ["phone"])
    op.create_table(
        "lead_rejection_reasons",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("code", sa.String(length=100), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("category", sa.String(length=100), nullable=False),
        sa.Column("requires_comment", sa.Boolean(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code"),
    )
    op.create_table(
        "leads",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("status", lead_status, nullable=False),
        sa.Column("result", lead_result, nullable=True),
        sa.Column("company_name", sa.String(length=255), nullable=True),
        sa.Column("contact_name", sa.String(length=255), nullable=False),
        sa.Column("phone", sa.String(length=50), nullable=True),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("city", sa.String(length=150), nullable=True),
        sa.Column("source", sa.String(length=150), nullable=True),
        sa.Column("responsible_id", sa.Integer(), nullable=True),
        sa.Column("sport", sa.String(length=150), nullable=True),
        sa.Column("product_category", sa.String(length=150), nullable=True),
        sa.Column("need_description", sa.Text(), nullable=True),
        sa.Column("estimated_quantity", sa.Integer(), nullable=True),
        sa.Column("estimated_amount", sa.Numeric(precision=14, scale=2), nullable=True),
        sa.Column("desired_date", sa.Date(), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_by_id", sa.Integer(), nullable=True),
        sa.Column("converted_order_id", sa.Integer(), nullable=True),
        sa.Column("rejection_reason_id", sa.Integer(), nullable=True),
        sa.Column("rejection_comment", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint(
            "(status = 'completed' AND result IS NOT NULL) OR (status <> 'completed' AND result IS NULL)",
            name="ck_leads_completion_result",
        ),
        sa.CheckConstraint(
            "(result = 'converted' AND converted_order_id IS NOT NULL AND rejection_reason_id IS NULL) OR "
            "(result = 'rejected' AND rejection_reason_id IS NOT NULL AND converted_order_id IS NULL) OR result IS NULL",
            name="ck_leads_result_reference",
        ),
        sa.ForeignKeyConstraint(["completed_by_id"], ["sales_users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["rejection_reason_id"], ["lead_rejection_reasons.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["responsible_id"], ["sales_users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("converted_order_id"),
    )
    op.create_index(op.f("ix_leads_created_at"), "leads", ["created_at"])
    op.create_index(op.f("ix_leads_responsible_id"), "leads", ["responsible_id"])
    op.create_index(op.f("ix_leads_result"), "leads", ["result"])
    op.create_index(op.f("ix_leads_source"), "leads", ["source"])
    op.create_index(op.f("ix_leads_status"), "leads", ["status"])
    op.create_table(
        "sales_orders",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("number", sa.String(length=50), nullable=False),
        sa.Column("lead_id", sa.Integer(), nullable=False),
        sa.Column("client_id", sa.Integer(), nullable=False),
        sa.Column("status", order_status, nullable=False),
        sa.Column("responsible_id", sa.Integer(), nullable=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("product_category", sa.String(length=150), nullable=True),
        sa.Column("sport", sa.String(length=150), nullable=True),
        sa.Column("quantity", sa.Integer(), nullable=True),
        sa.Column("amount", sa.Numeric(precision=14, scale=2), nullable=True),
        sa.Column("desired_date", sa.Date(), nullable=True),
        sa.Column("source", sa.String(length=150), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["client_id"], ["clients.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["lead_id"], ["leads.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["responsible_id"], ["sales_users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("lead_id", name="uq_sales_orders_lead_id"),
    )
    op.create_index(op.f("ix_sales_orders_client_id"), "sales_orders", ["client_id"])
    op.create_index(op.f("ix_sales_orders_number"), "sales_orders", ["number"], unique=True)
    op.create_index(op.f("ix_sales_orders_responsible_id"), "sales_orders", ["responsible_id"])
    op.create_index(op.f("ix_sales_orders_source"), "sales_orders", ["source"])
    op.create_index(op.f("ix_sales_orders_status"), "sales_orders", ["status"])
    op.create_foreign_key(
        "fk_leads_converted_order_id_sales_orders",
        "leads",
        "sales_orders",
        ["converted_order_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_table(
        "lead_events",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("lead_id", sa.Integer(), nullable=False),
        sa.Column("order_id", sa.Integer(), nullable=True),
        sa.Column("event_type", event_type, nullable=False),
        sa.Column("actor_id", sa.Integer(), nullable=True),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["actor_id"], ["sales_users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["lead_id"], ["leads.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["order_id"], ["sales_orders.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_lead_events_created_at"), "lead_events", ["created_at"])
    op.create_index(op.f("ix_lead_events_event_type"), "lead_events", ["event_type"])
    op.create_index(op.f("ix_lead_events_lead_id"), "lead_events", ["lead_id"])
    op.create_index(op.f("ix_lead_events_order_id"), "lead_events", ["order_id"])
    op.create_table(
        "lead_tasks",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("lead_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("status", task_status, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["lead_id"], ["leads.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_lead_tasks_lead_id"), "lead_tasks", ["lead_id"])
    op.create_index(op.f("ix_lead_tasks_status"), "lead_tasks", ["status"])

    users = sa.table(
        "sales_users",
        sa.column("id", sa.Integer()),
        sa.column("name", sa.String()),
        sa.column("is_active", sa.Boolean()),
    )
    op.bulk_insert(users, [{"id": 1, "name": "System", "is_active": True}])
    op.execute(
        "SELECT setval(pg_get_serial_sequence('sales_users', 'id'), 1, true)"
    )
    reasons = sa.table(
        "lead_rejection_reasons",
        sa.column("code", sa.String()),
        sa.column("name", sa.String()),
        sa.column("category", sa.String()),
        sa.column("requires_comment", sa.Boolean()),
        sa.column("is_active", sa.Boolean()),
        sa.column("sort_order", sa.Integer()),
    )
    op.bulk_insert(
        reasons,
        [
            {
                "code": code,
                "name": name,
                "category": category,
                "requires_comment": requires_comment,
                "is_active": True,
                "sort_order": index * 10,
            }
            for index, (code, name, category, requires_comment) in enumerate(REJECTION_REASONS, 1)
        ],
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_lead_tasks_status"), table_name="lead_tasks")
    op.drop_index(op.f("ix_lead_tasks_lead_id"), table_name="lead_tasks")
    op.drop_table("lead_tasks")
    op.drop_index(op.f("ix_lead_events_order_id"), table_name="lead_events")
    op.drop_index(op.f("ix_lead_events_lead_id"), table_name="lead_events")
    op.drop_index(op.f("ix_lead_events_event_type"), table_name="lead_events")
    op.drop_index(op.f("ix_lead_events_created_at"), table_name="lead_events")
    op.drop_table("lead_events")
    op.drop_constraint("fk_leads_converted_order_id_sales_orders", "leads", type_="foreignkey")
    op.drop_index(op.f("ix_sales_orders_status"), table_name="sales_orders")
    op.drop_index(op.f("ix_sales_orders_source"), table_name="sales_orders")
    op.drop_index(op.f("ix_sales_orders_responsible_id"), table_name="sales_orders")
    op.drop_index(op.f("ix_sales_orders_number"), table_name="sales_orders")
    op.drop_index(op.f("ix_sales_orders_client_id"), table_name="sales_orders")
    op.drop_table("sales_orders")
    op.drop_index(op.f("ix_leads_status"), table_name="leads")
    op.drop_index(op.f("ix_leads_source"), table_name="leads")
    op.drop_index(op.f("ix_leads_result"), table_name="leads")
    op.drop_index(op.f("ix_leads_responsible_id"), table_name="leads")
    op.drop_index(op.f("ix_leads_created_at"), table_name="leads")
    op.drop_table("leads")
    op.drop_table("lead_rejection_reasons")
    op.drop_index(op.f("ix_clients_phone"), table_name="clients")
    op.drop_index(op.f("ix_clients_email"), table_name="clients")
    op.drop_index(op.f("ix_clients_company_name"), table_name="clients")
    op.drop_table("clients")
    op.drop_table("sales_users")
