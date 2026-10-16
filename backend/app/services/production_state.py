"""One read-only production state for list, Kanban, Calendar, queue and diagnostics."""
from collections import defaultdict
from decimal import Decimal, ROUND_CEILING
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.audit import AuditEvent
from app.models.calendar_assignment import CalendarAssignment
from app.models.calendar_allocation import CalendarAllocation
from app.models.production_capacity import CapacityResource, ProductionCapacityException, TechOperationCapacityResource
from app.models.production_stage import ProductionStage
from app.models.product_model import AssemblyVariant, AssemblyOperationLine
from app.models.sales import SalesOrderItemAssemblyOperationSnapshot
from app.models.shop_routing import WorkCenter, ShopRoutingTemplate
from app.models.tech_operation import TechOperation
from app.models.technical_card import TechnicalCard, TechnicalCardStageResult, TechnicalCardRouteEdge, TechnicalCardOperationLine
from app.schemas.production_state import ProductionState
from app.schemas.production_diagnostics import ProductionDiagnostic, DiagnosticTraceStep
from app.services.route_variants import selection_resolution

MESSAGE = 'Состояние техкарты отображается по-разному в разных разделах. Обновите данные или обратитесь к администратору.'


def value(status) -> str:
    return status.value if hasattr(status,'value') else str(status)


def resolve_fact_state(card, *, nodes=None, edges=None, names=None) -> ProductionState:
    """Pure fact/DAG core. Future dates never select the current workshop."""
    from app.services.technical_card_fulfillment import production_nodes
    nodes = sorted(production_nodes(card.stage_results if nodes is None else nodes), key=lambda row:(row.stage_order,row.id or 0))
    edges = list(getattr(card,'route_edges',[]) if edges is None else edges)
    names = names or {}
    excluded, unresolved = selection_resolution(card)
    selected = [row for row in nodes if f'snapshot:{row.id}' not in excluded]
    for group in card.route_variant_groups or []:
        if group['id'] in unresolved:
            ids={member['operation_node_id'] for member in group['members']}
            members=[row for row in nodes if f'snapshot:{row.id}' in ids]
            if members:
                selected.append(min(members,key=lambda row:row.stage_order))
    selected.sort(key=lambda row:(row.stage_order,row.id or 0))
    by_id={row.id:row for row in selected}
    # Map frozen ONE OF member endpoints to the actual selected member, not a live template.
    remap={}
    for group in card.route_variant_groups or []:
        members={member['operation_node_id'] for member in group['members']}
        active=[row.id for row in selected if f'snapshot:{row.id}' in members]
        for member in members:
            remap[int(member.split(':')[1])] = active[0] if active else None
    predecessors={row.id:set() for row in selected}
    for edge in edges:
        before=remap.get(edge.predecessor_stage_result_id,edge.predecessor_stage_result_id)
        after=remap.get(edge.successor_stage_result_id,edge.successor_stage_result_id)
        if before in by_id and after in by_id and before != after:
            predecessors[after].add(before)
    if not edges and not card.route_variant_groups:
        for before,after in zip(selected,selected[1:]):
            predecessors[after.id].add(before.id)
    # Existing workshop-only/FG markers follow the previous snapshot node.
    for before,after in zip(selected,selected[1:]):
        if after.tech_operation_id is None and not predecessors[after.id]:
            predecessors[after.id].add(before.id)
    visits=[]
    visit_by_node={}
    for row in selected:
        if not visits or visits[-1][0].production_stage_id != row.production_stage_id:
            visits.append([])
        visits[-1].append(row)
        visit_by_node[row.id]=len(visits)-1
    required=[row for row in selected if row.is_required]
    done=lambda row: value(row.status)=='completed' or (not row.is_required and value(row.status)=='skipped')
    visit_done=[all(done(row) for row in visit if row.is_required) for visit in visits]
    incoming={index:{visit_by_node[pred] for row in visit for pred in predecessors[row.id]
                     if visit_by_node[pred]!=index} for index,visit in enumerate(visits)}
    started=any(value(row.status)=='in_progress' for row in selected)
    completed_fact=any(value(row.status)=='completed' for row in selected)
    complete=bool(required) and not unresolved and all(done(row) for row in required)
    state=ProductionState(lifecycle_status='completed' if complete else 'in_progress' if started or completed_fact else 'draft',
                          has_started_fact=started,has_completed_fact=completed_fact)
    if value(card.status)=='cancelled':
        state.lifecycle_status='cancelled'
        state.workshop_state='completed'
        return state
    if complete:
        state.workshop_state='completed'
        return state
    progressing=[row for row in selected if row.is_required and value(row.status)=='in_progress']
    current_index=(visit_by_node[progressing[0].id] if progressing else next((index for index,visit in enumerate(visits)
        if not visit_done[index] and all(visit_done[pred] for pred in incoming[index])),None))
    if current_index is None and unresolved:
        current_index=next((index for index,visit in enumerate(visits) if any(f'snapshot:{row.id}' in excluded for row in visit)),None)
    if current_index is None:
        return state
    current=visits[current_index]
    ready=[row for row in current if value(row.status)=='pending' and all(done(by_id[pred]) for pred in predecessors[row.id])]
    representative=next((row for row in current if value(row.status)=='in_progress' and row.is_required),
                        next(iter(ready),next((row for row in current if not done(row)),current[0])))
    state.current_workshop_id=representative.production_stage_id
    state.current_workshop_name=names.get(representative.production_stage_id,representative.stage_label)
    state.current_snapshot_nodes=[row.id for row in current]
    state.ready_snapshot_nodes=[] if unresolved else [row.id for row in ready]
    state.current_stage_order=representative.stage_order
    state.current_stage_label=representative.stage_label
    state.workshop_state='in_progress' if any(value(row.status)=='in_progress' for row in current) else 'waiting'
    state.next_workshop_id=next((visit[0].production_stage_id for index,visit in enumerate(visits)
        if index!=current_index and not visit_done[index] and visit[0].production_stage_id!=state.current_workshop_id
        and all(visit_done[pred] or pred==current_index for pred in incoming[index])),None)
    return state


