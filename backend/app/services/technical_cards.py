"""Technical card generate / unit-line sync (ADR-016 / Stage 9.2.1).

Eligible = linked nomenclature `PRODUCT` (MVP). Spec is outbound (Stage 7) — not
required for generate. Routing / TechOperation snapshot applied when Stage 8
catalogs exist (ADR-017); otherwise left empty (no demo rows).
"""

from __future__ import annotations

import base64
import binascii
import re
import uuid
from dataclasses import dataclass, field
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation
from pathlib import Path

from sqlalchemy import func, inspect, select, text
from sqlalchemy.orm import Session, selectinload

from app.models.nomenclature import Nomenclature, NomenclatureType
from app.models.product_model import ProductModel, ProductModelOperationNorm
from app.models.production_stage import ProductionStage
from app.models.sales import Client, SalesOrder, SalesOrderItem, SalesUser
from app.models.size_grid import SizeGrid
from app.models.tech_operation import TechOperation, TechOperationRequiredMaterial
from app.models.technical_card import (
    TechnicalCard,
    TechnicalCardCompositionLine,
    TechnicalCardCompositionLineKind,
    TechnicalCardMedia,
    TechnicalCardOperationLine,
    TechnicalCardOperationLineSourceKind,
    TechnicalCardStageResult,
    TechnicalCardStageResultStatus,
    TechnicalCardStatus,
    TechnicalCardUnitLine,
    TechOperationVolumeUnit,
)
from app.repositories import product_model_routings as product_model_routings_repo
from app.schemas.technical_card import (
    TechnicalCardApplySpecification,
    TechnicalCardAssemblySewingOpRead,
    TechnicalCardCompositionLineWrite,
    TechnicalCardMediaCreate,
    TechnicalCardMediaRead,
    TechnicalCardOperationLineWrite,
    TechnicalCardPreviewLine,
    TechnicalCardPreviewRead,
    TechnicalCardRead,
    TechnicalCardSkippedLine,
    TechnicalCardUnitLineBulkItem,
    TechnicalCardUnitLineImportRow,
    TechnicalCardUnitLineUpdate,
    TechnicalCardUnitLineWrite,
    map_product_model_size_type_to_unit_line,
)
from app.services.technical_card_settings import get_technical_card_settings
from app.services.file_io import FileIoParseError, parse_tabular_bytes

MEDIA_ROOT = Path("storage/technical-card-media").resolve()
MAX_TECH_CARD_MEDIA = 3
MAX_MEDIA_BYTES = 10 * 1024 * 1024

# Optional/phase-in table:
# If DB isn't migrated yet (e.g. `technical_card_media` missing),
# listing tech cards must still work; media gallery becomes empty.
_TECH_CARD_MEDIA_TABLE_AVAILABLE: bool | None = None


def _technical_card_media_table_available(db: Session) -> bool:
    global _TECH_CARD_MEDIA_TABLE_AVAILABLE
    if _TECH_CARD_MEDIA_TABLE_AVAILABLE is not None:
        return _TECH_CARD_MEDIA_TABLE_AVAILABLE

    try:
        bind = db.get_bind()
        dialect_name = getattr(bind.dialect, "name", "") or ""

        # Postgres
        if dialect_name.startswith("postgres"):
            available = db.execute(
                text("SELECT to_regclass('technical_card_media') IS NOT NULL")
            ).scalar()
            _TECH_CARD_MEDIA_TABLE_AVAILABLE = bool(available)
            return _TECH_CARD_MEDIA_TABLE_AVAILABLE

        # SQLite
        if dialect_name.startswith("sqlite"):
            available = db.execute(
                text(
                    "SELECT 1 FROM sqlite_master WHERE type='table' AND name=:n LIMIT 1"
                ),
                {"n": "technical_card_media"},
            ).first()
            _TECH_CARD_MEDIA_TABLE_AVAILABLE = available is not None
            return _TECH_CARD_MEDIA_TABLE_AVAILABLE

        # Fallback: SQLAlchemy inspector
        insp = inspect(bind)
        schema = getattr(insp, "default_schema_name", None)
        if schema:
            _TECH_CARD_MEDIA_TABLE_AVAILABLE = bool(
                insp.has_table("technical_card_media", schema=schema)
            )
        else:
            _TECH_CARD_MEDIA_TABLE_AVAILABLE = bool(
                insp.has_table("technical_card_media")
            )
    except Exception:
        # If we can't inspect, fail open for listing.
        _TECH_CARD_MEDIA_TABLE_AVAILABLE = False

    return _TECH_CARD_MEDIA_TABLE_AVAILABLE


class TechnicalCardNotFoundError(RuntimeError):
    pass


class TechnicalCardValidationError(RuntimeError):
    pass


class TechnicalCardConflictError(RuntimeError):
    pass


@dataclass
class TechnicalCardGenerateResult:
    sales_order_id: int
    created: list[TechnicalCard] = field(default_factory=list)
    revived: list[TechnicalCard] = field(default_factory=list)
    skipped: list[TechnicalCardSkippedLine] = field(default_factory=list)


def _card_load_options(db: Session):
    options: list = [
        selectinload(TechnicalCard.composition_lines),
        selectinload(TechnicalCard.unit_lines),
        selectinload(TechnicalCard.operation_lines),
        selectinload(TechnicalCard.stage_results),
    ]

    if _technical_card_media_table_available(db):
        options.append(selectinload(TechnicalCard.media_items))

    options.extend(
        [
            selectinload(TechnicalCard.order),
            selectinload(TechnicalCard.order_item).selectinload(
                SalesOrderItem.assembly_operation_snapshots
            ),
        ]
    )

    return tuple(options)


def tech_card_media_content_url(card_id: int, media_id: int) -> str:
    return f"/technical-cards/{card_id}/media/{media_id}/content"


def to_technical_card_read(db: Session, card: TechnicalCard) -> TechnicalCardRead:
    order = card.order
    if order is None and card.sales_order_id is not None:
        order = db.get(SalesOrder, card.sales_order_id)

    order_number = order.number if order is not None else None
    desired_date = order.desired_date if order is not None else None
    client_name: str | None = None
    responsible_name: str | None = None
    if order is not None:
        client = db.get(Client, order.client_id)
        if client is not None:
            client_name = client.company_name or client.contact_name
        if order.responsible_id is not None:
            responsible = db.get(SalesUser, order.responsible_id)
            if responsible is not None:
                responsible_name = responsible.name

    media_items: list[TechnicalCardMediaRead] = []
    if _technical_card_media_table_available(db):
        try:
            media_items = [
                TechnicalCardMediaRead(
                    id=item.id,
                    technical_card_id=item.technical_card_id,
                    filename=item.filename,
                    mime_type=item.mime_type,
                    file_size=item.file_size,
                    sort_order=item.sort_order,
                    is_primary=item.is_primary,
                    content_url=tech_card_media_content_url(card.id, item.id),
                    created_at=item.created_at,
                    updated_at=item.updated_at,
                )
                for item in sorted(
                    card.media_items, key=lambda row: (row.sort_order, row.id)
                )
            ]
        except Exception:
            media_items = []

    order_item = card.order_item
    if order_item is None and card.sales_order_item_id is not None:
        order_item = db.scalar(
            select(SalesOrderItem)
            .options(selectinload(SalesOrderItem.assembly_operation_snapshots))
            .where(SalesOrderItem.id == card.sales_order_item_id)
        )
    snapshots = (
        sorted(order_item.assembly_operation_snapshots, key=lambda row: row.sequence)
        if order_item is not None
        else []
    )
    assembly_sewing_operations = [
        TechnicalCardAssemblySewingOpRead(
            sequence=snap.sequence,
            operation_name=snap.operation_name,
            cost=snap.cost,
            quantity_per_item=max(1, int(snap.quantity_per_item or 1)),
            line_total=snap.cost * Decimal(max(1, int(snap.quantity_per_item or 1))),
            duration_seconds=snap.duration_seconds,
            sewing_operation_id=snap.sewing_operation_id,
        )
        for snap in snapshots
    ]

    product_model_cover_image_url: str | None = None
    if card.product_model_id is not None:
        model = db.get(ProductModel, card.product_model_id)
        if model is not None and model.cover_image_url and model.cover_image_url.strip():
            product_model_cover_image_url = model.cover_image_url.strip()

    data = {column.name: getattr(card, column.name) for column in TechnicalCard.__table__.columns}
    data["composition_lines"] = list(card.composition_lines)
    data["unit_lines"] = list(card.unit_lines)
    data["operation_lines"] = list(card.operation_lines)
    data["stage_results"] = list(card.stage_results)
    data["media_items"] = media_items
    data["assembly_sewing_operations"] = assembly_sewing_operations
    data["product_model_cover_image_url"] = product_model_cover_image_url
    data["order_number"] = order_number
    data["client_name"] = client_name
    data["responsible_name"] = responsible_name
    data["desired_date"] = desired_date
    return TechnicalCardRead.model_validate(data)


def get_technical_card(db: Session, card_id: int) -> TechnicalCard:
    card = db.scalar(
        select(TechnicalCard)
        .options(*_card_load_options(db))
        .where(TechnicalCard.id == card_id)
    )
    if card is None:
        raise TechnicalCardNotFoundError("Technical card not found")
    return card


