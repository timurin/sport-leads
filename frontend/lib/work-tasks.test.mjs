import assert from "node:assert/strict";
import test from "node:test";

import {
  buildWorkTasksListHref,
  emptyWorkTaskCreateDraft,
  fromApiWorkTask,
  fromApiWorkTaskListItem,
  fromApiWorkTaskMessage,
  groupTasksByBoardStage,
  isWorkTaskMessageMine,
  parseWorkTaskListFilters,
  resolveWorkTasksView,
  validateWorkTaskComposer,
  validateWorkTaskCreateDraft,
  workTaskCreateDraftToPayload,
  workTaskStatusLabel,
} from "../lib/work-tasks.ts";

test("workTaskStatusLabel maps known statuses", () => {
  assert.equal(workTaskStatusLabel("open"), "Открыта");
  assert.equal(workTaskStatusLabel("in_progress"), "В работе");
});

test("fromApiWorkTaskListItem uses embedded names", () => {
  const item = fromApiWorkTaskListItem({
    id: 9,
    title: "Правка",
    status: "open",
    production_stage_id: 2,
    production_stage_name: "Раскрой",
    board_stage_id: 3,
    board_stage_name: "В работе",
    created_by_platform_user_id: 5,
    created_by_display_name: "Админ",
    responsible_platform_user_id: 1,
    responsible_display_name: "Менеджер",
    executor_platform_user_id: null,
    executor_display_name: null,
    lead_id: 4,
    sales_order_id: null,
    production_order_id: null,
    due_at: null,
    created_at: "2026-08-06T10:00:00Z",
    updated_at: "2026-08-06T10:00:00Z",
  });
  assert.equal(item.href, "/sales/tasks/9");
  assert.equal(item.workshopLabel, "Раскрой");
  assert.equal(item.boardStageId, 3);
  assert.equal(item.boardStageLabel, "В работе");
  assert.equal(item.createdByLabel, "Админ");
  assert.equal(item.responsibleLabel, "Менеджер");
  assert.equal(item.responsibleLabel, "Менеджер");
  assert.equal(item.executorLabel, "Не назначен");
  assert.equal(item.objectHref, "/sales/leads/4");
});

test("fromApiWorkTask surfaces order summary and real names", () => {
  const task = fromApiWorkTask({
    id: 12,
    title: "Уточнить срок",
    status: "open",
    production_stage_id: null,
    production_stage_name: null,
    board_stage_id: null,
    board_stage_name: null,
    created_by_platform_user_id: null,
    created_by_display_name: null,
    responsible_platform_user_id: 1,
    responsible_display_name: "Менеджер Иванов",
    executor_platform_user_id: null,
    executor_display_name: null,
    lead_id: null,
    sales_order_id: 7,
    sales_order_summary: {
      id: 7,
      number: "SO-2026-001",
      client_company_name: "ООО Ромашка",
      status: "new",
      amount: "15000.00",
      currency_code: "RUB",
      desired_date: "2026-09-01",
    },
    production_order_id: null,
    due_at: null,
    created_at: "2026-08-06T10:00:00Z",
    updated_at: "2026-08-06T10:00:00Z",
    completed_at: null,
  });
  assert.equal(task.responsibleLabel, "Менеджер Иванов");
  assert.ok(task.orderSummary);
  assert.equal(task.orderSummary.number, "SO-2026-001");
  assert.equal(task.orderSummary.clientCompanyName, "ООО Ромашка");
});

test("parse and build list filter href", () => {
  const filters = parseWorkTaskListFilters({
    status: "open",
    anchor_type: "lead",
    production_stage_id: "3",
  });
  assert.deepEqual(filters, {
    status: "open",
    anchor_type: "lead",
    production_stage_id: 3,
    responsible_platform_user_id: undefined,
    executor_platform_user_id: undefined,
    view: undefined,
  });
  assert.equal(
    buildWorkTasksListHref(filters),
    "/sales/tasks?status=open&anchor_type=lead&production_stage_id=3",
  );
});

