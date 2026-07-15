from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.collectors.document import DocumentCollector
from app.database.session import get_db
from app.parsers.ekp_pdf import EkpPdfParser
from app.parsers.pdf_document import PdfDocumentParser
from app.schemas.ekp_import import (
    EkpImportRequest,
    EkpImportResponse,
)
from app.schemas.event_filter import EventFilterRequest
from app.services.ekp_normalizer import EkpEventNormalizer
from app.services.event_import import EventImportService


router = APIRouter(
    prefix="/imports/ekp",
    tags=["EKP import"],
)


@router.post(
    "",
    response_model=EkpImportResponse,
    status_code=status.HTTP_200_OK,
    responses={
        502: {
            "description": "Ошибка загрузки документа",
        },
    },
)
def import_ekp(
    payload: EkpImportRequest,
    db: Session = Depends(get_db),
) -> EkpImportResponse:
    document_url = str(payload.document_url)

    collector = DocumentCollector(
        use_browser=True,
        ignore_https_errors=payload.ignore_https_errors,
    )

    try:
        document = collector.download(document_url)

        pdf_result = PdfDocumentParser().parse(
            document.path,
            max_pages=payload.max_pages,
        )

    except (RuntimeError, FileNotFoundError) as error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(error),
        ) from error

    parsed_events = EkpPdfParser().parse(
        pdf_result.text,
    )

    normalizer = EkpEventNormalizer()

    normalized_events = [
        normalizer.normalize(
            event=event,
            sport=payload.sport,
            source_document_url=document_url,
        )
        for event in parsed_events
    ]

    filters = EventFilterRequest(
        period_start=payload.period_start,
        period_end=payload.period_end,
        sport=payload.sport,
        city=payload.city,
    )

    result = EventImportService(db).import_events(
        events=normalized_events,
        filters=filters,
    )

    return EkpImportResponse(
        document_url=document_url,
        parsed=len(parsed_events),
        received=result.received,
        filtered_out=result.filtered_out,
        created=result.created,
        duplicates=result.duplicates,
        failed=result.failed,
    )