def list_technical_cards_for_order(db: Session, order_id: int) -> list[TechnicalCard]:
    order = db.get(SalesOrder, order_id)
    if order is None:
        raise TechnicalCardNotFoundError("Order not found")
    return list(
        db.scalars(
            select(TechnicalCard)
            .options(*_card_load_options(db))
            .where(TechnicalCard.sales_order_id == order_id)
            .order_by(TechnicalCard.card_seq, TechnicalCard.id)
        ).all()
    )


def list_technical_cards(
    db: Session,
    *,
    sales_order_id: int | None = None,
    status: str | None = None,
    stage: str | None = None,
    search: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[tuple[TechnicalCard, str | None]]:
    """Global production list. Returns (card, order_number) pairs."""
    statement = (
        select(TechnicalCard, SalesOrder.number)
        .join(SalesOrder, SalesOrder.id == TechnicalCard.sales_order_id)
        .options(*_card_load_options(db))
    )
    if sales_order_id is not None:
        statement = statement.where(TechnicalCard.sales_order_id == sales_order_id)
    if status and status.strip():
        statement = statement.where(TechnicalCard.status == status.strip())
    if stage and stage.strip():
        pattern = f"%{stage.strip().lower()}%"
        statement = statement.where(
            func.lower(func.coalesce(TechnicalCard.current_stage_label, "")).like(pattern)
        )
    if search and search.strip():
        pattern = f"%{search.strip().lower()}%"
        statement = statement.where(
            func.lower(TechnicalCard.number).like(pattern)
            | func.lower(func.coalesce(TechnicalCard.nomenclature_name, "")).like(pattern)
            | func.lower(func.coalesce(TechnicalCard.product_model_article, "")).like(pattern)
            | func.lower(func.coalesce(TechnicalCard.product_model_name, "")).like(pattern)
            | func.lower(SalesOrder.number).like(pattern)
        )
    statement = (
        statement.order_by(TechnicalCard.updated_at.desc(), TechnicalCard.id.desc())
        .offset(offset)
        .limit(limit)
    )
    rows = db.execute(statement).unique().all()
    return [(card, order_number) for card, order_number in rows]


def unit_line_count_from_quantity(quantity: Decimal) -> int:
    try:
        qty = Decimal(quantity)
    except (InvalidOperation, TypeError) as error:
        raise TechnicalCardValidationError("Invalid order line quantity") from error
    if qty < 1 or qty != qty.to_integral_value():
        raise TechnicalCardValidationError(
            "Technical card unit lines require a whole positive quantity"
        )
    return int(qty)


def _nomenclature_for_item(db: Session, item: SalesOrderItem) -> Nomenclature | None:
    if item.nomenclature_id is None:
        return None
    return db.get(Nomenclature, item.nomenclature_id)


def _technical_card_number(order_number: str, card_seq: int, template: str) -> str:
    return (
        template.replace("{orderNo}", order_number).replace("{cardSeq}", str(card_seq))
    )


def is_eligible_order_item(db: Session, item: SalesOrderItem) -> tuple[bool, str | None]:
    if item.nomenclature_id is None:
        return False, "no_nomenclature"
    nomenclature = _nomenclature_for_item(db, item)
    if nomenclature is None:
        return False, "nomenclature_missing"
    settings = get_technical_card_settings(db)
    allowed_types = {
        value.value if hasattr(value, "value") else str(value)
        for value in settings.eligible_nomenclature_types
    }
    nomenclature_type = (
        nomenclature.nomenclature_type.value
        if isinstance(nomenclature.nomenclature_type, NomenclatureType)
        else str(nomenclature.nomenclature_type)
    )
    if nomenclature_type not in allowed_types:
        return False, f"nomenclature_type_not_allowed:{nomenclature_type.lower()}"
    try:
        unit_line_count_from_quantity(item.quantity)
    except TechnicalCardValidationError:
        return False, "quantity_not_whole"
    return True, None


def _existing_card_by_item(
    db: Session, sales_order_item_id: int
) -> TechnicalCard | None:
    return db.scalar(
        select(TechnicalCard).where(TechnicalCard.sales_order_item_id == sales_order_item_id)
    )


def _next_card_seq(db: Session, sales_order_id: int) -> int:
    current = db.scalar(
        select(func.max(TechnicalCard.card_seq)).where(
            TechnicalCard.sales_order_id == sales_order_id
        )
    )
    return int(current or 0) + 1


def _default_unit_line(
    item: SalesOrderItem, unit_index: int, *, settings
) -> TechnicalCardUnitLine:
    return TechnicalCardUnitLine(
        unit_index=unit_index,
        size_type=(
            map_product_model_size_type_to_unit_line(item.product_model_size_type)
            if settings.unit_field_size_type_enabled
            else None
        ),
        size=item.size_range if settings.unit_field_size_enabled else None,
        personalization=(
            item.personalization if settings.unit_field_personalization_enabled else None
        ),
        print_number=None,
        notes=None,
    )


def _apply_header_snapshots(
    card: TechnicalCard,
    *,
    item: SalesOrderItem,
    nomenclature: Nomenclature,
) -> None:
    card.quantity = item.quantity
    card.nomenclature_id = nomenclature.id
    card.nomenclature_name = item.snapshot_name or nomenclature.name
    card.nomenclature_type = (
        nomenclature.nomenclature_type.value
        if isinstance(nomenclature.nomenclature_type, NomenclatureType)
        else str(nomenclature.nomenclature_type)
    )
    card.product_model_id = item.product_model_id
    card.product_model_article = item.product_model_article
    card.product_model_name = item.product_model_name
    card.product_model_size_type = item.product_model_size_type
    card.assembly_variant_id = item.assembly_variant_id
    card.assembly_variant_name = item.assembly_variant_name
    card.assembly_variant_total_cost = item.assembly_variant_total_cost
    # Spec soft-ref stays empty until Stage 7 outbound; routing applied via snapshot helper.


def _operation_line_source_value(line: TechnicalCardOperationLine) -> str:
    kind = line.source_kind
    return kind.value if isinstance(kind, TechnicalCardOperationLineSourceKind) else str(kind)


def _apply_routing_template(db: Session, card: TechnicalCard, template) -> None:
    """Clear routing-sourced op lines + all stage_results; rebuild from template.

    After packaging, append FG stages `ready_to_ship` → `shipped` when missing
    (ADR-019 / 11.2.2.2).
    """
    card.routing_template_id = template.id
    card.routing_template_name = template.name

    for row in list(card.operation_lines):
        if _operation_line_source_value(row) == TechnicalCardOperationLineSourceKind.ROUTING.value:
            card.operation_lines.remove(row)
            db.delete(row)
    for row in list(card.stage_results):
        card.stage_results.remove(row)
        db.delete(row)
    db.flush()

    # Avoid unique (card, sequence) clashes with remaining sewing lines until re-sequence.
    for offset, row in enumerate(list(card.operation_lines), start=1):
        row.sequence = 100_000 + offset
    db.flush()

    first_stage = None
    op_sequence = 1
    for stage in sorted(template.stage_lines, key=lambda row: row.stage_order):
        card.stage_results.append(
            TechnicalCardStageResult(
                stage_order=stage.stage_order,
                production_stage_id=stage.production_stage_id,
                stage_label=stage.stage_label,
                status=TechnicalCardStageResultStatus.PENDING,
                # Planned equipment snapshot from routing (11.1.2.2); fact reuses same field.
                work_center_id=stage.work_center_id,
            )
        )
        if first_stage is None:
            first_stage = stage
        if stage.tech_operation_id is None:
            continue
        op = db.get(TechOperation, stage.tech_operation_id)
        if op is None or not op.is_active:
            continue
        card.operation_lines.append(
            TechnicalCardOperationLine(
                sequence=op_sequence,
                source_kind=TechnicalCardOperationLineSourceKind.ROUTING,
                tech_operation_id=op.id,
                operation_name=op.name,
                volume_unit=op.volume_unit,
                volume=Decimal("0"),
                stage_order=stage.stage_order,
                production_stage_id=stage.production_stage_id,
                stage_label=stage.stage_label,
            )
        )
        op_sequence += 1

    _append_finished_goods_stages(db, card)

    if first_stage is not None:
        card.current_stage_order = first_stage.stage_order
        card.current_stage_label = first_stage.stage_label
    db.flush()


FG_STAGE_CODES = ("ready_to_ship", "shipped")


def _stage_codes_on_card(db: Session, card: TechnicalCard) -> set[str]:
    codes: set[str] = set()
    for result in card.stage_results:
        if result.production_stage_id is not None:
            stage = db.get(ProductionStage, result.production_stage_id)
            if stage is not None and stage.code:
                codes.add(stage.code.strip().lower())
                continue
        label = (result.stage_label or "").strip().lower()
        if label in {"готовы к отгрузке", "ready_to_ship"}:
            codes.add("ready_to_ship")
        elif label in {"отгружены", "shipped"}:
            codes.add("shipped")
        elif label == "упаковка":
            codes.add("packaging")
    return codes


def _append_finished_goods_stages(db: Session, card: TechnicalCard) -> None:
    """Append ready_to_ship → shipped after packaging when template omits them."""
    codes = _stage_codes_on_card(db, card)
    if "packaging" not in codes:
        return
    if "ready_to_ship" in codes or "shipped" in codes:
        return
    if not card.stage_results:
        return

    max_order = max(row.stage_order for row in card.stage_results)
    for offset, code in enumerate(FG_STAGE_CODES, start=1):
        stage = db.scalar(select(ProductionStage).where(ProductionStage.code == code))
        if stage is None or not stage.is_active:
            continue
        card.stage_results.append(
            TechnicalCardStageResult(
                stage_order=max_order + offset,
                production_stage_id=stage.id,
                stage_label=stage.name,
                status=TechnicalCardStageResultStatus.PENDING,
            )
        )


def _resolve_sewing_stage_binding(
    db: Session, card: TechnicalCard
) -> tuple[int | None, str | None, int | None]:
    """Return (stage_order, stage_label, production_stage_id) for sewing lines."""
    sewing_stage = db.scalar(
        select(ProductionStage).where(ProductionStage.code == "sewing")
    )
    production_stage_id = sewing_stage.id if sewing_stage is not None else None

    for result in sorted(card.stage_results, key=lambda row: row.stage_order):
        if sewing_stage is not None and result.production_stage_id == sewing_stage.id:
            return result.stage_order, result.stage_label, result.production_stage_id
        label = result.stage_label or ""
        if "Пошив" in label:
            return (
                result.stage_order,
                result.stage_label,
                result.production_stage_id or production_stage_id,
            )

    if sewing_stage is not None:
        return None, sewing_stage.name, sewing_stage.id
    return None, None, None


def _sync_sewing_operation_lines(db: Session, card: TechnicalCard) -> None:
    """Replace sewing-sourced op lines from order-item assembly snapshots; re-sequence all."""
    for row in list(card.operation_lines):
        if _operation_line_source_value(row) == TechnicalCardOperationLineSourceKind.SEWING.value:
            card.operation_lines.remove(row)
            db.delete(row)
    db.flush()

    stage_order, stage_label, production_stage_id = _resolve_sewing_stage_binding(db, card)

    order_item = card.order_item
    if order_item is None:
        order_item = db.scalar(
            select(SalesOrderItem)
            .options(selectinload(SalesOrderItem.assembly_operation_snapshots))
            .where(SalesOrderItem.id == card.sales_order_item_id)
        )

    snapshots = (
        sorted(order_item.assembly_operation_snapshots, key=lambda row: row.sequence)
        if order_item is not None
        else []
    )
    # Temporary unique sequences until the full 1..n re-sequence below.
    temp_base = max((row.sequence for row in card.operation_lines), default=0)
    for offset, snap in enumerate(snapshots, start=1):
        card.operation_lines.append(
            TechnicalCardOperationLine(
                sequence=temp_base + offset,
                source_kind=TechnicalCardOperationLineSourceKind.SEWING,
                sewing_operation_id=snap.sewing_operation_id,
                operation_name=snap.operation_name,
                volume_unit=TechOperationVolumeUnit.PIECES,
                volume=Decimal("0"),
                stage_order=stage_order,
                production_stage_id=production_stage_id,
                stage_label=stage_label,
            )
        )

    routing_lines = sorted(
        [
            row
            for row in card.operation_lines
            if _operation_line_source_value(row)
            == TechnicalCardOperationLineSourceKind.ROUTING.value
        ],
        key=lambda row: (
            row.stage_order if row.stage_order is not None else 10**9,
            row.sequence,
            row.id or 0,
        ),
    )
    sewing_lines = [
        row
        for row in card.operation_lines
        if _operation_line_source_value(row)
        == TechnicalCardOperationLineSourceKind.SEWING.value
    ]
    for index, line in enumerate([*routing_lines, *sewing_lines], start=1):
        line.sequence = index
    db.flush()


def _ensure_routing_template_allowed_for_model(
    db: Session,
    product_model_id: int | None,
    routing_template_id: int,
) -> None:
    """Reject foreign routings when the model whitelist is non-empty (`8.2.3.7` / `6.1.17`).

    Empty whitelist (or no model) keeps the global `/shop-routings` catalog usable.
    """
    if product_model_id is None:
        return
    allowed = product_model_routings_repo.list_template_ids(
        db, product_model_id, active_only=True
    )
    if not allowed:
        return
    if routing_template_id not in allowed:
        raise TechnicalCardValidationError(
            "Routing template is not in the product model routing whitelist"
        )


def _apply_routing_snapshot_from_model(
    db: Session,
    card: TechnicalCard,
    *,
    item: SalesOrderItem | None = None,
) -> None:
    """Snapshot routing into TC: prefer order-item template, else model default."""
    if item is None and card.sales_order_item_id is not None:
        item = db.get(SalesOrderItem, card.sales_order_item_id)

    template_id: int | None = None
    if item is not None and item.routing_template_id is not None:
        template_id = item.routing_template_id
    elif card.product_model_id is not None:
        model = db.get(ProductModel, card.product_model_id)
        if model is not None and model.default_routing_template_id is not None:
            template_id = model.default_routing_template_id

    if template_id is None:
        _sync_sewing_operation_lines(db, card)
        return

    from app.repositories import shop_routings as shop_routings_repo

    _ensure_routing_template_allowed_for_model(db, card.product_model_id, template_id)
    template = shop_routings_repo.get_routing_template(db, template_id)
    if template is None or not template.is_active:
        _sync_sewing_operation_lines(db, card)
        return

    _apply_routing_template(db, card, template)
    _sync_sewing_operation_lines(db, card)


def apply_routing_template(
    db: Session, card_id: int, routing_template_id: int
) -> TechnicalCard:
    card = get_technical_card(db, card_id)

    if card.status == TechnicalCardStatus.DRAFT:
        pass
    elif card.status == TechnicalCardStatus.IN_PROGRESS:
        if any(
            row.status == TechnicalCardStageResultStatus.COMPLETED
            for row in card.stage_results
        ):
            raise TechnicalCardConflictError(
                "Cannot apply routing after a stage has been completed"
            )
    else:
        raise TechnicalCardConflictError(
            "Routing can only be applied while the card is draft or in progress "
            "with no completed stages"
        )

    from app.repositories import shop_routings as shop_routings_repo

    template = shop_routings_repo.get_routing_template(db, routing_template_id)
    if template is None:
        raise TechnicalCardNotFoundError("Routing template not found")
    if not template.is_active:
        raise TechnicalCardValidationError("Routing template is inactive")

    _ensure_routing_template_allowed_for_model(
        db, card.product_model_id, routing_template_id
    )

    _apply_routing_template(db, card, template)
    _sync_sewing_operation_lines(db, card)
    _sync_route_required_materials_to_composition(db, card)
    _apply_planned_qty_hints_to_composition(db, card)
    db.commit()
    return get_technical_card(db, card_id)


def _safe_media_filename(filename: str) -> str:
    name = Path(filename).name.strip()
    if not name or name in {".", ".."}:
        raise TechnicalCardValidationError("Invalid media filename")
    return re.sub(r"[^A-Za-z0-9._-]", "_", name)[:255]


def _decode_media_image(content: str) -> bytes:
    try:
        data = base64.b64decode(content, validate=True)
    except (binascii.Error, ValueError) as error:
        raise TechnicalCardValidationError("Invalid media content") from error
    if not data or len(data) > MAX_MEDIA_BYTES:
        raise TechnicalCardValidationError(
            "Media size must be between 1 byte and 10 MB"
        )
    return data


def _delete_media_file(storage_key: str | None) -> None:
    if not storage_key:
        return
    path = (MEDIA_ROOT / storage_key).resolve()
    if MEDIA_ROOT not in path.parents:
        raise TechnicalCardValidationError("Unsafe media path")
    if path.exists():
        path.unlink()


def _clear_media_primary_flags(
    card: TechnicalCard, *, except_id: int | None = None
) -> None:
    for item in card.media_items:
        if except_id is not None and item.id == except_id:
            continue
        if item.is_primary:
            item.is_primary = False


def list_technical_card_media(db: Session, card_id: int) -> list[TechnicalCardMedia]:
    card = get_technical_card(db, card_id)
    return sorted(card.media_items, key=lambda row: (row.sort_order, row.id))


def get_technical_card_media(
    db: Session, card_id: int, media_id: int
) -> TechnicalCardMedia:
    get_technical_card(db, card_id)
    item = db.get(TechnicalCardMedia, media_id)
    if item is None or item.technical_card_id != card_id:
        raise TechnicalCardNotFoundError("Technical card media not found")
    return item


def add_technical_card_media(
    db: Session,
    card_id: int,
    payload: TechnicalCardMediaCreate,
) -> TechnicalCardMedia:
    card = get_technical_card(db, card_id)
    if len(card.media_items) >= MAX_TECH_CARD_MEDIA:
        raise TechnicalCardValidationError(
            f"Technical card supports at most {MAX_TECH_CARD_MEDIA} media items"
        )

    data = _decode_media_image(payload.content_base64)
    filename = _safe_media_filename(payload.filename)
    key = f"{card_id}/{uuid.uuid4().hex}-{filename}"
    path = MEDIA_ROOT / key
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)

    make_primary = payload.is_primary or len(card.media_items) == 0
    if make_primary:
        _clear_media_primary_flags(card)

    next_sort = (
        max((item.sort_order for item in card.media_items), default=-1) + 1
    )
    item = TechnicalCardMedia(
        technical_card_id=card_id,
        filename=filename,
        storage_key=key,
        mime_type=payload.mime_type,
        file_size=len(data),
        sort_order=next_sort,
        is_primary=make_primary,
    )
    card.media_items.append(item)
    db.flush()
    db.commit()
    db.refresh(item)
    return item


