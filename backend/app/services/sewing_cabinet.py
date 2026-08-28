"""Sewing work ledger + cabinet queries (ADR-029 / 24.2)."""

from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Literal

from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session, selectinload

from app.models.auth import PlatformUser
from app.models.product_model import AssemblyOperationLine
from app.models.rbac import Permission, Role
from app.models.sales import (
    SalesOrderItem,
    SalesOrderItemAssemblyOperationSnapshot,
)
from app.models.sewing_work_ledger import (
    SewingWorkKind,
    SewingWorkLedgerEntry,
    SewingWorkStatus,
)
from app.models.technical_card import (
    TechnicalCard,
    TechnicalCardOperationLine,
    TechnicalCardOperationLineSourceKind,
    TechnicalCardStatus,
)
from app.schemas.sewing_cabinet import (
    SewingCabinetPeriodRead,
    SewingCabinetProfileRead,
    SewingCabinetRead,
    SewingQueueCardRead,
    SewingQueueOperationRead,
    SewingSewerListItem,
    SewingWorkEntryRead,
    SewingWorkTakeRequest,
)
from app.services import rbac as rbac_service
from app.services.technical_card_stages import (
    resolve_production_stage_code,
)

SEWING_STAGE_CODE = "sewing"
BUSY_STATUSES = (SewingWorkStatus.RESERVED, SewingWorkStatus.COMPLETED)
MONEY_QUANT = Decimal("0.01")
PeriodPreset = Literal["day", "week", "month", "custom"]


class SewingCabinetError(RuntimeError):
    pass


class SewingCabinetNotFoundError(SewingCabinetError):
    pass


class SewingCabinetValidationError(SewingCabinetError):
    pass


class SewingCabinetConflictError(SewingCabinetError):
    pass


class SewingCabinetForbiddenError(SewingCabinetError):
    pass


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def period_bounds(
    preset: PeriodPreset,
    date_from: date | None = None,
    date_to: date | None = None,
    *,
    now: datetime | None = None,
) -> tuple[datetime, datetime]:
    """Return half-open UTC interval [start, end)."""
    moment = _as_utc(now or _utc_now())
    today = moment.date()
    if preset == "custom":
        if date_from is None or date_to is None:
            raise SewingCabinetValidationError(
                "Для произвольного периода укажите date_from и date_to"
            )
        if date_to < date_from:
            raise SewingCabinetValidationError("date_to не может быть раньше date_from")
        start = datetime.combine(date_from, time.min, tzinfo=timezone.utc)
        end = datetime.combine(date_to + timedelta(days=1), time.min, tzinfo=timezone.utc)
        return start, end
    if preset == "day":
        start = datetime.combine(today, time.min, tzinfo=timezone.utc)
        end = start + timedelta(days=1)
        return start, end
    if preset == "week":
        start_date = today - timedelta(days=today.weekday())
        start = datetime.combine(start_date, time.min, tzinfo=timezone.utc)
        end = start + timedelta(days=7)
        return start, end
    if preset == "month":
        start = datetime.combine(today.replace(day=1), time.min, tzinfo=timezone.utc)
        if today.month == 12:
            end = datetime(today.year + 1, 1, 1, tzinfo=timezone.utc)
        else:
            end = datetime(today.year, today.month + 1, 1, tzinfo=timezone.utc)
        return start, end
    raise SewingCabinetValidationError(f"Неизвестный период: {preset}")


def user_can_access_cabinet(user: PlatformUser) -> bool:
    codes = rbac_service.permission_codes_for_user(user)
    return bool(
        {
            rbac_service.PERM_SEWING_CABINET_READ_OWN,
            rbac_service.PERM_SEWING_CABINET_READ_ANY,
            rbac_service.PERM_SEWING_CABINET_WRITE,
        }
        & set(codes)
    )


def user_can_write_cabinet(user: PlatformUser) -> bool:
    return rbac_service.user_has_permission(
        user, rbac_service.PERM_SEWING_CABINET_WRITE
    )


def user_can_manage_cabinets(user: PlatformUser) -> bool:
    return rbac_service.user_has_permission(
        user, rbac_service.PERM_SEWING_CABINET_READ_ANY
    )


def ensure_cabinet_access(user: PlatformUser) -> None:
    if not user_can_access_cabinet(user):
        raise SewingCabinetForbiddenError("Недостаточно прав для кабинета швеи")


def _money(value: Decimal) -> Decimal:
    return value.quantize(MONEY_QUANT, rounding=ROUND_HALF_UP)


