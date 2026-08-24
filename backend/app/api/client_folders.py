from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.schemas.client_folders import (
    ClientFolderCreate,
    ClientFolderRead,
    ClientFolderSiblingMove,
    ClientFolderUpdate,
)
from app.services.client_folders import (
    ClientFolderConflictError,
    ClientFolderNotFoundError,
    ClientFolderValidationError,
    create_client_folder,
    delete_client_folder,
    get_client_folder_read,
    list_client_folders,
    move_client_folder_sibling,
    update_client_folder,
)

router = APIRouter(prefix="/client-folders", tags=["Clients"])


@router.get("", response_model=list[ClientFolderRead], operation_id="list_client_folders")
def get_client_folders(db: Session = Depends(get_db)) -> list[ClientFolderRead]:
    return list_client_folders(db)


@router.post(
    "",
    response_model=ClientFolderRead,
    status_code=status.HTTP_201_CREATED,
    operation_id="create_client_folder",
)
def post_client_folder(
    payload: ClientFolderCreate, db: Session = Depends(get_db)
) -> ClientFolderRead:
    try:
        return create_client_folder(db, payload)
    except ClientFolderConflictError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    except ClientFolderValidationError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except ClientFolderNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@router.get(
    "/{folder_id}",
    response_model=ClientFolderRead,
    operation_id="get_client_folder",
)
def get_client_folder(
    folder_id: int, db: Session = Depends(get_db)
) -> ClientFolderRead:
    try:
        return get_client_folder_read(db, folder_id)
    except ClientFolderNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@router.patch(
    "/{folder_id}",
    response_model=ClientFolderRead,
    operation_id="update_client_folder",
)
def patch_client_folder(
    folder_id: int,
    payload: ClientFolderUpdate,
    db: Session = Depends(get_db),
) -> ClientFolderRead:
    try:
        return update_client_folder(db, folder_id, payload)
    except ClientFolderNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except ClientFolderConflictError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    except ClientFolderValidationError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@router.post(
    "/{folder_id}/move-sibling",
    response_model=ClientFolderRead,
    operation_id="move_client_folder_sibling",
)
def post_client_folder_move_sibling(
    folder_id: int,
    payload: ClientFolderSiblingMove,
    db: Session = Depends(get_db),
) -> ClientFolderRead:
    try:
        return move_client_folder_sibling(db, folder_id, payload.direction)
    except ClientFolderNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@router.delete(
    "/{folder_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    operation_id="delete_client_folder",
)
def remove_client_folder(folder_id: int, db: Session = Depends(get_db)) -> None:
    try:
        delete_client_folder(db, folder_id)
    except ClientFolderNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except ClientFolderValidationError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
