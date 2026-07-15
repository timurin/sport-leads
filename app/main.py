from fastapi import FastAPI

from app.api.sport_events import router as sport_events_router
from app.api.collector import router as collector_router
from app.api.ekp_import import router as ekp_import_router
from app.api.sources import router as sources_router
from app.api.filters import router as filters_router
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