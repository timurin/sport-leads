"""Nomenclature card change-log helpers (roadmap 4.3.3.1)."""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.nomenclature import NomenclatureHistoryEntry

DEFAULT_ACTOR = "Система"
HISTORY_LIMIT = NomenclatureHistoryEntry.HISTORY_LIMIT


def append_nomenclature_history(
    db: Session,
    nomenclature_id: int,
    action: str,
    *,
    actor: str = DEFAULT_ACTOR,
) -> NomenclatureHistoryEntry:
    while _count_history(db, nomenclature_id) >= HISTORY_LIMIT:
        oldest = _oldest_history(db, nomenclature_id)
        if oldest is None:
            break
        db.delete(oldest)
        db.flush()
    entry = NomenclatureHistoryEntry(
        nomenclature_id=nomenclature_id,
        actor=actor,
        action=action,
    )
    db.add(entry)
    db.flush()
    return entry


def list_nomenclature_history(
    db: Session, nomenclature_id: int
) -> list[NomenclatureHistoryEntry]:
    statement = (
        select(NomenclatureHistoryEntry)
        .where(NomenclatureHistoryEntry.nomenclature_id == nomenclature_id)
        .order_by(
            NomenclatureHistoryEntry.created_at.desc(),
            NomenclatureHistoryEntry.id.desc(),
        )
    )
    return list(db.scalars(statement).all())


def _count_history(db: Session, nomenclature_id: int) -> int:
    return int(
        db.scalar(
            select(func.count())
            .select_from(NomenclatureHistoryEntry)
            .where(NomenclatureHistoryEntry.nomenclature_id == nomenclature_id)
        )
        or 0
    )


def _oldest_history(
    db: Session, nomenclature_id: int
) -> NomenclatureHistoryEntry | None:
    return db.scalars(
        select(NomenclatureHistoryEntry)
        .where(NomenclatureHistoryEntry.nomenclature_id == nomenclature_id)
        .order_by(
            NomenclatureHistoryEntry.created_at.asc(),
            NomenclatureHistoryEntry.id.asc(),
        )
        .limit(1)
    ).first()
