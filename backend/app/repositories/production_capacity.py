"""Batch reads for capacity settings and existing sewing norms; independent of resource/row count."""
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.production_capacity import ProductionCapacityException, ProductionCapacitySettings
from app.models.production_stage import ProductionStage
from app.models.shop_routing import WorkCenter
from app.models.product_model import AssemblyOperationLine, AssemblyVariant
from app.models.sales import SalesOrderItemAssemblyOperationSnapshot
from app.models.technical_card import TechnicalCard, TechnicalCardOperationLine


def read_capacity_data(db: Session) -> tuple[list, list, list, list]:
    return (
        list(db.scalars(select(ProductionStage).order_by(ProductionStage.sort_order, ProductionStage.id))),
        list(db.scalars(select(WorkCenter).order_by(WorkCenter.id))),
        list(db.scalars(select(ProductionCapacitySettings))),
        list(db.scalars(select(ProductionCapacityException).order_by(ProductionCapacityException.date))),
    )


def sewing_norm_data(db: Session, card_ids: set[int]) -> tuple[list, list, list, list]:
    if not card_ids:
        return [], [], [], []
    cards = list(db.scalars(select(TechnicalCard).where(TechnicalCard.id.in_(card_ids))))
    lines = list(db.scalars(select(TechnicalCardOperationLine).where(
        TechnicalCardOperationLine.technical_card_id.in_(card_ids),
        TechnicalCardOperationLine.source_kind == "sewing",
    )))
    item_ids = {card.sales_order_item_id for card in cards if card.sales_order_item_id is not None}
    variant_ids = {card.assembly_variant_id for card in cards if card.sales_order_item_id is None and card.assembly_variant_id is not None}
    snapshots = list(db.scalars(select(SalesOrderItemAssemblyOperationSnapshot).where(
        SalesOrderItemAssemblyOperationSnapshot.order_item_id.in_(item_ids),
    ))) if item_ids else []
    variants = list(db.execute(select(AssemblyOperationLine, AssemblyVariant.product_model_id).join(
        AssemblyVariant, AssemblyVariant.id == AssemblyOperationLine.assembly_variant_id,
    ).where(AssemblyOperationLine.assembly_variant_id.in_(variant_ids)))) if variant_ids else []
    return cards, lines, snapshots, variants
