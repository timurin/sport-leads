# BUG-01 — Дата отгрузки ТК → План производства (Codex)

## Цель
При создании/изменении ТК обязательная «Дата отгрузки» должна надёжно сохраняться и отображаться как одно и то же значение во всех потребителях плана производства, в том числе после reload. Сейчас владелец сообщает о потере даты между созданием ТК и планом.

## Источник истины
Прочитай `AGENTS.md`, `docs/architecture/SL-PROJECT-MEMORY-v1.md` (PM-PLAN/PM-SOT), DF-SCHEDULER-CALENDAR и код `TechnicalCard.shipping_date`, create/update API, `technical_card_planning.py`, `persisted_plan.py`, PlanningHealth/Calendar DTO. Не создавать второго поля/хранилища даты.

## Работа
1. Воспроизвести расхождение на реальном пути POST ТК → GET детали → GET план/календарь (и PATCH даты → повторный GET); найти место потери: форма/payload, backend mapping, сериализация или stale read-model.
2. Исправить минимально необходимый backend/DTO контракт. Различать `shipping_date` (обещанная дата отгрузки) и `planned_completion_date`/ETA; не подставлять одно вместо другого. Если backend уже корректен, **не менять его**: зафиксировать подтверждённый frontend payload gap для Cursor и перейти к нему.
3. Проверить standalone ТК и связанную с SalesOrder ТК; пустые/невалидные даты — по существующим правилам, без фиктивных значений.
4. Добавить точечные regression tests: create+reload, edit+reload, сохранённый план, late/slack, отсутствие изменения production fact и protected планов. Не вызывать replan при простом GET.

## Границы
Не переписывать Scheduler, не добавлять миграцию без доказанной необходимости, не менять контракты защиты факта/маршрута. Без записи в production DB; локальные тесты. Не выполнять commit/push/deploy до итоговой проверки пакета.

## Готово
Причина подтверждена; одно поле `shipping_date` используется во всех чтениях; тесты и `PROJECT CHECK 10/10` успешны; отчёт с изменёнными файлами и точными API-проверками. При выявленном frontend-дефекте передать конкретное имя поля/payload Cursor.

## Выполнение Codex — 2026-10-20

Причина подтверждена: frontend payload gap, backend исправления не требует.
`frontend/components/production/tech-cards-workspace.tsx` показывает обязательную
«Дату отгрузки», но передаёт её как `desiredDate` в
`createStandaloneTechnicalCardAction`. В
`frontend/app/(workspace)/production/tech-cards/tech-card-actions.ts` значение
сериализуется только в `desired_date`; тип `StandaloneTechnicalCardCreateInput`
в `frontend/lib/sales/order-tech-cards-api.ts` вообще не содержит `shipping_date`.
Backend `TechnicalCardStandaloneCreate` принимает отдельное `shipping_date`,
а `standalone_technical_cards.py` сохраняет именно `payload.shipping_date`.
Автокопирование `desired_date` запрещено существующим regression contract
`test_standalone_create_defaults_do_not_copy_desired_date`.

### Передача Cursor

В рамках frontend-исправления провести введённую «Дату отгрузки» через форму,
server action и тип API до `shipping_date` в POST `/technical-cards/standalone`.
Сохранить обязательный `desired_date` существующего order-group контракта;
не заменять его другим полем и не вводить backend fallback. Например, при
вводе `2026-11-21` форма должна явно отправить `shipping_date: "2026-11-21"`
наряду с существующими полями. Изменение заказа и изменение даты планирования
также различать: PATCH `/{id}/desired-date` не заменяет PATCH `/{id}/planning`
с телом `{"shipping_date":"2026-11-25"}`. Backend не подставляет ETA вместо
shipping date. Не выполнять backfill существующих ТК по `desired_date`:
историческая обещанная дата без подтверждения владельца неизвестна.

### Воспроизведение и регрессии

Новый `backend/tests/test_shipping_date_bug_01.py`:

- POST `/technical-cards/standalone` с `desired_date=2026-11-20` без
  `shipping_date`: ответ, повторный GET `/technical-cards/{id}` и GET
  `/technical-cards/{id}/planning-health` возвращают `shipping_date=null`.
- Тот же POST с явным `shipping_date=2026-11-21`: detail,
  `planning_summary.shipping_date` и Planning Health после нового запроса
  возвращают `2026-11-21`; ETA без сохранённого плана остаётся null.
- PATCH `/technical-cards/{id}/planning` с датой `2026-11-25`, затем с null:
  повторные GET согласованы, `desired_date=2026-11-20` не меняется.
- Пустая строка, `2026-02-30`, `not-a-date`: POST и PATCH возвращают 422.
- Сохранённый план проверен в новых DB sessions для standalone и связанной
  с SalesOrder ТК: shipping edit меняет slack/risk, не меняет ETA,
  CalendarAssignment/Allocation, StageResult и AuditEvent. Calendar board
  сохраняет существующий standalone scope (связанные ТК туда не добавлены).
- Повторные чтения persisted plan/Planning Health/Calendar не выполняют SQL
  INSERT/UPDATE/DELETE. На плане с production fact изменение shipping date
  отклоняется существующим PlanLinkageConflict; rollback сохраняет все строки.
  Защиту не ослабляли, автоматический replan не добавляли.

Целевые проверки: 30 passed (BUG-01 + Calendar consistency + Planning Health).
Полная проверка `python scripts/check_project.py`: PROJECT CHECK PASSED, 10/10;
1051 backend tests passed, 490 frontend tests passed, lint/tsc/build,
OpenAPI/Alembic/Compose успешны. Лог: `logs/bug-01-project-check.log` (ignored).
PowerShell-обёртка с перенаправлением `*>` вернула 1 из-за INFO в native stderr
(`NativeCommandError`); итог самого check_project — 10 успешных, 0 ошибок.
Повторный полный прогон не выполнялся. `git diff --check` успешен.
Первый запуск через старую `.venv` не собрал тесты из-за отсутствующего argon2;
использован штатный `python`, где зависимости доступны. Продуктовый код,
модели, DTO, миграции и production DB не изменялись.

Roadmap: changes not required. Project structure checklist: changes not required.
ERP-check: changes not required. HTML twins в этой задаче не затронуты;
существующие изменения DF/HTML и capacity UI другого автора сохранены.
Project memory: no changes required. Data-flow: no changes required.
Frontend gap остаётся открытым до исправления Cursor; готовность всего BUG-01
не объявляется. Следующая итерация — указанное frontend-исправление и проверка
создания ТК с reload. Commit/push/deploy не выполнялись.
Новых P0/P1 не внесено; исходный дефект формы остаётся открытым. Отдельные
P2/P3 не исследовались. Выбран только явно назначенный BUG-01, перехода стадии нет.
Diff roadmap/project-structure/ERP-check и их HTML twins отсутствует.
