"""One batched read of the inputs a demand calculation is allowed to see."""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.product_model import AssemblyOperationLine, AssemblyVariant
from app.models.production_capacity import CapacityResource, TechOperationCapacityResource
from app.models.sales import SalesOrderItemAssemblyOperationSnapshot
from app.models.shop_routing import ShopRoutingStageLine
from app.models.tech_operation import TechOperation
from app.models.technical_card import TechnicalCard, TechnicalCardOperationLine


def _text(value: object) -> str:
    return value.value if hasattr(value, "value") else str(value)


@dataclass(frozen=True)
class SewingSource:
    id: int
    sewing_operation_id: int | None
    operation_name: str
    duration_seconds: int
    quantity_per_item: int
    norm_table: str


@dataclass(frozen=True)
class AppliedSewingRow:
    id: int
    sewing_operation_id: int | None
    operation_name: str
    stage_order: int | None
    production_stage_id: int | None


@dataclass(frozen=True)
class VolumeRow:
    id: int
    tech_operation_id: int | None
    stage_order: int | None
    production_stage_id: int | None
    volume: Decimal
    volume_unit: str
    cutting_method: str | None = None


@dataclass(frozen=True)
class ResourceView:
    resource_key: str
    calculation_mode: str
    capacity_unit: str | None
    resource_type: str
    include_in_calendar_load: bool
    norm_rates: dict | None = None


@dataclass(frozen=True)
class DemandStep:
    routing_stage_line_id: int
    routing_template_id: int
    stage_order: int
    stage_label: str
    production_stage_id: int | None
    operation_id: int | None
    operation_name: str | None
    operation_stage_id: int | None
    operation_volume_unit: str | None
    resources: tuple[ResourceView, ...]
    operation_code: str | None = None


@dataclass(frozen=True)
class CardDemandSnapshot:
    technical_card_id: int
    quantity: Decimal
    routing_template_id: int | None
    sales_order_item_id: int | None
    sewing_unverified: bool
    sewing_sources: tuple[SewingSource, ...]
    applied_sewing: tuple[AppliedSewingRow, ...]
    volumes: tuple[VolumeRow, ...]
    steps: tuple[DemandStep, ...]


def build_sewing_sources(
    *,
    sales_order_item_id: int | None,
    product_model_id: int | None,
    variant_model_id: int | None,
    snapshots: list[SalesOrderItemAssemblyOperationSnapshot],
    variant_lines: list[AssemblyOperationLine],
) -> tuple[tuple[SewingSource, ...], bool]:
    """Sales-order cards use only that item's snapshots. A standalone variant must belong to the card model."""
    if sales_order_item_id is not None:
        return tuple(_snapshot_source(row) for row in sorted(snapshots, key=lambda row: row.id)), False
    if variant_model_id is None or product_model_id is None or variant_model_id != product_model_id:
        return (), True
    return tuple(_variant_source(row) for row in sorted(variant_lines, key=lambda row: row.id)), False


def load_card_demand_snapshot(db: Session, card_id: int) -> CardDemandSnapshot | None:
    card = db.get(TechnicalCard, card_id)
    if card is None:
        return None
    lines = list(db.scalars(
        select(ShopRoutingStageLine)
        .where(ShopRoutingStageLine.routing_template_id == card.routing_template_id)
        .order_by(ShopRoutingStageLine.stage_order, ShopRoutingStageLine.id)
    )) if card.routing_template_id is not None else []
    operation_ids = {line.tech_operation_id for line in lines if line.tech_operation_id is not None}
    operations = {
        row.id: row for row in db.scalars(select(TechOperation).where(TechOperation.id.in_(operation_ids)))
    } if operation_ids else {}
    links = list(db.scalars(
        select(TechOperationCapacityResource)
        .where(TechOperationCapacityResource.tech_operation_id.in_(operation_ids))
    )) if operation_ids else []
    keys = {link.resource_key for link in links}
    resources = {
        row.resource_key: row for row in db.scalars(select(CapacityResource).where(CapacityResource.resource_key.in_(keys)))
    } if keys else {}
    operation_lines = list(db.scalars(
        select(TechnicalCardOperationLine)
        .where(TechnicalCardOperationLine.technical_card_id == card.id)
        .order_by(TechnicalCardOperationLine.id)
    ))
    sources, unverified = _load_sewing_sources(db, card)
    applied = tuple(
        AppliedSewingRow(
            id=row.id,
            sewing_operation_id=row.sewing_operation_id,
            operation_name=row.operation_name,
            stage_order=row.stage_order,
            production_stage_id=row.production_stage_id,
        )
        for row in operation_lines
        if _text(row.source_kind) == "sewing"
    )
    volumes = tuple(
        VolumeRow(
            id=row.id,
            tech_operation_id=row.tech_operation_id,
            stage_order=row.stage_order,
            production_stage_id=row.production_stage_id,
            volume=Decimal(row.volume),
            volume_unit=_text(row.volume_unit),
            cutting_method=row.cutting_method,
        )
        for row in operation_lines
        if _text(row.source_kind) == "routing"
    )
    steps = tuple(
        _step(line, operations.get(line.tech_operation_id), links, resources)
        for line in lines
    )
    return CardDemandSnapshot(
        technical_card_id=card.id,
        quantity=Decimal(card.quantity),
        routing_template_id=card.routing_template_id,
        sales_order_item_id=card.sales_order_item_id,
        sewing_unverified=unverified,
        sewing_sources=sources,
        applied_sewing=applied,
        volumes=volumes,
        steps=steps,
    )


