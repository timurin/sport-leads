# Work Tasks — Order Context & Detail Enrichment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Work Tasks module (ADR-028, Stage 23) function as the employees' single task/chat surface by (a) closing the known list-vs-detail DTO gap so the chat header always shows real workshop/responsible/executor names, (b) surfacing customer Sales Order context (order number, client, status, amount, desired date) directly in the task detail/chat view when a task is anchored to a sales order, and (c) flagging overdue deadlines visually. Text/image messaging and due-date capture already exist end-to-end (Stage 23.2/23.3) — this plan only adds the missing order context and the display-name enrichment, it does not rebuild chat or attachments.

**Architecture:** Extend the existing `WorkTaskRead` Pydantic schema with the same display-name embeds `WorkTaskListItem` already has, plus an optional nested `sales_order_summary` object populated only when the task's anchor is a sales order. Enrich it in `app.services.work_tasks.get_work_task`/`_to_read` via a small helper that joins `SalesOrder` → `Client`. Thread the new fields through the frontend mapper (`lib/work-tasks.ts`) and render an "Order info" card plus an overdue badge in `WorkTaskChatPanel`.

**Tech Stack:** FastAPI + SQLAlchemy + Pydantic v2 (backend, Python 3.13, pytest + `TestClient` + SQLite in-memory), Next.js App Router + TypeScript client library with Node's built-in `node:test` runner (frontend).

## Global Constraints

- Do not modify `LeadTask`, `CollaborationMicrotask`, or `CollaborationMessage` models/tables — out of scope (per `docs/superpowers/specs/2026-08-06-unified-tasks-module-design.md`, migration/removal of those is a separate, not-yet-scheduled stage).
- Do not change the anchor-XOR rule or `WorkTaskCreate`/`WorkTaskUpdate` request schemas — only `WorkTaskRead` (response) gains fields.
- `WorkTaskListItem` behavior/shape must stay unchanged (list page must not regress).
- All new backend queries must stay inside the existing `db: Session` passed into service functions — no new sessions, no N+1 loops beyond what `_to_list_items` already does for stage/user batching.
- Follow existing code style: type hints everywhere, `from __future__ import annotations`, Pydantic v2 `model_validate`/`ConfigDict(from_attributes=True)` pattern already used in `app/schemas/work_tasks.py`.
- Frontend: keep `lib/work-tasks.ts` framework-agnostic (no React imports); UI additions go in `components/sales/work-task-chat-panel.tsx`.
- Every new/changed test must pass with the project's existing test runners: `pytest` (backend) and `node --test` (frontend, via existing `*.test.mjs` pattern that imports the `.ts` source directly).

---

### Task 1: Add `sales_order_summary` and display-name fields to `WorkTaskRead`

**Files:**
- Modify: `backend/app/schemas/work_tasks.py`
- Test: `backend/tests/test_work_tasks_api_23_2_1.py` (extend existing file with new assertions in a new test function)

**Interfaces:**
- Produces: `WorkTaskSalesOrderSummary` Pydantic model with fields `id: int`, `number: str`, `client_company_name: str | None`, `status: str`, `amount: str | None` (Decimal serialized as string), `currency_code: str`, `desired_date: date | None`.
- Produces: `WorkTaskRead` gains `production_stage_name: str | None = None`, `responsible_display_name: str | None = None`, `executor_display_name: str | None = None`, `sales_order_summary: WorkTaskSalesOrderSummary | None = None`.

- [ ] **Step 1: Write the failing test**

Add to `backend/tests/test_work_tasks_api_23_2_1.py`:

