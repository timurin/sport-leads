from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class ClientHistoryItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: Literal["lead", "order"]
    id: int
    occurred_at: datetime
    title: str
    status: str
    amount: Decimal | None = None
    sport: str | None = None
    source: str | None = None


class ClientHistoryRead(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[ClientHistoryItem] = Field(default_factory=list)
    total: int = 0
