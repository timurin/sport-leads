from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.schemas.sales import LeadStageConfigurationUpdate, LeadStageRead
from app.services.lead_stages import (
    LeadStageConflictError,
    configure_lead_stages,
    list_lead_stages,
)


router = APIRouter(prefix="/lead-stages", tags=["Sales lead stages"])


@router.get("", response_model=list[LeadStageRead])
def get_lead_stages(db: Session = Depends(get_db)) -> list[LeadStageRead]:
    stages = list_lead_stages(db)
    result = [LeadStageRead.model_validate(stage) for stage in stages]
    db.commit()
    return result


@router.put("", response_model=list[LeadStageRead])
def update_lead_stages(
    payload: LeadStageConfigurationUpdate,
    db: Session = Depends(get_db),
) -> list[LeadStageRead]:
    try:
        stages = configure_lead_stages(db, payload)
        result = [LeadStageRead.model_validate(stage) for stage in stages]
        db.commit()
        return result
    except LeadStageConflictError as error:
        db.rollback()
        raise HTTPException(status_code=409, detail=str(error)) from error
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(status_code=409, detail="Lead stage configuration conflict") from error