def set_technical_card_media_primary(
    db: Session, card_id: int, media_id: int
) -> TechnicalCardMedia:
    card = get_technical_card(db, card_id)
    item = get_technical_card_media(db, card_id, media_id)
    if not item.is_primary:
        _clear_media_primary_flags(card, except_id=item.id)
        item.is_primary = True
        db.commit()
        db.refresh(item)
    return item


def delete_technical_card_media(db: Session, card_id: int, media_id: int) -> None:
    card = get_technical_card(db, card_id)
    item = get_technical_card_media(db, card_id, media_id)
    was_primary = item.is_primary
    storage_key = item.storage_key
    card.media_items.remove(item)
    db.delete(item)
    db.flush()

    if was_primary:
        remaining = sorted(card.media_items, key=lambda row: (row.sort_order, row.id))
        if remaining:
            remaining[0].is_primary = True
    db.commit()
    try:
        _delete_media_file(storage_key)
    except TechnicalCardValidationError:
        pass


def technical_card_media_path(
    db: Session, card_id: int, media_id: int
) -> tuple[Path, str]:
    item = get_technical_card_media(db, card_id, media_id)
    path = (MEDIA_ROOT / item.storage_key).resolve()
    if MEDIA_ROOT not in path.parents or not path.exists():
        raise TechnicalCardNotFoundError("Technical card media file not found")
    return path, item.mime_type


