"""PC-04.4G-A: shared structural DTO; no calendar-specific graph entity."""
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class GraphRecord(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


class RoutingWorkshop(GraphRecord):
    workshop_id: int = Field(gt=0)  # Existing ProductionStage primary key.


class RoutingOperationNode(GraphRecord):
    id: str = Field(min_length=1, max_length=100, pattern=r"^[A-Za-z0-9:_-]+$")
    workshop_id: int = Field(gt=0)
    tech_operation_id: int = Field(gt=0)
    position: int = Field(ge=1)
    required: bool = True
    work_center_id: int | None = Field(default=None, gt=0)


class RoutingDependency(GraphRecord):
    predecessor_node_id: str
    successor_node_id: str


class RoutingVariantMember(GraphRecord):
    operation_node_id: str
    position: int = Field(ge=1)


class RoutingVariantGroup(GraphRecord):
    id: str = Field(min_length=1, max_length=100, pattern=r"^[A-Za-z0-9:_-]+$")
    workshop_id: int = Field(gt=0)
    name: str = Field(min_length=1, max_length=255)
    code: str | None = Field(default=None, max_length=64)
    selection_mode: Literal["one_of"] = "one_of"
    members: tuple[RoutingVariantMember, ...] = Field(min_length=1, max_length=500)
    default_operation_node_id: str | None = None
    active: bool = True

    @model_validator(mode="after")
    def validate_members(self):
        ids = [member.operation_node_id for member in self.members]
        positions = [member.position for member in self.members]
        if len(ids) != len(set(ids)) or len(positions) != len(set(positions)):
            raise ValueError("Variant members and positions must be unique")
        if self.default_operation_node_id is not None and self.default_operation_node_id not in ids:
            raise ValueError("Variant default must be a member")
        return self


def expanded_dependencies(graph):
    """Expand logical group endpoints without changing the ONE OF contract."""
    members = {group.id: tuple(member.operation_node_id for member in group.members) for group in graph.variant_groups}
    return tuple(RoutingDependency(predecessor_node_id=predecessor, successor_node_id=successor)
                 for edge in graph.edges
                 for predecessor in members.get(edge.predecessor_node_id, (edge.predecessor_node_id,))
                 for successor in members.get(edge.successor_node_id, (edge.successor_node_id,)))


class RoutingGraph(GraphRecord):
    version: Literal[1] = 1
    workshops: tuple[RoutingWorkshop, ...] = Field(max_length=500)
    nodes: tuple[RoutingOperationNode, ...] = Field(max_length=500)
    dependency_mode: Literal["sequential", "explicit"] = "sequential"
    edges: tuple[RoutingDependency, ...] = Field(default=(), max_length=2000)
    variant_groups: tuple[RoutingVariantGroup, ...] = Field(default=(), max_length=500)

    @model_validator(mode="after")
    def validate_graph(self):
        workshops = [row.workshop_id for row in self.workshops]
        ids = [row.id for row in self.nodes]
        positions = [row.position for row in self.nodes]
        if len(workshops) != len(set(workshops)) or len(ids) != len(set(ids)) or len(positions) != len(set(positions)):
            raise ValueError("Workshop ids, node ids and positions must be unique")
        if any(node.workshop_id not in workshops for node in self.nodes):
            raise ValueError("Operation node must reference a declared ProductionStage workshop")
        group_ids = [group.id for group in self.variant_groups]
        if len(group_ids) != len(set(group_ids)) or set(group_ids) & set(ids):
            raise ValueError("Variant group ids must be unique and distinct from node ids")
        by_id = {node.id: node for node in self.nodes}
        membership = {}
        for group in self.variant_groups:
            for member in group.members:
                node = by_id.get(member.operation_node_id)
                if node is None or node.workshop_id != group.workshop_id:
                    raise ValueError("Variant member must belong to the group's workshop")
                if node.id in membership:
                    raise ValueError("Operation node may belong to only one ONE OF group")
                membership[node.id] = group.id
        ordered = sorted(self.nodes, key=lambda node: (node.position, node.id))
        logical = list(dict.fromkeys(membership.get(node.id, node.id) for node in ordered))
        default = tuple(RoutingDependency(predecessor_node_id=a, successor_node_id=b) for a, b in zip(logical, logical[1:]))
        if self.dependency_mode == "sequential":
            if self.edges and self.edges != default:
                raise ValueError("Non-sequential edges require explicit dependency_mode")
            object.__setattr__(self, "edges", default)
        if any(endpoint in membership for edge in self.edges for endpoint in (edge.predecessor_node_id, edge.successor_node_id)):
            raise ValueError("Dependencies around a variant must reference the group endpoint")
        pairs = [(edge.predecessor_node_id, edge.successor_node_id) for edge in expanded_dependencies(self)]
        if len(pairs) != len(set(pairs)):
            raise ValueError("Duplicate routing dependency")
        incoming = {key: 0 for key in ids}
        outgoing = {key: [] for key in ids}
        for predecessor, successor in pairs:
            if predecessor not in incoming or successor not in incoming or predecessor == successor:
                raise ValueError("Dependencies must reference distinct nodes in this routing graph")
            incoming[successor] += 1
            outgoing[predecessor].append(successor)
        ready = [key for key in ids if incoming[key] == 0]
        visited = 0
        while ready:
            key = ready.pop()
            visited += 1
            for successor in outgoing[key]:
                incoming[successor] -= 1
                if incoming[successor] == 0:
                    ready.append(successor)
        if visited != len(ids):
            raise ValueError("Routing dependencies must be acyclic")
        return self


class RoutingGraphGap(GraphRecord):
    stage_order: int
    reason: str


class RoutingOperationFact(GraphRecord):
    node_id: str
    stage_result_id: int
    status: str


class RoutingWorkshopProgress(GraphRecord):
    workshop_id: int
    required_operations: int
    completed_required_operations: int
    all_required_completed: bool


from app.schemas.production_diagnostics import ProductionDiagnostic


class RouteNodeReadiness(GraphRecord):
    node_id: str
    operation_id: int = Field(gt=0)
    operation_name: str
    status: Literal["ready", "blocked"]
    reason_code: str | None = None
    message: str | None = None
    affects_route: bool = True
    diagnostics: tuple[ProductionDiagnostic, ...] = ()


class RoutingGraphRead(GraphRecord):
    source: Literal["template_projection", "legacy_card_snapshot_projection", "card_route_snapshot"]
    source_id: int
    graph: RoutingGraph
    gaps: tuple[RoutingGraphGap, ...] = ()
    operation_facts: tuple[RoutingOperationFact, ...] = ()
    workshop_progress: tuple[RoutingWorkshopProgress, ...] = ()
    node_readiness: tuple[RouteNodeReadiness, ...] = ()
    diagnostics: tuple[ProductionDiagnostic, ...] = ()
    current_workshop_id: int | None = None
    projection_only: Literal[True] = True
    persisted_dependencies: bool = False
    scheduler_graph_integrated: bool = False
