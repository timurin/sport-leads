"""Tech-card QR scan commands (ADR-030 / Stage 25)."""

from __future__ import annotations

from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.auth import PlatformUser
from app.models.technical_card import (
    TechnicalCard,
    TechnicalCardCompositionLineKind,
    TechnicalCardStageResult,
    TechnicalCardUnitLine,
)
from app.schemas.sewing_cabinet import SewingWorkTakeRequest
from app.schemas.tech_card_scan import (
    TechCardScanCommandRequest,
    TechCardScanMaterialRead,
    TechCardScanRead,
    TechCardScanStageRead,
    TechCardScanUnitRead,
)
from app.services import rbac as rbac_service
from app.services.fg_stock_posting import post_fg_on_stage_complete
from app.services.sewing_cabinet import (
    SewingCabinetConflictError,
    SewingCabinetForbiddenError,
    SewingCabinetValidationError,
    consume_reserved_piece_qty,
    take_work,
    user_can_write_cabinet,
)
from app.services.stage_executors import user_is_stage_executor
from app.services.tech_card_qr import ensure_qr_token, scan_url_for_token
from app.services.tech_card_wip import (
    TRANSFER_ACCEPT,
    TRANSFER_FORWARD,
    TRANSFER_RETURN,
    WIP_IN_WORK,
    WIP_PARTIAL,
    WIP_READY,
    WIP_RETURN,
    compute_wip_status,
    live_unit_lines,
    next_stage,
    ordered_stages,
    previous_stage,
    sync_card_from_unit_locations,
    unit_location_stage,
)
from app.services.technical_card_stages import (
    MATERIAL_FACT_GATE_STAGE_CODES,
    TechnicalCardConflictError,
    TechnicalCardNotFoundError,
    TechnicalCardValidationError,
    assert_material_fact_gate,
    resolve_production_stage_code,
)
from app.services.technical_cards import get_technical_card

WIP_STATUS_LABELS = {
    WIP_RETURN: "Возврат",
    WIP_READY: "Готова",
    WIP_PARTIAL: "Частично готова",
    WIP_IN_WORK: "В работе",
}

SEWING_CODE = "sewing"


class TechCardScanError(RuntimeError):
    pass


class TechCardScanNotFoundError(TechCardScanError):
    pass


class TechCardScanForbiddenError(TechCardScanError):
    pass


class TechCardScanValidationError(TechCardScanError):
    pass


class TechCardScanConflictError(TechCardScanError):
    pass


def _load_card_by_token(db: Session, token: str) -> TechnicalCard:
    cleaned = (token or "").strip()
    if not cleaned:
        raise TechCardScanNotFoundError("Техкарта не найдена")
    card = db.scalar(
        select(TechnicalCard)
        .where(TechnicalCard.qr_token == cleaned)
        .options(
            selectinload(TechnicalCard.unit_lines),
            selectinload(TechnicalCard.stage_results),
            selectinload(TechnicalCard.composition_lines),
            selectinload(TechnicalCard.operation_lines),
        )
    )
    if card is None:
        raise TechCardScanNotFoundError("Техкарта не найдена")
    return get_technical_card(db, card.id)


def _restricted_sewing_only(user: PlatformUser) -> bool:
    return rbac_service.is_sewing_cabinet_restricted(user)


def _user_may_scan_stage(
    db: Session,
    user: PlatformUser,
    *,
    production_stage_id: int,
    stage_code: str | None,
) -> bool:
    if stage_code == SEWING_CODE:
        return user_can_write_cabinet(user)
    if _restricted_sewing_only(user):
        return False
    return user_is_stage_executor(db, user, production_stage_id)


def _stage_options_for_units(
    db: Session,
    card: TechnicalCard,
    units: list[TechnicalCardUnitLine],
) -> list[tuple[TechnicalCardStageResult, str]]:
    seen: dict[int, tuple[TechnicalCardStageResult, str]] = {}
    for unit in units:
        current = unit_location_stage(card, unit)
        if current is None or current.production_stage_id is None:
            continue
        seen.setdefault(current.id, (current, "current"))
        nxt = next_stage(card, current)
        if nxt is not None and nxt.production_stage_id is not None:
            seen.setdefault(nxt.id, (nxt, "next"))
    return list(seen.values())


