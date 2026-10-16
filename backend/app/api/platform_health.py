from typing import Literal

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session

from app.api.deps_auth import get_current_platform_user, require_permission
from app.services.rbac import PERM_AUDIT_READ
from app.database.session import get_db
from app.schemas.production_diagnostics import DiagnosticCategory, PlatformHealthRead, ProductionDiagnosticsRead
from app.services.platform_health import read_health
from app.services.production_diagnostics import card_diagnostics
from app.services.technical_cards import TechnicalCardNotFoundError

health_access = require_permission(PERM_AUDIT_READ)
router=APIRouter(prefix="/platform-health",tags=["Platform diagnostics"],dependencies=[Depends(get_current_platform_user), Depends(health_access)])


@router.get("",response_model=PlatformHealthRead,operation_id="read_platform_health")
def platform_health(category:DiagnosticCategory|None=None,module:str|None=Query(None,max_length=64),
                    severity:Literal["error","warning","info"]|None=None,entity_type:str|None=Query(None,max_length=64),
                    entity_id:str|None=Query(None,max_length=128),limit:int=Query(100,ge=1,le=200),offset:int=Query(0,ge=0),
                    db:Session=Depends(get_db)):
    return read_health(db,category=category,module=module,severity=severity,entity_type=entity_type,entity_id=entity_id,limit=limit,offset=offset)


@router.get("/technical-cards/{card_id}/trace",response_model=ProductionDiagnosticsRead,operation_id="read_platform_card_trace")
def platform_card_trace(card_id:int,db:Session=Depends(get_db)):
    try:
        return card_diagnostics(db,card_id)
    except TechnicalCardNotFoundError as error:
        raise HTTPException(404,str(error)) from error