def _match_assembly_economics(
    rows: list,
    line: TechnicalCardOperationLine,
) -> Decimal | None:
    """Pick cost from snapshot or live variant lines (26.10.7)."""
    by_op_id = None
    by_name = None
    for row in rows:
        if (
            line.sewing_operation_id is not None
            and row.sewing_operation_id == line.sewing_operation_id
        ):
            by_op_id = row
            break
        if by_name is None and row.operation_name == line.operation_name:
            by_name = row
    match = by_op_id or by_name
    if match is None:
        return None
    return _money(Decimal(match.cost))


def _operation_unit_price(
    db: Session,
    card: TechnicalCard,
    line: TechnicalCardOperationLine,
) -> Decimal | None:
    """Resolve operation take/queue price from assembly, not catalog."""
    if card.sales_order_item_id is not None:
        item = db.get(SalesOrderItem, card.sales_order_item_id)
        if item is not None:
            snaps = list(item.assembly_operation_snapshots)
            found = _match_assembly_economics(snaps, line)
            if found is not None:
                return found
    if card.assembly_variant_id is not None:
        variant_lines = list(
            db.scalars(
                select(AssemblyOperationLine).where(
                    AssemblyOperationLine.assembly_variant_id
                    == card.assembly_variant_id
                )
            ).all()
        )
        return _match_assembly_economics(variant_lines, line)
    return None


def _entry_amount(entry: SewingWorkLedgerEntry) -> Decimal:
    if entry.status != SewingWorkStatus.COMPLETED:
        return Decimal("0.00")
    return _money(entry.qty * entry.unit_price)


def _card_is_on_sewing(db: Session, card: TechnicalCard) -> bool:
    if card.status != TechnicalCardStatus.IN_PROGRESS:
        return False
    return _piece_cap(db, card) > 0


def _lock_card(db: Session, card_id: int) -> TechnicalCard:
    card = db.scalars(
        select(TechnicalCard)
        .where(TechnicalCard.id == card_id)
        .options(
            selectinload(TechnicalCard.stage_results),
            selectinload(TechnicalCard.unit_lines),
            selectinload(TechnicalCard.operation_lines),
        )
        .with_for_update()
    ).first()
    if card is None:
        raise SewingCabinetNotFoundError("Техкарта не найдена")
    return card


def _busy_qty(
    db: Session,
    *,
    technical_card_id: int,
    kind: SewingWorkKind,
    operation_line_id: int | None,
) -> Decimal:
    stmt: Select[tuple[Decimal | None]] = select(
        func.coalesce(func.sum(SewingWorkLedgerEntry.qty), 0)
    ).where(
        SewingWorkLedgerEntry.technical_card_id == technical_card_id,
        SewingWorkLedgerEntry.kind == kind,
        SewingWorkLedgerEntry.status.in_(BUSY_STATUSES),
    )
    if kind == SewingWorkKind.OPERATION:
        stmt = stmt.where(SewingWorkLedgerEntry.operation_line_id == operation_line_id)
    else:
        stmt = stmt.where(SewingWorkLedgerEntry.operation_line_id.is_(None))
    value = db.scalar(stmt)
    return Decimal(value or 0)


def _piece_cap(db: Session, card: TechnicalCard) -> int:
    from app.services.tech_card_wip import live_unit_lines, unit_location_stage

    units = live_unit_lines(card)
    sewing_count = 0
    for unit in units:
        stage = unit_location_stage(card, unit)
        if stage is None:
            continue
        code = resolve_production_stage_code(
            db, stage.production_stage_id, stage.stage_label
        )
        if code == SEWING_STAGE_CODE:
            sewing_count += 1
    return sewing_count


def remaining_piece_qty(db: Session, card: TechnicalCard) -> Decimal:
    cap = Decimal(_piece_cap(db, card))
    busy = _busy_qty(
        db,
        technical_card_id=card.id,
        kind=SewingWorkKind.PIECE,
        operation_line_id=None,
    )
    return cap - busy


def remaining_operation_qty(
    db: Session,
    line: TechnicalCardOperationLine,
) -> Decimal:
    busy = _busy_qty(
        db,
        technical_card_id=line.technical_card_id,
        kind=SewingWorkKind.OPERATION,
        operation_line_id=line.id,
    )
    return Decimal(line.volume) - busy


