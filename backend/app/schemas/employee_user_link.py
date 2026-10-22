"""Explicit mapping commands, separate from HR/profile/access mutations."""

from pydantic import BaseModel, ConfigDict, Field, field_validator


class EmployeeLinkRead(BaseModel):
    platform_user_id: int
    employee_id: int | None


class EmployeeLinkCommand(BaseModel):
    model_config = ConfigDict(extra="forbid")

    employee_id: int = Field(ge=1)
    reason: str = Field(min_length=1, max_length=500)

    @field_validator("reason", mode="before")
    @classmethod
    def trim_reason(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class EmployeeUnlinkCommand(BaseModel):
    model_config = ConfigDict(extra="forbid")

    expected_employee_id: int = Field(ge=1)
    reason: str = Field(min_length=1, max_length=500)

    @field_validator("reason", mode="before")
    @classmethod
    def trim_reason(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value
