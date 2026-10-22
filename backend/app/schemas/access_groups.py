from pydantic import BaseModel, ConfigDict, Field, field_validator


class GroupCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    code: str = Field(min_length=1, max_length=64, pattern=r"^[a-z][a-z0-9_]*$")
    name: str = Field(min_length=1, max_length=255)
    permissions: list[str] = Field(max_length=500)
    reason: str = Field(min_length=1, max_length=500)

    @field_validator("name", "reason", mode="before")
    @classmethod
    def trim(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class GroupChange(BaseModel):
    model_config = ConfigDict(extra="forbid")
    version: int = Field(ge=1)
    name: str = Field(min_length=1, max_length=255)
    permissions: list[str] = Field(max_length=500)
    reason: str = Field(min_length=1, max_length=500)

    @field_validator("name", "reason", mode="before")
    @classmethod
    def trim(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class GroupApply(GroupChange):
    revision: str = Field(min_length=64, max_length=64)
    preview_fingerprint: str = Field(min_length=64, max_length=64)


class GroupDelete(BaseModel):
    model_config = ConfigDict(extra="forbid")
    version: int = Field(ge=1)
    reason: str = Field(min_length=1, max_length=500)

    @field_validator("reason", mode="before")
    @classmethod
    def trim(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class MembershipChange(BaseModel):
    model_config = ConfigDict(extra="forbid")
    role_codes: list[str] = Field(max_length=500)
    reason: str = Field(min_length=1, max_length=500)

    @field_validator("reason", mode="before")
    @classmethod
    def trim(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class MembershipApply(MembershipChange):
    revision: str = Field(min_length=64, max_length=64)
    preview_fingerprint: str = Field(min_length=64, max_length=64)


class PermissionRead(BaseModel):
    code: str
    description: str | None


class AccessPreview(BaseModel):
    revision: str
    preview_fingerprint: str
    can_apply: bool
    blocker: str | None = None
    affected_count: int
    granted: list[str]
    removed: list[str]
    group_granted: list[str] = Field(default_factory=list)
    group_removed: list[str] = Field(default_factory=list)


class EffectiveAccessRead(BaseModel):
    platform_user_id: int
    role_codes: list[str]
    permissions: list[str]
    restricted: bool
    revision: str
