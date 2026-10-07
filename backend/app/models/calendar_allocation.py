"""Planned daily load for one assignment and one CapacityResource.

`resource_key` is the CapacityResource primary key. There is no numeric
capacity_resource_id. This is a plan, not shop fact, and the unit is the
resource unit stored on the row so later reads do not mix units.
"""
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, Integer, Numeric, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base

CAPACITY_UNITS = ("labor_hour", "machine_hour", "team_hour", "item", "linear_meter")


class CalendarAllocation(Base):
    __tablename__ = "calendar_allocations"
    __table_args__ = (
        UniqueConstraint(
            "assignment_id",
            "resource_key",
            "date",
            name="uq_calendar_allocation_assignment_resource_date",
        ),
        CheckConstraint("allocated_amount > 0", name="ck_calendar_allocation_amount"),
        CheckConstraint(
            "capacity_unit IN ('labor_hour', 'machine_hour', 'team_hour', 'item', 'linear_meter')",
            name="ck_calendar_allocation_unit",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    assignment_id: Mapped[int] = mapped_column(
        ForeignKey(
            "calendar_assignments.id",
            ondelete="CASCADE",
            name="fk_calendar_allocation_assignment",
        ),
        nullable=False,
        index=True,
    )
    resource_key: Mapped[str] = mapped_column(
        ForeignKey(
            "capacity_resources.resource_key",
            ondelete="RESTRICT",
            name="fk_calendar_allocation_resource",
        ),
        nullable=False,
    )
    date: Mapped[date] = mapped_column(Date, nullable=False)
    allocated_amount: Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False)
    capacity_unit: Mapped[str] = mapped_column(String(20), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
