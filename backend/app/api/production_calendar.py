from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session

from app.api.deps_auth import get_current_platform_user, require_permission
from app.api.production_capacity import router as capacity_router
from app.database.session import get_db
from app.schemas.production_calendar import AssignmentCreate, AssignmentRead, AssignmentUpdate, CalendarBoardRead, CalendarSourceRead
from app.services import production_calendar as service
from app.services.rbac import PERM_TECHNICAL_CARDS_CREATE

router = APIRouter(prefix="/production-calendar", tags=["Production calendar"], dependencies=[Depends(get_current_platform_user)])
plan_access = require_permission(PERM_TECHNICAL_CARDS_CREATE)
router.include_router(capacity_router)


@router.get("/board", response_model=CalendarBoardRead, operation_id="production_calendar_board")
def read_board(from_date: date = Query(alias="from"), to_date: date = Query(alias="to"),
               stage_id: int | None = Query(default=None, gt=0), db: Session = Depends(get_db)):
    try:
        return service.board(db, from_date, to_date, stage_id)
    except service.CalendarError as error:
        raise HTTPException(error.status_code, str(error)) from error


@router.get("/sources", response_model=list[CalendarSourceRead], operation_id="production_calendar_sources")
def read_sources(search: str = Query(default="", max_length=255), limit: int = Query(default=50, ge=1, le=100),
                 db: Session = Depends(get_db)):
    return service.sources(db, search, limit)


@router.post("/assignments", response_model=AssignmentRead, dependencies=[Depends(plan_access)], operation_id="production_calendar_create")
def create_assignment(payload: AssignmentCreate, db: Session = Depends(get_db)):
    try:
        return service.enqueue(db, payload)
    except service.CalendarError as error:
        raise HTTPException(error.status_code, str(error)) from error


@router.put("/assignments/{assignment_id}", response_model=AssignmentRead, dependencies=[Depends(plan_access)], operation_id="production_calendar_move")
def move_assignment(assignment_id: int, payload: AssignmentUpdate, db: Session = Depends(get_db)):
    try:
        return service.save(db, payload, assignment_id)
    except service.CalendarError as error:
        raise HTTPException(error.status_code, str(error)) from error


@router.delete("/assignments/{assignment_id}", status_code=204, dependencies=[Depends(plan_access)], operation_id="production_calendar_delete")
def delete_assignment(assignment_id: int, db: Session = Depends(get_db)) -> Response:
    try:
        service.remove(db, assignment_id)
        return Response(status_code=204)
    except service.CalendarError as error:
        raise HTTPException(error.status_code, str(error)) from error
