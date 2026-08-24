from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.sales import Client, ClientBankAccount
from app.schemas.client_requisites import (
    ClientBankAccountCreate,
    ClientBankAccountRead,
    ClientBankAccountUpdate,
)
from app.services.clients import ClientNotFoundError


class ClientBankAccountNotFoundError(RuntimeError):
    pass


class ClientBankAccountValidationError(RuntimeError):
    pass


def _to_read(row: ClientBankAccount) -> ClientBankAccountRead:
    return ClientBankAccountRead.model_validate(row)


def _get_account(db: Session, client_id: int, account_id: int) -> ClientBankAccount:
    row = db.get(ClientBankAccount, account_id)
    if row is None or row.client_id != client_id:
        raise ClientBankAccountNotFoundError("Счёт не найден")
    return row


def _ensure_client(db: Session, client_id: int) -> Client:
    client = db.get(Client, client_id)
    if client is None:
        raise ClientNotFoundError("Client not found")
    return client


def _clear_other_primary(db: Session, client_id: int, keep_id: int | None) -> None:
    statement = select(ClientBankAccount).where(ClientBankAccount.client_id == client_id)
    for row in db.scalars(statement).all():
        if keep_id is not None and row.id == keep_id:
            continue
        row.is_primary = False


def _next_sort_order(db: Session, client_id: int) -> int:
    current = db.scalar(
        select(func.coalesce(func.max(ClientBankAccount.sort_order), -1) + 1).where(
            ClientBankAccount.client_id == client_id
        )
    )
    return int(current or 0)


def create_bank_account(
    db: Session, client_id: int, payload: ClientBankAccountCreate
) -> ClientBankAccountRead:
    _ensure_client(db, client_id)
    fields_set = getattr(payload, "model_fields_set", set())
    sort_order = (
        payload.sort_order
        if "sort_order" in fields_set
        else _next_sort_order(db, client_id)
    )
    existing = list(
        db.scalars(
            select(ClientBankAccount).where(ClientBankAccount.client_id == client_id)
        ).all()
    )
    is_primary = payload.is_primary or len(existing) == 0
    row = ClientBankAccount(
        client_id=client_id,
        bank_name=payload.bank_name,
        bik=payload.bik,
        account_number=payload.account_number,
        corr_account=payload.corr_account,
        is_primary=is_primary,
        sort_order=sort_order,
    )
    db.add(row)
    db.flush()
    if is_primary:
        _clear_other_primary(db, client_id, row.id)
    db.commit()
    return _to_read(row)


def update_bank_account(
    db: Session,
    client_id: int,
    account_id: int,
    payload: ClientBankAccountUpdate,
) -> ClientBankAccountRead:
    _ensure_client(db, client_id)
    row = _get_account(db, client_id, account_id)
    changes = payload.model_dump(exclude_unset=True)
    if not changes:
        raise ClientBankAccountValidationError("Нет полей для обновления")
    for field_name, value in changes.items():
        setattr(row, field_name, value)
    if changes.get("is_primary") is True:
        _clear_other_primary(db, client_id, row.id)
    db.commit()
    return _to_read(row)


def delete_bank_account(db: Session, client_id: int, account_id: int) -> None:
    _ensure_client(db, client_id)
    row = _get_account(db, client_id, account_id)
    was_primary = row.is_primary
    db.delete(row)
    db.flush()
    if was_primary:
        next_row = db.scalar(
            select(ClientBankAccount)
            .where(ClientBankAccount.client_id == client_id)
            .order_by(ClientBankAccount.sort_order, ClientBankAccount.id)
            .limit(1)
        )
        if next_row is not None:
            next_row.is_primary = True
    db.commit()