def _to_scan_read(
    db: Session,
    card: TechnicalCard,
    user: PlatformUser,
) -> TechCardScanRead:
    token = ensure_qr_token(db, card)
    units = live_unit_lines(card)
    options = _stage_options_for_units(db, card, units)
    allowed: list[TechCardScanStageRead] = []
    for stage, relation in options:
        code = resolve_production_stage_code(
            db, stage.production_stage_id, stage.stage_label
        )
        if stage.production_stage_id is None:
            continue
        if not _user_may_scan_stage(
            db, user, production_stage_id=stage.production_stage_id, stage_code=code
        ):
            continue
        allowed.append(
            TechCardScanStageRead(
                production_stage_id=stage.production_stage_id,
                stage_order=stage.stage_order,
                stage_label=stage.stage_label,
                stage_code=code,
                relation=relation,
            )
        )
    allowed.sort(key=lambda row: (row.stage_order, row.production_stage_id))
    unit_reads: list[TechCardScanUnitRead] = []
    for unit in sorted(units, key=lambda row: (row.unit_index, row.id)):
        stage = unit_location_stage(card, unit)
        unit_reads.append(
            TechCardScanUnitRead(
                id=unit.id,
                unit_index=unit.unit_index,
                size=unit.size,
                personalization=unit.personalization,
                print_number=unit.print_number,
                production_stage_id=(
                    stage.production_stage_id if stage is not None else None
                ),
                stage_label=stage.stage_label if stage is not None else None,
                last_transfer_kind=unit.last_transfer_kind,
                fg_receipt_posted=unit.fg_receipt_posted,
                fg_issue_posted=unit.fg_issue_posted,
            )
        )
    materials = [
        TechCardScanMaterialRead(
            composition_line_id=line.id,
            snapshot_name=line.snapshot_name,
            planned_qty=line.planned_qty,
            fact_qty=line.fact_qty,
            unit=line.unit,
            production_stage_id=line.production_stage_id,
        )
        for line in card.composition_lines or []
        if (
            line.line_kind == TechnicalCardCompositionLineKind.MATERIAL
            or str(line.line_kind) == TechnicalCardCompositionLineKind.MATERIAL.value
        )
    ]
    wip = compute_wip_status(db, card)
    return TechCardScanRead(
        technical_card_id=card.id,
        number=card.number,
        status=card.status.value if hasattr(card.status, "value") else str(card.status),
        wip_status=wip,
        wip_status_label=WIP_STATUS_LABELS.get(wip, wip),
        quantity=card.quantity,
        nomenclature_name=card.nomenclature_name,
        current_stage_label=card.current_stage_label,
        scan_url=scan_url_for_token(token),
        restricted_sewing_only=_restricted_sewing_only(user),
        units=unit_reads,
        allowed_stages=allowed,
        material_lines=materials,
        updated_at=card.updated_at,
    )


def get_scan(db: Session, token: str, user: PlatformUser) -> TechCardScanRead:
    card = _load_card_by_token(db, token)
    payload = _to_scan_read(db, card, user)
    if not payload.allowed_stages:
        raise TechCardScanForbiddenError("Нет доступного цеха для этого скана")
    db.commit()
    return payload


def _selected_units(
    card: TechnicalCard, unit_line_ids: list[int]
) -> list[TechnicalCardUnitLine]:
    by_id = {row.id: row for row in live_unit_lines(card)}
    missing = [unit_id for unit_id in unit_line_ids if unit_id not in by_id]
    if missing:
        raise TechCardScanValidationError("Выбраны неизвестные или списанные штуки")
    return [by_id[unit_id] for unit_id in unit_line_ids]


