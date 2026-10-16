/**
 * Draft model for the routing template editor.
 * Sequential order is derived. Explicit edges are stored only after the user creates a branch.
 */

export type RoutingEditorNode = {
  key: string;
  workshopId: number;
  operationId: number | null;
  required: boolean;
  workCenterId: number | null;
  qualityCheckpoint: boolean;
};

export type RoutingEditorVisit = {
  key: string;
  workshopId: number;
  nodeKeys: string[];
};

export type RoutingEditorEdge = {
  from: string;
  to: string;
};

export type RoutingVariantGroupDraft = {
  id: string;
  workshopId: number;
  name: string;
  code: string | null;
  memberKeys: string[];
  defaultNodeKey: string | null;
  active: boolean;
};

export type RoutingEditorDraft = {
  dependencyMode: "sequential" | "explicit";
  visits: RoutingEditorVisit[];
  nodes: RoutingEditorNode[];
  edges: RoutingEditorEdge[];
  variantGroups: RoutingVariantGroupDraft[];
};

export type RoutingStageSource = {
  id?: number;
  stage_order: number;
  production_stage_id: number | null;
  tech_operation_id: number | null;
  work_center_id: number | null;
  is_quality_checkpoint?: boolean;
  is_required?: boolean;
};

export type RoutingEdgeSource = {
  predecessor_stage_order: number;
  successor_stage_order: number;
};

export type RoutingTemplateSource = {
  dependency_mode?: string | null;
  stage_lines: RoutingStageSource[];
  edges?: RoutingEdgeSource[];
};

export type RoutingGraphIssue = {
  code:
    | "empty"
    | "empty_workshop"
    | "missing_operation"
    | "cycle"
    | "orphan_edge"
    | "missing_node"
    | "duplicate"
    | "cross_workshop"
    | "variant";
  message: string;
  nodeKey?: string;
  visitKey?: string;
};

export type CalendarPreviewRow = {
  key: string;
  label: string;
  branch: boolean;
  options?: { label: string; isDefault: boolean }[];
};

let keySeq = 0;

export function nextEditorKey(prefix: string): string {
  keySeq += 1;
  return `${prefix}-${keySeq}`;
}

export function orderedNodeKeys(draft: RoutingEditorDraft): string[] {
  return draft.visits.flatMap((visit) => visit.nodeKeys);
}

export function sequentialEdges(draft: RoutingEditorDraft): RoutingEditorEdge[] {
  const keys = orderedNodeKeys(draft);
  return keys.slice(1).map((to, index) => ({ from: keys[index], to }));
}

export function effectiveEdges(draft: RoutingEditorDraft): RoutingEditorEdge[] {
  return draft.dependencyMode === "sequential" ? sequentialEdges(draft) : draft.edges;
}

function nodeMap(draft: RoutingEditorDraft): Map<string, RoutingEditorNode> {
  return new Map(draft.nodes.map((node) => [node.key, node]));
}

export function draftFromTemplate(template: RoutingTemplateSource): RoutingEditorDraft {
  const lines = [...template.stage_lines].sort((a, b) => a.stage_order - b.stage_order);
  const nodes: RoutingEditorNode[] = lines.map((line) => ({
    key: line.id != null ? `line-${line.id}` : nextEditorKey("node"),
    workshopId: line.production_stage_id ?? 0,
    operationId: line.tech_operation_id,
    required: line.is_required !== false,
    workCenterId: line.work_center_id,
    qualityCheckpoint: Boolean(line.is_quality_checkpoint),
  }));
  const visits: RoutingEditorVisit[] = [];
  lines.forEach((line, index) => {
    const workshopId = line.production_stage_id ?? 0;
    const previous = visits[visits.length - 1];
    if (!previous || previous.workshopId !== workshopId) {
      visits.push({
        key: `visit-${nodes[index].key}`,
        workshopId,
        nodeKeys: [nodes[index].key],
      });
    } else {
      previous.nodeKeys.push(nodes[index].key);
    }
  });
  const byOrder = new Map(lines.map((line, index) => [line.stage_order, nodes[index].key]));
  const mode = template.dependency_mode === "explicit" ? "explicit" : "sequential";
  const edges = mode === "explicit"
    ? (template.edges ?? []).flatMap((edge) => {
        const from = byOrder.get(edge.predecessor_stage_order);
        const to = byOrder.get(edge.successor_stage_order);
        return from && to ? [{ from, to }] : [];
      })
    : [];
  return { dependencyMode: mode, visits, nodes, edges, variantGroups: [] };
}

export function addWorkshop(draft: RoutingEditorDraft, workshopId: number): RoutingEditorDraft {
  return {
    ...draft,
    visits: [...draft.visits, { key: nextEditorKey("visit"), workshopId, nodeKeys: [] }],
  };
}

export type VisitLayoutRow = {
  nodeKeys: string[];
  join: boolean;
};

