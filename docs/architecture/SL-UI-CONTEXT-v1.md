# SL-UI-CONTEXT-v1

Shared agent-facing UI memory, PC-05.3 bootstrap 2026-10-11.
Для Cursor и Codex frontend work; HTML twin не требуется.
Это targeted routing guide, не новый approved visual contract.
Начало: task → SL-PROJECT-MEMORY-v1 → relevant UI section → конкретные files.
Backend читать только при изменении API/data contract.

## UI-INDEX — Scope lookup

| Feature | Section | Target |
|---|---|---|
| Shell/navigation | UI-SHELL | navigation.ts, AppSidebar, TopNavigation |
| Layout/templates/tokens | UI-BASE | design-system source for selected pattern |
| TechnicalCard | UI-TK | tech-card-detail-workspace + selected panel |
| Calendar/equipment | UI-CALENDAR | selected calendar page/client/component |
| Debug Center card | UI-DEBUG | platform-diagnostic-card + platform-debug helpers |
| Shared component change | UI-SHARED | named primitive + direct consumers |
| Visual verification | UI-RESPONSIVE | selected contract's responsive matrix |

Не сканировать всё frontend; сначала route/page/feature.
Для чистого presentation change DF/invariant/backend не требуется.
Если изменяются data contracts, читать точные relevant DF/invariant sections.
Не открывать history всех UI tasks; approved references живут в design-system.

## UI-SHELL — Protected Platform Shell

- Canonical navigation: `frontend/lib/navigation.ts`, appSections/topNavigation.
- Shell: `frontend/components/layout/app-shell.tsx`, `app-topbar.tsx`.
- DS-SHELL-01: `frontend/components/navigation/app-sidebar.tsx`.
- DS-SHELL-02: `frontend/components/navigation/top-navigation.tsx`.
- Approved contract: [shell-contracts](../design-system/shell-contracts.md).
- Sidebar expanded token: max(220px,10vw); compact72px; storage sport-lead-sidebar-mode.
- <768px sidebar hidden;768–1299 compact;1300+ restores stored expansion.
- Topbar52px small/56px from md; desktop section nav from lg.
- Mobile compact menu owns platform + section navigation.
- Topbar owns global Search/Settings/Create; page toolbar owns local filters/actions.
- Не менять shell JSX frame, widths, spacing, colors, breakpoints, compact mechanics без visual task.
- Routes/groups добавляются через navigation.ts; duplicate links в shell запрещены.
- app-topbar wrapper не содержит альтернативную реализацию TopNavigation.
- Старая summary-table260px не заменяет текущий token/DS-SHELL-01 contract.
- Shell task report: соответствующий `DS-SHELL-01/02 visual contract preserved`.

## UI-BASE — SL-UI-BASE-v1 и approved patterns

- SL-UI-BASE-v1 — label общего portal shell/tokens в calendar design references.
- Отдельного canonical SL-UI-BASE-v1 файла bootstrap lookup не нашёл.
- Не создавать новый layout/token contract на основании одного label.
- Canonical basis: [design-system README](../design-system/README.md), shell contracts и globals.css.
- Portal --portal-* tokens: typography/color/spacing/surface/component sizes/breakpoints.
- Source files: `frontend/app/globals.css`, `frontend/components/ui`, `frontend/components/layout`.
- Approved PT-01 Dashboard; PT-02 List/Table; PT-03 Kanban; PT-04 Tree+List.
- PT-05 Simple Entity; PT-06 Complex Entity; PT-07 Document; PT-08 Versioned Workspace.
- Catalog etalons: DS-PT-02-CATALOG и DS-PT-08-CATALOG.
- Выбирать точный template doc через README; reference/demo не означает persisted readiness.
- PageLayout/PageToolbar/PageActions/SectionCard и shared primitives проверять по inventory.
- No alternate global topbar; local toolbar не дублирует platform navigation.
- List pages: slim summary DTO + embed/batch; no RSC per-row fetch.
- API error не заменяется demo/empty success; loading/error/empty различаются.

## UI-TK — TechnicalCard workspace

- PC-06.1A v2 (PT-02): existing ready_to_ship/shipped stage URLs are whole-card fulfillment lists, not operation queues. One slim authenticated API request; № ТК, order, model, canonical quantity, production completion/ready date, planned shipping date; ready list has explicit Отгрузить with server errors, shipped list is read-only and adds shipped_at. Manager-card links do not open obsolete warehouse stage controls. Existing table/mobile-card primitives retained, shell unchanged. No warehouse, partial shipment or QR UI in this flow.

