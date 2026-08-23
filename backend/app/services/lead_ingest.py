import hmac
from collections.abc import Mapping
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.collectors.webhook_form import WebhookFormCollector
from app.models.sales import Lead, LeadEvent, LeadEventType, LeadIngestReceipt
from app.schemas.lead_ingest import NormalizedLeadIngest
from app.schemas.sales import LeadCreate
from app.services.lead_creation import create_lead
from app.services.lead_duplicates import LeadDuplicateCriteriaError, find_duplicate_leads


class LeadIngestError(RuntimeError):
    pass


class LeadIngestSecretError(LeadIngestError):
    pass


@dataclass(slots=True, frozen=True)
class LeadIngestResult:
    lead: Lead
    created: bool
    matched_existing: bool
    duplicate_ingest: bool
    adapter_type: str
    external_id: str


def ingest_website_form_lead(
    db: Session,
    payload: Mapping[str, object],
    *,
    collector: WebhookFormCollector | None = None,
) -> LeadIngestResult:
    adapter = collector or WebhookFormCollector()
    normalized = adapter.normalize(payload)
    return _persist_normalized_lead(db, normalized)


def _persist_normalized_lead(db: Session, normalized: NormalizedLeadIngest) -> LeadIngestResult:
    receipt = db.scalar(
        select(LeadIngestReceipt).where(
            LeadIngestReceipt.adapter_type == normalized.adapter_type,
            LeadIngestReceipt.external_id == normalized.external_id,
        )
    )
    if receipt is not None:
        lead = db.get(Lead, receipt.lead_id)
        if lead is None:
            raise LeadIngestError("Ingest receipt points to a missing lead")
        return LeadIngestResult(
            lead=lead,
            created=False,
            matched_existing=False,
            duplicate_ingest=True,
            adapter_type=normalized.adapter_type,
            external_id=normalized.external_id,
        )

    matched = _match_existing_lead(db, normalized)
    if matched is not None:
        _store_receipt(db, matched, normalized)
        db.add(
            LeadEvent(
                lead_id=matched.id,
                event_type=LeadEventType.COMMENT_ADDED,
                message=(
                    f"Website form ingest matched existing lead "
                    f"({normalized.adapter_type}:{normalized.external_id})"
                ),
            )
        )
        db.flush()
        return LeadIngestResult(
            lead=matched,
            created=False,
            matched_existing=True,
            duplicate_ingest=False,
            adapter_type=normalized.adapter_type,
            external_id=normalized.external_id,
        )

    lead = create_lead(
        db,
        LeadCreate(
            contact_name=normalized.contact_name,
            company_name=normalized.company_name,
            phone=normalized.phone,
            email=normalized.email,
            city=normalized.city,
            customer_comment=normalized.comment,
            source=normalized.source_label,
            sport=normalized.sport,
        ),
    )
    _store_receipt(db, lead, normalized)
    db.add(
        LeadEvent(
            lead_id=lead.id,
            event_type=LeadEventType.COMMENT_ADDED,
            message=f"Ingested via {normalized.adapter_type}:{normalized.external_id}",
        )
    )
    db.flush()
    return LeadIngestResult(
        lead=lead,
        created=True,
        matched_existing=False,
        duplicate_ingest=False,
        adapter_type=normalized.adapter_type,
        external_id=normalized.external_id,
    )


def _match_existing_lead(db: Session, normalized: NormalizedLeadIngest) -> Lead | None:
    email = str(normalized.email) if normalized.email is not None else None
    if not normalized.phone and not email:
        return None
    try:
        matches = find_duplicate_leads(
            db,
            phone=normalized.phone,
            email=email,
            limit=1,
        )
    except LeadDuplicateCriteriaError:
        return None
    return matches[0] if matches else None


def _store_receipt(db: Session, lead: Lead, normalized: NormalizedLeadIngest) -> None:
    db.add(
        LeadIngestReceipt(
            adapter_type=normalized.adapter_type,
            external_id=normalized.external_id,
            lead_id=lead.id,
        )
    )


def verify_website_form_secret(provided: str | None, expected: str | None) -> None:
    if expected is None or not expected.strip():
        raise LeadIngestSecretError("Website form ingest secret is not configured")
    if provided is None or not hmac_compare(provided, expected):
        raise LeadIngestSecretError("Invalid website form ingest secret")


def hmac_compare(provided: str, expected: str) -> bool:
    left = provided.encode("utf-8")
    right = expected.encode("utf-8")
    if len(left) != len(right):
        return False
    return hmac.compare_digest(left, right)