export function layoutVisitRows(draft: RoutingEditorDraft, visitKey: string): VisitLayoutRow[] {
  const visit = draft.visits.find((item) => item.key === visitKey);
  if (!visit) return [];
  const keys = visit.nodeKeys;
  const local = new Set(keys);
  const allEdges = effectiveEdges(draft);
  const edges = allEdges.filter((edge) => local.has(edge.from) && local.has(edge.to));
  const originalIncoming = new Map(keys.map((key) => [key, 0]));
  const incoming = new Map(keys.map((key) => [key, 0]));
  const outgoing = new Map(keys.map((key) => [key, [] as string[]]));
  for (const edge of allEdges) {
    if (local.has(edge.to)) originalIncoming.set(edge.to, (originalIncoming.get(edge.to) ?? 0) + 1);
  }
  for (const edge of edges) {
    incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1);
    outgoing.set(edge.from, [...(outgoing.get(edge.from) ?? []), edge.to]);
  }
  const order = new Map(keys.map((key, index) => [key, index]));
  let ready = keys.filter((key) => (incoming.get(key) ?? 0) === 0).sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
  const rows: VisitLayoutRow[] = [];
  const seen = new Set<string>();
  while (ready.length > 0) {
    rows.push({
      nodeKeys: ready,
      join: ready.some((key) => (originalIncoming.get(key) ?? 0) > 1),
    });
    for (const key of ready) seen.add(key);
    const next: string[] = [];
    for (const key of ready) {
      for (const successor of outgoing.get(key) ?? []) {
        const count = (incoming.get(successor) ?? 0) - 1;
        incoming.set(successor, count);
        if (count === 0) next.push(successor);
      }
    }
    ready = next.sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
  }
  if (seen.size !== keys.length) {
    return keys.map((key) => ({ nodeKeys: [key], join: false }));
  }
  return rows;
}

export function assignOperation(draft: RoutingEditorDraft, nodeKey: string, operationId: number): RoutingEditorDraft {
  return {
    ...draft,
    nodes: draft.nodes.map((node) => (node.key === nodeKey ? { ...node, operationId } : node)),
  };
}

export function insertOperationBetween(
  draft: RoutingEditorDraft,
  beforeKey: string,
  afterKey: string | null,
  operationId: number,
): RoutingEditorDraft {
  const visit = draft.visits.find((item) => item.nodeKeys.includes(beforeKey));
  if (!visit) return draft;
  const node: RoutingEditorNode = {
    key: nextEditorKey("node"),
    workshopId: visit.workshopId,
    operationId,
    required: true,
    workCenterId: null,
    qualityCheckpoint: false,
  };
  const index = visit.nodeKeys.indexOf(beforeKey);
  const visits = draft.visits.map((item) =>
    item.key === visit.key
      ? { ...item, nodeKeys: [...item.nodeKeys.slice(0, index + 1), node.key, ...item.nodeKeys.slice(index + 1)] }
      : item,
  );
  if (draft.dependencyMode !== "explicit") {
    return { ...draft, nodes: [...draft.nodes, node], visits };
  }
  const edges = effectiveEdges(draft).filter((edge) => !(afterKey && edge.from === beforeKey && edge.to === afterKey));
  const extra: RoutingEditorEdge[] = [{ from: beforeKey, to: node.key }];
  if (afterKey) extra.push({ from: node.key, to: afterKey });
  return { ...draft, nodes: [...draft.nodes, node], visits, edges: [...edges, ...extra] };
}

export function addParallelOperation(
  draft: RoutingEditorDraft,
  nodeKey: string,
  operationId: number,
): RoutingEditorDraft {
  const next = createParallelBranch(draft, nodeKey);
  const sibling = next.nodes.at(-1);
  if (!sibling || sibling.operationId != null) return draft;
  return assignOperation(next, sibling.key, operationId);
}

export function insertBlankAfter(draft: RoutingEditorDraft, nodeKey: string): RoutingEditorDraft {
  const visit = draft.visits.find((item) => item.nodeKeys.includes(nodeKey));
  if (!visit) return draft;
  const node: RoutingEditorNode = {
    key: nextEditorKey("node"),
    workshopId: visit.workshopId,
    operationId: null,
    required: true,
    workCenterId: null,
    qualityCheckpoint: false,
  };
  const index = visit.nodeKeys.indexOf(nodeKey);
  return {
    ...draft,
    nodes: [...draft.nodes, node],
    visits: draft.visits.map((item) =>
      item.key === visit.key
        ? { ...item, nodeKeys: [...item.nodeKeys.slice(0, index + 1), node.key, ...item.nodeKeys.slice(index + 1)] }
        : item,
    ),
  };
}

export function addOperation(
  draft: RoutingEditorDraft,
  visitKey: string,
  operationId: number,
  workshopId: number,
): RoutingEditorDraft {
  const node: RoutingEditorNode = {
    key: nextEditorKey("node"),
    workshopId,
    operationId,
    required: true,
    workCenterId: null,
    qualityCheckpoint: false,
  };
  return {
    ...draft,
    nodes: [...draft.nodes, node],
    visits: draft.visits.map((visit) =>
      visit.key === visitKey ? { ...visit, nodeKeys: [...visit.nodeKeys, node.key] } : visit,
    ),
  };
}

export function reorderVisits(draft: RoutingEditorDraft, activeKey: string, overKey: string): RoutingEditorDraft {
  const from = draft.visits.findIndex((visit) => visit.key === activeKey);
  const to = draft.visits.findIndex((visit) => visit.key === overKey);
  if (from < 0 || to < 0 || from === to) return draft;
  const visits = [...draft.visits];
  const [moved] = visits.splice(from, 1);
  visits.splice(to, 0, moved);
  return { ...draft, visits };
}