def projection_mismatch(card, state: ProductionState, consumer: str, actual: dict) -> ProductionDiagnostic | None:
    expected={key:getattr(state,key) for key in actual}
    if expected==actual:
        return None
    return ProductionDiagnostic(code='production_state_projection_mismatch',category='INTEGRITY',module='production',
        entity_type='technical_card',entity_id=card.id,entity_name=card.number,field='production_state',
        field_label='Производственное состояние',message=MESSAGE,fix_scope='technical_card',
        expected_source='Canonical ProductionStateResolver',source_value=expected,actual_value=actual,
        reason=consumer,fix_action='Обновить данные или обратиться к администратору',
        debug_details={'consumer':consumer,'expected_state':expected,'actual_consumer_state':actual},
        trace=(DiagnosticTraceStep(source='ProductionStateResolver',value=expected),
               DiagnosticTraceStep(source=consumer,value=actual,broken=True)))


def _group(rows, field):
    grouped=defaultdict(list)
    for row in rows:
        grouped[getattr(row,field)].append(row)
    return grouped


def load_states(db: Session, cards: list[TechnicalCard]) -> dict[int, ProductionState]:
    """Scoped fixed-count batch reads. No list per-row SQL, no read repair/cache persistence."""
    if not cards:
        return {}
    with db.no_autoflush:
        ids={card.id for card in cards}
        rows=lambda model,condition: list(db.scalars(select(model).where(condition).order_by(*model.__table__.primary_key.columns)))
        nodes=_group(rows(TechnicalCardStageResult,TechnicalCardStageResult.technical_card_id.in_(ids)),'technical_card_id')
        edges=_group(rows(TechnicalCardRouteEdge,TechnicalCardRouteEdge.technical_card_id.in_(ids)),'technical_card_id')
        volumes=_group(rows(TechnicalCardOperationLine,TechnicalCardOperationLine.technical_card_id.in_(ids)),'technical_card_id')
        operation_ids={node.tech_operation_id for group in nodes.values() for node in group if node.tech_operation_id is not None}
        operations={row.id:row for row in rows(TechOperation,TechOperation.id.in_(operation_ids))}
        links=rows(TechOperationCapacityResource,TechOperationCapacityResource.tech_operation_id.in_(operation_ids))
        resources={row.resource_key:row for row in rows(CapacityResource,CapacityResource.resource_key.in_({link.resource_key for link in links}))}
        variants={row.id:row for row in rows(AssemblyVariant,AssemblyVariant.id.in_({card.assembly_variant_id for card in cards if card.assembly_variant_id}))}
        variant_lines=_group(rows(AssemblyOperationLine,AssemblyOperationLine.assembly_variant_id.in_(variants)),'assembly_variant_id')
        sewing_snapshots=_group(rows(SalesOrderItemAssemblyOperationSnapshot,SalesOrderItemAssemblyOperationSnapshot.order_item_id.in_(
            {card.sales_order_item_id for card in cards if card.sales_order_item_id})),'order_item_id')
        assignments=_group(rows(CalendarAssignment,CalendarAssignment.technical_card_id.in_(ids)),'technical_card_id')
        allocations=_group(rows(CalendarAllocation,CalendarAllocation.assignment_id.in_({row.id for group in assignments.values() for row in group})),'assignment_id')
        audit=rows(AuditEvent,AuditEvent.entity_type.in_(['technical_card_route_manifest','calendar_plan_lifecycle']) & AuditEvent.entity_id.in_({str(i) for i in ids}))
        centers={row.id:row for row in rows(WorkCenter,WorkCenter.id.in_({resource.work_center_id for resource in resources.values() if resource.work_center_id}))}
        exceptions=rows(ProductionCapacityException,ProductionCapacityException.resource_key.in_(resources))
        catalog={row.id:row for row in rows(ProductionStage,ProductionStage.id.in_({row.production_stage_id for group in nodes.values() for row in group if row.production_stage_id}))}
        routes={row.id:row for row in rows(ShopRoutingTemplate,ShopRoutingTemplate.id.in_({card.routing_template_id for card in cards if card.routing_template_id}))}
        batch=dict(cards={card.id:card for card in cards},nodes=nodes,edges=edges,volumes=volumes,operations=operations,links=links,
                   resources=resources,variants=variants,variant_lines=variant_lines,sewing_snapshots=sewing_snapshots,
                   centers=centers,exceptions=exceptions,snapshots={})
        manifests={int(row.entity_id):row.payload for row in audit if row.entity_type=='technical_card_route_manifest' and row.action=='route.manifest_created'}
        stamps={(row.payload or {}).get('calendar_assignment_id'):(row.payload or {}).get('demand_input_snapshot') for row in audit if row.action=='calendar.assignment_created'}
        from app.services.route_verification import manifest_matches
        from app.services.calendar_plan_freshness import input_stamp
        from app.services.production_demand_snapshot import load_card_demand_snapshot
        from app.services.production_demand import calculate_demands
        states={}
        for card in cards:
            owned=sorted(nodes[card.id],key=lambda row:(row.stage_order,row.id))
            try:
                state=resolve_fact_state(card,nodes=owned,edges=edges[card.id],names={key:row.name for key,row in catalog.items()})
                shape=dict(nodes=[dict(id=row.id,operation=row.tech_operation_id,workshop=row.production_stage_id,
                    required=row.is_required,order=row.stage_order,equipment=row.work_center_id) for row in sorted(owned,key=lambda row:row.id)],
                    edges=sorted([edge.predecessor_stage_result_id,edge.successor_stage_result_id] for edge in edges[card.id]),groups=card.route_variant_groups or [])
                verified=manifest_matches(card,shape,manifests.get(card.id))
                snapshot=load_card_demand_snapshot(db,card.id,batch=batch)
                batch['snapshots'][card.id]=snapshot
                ready=verified and calculate_demands(snapshot).status in {'ready','not_applicable'}
                from app.services.production_scheduler import eligible_machine_keys
                ready &= card.routing_template_id in routes and routes[card.routing_template_id].is_active
                for step in snapshot.steps:
                    ready &= (step.operation_id in operations and operations[step.operation_id].is_active
                              and step.production_stage_id in catalog and catalog[step.production_stage_id].is_active)
                    machines=[view.resource_key for view in step.resources if view.resource_type=='machine']
                    if machines:
                        ready &= bool(eligible_machine_keys(machines,resources,centers,step.production_stage_id))
                plans=[row for row in assignments[card.id] if row.stage_result_id is not None]
                selected_ids={step.snapshot_node_id for step in snapshot.steps}
                complete_plan=bool(selected_ids) and selected_ids<={row.stage_result_id for row in plans}
                valid = True
                stale=False
                for plan in plans:
                    node=next((row for row in owned if row.id==plan.stage_result_id),None)
                    chunks=allocations[plan.id]
                    valid &= plan.planned_end_date >= plan.planned_date
                    current=input_stamp(db,plan,resource_keys=[row.resource_key for row in chunks],batch=batch)
                    previous=stamps.get(plan.id)
                    stale |= not current or not previous or current['fingerprint']!=previous['fingerprint']
                    valid &= (node is not None and node.id in selected_ids and plan.production_stage_id==node.production_stage_id
                              and plan.routing_stage_line_id==(node.source_routing_stage_line_id or node.id))
                    sums=defaultdict(Decimal)
                    for chunk in chunks:
                        sums[chunk.resource_key]+=chunk.allocated_amount
                        resource=resources.get(chunk.resource_key)
                        valid &= (resource is not None and chunk.capacity_unit==resource.capacity_unit and chunk.allocated_amount>0
                                  and plan.planned_date<=chunk.date<=plan.planned_end_date)
                    if current:
                        expected={row['resource_key']:Decimal(row['amount']).quantize(Decimal('0.0001'),rounding=ROUND_CEILING)
                                  for row in current['demand'] if row['status']=='ready' and row['amount'] is not None}
                        valid &= dict(sums)==expected
                state.planning_state=('invalid' if not valid else 'stale' if plans and stale else 'planned' if ready and complete_plan
                                      else 'partial' if plans else 'unplanned')
                if state.lifecycle_status=='draft' and state.planning_state=='planned':
                    state.lifecycle_status='planned'
            except ValidationError:
                from app.services.production_lineage import lineage_issue
                issue = lineage_issue(card, "invalid_variant_snapshot", "INTEGRITY", "route_variant_groups",
                                      "RoutingVariantGroup schema", "valid persisted groups", "invalid persisted groups")
                state = ProductionState(lifecycle_status="cancelled" if value(card.status) == "cancelled" else "draft",
                                        planning_state="invalid", diagnostics=[issue])
            # Stored status is the compatible command enum. draft + derived planned is intentional.
            actual={'current_stage_order':card.current_stage_order,'current_stage_label':card.current_stage_label}
            issue=projection_mismatch(card,state,'stored_current_stage_cache',actual)
            if issue:
                state.diagnostics.append(issue)
            if value(card.status)!='cancelled' and not (value(card.status)=='draft' and state.lifecycle_status=='planned'):
                issue=projection_mismatch(card,state,'stored_lifecycle_cache',{'lifecycle_status':value(card.status)})
                if issue:
                    state.diagnostics.append(issue)
            card._production_state=state
            states[card.id]=state
        return states


def state_for(card) -> ProductionState:
    return getattr(card,'_production_state',None) or resolve_fact_state(card)


def read_fields(state: ProductionState) -> dict:
    return dict(production_state=state,current_stage_order=state.current_stage_order,
                current_stage_label=state.current_stage_label,current_workshop_id=state.current_workshop_id)
