from fastapi import FastAPI

from app.api.sport_events import router as sport_events_router
from app.api.collector import router as collector_router
from app.api.ekp_import import router as ekp_import_router
from app.api.sources import router as sources_router
from app.api.filters import router as filters_router
from app.api.imports import router as imports_router
from app.api.materials import router as materials_router
from app.api.leads import router as leads_router
from app.api.lead_stages import router as lead_stages_router
from app.api.lead_rejection_reasons import router as lead_rejection_reasons_router
from app.api.orders import router as orders_router
app = FastAPI(
    title="Sport Leads API",
    description="API для сбора и обработки спортивных мероприятий",
    version="0.1.0",
)

app.include_router(sport_events_router)
app.include_router(collector_router)
app.include_router(ekp_import_router)
app.include_router(filters_router)
app.include_router(sources_router)
app.include_router(imports_router)
app.include_router(materials_router)
app.include_router(leads_router)
app.include_router(lead_stages_router)
app.include_router(lead_rejection_reasons_router)
app.include_router(orders_router)


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