export function moveNode(
  draft: RoutingEditorDraft,
  nodeKey: string,
  targetVisitKey: string,
  index: number,
): RoutingEditorDraft {
  const source = draft.visits.find((visit) => visit.nodeKeys.includes(nodeKey));
  const target = draft.visits.find((visit) => visit.key === targetVisitKey);
  if (!source || !target || draft.variantGroups.some((group) => group.memberKeys.includes(nodeKey))) return draft;
  const without = source.nodeKeys.filter((key) => key !== nodeKey);
  const nextKeys = target.key === source.key ? without : [...target.nodeKeys];
  const bounded = Math.max(0, Math.min(index, nextKeys.length));
  nextKeys.splice(bounded, 0, nodeKey);
  return {
    ...draft,
    nodes: draft.nodes.map((node) =>
      node.key === nodeKey ? { ...node, workshopId: target.workshopId } : node,
    ),
    visits: draft.visits.map((visit) => {
      if (visit.key === source.key && visit.key === target.key) return { ...visit, nodeKeys: nextKeys };
      if (visit.key === source.key) return { ...visit, nodeKeys: without };
      if (visit.key === target.key) return { ...visit, nodeKeys: nextKeys };
      return visit;
    }),
  };
}

export function removeNode(draft: RoutingEditorDraft, nodeKey: string): RoutingEditorDraft {
  return {
    ...draft,
    nodes: draft.nodes.filter((node) => node.key !== nodeKey),
    visits: draft.visits.map((visit) => ({
      ...visit,
      nodeKeys: visit.nodeKeys.filter((key) => key !== nodeKey),
    })),
    edges: draft.edges.filter((edge) => edge.from !== nodeKey && edge.to !== nodeKey),
    variantGroups: withoutMember(draft.variantGroups, nodeKey),
  };
}

export function removeVisit(draft: RoutingEditorDraft, visitKey: string): RoutingEditorDraft {
  const visit = draft.visits.find((item) => item.key === visitKey);
  if (!visit) return draft;
  const dropped = new Set(visit.nodeKeys);
  return {
    ...draft,
    visits: draft.visits.filter((item) => item.key !== visitKey),
    nodes: draft.nodes.filter((node) => !dropped.has(node.key)),
    edges: draft.edges.filter((edge) => !dropped.has(edge.from) && !dropped.has(edge.to)),
    variantGroups: draft.variantGroups.flatMap((group) => {
      const memberKeys = group.memberKeys.filter((key) => !dropped.has(key));
      if (memberKeys.length === 0) return [];
      return [{
        ...group,
        memberKeys,
        defaultNodeKey: memberKeys.includes(group.defaultNodeKey ?? "") ? group.defaultNodeKey : memberKeys[0],
      }];
    }),
  };
}

export function createParallelBranch(draft: RoutingEditorDraft, nodeKey: string): RoutingEditorDraft {
  const node = draft.nodes.find((item) => item.key === nodeKey);
  const visit = draft.visits.find((item) => item.nodeKeys.includes(nodeKey));
  if (!node || !visit) return draft;
  const sibling: RoutingEditorNode = {
    key: nextEditorKey("node"),
    workshopId: visit.workshopId,
    operationId: null,
    required: true,
    workCenterId: null,
    qualityCheckpoint: false,
  };
  const edges = effectiveEdges(draft);
  const predecessors = edges.filter((edge) => edge.to === nodeKey).map((edge) => edge.from);
  const successors = edges.filter((edge) => edge.from === nodeKey).map((edge) => edge.to);
  const extra: RoutingEditorEdge[] = [
    ...predecessors.map((from) => ({ from, to: sibling.key })),
    ...successors.map((to) => ({ from: sibling.key, to })),
  ];
  const index = visit.nodeKeys.indexOf(nodeKey);
  return {
    dependencyMode: "explicit",
    nodes: [...draft.nodes, sibling],
    visits: draft.visits.map((item) =>
      item.key === visit.key
        ? { ...item, nodeKeys: [...item.nodeKeys.slice(0, index + 1), sibling.key, ...item.nodeKeys.slice(index + 1)] }
        : item,
    ),
    edges: [...edges, ...extra],
    variantGroups: draft.variantGroups,
  };
}

export function removeEdge(draft: RoutingEditorDraft, from: string, to: string): RoutingEditorDraft {
  const edges = effectiveEdges(draft).filter((edge) => !(edge.from === from && edge.to === to));
  return { ...draft, dependencyMode: "explicit", edges };
}

