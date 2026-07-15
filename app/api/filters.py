from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.sport_event import SportEvent


router = APIRouter(
    prefix="/filters",
    tags=["Filters"],
)


@router.get("/sports", response_model=list[str])
def get_sports(
    db: Session = Depends(get_db),
) -> list[str]:
    statement = (
        select(SportEvent.sport)
        .where(SportEvent.sport.is_not(None))
        .distinct()
        .order_by(SportEvent.sport)
    )

    values = [
        value
        for value in db.scalars(statement).all()
        if value and value.strip()
    ]

    return ["Все", *values]


@router.get("/cities", response_model=list[str])
def get_cities(
    db: Session = Depends(get_db),
) -> list[str]:
    statement = (
        select(SportEvent.city)
        .where(SportEvent.city.is_not(None))
        .distinct()
        .order_by(SportEvent.city)
    )

    values = [
        value
        for value in db.scalars(statement).all()
        if value and value.strip()
    ]

    return ["Все", *values]