test("validate and map create draft", () => {
  assert.equal(
    validateWorkTaskCreateDraft(emptyWorkTaskCreateDraft()),
    "Укажите название задачи",
  );
  const draft = {
    title: "Правка",
    anchor_type: "lead",
    anchor_id: "4",
    production_stage_id: "2",
    responsible_platform_user_id: "1",
    executor_platform_user_id: "",
  };
  assert.equal(validateWorkTaskCreateDraft(draft), null);
  assert.deepEqual(workTaskCreateDraftToPayload(draft), {
    title: "Правка",
    lead_id: 4,
    production_stage_id: 2,
    responsible_platform_user_id: 1,
  });
});

test("fromApiWorkTaskMessage maps author and attachments", () => {
  const view = fromApiWorkTaskMessage({
    id: 3,
    work_task_id: 9,
    author_platform_user_id: 1,
    author_display_name: "Менеджер",
    body: "Готово",
    created_at: "2026-08-06T12:00:00Z",
    attachments: [
      {
        id: 7,
        message_id: 3,
        mime_type: "image/png",
        size_bytes: 2048,
        original_filename: "cut.png",
        created_at: "2026-08-06T12:00:00Z",
      },
    ],
  });
  assert.equal(view.authorLabel, "Менеджер");
  assert.equal(view.authorPlatformUserId, 1);
  assert.equal(view.body, "Готово");
  assert.equal(view.attachments[0].filename, "cut.png");
  assert.equal(view.attachments[0].sizeLabel, "2.0 КБ");
  assert.equal(view.attachments[0].isImage, true);
  assert.equal(
    view.attachments[0].href,
    "/api/work-tasks/9/attachments/7/file",
  );
});

test("validateWorkTaskComposer requires text or image", () => {
  assert.equal(
    validateWorkTaskComposer({ body: "", file: null }),
    "Введите текст или прикрепите изображение",
  );
  assert.equal(validateWorkTaskComposer({ body: "ok", file: null }), null);
});

test("view query and message mine helper", () => {
  assert.equal(resolveWorkTasksView({}), "list");
  assert.equal(resolveWorkTasksView({ view: "kanban" }), "kanban");
  assert.equal(
    buildWorkTasksListHref({ view: "kanban", status: "open" }),
    "/sales/tasks?status=open&view=kanban",
  );
  assert.equal(parseWorkTaskListFilters({ view: "kanban" }).view, "kanban");
  assert.equal(isWorkTaskMessageMine(2, 2), true);
  assert.equal(isWorkTaskMessageMine(2, 3), false);
});

test("groupTasksByBoardStage puts unknown into Без стадии", () => {
  const stages = [
    { id: 1, name: "A", sort_order: 10, is_active: true },
    { id: 2, name: "B", sort_order: 20, is_active: true },
  ];
  const tasks = [
    {
      id: "1",
      title: "t1",
      status: "open",
      statusLabel: "Открыта",
      workshopLabel: "—",
      boardStageId: 1,
      boardStageLabel: "A",
      createdByLabel: "—",
      responsibleLabel: "—",
      executorLabel: "—",
      objectLabel: "—",
      objectHref: null,
      href: "/sales/tasks/1",
      dueLabel: "—",
      dueAt: null,
      dueSoon: false,
      overdue: false,
    },
    {
      id: "2",
      title: "t2",
      status: "open",
      statusLabel: "Открыта",
      workshopLabel: "—",
      boardStageId: 99,
      boardStageLabel: "?",
      createdByLabel: "—",
      responsibleLabel: "—",
      executorLabel: "—",
      objectLabel: "—",
      objectHref: null,
      href: "/sales/tasks/2",
      dueLabel: "—",
      dueAt: null,
      dueSoon: false,
      overdue: false,
    },
  ];
  const columns = groupTasksByBoardStage(tasks, stages);
  assert.equal(columns.length, 3);
  assert.equal(columns[0].tasks.length, 1);
  assert.equal(columns[2].stage, null);
  assert.equal(columns[2].tasks[0].id, "2");
});
