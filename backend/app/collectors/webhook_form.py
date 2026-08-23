from collections.abc import Mapping

from app.collectors.result import CollectorResult
from app.collectors.source_base import SourceCollector
from app.models.source import Source
from app.schemas.lead_ingest import NormalizedLeadIngest, WebsiteFormWebhookPayload

WEBHOOK_FORM_ADAPTER = "webhook_form"


class WebhookFormCollector(SourceCollector):
    """Push ingest of a website form payload into CRM `Lead` (contour C)."""

    source_type = WEBHOOK_FORM_ADAPTER

    def collect(self, source: Source) -> CollectorResult:
        raise RuntimeError(
            "webhook_form is push-only ingest; use normalize() / POST /leads/ingest/website-form"
        )

    def normalize(self, payload: Mapping[str, object]) -> NormalizedLeadIngest:
        body = WebsiteFormWebhookPayload.model_validate(payload)
        source_label = (body.source or "website").strip() or "website"
        return NormalizedLeadIngest(
            adapter_type=WEBHOOK_FORM_ADAPTER,
            external_id=body.external_id,
            contact_name=body.contact_name,
            phone=body.phone,
            email=body.email,
            company_name=body.company_name,
            city=body.city,
            comment=body.comment,
            source_label=source_label,
            sport=body.sport,
        )
