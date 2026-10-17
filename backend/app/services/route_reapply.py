"""IC-G01: preflight and selective reapply without replacing production facts."""
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.production_stage import ProductionStage
from app.models.shop_routing import ShopRoutingTemplate, ShopRoutingNodeDependency
from app.models.tech_operation import TechOperation
from app.models.technical_card import TechnicalCard, TechnicalCardStageResult, TechnicalCardRouteEdge, TechnicalCardOperationLine
from app.models.sewing_work_ledger import SewingWorkLedgerEntry
from app.models.stock import StockLedgerLine
from app.schemas.routing_graph import RoutingVariantGroup
from pydantic import ValidationError
from app.schemas.production_diagnostics import ProductionDiagnostic, DiagnosticTraceStep
from app.services.technical_cards import TechnicalCardConflictError

CODE = "route_reapply_conflicts_with_production_fact"
FACT_FIELDS = ("started_at", "completed_at", "performer_name", "work_done", "duration_seconds", "scrap_qty", "rework_qty", "notes")


class RouteReapplyConflict(TechnicalCardConflictError):
    code = CODE
    category = "INTEGRITY"

    def __init__(self, diagnostics: list[ProductionDiagnostic]):
        self.diagnostics = diagnostics
        super().__init__(diagnostics[0].message)


@dataclass(frozen=True)
class ProposedStage:
    key: str
    order: int
    workshop: int | None
    label: str
    operation: int | None
    source: int | None
    required: bool
    equipment: int | None
    name: str | None
    code: str | None
    unit: str | None


@dataclass
class ReapplyPlan:
    stages: list[ProposedStage]
    matches: dict[str, TechnicalCardStageResult]
    protected: set[int]
    edges: set[tuple[str, str]]
    groups: list[dict]
    diagnostics: list[ProductionDiagnostic]


def protected_nodes(db: Session, card: TechnicalCard, *, ledger=None, has_stock=None,
                    sewing_workshop_ids=None) -> set[int]:
    """Shared fact guard; optional preloaded facts support bounded batch reads."""
    protected = {s.id for s in card.stage_results if s.status in {"in_progress", "completed", "skipped"}
                 or any(getattr(s, field) not in (None, "") for field in FACT_FIELDS)}
    workshops = {line.production_stage_id for line in card.composition_lines if line.fact_qty is not None}
    workshops.update(unit.production_stage_id for unit in card.unit_lines
                     if unit.last_transfer_kind or unit.fg_receipt_posted or unit.fg_issue_posted or unit.is_scrapped)
    if ledger is None:
        ledger = list(db.scalars(select(SewingWorkLedgerEntry).where(SewingWorkLedgerEntry.technical_card_id == card.id)))
    operation_ids = {row.operation_line_id for row in ledger if row.operation_line_id is not None}
    workshops.update(line.production_stage_id for line in card.operation_lines if line.id in operation_ids)
    if any(row.operation_line_id is None for row in ledger):
        workshops.update(s.production_stage_id for s in card.stage_results if "пошив" in s.stage_label.lower())
        workshops.update(sewing_workshop_ids if sewing_workshop_ids is not None else
                         db.scalars(select(ProductionStage.id).where(ProductionStage.code == "sewing")))
    if has_stock is None:
        has_stock = db.scalar(select(StockLedgerLine.id).where(StockLedgerLine.technical_card_id == card.id).limit(1)) is not None
    if None in workshops or has_stock:
        protected.update(s.id for s in card.stage_results)
    protected.update(s.id for s in card.stage_results if s.production_stage_id in workshops)
    return protected


def _proposal(db: Session, template) -> list[ProposedStage]:
    operations = {op.id: op for op in db.scalars(select(TechOperation).where(
        TechOperation.id.in_({line.tech_operation_id for line in template.stage_lines if line.tech_operation_id is not None})))}
    result = []
    for line in sorted(template.stage_lines, key=lambda line: line.stage_order):
        op = operations.get(line.tech_operation_id)
        result.append(ProposedStage(f"line:{line.id}", line.stage_order, line.production_stage_id,
            line.stage_label, line.tech_operation_id, line.id, bool(line.is_required), line.work_center_id,
            None if op is None else op.name, None if op is None else op.code, None if op is None else op.volume_unit))
    # New snapshots do not acquire legacy warehouse markers.
    return result


