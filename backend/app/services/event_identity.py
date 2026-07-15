import hashlib

from app.schemas.normalized_event import NormalizedEvent


class EventIdentityService:
    @staticmethod
    def build_key(event: NormalizedEvent) -> str:
        parts = (
            event.source_name or "",
            event.external_id or "",
            event.title or "",
            event.sport or "",
            event.start_date.isoformat() if event.start_date else "",
            event.end_date.isoformat() if event.end_date else "",
            event.city or "",
            event.region or "",
            event.description or "",
        )

        normalized = "|".join(
            " ".join(part.casefold().split())
            for part in parts
        )

        return hashlib.sha256(
            normalized.encode("utf-8")
        ).hexdigest()