from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.schemas.client_history import ClientHistoryRead
from app.schemas.client_settlements import ClientSettlementsSummary
from app.schemas.client_requisites import (
    ClientBankAccountCreate,
    ClientBankAccountRead,
    ClientBankAccountUpdate,
    ClientUpdate,
)
from app.schemas.client_segments import ClientDuplicateCandidate, ClientSegmentsReplace
from app.schemas.sales import ClientCreate, ClientDetailRead, ClientListItem
from app.services.client_duplicates import (
    ClientDuplicateCriteriaError,
    find_duplicate_clients,
)
from app.services.client_history import (
    ClientHistoryNotFoundError,
    HistoryKind,
    list_client_history,
)
from app.services.client_settlements import (
    ClientSettlementsNotFoundError,
    get_client_settlements_summary,
)
from app.services.client_bank_accounts import (
    ClientBankAccountNotFoundError,
    ClientBankAccountValidationError,
    create_bank_account,
    delete_bank_account,
    update_bank_account,
)
from app.services.clients import (
    ClientCreateError,
    ClientFolderAssignError,
    ClientNotFoundError,
    ClientUpdateError,
    create_client,
    get_client,
    list_clients,
    update_client,
)
from app.services.client_segments import replace_client_segments


router = APIRouter(prefix="/clients", tags=["Clients"])


@router.get("", response_model=list[ClientListItem])
def get_clients(
    q: str | None = Query(default=None, max_length=255),
    responsible_id: int | None = Query(default=None, ge=1),
    folder_id: int | None = Query(default=None, ge=1),
    limit: int = Query(default=500, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> list[ClientListItem]:
    return list_clients(
        db,
        q=q,
        responsible_id=responsible_id,
        folder_id=folder_id,
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


@router.get(
    "/duplicate-candidates",
    response_model=list[ClientDuplicateCandidate],
    operation_id="find_client_duplicate_candidates",
)
def get_client_duplicate_candidates(
    name: str | None = Query(default=None, max_length=255),
    phone: str | None = Query(default=None, max_length=50),
    inn: str | None = Query(default=None, max_length=12),
    exclude_client_id: int | None = Query(default=None, ge=1),
    limit: int = Query(default=20, ge=1, le=50),
    db: Session = Depends(get_db),
) -> list[ClientDuplicateCandidate]:
    try:
        return find_duplicate_clients(
            db,
            name=name,
            phone=phone,
            inn=inn,
            exclude_client_id=exclude_client_id,
            limit=limit,
        )
    except ClientDuplicateCriteriaError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@router.patch("/{client_id}", response_model=ClientDetailRead, operation_id="update_client")
def patch_client(
    client_id: int,
    payload: ClientUpdate,
    db: Session = Depends(get_db),
) -> ClientDetailRead:
    try:
        return update_client(db, client_id, payload)
    except ClientNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except ClientFolderAssignError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except ClientUpdateError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@router.get("/{client_id}", response_model=ClientDetailRead)
def get_client_by_id(client_id: int, db: Session = Depends(get_db)) -> ClientDetailRead:
    client = get_client(db, client_id)
    if client is None:
        raise HTTPException(status_code=404, detail="Client not found")
    return client


@router.get(
    "/{client_id}/history",
    response_model=ClientHistoryRead,
    operation_id="get_client_history",
)
def get_client_history(
    client_id: int,
    kind: HistoryKind = Query(default="all"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> ClientHistoryRead:
    try:
        return list_client_history(
            db,
            client_id,
            kind=kind,
            limit=limit,
            offset=offset,
        )
    except ClientHistoryNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@router.get(
    "/{client_id}/settlements-summary",
    response_model=ClientSettlementsSummary,
    operation_id="get_client_settlements_summary",
)
def get_client_settlements(
    client_id: int,
    db: Session = Depends(get_db),
) -> ClientSettlementsSummary:
    try:
        return get_client_settlements_summary(db, client_id)
    except ClientSettlementsNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@router.put(
    "/{client_id}/segments",
    response_model=list[str],
    operation_id="replace_client_segments",
)
def put_client_segments(
    client_id: int,
    payload: ClientSegmentsReplace,
    db: Session = Depends(get_db),
) -> list[str]:
    try:
        return replace_client_segments(db, client_id, payload.tags)
    except ClientNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@router.post(
    "/{client_id}/bank-accounts",
    response_model=ClientBankAccountRead,
    status_code=201,
    operation_id="create_client_bank_account",
)
def post_client_bank_account(
    client_id: int,
    payload: ClientBankAccountCreate,
    db: Session = Depends(get_db),
) -> ClientBankAccountRead:
    try:
        return create_bank_account(db, client_id, payload)
    except ClientNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@router.patch(
    "/{client_id}/bank-accounts/{account_id}",
    response_model=ClientBankAccountRead,
    operation_id="update_client_bank_account",
)
def patch_client_bank_account(
    client_id: int,
    account_id: int,
    payload: ClientBankAccountUpdate,
    db: Session = Depends(get_db),
) -> ClientBankAccountRead:
    try:
        return update_bank_account(db, client_id, account_id, payload)
    except ClientNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except ClientBankAccountNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except ClientBankAccountValidationError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@router.delete(
    "/{client_id}/bank-accounts/{account_id}",
    status_code=204,
    operation_id="delete_client_bank_account",
)
def remove_client_bank_account(
    client_id: int,
    account_id: int,
    db: Session = Depends(get_db),
) -> None:
    try:
        delete_bank_account(db, client_id, account_id)
    except ClientNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except ClientBankAccountNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