export function validateRoutingDraft(
  draft: RoutingEditorDraft,
  operations: { id: number; production_stage_id: number | null }[],
): RoutingGraphIssue[] {
  const issues: RoutingGraphIssue[] = [];
  if (draft.nodes.length === 0) {
    issues.push({ code: "empty", message: "Маршрут пуст" });
  }
  const seen = new Set<string>();
  for (const node of draft.nodes) {
    if (seen.has(node.key)) {
      issues.push({ code: "duplicate", message: "Повторяющийся узел", nodeKey: node.key });
    }
    seen.add(node.key);
  }
  const byVisit = new Map<string, Set<number>>();
  for (const visit of draft.visits) {
    if (visit.workshopId <= 0) {
      issues.push({ code: "empty_workshop", message: "Выберите цех", visitKey: visit.key });
    }
    if (visit.nodeKeys.length === 0) {
      issues.push({ code: "empty_workshop", message: "Цех без операций", visitKey: visit.key });
    }
    for (const nodeKey of visit.nodeKeys) {
      const node = draft.nodes.find((item) => item.key === nodeKey);
      if (!node) {
        issues.push({ code: "missing_node", message: "Зависимость на отсутствующий узел", nodeKey });
        continue;
      }
      if (node.operationId == null) {
        issues.push({ code: "missing_operation", message: "Операция без технологической операции", nodeKey });
        continue;
      }
      const operation = operations.find((item) => item.id === node.operationId);
      if (operation?.production_stage_id != null && operation.production_stage_id !== visit.workshopId) {
        issues.push({ code: "cross_workshop", message: "Операция относится к другому цеху", nodeKey });
      }
      const used = byVisit.get(visit.key) ?? new Set<number>();
      if (used.has(node.operationId)) {
        issues.push({ code: "duplicate", message: "Операция уже есть в этом цехе", nodeKey });
      }
      used.add(node.operationId);
      byVisit.set(visit.key, used);
    }
  }
  const edges = effectiveEdges(draft);
  const edgeKeys = new Set<string>();
  for (const edge of edges) {
    const token = `${edge.from}->${edge.to}`;
    if (edgeKeys.has(token)) {
      issues.push({ code: "duplicate", message: "Повторяющаяся зависимость" });
    }
    edgeKeys.add(token);
    if (!seen.has(edge.from) || !seen.has(edge.to) || edge.from === edge.to) {
      issues.push({ code: "orphan_edge", message: "Зависимость на отсутствующий узел" });
    }
  }
  const incoming = new Map<string, number>();
  for (const key of seen) incoming.set(key, 0);
  const outgoing = new Map<string, string[]>();
  for (const edge of edges) {
    if (!seen.has(edge.from) || !seen.has(edge.to)) continue;
    incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1);
    outgoing.set(edge.from, [...(outgoing.get(edge.from) ?? []), edge.to]);
  }
  const ready = [...seen].filter((key) => (incoming.get(key) ?? 0) === 0);
  let visited = 0;
  while (ready.length > 0) {
    const key = ready.pop() as string;
    visited += 1;
    for (const successor of outgoing.get(key) ?? []) {
      const next = (incoming.get(successor) ?? 0) - 1;
      incoming.set(successor, next);
      if (next === 0) ready.push(successor);
    }
  }
  if (visited !== seen.size && seen.size > 0) {
    issues.push({ code: "cycle", message: "В маршруте есть цикл" });
  }
  const grouped = new Set<string>();
  for (const group of draft.variantGroups) {
    if (!group.name.trim()) {
      issues.push({ code: "variant", message: "Укажите название группы вариантов" });
    }
    if (!group.defaultNodeKey || !group.memberKeys.includes(group.defaultNodeKey)) {
      issues.push({ code: "variant", message: "У группы вариантов нет варианта по умолчанию" });
    }
    for (const memberKey of group.memberKeys) {
      if (grouped.has(memberKey) || !seen.has(memberKey)) {
        issues.push({ code: "variant", message: "Вариант должен быть операцией этой группы", nodeKey: memberKey });
      }
      grouped.add(memberKey);
      const node = draft.nodes.find((item) => item.key === memberKey);
      if (node && node.workshopId !== group.workshopId) {
        issues.push({ code: "cross_workshop", message: "Операция группы относится к другому цеху", nodeKey: memberKey });
      }
    }
  }
  return issues;
}

export function kanbanPreview(
  draft: RoutingEditorDraft,
  workshopName: (workshopId: number) => string,
): string[] {
  return draft.visits.map((visit) => workshopName(visit.workshopId));
}

function withoutMember(groups: RoutingVariantGroupDraft[], nodeKey: string): RoutingVariantGroupDraft[] {
  return groups.flatMap((group) => {
    if (!group.memberKeys.includes(nodeKey)) return [group];
    const memberKeys = group.memberKeys.filter((key) => key !== nodeKey);
    if (memberKeys.length === 0) return [];
    return [{
      ...group,
      memberKeys,
      defaultNodeKey: memberKeys.includes(group.defaultNodeKey ?? "") ? group.defaultNodeKey : memberKeys[0],
    }];
  });
}

function groupByMember(draft: RoutingEditorDraft): Map<string, RoutingVariantGroupDraft> {
  return new Map(draft.variantGroups.flatMap((group) => group.memberKeys.map((key) => [key, group] as const)));
}

export function logicalEndpoint(draft: RoutingEditorDraft, nodeKey: string): string {
  return groupByMember(draft).get(nodeKey)?.id ?? nodeKey;
}

export function logicalSequence(draft: RoutingEditorDraft): string[] {
  const seen = new Set<string>();
  const sequence: string[] = [];
  for (const key of orderedNodeKeys(draft)) {
    const endpoint = logicalEndpoint(draft, key);
    if (seen.has(endpoint)) continue;
    seen.add(endpoint);
    sequence.push(endpoint);
  }
  return sequence;
}

export function calendarPreview(
  draft: RoutingEditorDraft,
  operationName: (operationId: number | null) => string,
): CalendarPreviewRow[] {
  const edges = effectiveEdges(draft);
  const nodes = nodeMap(draft);
  const membership = groupByMember(draft);
  const successors = new Map<string, string[]>();
  for (const edge of edges) {
    successors.set(edge.from, [...(successors.get(edge.from) ?? []), edge.to]);
  }
  const branched = new Set<string>();
  for (const targets of successors.values()) {
    if (targets.length > 1) {
      for (const target of targets) {
        if (!membership.has(target)) branched.add(target);
      }
    }
  }
  const emitted = new Set<string>();
  const rows: CalendarPreviewRow[] = [];
  for (const key of orderedNodeKeys(draft)) {
    const group = membership.get(key);
    if (group) {
      if (emitted.has(group.id)) continue;
      emitted.add(group.id);
      rows.push({
        key: group.id,
        label: `${group.name}: один из вариантов`,
        branch: false,
        options: group.memberKeys.map((memberKey) => ({
          label: operationName(nodes.get(memberKey)?.operationId ?? null),
          isDefault: memberKey === group.defaultNodeKey,
        })),
      });
      continue;
    }
    rows.push({
      key,
      label: operationName(nodes.get(key)?.operationId ?? null),
      branch: branched.has(key),
    });
  }
  return rows;
}

