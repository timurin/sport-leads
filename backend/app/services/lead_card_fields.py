"""Lead card extra field definitions and per-lead values."""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.lead_card_fields import (
    LEAD_CARD_FIELD_BLOCKS,
    LeadCardFieldDefinition,
    LeadCardFieldValue,
)
from app.models.sales import Lead
from app.schemas.lead_card_fields import (
    LeadCardFieldDefinitionCreate,
    LeadCardFieldValueItem,
    LeadCardFieldValueRead,
)


class LeadCardFieldError(RuntimeError):
    pass


class LeadCardFieldNotFoundError(LeadCardFieldError):
    pass


class LeadCardFieldValidationError(LeadCardFieldError):
    pass


def list_definitions(db: Session) -> list[LeadCardFieldDefinition]:
    return list(
        db.scalars(
            select(LeadCardFieldDefinition).order_by(
                LeadCardFieldDefinition.block,
                LeadCardFieldDefinition.sort_order,
                LeadCardFieldDefinition.id,
            )
        ).all()
    )


def create_definition(
    db: Session, payload: LeadCardFieldDefinitionCreate
) -> LeadCardFieldDefinition:
    if payload.block not in LEAD_CARD_FIELD_BLOCKS:
        raise LeadCardFieldValidationError("Unknown lead card field block")
    max_order = db.scalar(
        select(func.coalesce(func.max(LeadCardFieldDefinition.sort_order), -1)).where(
            LeadCardFieldDefinition.block == payload.block
        )
    )
    row = LeadCardFieldDefinition(
        block=payload.block,
        label=payload.label,
        sort_order=int(max_order) + 1,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def delete_definition(db: Session, definition_id: int) -> None:
    row = db.get(LeadCardFieldDefinition, definition_id)
    if row is None:
        raise LeadCardFieldNotFoundError("Lead card field not found")
    db.delete(row)
    db.commit()


def list_lead_values(db: Session, lead_id: int) -> list[LeadCardFieldValueRead]:
    lead = db.get(Lead, lead_id)
    if lead is None:
        raise LeadCardFieldNotFoundError("Lead not found")
    definitions = list_definitions(db)
    stored = {
        item.definition_id: item.value
        for item in db.scalars(
            select(LeadCardFieldValue).where(LeadCardFieldValue.lead_id == lead_id)
        ).all()
    }
    return [
        LeadCardFieldValueRead(
            definition_id=definition.id,
            block=definition.block,
            label=definition.label,
            sort_order=definition.sort_order,
            value=stored.get(definition.id, ""),
        )
        for definition in definitions
    ]


def upsert_lead_values(
    db: Session, lead_id: int, items: list[LeadCardFieldValueItem]
) -> list[LeadCardFieldValueRead]:
    lead = db.get(Lead, lead_id)
    if lead is None:
        raise LeadCardFieldNotFoundError("Lead not found")
    if lead.status == "completed":
        raise LeadCardFieldValidationError("Completed leads cannot be changed")

    definition_ids = {item.definition_id for item in items}
    definitions = {
        row.id: row
        for row in db.scalars(
            select(LeadCardFieldDefinition).where(
                LeadCardFieldDefinition.id.in_(definition_ids)
            )
        ).all()
    } if definition_ids else {}
    missing = definition_ids - set(definitions)
    if missing:
        raise LeadCardFieldValidationError("Unknown lead card field")

    existing = {
        row.definition_id: row
        for row in db.scalars(
            select(LeadCardFieldValue).where(LeadCardFieldValue.lead_id == lead_id)
        ).all()
    }
    for item in items:
        text = item.value.strip()
        current = existing.get(item.definition_id)
        if current is None:
            if not text:
                continue
            db.add(
                LeadCardFieldValue(
                    lead_id=lead_id,
                    definition_id=item.definition_id,
                    value=text,
                )
            )
            continue
        if not text:
            db.delete(current)
            continue
        current.value = text
    db.commit()
    return list_lead_values(db, lead_id)
