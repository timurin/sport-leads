from __future__ import annotations

import re

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models.sales import Lead, LeadContact


PHONE_DIGITS_PATTERN = re.compile(r"\D+")


class LeadDuplicateCriteriaError(RuntimeError):
    pass


def normalize_duplicate_email(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip().lower()
    return normalized or None


def normalize_duplicate_phone(value: str | None) -> str | None:
    if value is None:
        return None
    digits = PHONE_DIGITS_PATTERN.sub("", value)
    if len(digits) == 11 and digits.startswith("8"):
        digits = f"7{digits[1:]}"
    return digits or None


def _phone_matches(left: str | None, right: str) -> bool:
    normalized_left = normalize_duplicate_phone(left)
    return normalized_left == right


def _lead_matches_duplicate_criteria(
    lead: Lead,
    *,
    normalized_phone: str | None,
    normalized_email: str | None,
) -> bool:
    if normalized_email is not None:
        if normalize_duplicate_email(lead.email) == normalized_email:
            return True
        if any(normalize_duplicate_email(contact.email) == normalized_email for contact in lead.contacts):
            return True

    if normalized_phone is not None:
        if _phone_matches(lead.phone, normalized_phone):
            return True
        if any(_phone_matches(contact.phone, normalized_phone) for contact in lead.contacts):
            return True

    return False


def find_duplicate_leads(
    db: Session,
    *,
    phone: str | None = None,
    email: str | None = None,
    exclude_lead_id: int | None = None,
    limit: int = 20,
) -> list[Lead]:
    normalized_phone = normalize_duplicate_phone(phone)
    normalized_email = normalize_duplicate_email(email)
    if normalized_phone is None and normalized_email is None:
        raise LeadDuplicateCriteriaError("Phone or email is required")

    conditions = []
    if normalized_email is not None:
        conditions.extend(
            [
                func.lower(Lead.email) == normalized_email,
                func.lower(LeadContact.email) == normalized_email,
            ]
        )
    if normalized_phone is not None:
        conditions.extend([Lead.phone.is_not(None), LeadContact.phone.is_not(None)])

    statement = (
        select(Lead)
        .outerjoin(LeadContact)
        .where(or_(*conditions))
        .order_by(Lead.created_at.desc(), Lead.id.desc())
    )
    if exclude_lead_id is not None:
        statement = statement.where(Lead.id != exclude_lead_id)

    matches: list[Lead] = []
    for lead in db.scalars(statement).unique():
        if _lead_matches_duplicate_criteria(
            lead,
            normalized_phone=normalized_phone,
            normalized_email=normalized_email,
        ):
            matches.append(lead)
            if len(matches) >= limit:
                break
    return matches
