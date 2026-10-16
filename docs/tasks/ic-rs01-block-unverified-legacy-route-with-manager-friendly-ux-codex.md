# IC-RS01 — Block Unverified Legacy Route + Manager-Friendly UX

## Исполнитель
Codex

## Источник
IC-FINAL blocker / `SL-INVARIANT-COVERAGE-v1`

## Priority
P1

## Решение по policy
Старые route snapshot-данные с недоказанной полнотой нельзя использовать для нового планирования или запуска производства.

Менеджеру нельзя показывать технические термины:
- legacy snapshot;
- исторический снимок;
- подтверждение полноты;
- snapshot replacement.

## Цель
1. Заблокировать планирование/запуск ТК, если система не может доказать корректность старого маршрута.
2. Дать менеджеру простое понятное сообщение.
3. Разрешить безопасное обновление маршрута только там, где нет защищённого производственного факта.
4. Сохранить технические детали только в Debug Mode.

## Targeted context
Использовать только:
- `SL-PROJECT-MEMORY-v1`
- exact invariant `IC-RS-01`
- `DF-ROUTE-SNAPSHOT`
- `DF-SCHEDULER-CALENDAR`
- `DF-DIAGNOSTICS`

Не делать repo-wide scan.

## Backend semantics

### 1. Unverified route state
Определить canonical признак/проверку, что persisted route snapshot нельзя считать доказанно корректным для нового планирования.

Не восстанавливать исторический состав по текущему template автоматически.

### 2. Planning guard
Если route state unverified:
- Scheduler preflight блокирует планирование;
- mass scheduler также блокирует эту ТК;
- новый CalendarAssignment не создаётся.

Diagnostic code:
`route_requires_review_before_planning`

Category:
`INTEGRITY`

### 3. Start guard
Планируемую операцию нельзя перевести в `in_progress`, пока маршрут не приведён в подтверждённое состояние.

### 4. Safe route refresh
Если в ТК НЕТ `in_progress/completed` production fact:
- разрешить явное действие обновления маршрута;
- применить текущий выбранный route template через существующий canonical reapply flow;
- получить новый verified snapshot;
- после этого снова выполнить readiness/preflight.

Если есть production fact:
- update action блокируется согласно IC-G01;
- факт не менять.

## Manager-facing text

### Case A — production fact отсутствует

Title:
`Не удалось проверить производственный маршрут`

Message:
`В этой техкарте используется старый маршрут, и система не может подтвердить, что в нём есть все необходимые операции.`

Action text:
`Обновите маршрут техкарты перед планированием производства.`

Primary action label:
`Обновить маршрут`

Не показывать manager-facing слова:
`snapshot`, `legacy`, `исторический снимок`, `verified/unverified`.

### Case B — уже есть начатые/завершённые операции

Title:
`Маршрут техкарты требует проверки`

Message:
`В техкарте есть выполненные или начатые операции, поэтому маршрут нельзя обновить автоматически.`

Action text:
`Проверьте маршрут вручную или обратитесь к ответственному за производство.`

Primary action label:
`Открыть маршрут`

## Debug Mode
В Debug Center оставить техническую информацию:
- code;
- category;
- snapshot ids;
- verification state;
- reason;
- protected fact nodes;
- technical action;
- data-flow trace.

Manager-facing UI не должен выводить эти термины вне Debug Mode.

## Diagnostics DTO
Использовать существующий единый diagnostic contract.

Добавить manager-facing presentation fields только если это соответствует текущей архитектуре:
- `user_title`
- `user_message`
- `fix_action_label`

Иначе выполнить mapping в существующем presentation layer.

Не создавать отдельную parallel diagnostic system.

## Existing data
Просканировать только записи, попадающие под IC-RS-01.

Разделить:
- без production fact;
- с in_progress/completed fact.

Не выполнять массовый reapply автоматически.

## Tests
Минимум:
- unverified route blocks schedule;
- unverified route blocks start;
- no fact + explicit `Обновить маршрут` -> verified route -> scheduling allowed;
- fact exists -> update route blocked;
- current template не используется silently для восстановления historical state;
- manager message contains no technical snapshot terminology;
- Debug Mode still exposes technical reason;
- IC-G01/G02 protection remains intact.

## Docs
Обновить:
- exact IC-RS-01 status;
- relevant `DF-ROUTE-SNAPSHOT`;
- `DF-SCHEDULER-CALENDAR`;
- `DF-DIAGNOSTICS`;
- `SL-PROJECT-MEMORY-v1` только если canonical semantics изменились;
- HTML twins sync once.

