from pydantic import BaseModel, Field, field_validator


def _blank_to_none(value: object) -> object:
    if isinstance(value, str):
        stripped = value.strip()
        return stripped or None
    return value


class ClientSegmentsReplace(BaseModel):
    tags: list[str] = Field(default_factory=list)

    @field_validator("tags")
    @classmethod
    def normalize_tags(cls, value: list[str]) -> list[str]:
        seen: set[str] = set()
        out: list[str] = []
        for raw in value:
            name = raw.strip()
            if not name:
                continue
            if len(name) > 64:
                raise ValueError("Segment name is at most 64 characters")
            key = name.casefold()
            if key in seen:
                continue
            seen.add(key)
            out.append(name)
        if len(out) > 32:
            raise ValueError("At most 32 segments per client")
        return out


class ClientDuplicateCandidate(BaseModel):
    id: int
    company_name: str | None = None
    contact_name: str
    phone: str | None = None
    inn: str | None = None
    matched_on: list[str] = Field(default_factory=list)