def _to_entry_read(
    entry: SewingWorkLedgerEntry,
    card_number: str,
) -> SewingWorkEntryRead:
    return SewingWorkEntryRead(
        id=entry.id,
        platform_user_id=entry.platform_user_id,
        technical_card_id=entry.technical_card_id,
        technical_card_number=card_number,
        kind=entry.kind.value if isinstance(entry.kind, SewingWorkKind) else entry.kind,
        operation_line_id=entry.operation_line_id,
        qty=entry.qty,
        status=(
            entry.status.value
            if isinstance(entry.status, SewingWorkStatus)
            else entry.status
        ),
        unit_price=entry.unit_price,
        price_label=entry.price_label,
        amount=_entry_amount(entry),
        taken_at=entry.taken_at,
        completed_at=entry.completed_at,
        released_at=entry.released_at,
    )


def list_sewing_queue(db: Session) -> list[SewingQueueCardRead]:
    cards = db.scalars(
        select(TechnicalCard)
        .where(TechnicalCard.status == TechnicalCardStatus.IN_PROGRESS)
        .options(
            selectinload(TechnicalCard.stage_results),
            selectinload(TechnicalCard.unit_lines),
            selectinload(TechnicalCard.operation_lines),
        )
        .order_by(TechnicalCard.id.desc())
    ).all()
    sewing_cards = [card for card in cards if _card_is_on_sewing(db, card)]
    if not sewing_cards:
        return []
    card_ids = [card.id for card in sewing_cards]
    busy_rows = db.execute(
        select(
            SewingWorkLedgerEntry.technical_card_id,
            SewingWorkLedgerEntry.kind,
            SewingWorkLedgerEntry.operation_line_id,
            func.coalesce(func.sum(SewingWorkLedgerEntry.qty), 0),
        )
        .where(
            SewingWorkLedgerEntry.technical_card_id.in_(card_ids),
            SewingWorkLedgerEntry.status.in_(BUSY_STATUSES),
        )
        .group_by(
            SewingWorkLedgerEntry.technical_card_id,
            SewingWorkLedgerEntry.kind,
            SewingWorkLedgerEntry.operation_line_id,
        )
    ).all()
    busy_piece: dict[int, Decimal] = {}
    busy_op: dict[int, Decimal] = {}
    for card_id, kind, operation_line_id, qty in busy_rows:
        amount = Decimal(qty or 0)
        kind_value = kind.value if isinstance(kind, SewingWorkKind) else kind
        if kind_value == SewingWorkKind.PIECE:
            busy_piece[card_id] = amount
        elif operation_line_id is not None:
            busy_op[operation_line_id] = amount

    item_ids = {
        card.sales_order_item_id
        for card in sewing_cards
        if card.sales_order_item_id is not None
    }
    snapshots_by_item: dict[int, list[SalesOrderItemAssemblyOperationSnapshot]] = {}
    if item_ids:
        for snap in db.scalars(
            select(SalesOrderItemAssemblyOperationSnapshot).where(
                SalesOrderItemAssemblyOperationSnapshot.order_item_id.in_(item_ids)
            )
        ).all():
            snapshots_by_item.setdefault(snap.order_item_id, []).append(snap)
    variant_ids = {
        card.assembly_variant_id
        for card in sewing_cards
        if card.assembly_variant_id is not None
    }
    lines_by_variant: dict[int, list[AssemblyOperationLine]] = {}
    if variant_ids:
        for row in db.scalars(
            select(AssemblyOperationLine).where(
                AssemblyOperationLine.assembly_variant_id.in_(variant_ids)
            )
        ).all():
            lines_by_variant.setdefault(row.assembly_variant_id, []).append(row)

    result: list[SewingQueueCardRead] = []
    for card in sewing_cards:
        operations: list[SewingQueueOperationRead] = []
        for line in card.operation_lines:
            if line.source_kind != TechnicalCardOperationLineSourceKind.SEWING:
                continue
            volume = Decimal(line.volume)
            remaining = volume - busy_op.get(line.id, Decimal("0"))
            live_cost = None
            if card.sales_order_item_id is not None:
                live_cost = _match_assembly_economics(
                    snapshots_by_item.get(card.sales_order_item_id, []),
                    line,
                )
            if live_cost is None and card.assembly_variant_id is not None:
                live_cost = _match_assembly_economics(
                    lines_by_variant.get(card.assembly_variant_id, []),
                    line,
                )
            operations.append(
                SewingQueueOperationRead(
                    operation_line_id=line.id,
                    operation_name=line.operation_name,
                    volume=volume,
                    remaining=remaining,
                    unit_price=live_cost,
                )
            )
        piece_cap = _piece_cap(db, card)
        piece_remaining = Decimal(piece_cap) - busy_piece.get(card.id, Decimal("0"))
        result.append(
            SewingQueueCardRead(
                technical_card_id=card.id,
                number=card.number,
                nomenclature_name=card.nomenclature_name,
                product_model_name=card.product_model_name,
                assembly_variant_name=card.assembly_variant_name,
                piece_cap=piece_cap,
                piece_remaining=piece_remaining,
                piece_unit_price=card.assembly_variant_total_cost,
                operations=operations,
            )
        )
    return result