- PC-06.0C: тот же блок — компактная строка стикеров с переносом. Клик открывает пояснение выбранного шага под строкой. Статусы и `can_launch` по-прежнему только из GET readiness.
- Стадия `?stage=design` показывает экран дизайнера двумя равными колонками: слева макет клиента только для просмотра, модель и персонализация read-only с Excel по всем строкам; справа чат на всю оставшуюся высоту окна, лента сообщений прокручивается внутри чата. Картинка из чата открывается в модальном окне. «Ответить» сохраняет ссылку на исходное сообщение; если там было изображение, в ответе видна его миниатюра. Шапка техкарты на всех экранах показывает автора, время создания и дату сдачи заказа или группы. Дата сдачи одна: правка в данных заказа меняет её на карточке менеджера, в цехах и в шапке. «Принят в работу» стартует этап, «На утверждении» пишет сообщение в чат и не двигает маршрут, «Отправил в печать» завершает этап. Время считается от старта до завершения. Остальные цеха и карточка менеджера не используют этот экран.
- PC-06.0B: карточка менеджера показывает «Готовность техкарты» из GET `/technical-cards/{id}/readiness`. Порядок, статусы, прогресс и `can_launch` не пересчитываются на клиенте. «Запустить ТК» видна у черновика и вызывает запуск только при `can_launch`; иначе показывает блокирующие замечания и открывает roadmap. Исходный diagnostic виден только в Debug Mode.

- PC-05.13: «План ТК» при создании записывается и как план числа карт, и как `TechnicalCard.quantity`. Карточка, канбан, очередь участка и цеховой список показывают это количество. Персонализация его не меняет; если сумма строк другая, карточка показывает предупреждение. «Запустить ТК» не стартует участок: канбан остаётся «Принять в работу».
- PC-05.11: Kanban «Завершить» вызывает тот же complete. Если backend возвращает material fact gate, открывается окно «Фактический расход материалов» только по материалам текущей операции: план подставлен, уже записанный fact_qty сохраняется, «Сохранить» пишет факт и оставляет этап в работе, «Сохранить и завершить» пишет факт и повторяет complete. Английский текст gate в интерфейсе не показывается. Состав на карточке менеджера остаётся read-only.
- PC-05.8 (PT-03): list status/workshop and Kanban placement/badge consume backend `production_state`; planned is «Запланирована», waiting is «Ожидает». Canonical current_workshop_id wins over legacy label/pointer; the column name falls back to `current_workshop_name` when the catalog id is missing. The card shows that workshop name. No frontend DAG/status inference for canonical API payloads; legacy DTO fallback retained for compatibility. The weekly calendar places the card only on the current workshop row — the same stage as the Kanban column. Other route dates stay in the card preview as plan/done and do not occupy a workshop row. Queue remains the server queue API. DnD disabled; layout/shell visuals unchanged.
- PC-05.6D очередь (`?view=queue`): порядок только GET `/production-calendar/workshops/{id}/queue`. Стрелки меняют draft; «Предпросмотр» и «Применить очередь» вызывают preview/apply с revision и fingerprint. Право preview/apply — `technical_cards.create`. 409 `workshop_queue_changed` сбрасывает draft. Kanban и факт не двигаются; после apply календарь revalidate.

- Route: `/production/tech-cards/[id]`.
- RSC entry: `frontend/app/(workspace)/production/tech-cards/[id]/page.tsx`.
- Actions: `frontend/app/(workspace)/production/tech-cards/tech-card-actions.ts`.
- Main workspace: `frontend/components/production/tech-card-detail-workspace.tsx`.
- Model/route panel: `tech-card-model-route-card.tsx`.
- Production plan panel: `tech-card-production-plan.tsx`.
- Route alternatives: `tech-card-route-variants.tsx`; process: `tech-card-process.tsx`.
- Journal/debug: `tech-card-journal.tsx`; common errors: `readiness-stickers.tsx`.
- API client: `frontend/lib/sales/order-tech-cards-api.ts`.
- Feature clients/helpers: lib/route-variants.ts, route-readiness.ts, production/tech-card-*.
- Названия route master не заменяют applied snapshot identity/fact.
- Backend owns Demand/ETA/readiness; UI presents verified values/errors.
- IC-RS01: route-review-notice.tsx + lib/production/route-review.ts render plain manager copy/action; no-fact refresh reuses onApplyRouting, protected fact links to route for manual review. Technical reason/IDs remain Debug-only. No new shell/layout contract.
- Stage/fact/start API conflicts не превращать в successful optimistic state.
- Перед panel change открыть его прямые consumers, а не весь production UI.

## UI-CALENDAR — Production Calendar

- PC-06.1B: /calendar/planning requests board editable_only=true; default Calendar history stays unchanged. Existing UI-E/PT-02 layout preserved. /calendar/manual-planning redirects with query parameters to canonical planning page. Delete action invalidates Calendar/planning/capacity after success; no frontend name-based hidden-card list or status calculation.

