# Order Card Soft Densify Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Densify `/sales/orders/[id]` into a mixed Soft UI layout: left document (party without money + need + items), right sticky tabs (Finance | Chat | Notes), tech/docs/history behind filters.

**Architecture:** Keep existing components; recompose `sales-order-page.tsx`. Strip money from `OrderClientNeedDetails`. Add `variant="slim"` to `SalesOrderMetrics`. Drive visibility via `order-card-view-mode.ts` so default Document mode no longer stacks CRM + tech on the left.

**Tech Stack:** Next.js App Router client components, Tailwind portal tokens, `CompactTabs`, Lucide icons, node:test for view-mode unit tests.

**Spec:** `docs/superpowers/specs/2026-08-06-order-card-minimal-design.md`

## Global Constraints

- Preserve **DS-SHELL-01** / **DS-SHELL-02** (no shell edits).
- No backend / API / migration changes.
- Do not reopen Stage 20 messaging contracts.
- Keep line-item create → local update + `router.refresh()` sync.
- Do not commit unless the owner explicitly asks.
- Roadmap HTML twin sync only if a roadmap checkbox is closed (not in this plan by default).

## File map

| File | Responsibility |
|------|----------------|
| `frontend/lib/sales/order-card-view-mode.ts` | Labels + default Document visibility |
| `frontend/lib/sales/order-card-view-mode.test.mjs` | Regression for visibility matrix |
| `frontend/components/sales/order-client-need-details.tsx` | Party + need only (no money) |
| `frontend/components/sales/sales-order-metrics.tsx` | Slim finance variant |
| `frontend/components/sales/sales-order-page.tsx` | Left stack + right tab host |
| `frontend/app/globals.css` | Optional denser `.order-v1-*` gaps |

---

### Task 1: View mode — Document default, hide tech/history from default left stack

**Files:**
- Modify: `frontend/lib/sales/order-card-view-mode.ts`
- Modify: `frontend/lib/sales/order-card-view-mode.test.mjs`

**Interfaces:**
- Produces: `orderCardViewModeOptions` with `all` labeled `Документ`; `getOrderCardSectionVisibility("all")` returns `history: false`, `techCards: false`, `comments: false`, `tasks: false`, `communication: false` (CRM lives in right tabs, not left stack). `metrics` stays `true`. `info` + `items` stay `true`. Exclusive modes unchanged except communication mode may still focus left if needed — prefer right-rail always for CRM in page (Task 4).

- [ ] **Step 1: Update failing expectations in test**

Change `all` mode test to:

```js
test("document (all) mode shows info+items+metrics; CRM/tech/history off left stack", () => {
  const visibility = getOrderCardSectionVisibility("all");
  assert.equal(visibility.info, true);
  assert.equal(visibility.metrics, true);
  assert.equal(visibility.items, true);
  assert.equal(visibility.history, false);
  assert.equal(visibility.comments, false);
  assert.equal(visibility.tasks, false);
  assert.equal(visibility.communication, false);
  assert.equal(visibility.documents, false);
  assert.equal(visibility.techCards, false);
});
```

Also update label assertion if added:

```js
test("all mode is labeled Документ", async () => {
  const { orderCardViewModeOptions } = await import("./order-card-view-mode.ts");
  assert.equal(orderCardViewModeOptions.find((o) => o.id === "all")?.label, "Документ");
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `cd frontend && node --test lib/sales/order-card-view-mode.test.mjs`  
Expected: FAIL on `all` mode assertions / label.

- [ ] **Step 3: Implement visibility + label**

```ts
export const orderCardViewModeOptions = [
  { id: "all", label: "Документ" },
  { id: "info", label: "Сведения о заказе" },
  { id: "items", label: "Товары" },
  { id: "communication", label: "Коммуникация" },
  { id: "documents", label: "Документы" },
  { id: "techCards", label: "Тех карты" },
] as const; // keep mutable array type as today if needed

