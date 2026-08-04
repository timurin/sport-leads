from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.auth import PlatformUserMeRead


class RoleAssignRequest(BaseModel):
    role_code: str = Field(min_length=1, max_length=64)

    @field_validator("role_code", mode="before")
    @classmethod
    def normalize_role_code(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip().lower()
        return value


class RoleRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    name: str
    is_system: bool
    permissions: list[str] = Field(default_factory=list)


class RoleListRead(BaseModel):
    items: list[RoleRead]


class PlatformUserListRead(BaseModel):
    items: list[PlatformUserMeRead]