def _changes(old, new: ProposedStage) -> list[str]:
    fields = {"stage_order": new.order, "production_stage_id": new.workshop,
              "tech_operation_id": new.operation, "is_required": new.required, "stage_label": new.label}
    changed = [field for field, value in fields.items() if getattr(old, field) != value]
    # NULL on the template must not clear actual equipment recorded on a fact.
    if new.equipment is not None and new.equipment != old.work_center_id:
        changed.append("work_center_id")
    for field, value in (("operation_name", new.name), ("operation_code", new.code)):
        if getattr(old, field) is not None and getattr(old, field) != value:
            changed.append(field)
    return changed


def _issue(card, stage, template_id: int, changes: list[str]) -> ProductionDiagnostic:
    details = dict(snapshot_node_id=stage.id, operation_id=stage.tech_operation_id,
        operation_name=stage.operation_name or stage.stage_label, fact_status=str(stage.status),
        requested_routing_template_id=template_id, attempted_changes=changes,
        fact_fields=[field for field in FACT_FIELDS if getattr(stage, field) not in (None, "")])
    return ProductionDiagnostic(code=CODE, category="INTEGRITY", module="routing",
        entity_type="technical_card", entity_id=card.id, entity_name=card.number,
        operation_id=stage.tech_operation_id, field=f"stage_results.{stage.id}", field_label="Повторное применение маршрута",
        message=f"ТК {card.number}: snapshot {stage.id}, операция «{details['operation_name']}», факт {stage.status}: маршрут пытается изменить {', '.join(changes)}. Производственный факт защищён.",
        fix_scope="technical_card", expected_source="Protected StageResult identity/fact + incoming route graph",
        source_value={"snapshot_node_id":stage.id,"status":str(stage.status)}, actual_value=changes,
        reason=CODE, fix_action="Сохранить начатые/выполненные узлы и выбор варианта; изменить только будущие операции. Восстановление факта требует отдельного согласованного сценария.",
        fix_url=f"/production/tech-cards/{card.id}", fix_target={"entity_type":"technical_card","entity_id":card.id,"snapshot_node_id":stage.id},
        debug_details=details, trace=(DiagnosticTraceStep(source="Protected snapshot node",value=stage.id),
            DiagnosticTraceStep(source="Proposed route changes",value=changes,broken=True)))