def _common_location(
    card: TechnicalCard, units: list[TechnicalCardUnitLine]
) -> TechnicalCardStageResult:
    stages = [unit_location_stage(card, unit) for unit in units]
    if any(stage is None for stage in stages):
        raise TechCardScanValidationError("У выбранных штук нет локации на маршруте")
    ids = {stage.id for stage in stages if stage is not None}
    if len(ids) != 1:
        raise TechCardScanValidationError("Выберите штуки на одном шаге маршрута")
    assert stages[0] is not None
    return stages[0]


def _resolve_chosen_stage(
    card: TechnicalCard,
    location: TechnicalCardStageResult,
    production_stage_id: int,
) -> tuple[TechnicalCardStageResult, str]:
    nxt = next_stage(card, location)
    if location.production_stage_id == production_stage_id:
        return location, "current"
    if nxt is not None and nxt.production_stage_id == production_stage_id:
        return nxt, "next"
    raise TechCardScanValidationError(
        "Цех скана должен быть текущим или следующим для выбранных штук"
    )


def _require_shop_fact(payload: TechCardScanCommandRequest, *, sewing: bool) -> None:
    if sewing:
        return
    if not payload.performer_name or not payload.work_done:
        raise TechCardScanValidationError(
            "Для передачи и возврата нужны исполнитель и описание работы"
        )


def _apply_stage_fact(
    stage: TechnicalCardStageResult,
    payload: TechCardScanCommandRequest,
) -> None:
    if payload.performer_name:
        stage.performer_name = payload.performer_name
    if payload.work_done:
        stage.work_done = payload.work_done
    if payload.duration_seconds is not None:
        stage.duration_seconds = payload.duration_seconds
    if payload.notes:
        stage.notes = payload.notes
    if payload.scrap_qty is not None:
        stage.scrap_qty = payload.scrap_qty
    if payload.rework_qty is not None:
        stage.rework_qty = payload.rework_qty
    if payload.work_center_id is not None:
        stage.work_center_id = payload.work_center_id


def _apply_material_facts(
    card: TechnicalCard,
    payload: TechCardScanCommandRequest,
    stage: TechnicalCardStageResult,
) -> None:
    if not payload.material_facts:
        return
    by_id = {line.id: line for line in card.composition_lines or []}
    for fact in payload.material_facts:
        line = by_id.get(fact.composition_line_id)
        if line is None:
            raise TechCardScanValidationError("Строка материала не найдена")
        if line.production_stage_id != stage.production_stage_id:
            raise TechCardScanValidationError(
                "Материал не относится к выбранному цеху"
            )
        line.fact_qty = fact.fact_qty


def _map_sewing_error(error: Exception) -> TechCardScanError:
    if isinstance(error, SewingCabinetForbiddenError):
        return TechCardScanForbiddenError(str(error))
    if isinstance(error, SewingCabinetConflictError):
        return TechCardScanConflictError(str(error))
    if isinstance(error, SewingCabinetValidationError):
        return TechCardScanValidationError(str(error))
    return TechCardScanValidationError(str(error))


def _prepare_command(
    db: Session,
    token: str,
    user: PlatformUser,
    payload: TechCardScanCommandRequest,
    *,
    require_current: bool,
) -> tuple[TechnicalCard, list[TechnicalCardUnitLine], TechnicalCardStageResult, str | None]:
    card = _load_card_by_token(db, token)
    units = _selected_units(card, payload.unit_line_ids)
    location = _common_location(card, units)
    chosen, relation = _resolve_chosen_stage(
        card, location, payload.production_stage_id
    )
    if require_current and relation != "current":
        raise TechCardScanValidationError(
            "Команда доступна только на текущем цехе выбранных штук"
        )
    code = resolve_production_stage_code(
        db, chosen.production_stage_id, chosen.stage_label
    )
    if chosen.production_stage_id is None:
        raise TechCardScanValidationError("У этапа нет цеха")
    if not _user_may_scan_stage(
        db,
        user,
        production_stage_id=chosen.production_stage_id,
        stage_code=code,
    ):
        raise TechCardScanForbiddenError("Недостаточно прав для этого цеха")
    if _restricted_sewing_only(user) and code != SEWING_CODE:
        raise TechCardScanForbiddenError("Кабинет швеи: скан только для Пошива")
    return card, units, chosen, code