def take_work(
    db: Session,
    actor: PlatformUser,
    payload: SewingWorkTakeRequest,
) -> SewingWorkEntryRead:
    if not user_can_write_cabinet(actor):
        raise SewingCabinetForbiddenError("Недостаточно прав: sewing_cabinet.write")
    qty = Decimal(payload.qty)
    if qty <= 0:
        raise SewingCabinetValidationError("Количество должно быть больше нуля")
    card = _lock_card(db, payload.technical_card_id)
    if not _card_is_on_sewing(db, card):
        raise SewingCabinetValidationError("Техкарта не на этапе Пошив")

    now = _utc_now()
    if payload.kind == "piece":
        if qty != qty.to_integral_value():
            raise SewingCabinetValidationError("Количество штук должно быть целым")
        if card.assembly_variant_total_cost is None:
            raise SewingCabinetValidationError(
                "Take штук недоступен: нет стоимости варианта сборки"
            )
        remaining = remaining_piece_qty(db, card)
        if qty > remaining:
            raise SewingCabinetConflictError("Недостаточно остатка пула штук")
        unit_price = _money(Decimal(card.assembly_variant_total_cost))
        price_label = (
            card.assembly_variant_name or card.nomenclature_name or "Изделие"
        ).strip() or "Изделие"
        entry = SewingWorkLedgerEntry(
            platform_user_id=actor.id,
            technical_card_id=card.id,
            kind=SewingWorkKind.PIECE,
            operation_line_id=None,
            qty=qty,
            status=SewingWorkStatus.RESERVED,
            unit_price=unit_price,
            price_label=price_label,
            taken_at=now,
        )
    else:
        line = next(
            (
                row
                for row in card.operation_lines
                if row.id == payload.operation_line_id
            ),
            None,
        )
        if line is None:
            raise SewingCabinetNotFoundError("Операция техкарты не найдена")
        if line.source_kind != TechnicalCardOperationLineSourceKind.SEWING:
            raise SewingCabinetValidationError(
                "Take операции доступен только для строк пошива"
            )
        if line.sewing_operation_id is None:
            raise SewingCabinetValidationError(
                "Take операции недоступен: нет операции каталога"
            )
        unit_price = _operation_unit_price(db, card, line)
        if unit_price is None:
            raise SewingCabinetValidationError(
                "Take операции недоступен: нет стоимости в сборке"
            )
        remaining = remaining_operation_qty(db, line)
        if qty > remaining:
            raise SewingCabinetConflictError("Недостаточно остатка пула операции")
        entry = SewingWorkLedgerEntry(
            platform_user_id=actor.id,
            technical_card_id=card.id,
            kind=SewingWorkKind.OPERATION,
            operation_line_id=line.id,
            qty=qty,
            status=SewingWorkStatus.RESERVED,
            unit_price=unit_price,
            price_label=line.operation_name,
            taken_at=now,
        )
    db.add(entry)
    db.flush()
    return _to_entry_read(entry, card.number)


