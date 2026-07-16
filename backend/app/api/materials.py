from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    Response,
    status,
)
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.material import Material
from app.schemas.material import (
    MaterialCreate,
    MaterialRead,
    MaterialUpdate,
)


router = APIRouter(
    prefix="/materials",
    tags=["Materials"],
)


@router.get(
    "",
    response_model=list[MaterialRead],
)
def list_materials(
    search: str | None = Query(
        default=None,
        max_length=255,
    ),
    is_active: bool | None = None,
    limit: int = Query(
        default=100,
        ge=1,
        le=500,
    ),
    offset: int = Query(
        default=0,
        ge=0,
    ),
    db: Session = Depends(get_db),
) -> list[Material]:
    statement = select(Material)

    if search:
        pattern = f"%{search.strip()}%"

        statement = statement.where(
            or_(
                Material.name.ilike(pattern),
                Material.article.ilike(pattern),
                Material.category.ilike(pattern),
            )
        )

    if is_active is not None:
        statement = statement.where(
            Material.is_active == is_active
        )

    statement = (
        statement
        .order_by(
            Material.is_active.desc(),
            func.lower(Material.name),
        )
        .offset(offset)
        .limit(limit)
    )

    return list(
        db.scalars(statement).all()
    )


@router.get(
    "/{material_id}",
    response_model=MaterialRead,
)
def get_material(
    material_id: int,
    db: Session = Depends(get_db),
) -> Material:
    material = db.get(
        Material,
        material_id,
    )

    if material is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Материал не найден",
        )

    return material


@router.post(
    "",
    response_model=MaterialRead,
    status_code=status.HTTP_201_CREATED,
)
def create_material(
    payload: MaterialCreate,
    db: Session = Depends(get_db),
) -> Material:
    material = Material(
        **payload.model_dump(),
    )

    db.add(material)

    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Материал с таким артикулом "
                "уже существует"
            ),
        ) from error

    db.refresh(material)

    return material


@router.patch(
    "/{material_id}",
    response_model=MaterialRead,
)
def update_material(
    material_id: int,
    payload: MaterialUpdate,
    db: Session = Depends(get_db),
) -> Material:
    material = db.get(
        Material,
        material_id,
    )

    if material is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Материал не найден",
        )

    changes = payload.model_dump(
        exclude_unset=True,
    )

    for field_name, value in changes.items():
        setattr(
            material,
            field_name,
            value,
        )

    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Материал с таким артикулом "
                "уже существует"
            ),
        ) from error

    db.refresh(material)

    return material


@router.delete(
    "/{material_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_material(
    material_id: int,
    db: Session = Depends(get_db),
) -> Response:
    material = db.get(
        Material,
        material_id,
    )

    if material is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Материал не найден",
        )

    db.delete(material)
    db.commit()

    return Response(
        status_code=status.HTTP_204_NO_CONTENT,
    )