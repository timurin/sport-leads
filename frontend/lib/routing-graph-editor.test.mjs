import assert from "node:assert/strict";
import test from "node:test";

import {
  addOperation,
  addParallelOperation,
  addVariantGroup,
  addWorkshop,
  applyRoutingGraph,
  calendarPreview,
  createParallelBranch,
  deleteVariantGroup,
  draftFromTemplate,
  effectiveEdges,
  insertOperationBetween,
  kanbanPreview,
  layoutVisitRows,
  moveNode,
  removeEdge,
  removeNode,
  removeVariantMember,
  reorderVariantMember,
  reorderVisits,
  routingGraphBody,
  routingSaveBody,
  sequentialEdges,
  shiftGroup,
  validateRoutingDraft,
  variantGroupStatus,
  visitDisplayBlocks,
} from "./routing-graph-editor.ts";

const operations = [
  { id: 1, production_stage_id: 10, name: "Подготовка" },
  { id: 2, production_stage_id: 10, name: "Печать" },
  { id: 3, production_stage_id: 20, name: "Раскрой" },
];

function template() {
  return {
    dependency_mode: "sequential",
    stage_lines: [
      { id: 1, stage_order: 1, production_stage_id: 10, tech_operation_id: 1, work_center_id: null, is_required: true },
      { id: 2, stage_order: 2, production_stage_id: 10, tech_operation_id: 2, work_center_id: null, is_required: true },
      { id: 3, stage_order: 3, production_stage_id: 20, tech_operation_id: 3, work_center_id: null, is_required: true },
    ],
    edges: [],
  };
}

test("load graph keeps workshop parents and sequential arrows", () => {
  const draft = draftFromTemplate(template());
  assert.equal(draft.visits.length, 2);
  assert.deepEqual(draft.visits.map((visit) => visit.workshopId), [10, 20]);
  assert.deepEqual(sequentialEdges(draft).map((edge) => [edge.from, edge.to]), [
    ["line-1", "line-2"],
    ["line-2", "line-3"],
  ]);
  assert.equal(validateRoutingDraft(draft, operations).length, 0);
});

test("add and reorder workshops, add move and remove operations", () => {
  let draft = draftFromTemplate(template());
  draft = addWorkshop(draft, 30);
  assert.equal(draft.visits.at(-1)?.workshopId, 30);
  assert.equal(validateRoutingDraft(draft, operations).some((issue) => issue.code === "empty_workshop"), true);
  const first = draft.visits[0].key;
  const last = draft.visits[2].key;
  draft = reorderVisits(draft, last, first);
  assert.equal(draft.visits[0].workshopId, 30);
  draft = addOperation(draft, draft.visits[0].key, 1, 30);
  const added = draft.nodes.at(-1);
  assert.equal(added?.operationId, 1);
  const printVisit = draft.visits.find((visit) => visit.workshopId === 10);
  draft = moveNode(draft, added.key, printVisit.key, 0);
  assert.equal(draft.nodes.find((node) => node.key === added.key)?.workshopId, 10);
  const before = draft.nodes.length;
  draft = removeNode(draft, added.key);
  assert.equal(draft.nodes.length, before - 1);
});

test("parallel branch joins and a deleted edge stays explicit", () => {
  let draft = draftFromTemplate(template());
  draft = createParallelBranch(draft, "line-2");
  assert.equal(draft.dependencyMode, "explicit");
  const sibling = draft.nodes.at(-1).key;
  const edges = effectiveEdges(draft);
  assert.equal(edges.some((edge) => edge.from === "line-1" && edge.to === sibling), true);
  assert.equal(edges.some((edge) => edge.from === sibling && edge.to === "line-3"), true);
  assert.equal(edges.some((edge) => edge.from === "line-1" && edge.to === "line-2"), true);
  draft = removeEdge(draft, "line-1", sibling);
  assert.equal(effectiveEdges(draft).some((edge) => edge.from === "line-1" && edge.to === sibling), false);
});

