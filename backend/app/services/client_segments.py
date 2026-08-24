"""Replace-all client segment tags (2.3.2)."""

from __future__ import annotations

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models.sales import Client, ClientSegment

MAX_SEGMENTS = 32


def list_segment_names(db: Session, client_id: int) -> list[str]:
    rows = db.scalars(
        select(ClientSegment)
        .where(ClientSegment.client_id == client_id)
        .order_by(ClientSegment.name, ClientSegment.id)
    ).all()
    return [row.name for row in rows]


def replace_client_segments(db: Session, client_id: int, tags: list[str]) -> list[str]:
    from app.services.clients import ClientNotFoundError

    if db.get(Client, client_id) is None:
        raise ClientNotFoundError("Client not found")
    if len(tags) > MAX_SEGMENTS:
        raise ValueError("At most 32 segments per client")
    db.execute(delete(ClientSegment).where(ClientSegment.client_id == client_id))
    for name in tags:
        db.add(ClientSegment(client_id=client_id, name=name))
    db.commit()
    return list_segment_names(db, client_id)
