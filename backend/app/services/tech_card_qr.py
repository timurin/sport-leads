"""Opaque tech-card QR token and scan URL (ADR-030 / 25.1)."""

from __future__ import annotations

import io
import secrets

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config.settings import settings
from app.models.technical_card import TechnicalCard

try:
    import qrcode
    from qrcode.image.svg import SvgPathImage
except ImportError:  # pragma: no cover - runtime dependency
    qrcode = None  # type: ignore[assignment]
    SvgPathImage = None  # type: ignore[assignment]


def public_app_origin() -> str:
    return settings.public_app_origin


def scan_url_for_token(token: str) -> str:
    return f"{public_app_origin()}/production/scan/{token}"


def ensure_qr_token(db: Session, card: TechnicalCard) -> str:
    existing = (card.qr_token or "").strip()
    if existing:
        return existing
    for _ in range(8):
        token = secrets.token_urlsafe(32)
        taken = db.scalar(
            select(TechnicalCard.id).where(TechnicalCard.qr_token == token)
        )
        if taken is None:
            card.qr_token = token
            db.flush()
            return token
    raise RuntimeError("Не удалось выдать уникальный QR-токен техкарты")


def render_qr_svg(payload: str) -> str:
    if qrcode is None or SvgPathImage is None:
        escaped = (
            payload.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        )
        return (
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" '
            'role="img" aria-label="QR">'
            '<rect width="96" height="96" fill="#fff"/>'
            f'<text x="8" y="52" font-size="8">{escaped}</text></svg>'
        )
    image = qrcode.make(payload, image_factory=SvgPathImage, box_size=4, border=2)
    buffer = io.BytesIO()
    image.save(buffer)
    svg = buffer.getvalue().decode("utf-8")
    return svg.replace('<?xml version="1.0" encoding="UTF-8"?>', "").strip()


def attach_qr_fields(db: Session, card: TechnicalCard, data: dict[str, object]) -> None:
    token = ensure_qr_token(db, card)
    url = scan_url_for_token(token)
    data["qr_token"] = token
    data["scan_url"] = url
    data["scan_qr_svg"] = render_qr_svg(url)