def consume_reserved_piece_qty(
    db: Session,
    actor: PlatformUser,
    card: TechnicalCard,
    qty: Decimal,
    *,
    action: Literal["complete", "release"],
) -> None:
    """FIFO consume this actor's reserved piece rows (split leftover if needed)."""
    if qty <= 0:
        raise SewingCabinetValidationError("Количество должно быть больше нуля")
    if not user_can_write_cabinet(actor):
        raise SewingCabinetForbiddenError("Недостаточно прав: sewing_cabinet.write")
    remaining = qty
    entries = db.scalars(
        select(SewingWorkLedgerEntry)
        .where(
            SewingWorkLedgerEntry.technical_card_id == card.id,
            SewingWorkLedgerEntry.platform_user_id == actor.id,
            SewingWorkLedgerEntry.kind == SewingWorkKind.PIECE,
            SewingWorkLedgerEntry.status == SewingWorkStatus.RESERVED,
        )
        .order_by(
            SewingWorkLedgerEntry.taken_at.asc(),
            SewingWorkLedgerEntry.id.asc(),
        )
    ).all()
    reserved_total = sum((row.qty for row in entries), Decimal("0"))
    if reserved_total < remaining:
        if action == "release":
            remaining = reserved_total
            if remaining <= 0:
                return
        else:
            raise SewingCabinetConflictError("Сначала примите в работу выбранные штуки")
    now = _utc_now()
    for entry in entries:
        if remaining <= 0:
            break
        if entry.qty <= remaining:
            remaining -= entry.qty
            if action == "complete":
                entry.status = SewingWorkStatus.COMPLETED
                entry.completed_at = now
            else:
                entry.status = SewingWorkStatus.RELEASED
                entry.released_at = now
            continue
        leftover = entry.qty - remaining
        entry.qty = remaining
        if action == "complete":
            entry.status = SewingWorkStatus.COMPLETED
            entry.completed_at = now
        else:
            entry.status = SewingWorkStatus.RELEASED
            entry.released_at = now
        db.add(
            SewingWorkLedgerEntry(
                platform_user_id=entry.platform_user_id,
                technical_card_id=entry.technical_card_id,
                kind=SewingWorkKind.PIECE,
                operation_line_id=None,
                qty=leftover,
                status=SewingWorkStatus.RESERVED,
                unit_price=entry.unit_price,
                price_label=entry.price_label,
                taken_at=entry.taken_at,
            )
        )
        remaining = Decimal("0")
    db.flush()


def _get_entry(db: Session, entry_id: int) -> SewingWorkLedgerEntry:
    entry = db.get(SewingWorkLedgerEntry, entry_id)
    if entry is None:
        raise SewingCabinetNotFoundError("Строка журнала не найдена")
    return entry


def _ensure_row_writer(actor: PlatformUser, entry: SewingWorkLedgerEntry) -> None:
    if not user_can_write_cabinet(actor):
        raise SewingCabinetForbiddenError("Недостаточно прав: sewing_cabinet.write")
    if entry.platform_user_id == actor.id:
        return
    if user_can_manage_cabinets(actor):
        return
    raise SewingCabinetForbiddenError("Недостаточно прав для этой строки")


def complete_work(
    db: Session,
    actor: PlatformUser,
    entry_id: int,
) -> SewingWorkEntryRead:
    entry = _get_entry(db, entry_id)
    _ensure_row_writer(actor, entry)
    if entry.status != SewingWorkStatus.RESERVED:
        raise SewingCabinetValidationError("Закрыть можно только строку в резерве")
    entry.status = SewingWorkStatus.COMPLETED
    entry.completed_at = _utc_now()
    db.flush()
    card = db.get(TechnicalCard, entry.technical_card_id)
    number = card.number if card is not None else str(entry.technical_card_id)
    return _to_entry_read(entry, number)


def release_work(
    db: Session,
    actor: PlatformUser,
    entry_id: int,
) -> SewingWorkEntryRead:
    entry = _get_entry(db, entry_id)
    _ensure_row_writer(actor, entry)
    if entry.status != SewingWorkStatus.RESERVED:
        raise SewingCabinetValidationError("Отказаться можно только от строки в резерве")
    entry.status = SewingWorkStatus.RELEASED
    entry.released_at = _utc_now()
    db.flush()
    card = db.get(TechnicalCard, entry.technical_card_id)
    number = card.number if card is not None else str(entry.technical_card_id)
    return _to_entry_read(entry, number)


def _load_user(db: Session, user_id: int) -> PlatformUser:
    user = rbac_service.load_user_with_rbac(db, user_id)
    if user is None or not user.is_active:
        raise SewingCabinetNotFoundError("Пользователь не найден")
    return user