def _load_sewing_sources(db: Session, card: TechnicalCard) -> tuple[tuple[SewingSource, ...], bool]:
    if card.sales_order_item_id is not None:
        snapshots = list(db.scalars(
            select(SalesOrderItemAssemblyOperationSnapshot)
            .where(SalesOrderItemAssemblyOperationSnapshot.order_item_id == card.sales_order_item_id)
            .order_by(SalesOrderItemAssemblyOperationSnapshot.id)
        ))
        return build_sewing_sources(
            sales_order_item_id=card.sales_order_item_id,
            product_model_id=card.product_model_id,
            variant_model_id=None,
            snapshots=snapshots,
            variant_lines=[],
        )
    if card.assembly_variant_id is None:
        return (), True
    variant = db.get(AssemblyVariant, card.assembly_variant_id)
    variant_lines = list(db.scalars(
        select(AssemblyOperationLine)
        .where(AssemblyOperationLine.assembly_variant_id == card.assembly_variant_id)
        .order_by(AssemblyOperationLine.id)
    )) if variant is not None else []
    return build_sewing_sources(
        sales_order_item_id=None,
        product_model_id=card.product_model_id,
        variant_model_id=None if variant is None else variant.product_model_id,
        snapshots=[],
        variant_lines=variant_lines,
    )


def _snapshot_source(row: SalesOrderItemAssemblyOperationSnapshot) -> SewingSource:
    return SewingSource(
        id=row.id,
        sewing_operation_id=row.sewing_operation_id,
        operation_name=row.operation_name,
        duration_seconds=row.duration_seconds,
        quantity_per_item=row.quantity_per_item,
        norm_table="sales_order_item_assembly_operation_snapshots",
    )


def _variant_source(row: AssemblyOperationLine) -> SewingSource:
    return SewingSource(
        id=row.id,
        sewing_operation_id=row.sewing_operation_id,
        operation_name=row.operation_name,
        duration_seconds=row.duration_seconds,
        quantity_per_item=row.quantity_per_item,
        norm_table="assembly_operation_lines",
    )


def _step(line: ShopRoutingStageLine, operation: TechOperation | None, links, resources) -> DemandStep:
    own = [link.resource_key for link in links if link.tech_operation_id == line.tech_operation_id]
    views = tuple(
        ResourceView(
            resource_key=key,
            calculation_mode=resources[key].calculation_mode,
            capacity_unit=resources[key].capacity_unit,
            resource_type=resources[key].resource_type,
            include_in_calendar_load=bool(resources[key].include_in_calendar_load),
            norm_rates=resources[key].norm_rates if isinstance(resources[key].norm_rates, dict) else None,
        )
        for key in sorted(own)
        if key in resources
    )
    return DemandStep(
        routing_stage_line_id=line.id,
        routing_template_id=line.routing_template_id,
        stage_order=line.stage_order,
        stage_label=line.stage_label,
        production_stage_id=line.production_stage_id,
        operation_id=None if operation is None else operation.id,
        operation_name=None if operation is None else operation.name,
        operation_stage_id=None if operation is None else operation.production_stage_id,
        operation_volume_unit=None if operation is None else _text(operation.volume_unit),
        resources=views,
        operation_code=None if operation is None else operation.code,
    )