```python
def test_work_task_detail_includes_order_summary_and_names() -> None:
    SessionLocal = _session_factory()
    db = SessionLocal()
    from app.models.sales import Client, SalesOrder, SalesOrderStatus

    if db.get(SalesUser, 1) is None:
        db.add(SalesUser(id=1, name="Test"))
        db.flush()
    client = Client(company_name="ООО Ромашка", contact_name="Пётр", phone="+79990001122")
    db.add(client)
    db.flush()
    order = SalesOrder(
        number="SO-2026-001",
        client_id=client.id,
        status=SalesOrderStatus.NEW,
        title="Комплект формы",
        amount=Decimal("15000.00"),
        currency_code="RUB",
    )
    db.add(order)
    db.flush()
    order_id = order.id
    user_id_row = db.get(SalesUser, 1)
    db.commit()
    db.close()

    def override_get_db():
        session = SessionLocal()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_get_db
    client_app = TestClient(app)
    try:
        user_id = ensure_user_with_role_via_new_session(SessionLocal)
        login_client(client_app, login="mgr2")

        created = client_app.post(
            "/work-tasks",
            json={
                "title": "Уточнить срок",
                "sales_order_id": order_id,
                "responsible_platform_user_id": user_id,
            },
        )
        assert created.status_code == 201, created.text
        task_id = created.json()["id"]

        detail = client_app.get(f"/work-tasks/{task_id}")
        assert detail.status_code == 200, detail.text
        body = detail.json()
        assert body["responsible_display_name"]
        summary = body["sales_order_summary"]
        assert summary is not None
        assert summary["number"] == "SO-2026-001"
        assert summary["client_company_name"] == "ООО Ромашка"
        assert summary["amount"] == "15000.00"
    finally:
        app.dependency_overrides.clear()
```

Note: replace `ensure_user_with_role_via_new_session` with a plain call — reuse the existing helper pattern already in the file: open a fresh `SessionLocal()`, call `ensure_user_with_role(db, login="mgr2", role_code="admin")`, commit, close, and use the returned id. Match the exact style already used for `user_id = ensure_user_with_role(db, login="mgr", role_code="admin")` earlier in the file (lines 56-57) instead of inventing a new helper name.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_work_tasks_api_23_2_1.py::test_work_task_detail_includes_order_summary_and_names -v`
Expected: FAIL — `KeyError: 'sales_order_summary'` or `assert None is not None` (field doesn't exist yet).

- [ ] **Step 3: Add the schema fields**

In `backend/app/schemas/work_tasks.py`, add near the top (after imports, before `WorkTaskCreate`):

```python
class WorkTaskSalesOrderSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    number: str
    client_company_name: str | None = None
    status: str
    amount: str | None = None
    currency_code: str
    desired_date: date | None = None
```

Add `date` to the existing `from datetime import ...` import line (check the file's current import — it likely has `from datetime import datetime`; change to `from datetime import date, datetime`).

Then extend `WorkTaskRead`:

```python
class WorkTaskRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    status: WorkTaskStatusLiteral
    production_stage_id: int | None = None
    production_stage_name: str | None = None
    responsible_platform_user_id: int | None = None
    responsible_display_name: str | None = None
    executor_platform_user_id: int | None = None
    executor_display_name: str | None = None
    lead_id: int | None = None
    sales_order_id: int | None = None
    sales_order_summary: WorkTaskSalesOrderSummary | None = None
    production_order_id: int | None = None
    due_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    completed_at: datetime | None = None
```

(Keep existing field order/names for everything already present — only insert the new fields as shown; do not reorder or rename existing fields.)

- [ ] **Step 4: Wire enrichment in the service layer (see Task 2) then re-run the test**

This step's test will only pass once Task 2 is done — proceed to Task 2 before running the test again.

- [ ] **Step 5: Commit**

```bash
git add backend/app/schemas/work_tasks.py backend/tests/test_work_tasks_api_23_2_1.py
git commit -m "feat(work-tasks): add order summary and display names to WorkTaskRead schema"
```

---

### Task 2: Populate the new fields in `services/work_tasks.py`

**Files:**
- Modify: `backend/app/services/work_tasks.py`

**Interfaces:**
- Consumes: `WorkTaskSalesOrderSummary`, extended `WorkTaskRead` from Task 1.
- Consumes: `app.models.sales.SalesOrder`, `app.models.sales.Client` (existing models — `SalesOrder.client_id` FK to `Client.id`, `Client.company_name`).
- Produces: `_to_read(db: Session, row: WorkTask) -> WorkTaskRead` (signature change — was `_to_read(row)`, now takes `db` first).

- [ ] **Step 1: Update `_to_read` to accept `db` and enrich**

Find the current `_to_read` function:

```python
def _to_read(row: WorkTask) -> WorkTaskRead:
    return WorkTaskRead.model_validate(row)