def preflight(db: Session, card: TechnicalCard, template) -> ReapplyPlan:
    stages = _proposal(db, template)
    protected = protected_nodes(db, card)
    if not protected:
        return ReapplyPlan(stages, {}, protected, set(), [], [])
    try:
        old_variant_groups = [RoutingVariantGroup.model_validate(group).model_dump(mode="json")
                              for group in card.route_variant_groups or []]
        new_variant_groups = [RoutingVariantGroup.model_validate(group).model_dump(mode="json")
                              for group in template.route_variant_groups or []]
    except ValidationError:
        issues = [_issue(card, s, template.id, ["variant_metadata_unprovable"]) for s in card.stage_results if s.id in protected]
        return ReapplyPlan(stages, {}, protected, set(), [], issues)
    matches = {}
    issues = []
    for proposed in stages:
        candidates = [s for s in card.stage_results if card.routing_template_id == template.id and
                      (s.source_routing_stage_line_id == proposed.source if proposed.source is not None
                       else s.source_routing_stage_line_id is None and s.stage_order == proposed.order and s.production_stage_id == proposed.workshop)]
        if not candidates and card.routing_template_id == template.id:
            # Only a legacy node with a known operation can be matched by a
            # unique immutable shape. Never infer an operation for a bare fact.
            candidates = [s for s in card.stage_results if s.source_routing_stage_line_id is None
                          and s.tech_operation_id is not None and s.stage_order == proposed.order
                          and s.production_stage_id == proposed.workshop and s.tech_operation_id == proposed.operation]
        if len(candidates) == 1:
            old = candidates[0]
            changed = _changes(old, proposed)
            if old.id in protected and any(row.source_kind == "routing" and row.stage_order == old.stage_order
                                          and row.volume_unit != proposed.unit for row in card.operation_lines):
                changed.append("operation_volume_unit_changed")
            if old.id in protected and changed:
                issues.append(_issue(card, old, template.id, changed))
            if not changed:
                matches[proposed.key] = old
    by_old = {old.id: key for key, old in matches.items()}
    for old in card.stage_results:
        if old.id in protected and old.id not in by_old and not any(d.debug_details["snapshot_node_id"] == old.id for d in issues):
            issues.append(_issue(card, old, template.id, ["removed_or_unprovable_identity"]))
    keys = {s.source: s.key for s in stages if s.operation is not None}
    if template.dependency_mode == "explicit":
        edges = {(keys[e.predecessor_line_id], keys[e.successor_line_id]) for e in db.scalars(select(ShopRoutingNodeDependency).where(
            ShopRoutingNodeDependency.routing_template_id == template.id)) if e.predecessor_line_id in keys and e.successor_line_id in keys}
    else:
        ordered = [s.key for s in stages if s.operation is not None]
        edges = set(zip(ordered, ordered[1:]))
    # Resolve proposed ONE OF selections without resetting a retained choice.
    old_groups = {group["id"]: group for group in old_variant_groups}
    selected_keys = {}
    old_membership = {m["operation_node_id"]: g["id"] for g in old_groups.values() for m in g["members"]}
    new_membership = {f"line:{m['operation_node_id'].split(':')[1]}": g["id"] for g in new_variant_groups for m in g["members"]}
    for group in new_variant_groups:
        selection = (card.route_variant_selections or {}).get(group["id"], {})
        selected = selection.get("selected_operation_snapshot_node_id")
        selected_keys[group["id"]] = next((key for node_id, key in by_old.items()
                                          if selected == f"snapshot:{node_id}"), None)
        member_keys = {f"line:{m['operation_node_id'].split(':')[1]}" for m in group["members"]}
        if selected_keys[group["id"]] not in member_keys:
            default = group.get("default_operation_node_id")
            selected_keys[group["id"]] = f"line:{default.split(':')[1]}" if default else None
    for old in card.stage_results:
        if old.id not in protected or old.id not in by_old:
            continue
        key = by_old[old.id]
        group_id = old_membership.get(f"snapshot:{old.id}")
        if group_id != new_membership.get(key):
            issues.append(_issue(card, old, template.id, ["variant_membership_changed"]))
        elif group_id:
            group = next(g for g in new_variant_groups if g["id"] == group_id)
            previous_default = old_groups[group_id].get("default_operation_node_id")
            previous_key = by_old.get(int(previous_default.split(":")[1])) if previous_default else None
            default = group.get("default_operation_node_id")
            default_key = f"line:{default.split(':')[1]}" if default else None
            if not group["active"] or selected_keys[group_id] != key or (default_key != previous_key and default_key != key):
                issues.append(_issue(card, old, template.id, ["started_one_of_choice_changed"]))
    from app.services.route_variants import selection_resolution
    excluded, _ = selection_resolution(card)
    new_excluded = {key for key, group in new_membership.items() if key != selected_keys[group] or
                    not next(g for g in new_variant_groups if g["id"] == group)["active"]}
    old_edges = {(e.predecessor_stage_result_id, e.successor_stage_result_id) for e in db.scalars(select(TechnicalCardRouteEdge).where(
        TechnicalCardRouteEdge.technical_card_id == card.id))}
    if not old_edges and not card.route_variant_groups:
        ordered = [s.id for s in sorted(card.stage_results, key=lambda s:s.stage_order) if s.tech_operation_id is not None]
        old_edges = set(zip(ordered, ordered[1:]))
    old_edges = {(a,b) for a,b in old_edges if f"snapshot:{a}" not in excluded and f"snapshot:{b}" not in excluded}
    effective_edges = {(a,b) for a,b in edges if a not in new_excluded and b not in new_excluded}
    def ancestors(node, pairs):
        found = set()
        frontier = {node}
        while frontier:
            frontier = {a for a,b in pairs if b in frontier} - found
            found.update(frontier)
        return found
    for old in card.stage_results:
        if old.id in protected and old.id in by_old:
            before = ancestors(old.id, old_edges)
            expected = {by_old.get(node, f"unmatched:{node}") for node in before}
            if expected != ancestors(by_old[old.id], effective_edges):
                issues.append(_issue(card, old, template.id, ["protected_predecessors_changed"]))
    if card.status == "completed" and (len(matches) != len(stages) or len(matches) != len(card.stage_results)):
        for old in card.stage_results:
            if old.id in protected:
                issues.append(_issue(card, old, template.id, ["completed_card_graph_changed"]))
                break
    reasons = {}
    for issue in issues:
        reasons.setdefault(issue.debug_details["snapshot_node_id"], []).extend(issue.debug_details["attempted_changes"])
    issues = [_issue(card, old, template.id, list(dict.fromkeys(reasons[old.id]))) for old in card.stage_results if old.id in reasons]
    return ReapplyPlan(stages, matches, protected, edges, new_variant_groups, issues)


