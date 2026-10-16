"""Read-only provenance checks feeding the existing production diagnostic resolver."""
from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.product_model import ProductModel, AssemblyVariant
from app.models.shop_routing import ShopRoutingTemplate
from app.models.tech_operation import TechOperation
from app.repositories.product_model_routings import get_link_by_template
from app.schemas.production_diagnostics import DiagnosticTraceStep, ProductionDiagnostic


def lineage_issue(card, code, category, field, source, expected, actual, *, module="routing", formula=None, operation_id=None):
    return ProductionDiagnostic(code=code, category=category, module=module, entity_type="technical_card",
        entity_id=card.id, entity_name=card.number, field=field, field_label=field, message=f"{card.number}: {code}",
        fix_scope="technical_card", operation_id=operation_id, expected_source=source, source_value=expected,
        actual_value=actual, formula=formula, reason=code, fix_action="Review the source and explicitly reapply after resolving facts/manual plan protection",
        fix_url=f"/production/tech-cards/{card.id}", fix_target={"entity_type":"technical_card","entity_id":card.id,"field":field},
        trace=(DiagnosticTraceStep(source=source,value=expected), DiagnosticTraceStep(source=f"TechnicalCard.{field}",value=actual,broken=True),
               DiagnosticTraceStep(source="Demand"),DiagnosticTraceStep(source="Scheduler")))


def card_lineage_diagnostics(db: Session, card, rows, snapshot):
    rows = list(rows)
    for index, issue in enumerate(rows):
        if issue.code in {"missing_sewing_norm", "sewing_norm_unverified"}:
            table = "sales_order_item_assembly_operation_snapshots" if card.sales_order_item_id is not None else "assembly_operation_lines"
            values = [{"id": source.id, "duration_seconds": source.duration_seconds, "quantity_per_item": source.quantity_per_item}
                      for source in snapshot.sewing_sources]
            rows[index] = issue.model_copy(update={"expected_source": table, "source_value": values,
                "actual_value": [row.id for row in snapshot.applied_sewing], "category": "CONFIGURATION" if issue.code == "missing_sewing_norm" else "DATA_FLOW",
                "module": "assembly", "reason": issue.code, "formula": "sum(duration_seconds * multiplicity) * quantity / 3600",
                "fix_action": "Verify the applied assembly time sources and explicitly update the binding if needed",
                "fix_url": f"/production/tech-cards/{card.id}", "fix_target": {"entity_type": "technical_card", "entity_id": card.id, "field": "assembly_variant_id"},
                "trace": (DiagnosticTraceStep(source=table,value=values,broken=not values or any(v["duration_seconds"]<=0 for v in values)),
                          DiagnosticTraceStep(source="TechnicalCardOperationLine sewing set",value=[r.id for r in snapshot.applied_sewing]),
                          DiagnosticTraceStep(source="Demand labor_hour",broken=True),DiagnosticTraceStep(source="Scheduler"))})
    for field, model in (("routing_template_id",ShopRoutingTemplate),("product_model_id",ProductModel),("assembly_variant_id",AssemblyVariant)):
        value=getattr(card,field)
        if value is not None and db.get(model,value) is None:
            rows.append(lineage_issue(card,"broken_reference","INTEGRITY",field,model.__name__+".id",value,None))
    template=db.get(ShopRoutingTemplate,card.routing_template_id) if card.routing_template_id is not None else None
    if template is not None and template.stage_lines and not card.stage_results:
        rows.append(lineage_issue(card,"route_snapshot_missing","DATA_FLOW","stage_results","ShopRoutingTemplate.stage_lines",
                                  [line.id for line in template.stage_lines],[]))
    operations={row.id for row in db.scalars(select(TechOperation).where(TechOperation.id.in_({s.tech_operation_id for s in card.stage_results if s.tech_operation_id is not None})))}
    for stage in card.stage_results:
        if stage.tech_operation_id is not None and stage.tech_operation_id not in operations:
            rows.append(lineage_issue(card,"broken_reference","INTEGRITY","tech_operation_id","TechOperation.id",stage.tech_operation_id,None))
    link=get_link_by_template(db,card.product_model_id,card.routing_template_id) if card.product_model_id and card.routing_template_id else None
    norms=list(link.operation_norms) if link is not None and link.is_active else []
    from app.services.route_variants import selection_resolution
    excluded,_=selection_resolution(card)
    active_orders={s.stage_order for s in card.stage_results if f"snapshot:{s.id}" not in excluded}
    for line in card.operation_lines:
        if line.source_kind == "routing" and line.stage_order not in active_orders:
            continue
        if line.volume_qty_per_item is not None:
            expected=(Decimal(line.volume_qty_per_item)*Decimal(card.quantity)).quantize(Decimal("0.001"),rounding=ROUND_HALF_UP)
            if line.volume != expected:
                rows.append(lineage_issue(card,"derived_volume_mismatch","DATA_FLOW","volume","TechnicalCardOperationLine.volume_qty_per_item",
                    str(line.volume_qty_per_item),str(line.volume),module="operation_volume",formula="ROUND_HALF_UP(basis * quantity, 0.001)",operation_id=line.tech_operation_id).model_copy(
                        update={"debug_details":{"operation_line_id":line.id,"quantity":str(card.quantity),"expected_volume":str(expected)}}))
        if line.source_kind != "routing" or line.volume != 0 or line.volume_qty_per_item is not None:
            continue
        compatible=[n for n in norms if n.production_stage_id in (None,line.production_stage_id)]
        matched=[n for n in compatible if n.tech_operation_id==line.tech_operation_id] or [n for n in compatible if n.tech_operation_id is None and n.production_stage_id==line.production_stage_id]
        if len(matched)==1 and matched[0].unit==line.volume_unit and matched[0].norm_qty_per_item>0:
            rows.append(lineage_issue(card,"operation_input_snapshot_missing","DATA_FLOW","volume_qty_per_item","ProductModelOperationNorm.norm_qty_per_item",
                str(matched[0].norm_qty_per_item),None,module="operation_volume",formula="norm_per_item * quantity",operation_id=line.tech_operation_id).model_copy(
                    update={"debug_details":{"norm_id":matched[0].id,"operation_line_id":line.id,"quantity":str(card.quantity),"stored_volume":str(line.volume)}}))
    return rows
