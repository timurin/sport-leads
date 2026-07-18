from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from enum import Enum

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    Enum as SqlEnum,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class LeadStatus(str, Enum):
    NEW = "new"
    CONTACT = "contact"
    QUALIFICATION = "qualification"
    PROPOSAL = "proposal"
    WAITING = "waiting"
    COMPLETED = "completed"


class LeadResult(str, Enum):
    CONVERTED = "converted"
    REJECTED = "rejected"


class LeadCustomerType(str, Enum):
    PERSON = "person"
    SOLE_PROPRIETOR = "sole_proprietor"
    COMPANY = "company"


class SalesOrderStatus(str, Enum):
    NEW = "new"
    CONFIRMED = "confirmed"
    PRODUCTION = "production"
    READY = "ready"
    SHIPPED = "shipped"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class LeadEventType(str, Enum):
    LEAD_CREATED = "lead_created"
    LEAD_STATUS_CHANGED = "lead_status_changed"
    LEAD_CONVERTED = "lead_converted"
    LEAD_REJECTED = "lead_rejected"
    ORDER_CREATED = "order_created"
    ORDER_STATUS_CHANGED = "order_status_changed"
    COMMENT_ADDED = "comment_added"
    TASK_CREATED = "task_created"
    TASK_COMPLETED = "task_completed"


class LeadTaskStatus(str, Enum):
    OPEN = "open"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class LeadContactChannel(str, Enum):
    PHONE = "phone"
    EMAIL = "email"
    TELEGRAM = "telegram"
    WHATSAPP = "whatsapp"
    VK = "vk"
    UNSPECIFIED = "unspecified"


def enum_type(enum_class: type[Enum], name: str) -> SqlEnum:
    return SqlEnum(
        enum_class,
        name=name,
        native_enum=False,
        values_callable=lambda items: [item.value for item in items],
    )


class SalesUser(Base):
    __tablename__ = "sales_users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class Client(Base):
    __tablename__ = "clients"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    company_name: Mapped[str | None] = mapped_column(String(255), index=True)
    contact_name: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(50), index=True)
    email: Mapped[str | None] = mapped_column(String(255), index=True)
    city: Mapped[str | None] = mapped_column(String(150))
    responsible_id: Mapped[int | None] = mapped_column(
        ForeignKey("sales_users.id", ondelete="SET NULL")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )


class LeadRejectionReason(Base):
    __tablename__ = "lead_rejection_reasons"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    requires_comment: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )


class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    legal_form: Mapped[str | None] = mapped_column(String(50))
    tax_id: Mapped[str | None] = mapped_column(String(12), unique=True, index=True)
    kpp: Mapped[str | None] = mapped_column(String(9))
    tax_system: Mapped[str | None] = mapped_column(String(100))
    director: Mapped[str | None] = mapped_column(String(255))
    legal_address: Mapped[str | None] = mapped_column(String(500))
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )


