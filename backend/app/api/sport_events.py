from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session
from datetime import date
from app.database.session import get_db
from app.models.sport_event import SportEvent
from app.schemas.sport_event import (
    SportEventCreate,
    SportEventRead,
    SportEventUpdate,
)


router = APIRouter(
    prefix="/events",
    tags=["Sport events"],
)


@router.post(
    "",
    response_model=SportEventRead,
    status_code=status.HTTP_201_CREATED,
)
def create_event(
    event_data: SportEventCreate,
    db: Session = Depends(get_db),
) -> SportEvent:
    event = SportEvent(
        **event_data.model_dump(mode="json"),
    )

    db.add(event)
    db.commit()
    db.refresh(event)

    return event

@router.get(
    "",
    response_model=list[SportEventRead],
)
def list_events(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),

    period_start: date | None = Query(default=None),
    period_end: date | None = Query(default=None),

    sport: str = Query(default="Все"),
    city: str = Query(default="Все"),

    db: Session = Depends(get_db),
) -> list[SportEvent]:

    if (
        period_start is not None
        and period_end is not None
        and period_start > period_end
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Дата начала периода не может быть позже даты окончания периода",
        )

    statement = select(SportEvent)

    if period_start:
        statement = statement.where(
            or_(
                SportEvent.end_date >= period_start,
                (
                    SportEvent.end_date.is_(None)
                    & (SportEvent.start_date >= period_start)
                ),
            )
        )

    if period_end:
        statement = statement.where(
            SportEvent.start_date <= period_end,
        )

    if sport != "Все":
        statement = statement.where(
            SportEvent.sport.ilike(f"%{sport}%")
        )

    if city != "Все":
        statement = statement.where(
            SportEvent.city.ilike(f"%{city}%")
        )

    statement = (
        statement
        .order_by(
            SportEvent.start_date.asc().nulls_last(),
            SportEvent.id.asc(),
        )
        .offset(skip)
        .limit(limit)
    )

    return list(db.scalars(statement).all())


@router.get(
    "/{event_id}",
    response_model=SportEventRead,
)
def get_event(
    event_id: int,
    db: Session = Depends(get_db),
) -> SportEvent:
    event = db.get(SportEvent, event_id)

    if event is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Спортивное мероприятие не найдено",
        )

    return event


@router.patch(
    "/{event_id}",
    response_model=SportEventRead,
)
def update_event(
    event_id: int,
    event_data: SportEventUpdate,
    db: Session = Depends(get_db),
) -> SportEvent:
    event = db.get(SportEvent, event_id)

    if event is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Спортивное мероприятие не найдено",
        )

    update_data = event_data.model_dump(
        exclude_unset=True,
        mode="json",
    )

    for field, value in update_data.items():
        setattr(event, field, value)

    db.commit()
    db.refresh(event)

    return event


@router.delete(
    "/{event_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_event(
    event_id: int,
    db: Session = Depends(get_db),
) -> None:
    event = db.get(SportEvent, event_id)

    if event is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Спортивное мероприятие не найдено",
        )

    db.delete(event)
    db.commit()