export type VisitDisplayBlock =
  | { kind: "node"; nodeKey: string; join: boolean }
  | { kind: "parallel"; nodeKeys: string[]; join: boolean }
  | { kind: "variant"; groupId: string; join: boolean };

export function visitDisplayBlocks(draft: RoutingEditorDraft, visitKey: string): VisitDisplayBlock[] {
  const membership = groupByMember(draft);
  const emitted = new Set<string>();
  const blocks: VisitDisplayBlock[] = [];
  for (const row of layoutVisitRows(draft, visitKey)) {
    const plain: string[] = [];
    const groupsHere: string[] = [];
    for (const key of row.nodeKeys) {
      const group = membership.get(key);
      if (!group) {
        plain.push(key);
      } else if (!emitted.has(group.id)) {
        groupsHere.push(group.id);
        emitted.add(group.id);
      }
    }
    if (plain.length === 0 && groupsHere.length === 0) continue;
    if (groupsHere.length === 1 && plain.length === 0) {
      blocks.push({ kind: "variant", groupId: groupsHere[0], join: row.join });
      continue;
    }
    if (plain.length > 1) blocks.push({ kind: "parallel", nodeKeys: plain, join: row.join });
    else if (plain.length === 1) blocks.push({ kind: "node", nodeKey: plain[0], join: row.join });
    for (const groupId of groupsHere) blocks.push({ kind: "variant", groupId, join: false });
  }
  return blocks;
}

export function variantGroupStatus(
  group: RoutingVariantGroupDraft,
  nodes: RoutingEditorNode[],
  isPlannable: (operationId: number | null) => boolean,
): "ready" | "needs_setup" {
  const node = nodes.find((item) => item.key === group.defaultNodeKey);
  if (!node || !group.memberKeys.includes(node.key) || !isPlannable(node.operationId)) return "needs_setup";
  return "ready";
}

export function addVariantGroup(
  draft: RoutingEditorDraft,
  visitKey: string,
  input: { name: string; code: string | null; operationIds: number[]; defaultOperationId: number },
): RoutingEditorDraft {
  const visit = draft.visits.find((item) => item.key === visitKey);
  if (!visit || input.operationIds.length === 0 || !input.name.trim()) return draft;
  const nodes = input.operationIds.map((operationId) => ({
    key: nextEditorKey("node"),
    workshopId: visit.workshopId,
    operationId,
    required: true,
    workCenterId: null,
    qualityCheckpoint: false,
  }));
  const defaultIndex = Math.max(0, input.operationIds.indexOf(input.defaultOperationId));
  return {
    ...draft,
    nodes: [...draft.nodes, ...nodes],
    visits: draft.visits.map((item) =>
      item.key === visit.key ? { ...item, nodeKeys: [...item.nodeKeys, ...nodes.map((node) => node.key)] } : item,
    ),
    variantGroups: [...draft.variantGroups, {
      id: nextEditorKey("variant"),
      workshopId: visit.workshopId,
      name: input.name.trim(),
      code: input.code?.trim() || null,
      memberKeys: nodes.map((node) => node.key),
      defaultNodeKey: nodes[defaultIndex].key,
      active: true,
    }],
  };
}

export function updateVariantGroup(
  draft: RoutingEditorDraft,
  groupId: string,
  patch: { name?: string; code?: string | null; defaultNodeKey?: string | null },
): RoutingEditorDraft {
  return {
    ...draft,
    variantGroups: draft.variantGroups.map((group) => {
      if (group.id !== groupId) return group;
      const defaultNodeKey = patch.defaultNodeKey === undefined ? group.defaultNodeKey : patch.defaultNodeKey;
      return {
        ...group,
        name: patch.name == null ? group.name : patch.name.trim(),
        code: patch.code === undefined ? group.code : (patch.code?.trim() || null),
        defaultNodeKey: defaultNodeKey && group.memberKeys.includes(defaultNodeKey) ? defaultNodeKey : group.defaultNodeKey,
      };
    }),
  };
}