def sync_unit_lines(db: Session, card: TechnicalCard, item: SalesOrderItem) -> TechnicalCard:
    """Align unit-line count with order-item quantity (add / remove from the end)."""
    if card.status == TechnicalCardStatus.CANCELLED:
        raise TechnicalCardValidationError("Cannot sync unit lines on a cancelled card")
    if card.status == TechnicalCardStatus.COMPLETED:
        raise TechnicalCardValidationError("Cannot sync unit lines on a completed card")

    target = unit_line_count_from_quantity(item.quantity)
    settings = get_technical_card_settings(db)
    card.quantity = item.quantity
    lines = sorted(card.unit_lines, key=lambda row: row.unit_index)

    while len(lines) < target:
        next_index = (lines[-1].unit_index + 1) if lines else 1
        line = _default_unit_line(item, next_index, settings=settings)
        card.unit_lines.append(line)
        lines.append(line)

    while len(lines) > target:
        line = lines.pop()
        card.unit_lines.remove(line)
        db.delete(line)

    db.flush()
    return card


def _seed_pattern_line_from_model(db: Session, card: TechnicalCard) -> None:
    if card.product_model_id is None:
        return
    model = db.get(ProductModel, card.product_model_id)
    if model is None or not model.patterns_path:
        return
    card.composition_lines.append(
        TechnicalCardCompositionLine(
            sequence=1,
            line_kind=TechnicalCardCompositionLineKind.PATTERN,
            snapshot_name=f"Лекала: {model.article}",
            notes=model.patterns_path,
        )
    )


def compute_planned_qty_hint(
    norm_qty_per_item: Decimal, order_qty: Decimal
) -> Decimal:
    """`norm_qty_per_item × order_qty`, Decimal-safe to 3 places (hint, not hard SoT)."""
    return (Decimal(norm_qty_per_item) * Decimal(order_qty)).quantize(
        Decimal("0.001"), rounding=ROUND_HALF_UP
    )


def _pick_operation_norm_for_stage(
    norms: list[ProductModelOperationNorm],
    production_stage_id: int,
    tech_operation_id: int | None = None,
) -> ProductModelOperationNorm | None:
    matched = [row for row in norms if row.production_stage_id == production_stage_id]
    if not matched:
        return None
    if tech_operation_id is not None:
        op_level = [row for row in matched if row.tech_operation_id == tech_operation_id]
        if op_level:
            return sorted(op_level, key=lambda row: row.id)[0]
    stage_level = [row for row in matched if row.tech_operation_id is None]
    pool = stage_level if stage_level else matched
    return sorted(pool, key=lambda row: row.id)[0]


def resolve_composition_planned_qty_hint(
    db: Session,
    card: TechnicalCard,
    production_stage_id: int,
    tech_operation_id: int | None = None,
) -> tuple[Decimal | None, str | None]:
    """Resolve MATERIAL `planned_qty` hint from model routing norms × card qty.

    Returns `(planned_qty, unit)` or `(None, None)` when binding/norms/qty missing.
    Does not invent demo values (task 9.3.4.2 / ADR-016).
    """
    if card.product_model_id is None or card.routing_template_id is None:
        return None, None
    try:
        order_qty = Decimal(card.quantity)
    except (InvalidOperation, TypeError):
        return None, None
    if order_qty <= 0:
        return None, None

    link = product_model_routings_repo.get_link_by_template(
        db, card.product_model_id, card.routing_template_id
    )
    if link is None or not link.is_active:
        return None, None

    norm = _pick_operation_norm_for_stage(
        list(link.operation_norms),
        production_stage_id,
        tech_operation_id=tech_operation_id,
    )
    if norm is None:
        return None, None
    return compute_planned_qty_hint(norm.norm_qty_per_item, order_qty), norm.unit


def _apply_planned_qty_hints_to_composition(db: Session, card: TechnicalCard) -> int:
    """Fill null MATERIAL planned_qty from norms when stage is bound (generate revive)."""
    filled = 0
    for row in card.composition_lines:
        kind = row.line_kind
        kind_value = kind.value if hasattr(kind, "value") else str(kind)
        if kind_value != TechnicalCardCompositionLineKind.MATERIAL.value:
            continue
        if row.planned_qty is not None or row.production_stage_id is None:
            continue
        hint_qty, hint_unit = resolve_composition_planned_qty_hint(
            db, card, row.production_stage_id
        )
        if hint_qty is None:
            continue
        row.planned_qty = hint_qty
        if not row.unit and hint_unit:
            row.unit = hint_unit
        filled += 1
    return filled


def _sync_route_required_materials_to_composition(db: Session, card: TechnicalCard) -> int:
    """Prefill MATERIAL rows from route TechOperation required materials (`9.3.5`)."""
    if card.product_model_id is None or card.routing_template_id is None:
        return 0
    route_ops = [
        row
        for row in card.operation_lines
        if _operation_line_source_value(row)
        == TechnicalCardOperationLineSourceKind.ROUTING.value
        and row.tech_operation_id is not None
        and row.production_stage_id is not None
    ]
    if not route_ops:
        return 0

    created = 0
    existing_keys = {
        (
            row.nomenclature_id,
            row.production_stage_id,
            row.snapshot_name,
        ): row
        for row in card.composition_lines
        if (
            (row.line_kind.value if hasattr(row.line_kind, "value") else str(row.line_kind))
            == TechnicalCardCompositionLineKind.MATERIAL.value
        )
    }

    max_sequence = max((row.sequence for row in card.composition_lines), default=0)
    for op_line in route_ops:
        tech_operation = db.scalar(
            select(TechOperation)
            .where(TechOperation.id == op_line.tech_operation_id)
            .options(
                selectinload(TechOperation.required_materials).selectinload(
                    TechOperationRequiredMaterial.nomenclature
                )
            )
        )
        if tech_operation is None:
            continue
        for material in tech_operation.required_materials:
            material_name = getattr(material.nomenclature, "name", None)
            material_unit = getattr(material.nomenclature, "unit", None)
            if material_name is None:
                continue
            key = (material.nomenclature_id, op_line.production_stage_id, material_name)
            target = existing_keys.get(key)
            planned_qty, norm_unit = resolve_composition_planned_qty_hint(
                db,
                card,
                op_line.production_stage_id,
                tech_operation_id=op_line.tech_operation_id,
            )
            quantity = (
                compute_planned_qty_hint(material.quantity, planned_qty)
                if planned_qty is not None
                else None
            )
            notes = None
            if quantity is None:
                notes = "Норма модели для техоперации не найдена"
            unit = material_unit or norm_unit
            if target is None:
                max_sequence += 1
                target = TechnicalCardCompositionLine(
                    sequence=max_sequence,
                    line_kind=TechnicalCardCompositionLineKind.MATERIAL,
                    nomenclature_id=material.nomenclature_id,
                    snapshot_name=material_name,
                    production_stage_id=op_line.production_stage_id,
                )
                card.composition_lines.append(target)
                existing_keys[key] = target
                created += 1
            target.planned_qty = quantity
            target.unit = unit
            target.notes = notes
    return created


def _build_new_card(
    db: Session,
    *,
    order: SalesOrder,
    item: SalesOrderItem,
    nomenclature: Nomenclature,
) -> TechnicalCard:
    card_seq = _next_card_seq(db, order.id)
    settings = get_technical_card_settings(db)
    card = TechnicalCard(
        sales_order_id=order.id,
        sales_order_item_id=item.id,
        number=_technical_card_number(
            order.number, card_seq, settings.numbering_template
        ),
        card_seq=card_seq,
        status=TechnicalCardStatus.DRAFT,
        quantity=item.quantity,
        unit_lines=[],
        composition_lines=[],
        operation_lines=[],
        stage_results=[],
    )
    _apply_header_snapshots(card, item=item, nomenclature=nomenclature)
    for index in range(1, unit_line_count_from_quantity(item.quantity) + 1):
        card.unit_lines.append(_default_unit_line(item, index, settings=settings))
    _seed_pattern_line_from_model(db, card)
    _apply_routing_snapshot_from_model(db, card, item=item)
    _sync_route_required_materials_to_composition(db, card)
    # MATERIAL planned_qty hints apply when materials are added with stage (`9.3.4.2`).
    _apply_planned_qty_hints_to_composition(db, card)
    db.add(card)
    db.flush()
    return card


