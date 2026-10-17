"""Shared manual-command eligibility; dates alone never protect pending operations."""


def manual_replan_is_protected(card, state, node, assignment, protected_node_ids: set[int]) -> bool:
    return bool(node.status != 'pending' or node.started_at is not None or node.completed_at is not None
                or node.id in protected_node_ids or card.plan_locked
                or card.status not in {'draft', 'in_progress'} or state.lifecycle_status in {'completed', 'cancelled'}
                or card.fulfillment_status == 'shipped' or assignment.planning_mode == 'locked'
                or (assignment.manual_lock and assignment.planning_mode != 'manual_adjusted'))