test("cycle is rejected and sequential save omits stored edges", () => {
  const draft = draftFromTemplate({
    dependency_mode: "explicit",
    stage_lines: template().stage_lines.slice(0, 2),
    edges: [
      { predecessor_stage_order: 1, successor_stage_order: 2 },
      { predecessor_stage_order: 2, successor_stage_order: 1 },
    ],
  });
  assert.equal(validateRoutingDraft(draft, operations).some((issue) => issue.code === "cycle"), true);
  const saved = routingSaveBody(draftFromTemplate(template()), (id) => (id === 10 ? "Печать" : "Раскрой"));
  assert.equal(saved.dependency_mode, "sequential");
  assert.equal(saved.edges.length, 0);
  assert.deepEqual(saved.stages.map((stage) => stage.stage_order), [1, 2, 3]);
});

test("previews follow workshops and mark a parallel branch", () => {
  const draft = createParallelBranch(draftFromTemplate(template()), "line-2");
  assert.deepEqual(kanbanPreview(draft, (id) => (id === 10 ? "Печать" : "Раскрой")), ["Печать", "Раскрой"]);
  const calendar = calendarPreview(draft, (id) => operations.find((row) => row.id === id)?.name ?? "Новая операция");
  assert.equal(calendar.filter((row) => row.branch).length, 2);
  assert.equal(calendar.some((row) => row.label === "Новая операция"), true);
  const rows = layoutVisitRows(draft, draft.visits[0].key);
  assert.equal(rows[0].nodeKeys[0], "line-1");
  assert.equal(rows[1].nodeKeys.length, 2);
  const joined = layoutVisitRows(draft, draft.visits[1].key);
  assert.equal(joined[0].join, true);
});

test("insert between keeps sequential order and parallel pick stores the operation", () => {
  let draft = draftFromTemplate(template());
  draft = insertOperationBetween(draft, "line-1", "line-2", 2);
  assert.equal(draft.dependencyMode, "sequential");
  assert.deepEqual(draft.visits[0].nodeKeys.slice(0, 3).map((key, index) => index === 1 ? draft.nodes.find((node) => node.key === key)?.operationId : key), ["line-1", 2, "line-2"]);
  draft = addParallelOperation(draftFromTemplate(template()), "line-2", 2);
  const sibling = draft.nodes.at(-1);
  assert.equal(sibling.operationId, 2);
  assert.equal(draft.dependencyMode, "explicit");
  assert.equal(effectiveEdges(draft).some((edge) => edge.to === sibling.key), true);
});

