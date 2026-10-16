# PC-05.13 — Stabilize Three P1 Production Invariants

## Исполнитель
Cursor

## Цель
Закрыть только три P1 из UX-прогона `UX-OP-001-1`.

Не делать новый архитектурный рефакторинг.
Не чинить P2/P3.
После исправлений провести один новый E2E до подтверждения этих трёх инвариантов.

## P1-1 — Material gate только текущей операции

### Проблема
На этапе `Дизайн` кнопка `Завершить` требует расход материалов Печати.

### Требование
Material fact gate проверяет только материалы текущего snapshot node / текущей операции.

Не агрегировать материалы:
- всего workshop;
- всего route;
- будущих операций.

### Проверки
- `Дизайн` завершается без материалов Печати.
- `Сублимационная печать` требует только свои материалы.
- `Термоперенос` не требует материалы Сублимации, если у него нет собственных.
- операция без material requirements завершается напрямую.
- существующий material fact modal продолжает работать.

## P1-2 — Один canonical quantity

### Проблема
В UX-прогоне:
- форма создания: 4;
- номер карточки: `/4`;
- персонализация: 1 строка;
- Kanban/участок: 1.000.

### Требование
Canonical source:
`TechnicalCard.quantity`

Правила:
- quantity из создания сохраняется как canonical;
- personalization не переписывает quantity автоматически;
- если сумма personalization != quantity — warning/validation;
- production quantity остаётся TechnicalCard.quantity;
- Scheduler/Demand/Kanban/Queue читают canonical quantity;
- display quantity везде одинаковое.

### Проверки
Для quantity=4:
- карточка = 4;
- Kanban = 4;
- Queue = 4;
- Scheduler/Demand = 4;
- 1 строка personalization не превращает quantity в 1.

## P1-3 — Запуск ТК не начинает первый участок

### Проблема
После `Запустить ТК` карта сразу становится `Дизайн / В работе`, а Kanban показывает `Завершить`.

### Требование
`Запустить ТК` означает только готовность к производству:
- lifecycle = planned/production-ready;
- current workshop определяется resolver;
- workshop state = waiting;
- Queue содержит ТК;
- Kanban показывает `Принять в работу`.

Не должно происходить:
- запись `started_at`;
- stage_result -> `in_progress`;
- появление `Завершить`.

Только `Принять в работу` создаёт start fact.

### Проверки
После `Запустить ТК`:
- не draft;
- не in_progress только из-за запуска;
- current workshop = первый ready;
- Queue содержит ТК;
- Kanban = waiting;
- button = `Принять в работу`;
- `started_at` пустой.

После `Принять в работу`:
- stage = in_progress;
- `started_at` записан;
- Queue не содержит ТК;
- Kanban = `В работе`;
- button = `Завершить`.

## Context
Использовать:
- `SL-PROJECT-MEMORY-v1`
- `DF-KANBAN-FACT`
- `DF-TK-OPERATION-VOLUME`
- relevant invariant docs
- только targeted files/symbols

Без repo-wide scan.

Если code contradicts docs:
1. установить truth минимальным targeted inspection;
2. исправить;
3. обновить только затронутые memory/data-flow/invariant sections.

## Не исправлять
Оставить как known P2/P3:
- forecast после reload;
- поиск модели;
- дублирование даты сдачи/отгрузки;
- route diagram vs Kanban;
- duplicate controls card vs Kanban;
- delayed Kanban refresh;
- Calendar statuses нескольких operations;
- hydration warning.

## Regression E2E
Создать новую ТК через UI:

Prefix:
`STAB-P1-`

SKU:
`201.2`

Quantity:
`4`

Personalization:
- сначала 1 строка;
- затем довести до 4;
- quantity всё время должна оставаться 4.

Пройти:
1. create;
2. model;
3. assembly;
4. route;
5. plan;
6. `Запустить ТК`;
7. подтвердить waiting;
8. проверить Queue;
9. Kanban -> `Принять в работу`;
10. Kanban -> `Завершить Дизайн`;
11. material modal на Дизайне НЕ появляется;
12. next workshop = Печать;
13. начать Печать;
14. завершить первую print operation;
15. material modal показывает только материалы этой операции.

Остановиться после подтверждения трёх P1.

## Acceptance
Готово, если:
1. Дизайн не требует материалы Печати.
2. quantity=4 остаётся 4 во всех production projections.
3. `Запустить ТК` создаёт waiting, не in_progress.
4. `Принять в работу` — единственный start fact.
5. Material modal работает там, где действительно нужен.
6. Новых P0/P1 нет.
7. P2/P3 не трогались.

## Проверки
- targeted backend/frontend tests;
- eslint;
- tsc;
- build;
- project check;
- relevant DB integrity;
- git diff --check.

Commit/push не выполнять.

Финальная строка:

`PC-05.13 THREE P1 PRODUCTION INVARIANTS STABILIZED`