def get_cabinet(
    db: Session,
    actor: PlatformUser,
    platform_user_id: int,
    *,
    preset: PeriodPreset = "day",
    date_from: date | None = None,
    date_to: date | None = None,
    include_queue: bool = False,
) -> SewingCabinetRead:
    ensure_cabinet_access(actor)
    if platform_user_id != actor.id and not user_can_manage_cabinets(actor):
        raise SewingCabinetForbiddenError("Недостаточно прав: sewing_cabinet.read_any")
    target = _load_user(db, platform_user_id)
    start, end = period_bounds(preset, date_from, date_to)
    entries = db.scalars(
        select(SewingWorkLedgerEntry)
        .where(SewingWorkLedgerEntry.platform_user_id == platform_user_id)
        .order_by(SewingWorkLedgerEntry.taken_at.desc(), SewingWorkLedgerEntry.id.desc())
    ).all()
    card_ids = {row.technical_card_id for row in entries}
    numbers: dict[int, str] = {}
    if card_ids:
        for card_id, number in db.execute(
            select(TechnicalCard.id, TechnicalCard.number).where(
                TechnicalCard.id.in_(card_ids)
            )
        ).all():
            numbers[card_id] = number
    reserved: list[SewingWorkEntryRead] = []
    history: list[SewingWorkEntryRead] = []
    earnings = Decimal("0.00")
    for entry in entries:
        read = _to_entry_read(
            entry, numbers.get(entry.technical_card_id, str(entry.technical_card_id))
        )
        if entry.status == SewingWorkStatus.RESERVED:
            reserved.append(read)
            continue
        stamp = entry.completed_at or entry.released_at or entry.taken_at
        stamp = _as_utc(stamp)
        if stamp < start or stamp >= end:
            continue
        history.append(read)
        if entry.status == SewingWorkStatus.COMPLETED:
            earnings += read.amount
    queue = list_sewing_queue(db) if include_queue else None
    return SewingCabinetRead(
        profile=SewingCabinetProfileRead(
            id=target.id,
            login=target.login,
            display_name=target.display_name,
            photo_url=None,
        ),
        period=SewingCabinetPeriodRead(
            preset=preset,
            date_from=start,
            date_to=end,
        ),
        earnings_completed=_money(earnings),
        reserved=reserved,
        history=history,
        queue=queue,
        can_write=user_can_write_cabinet(actor) and platform_user_id == actor.id,
        can_manage=user_can_manage_cabinets(actor),
    )


def list_sewers(
    db: Session,
    actor: PlatformUser,
    *,
    preset: PeriodPreset = "day",
    date_from: date | None = None,
    date_to: date | None = None,
) -> list[SewingSewerListItem]:
    if not user_can_manage_cabinets(actor):
        raise SewingCabinetForbiddenError("Недостаточно прав: sewing_cabinet.read_any")
    start, end = period_bounds(preset, date_from, date_to)
    sewing_codes = (
        rbac_service.PERM_SEWING_CABINET_READ_OWN,
        rbac_service.PERM_SEWING_CABINET_WRITE,
    )
    users = db.scalars(
        select(PlatformUser)
        .where(PlatformUser.is_active.is_(True))
        .join(PlatformUser.roles)
        .join(Role.permissions)
        .where(Permission.code.in_(sewing_codes))
        .options(selectinload(PlatformUser.roles).selectinload(Role.permissions))
        .distinct()
        .order_by(PlatformUser.display_name, PlatformUser.id)
    ).all()
    if not users:
        return []
    user_ids = [user.id for user in users]
    reserved_rows = db.execute(
        select(
            SewingWorkLedgerEntry.platform_user_id,
            func.count(SewingWorkLedgerEntry.id),
        )
        .where(
            SewingWorkLedgerEntry.platform_user_id.in_(user_ids),
            SewingWorkLedgerEntry.status == SewingWorkStatus.RESERVED,
        )
        .group_by(SewingWorkLedgerEntry.platform_user_id)
    ).all()
    reserved_map = {user_id: int(count) for user_id, count in reserved_rows}
    earning_rows = db.execute(
        select(
            SewingWorkLedgerEntry.platform_user_id,
            SewingWorkLedgerEntry.qty,
            SewingWorkLedgerEntry.unit_price,
        ).where(
            SewingWorkLedgerEntry.platform_user_id.in_(user_ids),
            SewingWorkLedgerEntry.status == SewingWorkStatus.COMPLETED,
            SewingWorkLedgerEntry.completed_at >= start,
            SewingWorkLedgerEntry.completed_at < end,
        )
    ).all()
    earnings_map: dict[int, Decimal] = {user_id: Decimal("0.00") for user_id in user_ids}
    for user_id, qty, unit_price in earning_rows:
        earnings_map[user_id] = _money(
            earnings_map.get(user_id, Decimal("0.00")) + (Decimal(qty) * Decimal(unit_price))
        )
    return [
        SewingSewerListItem(
            id=user.id,
            login=user.login,
            display_name=user.display_name,
            photo_url=None,
            reserved_count=reserved_map.get(user.id, 0),
            earnings_completed=earnings_map.get(user.id, Decimal("0.00")),
        )
        for user in users
    ]