def _revive_cancelled_card(
    db: Session,
    *,
    card: TechnicalCard,
    item: SalesOrderItem,
    nomenclature: Nomenclature,
) -> TechnicalCard:
    settings = get_technical_card_settings(db)
    card.status = TechnicalCardStatus.DRAFT
    _apply_header_snapshots(card, item=item, nomenclature=nomenclature)
    order = card.order or db.get(SalesOrder, card.sales_order_id)
    card.number = _technical_card_number(
        order.number if order is not None else str(card.sales_order_id),
        card.card_seq,
        settings.numbering_template,
    )
    # Drop prior child rows and rebuild unit lines from current qty.
    for collection in (
        card.composition_lines,
        card.operation_lines,
        card.stage_results,
        card.unit_lines,
    ):
        for row in list(collection):
            collection.remove(row)
            db.delete(row)
    db.flush()
    for index in range(1, unit_line_count_from_quantity(item.quantity) + 1):
        card.unit_lines.append(_default_unit_line(item, index, settings=settings))
    _seed_pattern_line_from_model(db, card)
    _apply_routing_snapshot_from_model(db, card, item=item)
    _sync_route_required_materials_to_composition(db, card)
    _apply_planned_qty_hints_to_composition(db, card)
    db.flush()
    return card


def preview_technical_cards(db: Session, order_id: int) -> TechnicalCardPreviewRead:
    order = db.get(SalesOrder, order_id)
    if order is None:
        raise TechnicalCardNotFoundError("Order not found")

    items = list(
        db.scalars(
            select(SalesOrderItem)
            .where(SalesOrderItem.order_id == order_id)
            .order_by(SalesOrderItem.position, SalesOrderItem.id)
        ).all()
    )
    lines: list[TechnicalCardPreviewLine] = []
    create_count = 0
    revive_count = 0

    for item in items:
        eligible, skip_reason = is_eligible_order_item(db, item)
        existing = _existing_card_by_item(db, item.id)
        planned: int | None = None
        if eligible:
            planned = unit_line_count_from_quantity(item.quantity)

        would_create = False
        would_revive = False
        if eligible and existing is None:
            would_create = True
            create_count += 1
        elif eligible and existing is not None and existing.status == TechnicalCardStatus.CANCELLED:
            would_revive = True
            revive_count += 1

        lines.append(
            TechnicalCardPreviewLine(
                sales_order_item_id=item.id,
                position=item.position,
                snapshot_name=item.snapshot_name,
                quantity=item.quantity,
                eligible=eligible,
                skip_reason=None if eligible else skip_reason,
                existing_card_id=existing.id if existing else None,
                existing_status=existing.status if existing else None,
                would_create=would_create,
                would_revive=would_revive,
                planned_unit_line_count=planned,
            )
        )

    return TechnicalCardPreviewRead(
        sales_order_id=order.id,
        order_number=order.number,
        lines=lines,
        create_count=create_count,
        revive_count=revive_count,
    )


def generate_technical_cards(
    db: Session,
    order_id: int,
    *,
    sales_order_item_ids: list[int] | None = None,
) -> TechnicalCardGenerateResult:
    order = db.get(SalesOrder, order_id)
    if order is None:
        raise TechnicalCardNotFoundError("Order not found")

    items = list(
        db.scalars(
            select(SalesOrderItem)
            .where(SalesOrderItem.order_id == order_id)
            .order_by(SalesOrderItem.position, SalesOrderItem.id)
        ).all()
    )
    if sales_order_item_ids is not None:
        wanted = set(sales_order_item_ids)
        unknown = wanted - {item.id for item in items}
        if unknown:
            raise TechnicalCardValidationError(
                f"Order item(s) not on this order: {sorted(unknown)}"
            )
        items = [item for item in items if item.id in wanted]

    created: list[TechnicalCard] = []
    revived: list[TechnicalCard] = []
    skipped: list[TechnicalCardSkippedLine] = []

    for item in items:
        eligible, skip_reason = is_eligible_order_item(db, item)
        existing = _existing_card_by_item(db, item.id)

        if not eligible:
            skipped.append(
                TechnicalCardSkippedLine(
                    sales_order_item_id=item.id,
                    reason=skip_reason or "not_eligible",
                    existing_card_id=existing.id if existing else None,
                )
            )
            continue

        nomenclature = _nomenclature_for_item(db, item)
        assert nomenclature is not None

        if existing is None:
            card = _build_new_card(
                db, order=order, item=item, nomenclature=nomenclature
            )
            created.append(card)
            continue

        if existing.status == TechnicalCardStatus.CANCELLED:
            card = _revive_cancelled_card(
                db,
                card=existing,
                item=item,
                nomenclature=nomenclature,
            )
            revived.append(card)
            continue

        skipped.append(
            TechnicalCardSkippedLine(
                sales_order_item_id=item.id,
                reason="card_exists",
                existing_card_id=existing.id,
            )
        )

    db.commit()
    created_ids = [card.id for card in created]
    revived_ids = [card.id for card in revived]
    return TechnicalCardGenerateResult(
        sales_order_id=order.id,
        created=[get_technical_card(db, card_id) for card_id in created_ids],
        revived=[get_technical_card(db, card_id) for card_id in revived_ids],
        skipped=skipped,
    )


def sync_technical_card_unit_lines(db: Session, card_id: int) -> TechnicalCard:
    card = get_technical_card(db, card_id)
    item = db.get(SalesOrderItem, card.sales_order_item_id)
    if item is None:
        raise TechnicalCardValidationError("Order item not found for technical card")
    sync_unit_lines(db, card, item)
    db.commit()
    return get_technical_card(db, card_id)


def cancel_draft_technical_card(db: Session, card_id: int) -> TechnicalCard:
    card = get_technical_card(db, card_id)
    if card.status != TechnicalCardStatus.DRAFT:
        raise TechnicalCardConflictError("Only draft technical cards can be cancelled")
    card.status = TechnicalCardStatus.CANCELLED
    db.commit()
    return get_technical_card(db, card_id)


def _assert_composition_editable(card: TechnicalCard) -> None:
    if card.status in {TechnicalCardStatus.CANCELLED, TechnicalCardStatus.COMPLETED}:
        raise TechnicalCardValidationError(
            "Cannot edit composition on a cancelled or completed card"
        )


def _validate_composition_payload(
    db: Session, lines: list[TechnicalCardCompositionLineWrite]
) -> None:
    sequences = [line.sequence for line in lines]
    if len(sequences) != len(set(sequences)):
        raise TechnicalCardValidationError("Composition line sequences must be unique")

    for line in lines:
        if line.line_kind == TechnicalCardCompositionLineKind.MATERIAL:
            if line.nomenclature_id is None:
                raise TechnicalCardValidationError(
                    "Material composition lines require nomenclature_id"
                )
            nomenclature = db.get(Nomenclature, line.nomenclature_id)
            if nomenclature is None:
                raise TechnicalCardValidationError(
                    f"Nomenclature {line.nomenclature_id} not found"
                )
            if nomenclature.nomenclature_type != NomenclatureType.MATERIAL:
                raise TechnicalCardValidationError(
                    "Material composition lines must reference MATERIAL nomenclature"
                )
            if not line.snapshot_name:
                raise TechnicalCardValidationError("Material snapshot_name is required")
            if line.production_stage_id is not None:
                stage = db.get(ProductionStage, line.production_stage_id)
                if stage is None:
                    raise TechnicalCardValidationError(
                        f"Production stage {line.production_stage_id} not found"
                    )
        elif line.line_kind == TechnicalCardCompositionLineKind.PATTERN:
            if line.nomenclature_id is not None:
                raise TechnicalCardValidationError(
                    "Pattern composition lines must not reference nomenclature_id"
                )
        elif line.line_kind == TechnicalCardCompositionLineKind.NOTE:
            if line.nomenclature_id is not None:
                raise TechnicalCardValidationError(
                    "Note composition lines must not reference nomenclature_id"
                )
        else:
            raise TechnicalCardValidationError(f"Unsupported line_kind: {line.line_kind}")


def _clear_composition_lines(db: Session, card: TechnicalCard) -> None:
    for row in list(card.composition_lines):
        card.composition_lines.remove(row)
        db.delete(row)
    db.flush()


def _append_composition_lines(
    db: Session,
    card: TechnicalCard,
    lines: list[TechnicalCardCompositionLineWrite],
) -> None:
    for line in sorted(lines, key=lambda row: row.sequence):
        planned_qty = line.planned_qty
        unit = line.unit
        if (
            line.line_kind == TechnicalCardCompositionLineKind.MATERIAL
            and planned_qty is None
            and line.production_stage_id is not None
        ):
            hint_qty, hint_unit = resolve_composition_planned_qty_hint(
                db, card, line.production_stage_id
            )
            if hint_qty is not None:
                planned_qty = hint_qty
            if not unit and hint_unit:
                unit = hint_unit
        card.composition_lines.append(
            TechnicalCardCompositionLine(
                sequence=line.sequence,
                line_kind=line.line_kind,
                nomenclature_id=line.nomenclature_id,
                snapshot_name=line.snapshot_name,
                planned_qty=planned_qty,
                fact_qty=None,
                production_stage_id=line.production_stage_id,
                unit=unit,
                notes=line.notes,
            )
        )


