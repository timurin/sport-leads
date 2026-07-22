import time

from fastapi import FastAPI, HTTPException, Request, Response
from loguru import logger
from sqlalchemy import text

from app.api.sport_events import router as sport_events_router
from app.api.collector import router as collector_router
from app.api.ekp_import import router as ekp_import_router
from app.api.sources import router as sources_router
from app.api.filters import router as filters_router
from app.api.imports import router as imports_router
from app.api.materials import router as materials_router
from app.api.nomenclature import router as nomenclature_router
from app.api.custom_fields import router as custom_fields_router
from app.api.characteristics import router as characteristics_router
from app.api.media import router as media_router
from app.api.leads import router as leads_router
from app.api.lead_stages import router as lead_stages_router
from app.api.lead_rejection_reasons import router as lead_rejection_reasons_router
from app.api.orders import router as orders_router
from app.api.organizations import router as organizations_router
from app.config.settings import settings
from app.database.session import engine
from app.logging_config import configure_logging

configure_logging(
    level=settings.log_level,
    format_name=settings.log_format,
)

app = FastAPI(
    title="Sport Leads API",
    description="API для сбора и обработки спортивных мероприятий",
    version="0.1.0",
)


@app.middleware("http")
async def log_requests(
    request: Request,
    call_next,
) -> Response:
    started = time.perf_counter()
    response = await call_next(request)
    duration_ms = round(
        (time.perf_counter() - started) * 1000,
        2,
    )

    logger.bind(
        component="http",
        method=request.method,
        path=request.url.path,
        status_code=response.status_code,
        duration_ms=duration_ms,
    ).info("HTTP request completed")

    return response


app.include_router(sport_events_router)
app.include_router(collector_router)
app.include_router(ekp_import_router)
app.include_router(filters_router)
app.include_router(sources_router)
app.include_router(imports_router)
app.include_router(materials_router)
app.include_router(nomenclature_router)
app.include_router(custom_fields_router)
app.include_router(characteristics_router)
app.include_router(media_router)
app.include_router(leads_router)
app.include_router(lead_stages_router)
app.include_router(lead_rejection_reasons_router)
app.include_router(orders_router)
app.include_router(organizations_router)


@app.get("/")
def root() -> dict[str, str]:
    return {
        "status": "ok",
        "project": "Sport Leads",
    }


@app.get("/health")
def health() -> dict[str, str]:
    return {
        "status": "healthy",
    }


@app.get("/health/ready")
def health_ready() -> dict[str, str]:
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except Exception as exc:
        logger.bind(component="health").warning(
            "Database readiness check failed"
        )
        raise HTTPException(
            status_code=503,
            detail="database unavailable",
        ) from exc

    return {
        "status": "ready",
        "database": "ok",
    }