## Проверки
- targeted tests;
- backend full tests once at end;
- frontend only if contract/presentation touched;
- project check;
- DB integrity;
- git diff --check.

## Не делать
- IC-RS-05;
- 5/30-TK stress test;
- mass data repair;
- route architecture rewrite;
- commit/push.

## Отчёт
Не более 12 строк:
1. guard;
2. manager wording;
3. route refresh behavior;
4. fact-protected behavior;
5. existing data counts;
6. tests;
7. remaining P1 count.

Финальная строка:
`IC-RS01 ROUTE REVIEW GUARD READY`

## Результат — 2026-10-12

1. IC-RS01 выбран прямым owner task; прежний IC-FINAL policy blocker снят. Frozen version1 manifest в canonical AuditEvent фиксирует полный применённый состав/edges/groups, включая required node identity; read-only проверка не сравнивает с current template. Planning/mass queue/manual enqueue/start gate блокируют unverified route, old plan сохраняется. Missing route binding и malformed variant JSON также блокируются понятным diagnostic, без server error/echo arbitrary payload.
2. Manager: «Не удалось проверить производственный маршрут» + «Обновите маршрут техкарты перед планированием производства»/«Обновить маршрут»; с фактом — «Маршрут техкарты требует проверки», пояснение о начатых/выполненных операциях, «Проверьте маршрут вручную или обратитесь к ответственному за производство»/«Открыть маршрут». Нет snapshot/legacy/verified терминов вне Debug. Debug сохраняет code/category/IDs/state/reason/protected nodes/technical action/trace; malformed secret-bearing JSON не отражается.
3. Explicit «Обновить маршрут» использует existing onApplyRouting → canonical reapply, только без IC-G01 protected evidence; затем existing page refresh/readiness и explicit scheduling. Непроверенный маршрут с protected fact отклоняется до business/audit mutation. Идентичный verified reapply сохраняет факт/план/audit, не создаёт duplicate manifest. Manifest rollback атомарен. Никаких automatic refresh/backfill/data repair.
4. Local read-only audit:6 unverified routes; production/unknown4 с in_progress/completed fact +1 без; test/stress candidate1 с фактом.247 FK проверены,0 orphan references/0 scan SQL writes. Names не дают repair permission; production/VPS не сканировались. Evidence route-audit.json/db-integrity.json в logs/ic-rs01.
5. Tests:13 новых backend,3 manager frontend;335 targeted PASS;909 backend/394 frontend PASS; final project check10/10. Повторы full check потребовались после failures: isolated PostgreSQL audit sequence fixture, старые manual-enqueue fixtures без canonical apply, malformed diagnostic payload regression; причины исправлены, ошибки не маскировались. IC-G01/G02 regression suites и real local PostgreSQL concurrency PASS. HTML generators --check и git diff --check PASS.
6. UI: nearest PT-06 + DS-FEEDBACK-01, existing TechnicalCard process panel.16 isolated real RouteReviewNotice Chromium checks at1920/1600/1440/1280/1024/768/390/320px: обе формулировки/actions видимы, horizontal overflow/technical text отсутствуют; screenshot390/320 visually inspected. Live /production/tech-cards/6 and /121 не верифицированы после auth: local bootstrap login rejected, без обхода auth/route mutation; full-page visual acceptance не заявлена. Debug presentation existing tests PASS. Shell не изменялся.
7. Changed code: new route_verification.py; route_snapshot/technical_cards, Scheduler repository/engine, calendar lifecycle/enqueue, shared production diagnostics; route-review helper/notice, TechCardProcess and schedule presentation. Tests: new route verification/manager cases, existing invariant/health/runtime DAG/prerequisite/concurrency fixture updates. Models/API DTO/schema/migrations: нет изменений. DB records не исправлялись; только изолированные fixtures и локальная попытка login при UI verification.
8. Canonical docs: точный IC-RS-01 covered/P3; P0=0/P1=1/P2=13/P3=27. Data-flow updated: DF-ROUTE-SNAPSHOT,DF-SCHEDULER-CALENDAR,DF-DIAGNOSTICS. Memory/UI context/ADR-017/025 обновлены, roadmap/project structure/ERP отмечают только IC-RS01 owner review pending. **HTML twin synced**. Общая стадия/IC-FINAL не закрыты; IC-RS-05/IC-G06 не изменялись. Canonical diff: logs/ic-rs01/canonical-docs.diff; final git status сохранён. Commit/push нет.
9. Следующая integrity iteration — IC-RS-05/IC-G06 deletion guard; отдельно остаётся авторизованная full-page UI verification владельцем. Не начаты этой задачей.

IC-RS01 ROUTE REVIEW GUARD READY
