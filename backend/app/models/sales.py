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
    JSON,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
    text as sa_text,
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


class DesignApprovalStatus(str, Enum):
    NOT_REQUIRED = "not_required"
    PENDING = "pending"
    IN_REVIEW = "in_review"
    APPROVED = "approved"
    REJECTED = "rejected"


class OrderPaymentStatus(str, Enum):
    UNPAID = "unpaid"
    PARTIAL = "partial"
    PAID = "paid"


class MaterialReserveStatus(str, Enum):
    NOT_REQUIRED = "not_required"
    PENDING = "pending"
    RESERVED = "reserved"


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
    organization_id: Mapped[int | None] = mapped_column(
        ForeignKey("organizations.id", ondelete="SET NULL"), index=True
    )
    folder_id: Mapped[int | None] = mapped_column(
        ForeignKey("client_folders.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    inn: Mapped[str | None] = mapped_column(String(12), index=True)
    kpp: Mapped[str | None] = mapped_column(String(9))
    ogrn: Mapped[str | None] = mapped_column(String(15))
    legal_address: Mapped[str | None] = mapped_column(String(500))
    actual_address: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )


class ClientFolder(Base):
    """Navigation folder for the clients list (2.2.4)."""

    __tablename__ = "client_folders"
    __table_args__ = (
        CheckConstraint("sort_order >= 0", name="ck_client_folders_sort_order_nonnegative"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    parent_id: Mapped[int | None] = mapped_column(
        ForeignKey("client_folders.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )


class ClientBankAccount(Base):
    """Client settlement account (2.3.1)."""

    __tablename__ = "client_bank_accounts"
    __table_args__ = (
        CheckConstraint("sort_order >= 0", name="ck_client_bank_accounts_sort_order_nonnegative"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    client_id: Mapped[int] = mapped_column(
        ForeignKey("clients.id", ondelete="CASCADE"), nullable=False, index=True
    )
    bank_name: Mapped[str] = mapped_column(String(255), nullable=False)
    bik: Mapped[str] = mapped_column(String(9), nullable=False)
    account_number: Mapped[str] = mapped_column(String(20), nullable=False)
    corr_account: Mapped[str | None] = mapped_column(String(20))
    is_primary: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )


class ClientSegment(Base):
    """Free-form client segment tag (2.3.2)."""

    __tablename__ = "client_segments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    client_id: Mapped[int] = mapped_column(
        ForeignKey("clients.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(64), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
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
    ogrn: Mapped[str | None] = mapped_column(String(15), index=True)
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
            postgresql_where=sa_text("is_primary"),
            sqlite_where=sa_text("is_primary"),
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
    __table_args__ = (
        UniqueConstraint("lead_id", name="uq_sales_orders_lead_id"),
        CheckConstraint(
            "discount_percent IS NULL OR (discount_percent >= 0 AND discount_percent <= 100)",
            name="ck_sales_orders_discount_percent_range",
        ),
        CheckConstraint(
            "discount_amount >= 0",
            name="ck_sales_orders_discount_amount_nonnegative",
        ),
        CheckConstraint(
            "vat_amount >= 0",
            name="ck_sales_orders_vat_amount_nonnegative",
        ),
        CheckConstraint(
            "length(currency_code) = 3",
            name="ck_sales_orders_currency_code_iso4217_length",
        ),
        CheckConstraint(
            "paid_amount >= 0",
            name="ck_sales_orders_paid_amount_nonnegative",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    number: Mapped[str] = mapped_column(String(50), nullable=False, unique=True, index=True)
    lead_id: Mapped[int | None] = mapped_column(
        ForeignKey("leads.id", ondelete="RESTRICT"), nullable=True
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
    design_approval_status: Mapped[DesignApprovalStatus] = mapped_column(
        enum_type(DesignApprovalStatus, "design_approval_status"),
        nullable=False,
        default=DesignApprovalStatus.NOT_REQUIRED,
        server_default=sa_text("'not_required'"),
        index=True,
    )
    payment_status: Mapped[OrderPaymentStatus] = mapped_column(
        enum_type(OrderPaymentStatus, "order_payment_status"),
        nullable=False,
        default=OrderPaymentStatus.UNPAID,
        server_default=sa_text("'unpaid'"),
        index=True,
    )
    paid_amount: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), nullable=False, default=Decimal("0.00")
    )
    material_reserve_status: Mapped[MaterialReserveStatus] = mapped_column(
        enum_type(MaterialReserveStatus, "material_reserve_status"),
        nullable=False,
        default=MaterialReserveStatus.NOT_REQUIRED,
        server_default=sa_text("'not_required'"),
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
    discount_percent: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    discount_amount: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), nullable=False, default=Decimal("0.00")
    )
    vat_amount: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), nullable=False, default=Decimal("0.00")
    )
    currency_code: Mapped[str] = mapped_column(
        String(3), nullable=False, default="RUB", server_default=sa_text("'RUB'")
    )
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
    """Commercial order line with optional pattern-model / assembly snapshots (`3.2.5`).

    `variant_snapshots` = nomenclature characteristics (ADR-010).
    `assembly_operation_snapshots` = sewing package lines (ADR-014 / SL-ORDER-ITEM-MODEL-ASSEMBLY-v1).
    """

    __tablename__ = "sales_order_items"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_sales_order_items_quantity_positive"),
        CheckConstraint("unit_price >= 0", name="ck_sales_order_items_unit_price_nonnegative"),
        CheckConstraint(
            "discount_percent IS NULL OR (discount_percent >= 0 AND discount_percent <= 100)",
            name="ck_sales_order_items_discount_percent_range",
        ),
        CheckConstraint("discount_amount >= 0", name="ck_sales_order_items_discount_amount_nonnegative"),
        CheckConstraint("line_amount >= 0", name="ck_sales_order_items_line_amount_nonnegative"),
        CheckConstraint("vat_amount >= 0", name="ck_sales_order_items_vat_amount_nonnegative"),
        CheckConstraint(
            "product_model_size_type IS NULL OR product_model_size_type IN ('men', 'women', 'kids')",
            name="ck_sales_order_items_product_model_size_type",
        ),
        CheckConstraint(
            "assembly_variant_total_cost IS NULL OR assembly_variant_total_cost >= 0",
            name="ck_sales_order_items_assembly_variant_total_cost",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    order_id: Mapped[int] = mapped_column(
        ForeignKey("sales_orders.id", ondelete="CASCADE"), nullable=False, index=True
    )
    nomenclature_id: Mapped[int | None] = mapped_column(
        ForeignKey("nomenclatures.id", ondelete="SET NULL"), nullable=True, index=True
    )
    nomenclature_variant_id: Mapped[int | None] = mapped_column(
        ForeignKey("nomenclature_variants.id", ondelete="SET NULL"), nullable=True, index=True
    )
    product_model_id: Mapped[int | None] = mapped_column(
        ForeignKey("product_models.id", ondelete="SET NULL"), nullable=True, index=True
    )
    product_model_article: Mapped[str | None] = mapped_column(String(100), nullable=True)
    product_model_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    product_model_size_type: Mapped[str | None] = mapped_column(String(20), nullable=True)
    assembly_variant_id: Mapped[int | None] = mapped_column(
        ForeignKey("assembly_variants.id", ondelete="SET NULL"), nullable=True, index=True
    )
    assembly_variant_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    assembly_variant_total_cost: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    routing_template_id: Mapped[int | None] = mapped_column(
        ForeignKey("shop_routing_templates.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    routing_template_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    vat_rate_id: Mapped[int | None] = mapped_column(
        ForeignKey("vat_rates.id", ondelete="SET NULL"), nullable=True, index=True
    )
    vat_rate_percent: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    price_includes_vat: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    vat_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, default=Decimal("0.00"))
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    snapshot_name: Mapped[str] = mapped_column(String(255), nullable=False)
    size_range: Mapped[str | None] = mapped_column(String(255), nullable=True)
    personalization: Mapped[str | None] = mapped_column(String(500), nullable=True)
    color: Mapped[str | None] = mapped_column(String(100), nullable=True)
    unit: Mapped[str] = mapped_column(String(30), nullable=False, default="шт")
    quantity: Mapped[Decimal] = mapped_column(Numeric(14, 3), nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    discount_percent: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    discount_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    line_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
    order: Mapped[SalesOrder] = relationship(back_populates="items")
    variant_snapshots: Mapped[list["SalesOrderItemVariantSnapshot"]] = relationship(
        back_populates="order_item", cascade="all, delete-orphan", order_by="SalesOrderItemVariantSnapshot.id"
    )
    assembly_operation_snapshots: Mapped[list["SalesOrderItemAssemblyOperationSnapshot"]] = relationship(
        back_populates="order_item",
        cascade="all, delete-orphan",
        order_by="SalesOrderItemAssemblyOperationSnapshot.sequence, SalesOrderItemAssemblyOperationSnapshot.id",
    )


class SalesOrderItemVariantSnapshot(Base):
    __tablename__ = "sales_order_item_variant_snapshots"
    __table_args__ = (UniqueConstraint("order_item_id", "characteristic_id", name="uq_sales_order_item_variant_snapshot_characteristic"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    order_item_id: Mapped[int] = mapped_column(ForeignKey("sales_order_items.id", ondelete="CASCADE"), nullable=False, index=True)
    characteristic_id: Mapped[int] = mapped_column(Integer, nullable=False)
    characteristic_code: Mapped[str] = mapped_column(String(100), nullable=False)
    characteristic_name: Mapped[str] = mapped_column(String(255), nullable=False)
    option_id: Mapped[int] = mapped_column(Integer, nullable=False)
    option_code: Mapped[str] = mapped_column(String(100), nullable=False)
    option_label: Mapped[str] = mapped_column(String(255), nullable=False)
    order_item: Mapped[SalesOrderItem] = relationship(back_populates="variant_snapshots")


class SalesOrderItemAssemblyOperationSnapshot(Base):
    """Immutable copy of assembly-variant operation lines at order-item selection (`3.2.5`)."""

    __tablename__ = "sales_order_item_assembly_operation_snapshots"
    __table_args__ = (
        UniqueConstraint(
            "order_item_id",
            "sequence",
            name="uq_sales_order_item_assembly_op_snapshot_sequence",
        ),
        CheckConstraint(
            "sequence >= 1",
            name="ck_sales_order_item_assembly_op_snapshot_sequence",
        ),
        CheckConstraint(
            "cost >= 0",
            name="ck_sales_order_item_assembly_op_snapshot_cost",
        ),
        CheckConstraint(
            "quantity_per_item >= 1",
            name="ck_sales_order_item_assembly_op_snapshot_qty",
        ),
        CheckConstraint(
            "duration_seconds >= 0",
            name="ck_sales_order_item_assembly_op_snapshot_duration",
        ),
        Index("ix_soi_asm_op_snap_order_item_id", "order_item_id"),
        Index("ix_soi_asm_op_snap_sewing_op_id", "sewing_operation_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    order_item_id: Mapped[int] = mapped_column(
        ForeignKey("sales_order_items.id", ondelete="CASCADE"), nullable=False
    )
    sequence: Mapped[int] = mapped_column(Integer, nullable=False)
    operation_name: Mapped[str] = mapped_column(String(255), nullable=False)
    cost: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, default=Decimal("0"))
    quantity_per_item: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    duration_seconds: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    sewing_operation_id: Mapped[int | None] = mapped_column(
        ForeignKey("sewing_operations.id", ondelete="SET NULL"), nullable=True
    )
    order_item: Mapped[SalesOrderItem] = relationship(back_populates="assembly_operation_snapshots")


class LeadIngestReceipt(Base):
    """Idempotency record for CRM lead-source ingest (`1.4.3.2`)."""

    __tablename__ = "lead_ingest_receipts"
    __table_args__ = (
        UniqueConstraint(
            "adapter_type",
            "external_id",
            name="uq_lead_ingest_receipts_adapter_external",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    adapter_type: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    external_id: Mapped[str] = mapped_column(String(255), nullable=False)
    lead_id: Mapped[int] = mapped_column(
        ForeignKey("leads.id", ondelete="CASCADE"), nullable=False, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class LeadEvent(Base):
    __tablename__ = "lead_events"
    __table_args__ = (
        CheckConstraint(
            "lead_id IS NOT NULL OR order_id IS NOT NULL",
            name="ck_lead_events_lead_or_order",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    lead_id: Mapped[int | None] = mapped_column(
        ForeignKey("leads.id", ondelete="CASCADE"), nullable=True, index=True
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
    task_type: Mapped[str] = mapped_column(
        String(50), nullable=False, default="other", server_default="other"
    )
    priority: Mapped[str] = mapped_column(
        String(20), nullable=False, default="medium", server_default="medium"
    )
    description: Mapped[str | None] = mapped_column(Text)
    result: Mapped[str | None] = mapped_column(Text)
    status: Mapped[LeadTaskStatus] = mapped_column(
        enum_type(LeadTaskStatus, "lead_task_status"),
        nullable=False,
        default=LeadTaskStatus.OPEN,
        index=True,
    )
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    assigned_to_id: Mapped[int | None] = mapped_column(
        ForeignKey("sales_users.id", ondelete="SET NULL"), index=True
    )
    created_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("sales_users.id", ondelete="SET NULL")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class LeadNote(Base):
    __tablename__ = "lead_notes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    lead_id: Mapped[int] = mapped_column(
        ForeignKey("leads.id", ondelete="CASCADE"), nullable=False, index=True
    )
    body: Mapped[str] = mapped_column(Text, nullable=False)
    author_id: Mapped[int | None] = mapped_column(
        ForeignKey("sales_users.id", ondelete="SET NULL"), index=True
    )
    is_pinned: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    mentioned_user_ids: Mapped[list] = mapped_column(
        JSON, nullable=False, default=list, server_default=sa_text("'[]'")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )


class LeadMessage(Base):
    __tablename__ = "lead_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    lead_id: Mapped[int] = mapped_column(
        ForeignKey("leads.id", ondelete="CASCADE"), nullable=False, index=True
    )
    channel: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    direction: Mapped[str] = mapped_column(String(20), nullable=False, default="outgoing")
    text: Mapped[str] = mapped_column(Text, nullable=False, default="")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="sent")
    author_id: Mapped[int | None] = mapped_column(
        ForeignKey("sales_users.id", ondelete="SET NULL"), index=True
    )
    sender_name: Mapped[str | None] = mapped_column(String(255))
    recipient_name: Mapped[str | None] = mapped_column(String(255))
    external_id: Mapped[str | None] = mapped_column(String(255))
    attachments: Mapped[list] = mapped_column(
        JSON, nullable=False, default=list, server_default=sa_text("'[]'")
    )
    is_mock: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    sent_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
