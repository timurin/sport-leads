# PC-03.6A — Operation Date Range Contract

## Контекст
Production Calendar уже работает как недельная очередь.
Текущий UI отображает назначения внутри отдельных дней, но утверждена новая визуальная концепция:

- строки = производственные стадии;
- колонки = дни;
- заказ отображается компактным стикером;
- длина стикера = длительность операции;
- цвет = стадия;
- клик = просмотр ТК;
- будущую механику очереди пока не менять.

Эта задача выполняется параллельно с Cursor PC-03.6B.

## Цель
Добавить backend-поддержку диапазона дат операции, чтобы frontend мог рисовать один заказ как полоску на несколько дней.

## Scope

### 1. Модель назначения
Проверить текущий `CalendarAssignment`.

Нужно поддержать:
- `planned_start_date`;
- `planned_end_date`.

Если сейчас есть только `planned_date`, сохранить обратную совместимость:
- существующее `planned_date` считать start date;
- для старых записей end date = start date.

Предпочтение:
- минимально изменить существующую модель;
- не создавать отдельную сущность operation span.

### 2. Семантика
Операция может длиться N календарных/рабочих дней.
На этом этапе backend НЕ рассчитывает длительность автоматически.

Диспетчер/интеграция задаёт:
- start date;
- end date.

Не строить auto-scheduling.

### 3. Validation
- end >= start;
- обе даты валидны;
- stage/reference сохраняются по текущему контракту;
- move/edit существующего назначения должен уметь менять обе даты.

### 4. Board API
Weekly board endpoint должен возвращать assignment с:
- id;
- reference / technical card;
- stage;
- `planned_start_date`;
- `planned_end_date`;
- note;
- position;
- остальные уже существующие поля.

Запись должна попадать в board period, если диапазон пересекает запрошенную неделю.

Пример:
- операция 03.10–08.10;
- неделя 05.10–11.10;
- assignment должен вернуться.

### 5. Create semantics
Не менять упрощённый create-flow PC-03.5:
- техническая карта;
- дата постановки;
- note;
- стартовая стадия `Подготовка к запуску`;
- auto-position.

Для initial create допустимо:
- start = planned_date;
- end = planned_date.

Не заставлять менеджера задавать end date при постановке заказа в очередь.

### 6. UI-E compatibility
Существующий диспетчерский edit contract можно расширить:
- planned_start_date;
- planned_end_date.

Не ломать редактирование stage/position/note.

### 7. Что НЕ делать
- не рассчитывать end date по мощности;
- не строить dependency engine;
- не двигать автоматически следующие стадии;
- не менять очередь;
- не менять frontend;
- не реализовывать Dashboard/Center;
- не делать commit/push/merge.

## Migration
Если нужна migration:
- минимальная;
- reversible;
- existing data backfill: end = start.

## Tests
Минимум:
- old single-day assignment;
- multi-day assignment;
- validation end < start;
- board range overlap;
- assignment crossing week boundary;
- create-flow keeps start=end;
- edit can change range;
- reload persistence.

## Проверки
- targeted backend tests;
- full backend tests;
- Alembic upgrade/downgrade/upgrade, если migration;
- project check;
- git diff --check.

## Acceptance
Frontend может получить assignment с диапазоном дат и безопасно отрисовать его одной полосой на несколько дней.

## Отчёт Codex
Указать:
- изменения модели;
- migration id, если есть;
- exact board/update contract;
- backward compatibility;
- tests/checks;
- подтвердить отсутствие frontend changes и commit/push.

## Повторное выполнение — 2026-10-06

PC-03.6A выполнен по прямому выбору владельца после PC-03.5A; PC-03 остаётся открытым. Существующий незакоммиченный WIP сохранён.

- Изменены существующие backend model/schema/service/repository; добавлены migration `x3y4z5a6b789`, 10 диапазонных тестов и [точный API-контракт](../architecture/production-calendar-date-range-pc-03-6a.md).
- `planned_start_date` — alias физического `planned_date`; `planned_end_date` — новая non-null дата с CHECK и backfill end=start. POST остаётся минимальным; PUT расширен диапазоном; board использует включительное пересечение периода. Миграционный downgrade удаляет end date, сохраняя записи/start.
- 71 targeted tests; 539 full backend tests passed. `scripts/check_project.py`: PROJECT CHECK PASSED, 10/10 (включая OpenAPI, Alembic, frontend lint/typecheck/tests/build, Compose). Первый запуск до применения миграции/исправления импорта нового теста не прошёл; причины устранены, итоговый check успешен.
- Локальный PostgreSQL `127.0.0.1:5432`: upgrade/downgrade/upgrade, Alembic check и отдельный transactional migration/backfill legacy record прошли. VPS не использовался.
- `git diff --check` passed. Существующие deprecation/pytest-cache warnings не исправлялись в этой задаче. Новых P0/P1 не выявлено; P2/P3 вне объёма.
- Roadmap, project structure и ERP-check обновлены; HTML twin synced, включая v1.1 и генерируемый production-calendar roadmap.
- Frontend changes этой итерации отсутствуют; commit/push/merge не выполнялись. Следующая рекомендуемая отдельная итерация — PC-03.6B frontend integration/visual review; автоматически не начата.
