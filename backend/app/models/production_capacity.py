"""PC-03.7A: one shared resource store, operation links and dated exceptions."""
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Boolean, CheckConstraint, Date, DateTime, ForeignKey, Integer, JSON, Numeric, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, synonym

from app.database.base import Base


class CapacityResource(Base):
    __tablename__ = "capacity_resources"
    __table_args__ = (
        UniqueConstraint("work_center_id", name="uq_capacity_settings_work_center"),
        CheckConstraint("staff_count IS NULL OR (staff_count >= 0 AND staff_count <= 10000)", name="ck_capacity_settings_staff"),
        CheckConstraint("hours_per_day IS NULL OR (hours_per_day >= 0 AND hours_per_day <= 24)", name="ck_capacity_settings_hours"),
        CheckConstraint("resource_type IN ('labor', 'machine', 'throughput', 'milestone')", name="ck_capacity_resource_type"),
        CheckConstraint("base_rate IS NULL OR base_rate > 0", name="ck_capacity_resource_rate"),
        CheckConstraint("shifts_per_day >= 1 AND shifts_per_day <= 24", name="ck_capacity_resource_shifts"),
        CheckConstraint("efficiency >= 0 AND efficiency <= 1", name="ck_capacity_resource_efficiency"),
        CheckConstraint("hours_per_day IS NULL OR hours_per_day * shifts_per_day <= 24", name="ck_capacity_resource_daily_hours"),
        CheckConstraint("calculation_mode IN ('explicit_hours', 'rate', 'sewing_norm', 'cutting_methods', 'team_rate', 'milestone')", name="ck_capacity_resource_mode"),
        CheckConstraint("(resource_type = 'milestone' AND capacity_unit IS NULL AND calculation_mode = 'milestone' AND base_rate IS NULL AND staff_count IS NULL AND hours_per_day IS NULL AND work_center_id IS NULL) OR (resource_type = 'labor' AND work_center_id IS NULL AND calculation_mode <> 'milestone' AND (capacity_unit IN ('labor_hour', 'team_hour') OR (capacity_unit = 'item' AND calculation_mode = 'cutting_methods') OR (capacity_unit = 'item' AND calculation_mode = 'team_rate' AND base_rate > 0))) OR (resource_type = 'machine' AND staff_count IS NULL AND calculation_mode <> 'milestone' AND (capacity_unit = 'machine_hour' OR (capacity_unit IN ('linear_meter', 'item') AND calculation_mode = 'rate' AND base_rate > 0))) OR (resource_type = 'throughput' AND capacity_unit IN ('item', 'linear_meter') AND base_rate > 0 AND calculation_mode = 'rate' AND work_center_id IS NULL)", name="ck_capacity_resource_unit"),
    )

    resource_key: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str | None] = mapped_column(String(255))
    resource_type: Mapped[str] = mapped_column(String(20), default="labor", nullable=False)
    capacity_unit: Mapped[str | None] = mapped_column(String(20).evaluates_none(), default="labor_hour")
    base_rate: Mapped[Decimal | None] = mapped_column(Numeric(14, 4))
    shifts_per_day: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    efficiency: Mapped[Decimal] = mapped_column(Numeric(8, 4), default=Decimal("1"), nullable=False)
    include_in_calendar_load: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    calculation_mode: Mapped[str] = mapped_column(String(32), default="explicit_hours", nullable=False)
    norm_rates: Mapped[dict | None] = mapped_column(JSON)
    production_stage_id: Mapped[int | None] = mapped_column(ForeignKey("production_stages.id", ondelete="SET NULL"))
    work_center_id: Mapped[int | None] = mapped_column(ForeignKey("work_centers.id", ondelete="SET NULL"))
    staff_count: Mapped[int | None] = mapped_column(Integer)
    resource_count: Mapped[int | None] = synonym("staff_count")
    hours_per_day: Mapped[Decimal | None] = mapped_column(Numeric(8, 4))
    working_days: Mapped[list[int]] = mapped_column(JSON, nullable=False)
    note: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


# Import compatibility only: one ORM mapper and one physical storage.
ProductionCapacitySettings = CapacityResource


class TechOperationCapacityResource(Base):
    __tablename__ = "tech_operation_capacity_resources"
    tech_operation_id: Mapped[int] = mapped_column(ForeignKey("tech_operations.id", ondelete="CASCADE"), primary_key=True)
    resource_key: Mapped[str] = mapped_column(ForeignKey("capacity_resources.resource_key", ondelete="RESTRICT"), primary_key=True)


class ProductionCapacityException(Base):
    __tablename__ = "production_capacity_exceptions"
    __table_args__ = (
        CheckConstraint("capacity IS NULL OR capacity >= 0", name="ck_capacity_exception_capacity"),
        CheckConstraint("(unavailable AND capacity IS NULL) OR (NOT unavailable AND capacity IS NOT NULL)", name="ck_capacity_exception_mode"),
    )

    resource_key: Mapped[str] = mapped_column(ForeignKey("capacity_resources.resource_key", ondelete="CASCADE"), primary_key=True)
    date: Mapped[date] = mapped_column(Date, primary_key=True)
    capacity: Mapped[Decimal | None] = mapped_column(Numeric(14, 4))
    unavailable: Mapped[bool] = mapped_column(Boolean, nullable=False)
    note: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