def replace_composition_lines(
    db: Session,
    card_id: int,
    lines: list[TechnicalCardCompositionLineWrite],
) -> TechnicalCard:
    card = get_technical_card(db, card_id)
    _assert_composition_editable(card)
    _validate_composition_payload(db, lines)
    _clear_composition_lines(db, card)
    _append_composition_lines(db, card, lines)
    db.commit()
    return get_technical_card(db, card_id)


def set_composition_line_fact_qty(
    db: Session,
    card_id: int,
    line_id: int,
    fact_qty: Decimal,
    *,
    shop_stage_code: str | None = None,
) -> TechnicalCard:
    """Shop-path write of MATERIAL fact_qty (manager replace does not accept fact).

    Bind rule (`11.5.4` / `11.6.4`): when `shop_stage_code` is set, the line must
    belong to that ProductionStage and the card's current routing step must match.
    """
    card = get_technical_card(db, card_id)
    if card.status == TechnicalCardStatus.CANCELLED:
        raise TechnicalCardValidationError(
            "Cannot set fact_qty on a cancelled technical card"
        )
    line = next((row for row in card.composition_lines if row.id == line_id), None)
    if line is None:
        raise TechnicalCardNotFoundError("Composition line not found")
    kind = line.line_kind
    kind_value = kind.value if hasattr(kind, "value") else str(kind)
    if kind_value != TechnicalCardCompositionLineKind.MATERIAL.value:
        raise TechnicalCardValidationError(
            "fact_qty can only be set on MATERIAL composition lines"
        )

    required_code = (shop_stage_code or "").strip().lower() or None
    if required_code:
        from app.services.technical_card_stages import (
            assert_shop_module_current_stage,
            resolve_production_stage_code,
        )

        assert_shop_module_current_stage(db, card, required_code)
        line_code = resolve_production_stage_code(db, line.production_stage_id, None)
        if line.production_stage_id is None:
            raise TechnicalCardValidationError(
                f"MATERIAL line has no production stage; cannot bind shop module "
                f"`{required_code}`"
            )
        if line_code != required_code:
            raise TechnicalCardValidationError(
                f"Shop module `{required_code}` can only write fact_qty on MATERIAL "
                f"lines bound to that цех (line stage=`{line_code or 'unset'}`)"
            )

    try:
        qty = Decimal(fact_qty)
    except (InvalidOperation, TypeError) as error:
        raise TechnicalCardValidationError("Invalid fact_qty") from error
    if qty < 0:
        raise TechnicalCardValidationError("fact_qty must be >= 0")
    line.fact_qty = qty.quantize(Decimal("0.001"), rounding=ROUND_HALF_UP)
    db.commit()
    return get_technical_card(db, card_id)


def delete_composition_line(
    db: Session,
    card_id: int,
    line_id: int,
    *,
    shop_stage_code: str | None = None,
) -> TechnicalCard:
    """Remove one composition MATERIAL line (shop path with optional цех bind)."""
    card = get_technical_card(db, card_id)
    if card.status == TechnicalCardStatus.CANCELLED:
        raise TechnicalCardValidationError(
            "Cannot delete composition lines on a cancelled technical card"
        )
    if card.status == TechnicalCardStatus.COMPLETED:
        raise TechnicalCardValidationError(
            "Cannot delete composition lines on a completed technical card"
        )
    line = next((row for row in card.composition_lines if row.id == line_id), None)
    if line is None:
        raise TechnicalCardNotFoundError("Composition line not found")
    kind = line.line_kind
    kind_value = kind.value if hasattr(kind, "value") else str(kind)
    if kind_value != TechnicalCardCompositionLineKind.MATERIAL.value:
        raise TechnicalCardValidationError(
            "Shop delete is only allowed for MATERIAL composition lines"
        )

    required_code = (shop_stage_code or "").strip().lower() or None
    if required_code:
        from app.services.technical_card_stages import (
            assert_shop_module_current_stage,
            resolve_production_stage_code,
        )

        assert_shop_module_current_stage(db, card, required_code)
        line_code = resolve_production_stage_code(db, line.production_stage_id, None)
        if line.production_stage_id is None or line_code != required_code:
            raise TechnicalCardValidationError(
                f"Shop module `{required_code}` can only delete MATERIAL "
                f"lines bound to that цех (line stage=`{line_code or 'unset'}`)"
            )

    card.composition_lines.remove(line)
    db.delete(line)
    db.flush()
    # Keep sequences dense for readability.
    for index, row in enumerate(
        sorted(card.composition_lines, key=lambda item: (item.sequence, item.id)),
        start=1,
    ):
        row.sequence = index
    db.commit()
    return get_technical_card(db, card_id)


def refresh_model_and_pattern_composition(db: Session, card_id: int) -> TechnicalCard:
    """Refresh model header snapshots and ensure a PATTERN line from patterns_path."""
    card = get_technical_card(db, card_id)
    _assert_composition_editable(card)

    model_id = card.product_model_id
    if model_id is None:
        item = db.get(SalesOrderItem, card.sales_order_item_id)
        if item is not None:
            model_id = item.product_model_id
    if model_id is None:
        raise TechnicalCardValidationError("Technical card has no product model to refresh")

    model = db.get(ProductModel, model_id)
    if model is None:
        raise TechnicalCardValidationError("Product model not found")

    card.product_model_id = model.id
    card.product_model_article = model.article
    card.product_model_name = model.name
    card.product_model_size_type = (
        model.size_type.value
        if hasattr(model.size_type, "value")
        else str(model.size_type)
    )

    # Drop existing pattern lines, keep materials/notes.
    for row in list(card.composition_lines):
        if row.line_kind == TechnicalCardCompositionLineKind.PATTERN:
            card.composition_lines.remove(row)
            db.delete(row)
    db.flush()

    if model.patterns_path:
        used = {row.sequence for row in card.composition_lines}
        sequence = 1
        while sequence in used:
            sequence += 1
        card.composition_lines.append(
            TechnicalCardCompositionLine(
                sequence=sequence,
                line_kind=TechnicalCardCompositionLineKind.PATTERN,
                snapshot_name=f"Лекала: {model.article}",
                notes=model.patterns_path,
            )
        )

    _sync_route_required_materials_to_composition(db, card)
    _apply_planned_qty_hints_to_composition(db, card)
    db.commit()
    return get_technical_card(db, card_id)


def apply_specification_version(
    db: Session,
    card_id: int,
    payload: TechnicalCardApplySpecification,
) -> TechnicalCard:
    """Copy approved Spec version snapshot onto the card (ADR-004 / ADR-016).

    Stage 7 catalog is not loaded here: approved lines must be provided explicitly.
    Empty lines are allowed (partial composition) but version stamp is required.
    """
    card = get_technical_card(db, card_id)
    _assert_composition_editable(card)
    _validate_composition_payload(db, payload.lines)

    card.specification_version_id = payload.specification_version_id
    card.specification_version_label = payload.specification_version_label
    _clear_composition_lines(db, card)
    _append_composition_lines(db, card, payload.lines)
    db.commit()
    return get_technical_card(db, card_id)


def _assert_unit_lines_editable(card: TechnicalCard) -> None:
    if card.status in {TechnicalCardStatus.CANCELLED, TechnicalCardStatus.COMPLETED}:
        raise TechnicalCardValidationError(
            "Cannot edit unit lines on a cancelled or completed card"
        )


def _order_item_for_card(db: Session, card: TechnicalCard) -> SalesOrderItem:
    item = db.get(SalesOrderItem, card.sales_order_item_id)
    if item is None:
        raise TechnicalCardValidationError("Order item not found for technical card")
    return item


def list_unit_lines(db: Session, card_id: int) -> list[TechnicalCardUnitLine]:
    card = get_technical_card(db, card_id)
    return sorted(card.unit_lines, key=lambda row: row.unit_index)


def _apply_unit_line_fields(line: TechnicalCardUnitLine, changes: dict) -> None:
    for field_name, value in changes.items():
        setattr(line, field_name, value)


def update_unit_line(
    db: Session,
    card_id: int,
    line_id: int,
    payload: TechnicalCardUnitLineUpdate,
) -> TechnicalCard:
    card = get_technical_card(db, card_id)
    _assert_unit_lines_editable(card)
    line = next((row for row in card.unit_lines if row.id == line_id), None)
    if line is None:
        raise TechnicalCardNotFoundError("Unit line not found")
    changes = payload.model_dump(exclude_unset=True)
    if not changes:
        raise TechnicalCardValidationError("No fields to update")
    _apply_unit_line_fields(line, changes)
    db.commit()
    return get_technical_card(db, card_id)


