import time

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger
from sqlalchemy import text

from app.api.auth import router as auth_router
from app.api.collaboration import router as collaboration_router
from app.api.work_tasks import embeds_router as work_tasks_embeds_router
from app.api.work_tasks import router as work_tasks_router
from app.api.work_task_board_stages import router as work_task_board_stages_router
from app.api.platform_users_rbac import router as platform_users_rbac_router
from app.api.stage_executors import router as stage_executors_router
from app.api.audit_events import router as audit_events_router
from app.api.platform_system_settings import router as platform_system_settings_router
from app.api.mailbox_settings import router as mailbox_settings_router
from app.api.platform_directories import router as platform_directories_router
from app.api.print_forms import router as print_forms_router
from app.api.sport_events import router as sport_events_router
from app.api.collector import router as collector_router
from app.api.ekp_import import router as ekp_import_router
from app.api.sources import router as sources_router
from app.api.filters import router as filters_router
from app.api.imports import router as imports_router
from app.api.nomenclature import router as nomenclature_router
from app.api.characteristics import router as characteristics_router
from app.api.media import router as media_router
from app.api.leads import router as leads_router
from app.api.lead_card_fields import (
    definitions_router as lead_card_fields_router,
    values_router as lead_card_field_values_router,
)
from app.api.lead_stages import router as lead_stages_router
from app.api.lead_rejection_reasons import router as lead_rejection_reasons_router
from app.api.orders import router as orders_router
from app.api.organizations import router as organizations_router
from app.api.employees import router as employees_router
from app.api.sewing_cabinet import router as sewing_cabinet_router
from app.api.tech_card_scan import router as tech_card_scan_router
from app.api.client_folders import router as client_folders_router
from app.api.clients import router as clients_router
from app.api.sales_users import router as sales_users_router
from app.api.product_models import (
    folders_router as product_model_folders_router,
)
from app.api.product_models import router as product_models_router
from app.api.product_types import router as product_types_router
from app.api.sewing_operations import (
    folders_router as sewing_operation_folders_router,
)
from app.api.sewing_operations import router as sewing_operations_router
from app.api.sewing_operation_templates import router as sewing_operation_templates_router
from app.api.size_grids import router as size_grids_router
from app.api.vat_rates import router as vat_rates_router
from app.api.warehouses import router as warehouses_router
from app.api.suppliers import router as suppliers_router
from app.api.stock import router as stock_router
from app.api.technical_cards import router as technical_cards_router
from app.api.tech_operations import router as tech_operations_router
from app.api.production_stages import router as production_stages_router
from app.api.production_orders import (
    batches_router as production_batches_router,
    router as production_orders_router,
)
from app.api.specifications import router as specifications_router
from app.api.design_projects import router as design_projects_router
from app.api.shop_routings import (
    routings_router as shop_routings_router,
    work_centers_router,
)
from app.api.analytics import router as analytics_router
from app.config.settings import settings
from app.database.session import SessionLocal, engine
from app.logging_config import configure_logging
from app.services.sewing_cabinet_access import sewing_cabinet_forbidden_response

# Platform release line (roadmap / project-structure). Keep in sync with docs.
APP_VERSION = "0.9.0"

configure_logging(
    level=settings.log_level,
    format_name=settings.log_format,
)

app = FastAPI(
    title="Sport Leads API",
    description="API для сбора и обработки спортивных мероприятий",
    version=APP_VERSION,
)
app.state.session_factory = SessionLocal

if settings.cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


@app.middleware("http")
async def log_requests(
    request: Request,
    call_next,
) -> Response:
    started = time.perf_counter()
    blocked = sewing_cabinet_forbidden_response(request)
    if blocked is not None:
        logger.bind(
            component="http",
            method=request.method,
            path=request.url.path,
            status_code=blocked.status_code,
            duration_ms=round((time.perf_counter() - started) * 1000, 2),
        ).info("HTTP request completed")
        return blocked
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


app.include_router(auth_router)
app.include_router(collaboration_router)
app.include_router(work_tasks_router)
app.include_router(work_tasks_embeds_router)
app.include_router(work_task_board_stages_router)
app.include_router(platform_users_rbac_router)
app.include_router(stage_executors_router)
app.include_router(audit_events_router)
app.include_router(platform_system_settings_router)
app.include_router(mailbox_settings_router)
app.include_router(platform_directories_router)
app.include_router(print_forms_router)
app.include_router(sport_events_router)
app.include_router(collector_router)
app.include_router(ekp_import_router)
app.include_router(filters_router)
app.include_router(sources_router)
app.include_router(imports_router)
app.include_router(nomenclature_router)
app.include_router(characteristics_router)
app.include_router(media_router)
app.include_router(leads_router)
app.include_router(lead_card_fields_router)
app.include_router(lead_card_field_values_router)
app.include_router(lead_stages_router)
app.include_router(lead_rejection_reasons_router)
app.include_router(orders_router)
app.include_router(analytics_router)
app.include_router(organizations_router)
app.include_router(employees_router)
app.include_router(sewing_cabinet_router)
app.include_router(tech_card_scan_router)
app.include_router(clients_router)
app.include_router(client_folders_router)
app.include_router(sales_users_router)
app.include_router(product_models_router)
app.include_router(product_model_folders_router)
app.include_router(product_types_router)
app.include_router(sewing_operations_router)
app.include_router(sewing_operation_folders_router)
app.include_router(sewing_operation_templates_router)
app.include_router(size_grids_router)
app.include_router(vat_rates_router)
app.include_router(warehouses_router)
app.include_router(suppliers_router)
app.include_router(stock_router)
app.include_router(technical_cards_router)
app.include_router(tech_operations_router)
app.include_router(production_stages_router)
app.include_router(production_orders_router)
app.include_router(production_batches_router)
app.include_router(specifications_router)
app.include_router(design_projects_router)
app.include_router(work_centers_router)
app.include_router(shop_routings_router)


@app.get("/")
def root() -> dict[str, str]:
    return {
        "status": "ok",
        "project": "Sport Leads",
        "version": APP_VERSION,
    }


@app.get("/version", operation_id="get_app_version")
def get_app_version() -> dict[str, str]:
    """Public release marker for deploy/ops and v0.9 → v1.00 transition."""
    return {
        "version": APP_VERSION,
        "project": "Sport Leads",
        "roadmap": "v0.9.0",
    }


@app.get("/health")
def health() -> dict[str, str]:
    return {
        "status": "healthy",
        "version": APP_VERSION,
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