export function replaceVariantMembers(
  draft: RoutingEditorDraft,
  groupId: string,
  members: { key: string | null; operationId: number }[],
  defaultOperationId: number,
  defaultKey: string | null,
): RoutingEditorDraft {
  const group = draft.variantGroups.find((item) => item.id === groupId);
  if (!group || members.length === 0) return draft;
  let next = draft;
  for (const key of group.memberKeys) {
    if (!members.some((member) => member.key === key)) next = removeVariantMember(next, groupId, key);
  }
  for (const member of members) {
    if (member.key == null) next = addVariantMember(next, groupId, member.operationId);
  }
  const current = next.variantGroups.find((item) => item.id === groupId);
  if (!current) return next;
  const used = new Set<string>();
  const ordered = members.flatMap((member) => {
    if (member.key && current.memberKeys.includes(member.key) && !used.has(member.key)) {
      used.add(member.key);
      return [member.key];
    }
    const created = current.memberKeys.find((key) =>
      !used.has(key)
      && !group.memberKeys.includes(key)
      && next.nodes.find((node) => node.key === key)?.operationId === member.operationId,
    );
    if (!created) return [];
    used.add(created);
    return [created];
  });
  const defaultNodeKey = (defaultKey && ordered.includes(defaultKey) ? defaultKey : null)
    ?? ordered.find((key) => next.nodes.find((node) => node.key === key)?.operationId === defaultOperationId)
    ?? ordered[0]
    ?? null;
  const visit = next.visits.find((item) => item.nodeKeys.some((key) => current.memberKeys.includes(key)));
  return {
    ...next,
    visits: next.visits.map((item) => {
      if (!visit || item.key !== visit.key) return item;
      const block = new Set(current.memberKeys);
      const start = item.nodeKeys.findIndex((key) => block.has(key));
      const rest = item.nodeKeys.filter((key) => !block.has(key));
      const index = start < 0 ? rest.length : item.nodeKeys.slice(0, start).filter((key) => !block.has(key)).length;
      return { ...item, nodeKeys: [...rest.slice(0, index), ...ordered, ...rest.slice(index)] };
    }),
    variantGroups: next.variantGroups.map((item) => (item.id === groupId ? { ...item, memberKeys: ordered, defaultNodeKey } : item)),
  };
}

export function deleteVariantGroup(draft: RoutingEditorDraft, groupId: string): RoutingEditorDraft {
  return { ...draft, variantGroups: draft.variantGroups.filter((group) => group.id !== groupId) };
}

export function removeVariantMember(draft: RoutingEditorDraft, groupId: string, nodeKey: string): RoutingEditorDraft {
  const group = draft.variantGroups.find((item) => item.id === groupId);
  if (!group || !group.memberKeys.includes(nodeKey)) return draft;
  return { ...draft, variantGroups: withoutMember(draft.variantGroups, nodeKey) };
}

export function addVariantMember(draft: RoutingEditorDraft, groupId: string, operationId: number): RoutingEditorDraft {
  const group = draft.variantGroups.find((item) => item.id === groupId);
  if (!group) return draft;
  const visit = draft.visits.find((item) => item.nodeKeys.some((key) => group.memberKeys.includes(key)));
  if (!visit) return draft;
  const node: RoutingEditorNode = {
    key: nextEditorKey("node"),
    workshopId: group.workshopId,
    operationId,
    required: true,
    workCenterId: null,
    qualityCheckpoint: false,
  };
  const last = group.memberKeys.at(-1);
  const index = last ? visit.nodeKeys.indexOf(last) : visit.nodeKeys.length - 1;
  return {
    ...draft,
    nodes: [...draft.nodes, node],
    visits: draft.visits.map((item) =>
      item.key === visit.key
        ? { ...item, nodeKeys: [...item.nodeKeys.slice(0, index + 1), node.key, ...item.nodeKeys.slice(index + 1)] }
        : item,
    ),
    variantGroups: draft.variantGroups.map((item) =>
      item.id === groupId ? { ...item, memberKeys: [...item.memberKeys, node.key] } : item,
    ),
  };
}

export function reorderVariantMember(
  draft: RoutingEditorDraft,
  groupId: string,
  nodeKey: string,
  direction: -1 | 1,
): RoutingEditorDraft {
  const group = draft.variantGroups.find((item) => item.id === groupId);
  if (!group) return draft;
  return {
    ...draft,
    visits: draft.visits.map((visit) => {
      const index = visit.nodeKeys.indexOf(nodeKey);
      const neighborKey = visit.nodeKeys[index + direction];
      if (index < 0 || !neighborKey || !group.memberKeys.includes(neighborKey)) return visit;
      const nodeKeys = [...visit.nodeKeys];
      nodeKeys[index] = neighborKey;
      nodeKeys[index + direction] = nodeKey;
      return { ...visit, nodeKeys };
    }),
    variantGroups: draft.variantGroups.map((item) => {
      if (item.id !== groupId) return item;
      const visit = draft.visits.find((row) => row.nodeKeys.includes(nodeKey));
      const index = visit?.nodeKeys.indexOf(nodeKey) ?? -1;
      const neighborKey = visit?.nodeKeys[index + direction];
      if (!visit || !neighborKey || !item.memberKeys.includes(neighborKey)) return item;
      const memberKeys = visit.nodeKeys
        .map((key, keyIndex) => (keyIndex === index ? neighborKey : keyIndex === index + direction ? nodeKey : key))
        .filter((key) => item.memberKeys.includes(key));
      return { ...item, memberKeys };
    }),
  };
}

export function moveGroupBlock(
  draft: RoutingEditorDraft,
  groupId: string,
  targetVisitKey: string,
  index: number,
): RoutingEditorDraft {
  const group = draft.variantGroups.find((item) => item.id === groupId);
  const target = draft.visits.find((item) => item.key === targetVisitKey);
  if (!group || !target) return draft;
  const block = new Set(group.memberKeys);
  const visits = draft.visits.map((visit) => ({ ...visit, nodeKeys: visit.nodeKeys.filter((key) => !block.has(key)) }));
  const destination = visits.find((visit) => visit.key === targetVisitKey);
  if (!destination) return draft;
  const bounded = Math.max(0, Math.min(index, destination.nodeKeys.length));
  destination.nodeKeys = [...destination.nodeKeys.slice(0, bounded), ...group.memberKeys, ...destination.nodeKeys.slice(bounded)];
  return {
    ...draft,
    visits,
    nodes: draft.nodes.map((node) => (block.has(node.key) ? { ...node, workshopId: target.workshopId } : node)),
    variantGroups: draft.variantGroups.map((item) => (item.id === groupId ? { ...item, workshopId: target.workshopId } : item)),
  };
}