def _resolve_unit_line(
    card: TechnicalCard, item: TechnicalCardUnitLineBulkItem
) -> TechnicalCardUnitLine:
    if item.id is not None:
        line = next((row for row in card.unit_lines if row.id == item.id), None)
        if line is None:
            raise TechnicalCardNotFoundError(f"Unit line id={item.id} not found")
        if item.unit_index is not None and item.unit_index != line.unit_index:
            raise TechnicalCardValidationError(
                "unit_index does not match the targeted unit line id"
            )
        return line
    if item.unit_index is None:
        raise TechnicalCardValidationError("Each bulk line requires id or unit_index")
    line = next((row for row in card.unit_lines if row.unit_index == item.unit_index), None)
    if line is None:
        raise TechnicalCardNotFoundError(
            f"Unit line unit_index={item.unit_index} not found"
        )
    return line


def bulk_update_unit_lines(
    db: Session,
    card_id: int,
    items: list[TechnicalCardUnitLineBulkItem],
) -> TechnicalCard:
    card = get_technical_card(db, card_id)
    _assert_unit_lines_editable(card)
    for item in items:
        line = _resolve_unit_line(card, item)
        changes = item.model_dump(exclude_unset=True, exclude={"id", "unit_index"})
        if not changes:
            raise TechnicalCardValidationError(
                f"No fields to update for unit_index={line.unit_index}"
            )
        _apply_unit_line_fields(line, changes)
    db.commit()
    return get_technical_card(db, card_id)


def replace_unit_lines(
    db: Session,
    card_id: int,
    lines: list[TechnicalCardUnitLineWrite],
) -> TechnicalCard:
    """Replace characteristic fields for all unit rows; count must equal quantity."""
    card = get_technical_card(db, card_id)
    _assert_unit_lines_editable(card)
    item = _order_item_for_card(db, card)
    expected = unit_line_count_from_quantity(item.quantity)
    if len(lines) != expected:
        raise TechnicalCardValidationError(
            f"Unit line count must equal order quantity ({expected})"
        )
    indices = [line.unit_index for line in lines]
    if sorted(indices) != list(range(1, expected + 1)):
        raise TechnicalCardValidationError(
            f"unit_index values must be exactly 1..{expected}"
        )

    by_index = {line.unit_index: line for line in card.unit_lines}
    if len(by_index) != expected:
        # Auto-heal count from order qty, then apply payloads.
        sync_unit_lines(db, card, item)
        by_index = {line.unit_index: line for line in card.unit_lines}

    for payload in lines:
        target = by_index[payload.unit_index]
        target.size_type = payload.size_type
        target.size = payload.size
        target.personalization = payload.personalization
        target.print_number = payload.print_number
        target.color = payload.color
        target.notes = payload.notes
    card.quantity = item.quantity
    db.commit()
    return get_technical_card(db, card_id)


def reset_unit_lines_from_order_defaults(db: Session, card_id: int) -> TechnicalCard:
    """Re-apply order-item snapshot defaults to every unit line (per-row edits cleared)."""
    card = get_technical_card(db, card_id)
    _assert_unit_lines_editable(card)
    item = _order_item_for_card(db, card)
    settings = get_technical_card_settings(db)
    sync_unit_lines(db, card, item)
    for line in card.unit_lines:
        line.size_type = (
            map_product_model_size_type_to_unit_line(item.product_model_size_type)
            if settings.unit_field_size_type_enabled
            else None
        )
        line.size = item.size_range if settings.unit_field_size_enabled else None
        line.personalization = (
            item.personalization if settings.unit_field_personalization_enabled else None
        )
        line.color = None
        line.print_number = None
        line.notes = None if settings.unit_field_notes_enabled else None
    db.commit()
    return get_technical_card(db, card_id)


def import_unit_lines(
    db: Session,
    card_id: int,
    items: list[TechnicalCardUnitLineImportRow],
) -> TechnicalCard:
    """Aggregate import hook: validate sum and expand into N unit lines."""
    card = get_technical_card(db, card_id)
    _assert_unit_lines_editable(card)
    item = _order_item_for_card(db, card)
    expected = unit_line_count_from_quantity(item.quantity)
    settings = get_technical_card_settings(db)
    total = sum(row.quantity for row in items)
    if total != expected:
        raise TechnicalCardValidationError(
            f"Сумма значений в колонке «Количество» должна совпадать с количеством в техкарте ({expected})"
        )

    expanded: list[TechnicalCardUnitLineWrite] = []
    next_index = 1
    for row in items:
        for _ in range(row.quantity):
            expanded.append(
                TechnicalCardUnitLineWrite(
                    unit_index=next_index,
                    size_type=(
                        row.size_type if settings.unit_field_size_type_enabled else None
                    ),
                    size=row.size if settings.unit_field_size_enabled else None,
                    personalization=(
                        row.personalization
                        if settings.unit_field_personalization_enabled
                        else None
                    ),
                    print_number=(
                        row.print_number
                        if settings.unit_field_print_number_enabled
                        else None
                    ),
                    color=None,
                    notes=row.notes if settings.unit_field_notes_enabled else None,
                )
            )
            next_index += 1
    return replace_unit_lines(db, card_id, expanded)


_UNIT_LINE_IMPORT_TEMPLATE_COLUMNS = {
    "Номер": "print_number",
    "Имя": "personalization",
    "Тип размера": "size_type",
    "Размер": "size",
    "Рост": "height",
    "Количество": "quantity",
}


def import_unit_lines_from_template_file(
    db: Session,
    card_id: int,
    data: bytes,
    *,
    filename: str | None = None,
    content_type: str | None = None,
    sheet_name: str | None = None,
) -> TechnicalCard:
    """Import aggregate unit-line rows from the technical-card XLSX template."""
    try:
        table = parse_tabular_bytes(
            data,
            filename=filename,
            content_type=content_type,
            sheet_name=sheet_name,
        )
    except FileIoParseError as error:
        raise TechnicalCardValidationError(str(error)) from error

    present_headers = {header.strip() for header in table.headers}
    missing = [
        header
        for header in _UNIT_LINE_IMPORT_TEMPLATE_COLUMNS
        if header not in present_headers
    ]
    if missing:
        raise TechnicalCardValidationError(
            "Missing required import columns: " + ", ".join(missing)
        )

    rows: list[TechnicalCardUnitLineImportRow] = []
    for index, raw in enumerate(table.rows, start=1):
        mapped = {
            target: raw.get(source)
            for source, target in _UNIT_LINE_IMPORT_TEMPLATE_COLUMNS.items()
        }
        _validate_unit_line_template_size(
            db,
            size_type_label=raw.get("Тип размера"),
            size_value=raw.get("Размер"),
            row_number=index,
        )
        rows.append(_unit_line_import_row_from_template(mapped, row_number=index))

    if not rows:
        raise TechnicalCardValidationError("Import file has no data rows")

    return import_unit_lines(db, card_id, rows)


def _unit_line_import_row_from_template(
    row: dict[str, str | None],
    *,
    row_number: int,
) -> TechnicalCardUnitLineImportRow:
    return TechnicalCardUnitLineImportRow(
        size_type=_normalize_unit_line_template_size_type(
            row.get("size_type"), row_number=row_number
        ),
        size=_optional_template_text(row.get("size")),
        personalization=_optional_template_text(row.get("personalization")),
        print_number=_optional_template_print_number(row.get("print_number")),
        quantity=_parse_unit_line_import_quantity(
            row.get("quantity"), row_number=row_number
        ),
        notes=None,
    )


def _parse_unit_line_import_quantity(
    value: str | None,
    *,
    row_number: int,
) -> int:
    if value is None or not str(value).strip():
        raise TechnicalCardValidationError(
            f"Row {row_number}: column 'Количество' is required"
        )
    normalized = str(value).strip().replace(" ", "").replace(",", ".")
    try:
        quantity = Decimal(normalized)
    except InvalidOperation as error:
        raise TechnicalCardValidationError(
            f"Row {row_number}: column 'Количество' must be a whole number >= 1"
        ) from error
    if quantity < 1 or quantity != quantity.to_integral_value():
        raise TechnicalCardValidationError(
            f"Row {row_number}: column 'Количество' must be a whole number >= 1"
        )
    return int(quantity)


def _normalize_unit_line_template_size_type(
    value: str | None,
    *,
    row_number: int,
) -> str | None:
    normalized = _optional_template_text(value)
    if normalized is None:
        raise TechnicalCardValidationError(
            f"Row {row_number}: column 'Тип размера' is required"
        )
    lowered = normalized.casefold()
    if "муж" in lowered or lowered in {"male", "men"}:
        return "male"
    if "жен" in lowered or lowered in {"female", "women"}:
        return "female"
    raise TechnicalCardValidationError(
        f"Row {row_number}: unsupported 'Тип размера' value '{normalized}'"
    )


def _validate_unit_line_template_size(
    db: Session,
    *,
    size_type_label: str | None,
    size_value: str | None,
    row_number: int,
) -> None:
    grid_name = _optional_template_text(size_type_label)
    if grid_name is None:
        raise TechnicalCardValidationError(
            f"Строка {row_number}: колонка «Тип размера» обязательна"
        )

    grid = _find_size_grid_for_unit_line_import(db, grid_name)
    if grid is None:
        raise TechnicalCardValidationError(
            f"Строка {row_number}: размерная сетка «{grid_name}» не найдена"
        )

    ru_size, int_label = _split_unit_line_template_size(size_value, row_number=row_number)
    if not any(
        row.ru_size.strip() == ru_size and row.int_label.strip() == int_label
        for row in grid.rows
    ):
        raise TechnicalCardValidationError(
            f"Строка {row_number}: размер не найден в сетке «{grid.name}»"
        )


