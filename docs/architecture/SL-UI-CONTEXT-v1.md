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
- PC-06.3G: тот же блок «План производства» читает GET `/technical-cards/{id}/planning-health`. ETA, отгрузка, запас, риск, прогресс, просрочка и статус операции берутся из ответа. `is_overdue` решает слово «Просрочена»; дата операции — `planned_start`/`planned_end`.
- PC-06.0H: в карточке один блок «План производства». Вкладка «Маршрут» и второй список этапов сняты. Шапка показывает маршрут, число операций, ETA, отгрузку, запас и риск из уже посчитанной сводки. Даты открываются кнопкой «Изменить даты». Цех раскрывает операции, статус, плановую дату сохранённого шага, оборудование, исполнителя и замечание. Сборка остаётся строкой «Сборка: …». «Начать этап», «Завершить этап» и «Откатить» из карточки и цехового тела убраны; экран дизайна сохраняет «Принят в работу» и «Отправил в печать». Узкий экран складывает цеха в колонку, широкий держит их в ряд.
- PC-06.0G: блок «План производства» — горизонтальная схема цехов с операциями внутри. Сводка, «Изменить даты» и пересчёт стоят в шапке. Даты открываются модальным окном. Флажок сохраняет `plan_locked` и подписан «Зафиксировать даты»: пока он включён, пересчёт не сдвигает сохранённые даты. Статусы берутся из `stage_results` и `production_state`, без переноса факта из календаря. Строка сборки (`source_kind=sewing`) показывается над маршрутом как «Сборка: …», а не как цех. Сводка плана в шапке; даты открываются кнопкой «Изменить даты». Пустой план — «План не рассчитан» / «Рассчитать план»; устаревший — «План нужно обновить» / «Пересчитать». Узкий экран складывает цеха в колонку.
- PC-06.0F: то же окно говорит по-человечески и склеивает одинаковые замечания. Нормы расхода одной и той же причины — одна карточка со списком операций. Повторные замечания плана — одна карточка «Производственный план нужно пересчитать». Даты остаются отдельно. Название сборки берётся из уже загруженной техкарты. Код диагностики в этом окне не показывается. Замечание «сохранённый план устарел» не останавливает кнопку расчёта: это и есть запрошенное действие. Кнопка «Пересчитать план» в окне запускает расчёт. Если планировщик не смог сдвинуть уже начатые операции, текст отказа остаётся в блоке плана.
- PC-06.0E: расчёт, запуск и выбор модели с уже известной ошибкой открывают одно окно «Техкарта требует настройки». Строки и severity берутся из GET readiness и уже посчитанного списка норм модели. Окно не открывается при простом просмотре; предупреждение персонализации не становится блокировкой.
- PC-06.0B: карточка менеджера показывает «Проверка заполнения техкарты» из GET `/technical-cards/{id}/readiness`. Порядок, статусы, прогресс и `can_launch` не пересчитываются на клиенте. «Запустить ТК» видна у черновика и вызывает запуск только при `can_launch`; иначе открывает preflight, а если блокирующих строк нет — прежнее замечание и roadmap. Исходный diagnostic виден только в Debug Mode.

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

- PC-06.3J: order number, model and quantity on the planning desk come from same-origin GET `/api/technical-cards`. The browser does not use `NEXT_PUBLIC_SPORT_LEADS_API_URL` or `127.0.0.1:8000` for that list. Planning Health and the move form stay on `/api/production-calendar` and `/api/technical-cards/{id}/planning-health`.
- PC-06.3H: the same planning screen is a dispatcher desk. A list card shows number, order, model, quantity, workshop, ETA, shipping, slack, progress and one badge. Overdue adds one sentence from the server earliest operation and `overdue_days`, plus the count when it is greater than one. Filters stay Все / Просроченные / В риске / Требуют перепланирования / Без проблем and show counts from the loaded list. The open card repeats the same facts and that one reason. The route is one vertical timeline: done and current sit above «Дальше». The move form opens only for `can_replan`, then «Проверить перенос» and «Применить перенос». No client date math.
- PC-06.3G: `/production/calendar/planning` reads `GET /production-calendar/manual-planning/cards`. The open card and the technical-card plan block read `GET /technical-cards/{id}/planning-health`. ETA, shipping, slack, risk, overdue, progress and operation status are shown from that payload. The browser does not derive them from planned dates. List badge priority is overdue, then `risk_level=late`, then `replan_required`, then «План актуален». Filters are Все / Просроченные / В риске / Требуют перепланирования / Без проблем, using `has_overdue_operations`, `risk_level`, `replan_required` and `has_planning_issues`. A pending operation is «Просрочена» only when `is_overdue` is true; `can_replan` shows the move icon and `is_protected` shows a lock. Preview/apply stays the 3C response. «Открыть ТК» remains the detail-header icon and the same full-card overlay. Below `lg` the list and detail replace each other; the back control is «← К списку».
- PC-06.3E: the planning list shows one card per technical card with model, quantity, workshop, shipping date, route progress and a badge from server flags. `planning_state` stale/invalid is «Требует перепланирования»; a saved planned state without that flag is «План сохранён» until the opened card's `planning_summary` says `on_time`. The open card shows ETA, shipping and slack from `planning_summary` and «Риск срока» only when `on_time` is false. Filter «Состояние плана» is Все / Просроченные / В риске / Требуют перепланирования / Без проблем. Route status words are «Запланирована», «В работе», «Завершена», «Пропущена»; completed and in-progress stay locked. BACKEND GAP: the board and the technical-card list do not include an overdue flag, overdue day count, earliest overdue operation, or list-level ETA/`on_time`/`replan_required`. The screen does not derive those from planned dates.
- PC-06.3C: the same planning screen calls POST `/production-calendar/manual-planning/preview` and `/apply`. Mode is `single` («Только эту операцию») or `downstream` («Эту и последующие»). Preview, affected dates, ETA, slack, risk, warnings and blockers are shown from the response; the browser does not calculate them. Apply stays disabled until `apply_allowed` and the revision/fingerprint still match the chosen node, date and mode. A single-mode blocker suggests downstream and does not switch mode. Conflict codes use the manager texts for changed, protected, dependency, capacity and blocked. Success says «План обновлён», reloads the card, board and route, and calls `router.refresh()`. Completed and in-progress steps stay locked; the fact sentence is their title.
- PC-06.3A: `/production/calendar/planning` (alias `/manual-planning`) is a master-detail of open cards, one row per technical card. The route comes from stage results. The current pending step stays locked. Deleted and completed cards stay off the editable board. Below `lg` the list is shown first and the route replaces it after a choice. The move command is PC-06.3C, not the assignment PUT.

- PC-06.2A: weekly board toolbar has a local multi-select `Статус` (Все / Запланирована / В работе / Завершена, plus any extra `operation_status` through `calendarOperationStatusLabel`). Default shows every loaded assignment. The filter only hides stickers; it does not refetch the board, change queue load, or touch Scheduler, Kanban, queue, or fact. Empty selection keeps the week grid. Control wraps under the week switch on a narrow toolbar.

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
