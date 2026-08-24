from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


def _blank_to_none(value: object) -> object:
    if isinstance(value, str):
        stripped = value.strip()
        return stripped or None
    return value


class ClientUpdate(BaseModel):
    folder_id: int | None = None
    inn: str | None = Field(default=None, max_length=12, pattern=r"^(\d{10}|\d{12})$")
    kpp: str | None = Field(default=None, max_length=9, pattern=r"^\d{9}$")
    ogrn: str | None = Field(default=None, max_length=15, pattern=r"^(\d{13}|\d{15})$")
    legal_address: str | None = Field(default=None, max_length=500)
    actual_address: str | None = Field(default=None, max_length=500)

    @field_validator("inn", "kpp", "ogrn", "legal_address", "actual_address", mode="before")
    @classmethod
    def blank_to_none(cls, value: object) -> object:
        return _blank_to_none(value)


class ClientBankAccountCreate(BaseModel):
    bank_name: str = Field(min_length=1, max_length=255)
    bik: str = Field(pattern=r"^\d{9}$")
    account_number: str = Field(pattern=r"^\d{20}$")
    corr_account: str | None = Field(default=None, pattern=r"^\d{20}$")
    is_primary: bool = False
    sort_order: int = Field(default=0, ge=0)

    @field_validator("bank_name", mode="before")
    @classmethod
    def strip_name(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value

    @field_validator("corr_account", mode="before")
    @classmethod
    def blank_corr(cls, value: object) -> object:
        return _blank_to_none(value)


class ClientBankAccountUpdate(BaseModel):
    bank_name: str | None = Field(default=None, min_length=1, max_length=255)
    bik: str | None = Field(default=None, pattern=r"^\d{9}$")
    account_number: str | None = Field(default=None, pattern=r"^\d{20}$")
    corr_account: str | None = Field(default=None, pattern=r"^\d{20}$")
    is_primary: bool | None = None
    sort_order: int | None = Field(default=None, ge=0)

    @field_validator("bank_name", "bik", "account_number", "corr_account", mode="before")
    @classmethod
    def blank_to_none(cls, value: object) -> object:
        return _blank_to_none(value)


class ClientBankAccountRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    client_id: int
    bank_name: str
    bik: str
    account_number: str
    corr_account: str | None = None
    is_primary: bool
    sort_order: int
    created_at: datetime
    updated_at: datetime