export function moveGroupBefore(
  draft: RoutingEditorDraft,
  groupId: string,
  targetVisitKey: string,
  beforeNodeKey: string | null,
): RoutingEditorDraft {
  const group = draft.variantGroups.find((item) => item.id === groupId);
  const target = draft.visits.find((item) => item.key === targetVisitKey);
  if (!group || !target) return draft;
  const filtered = target.nodeKeys.filter((key) => !group.memberKeys.includes(key));
  const index = beforeNodeKey ? filtered.indexOf(beforeNodeKey) : filtered.length;
  return moveGroupBlock(draft, groupId, targetVisitKey, index < 0 ? filtered.length : index);
}

export function shiftGroup(draft: RoutingEditorDraft, groupId: string, direction: -1 | 1): RoutingEditorDraft {
  const group = draft.variantGroups.find((item) => item.id === groupId);
  if (!group) return draft;
  const visitIndex = draft.visits.findIndex((visit) => visit.nodeKeys.some((key) => group.memberKeys.includes(key)));
  if (visitIndex < 0) return draft;
  const visit = draft.visits[visitIndex];
  const first = visit.nodeKeys.findIndex((key) => group.memberKeys.includes(key));
  const beforeCount = visit.nodeKeys.slice(0, first).filter((key) => !group.memberKeys.includes(key)).length;
  const withoutCount = visit.nodeKeys.filter((key) => !group.memberKeys.includes(key)).length;
  if (direction < 0) {
    if (beforeCount === 0) {
      const previous = draft.visits[visitIndex - 1];
      return previous ? moveGroupBlock(draft, groupId, previous.key, previous.nodeKeys.length) : draft;
    }
    return moveGroupBlock(draft, groupId, visit.key, beforeCount - 1);
  }
  if (withoutCount === beforeCount) {
    const next = draft.visits[visitIndex + 1];
    return next ? moveGroupBlock(draft, groupId, next.key, 0) : draft;
  }
  return moveGroupBlock(draft, groupId, visit.key, beforeCount + 1);
}

export type RoutingGraphSource = {
  dependency_mode?: string | null;
  edges?: { predecessor_node_id: string; successor_node_id: string }[];
  variant_groups?: {
    id: string;
    workshop_id: number;
    name: string;
    code?: string | null;
    members: { operation_node_id: string; position: number }[];
    default_operation_node_id?: string | null;
    active?: boolean;
  }[];
};

export function editorNodeKeyFromGraph(nodeId: string): string {
  const match = /^template:(\d+)$/.exec(nodeId);
  return match ? `line-${match[1]}` : nodeId;
}

export function applyRoutingGraph(draft: RoutingEditorDraft, graph: RoutingGraphSource | null | undefined): RoutingEditorDraft {
  const source = graph?.variant_groups ?? [];
  if (source.length === 0) return draft;
  const variantGroups = source.map((group) => {
    const memberKeys = [...group.members]
      .sort((left, right) => left.position - right.position)
      .map((member) => editorNodeKeyFromGraph(member.operation_node_id));
    const defaultNodeKey = group.default_operation_node_id ? editorNodeKeyFromGraph(group.default_operation_node_id) : null;
    return {
      id: group.id,
      workshopId: group.workshop_id,
      name: group.name,
      code: group.code ?? null,
      memberKeys,
      defaultNodeKey: defaultNodeKey && memberKeys.includes(defaultNodeKey) ? defaultNodeKey : null,
      active: group.active !== false,
    };
  });
  const sequentialDraft: RoutingEditorDraft = { ...draft, variantGroups, dependencyMode: "sequential", edges: [] };
  const expected = new Set(logicalSequence(sequentialDraft).slice(1).map((to, index) => `${logicalSequence(sequentialDraft)[index]}->${to}`));
  const collapsed = collapsedGraphEdges(variantGroups, graph?.edges ?? []);
  const same = collapsed.length === expected.size && collapsed.every((edge) => expected.has(`${edge.from}->${edge.to}`));
  if (same || graph?.dependency_mode !== "explicit") return sequentialDraft;
  return {
    ...sequentialDraft,
    dependencyMode: "explicit",
    edges: collapsed.flatMap((edge) => {
      const from = representativeKey(draft, variantGroups, edge.from);
      const to = representativeKey(draft, variantGroups, edge.to);
      return from && to && from !== to ? [{ from, to }] : [];
    }),
  };
}

