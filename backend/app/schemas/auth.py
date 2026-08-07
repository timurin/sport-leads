from datetime import datetime

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
    email: str | None = None
    phone: str | None = None
    department: str | None = None
    position: str | None = None
    manager_platform_user_id: int | None = None
    language: str = "ru"
    invite_status: str = "active"
    last_activity_at: datetime | None = None
    roles: list[str] = Field(default_factory=list)
    permissions: list[str] = Field(default_factory=list)


class PlatformUserInviteRequest(BaseModel):
    login: str = Field(min_length=1, max_length=64)
    display_name: str = Field(min_length=1, max_length=255)
    email: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=64)
    department: str | None = Field(default=None, max_length=150)
    position: str | None = Field(default=None, max_length=150)
    language: str = Field(default="ru", min_length=2, max_length=16)
    role_codes: list[str] = Field(default_factory=list)
    temporary_password: str | None = Field(
        default=None, min_length=8, max_length=256
    )

    @field_validator("login", mode="before")
    @classmethod
    def normalize_login(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip().lower()
        return value

    @field_validator("display_name", mode="before")
    @classmethod
    def strip_display_name(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip()
        return value

    @field_validator(
        "email",
        "phone",
        "department",
        "position",
        mode="before",
    )
    @classmethod
    def strip_optional_text(cls, value: object) -> object:
        if isinstance(value, str):
            stripped = value.strip()
            return stripped or None
        return value

    @field_validator("language", mode="before")
    @classmethod
    def normalize_language(cls, value: object) -> object:
        if value is None:
            return "ru"
        if isinstance(value, str):
            stripped = value.strip()
            return stripped or "ru"
        return value

    @field_validator("temporary_password", mode="before")
    @classmethod
    def empty_password_to_none(cls, value: object) -> object:
        if isinstance(value, str) and not value.strip():
            return None
        return value


class PlatformUserInviteResponse(BaseModel):
    user: PlatformUserMeRead
    temporary_password: str


class PlatformUserProfileUpdateRequest(BaseModel):
    """Partial profile update (21.3.2). Only sent fields are applied."""

    display_name: str | None = Field(default=None, min_length=1, max_length=255)
    email: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=64)
    department: str | None = Field(default=None, max_length=150)
    position: str | None = Field(default=None, max_length=150)
    manager_platform_user_id: int | None = None
    language: str | None = Field(default=None, min_length=2, max_length=16)
    is_active: bool | None = None

    @field_validator("display_name", mode="before")
    @classmethod
    def strip_display_name(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip()
        return value

    @field_validator(
        "email",
        "phone",
        "department",
        "position",
        mode="before",
    )
    @classmethod
    def strip_optional_text(cls, value: object) -> object:
        if isinstance(value, str):
            stripped = value.strip()
            return stripped or None
        return value

    @field_validator("language", mode="before")
    @classmethod
    def normalize_language(cls, value: object) -> object:
        if value is None:
            return None
        if isinstance(value, str):
            stripped = value.strip()
            return stripped or None
        return value


class AuthLoginResponse(BaseModel):
    user: PlatformUserMeRead
