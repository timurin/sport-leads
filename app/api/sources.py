from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.source import Source
from app.schemas.source import SourceCreate, SourceRead, SourceUpdate


router = APIRouter(
    prefix="/sources",
    tags=["Sources"],
)


@router.post(
    "",
    response_model=SourceRead,
    status_code=status.HTTP_201_CREATED,
)
def create_source(
    payload: SourceCreate,
    db: Session = Depends(get_db),
) -> Source:
    source = Source(
        **payload.model_dump(mode="json"),
    )

    db.add(source)

    try:
        db.commit()
        db.refresh(source)

    except IntegrityError as error:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Источник с таким URL уже существует",
        ) from error

    return source


@router.get(
    "",
    response_model=list[SourceRead],
)
def list_sources(
    active_only: bool = Query(default=False),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
) -> list[Source]:
    statement = select(Source)

    if active_only:
        statement = statement.where(
            Source.is_active.is_(True),
        )

    statement = (
        statement
        .order_by(Source.name, Source.id)
        .offset(skip)
        .limit(limit)
    )

    return list(db.scalars(statement).all())


@router.get(
    "/{source_id}",
    response_model=SourceRead,
)
def get_source(
    source_id: int,
    db: Session = Depends(get_db),
) -> Source:
    source = db.get(Source, source_id)

    if source is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Источник не найден",
        )

    return source


@router.patch(
    "/{source_id}",
    response_model=SourceRead,
)
def update_source(
    source_id: int,
    payload: SourceUpdate,
    db: Session = Depends(get_db),
) -> Source:
    source = db.get(Source, source_id)

    if source is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Источник не найден",
        )

    update_data = payload.model_dump(
        exclude_unset=True,
        mode="json",
    )

    for field, value in update_data.items():
        setattr(source, field, value)

    try:
        db.commit()
        db.refresh(source)

    except IntegrityError as error:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Источник с таким URL уже существует",
        ) from error

    return source


@router.delete(
    "/{source_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_source(
    source_id: int,
    db: Session = Depends(get_db),
) -> None:
    source = db.get(Source, source_id)

    if source is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Источник не найден",
        )

    db.delete(source)
    db.commit()