function collapsedGraphEdges(
  groups: RoutingVariantGroupDraft[],
  edges: { predecessor_node_id: string; successor_node_id: string }[],
): RoutingEditorEdge[] {
  const memberToGroup = new Map(groups.flatMap((group) => group.memberKeys.map((key) => [key, group.id] as const)));
  const groupIds = new Set(groups.map((group) => group.id));
  const seen = new Set<string>();
  const result: RoutingEditorEdge[] = [];
  for (const edge of edges) {
    const fromRaw = editorNodeKeyFromGraph(edge.predecessor_node_id);
    const toRaw = editorNodeKeyFromGraph(edge.successor_node_id);
    const from = memberToGroup.get(fromRaw) ?? (groupIds.has(edge.predecessor_node_id) ? edge.predecessor_node_id : fromRaw);
    const to = memberToGroup.get(toRaw) ?? (groupIds.has(edge.successor_node_id) ? edge.successor_node_id : toRaw);
    if (from === to) continue;
    const token = `${from}->${to}`;
    if (seen.has(token)) continue;
    seen.add(token);
    result.push({ from, to });
  }
  return result;
}

function representativeKey(draft: RoutingEditorDraft, groups: RoutingVariantGroupDraft[], endpoint: string): string | null {
  const group = groups.find((item) => item.id === endpoint);
  if (group) return group.defaultNodeKey ?? group.memberKeys[0] ?? null;
  if (draft.nodes.some((node) => node.key === endpoint)) return endpoint;
  const mapped = editorNodeKeyFromGraph(endpoint);
  return draft.nodes.some((node) => node.key === mapped) ? mapped : null;
}

export function routingGraphBody(draft: RoutingEditorDraft): {
  version: 1;
  workshops: { workshop_id: number }[];
  nodes: {
    id: string;
    workshop_id: number;
    tech_operation_id: number;
    position: number;
    required: boolean;
    work_center_id: number | null;
  }[];
  dependency_mode: "sequential" | "explicit";
  edges: { predecessor_node_id: string; successor_node_id: string }[];
  variant_groups: {
    id: string;
    workshop_id: number;
    name: string;
    code: string | null;
    selection_mode: "one_of";
    members: { operation_node_id: string; position: number }[];
    default_operation_node_id: string | null;
    active: boolean;
  }[];
} {
  const nodesByKey = nodeMap(draft);
  const nodes = orderedNodeKeys(draft).flatMap((key, index) => {
    const node = nodesByKey.get(key);
    if (!node || node.operationId == null) return [];
    return [{
      id: key,
      workshop_id: node.workshopId,
      tech_operation_id: node.operationId,
      position: index + 1,
      required: node.required,
      work_center_id: node.workCenterId,
    }];
  });
  const logical = logicalSequence(draft);
  const sequential = logical.slice(1).map((to, index) => ({ predecessor_node_id: logical[index], successor_node_id: to }));
  let dependencyMode: "sequential" | "explicit" = "sequential";
  let edges = sequential;
  if (draft.dependencyMode === "explicit") {
    const seen = new Set<string>();
    const collapsed = effectiveEdges(draft).flatMap((edge) => {
      const from = logicalEndpoint(draft, edge.from);
      const to = logicalEndpoint(draft, edge.to);
      const token = `${from}->${to}`;
      if (from === to || seen.has(token)) return [];
      seen.add(token);
      return [{ predecessor_node_id: from, successor_node_id: to }];
    });
    const same = collapsed.length === sequential.length
      && collapsed.every((edge, index) => edge.predecessor_node_id === sequential[index]?.predecessor_node_id && edge.successor_node_id === sequential[index]?.successor_node_id);
    if (!same) {
      dependencyMode = "explicit";
      edges = collapsed;
    }
  }
  return {
    version: 1,
    workshops: [...new Set(draft.visits.map((visit) => visit.workshopId).filter((id) => id > 0))].map((workshop_id) => ({ workshop_id })),
    nodes,
    dependency_mode: dependencyMode,
    edges: dependencyMode === "sequential" ? [] : edges,
    variant_groups: draft.variantGroups.map((group) => ({
      id: group.id,
      workshop_id: group.workshopId,
      name: group.name.trim(),
      code: group.code?.trim() || null,
      selection_mode: "one_of",
      members: group.memberKeys.map((key, index) => ({ operation_node_id: key, position: index + 1 })),
      default_operation_node_id: group.defaultNodeKey,
      active: group.active,
    })),
  };
}

export function routingSaveBody(
  draft: RoutingEditorDraft,
  workshopName: (workshopId: number) => string,
): {
  dependency_mode: "sequential" | "explicit";
  stages: {
    stage_order: number;
    production_stage_id: number;
    stage_label: string;
    tech_operation_id: number | null;
    work_center_id: number | null;
    is_quality_checkpoint: boolean;
    is_required: boolean;
  }[];
  edges: RoutingEdgeSource[];
} {
  const order = new Map(orderedNodeKeys(draft).map((key, index) => [key, index + 1]));
  const nodes = nodeMap(draft);
  const stages = orderedNodeKeys(draft).map((key) => {
    const node = nodes.get(key) as RoutingEditorNode;
    return {
      stage_order: order.get(key) as number,
      production_stage_id: node.workshopId,
      stage_label: workshopName(node.workshopId),
      tech_operation_id: node.operationId,
      work_center_id: node.workCenterId,
      is_quality_checkpoint: node.qualityCheckpoint,
      is_required: node.required,
    };
  });
  const edges = draft.dependencyMode === "explicit"
    ? effectiveEdges(draft).flatMap((edge) => {
        const predecessor = order.get(edge.from);
        const successor = order.get(edge.to);
        return predecessor && successor
          ? [{ predecessor_stage_order: predecessor, successor_stage_order: successor }]
          : [];
      })
    : [];
  return { dependency_mode: draft.dependencyMode, stages, edges };
}

export function draftsEqual(left: RoutingEditorDraft, right: RoutingEditorDraft): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