def reapply_diagnostics(db: Session, card: TechnicalCard) -> list[ProductionDiagnostic]:
    if card.routing_template_id is None:
        return []
    template = db.get(ShopRoutingTemplate, card.routing_template_id)
    if template is None:
        return []
    return preflight(db, card, template).diagnostics


def apply_preserving_facts(db: Session, card: TechnicalCard, template) -> bool:
    plan = preflight(db, card, template)
    if plan.diagnostics:
        raise RouteReapplyConflict(plan.diagnostics)
    if not plan.protected:
        return False
    from app.services.calendar_plan_lifecycle import detach_for_nodes
    from app.services.route_variants import remap_groups
    from app.services.technical_cards import _fill_missing_routing_operation_volumes
    retained = {s.id for s in plan.matches.values()}
    removed = [s for s in card.stage_results if s.id not in retained]
    # Preserve all applied rows on fact-bearing stages (including sewing ledger
    # references and manual routing volumes); refresh only untouched future rows.
    protected_orders = {s.stage_order for s in card.stage_results if s.id in plan.protected}
    for row in list(card.operation_lines):
        if row.source_kind == "routing" and row.stage_order not in protected_orders:
            card.operation_lines.remove(row)
            db.delete(row)
    detach_for_nodes(db, [s.id for s in removed], reason="future_snapshot_reapplied")
    for old in removed:
        card.stage_results.remove(old)
        db.delete(old)
    db.flush()
    mapping = dict(plan.matches)
    for proposed in plan.stages:
        if proposed.key not in mapping:
            stage = TechnicalCardStageResult(stage_order=proposed.order, production_stage_id=proposed.workshop,
                stage_label=proposed.label, tech_operation_id=proposed.operation,
                source_routing_stage_line_id=proposed.source, is_required=proposed.required,
                work_center_id=proposed.equipment, operation_name=proposed.name, operation_code=proposed.code, status="pending")
            card.stage_results.append(stage)
            mapping[proposed.key] = stage
    db.flush()
    used_sequences = {row.sequence for row in card.operation_lines}
    sequence = 1
    for proposed in plan.stages:
        if proposed.operation is None or mapping[proposed.key].id in plan.protected:
            continue
        operation = db.get(TechOperation, proposed.operation)
        if operation is not None and operation.is_active:
            while sequence in used_sequences:
                sequence += 1
            card.operation_lines.append(TechnicalCardOperationLine(sequence=sequence, source_kind="routing",
                tech_operation_id=operation.id, operation_name=operation.name, volume_unit=operation.volume_unit,
                volume=0, stage_order=proposed.order, production_stage_id=proposed.workshop, stage_label=proposed.label))
            sequence += 1
    db.flush()
    desired = {(mapping[a].id,mapping[b].id) for a,b in plan.edges}
    existing = list(db.scalars(select(TechnicalCardRouteEdge).where(TechnicalCardRouteEdge.technical_card_id==card.id)))
    current = {(e.predecessor_stage_result_id,e.successor_stage_result_id) for e in existing}
    for edge in existing:
        if (edge.predecessor_stage_result_id,edge.successor_stage_result_id) not in desired:
            db.delete(edge)
    for a,b in desired-current:
        db.add(TechnicalCardRouteEdge(technical_card_id=card.id,predecessor_stage_result_id=a,successor_stage_result_id=b))
    groups = remap_groups(plan.groups, {f"template:{s.source}":f"snapshot:{mapping[s.key].id}" for s in plan.stages if s.source is not None})
    selections = {}
    for group in groups:
        previous = (card.route_variant_selections or {}).get(group["id"], {})
        members = {m["operation_node_id"] for m in group["members"]}
        if previous.get("selected_operation_snapshot_node_id") in members and group["active"]:
            selections[group["id"]] = dict(previous)
        else:
            selections[group["id"]] = dict(selected_operation_snapshot_node_id=group["default_operation_node_id"] if group["active"] else None,
                selection_status="preliminary",selected_at=None,selected_by=None,confirmation_at=None,confirmation_by=None)
    card.route_variant_groups = groups
    card.route_variant_selections = selections
    card.routing_template_id,card.routing_template_name = template.id,template.name
    _fill_missing_routing_operation_volumes(db,card, excluded_stage_orders=protected_orders)
    db.flush()
    db.expire(card,['route_edges'])
    from app.services.technical_card_stages import _sync_current_stage
    _sync_current_stage(card)
    db.flush()
    return True
