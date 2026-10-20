# PC-06.3C — Connect Manual Planning UI to Replan Preview / Apply API

## Исполнитель
Cursor

## Зависимость
После PC-06.3B.

## Цель
Подключить существующий master-detail UI ручного планирования к canonical backend preview/apply contract.

Не менять backend semantics.
Не считать downstream/ETA/capacity на frontend.

## Backend contract

### Preview
`POST /production-calendar/manual-planning/preview`

Payload:
- `technical_card_id`
- `snapshot_node_id`
- `target_date`
- `mode`: `single | downstream`
- `revision` — optional при первом preview

Response:
- `apply_allowed`
- `revision`
- `preview_fingerprint`
- affected operations / allocations
- old/new ETA
- old/new slack
- risk
- warnings
- blockers

### Apply
`POST /production-calendar/manual-planning/apply`

Payload:
- тот же request
- `revision`
- `preview_fingerprint`

Response:
- `preview`
- `planning_summary`
- `audit_event_id`

### Conflict codes
- `manual_replan_changed`
- `manual_replan_protected`
- `manual_replan_dependency`
- `manual_replan_capacity`
- `manual_replan_blocked`

Использовать canonical contract из:
`docs/architecture/manual-planning-route-replan-pc-06-3b.md`

## 1. Убрать локальный fake-preview
Существующий UI PC-06.3A больше не должен показывать текст, что сервер не считает downstream и ETA.
Preview полностью приходит с backend.

Frontend не рассчитывает:
- downstream;
- dates;
- ETA;
- slack;
- risk;
- capacity.

## 2. Режим переноса
Для future operation показать переключатель:
- `Только эту операцию`
- `Эту и последующие`

Mapping:
- single
- downstream

Если backend preview возвращает blocker для `single`, показать manager-friendly reason и предложить `Эту и последующие`, но не переключать mode автоматически.

## 3. Preview UX
После выбора operation + target date + mode кнопка `Предпросмотр`.

После ответа показать:

### Изменение
`Раскрой: 16.10 → 17.10`

### Последующие операции
Список affected nodes:
- Пошив 17.10 → 18.10
- ВТО 18.10 → 19.10
- Упаковка 19.10 → 20.10

### Итог
- ETA: old → new
- Отгрузка
- Запас: old → new
- Риск

### Capacity / warnings
Показать backend warnings/blockers.
Не показывать raw technical codes как основной текст.

## 4. Apply UX
`Применить перенос` активна только если:
- preview получен;
- `apply_allowed=true`;
- форма после preview не менялась;
- revision/fingerprint актуальны локально.

Если пользователь меняет target date, mode или selected operation — preview сбрасывается и Apply блокируется.

## 5. Stale / conflicts
### `manual_replan_changed`
`План был изменён после предпросмотра. Выполните предпросмотр ещё раз.`
Сбросить preview tokens.

### `manual_replan_protected`
`Операцию уже нельзя переносить: работа начата или завершена.`

### `manual_replan_dependency`
`Выбранная дата нарушает последовательность маршрута.`

### `manual_replan_capacity`
`На выбранную дату недостаточно мощности.`

### `manual_replan_blocked`
Показать manager-friendly backend message.

Не делать optimistic apply.

## 6. После успешного apply
Обновить:
- маршрут выбранной ТК;
- даты operations;
- persisted ETA/planning summary;
- список ТК слева;
- Calendar cache/data;
- capacity cache, если текущий frontend pattern это поддерживает.

Не менять:
- Kanban fact;
- Queue fact;
- current workshop.

Показать короткое подтверждение: `План обновлён`.

## 7. Protected operations
Completed / in_progress:
- без редактора даты;
- locked state;
- label: `Фактическая операция — перенос недоступен`.

Frontend guard только UX; backend authority.

## 8. Mobile
На 390px:
- список TK → detail;
- editor/preview в одну колонку;
- affected operations читаемы;
- без horizontal scroll.

## 9. E2E
Использовать planning-only test card 162, если safe.

### downstream
1. выбрать future operation;
2. target date;
3. `Эту и последующие`;
4. Preview;
5. увидеть downstream + ETA/slack/risk;
6. Apply;
7. route dates обновлены;
8. Calendar показывает новый план;
9. Kanban/current workshop не изменились;
10. Queue fact не изменился.

### single
Проверить safe case:
- valid single -> apply;
или
- dependency blocker -> корректный UI.

### stale
После preview воспроизвести stale revision тестом/API fixture:
- Apply -> 409;
- UI требует новый preview.

## 10. Tests
Минимум:
- preview request payload;
- mode mapping;
- preview rendering;
- affected nodes rendering;
- ETA/slack/risk;
- Apply disabled until preview;
- form change invalidates preview;
- conflict mappings;
- successful apply refreshes data;
- protected operation locked;
- no frontend planning math.

Проверки:
- targeted frontend tests;
- eslint;
- tsc;
- production build;
- `python scripts/check_project.py`;
- git diff --check.

## Не делать
- backend changes;
- Scheduler refactor;
- Calendar redesign;
- Kanban/Queue changes;
- capacities redesign;
- production facts;
- commit/push.

## Acceptance
Готово, если менеджер может:
1. выбрать future operation;
2. выбрать `single` или `downstream`;
3. получить реальный server preview;
4. увидеть последствия по маршруту, ETA и риску;
5. безопасно применить replan;
6. получить понятную ошибку при stale/dependency/capacity blocker;
7. не затронуть production fact.

Финальная строка:

`PC-06.3C MANUAL PLANNING UI CONNECTED TO REPLAN API`
