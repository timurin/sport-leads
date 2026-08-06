from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.schemas.sales import ClientCreate, ClientDetailRead, ClientListItem
from app.services.clients import ClientCreateError, create_client, get_client, list_clients


router = APIRouter(prefix="/clients", tags=["Clients"])


@router.get("", response_model=list[ClientListItem])
def get_clients(
    q: str | None = Query(default=None, max_length=255),
    responsible_id: int | None = Query(default=None, ge=1),
    limit: int = Query(default=500, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> list[ClientListItem]:
    return list_clients(
        db,
        q=q,
        responsible_id=responsible_id,
        limit=limit,
        offset=offset,
    )


@router.post("", response_model=ClientDetailRead, status_code=201)
def post_client(payload: ClientCreate, db: Session = Depends(get_db)) -> ClientDetailRead:
    try:
        client = create_client(db, payload)
    except ClientCreateError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    db.commit()
    detail = get_client(db, client.id)
    if detail is None:
        raise HTTPException(status_code=500, detail="Client created but not readable")
    return detail


@router.get("/{client_id}", response_model=ClientDetailRead)
def get_client_by_id(client_id: int, db: Session = Depends(get_db)) -> ClientDetailRead:
    client = get_client(db, client_id)
    if client is None:
        raise HTTPException(status_code=404, detail="Client not found")
    return client
