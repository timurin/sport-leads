from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.media import NomenclatureMedia
from app.schemas.media import NomenclatureMediaCreate, NomenclatureMediaRead, NomenclatureMediaUpdate
from app.services.media import MediaError, create_media, delete_media, list_media, media_path, update_media

router = APIRouter(prefix="/nomenclatures", tags=["Nomenclature media"])


def read_item(item: NomenclatureMedia) -> dict[str, object]:
    return {**{column.name: getattr(item, column.name) for column in item.__table__.columns}, "content_url": f"/nomenclatures/{item.nomenclature_id}/media/{item.id}/content"}


@router.get("/{nomenclature_id}/media", response_model=list[NomenclatureMediaRead])
def get_media(nomenclature_id: int, db: Session = Depends(get_db)):
    try: return [read_item(item) for item in list_media(db, nomenclature_id)]
    except MediaError as error: raise HTTPException(status_code=404, detail=str(error)) from error


@router.post("/{nomenclature_id}/media", response_model=NomenclatureMediaRead, status_code=201)
def post_media(nomenclature_id: int, payload: NomenclatureMediaCreate, db: Session = Depends(get_db)):
    try: return read_item(create_media(db, nomenclature_id, payload))
    except MediaError as error: raise HTTPException(status_code=422 if "Invalid" in str(error) or "size" in str(error) else 404, detail=str(error)) from error


@router.patch("/{nomenclature_id}/media/{media_id}", response_model=NomenclatureMediaRead)
def patch_media(nomenclature_id: int, media_id: int, payload: NomenclatureMediaUpdate, db: Session = Depends(get_db)):
    try: return read_item(update_media(db, nomenclature_id, media_id, payload))
    except MediaError as error: raise HTTPException(status_code=404, detail=str(error)) from error


@router.delete("/{nomenclature_id}/media/{media_id}", status_code=204)
def remove_media(nomenclature_id: int, media_id: int, db: Session = Depends(get_db)) -> None:
    try: delete_media(db, nomenclature_id, media_id)
    except MediaError as error: raise HTTPException(status_code=404, detail=str(error)) from error


@router.get("/{nomenclature_id}/media/{media_id}/content")
def get_media_content(nomenclature_id: int, media_id: int, db: Session = Depends(get_db)):
    item = db.scalar(select(NomenclatureMedia).where(NomenclatureMedia.id == media_id, NomenclatureMedia.nomenclature_id == nomenclature_id))
    if item is None: raise HTTPException(status_code=404, detail="Media not found")
    try: return FileResponse(media_path(item), media_type=item.mime_type, filename=item.filename)
    except MediaError as error: raise HTTPException(status_code=404, detail=str(error)) from error