```

Replace with:

```python
def _to_read(db: Session, row: WorkTask) -> WorkTaskRead:
    read = WorkTaskRead.model_validate(row)
    if row.production_stage_id is not None:
        stage = db.get(ProductionStage, row.production_stage_id)
        read.production_stage_name = stage.name if stage is not None else None
    if row.responsible_platform_user_id is not None:
        user = db.get(PlatformUser, row.responsible_platform_user_id)
        read.responsible_display_name = user.display_name if user is not None else None
    if row.executor_platform_user_id is not None:
        user = db.get(PlatformUser, row.executor_platform_user_id)
        read.executor_display_name = user.display_name if user is not None else None
    if row.sales_order_id is not None:
        order = db.get(SalesOrder, row.sales_order_id)
        if order is not None:
            client = db.get(Client, order.client_id) if order.client_id else None
            read.sales_order_summary = WorkTaskSalesOrderSummary(
                id=order.id,
                number=order.number,
                client_company_name=client.company_name if client is not None else None,
                status=order.status.value if hasattr(order.status, "value") else str(order.status),
                amount=str(order.amount) if order.amount is not None else None,
                currency_code=order.currency_code,
                desired_date=order.desired_date,
            )
    return read
```

Check the file's existing imports for `ProductionStage`, `PlatformUser`, `SalesOrder`, `Client` — `ProductionStage` and `PlatformUser` are already imported (used by `_to_list_items`/`_require_stage`/`_require_platform_user`). Add `SalesOrder` and `Client` to the existing `from app.models.sales import ...` import line, and import `WorkTaskSalesOrderSummary` from `app.schemas.work_tasks` alongside the existing `WorkTaskRead` import.

Verify the exact attribute name for a platform user's display name — grep it:

```bash
grep -n "display_name" backend/app/models/*.py
```

Use whatever field `PlatformUser` actually exposes (the codebase's `_to_list_items` already reads this same field for `WorkTaskListItem.responsible_display_name` — copy that exact attribute access rather than guessing).

- [ ] **Step 2: Update every call site of `_to_read`**

Search for all callers:

```bash
grep -n "_to_read(" backend/app/services/work_tasks.py
```

Each call site (`get_work_task`, `create_work_task`, `update_work_task`) currently calls `_to_read(work_task)` or similar — change each to `_to_read(db, work_task)` (the `db` session is already in scope in all three functions as a parameter).

- [ ] **Step 3: Run the Task 1 test again**

Run: `cd backend && python -m pytest tests/test_work_tasks_api_23_2_1.py -v`
Expected: PASS, all tests in the file including `test_work_task_detail_includes_order_summary_and_names`.

- [ ] **Step 4: Run the full work-tasks backend test suite to check for regressions**

Run: `cd backend && python -m pytest tests/test_work_tasks_23_1_1.py tests/test_work_tasks_api_23_2_1.py tests/test_work_tasks_embeds_23_2_3.py tests/test_work_tasks_list_23_3_2.py tests/test_work_tasks_messages_23_2_2.py tests/test_work_task_media_23_1_3.py -v`
Expected: PASS, no failures.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/work_tasks.py
git commit -m "feat(work-tasks): enrich WorkTaskRead with names and sales order summary"
```

---

### Task 3: Thread order summary and display names through the frontend mapper

**Files:**
- Modify: `frontend/lib/work-tasks.ts`
- Test: `frontend/lib/work-tasks.test.mjs`

**Interfaces:**
- Consumes: backend `WorkTaskRead` JSON shape from Task 1/2 (`production_stage_name`, `responsible_display_name`, `executor_display_name`, `sales_order_summary: {id, number, client_company_name, status, amount, currency_code, desired_date} | null`).
- Produces: `WorkTaskSalesOrderSummary` TS type; `WorkTaskDetail` (the type returned by `fromApiWorkTask`) gains `orderSummary: WorkTaskSalesOrderSummary | null`, and no longer needs the `#id` fallback for workshop/responsible/executor labels when the API provides names.

- [ ] **Step 1: Write the failing test**

Add to `frontend/lib/work-tasks.test.mjs`:

```javascript
test("fromApiWorkTask surfaces order summary and real names", () => {
  const task = fromApiWorkTask({
    id: 12,
    title: "Уточнить срок",
    status: "open",
    production_stage_id: null,
    production_stage_name: null,
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
```

Add `fromApiWorkTask` to the existing import list at the top of the file (it currently imports `fromApiWorkTaskListItem` but not `fromApiWorkTask`).

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && node --test lib/work-tasks.test.mjs`
Expected: FAIL — `task.orderSummary` is `undefined`, or `responsibleLabel` falls back to `"#1"`/similar placeholder instead of `"Менеджер Иванов"`.

- [ ] **Step 3: Update the TypeScript source**

In `frontend/lib/work-tasks.ts`:

Add to the `ApiWorkTask` type (the type matching backend `WorkTaskRead`):

```typescript
export type WorkTaskSalesOrderSummary = {
  id: number;
  number: string;
  client_company_name: string | null;
  status: string;
  amount: string | null;
  currency_code: string;
  desired_date: string | null;
};
```

and add these fields to `ApiWorkTask`: `production_stage_name: string | null`, `responsible_display_name: string | null`, `executor_display_name: string | null`, `sales_order_summary: WorkTaskSalesOrderSummary | null`.

Add a client-facing type:

```typescript
export type OrderSummaryView = {
  id: number;
  number: string;
  clientCompanyName: string | null;
  status: string;
  amount: string | null;
  currencyCode: string;
  desiredDate: string | null;
};
```

Find the existing `fromApiWorkTask` function. It currently builds workshop/responsible/executor labels with an `"#id"`-style fallback (per the noted gap) because the API didn't supply names. Update it to prefer the real name fields exactly the way `fromApiWorkTaskListItem` already does for `ApiWorkTaskListItem` — copy that same label-resolution logic (e.g. `task.responsible_display_name ?? (task.responsible_platform_user_id ? \`#${task.responsible_platform_user_id}\` : "Не назначен")`) rather than reintroducing a divergent implementation. Add to its return object:

```typescript
orderSummary: api.sales_order_summary
  ? {
      id: api.sales_order_summary.id,
      number: api.sales_order_summary.number,
      clientCompanyName: api.sales_order_summary.client_company_name,
      status: api.sales_order_summary.status,
      amount: api.sales_order_summary.amount,
      currencyCode: api.sales_order_summary.currency_code,
      desiredDate: api.sales_order_summary.desired_date,
    }
  : null,
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && node --test lib/work-tasks.test.mjs`
Expected: PASS, all tests including the new one.

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/work-tasks.ts frontend/lib/work-tasks.test.mjs
git commit -m "feat(work-tasks): map order summary and real display names in client lib"
```

---

### Task 4: Show order info card and overdue badge in the chat panel — visual pass via `frontend-design`

**Files:**
- Modify: `frontend/components/sales/work-task-chat-panel.tsx`

**Interfaces:**
- Consumes: `task.orderSummary` (from Task 3, `null` unless anchor is a sales order), `task.dueLabel`, `task.status`, and the raw `due_at`/`status` already available on the `task` prop passed into this component (per `fromApiWorkTask`'s existing return shape, which includes the original `due_at` string — check the existing prop type; if it does not already re-expose the raw `due_at`/`status`, use `dueLabel` plus the already-mapped `status` field which is present today).

- [ ] **Step 0: Load the `frontend-design` skill before touching any JSX/CSS**

Invoke `Skill("frontend-design:frontend-design")` before writing the order-info card or the overdue badge markup. This module is the employees' primary daily chat surface, so the visual pass is not incidental styling — treat the header/order-card/message-bubble/composer area as a real design surface: get direction on typography, spacing, and color use for the order-info card and the overdue badge from the skill's guidance rather than defaulting to ad hoc Tailwind utility classes. Apply that direction consistently across the elements touched in Steps 2-3 (card container, status/amount line, overdue badge) — match whatever token/utility conventions the skill points to and that already exist elsewhere in this component (e.g. its existing message-bubble and header styling), not a new one-off palette.

- [ ] **Step 1: Locate the header section**

Read the top of `work-task-chat-panel.tsx` where the header renders title/statusLabel/workshopLabel/responsible/executor/"Объект:"/due label (per the existing 322-line component). This is a manual UI step (no automated test — this is presentational JSX with no existing snapshot/test harness for this component per the codebase's test inventory).

- [ ] **Step 2: Add the order info card**

Immediately after the existing "Объект:" line/link in the header block, add:

```tsx
{task.orderSummary ? (
  <div className="mt-2 rounded-md border border-neutral-200 bg-neutral-50 p-3 text-sm dark:border-neutral-800 dark:bg-neutral-900">
    <div className="font-medium">Заказ {task.orderSummary.number}</div>
    <div className="text-neutral-600 dark:text-neutral-400">
      {task.orderSummary.clientCompanyName ?? "Клиент не указан"}
      {" · "}
      {task.orderSummary.status}
      {task.orderSummary.amount
        ? ` · ${task.orderSummary.amount} ${task.orderSummary.currencyCode}`
        : ""}
      {task.orderSummary.desiredDate ? ` · до ${task.orderSummary.desiredDate}` : ""}
    </div>
  </div>
) : null}
```

Match the existing component's Tailwind class conventions (check surrounding elements for the actual color tokens used elsewhere in the file — e.g. it may use `text-muted-foreground`/`bg-muted` design-system classes instead of raw `neutral-*`; use whatever the file already uses elsewhere for a secondary info block, not a new convention).

- [ ] **Step 3: Add an overdue badge next to the due label**

Find where `task.dueLabel` currently renders. Wrap it with an overdue check. If the task object exposes the raw ISO `due_at` and `status`, add:

```tsx
{task.dueLabel ? (
  <span
    className={
      isOverdue
        ? "font-medium text-red-600 dark:text-red-400"
        : undefined
    }
  >
    {task.dueLabel}
    {isOverdue ? " · просрочено" : ""}
  </span>
) : null}
```

where `isOverdue` is computed once near the top of the component body:

```tsx
const isOverdue =
  Boolean(task.due_at) &&
  task.status !== "done" &&
  task.status !== "cancelled" &&
  new Date(task.due_at as string).getTime() < Date.now();
```

If `task.due_at`/raw `task.status` are not present on the mapped object passed to this component (confirm by reading the prop type at the top of the file), add them to the `fromApiWorkTask` return object in Task 3 instead of inventing new component-local fetching — do not fetch or compute dates outside the existing client-lib mapper.

- [ ] **Step 4: Manual verification**

Run the dev server and open a work task detail page anchored to a sales order with a past-due `due_at` and status `open`:

Run: `cd frontend && npm run dev`

Navigate to `/sales/tasks/{id}` for a task created against a seeded sales order; confirm the order info card renders with number/client/status/amount and the overdue badge shows in red when applicable. This is a manual UI check — no automated test exists for this component.

- [ ] **Step 5: Commit**

```bash
git add frontend/components/sales/work-task-chat-panel.tsx
git commit -m "feat(work-tasks): show order info card and overdue badge in chat panel"
```

---

### Task 5: Backend regression pass and full suite check

**Files:**
- None modified — verification only.

- [ ] **Step 1: Run the full backend test suite**

Run: `cd backend && python -m pytest -v`
Expected: PASS, no regressions introduced by the `_to_read` signature change (double-check nothing else outside `app/services/work_tasks.py` imports `_to_read` directly — it's a private helper, so this should be limited to that module).

- [ ] **Step 2: Run the full frontend test suite**

Run: `cd frontend && node --test lib/*.test.mjs`
Expected: PASS, no regressions.

- [ ] **Step 3: Run frontend typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no new type errors from the `ApiWorkTask`/`OrderSummaryView` additions.

- [ ] **Step 4: Commit (only if any fixes were needed in this task)**

```bash
git add -A
git commit -m "fix(work-tasks): address regressions from order summary enrichment"
```

(Skip this commit if Steps 1-3 all passed cleanly with no changes.)

---

### Task 6: Close out Stage 23.7 in the roadmap (md + HTML twins)

**Files:**
- Modify: `docs/roadmap/roadmap-v1.00.md`
- Modify: `docs/erp/status/roadmap-v1.00.html`

**Interfaces:**
- None — documentation-only task, run last after Tasks 1-5 are all green.

- [ ] **Step 1: Flip the five `23.7.*` checkboxes to done in the Markdown roadmap**

In `docs/roadmap/roadmap-v1.00.md`, under `### 23.7 — Order context + chat visual design`, change each `- [ ] 23.7.N — ...` line to `- [x] 23.7.N — ...` and append the closing date/artifact reference in the same style as the other closed `23.*` lines (e.g. `— v1.00 2026-08-08; app/schemas/work_tasks.py; test_work_tasks_api_23_2_1.py / Схема: имена + сводка заказа`), matching exactly the `— \`v1.00\` \`date\`; artifact-path; test-path / RU-label` format already used by `23.1.1`-`23.5.3` in that file.

- [ ] **Step 2: Mirror the same five items to `done: true` in the HTML twin**

In `docs/erp/status/roadmap-v1.00.html`, under the `"23.7 — Order context + chat visual design"` block added in this same change, flip each `done: false` to `done: true` for `23.7.1`-`23.7.5`, and add a `note: {en: "...", ru: "..."}` object to each item mirroring the artifact references added to the Markdown twin in Step 1 (follow the exact `note` shape already used by sibling items like `23.1.1`/`23.2.1` in this file).

- [ ] **Step 3: Update the roadmap header/change-log**

In `docs/roadmap/roadmap-v1.00.md`, update the `**Updated:**` line at the top to today's close date and add one new row to the `## Change log / Журнал изменений` table noting Stage 23.7 closed (mirror the terse EN/RU style of the existing rows, e.g. the `2026-08-06` Stage 23 row).

- [ ] **Step 4: Commit**

```bash
git add docs/roadmap/roadmap-v1.00.md docs/erp/status/roadmap-v1.00.html
git commit -m "docs(roadmap): close Stage 23.7 order-context + chat visual pass"
```

---

## Self-Review Notes

- **Spec coverage:** Text/image messaging and deadline capture already existed pre-plan (Stage 23.2/23.3) and are unchanged here — this plan's scope is strictly the two things the user asked for that were missing: (1) reliable name display in the task/chat header (closing the documented list-vs-detail gap) and (2) customer Sales Order context in the chat view. Overdue highlighting was added as a natural extension of "дедлайны" since a deadline with no overdue signal is of limited use in a task chat.
- **Out of scope, flagged explicitly:** migrating `LeadTask`/`CollaborationMicrotask` data and removing legacy UI (Stage 23.5.4/23.6) — these are pre-existing, separately tracked open items in `docs/tasks/v1.00-stage-23-unified-tasks.md` and were not part of the user's request in this session.