test("variant group is one block, keeps a default, and saves as ONE OF", () => {
  const source = draftFromTemplate(template());
  const duplicated = addVariantGroup(source, source.visits[1].key, {
    name: "Раскрой",
    code: null,
    operationIds: [3],
    defaultOperationId: 3,
  });
  assert.equal(validateRoutingDraft(duplicated, operations).some((issue) => issue.code === "duplicate"), true);

  let draft = addVariantGroup(source, source.visits[0].key, {
    name: "Раскрой",
    code: "CUT",
    operationIds: [1, 2],
    defaultOperationId: 2,
  });
  const created = draft.variantGroups[0];
  assert.equal(created.memberKeys.length, 2);
  assert.equal(draft.nodes.find((node) => node.key === created.defaultNodeKey)?.operationId, 2);
  const blocks = visitDisplayBlocks(draft, draft.visits[0].key);
  assert.equal(blocks.filter((block) => block.kind === "variant").length, 1);
  assert.equal(blocks.some((block) => block.kind === "parallel"), false);
  const calendar = calendarPreview(draft, (id) => operations.find((row) => row.id === id)?.name ?? "Операция");
  const row = calendar.find((item) => item.key === created.id);
  assert.equal(row?.label, "Раскрой: один из вариантов");
  assert.equal(row?.branch, false);
  assert.equal(row?.options?.length, 2);
  assert.equal(row?.options?.filter((option) => option.isDefault).map((option) => option.label)[0], "Печать");
  assert.equal(calendar.filter((item) => item.key === created.memberKeys[0] || item.key === created.memberKeys[1]).length, 0);
  draft = reorderVariantMember(draft, created.id, created.memberKeys[1], -1);
  assert.equal(draft.variantGroups[0].memberKeys[0], created.memberKeys[1]);
  const moved = shiftGroup(draft, created.id, 1);
  assert.equal(moved.visits[1].workshopId, 20);
  assert.equal(moved.visits[1].nodeKeys.includes(moved.variantGroups[0].memberKeys[0]), true);
  assert.equal(moveNode(draft, created.memberKeys[0], draft.visits[1].key, 0), draft);
  const detached = removeVariantMember(draft, created.id, created.memberKeys[0]);
  assert.equal(detached.variantGroups[0].memberKeys.includes(created.memberKeys[0]), false);
  assert.equal(detached.nodes.some((node) => node.key === created.memberKeys[0]), true);
  const removed = deleteVariantGroup(detached, created.id);
  assert.equal(removed.variantGroups.length, 0);
  assert.equal(removed.nodes.length, detached.nodes.length);
  const body = routingGraphBody(draft);
  assert.equal(body.dependency_mode, "sequential");
  assert.equal(body.edges.length, 0);
  assert.equal(body.variant_groups[0].selection_mode, "one_of");
  assert.equal(body.variant_groups[0].default_operation_node_id, draft.variantGroups[0].defaultNodeKey);
  assert.equal(body.variant_groups[0].members.length, 2);
  assert.equal(variantGroupStatus(draft.variantGroups[0], draft.nodes, (id) => id === 2), "ready");
  assert.equal(variantGroupStatus({ ...draft.variantGroups[0], defaultNodeKey: null }, draft.nodes, () => true), "needs_setup");
  assert.equal(validateRoutingDraft({ ...draft, variantGroups: [{ ...draft.variantGroups[0], defaultNodeKey: null }] }, operations).some((issue) => issue.code === "variant"), true);
});

test("reloaded ONE OF graph stays sequential and does not look like a parallel branch", () => {
  const base = draftFromTemplate({
    ...template(),
    dependency_mode: "explicit",
    edges: [
      { predecessor_stage_order: 1, successor_stage_order: 2 },
      { predecessor_stage_order: 1, successor_stage_order: 3 },
      { predecessor_stage_order: 2, successor_stage_order: 3 },
    ],
  });
  const draft = applyRoutingGraph(base, {
    dependency_mode: "explicit",
    edges: [
      { predecessor_node_id: "variant-cut", successor_node_id: "template:3" },
    ],
    variant_groups: [{
      id: "variant-cut",
      workshop_id: 10,
      name: "Раскрой",
      code: null,
      members: [
        { operation_node_id: "template:1", position: 1 },
        { operation_node_id: "template:2", position: 2 },
      ],
      default_operation_node_id: "template:1",
      active: true,
    }],
  });
  assert.equal(draft.dependencyMode, "sequential");
  assert.deepEqual(draft.variantGroups[0].memberKeys, ["line-1", "line-2"]);
  assert.equal(draft.variantGroups[0].defaultNodeKey, "line-1");
  const blocks = visitDisplayBlocks(draft, draft.visits[0].key);
  assert.equal(blocks.some((block) => block.kind === "parallel"), false);
  assert.equal(blocks.some((block) => block.kind === "variant"), true);
  const calendar = calendarPreview(draft, (id) => operations.find((row) => row.id === id)?.name ?? "Операция");
  assert.equal(calendar.some((row) => row.label === "Раскрой: один из вариантов"), true);
  assert.equal(calendar.filter((row) => row.branch).length, 0);
});