def accept_scan(
    db: Session,
    token: str,
    user: PlatformUser,
    payload: TechCardScanCommandRequest,
) -> TechCardScanRead:
    try:
        card, units, stage, code = _prepare_command(
            db, token, user, payload, require_current=True
        )
        if code == SEWING_CODE:
            try:
                take_work(
                    db,
                    user,
                    SewingWorkTakeRequest(
                        technical_card_id=card.id,
                        kind="piece",
                        qty=Decimal(len(units)),
                    ),
                )
            except Exception as error:
                raise _map_sewing_error(error) from error
        for unit in units:
            unit.last_transfer_kind = TRANSFER_ACCEPT
        _apply_stage_fact(stage, payload)
        sync_card_from_unit_locations(db, card)
        db.commit()
        return _to_scan_read(db, get_technical_card(db, card.id), user)
    except (
        TechnicalCardNotFoundError,
        TechnicalCardValidationError,
        TechnicalCardConflictError,
    ) as error:
        raise TechCardScanValidationError(str(error)) from error


def complete_transfer_scan(
    db: Session,
    token: str,
    user: PlatformUser,
    payload: TechCardScanCommandRequest,
) -> TechCardScanRead:
    try:
        card, units, stage, code = _prepare_command(
            db, token, user, payload, require_current=True
        )
        nxt = next_stage(card, stage)
        if nxt is None:
            raise TechCardScanValidationError("Дальше по маршруту передавать некуда")
        sewing = code == SEWING_CODE
        _require_shop_fact(payload, sewing=sewing)
        _apply_material_facts(card, payload, stage)
        if code in MATERIAL_FACT_GATE_STAGE_CODES:
            assert_material_fact_gate(db, card, stage)
        if sewing:
            try:
                consume_reserved_piece_qty(
                    db, user, card, Decimal(len(units)), action="complete"
                )
            except Exception as error:
                raise _map_sewing_error(error) from error
        _apply_stage_fact(stage, payload)
        dest_code = resolve_production_stage_code(
            db, nxt.production_stage_id, nxt.stage_label
        )
        for unit in units:
            unit.production_stage_id = nxt.production_stage_id
            unit.last_transfer_kind = TRANSFER_FORWARD
        sync_card_from_unit_locations(db, card)
        post_fg_on_stage_complete(db, card, dest_code, units=units)
        db.commit()
        return _to_scan_read(db, get_technical_card(db, card.id), user)
    except (
        TechnicalCardNotFoundError,
        TechnicalCardValidationError,
        TechnicalCardConflictError,
    ) as error:
        raise TechCardScanValidationError(str(error)) from error


def return_scan(
    db: Session,
    token: str,
    user: PlatformUser,
    payload: TechCardScanCommandRequest,
) -> TechCardScanRead:
    try:
        card, units, stage, code = _prepare_command(
            db, token, user, payload, require_current=True
        )
        prev = previous_stage(card, stage)
        if prev is None:
            raise TechCardScanValidationError("Возвращать некуда — это первый шаг")
        sewing = code == SEWING_CODE
        _require_shop_fact(payload, sewing=sewing)
        if sewing:
            try:
                consume_reserved_piece_qty(
                    db, user, card, Decimal(len(units)), action="release"
                )
            except Exception as error:
                raise _map_sewing_error(error) from error
        _apply_stage_fact(stage, payload)
        for unit in units:
            unit.production_stage_id = prev.production_stage_id
            unit.last_transfer_kind = TRANSFER_RETURN
        sync_card_from_unit_locations(db, card)
        db.commit()
        return _to_scan_read(db, get_technical_card(db, card.id), user)
    except (
        TechnicalCardNotFoundError,
        TechnicalCardValidationError,
        TechnicalCardConflictError,
    ) as error:
        raise TechCardScanValidationError(str(error)) from error
