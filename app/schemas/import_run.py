from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.import_run import ImportStatus


class ImportRunRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    source_id: int
    status: ImportStatus

    started_at: datetime | None
    finished_at: datetime | None

    items_found: int
    items_created: int
    items_updated: int
    items_skipped: int

    error_message: str | None
    trigger_type: str