"""Client duplicate candidates (2.3.2) — warning only, never blocks writes."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.sales import Client
from app.schemas.client_segments import ClientDuplicateCandidate
from app.services.lead_duplicates import normalize_duplicate_phone


class ClientDuplicateCriteriaError(RuntimeError):
    pass


def normalize_duplicate_name(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = " ".join(value.split()).casefold()
    return normalized or None


def normalize_duplicate_inn(value: str | None) -> str | None:
    if value is None:
        return None
    digits = "".join(ch for ch in value if ch.isdigit())
    return digits or None


def find_duplicate_clients(
    db: Session,
    *,
    name: str | None = None,
    phone: str | None = None,
    inn: str | None = None,
    exclude_client_id: int | None = None,
    limit: int = 20,
) -> list[ClientDuplicateCandidate]:
    needle_name = normalize_duplicate_name(name)
    needle_phone = normalize_duplicate_phone(phone)
    needle_inn = normalize_duplicate_inn(inn)
    if needle_name is None and needle_phone is None and needle_inn is None:
        raise ClientDuplicateCriteriaError("Name, phone or INN is required")

    statement = select(Client)
    if exclude_client_id is not None:
        statement = statement.where(Client.id != exclude_client_id)
    statement = statement.order_by(Client.id).limit(500)
    rows = db.scalars(statement).all()

    found: list[ClientDuplicateCandidate] = []
    for client in rows:
        matched: list[str] = []
        if needle_name is not None:
            company = normalize_duplicate_name(client.company_name)
            contact = normalize_duplicate_name(client.contact_name)
            if needle_name in {company, contact}:
                matched.append("name")
        if needle_phone is not None:
            if normalize_duplicate_phone(client.phone) == needle_phone:
                matched.append("phone")
        if needle_inn is not None:
            if normalize_duplicate_inn(client.inn) == needle_inn:
                matched.append("inn")
        if not matched:
            continue
        found.append(
            ClientDuplicateCandidate(
                id=client.id,
                company_name=client.company_name,
                contact_name=client.contact_name,
                phone=client.phone,
                inn=client.inn,
                matched_on=matched,
            )
        )
        if len(found) >= limit:
            break
    return found