- PC-05.8 additive production_state/operation_state DTO metadata uses the backend resolver; current workshop never inferred from planned dates. The weekly board draws a card only for `operation_state=current` (and assignments without an operation state). That row is the Kanban column. Future and completed assignments stay in the card preview as «план»/«готово» and do not place the card on another workshop.

- Routes: `/production/calendar`, `/production/calendar/planning`, `/production/calendar/capacity`.
- Existing weekly board: `frontend/components/production/calendar-weekly-board.tsx`.
- Mass planning: `production-queue-panel.tsx`; backend engine не копировать в JS.
- Capacity UI: `calendar-capacity-settings.tsx`.
- Data clients: `frontend/lib/production/calendar.ts`, `calendar-capacity.ts`, `production-queue.ts`.
- Server actions: calendar/queue-actions.ts и capacity/load-actions.ts в workspace app.
- Model source: assignments/allocation/date/resource DTO, не frontend estimation.
- Inclusive date ranges, read-only card quantity, explicit save/replan сохраняются.
- Resource/date load states читаются с backend; unknown остаётся unknown.
- Не складывать проценты разных unit/resource в выдуманный общий section percentage.
- Load badges не заменяют execution/freshness gate.
- Physical equipment catalog: `/settings/catalogs/work-centers`.
- Route/operation catalogs: `/settings/catalogs/routings`, `/settings/catalogs/tech-operations`.
- Existing prototypes: [calendar ui-contract](../design/production-calendar/ui-contract.md).
- Prototype UI-A…H approvals не доказывают implementation каждого экрана.

## UI-DEBUG — Global Debug Center и diagnostic card

- Entry: TopNavigation opens PlatformDebugCenter overlay; это не отдельный route.
- Workspace debug_mode загружается через AppShell/platform-brand и persisted settings.
- Overlay: `frontend/components/platform/platform-debug-center.tsx`.
- Card: `frontend/components/platform/platform-diagnostic-card.tsx`.
- Helpers/data adapter: `frontend/lib/platform-debug.ts`.
- Server action: `frontend/app/(workspace)/platform-health-actions.ts`.
- GET `/platform-health`; existing ProductionDiagnostic DTO/readiness-stickers types reused.
- Category filters: All/CONFIGURATION/DATA_FLOW/RUNTIME/INTEGRITY.
- Route context, pagination, search, explicit errors/retry принадлежат overlay.
- Card presents severity, entity/field, source/actual, trace, safe fix link, technical details.
- Helpers: diagnosticTechnicalRows, formatDebugValue, safeFixHref, traceChain.
- Redaction/safe href rules не ослаблять; errors не заменять demo diagnostics.
- Focused frontend checks: `frontend/lib/platform-debug.test.mjs`.
- Presentation-only card task: открыть card и relevant helpers/types; backend не читать.
- DTO/diagnostic meaning change: PM-DIAGNOSTICS → DF-DIAGNOSTICS → exact API/schema/resolver.
- Добавление кнопки Debug не разрешает redesign защищённой topbar.

## UI-SHARED — Переиспользование

- Canonical primitive inventory: [component-inventory](../design-system/component-inventory.md).
- Use existing Button/forms/dialog/create-drawer/table/badge/layout primitives.
- Shared component edit требует targeted поиска consumers до изменения контракта.
- Drawer/modal boundary: [create-modal-drawer-boundaries](../design-system/create-modal-drawer-boundaries.md).
- Не заменять edit persistence новым local-only drawer.
- UI money displays ₽; ISO currency remains API data.
- Form failure сохраняет input и показывает ошибку; pending/dirty guards сохраняются.

## UI-RESPONSIVE — Verification и conflicts

- Canonical: [responsive-rules](../design-system/responsive-rules.md), responsive-audit и shell contracts.
- Base matrix:1920/1600/1440/1280/1024/768/390px; contract-specific320/1366 если требует feature task.
- Nested workspace лучше привязывать к container width; shell — viewport breakpoints.
- Table/board имеет локальную horizontal прокрутку; page horizontal overflow запрещён.
- Check long text, empty/error/loading, max actions, open dropdown/dialog, expanded/compact shell.
- Не менять scroll owner/sticky/overflow без чтения relevant DS-PAGE-05 contract.
- Visual report: template ID, pages, widths, found bugs; bug gets separate microtask.
- Нет UI changes в PC-05.3: responsive/browser verification этой memory задачи не требуется.
- Conflict: record → smallest verified code/contract scope → repair stale UI memory → continue.
- Approved UI contract change обновляет relevant UI section; иначе mechanical update не нужен.
