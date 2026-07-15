from datetime import date, datetime

from sqlalchemy import Date, DateTime, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base

from sqlalchemy import (
    Date,
    DateTime,
    Integer,
    String,
    Text,
    func,
)

class SportEvent(Base):
    __tablename__ = "sport_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    sport: Mapped[str] = mapped_column(String(100), nullable=False)

    city: Mapped[str | None] = mapped_column(String(100))
    region: Mapped[str | None] = mapped_column(String(150))
    country: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        default="Россия",
    )

    start_date: Mapped[date | None] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date)

    organizer: Mapped[str | None] = mapped_column(String(255))
    phone: Mapped[str | None] = mapped_column(String(50))
    email: Mapped[str | None] = mapped_column(String(255))
    website: Mapped[str | None] = mapped_column(String(500))

    source_name: Mapped[str | None] = mapped_column(String(150))
    external_id: Mapped[str | None] = mapped_column(
        String(100),
        index=True,
    )

    source_document_url: Mapped[str | None] = mapped_column(
        String(1000),
    )
    source_url: Mapped[str | None] = mapped_column(
    String(1000),
    index=True,
)

    description: Mapped[str | None] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    deduplication_key: Mapped[str | None] = mapped_column(
        String(64),
        unique=True,
        index=True,
    )