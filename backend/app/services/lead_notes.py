from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.sales import Lead, LeadNote, SalesUser
from app.schemas.sales import LeadNoteCreate, LeadNoteRead, LeadNoteUpdate


class LeadNoteOperationError(RuntimeError):
    pass


class LeadNotFoundError(LeadNoteOperationError):
    pass


class LeadNoteNotFoundError(LeadNoteOperationError):
    pass


class LeadNoteAuthorNotFoundError(LeadNoteOperationError):
    pass


def _locked_lead(db: Session, lead_id: int) -> Lead:
    lead = db.scalar(select(Lead).where(Lead.id == lead_id).with_for_update())
    if lead is None:
        raise LeadNotFoundError("Lead not found")
    return lead


def _locked_note(db: Session, lead_id: int, note_id: int) -> LeadNote:
    note = db.scalar(
        select(LeadNote)
        .where(LeadNote.id == note_id, LeadNote.lead_id == lead_id)
        .with_for_update()
    )
    if note is None:
        raise LeadNoteNotFoundError("Lead note not found")
    return note


def _require_active_user(db: Session, user_id: int | None) -> SalesUser | None:
    if user_id is None:
        return None
    user = db.get(SalesUser, user_id)
    if user is None or not user.is_active:
        raise LeadNoteAuthorNotFoundError("Active author user not found")
    return user


def _normalize_mentioned_ids(db: Session, raw_ids: list[int] | None) -> list[int]:
    if not raw_ids:
        return []
    unique_ids: list[int] = []
    seen: set[int] = set()
    for user_id in raw_ids:
        if user_id in seen:
            continue
        seen.add(user_id)
        user = db.get(SalesUser, user_id)
        if user is None or not user.is_active:
            raise LeadNoteAuthorNotFoundError(f"Active mentioned user #{user_id} not found")
        unique_ids.append(user_id)
    return unique_ids


def _author_name(db: Session, author_id: int | None) -> str | None:
    if author_id is None:
        return None
    user = db.get(SalesUser, author_id)
    if user is None:
        return f"Сотрудник #{author_id}"
    return user.name


def to_lead_note_read(db: Session, note: LeadNote) -> LeadNoteRead:
    mentioned = note.mentioned_user_ids if isinstance(note.mentioned_user_ids, list) else []
    return LeadNoteRead(
        id=note.id,
        lead_id=note.lead_id,
        body=note.body,
        author_id=note.author_id,
        author_name=_author_name(db, note.author_id),
        is_pinned=note.is_pinned,
        mentioned_user_ids=[int(item) for item in mentioned],
        created_at=note.created_at,
        updated_at=note.updated_at,
    )


def list_lead_notes(db: Session, lead_id: int) -> list[LeadNote]:
    if db.get(Lead, lead_id) is None:
        raise LeadNotFoundError("Lead not found")
    return list(
        db.scalars(
            select(LeadNote)
            .where(LeadNote.lead_id == lead_id)
            .order_by(LeadNote.is_pinned.desc(), LeadNote.created_at.desc(), LeadNote.id.desc())
        ).all()
    )


def create_lead_note(db: Session, lead_id: int, payload: LeadNoteCreate) -> LeadNote:
    lead = _locked_lead(db, lead_id)
    author = _require_active_user(db, payload.author_id)
    if author is None and lead.responsible_id is not None:
        author = _require_active_user(db, lead.responsible_id)
    mentioned = _normalize_mentioned_ids(db, payload.mentioned_user_ids)
    note = LeadNote(
        lead_id=lead_id,
        body=payload.body,
        author_id=author.id if author is not None else None,
        is_pinned=False,
        mentioned_user_ids=mentioned,
    )
    db.add(note)
    db.flush()
    return note


def update_lead_note(
    db: Session,
    lead_id: int,
    note_id: int,
    payload: LeadNoteUpdate,
) -> LeadNote:
    _locked_lead(db, lead_id)
    note = _locked_note(db, lead_id, note_id)
    data = payload.model_dump(exclude_unset=True)
    if "mentioned_user_ids" in data:
        data["mentioned_user_ids"] = _normalize_mentioned_ids(db, data["mentioned_user_ids"])
    for field_name, value in data.items():
        setattr(note, field_name, value)
    db.flush()
    return note


def toggle_lead_note_pin(db: Session, lead_id: int, note_id: int) -> LeadNote:
    _locked_lead(db, lead_id)
    note = _locked_note(db, lead_id, note_id)
    note.is_pinned = not note.is_pinned
    db.flush()
    return note


def delete_lead_note(db: Session, lead_id: int, note_id: int) -> None:
    _locked_lead(db, lead_id)
    note = _locked_note(db, lead_id, note_id)
    db.delete(note)
    db.flush()
