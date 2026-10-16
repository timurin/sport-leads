# PC-04.4G-A — Routing Graph Contract and Read-only Projections

Подэтап PC-04.4G, выбранный как первая законченная итерация по правилу AGENTS.md: «Если слишком большая, разбить и выполнить только первый законченный подэтап».

Результат: audit BEFORE/AFTER, единый validated graph DTO, deterministic topological traversal, read-only template/card projections без live-template fallback и без изменения исполнения. Контракт и минимальная последующая миграция: [unified-routing-graph-pc-04-4g.md](../architecture/unified-routing-graph-pc-04-4g.md).

Implemented endpoints:

- GET `/shop-routings/{template_id}/graph`;
- GET `/technical-cards/{card_id}/route-graph`.

Оба требуют session, имеют OpenAPI response_model RoutingGraphRead и не пишут в БД. Ответ projection_only=true, persisted_dependencies=false, scheduler_graph_integrated=false. Explicit fork/join поддержан **validator/DTO**, но ещё не persistence/execution. Неполный snapshot даёт gaps, не подставляет live route и не утверждает завершение цеха.

11 focused tests passed. No migrations/frontend/Demand/Capacity/fact changes. Source VIS-STRESS сохранён, stress scripts и live mass command не запускались. Parent PC-04.4G открыт; G-B migration/snapshot binding и G-C engine/fact cutover остаются необходимыми. Репродуцирован P1 existing live-template Scheduler drift в изолированном dry-run: snapshot2 nodes, plan3 steps, persisted=false; этот дефект **не устранён G-A** и блокирует full G acceptance.

Нельзя начинать PC-04.4H как полноценный write/editor flow до G-B/G-C. Следующая законченная итерация — snapshot persistence и calendar binding (G-B), не переход в другой roadmap stage. Commit/push/merge и production apply не выполнялись.

Проверки: 11 targeted tests passed, `logs/pc-04-4g-targeted.log`; полный `python scripts/check_project.py` — exit0, PROJECT CHECK PASSED,10/10: 653 backend / 352 frontend tests, OpenAPI/models/Alembic/lint/tsc/build/Compose. Лог: `logs/pc-04-4g-project-check.log`. Нет новых upgrade operations; миграций в G-A нет. Existing P1 остаётся открытым независимо от green checks. Read-only local DB audit: template1 содержит7 operation nodes, source stress-card26 —4, gaps0. Source VIS-STRESS30 ТК,125 stage results и125 operation lines, assignments0/allocations0; полный before/after snapshot проверен неизменным. Ни stress validator/seed, ни live schedule не запускались. `git diff --check`, renderer `--check` и MD↔HTML matching flags passed. **HTML twin synced:** G-A `[x]`/true, G `[ ]`/false. Известные warning dependency/cache/lint не маскировались.

Изменены service/schema routing_graph, additive API reads shop_routings/technical_cards, targeted tests, audit/contract/task reports и canonical MD/HTML + renderer. Нормы, Capacity/WorkCenter, модели, fact commands, Scheduler/mass implementation и frontend в этой итерации не менялись. Ранее существовавший WIP сохранён.
