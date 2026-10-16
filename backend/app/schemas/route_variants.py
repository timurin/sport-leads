from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict
from app.schemas.routing_graph import RoutingVariantGroup
from app.schemas.production_schedule import ScheduleRead


class RouteVariantRead(BaseModel):
    group: RoutingVariantGroup
    selected_operation_snapshot_node_id: str | None = None
    selection_status: Literal["preliminary", "confirmed"] = "preliminary"
    selected_at: datetime | None = None
    selected_by: int | None = None
    confirmation_at: datetime | None = None
    confirmation_by: int | None = None


class RouteVariantSelectionWrite(BaseModel):
    model_config = ConfigDict(extra="forbid")
    selected_operation_snapshot_node_id: str
    selection_status: Literal["preliminary", "confirmed"] = "preliminary"
    replan: bool = True


class RouteVariantChangeRead(BaseModel):
    selection: RouteVariantRead
    requires_replan: bool
    plan: ScheduleRead | None = None
