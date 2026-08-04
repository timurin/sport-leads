"""Stage executor access: PlatformUser ↔ ProductionStage (17.1.2.8)."""

from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import Column, ForeignKey, Table
from sqlalchemy.orm import Mapped, relationship

from app.database.base import Base

if TYPE_CHECKING:
    from app.models.auth import PlatformUser
    from app.models.production_stage import ProductionStage

platform_user_stage_access = Table(
    "platform_user_stage_access",
    Base.metadata,
    Column(
        "platform_user_id",
        ForeignKey("platform_users.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "production_stage_id",
        ForeignKey("production_stages.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)
