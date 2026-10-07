"""PC-03.1 queue rows. PC-04.1 adds the route step and planning flags.

`manual_lock` is true exactly when `planning_mode` is not `auto`.
`manual_adjusted` and `locked` both refuse a future automatic move;
`planning_mode` records why. `auto` is the only mode a future scheduler may replace.

An unmapped row (`routing_stage_line_id` IS NULL) is the current entry queue,
not a guessed route step. Two partial unique indexes keep one unmapped row per
card and stage, and one row per card and route step.
"""
from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    false,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, synonym

from app.database.base import Base


class CalendarAssignment(Base):
    __tablename__ = "calendar_assignments"
    __table_args__ = (
        CheckConstraint("position >= 0", name="ck_calendar_assignment_position"),
        CheckConstraint("planned_end_date >= planned_date", name="ck_calendar_assignment_date_range"),
        CheckConstraint(
            "planning_mode IN ('auto', 'manual_adjusted', 'locked') "
            "AND manual_lock = (planning_mode <> 'auto')",
            name="ck_calendar_assignment_planning",
        ),
        Index(
            "uq_calendar_assignment_card_line",
            "technical_card_id",
            "routing_stage_line_id",
            unique=True,
            postgresql_where=text("routing_stage_line_id IS NOT NULL"),
            sqlite_where=text("routing_stage_line_id IS NOT NULL"),
        ),
        Index(
            "uq_calendar_assignment_card_stage_unmapped",
            "technical_card_id",
            "production_stage_id",
            unique=True,
            postgresql_where=text("routing_stage_line_id IS NULL"),
            sqlite_where=text("routing_stage_line_id IS NULL"),
        ),
        Index("ix_calendar_assignment_date_stage", "planned_date", "production_stage_id", "position"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    technical_card_id: Mapped[int] = mapped_column(ForeignKey("technical_cards.id", ondelete="CASCADE"))
    production_stage_id: Mapped[int] = mapped_column(ForeignKey("production_stages.id", ondelete="RESTRICT"))
    routing_stage_line_id: Mapped[int | None] = mapped_column(
        ForeignKey(
            "shop_routing_stage_lines.id",
            ondelete="RESTRICT",
            name="fk_calendar_assignment_route_step",
        ),
        nullable=True,
    )
    planned_date: Mapped[date] = mapped_column(Date)
    planned_start_date: Mapped[date] = synonym("planned_date")
    planned_end_date: Mapped[date] = mapped_column(
        Date, default=lambda context: context.get_current_parameters()["planned_date"]
    )
    position: Mapped[int] = mapped_column(Integer, default=0)
    planning_mode: Mapped[str] = mapped_column(
        String(20), nullable=False, default="auto", server_default="auto"
    )
    manual_lock: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=false()
    )
    note: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
