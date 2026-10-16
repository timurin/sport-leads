# IC-RS05 — Close Final P1 Invariant

## Исполнитель
Codex

## Источник истины
Использовать:
- `docs/architecture/SL-PROJECT-MEMORY-v1.md`
- точный invariant `IC-RS-05` из `docs/architecture/SL-INVARIANT-COVERAGE-v1.md`
- только связанные `DF-*` разделы `SL-DATA-FLOW-v1`

## Цель
Закрыть последний оставшийся P1 — `IC-RS-05`.

Не определять содержание задачи по памяти или истории task-файлов. Сначала прочитать только строку/раздел `IC-RS-05` в canonical invariant matrix.

## Token-efficient context
Порядок:
1. task;
2. `SL-PROJECT-MEMORY-v1`;
3. exact `IC-RS-05`;
4. только связанные `DF-*`;
5. targeted code symbols/files.

Запрещён repo-wide scan без обнаруженного противоречия canonical docs с кодом.

## Preflight
Перед изменениями зафиксировать кратко:
- exact title/invariant IC-RS-05;
- affected entities;
- affected DF chains;
- invalid state;
- expected guard;
- production-fact risk.

Если `IC-RS-05` не определён однозначно:
`STOP — IC-RS-05 is not defined in canonical invariant coverage`
и ничего не менять.

## Реализация
Закрыть только IC-RS-05.

Правила:
- guard ставить до persistence/исполнения, где возможно;
- использовать единый Diagnostics Engine;
- manager-facing сообщение — простым языком;
- технические identifiers/reason/trace — только Debug Mode;
- production facts не изменять автоматически;
- legacy/unknown данные не угадывать и не auto-fix;
- не делать broad refactor.

## Existing data audit
После исправления выполнить targeted audit только по IC-RS-05:
- test/stress;
- production/unknown;
- exact counts.

Production/unknown данные — report-only, если безопасное исправление явно не доказано.

## Tests
Сначала только targeted:
- valid state passes;
- exact invalid state rejected;
- legacy invalid state diagnosed;
- no false positives;
- production fact protected.

После targeted PASS — один final check:
- backend full tests;
- frontend только если реально затронут contract/UI;
- project check;
- DB integrity/orphan scan;
- git diff --check.

## Docs
Один раз в конце:
- закрыть IC-RS-05 в invariant matrix;
- обновить только затронутые `DF-*`;
- `SL-PROJECT-MEMORY-v1`;
- roadmap/ERP-check только если требуется статусом;
- HTML twins sync once.

## Не делать
- P2/P3;
- 5/30-TK stress test;
- новый архитектурный аудит;
- массовый repair;
- commit/push.

## Acceptance
Готово, если:
- IC-RS-05 защищён;
- remaining P0 = 0;
- remaining P1 = 0;
- targeted + final checks PASS.

## Отчёт
Не более 10 строк:
1. exact IC-RS-05;
2. guard;
3. manager/debug diagnostic;
4. existing data findings;
5. tests;
6. remaining P0/P1.

Финальная строка:
`IC-RS05 FINAL P1 CLOSED`

## Результат — 2026-10-12

1. Exact IC-RS-05: «Live operation identity, на которую ссылается frozen node, не удаляется незаметно». Selected by owner; affected entities TechOperation/TechnicalCardStageResult/TechnicalCardOperationLine, chains DF-ROUTE-SNAPSHOT/DEMAND-CAPACITY/DIAGNOSTICS. Invalid state — retained integer reference to removed catalog identity after live route references disappear; production-fact risk — loss of identity/norm source, no fact rewrite permitted.
2. Guard before repository hard delete: retained node/operation-line references reject for all card statuses, including cancelled/completed; existing route FK guard remains. Shared scheduler lock also protects canonical snapshot copy/append reads. Unused operation passes; same display name is not a reference. No auto archive/deactivation/remap or production-fact mutation. Service/API boundary protected; raw SQL/bulk bypass remains legacy/report-only scope.
3. Shared diagnostics: tech_operation_retained_by_technical_card and technical_card_operation_reference_missing, INTEGRITY. Manager sees «Нельзя удалить операцию: она используется в техкартах…» or «В техкарте не найдена производственная операция…». Debug fields carry exact IDs/reference kinds/status/reason/trace; no identifiers in manager text. HTTP409 string detail/headers preserved; DTO/UI unchanged. Card/platform missing-reference read works alongside malformed route review.
4. Local read-only audit82 references: production/unknown34 stage nodes+34 operation lines; test/stress candidates7+7.7 retained operation IDs;0 missing catalog references,0 scan SQL writes/repairs.247 FK checks/0 orphan references. Classification by name only, not repair permission. VPS/production not accessed. Evidence operation-audit.json/db-integrity.json in logs/ic-rs05.
5. Tests:10 new backend regressions, 346 targeted PASS; one final project check10/10 PASS including 919 backend/394 frontend, OpenAPI/Alembic drift/Compose and required frontend checks. Frontend not changed; no separate extra frontend suite. Existing warnings unchanged. Data-flow/invariant generators --check and git diff --check PASS. Evidence targeted.log/project-check.log.
6. Files: new operation_retention.py and test_operation_retention_ic_rs05.py; tech_operations delete service, route_snapshot lock and shared production_diagnostics integration. Updated exact invariant, three DF sections, memory, ADR-017, selected task report, root roadmap/project-structure/ERP and status twins. Models/contracts/schema/migrations: no changes. **HTML twin synced**; canonical diff logs/ic-rs05/canonical-docs.diff, final status saved.
7. Current matrix P0=0/P1=0/P2=13/P3=28. IC-RS-05 covered/P3; remaining canonical P1 inventory closed. Legacy unverified route/manual review, overall calendar readiness and visual gates are not automatically closed. No P2/P3 work, stress run, stage transition, commit/push. Recommended next action: owner review and selection of the next authorized roadmap task.

Data-flow updated: DF-ROUTE-SNAPSHOT, DF-DEMAND-CAPACITY, DF-DIAGNOSTICS. Project memory updated.

IC-RS05 FINAL P1 CLOSED
