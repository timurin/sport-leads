from pydantic import BaseModel, Field


class StageExecutorRead(BaseModel):
    id: int
    login: str
    display_name: str
    is_active: bool


class StageExecutorListRead(BaseModel):
    production_stage_id: int
    stage_code: str
    source: str = Field(
        description="directory | role_fallback — role_fallback until per-stage directory is filled"
    )
    items: list[StageExecutorRead] = Field(default_factory=list)


class StageExecutorReplaceRequest(BaseModel):
    platform_user_ids: list[int] = Field(default_factory=list)