def _find_size_grid_for_unit_line_import(
    db: Session,
    grid_name: str,
) -> SizeGrid | None:
    normalized = grid_name.strip()
    if not normalized:
        return None
    return db.scalar(
        select(SizeGrid)
        .options(selectinload(SizeGrid.rows))
        .where(func.lower(SizeGrid.name) == normalized.lower())
    )


def _split_unit_line_template_size(
    value: str | None,
    *,
    row_number: int,
) -> tuple[str, str]:
    normalized = _optional_template_text(value)
    if normalized is None:
        raise TechnicalCardValidationError(
            f"Строка {row_number}: колонка «Размер» обязательна"
        )
    parts = [part.strip() for part in normalized.split("/", 1)]
    if len(parts) != 2 or not parts[0] or not parts[1]:
        raise TechnicalCardValidationError(
            f"Строка {row_number}: размер должен быть в формате RU/INT, например 32/134"
        )
    return parts[0], parts[1]


def _optional_template_print_number(value: str | None) -> str | None:
    normalized = _optional_template_text(value)
    if normalized in {None, "-"}:
        return None
    return normalized


def _optional_template_text(value: str | None) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _assert_operation_lines_editable(card: TechnicalCard) -> None:
    if card.status in {TechnicalCardStatus.CANCELLED, TechnicalCardStatus.COMPLETED}:
        raise TechnicalCardValidationError(
            "Cannot edit operation volume lines on a cancelled or completed card"
        )


def _tech_operations_table_available(db: Session) -> bool:
    """Soft detect Stage 8.1.3 catalog without requiring the model to exist yet."""
    bind = db.get_bind()
    if bind is None:
        return False
    from sqlalchemy import inspect as sa_inspect

    return "tech_operations" in sa_inspect(bind).get_table_names()


def _load_tech_operation_row(db: Session, tech_operation_id: int) -> dict | None:
    if not _tech_operations_table_available(db):
        return None
    from sqlalchemy import text

    result = db.execute(
        text(
            "SELECT id, name, volume_unit FROM tech_operations "
            "WHERE id = :id AND is_active = true"
        ),
        {"id": tech_operation_id},
    ).mappings().first()
    return dict(result) if result is not None else None


def _validate_operation_lines_payload(
    db: Session, lines: list[TechnicalCardOperationLineWrite]
) -> None:
    sequences = [line.sequence for line in lines]
    if len(sequences) != len(set(sequences)):
        raise TechnicalCardValidationError("Operation line sequences must be unique")

    stage_orders = [line.stage_order for line in lines if line.stage_order is not None]
    if len(stage_orders) != len(set(stage_orders)):
        raise TechnicalCardValidationError(
            "stage_order values must be unique when set on operation lines"
        )

    catalog_available = _tech_operations_table_available(db)
    for line in lines:
        if line.volume_unit not in {
            TechOperationVolumeUnit.LINEAR_METERS,
            TechOperationVolumeUnit.PIECES,
        }:
            raise TechnicalCardValidationError(
                f"Unsupported volume_unit: {line.volume_unit}"
            )
        if line.tech_operation_id is None:
            continue
        if not catalog_available:
            # Soft id allowed as opaque snapshot until 8.1.3; no live unit check.
            continue
        catalog = _load_tech_operation_row(db, line.tech_operation_id)
        if catalog is None:
            raise TechnicalCardValidationError(
                f"TechOperation {line.tech_operation_id} not found or inactive"
            )
        catalog_unit = catalog["volume_unit"]
        line_unit = (
            line.volume_unit.value
            if isinstance(line.volume_unit, TechOperationVolumeUnit)
            else str(line.volume_unit)
        )
        if catalog_unit != line_unit:
            raise TechnicalCardValidationError(
                "volume_unit must match TechOperation catalog snapshot"
            )


def list_operation_lines(db: Session, card_id: int) -> list[TechnicalCardOperationLine]:
    card = get_technical_card(db, card_id)
    return sorted(card.operation_lines, key=lambda row: (row.sequence, row.id))


def _clear_operation_lines(db: Session, card: TechnicalCard) -> None:
    for row in list(card.operation_lines):
        card.operation_lines.remove(row)
        db.delete(row)
    db.flush()


def _append_operation_lines(
    card: TechnicalCard, lines: list[TechnicalCardOperationLineWrite]
) -> None:
    for line in sorted(lines, key=lambda row: row.sequence):
        card.operation_lines.append(
            TechnicalCardOperationLine(
                sequence=line.sequence,
                source_kind=line.source_kind
                or TechnicalCardOperationLineSourceKind.ROUTING,
                tech_operation_id=line.tech_operation_id,
                sewing_operation_id=line.sewing_operation_id,
                operation_name=line.operation_name,
                volume_unit=line.volume_unit,
                volume=line.volume,
                stage_order=line.stage_order,
                production_stage_id=line.production_stage_id,
                stage_label=line.stage_label,
            )
        )


def replace_operation_lines(
    db: Session,
    card_id: int,
    lines: list[TechnicalCardOperationLineWrite],
) -> TechnicalCard:
    card = get_technical_card(db, card_id)
    _assert_operation_lines_editable(card)
    if card.status != TechnicalCardStatus.DRAFT:
        raise TechnicalCardValidationError(
            "Full operation-line replace is allowed only while the card is draft; "
            "use volume patch to adjust volumes after generate"
        )
    _validate_operation_lines_payload(db, lines)
    _clear_operation_lines(db, card)
    _append_operation_lines(card, lines)
    db.commit()
    return get_technical_card(db, card_id)


def update_operation_line_volume(
    db: Session,
    card_id: int,
    line_id: int,
    *,
    volume: Decimal,
    operation_name: str | None = None,
    shop_stage_code: str | None = None,
) -> TechnicalCard:
    card = get_technical_card(db, card_id)
    _assert_operation_lines_editable(card)
    line = next((row for row in card.operation_lines if row.id == line_id), None)
    if line is None:
        raise TechnicalCardNotFoundError("Operation volume line not found")

    required_code = (shop_stage_code or "").strip().lower() or None
    if required_code:
        from app.services.technical_card_stages import (
            assert_shop_module_current_stage,
            resolve_production_stage_code,
        )

        current = assert_shop_module_current_stage(db, card, required_code)
        if line.production_stage_id is None:
            raise TechnicalCardValidationError(
                f"Operation line has no production stage; cannot bind shop module "
                f"`{required_code}`"
            )
        line_code = resolve_production_stage_code(db, line.production_stage_id, None)
        if line_code != required_code:
            raise TechnicalCardValidationError(
                f"Shop module `{required_code}` can only edit volumes for operations "
                f"bound to that цех (line stage=`{line_code or 'unset'}`)"
            )
        if (
            current.production_stage_id is not None
            and line.production_stage_id != current.production_stage_id
        ):
            raise TechnicalCardValidationError(
                f"Operation line is not bound to the current routing stage "
                f"(`{required_code}`)"
            )

    line.volume = volume
    if operation_name is not None:
        if card.status != TechnicalCardStatus.DRAFT:
            raise TechnicalCardValidationError(
                "operation_name can only be edited while the card is draft"
            )
        line.operation_name = operation_name
    db.commit()
    return get_technical_card(db, card_id)


def prefill_operation_lines_from_catalog(
    db: Session, card_id: int
) -> tuple[TechnicalCard, bool, bool, str]:
    """Prefill from TechOperation catalog when `8.1.3` table exists; else no-op (no demo)."""
    card = get_technical_card(db, card_id)
    _assert_operation_lines_editable(card)

    if card.operation_lines:
        return (
            card,
            False,
            _tech_operations_table_available(db),
            "Operation lines already present; prefill skipped",
        )

    if not _tech_operations_table_available(db):
        return (
            card,
            False,
            False,
            "TechOperation catalog not available yet (Stage 8.1.3); left empty",
        )

    from sqlalchemy import text

    rows = db.execute(
        text(
            "SELECT id, name, volume_unit, production_stage_id FROM tech_operations "
            "WHERE is_active = true ORDER BY id"
        )
    ).mappings().all()
    if not rows:
        return (
            card,
            False,
            True,
            "TechOperation catalog is empty; left empty (no demo rows)",
        )

    settings = get_technical_card_settings(db)
    stage_name_by_id = {
        row.id: row.name
        for row in db.scalars(
            select(ProductionStage).where(ProductionStage.is_active.is_(True))
        ).all()
    }
    payloads = [
        TechnicalCardOperationLineWrite(
            sequence=index,
            tech_operation_id=int(row["id"]),
            operation_name=str(row["name"]),
            volume_unit=TechOperationVolumeUnit(row["volume_unit"]),
            volume=Decimal("0"),
            production_stage_id=(
                int(row["production_stage_id"])
                if row["production_stage_id"] is not None
                else None
            ),
            stage_label=(
                stage_name_by_id.get(int(row["production_stage_id"]))
                if settings.stage_label_binding_mode == "snapshot"
                and row["production_stage_id"] is not None
                else None
            ),
        )
        for index, row in enumerate(rows, start=1)
    ]
    _validate_operation_lines_payload(db, payloads)
    _append_operation_lines(card, payloads)
    db.commit()
    return (
        get_technical_card(db, card_id),
        True,
        True,
        f"Prefilled {len(payloads)} operation line(s) from TechOperation catalog",
    )