class LeadStage(Base):
    __tablename__ = "lead_stages"
    __table_args__ = (
        CheckConstraint("sort_order >= 0", name="ck_lead_stages_sort_order_nonnegative"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    title: Mapped[str] = mapped_column(String(100), nullable=False)
    accent_class: Mapped[str] = mapped_column(String(32), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, index=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, unique=True)
    is_system: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )


class Lead(Base):
    __tablename__ = "leads"
    __table_args__ = (
        CheckConstraint(
            "(status = 'completed' AND result IS NOT NULL) OR "
            "(status <> 'completed' AND result IS NULL)",
            name="ck_leads_completion_result",
        ),
        CheckConstraint(
            "(result = 'converted' AND converted_order_id IS NOT NULL "
            "AND rejection_reason_id IS NULL) OR "
            "(result = 'rejected' AND rejection_reason_id IS NOT NULL "
            "AND converted_order_id IS NULL) OR result IS NULL",
            name="ck_leads_result_reference",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    status: Mapped[str] = mapped_column(
        String(64), nullable=False, default=LeadStatus.NEW.value, index=True
    )
    result: Mapped[LeadResult | None] = mapped_column(
        enum_type(LeadResult, "lead_result"), index=True
    )
    customer_type: Mapped[LeadCustomerType | None] = mapped_column(
        enum_type(LeadCustomerType, "lead_customer_type")
    )
    company_name: Mapped[str | None] = mapped_column(String(255))
    tax_id: Mapped[str | None] = mapped_column(String(12))
    website: Mapped[str | None] = mapped_column(String(255))
    contact_name: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(50))
    email: Mapped[str | None] = mapped_column(String(255))
    city: Mapped[str | None] = mapped_column(String(150))
    region: Mapped[str | None] = mapped_column(String(150))
    address: Mapped[str | None] = mapped_column(String(500))
    customer_comment: Mapped[str | None] = mapped_column(Text)
    source: Mapped[str | None] = mapped_column(String(150), index=True)
    responsible_id: Mapped[int | None] = mapped_column(
        ForeignKey("sales_users.id", ondelete="SET NULL"), index=True
    )
    direction: Mapped[str | None] = mapped_column(String(150))
    sport: Mapped[str | None] = mapped_column(String(150))
    product_category: Mapped[str | None] = mapped_column(String(150))
    product_type: Mapped[str | None] = mapped_column(String(150))
    need_description: Mapped[str | None] = mapped_column(Text)
    estimated_quantity: Mapped[int | None] = mapped_column(Integer)
    kit_quantity: Mapped[int | None] = mapped_column(Integer)
    size_comment: Mapped[str | None] = mapped_column(Text)
    preliminary_budget: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    estimated_amount: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    discount_percent: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    probability: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    planned_order_date: Mapped[date | None] = mapped_column(Date)
    desired_date: Mapped[date | None] = mapped_column(Date)
    event_date: Mapped[date | None] = mapped_column(Date)
    delivery_city: Mapped[str | None] = mapped_column(String(150))
    delivery_address: Mapped[str | None] = mapped_column(String(500))
    delivery_method: Mapped[str | None] = mapped_column(String(150))
    delivery_comment: Mapped[str | None] = mapped_column(Text)
    campaign: Mapped[str | None] = mapped_column(String(255))
    utm_description: Mapped[str | None] = mapped_column(Text)
    priority: Mapped[str | None] = mapped_column(String(20))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("sales_users.id", ondelete="SET NULL")
    )
    converted_order_id: Mapped[int | None] = mapped_column(
        ForeignKey(
            "sales_orders.id",
            name="fk_leads_converted_order_id_sales_orders",
            ondelete="RESTRICT",
            use_alter=True,
        ),
        unique=True,
    )
    rejection_reason_id: Mapped[int | None] = mapped_column(
        ForeignKey("lead_rejection_reasons.id", ondelete="RESTRICT")
    )
    rejection_comment: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
    contacts: Mapped[list[LeadContact]] = relationship(
        back_populates="lead",
        cascade="all, delete-orphan",
        order_by=lambda: (LeadContact.is_primary.desc(), LeadContact.id),
    )


class LeadContact(Base):
    __tablename__ = "lead_contacts"
    __table_args__ = (
        Index(
            "uq_lead_contacts_primary_per_lead",
            "lead_id",
            unique=True,
            postgresql_where=text("is_primary"),
            sqlite_where=text("is_primary"),
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    lead_id: Mapped[int] = mapped_column(
        ForeignKey("leads.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    position: Mapped[str | None] = mapped_column(String(255))
    phone: Mapped[str | None] = mapped_column(String(50), index=True)
    email: Mapped[str | None] = mapped_column(String(255), index=True)
    preferred_channel: Mapped[LeadContactChannel] = mapped_column(
        enum_type(LeadContactChannel, "lead_contact_channel"),
        nullable=False,
        default=LeadContactChannel.UNSPECIFIED,
    )
    is_primary: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
    lead: Mapped[Lead] = relationship(back_populates="contacts")


class SalesOrder(Base):
    __tablename__ = "sales_orders"
    __table_args__ = (UniqueConstraint("lead_id", name="uq_sales_orders_lead_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    number: Mapped[str] = mapped_column(String(50), nullable=False, unique=True, index=True)
    lead_id: Mapped[int] = mapped_column(
        ForeignKey("leads.id", ondelete="RESTRICT"), nullable=False
    )
    client_id: Mapped[int] = mapped_column(
        ForeignKey("clients.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    organization_id: Mapped[int | None] = mapped_column(
        ForeignKey("organizations.id", ondelete="SET NULL"), index=True
    )
    status: Mapped[SalesOrderStatus] = mapped_column(
        enum_type(SalesOrderStatus, "sales_order_status"),
        nullable=False,
        default=SalesOrderStatus.NEW,
        index=True,
    )
    responsible_id: Mapped[int | None] = mapped_column(
        ForeignKey("sales_users.id", ondelete="SET NULL"), index=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    product_category: Mapped[str | None] = mapped_column(String(150))
    sport: Mapped[str | None] = mapped_column(String(150))
    quantity: Mapped[int | None] = mapped_column(Integer)
    amount: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    desired_date: Mapped[date | None] = mapped_column(Date)
    source: Mapped[str | None] = mapped_column(String(150), index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
    items: Mapped[list["SalesOrderItem"]] = relationship(
        back_populates="order",
        cascade="all, delete-orphan",
        order_by="SalesOrderItem.position, SalesOrderItem.id",
    )


class SalesOrderItem(Base):
    __tablename__ = "sales_order_items"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_sales_order_items_quantity_positive"),
        CheckConstraint("unit_price >= 0", name="ck_sales_order_items_unit_price_nonnegative"),
        CheckConstraint("line_amount >= 0", name="ck_sales_order_items_line_amount_nonnegative"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    order_id: Mapped[int] = mapped_column(
        ForeignKey("sales_orders.id", ondelete="CASCADE"), nullable=False, index=True
    )
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    snapshot_name: Mapped[str] = mapped_column(String(255), nullable=False)
    unit: Mapped[str] = mapped_column(String(30), nullable=False, default="шт")
    quantity: Mapped[Decimal] = mapped_column(Numeric(14, 3), nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    line_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
    order: Mapped[SalesOrder] = relationship(back_populates="items")


class LeadEvent(Base):
    __tablename__ = "lead_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    lead_id: Mapped[int] = mapped_column(
        ForeignKey("leads.id", ondelete="CASCADE"), nullable=False, index=True
    )
    order_id: Mapped[int | None] = mapped_column(
        ForeignKey("sales_orders.id", ondelete="CASCADE"), index=True
    )
    event_type: Mapped[LeadEventType] = mapped_column(
        enum_type(LeadEventType, "lead_event_type"), nullable=False, index=True
    )
    actor_id: Mapped[int | None] = mapped_column(
        ForeignKey("sales_users.id", ondelete="SET NULL")
    )
    message: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), index=True
    )


class LeadTask(Base):
    __tablename__ = "lead_tasks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    lead_id: Mapped[int] = mapped_column(
        ForeignKey("leads.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[LeadTaskStatus] = mapped_column(
        enum_type(LeadTaskStatus, "lead_task_status"),
        nullable=False,
        default=LeadTaskStatus.OPEN,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