// default branch of getOrderCardSectionVisibility:
return {
  info: true,
  metrics: true,
  items: true,
  history: false,
  comments: false,
  tasks: false,
  communication: false,
  documents: false,
  techCards: false,
};
```

Keep `items` mode showing `techCards: true` (line-adjacent). Keep `metrics: true` in all modes.

- [ ] **Step 4: Run test — expect PASS**

Run: `cd frontend && node --test lib/sales/order-card-view-mode.test.mjs`

---

### Task 2: Strip money from party+need card

**Files:**
- Modify: `frontend/components/sales/order-client-need-details.tsx`

**Interfaces:**
- Consumes: `SalesOrderDetails` party + need fields only
- Produces: same `onSaved` callback; DataList without financial keys

- [ ] **Step 1: Remove from DataList items**

Delete entries: `itemsSubtotal`, `orderDiscount`, `amountNet`, `vatAmount`, `currency`, `amount`.

Keep: `client`, `organization`, `responsible`. Optionally show `currency` only if needed — **spec says remove currency** with money; omit it.

- [ ] **Step 2: Tighten empty need UI**

Replace large dashed `py-6` empty block with one-line muted text: `Потребность не заполнена — нажмите +`.

- [ ] **Step 3: Shorten SectionCard description**

Use: `Клиент и потребность` (or omit description).

- [ ] **Step 4: Smoke** — open order card mentally / browser: left card has no Итого.

---

### Task 3: Slim finance metrics variant

**Files:**
- Modify: `frontend/components/sales/sales-order-metrics.tsx`

**Interfaces:**
- Produces: `SalesOrderMetrics({ orderId, metrics, variant?: "full" | "slim" })`  
  - `slim` (default for order page): amount, net, VAT, discount editor, payment editor; **no** ProgressBars for production/sewing, **no** MiniStat grid, **no** margin demo line emphasis  
  - `full`: preserve current UI for any other caller (if none, still keep code path)

- [ ] **Step 1: Add `variant = "slim"` prop**

```tsx
export function SalesOrderMetrics({
  orderId,
  metrics,
  variant = "slim",
}: {
  orderId: string;
  metrics: OrderCardMetricsModel;
  variant?: "full" | "slim";
}) {
```

- [ ] **Step 2: Gate mini-stats / production bars**

Wrap existing ProgressBar + MiniStat blocks:

```tsx
{variant === "full" ? ( /* existing bars + MiniStat grid */ ) : null}
```

Keep discount + payment editors in both variants. In `slim`, show a compact dl of Итого / Без НДС / НДС above editors (can reuse hero numbers without gradient chrome if simpler).

- [ ] **Step 3: Page will pass `variant="slim"`** (Task 4); remove duplicate 4-chip rail from page.

---

### Task 4: Recompose `sales-order-page` — left document + right tabs

**Files:**
- Modify: `frontend/components/sales/sales-order-page.tsx`
- Modify: `frontend/app/globals.css` (`.order-v1-layout` gap / aside width if needed)

**Interfaces:**
- Consumes: Tasks 1–3 visibility + slim metrics + party card
- Produces: Right rail state `asideTab: "finance" | "chat" | "notes"`

- [ ] **Step 1: Add aside tab state**

```tsx
type AsideTab = "finance" | "chat" | "notes";
const [asideTab, setAsideTab] = useState<AsideTab>("finance");
```

- [ ] **Step 2: Build right aside**

Replace current aside content (4 chips + SectionCard wrapping full metrics) with:

```tsx
<aside className="order-v1-aside" aria-label="Финансы и коммуникации заказа">
  <div className="rounded-portal-lg border border-portal-border bg-portal-surface shadow-portal-card p-portal-3">
    <CompactTabs
      label="Боковая панель заказа"
      size="compact"
      value={asideTab}
      onChange={(id) => setAsideTab(id as AsideTab)}
      items={[
        { id: "finance", label: "Финансы" },
        { id: "chat", label: "Переписка" },
        { id: "notes", label: "Заметки" },
      ]}
    />
    <div className="mt-3">
      {asideTab === "finance" ? (
        <SalesOrderMetrics orderId={order.id} metrics={metrics} variant="slim" />
      ) : null}
      {asideTab === "chat" ? (
        <OrderCollaborationPanel embedded orderId={order.id} title="Внутренняя переписка" />
        /* no customerSummary */
      ) : null}
      {asideTab === "notes" ? (
        <>
          <LeadActivityTimeline embedded compact mode="notes" ... />
          {/* short tasks list under notes */}
        </>
      ) : null}
    </div>
  </div>
</aside>
```

- [ ] **Step 3: Strip left CRM stack from default Document path**

- Remove left `communicationBlock` from default main column (or keep only when `visibility.communication` for filter «Коммуникация» — when that filter is on, either switch `asideTab` to `chat` via `useEffect` or show left panel; prefer `useEffect` → `setAsideTab("chat")` + hide left duplicate).
- Remove mid-grid notes/tasks from left when visibility flags false (Task 1).
- Keep tech cards / documents / history gated by visibility.
- Remove PageActions «Написать / Заметка / Позвонить» strip that duplicated CRM chrome under left comms when moving chat to aside.

- [ ] **Step 4: Density CSS**

In `globals.css`, for `.order-v1-main` set `gap: 0.5rem` (was ~0.875rem). Aside `max-width` ~22.5rem if not already.

- [ ] **Step 5: Filter sync**

When `viewMode === "communication"`, `setAsideTab("chat")`.  
When `viewMode === "info"`, ensure party+need visible; notes can open aside `notes`.  
When `viewMode === "techCards" | "documents" | "items"`, left shows those sections per visibility.

- [ ] **Step 6: Verify item add still works** — `onItemCreated` / items server sync unchanged.

---

### Task 5: Checks

- [ ] **Step 1:** `cd frontend && node --test lib/sales/order-card-view-mode.test.mjs`
- [ ] **Step 2:** `cd frontend && npx tsc --noEmit` (ignore pre-existing unrelated errors; ensure no new ones in touched files)
- [ ] **Step 3:** Browser `/sales/orders/[id]` at 1280px — items above fold-ish; finance tab slim; chat without client card
- [ ] **Step 4:** Report: DS-SHELL-01/02 preserved; Roadmap: changes not required (unless owner asks for 22.* microtask)

---

## Spec coverage self-review

| Spec requirement | Task |
|------------------|------|
| Left party without money | 2 |
| Compact need | 2 |
| Items primary canvas | 4 |
| Right tabs Finance/Chat/Notes | 4 |
| Slim finance | 3 |
| No client card in chat | 4 |
| Tech/docs/history not first paint | 1 + 4 |
| Default Document layout | 1 |
| Shell/API out of scope | Global |
| Item refresh fix preserved | 4 Step 6 |

## Placeholder scan

None intentional. Commit steps omitted per owner git policy.
