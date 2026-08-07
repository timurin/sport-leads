import assert from "node:assert/strict";
import test from "node:test";

import {
  buildWorkTasksListHref,
  emptyWorkTaskCreateDraft,
  fromApiWorkTaskListItem,
  fromApiWorkTaskMessage,
  parseWorkTaskListFilters,
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
  assert.equal(item.responsibleLabel, "Менеджер");
  assert.equal(item.executorLabel, "Не назначен");
  assert.equal(item.objectHref, "/sales/leads/4");
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
