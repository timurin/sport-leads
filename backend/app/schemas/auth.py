from pydantic import BaseModel, ConfigDict, Field, field_validator


class AuthLoginRequest(BaseModel):
    login: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=256)

    @field_validator("login", mode="before")
    @classmethod
    def normalize_login(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip().lower()
        return value


class PlatformUserMeRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    login: str
    display_name: str
    is_active: bool
    sales_user_id: int | None = None
    roles: list[str] = Field(default_factory=list)
    permissions: list[str] = Field(default_factory=list)


class AuthLoginResponse(BaseModel):
    user: PlatformUserMeRead
