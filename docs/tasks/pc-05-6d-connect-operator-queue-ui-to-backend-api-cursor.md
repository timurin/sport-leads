# PC-05.6D — Connect Operator Queue UI to Backend API

## Исполнитель
Cursor

## Зависимость
После PC-05.6C.

## Цель
Подключить вкладку `Очередь` к backend API очереди участка, preview reorder и apply reorder. Frontend больше не должен симулировать сохранённый порядок локально.

## Context
Использовать:
- `SL-PROJECT-MEMORY-v1`
- `SL-UI-CONTEXT-v1`
- только релевантные frontend files
- OpenAPI/contracts PC-05.6C

Без repo-wide scan.

## 1. Queue source of truth
Загружать порядок только с backend GET queue.

Показывать:
- позицию;
- № ТК;
- модель;
- количество;
- участок;
- плановое начало/окончание;
- ETA / shipping risk, если приходит;
- read-only/protected.

## 2. Local draft reorder
Стрелки ↑ / ↓ меняют только draft до preview.

Ограничения:
- один workshop;
- только waiting/unstarted;
- protected/read_only нельзя двигать.

Не отправлять apply после каждого клика.

## 3. Backend preview
Кнопка:
`Предпросмотр`

Вызвать preview API PC-05.6C.

Показать:
- ТК;
- было → стало;
- old/new planned start;
- old/new planned end;
- изменение ETA;
- изменение риска срока;
- downstream affected;
- warnings/blockers.

Если `can_apply=false`:
- `Применить очередь` disabled;
- показать понятную причину.

## 4. Apply
Кнопка:
`Применить очередь`

Передать:
- workshop;
- ordered ids;
- revision/fingerprint из актуального preview.

После успеха:
- принять серверную очередь как source of truth;
- очистить draft;
- revalidate Calendar-related data;
- показать подтверждение.

Не менять Kanban/client-side fact.

## 5. Stale preview
Для:
`409 workshop_queue_changed`

Показать:
`Очередь уже изменилась. Обновите данные и повторите изменение.`

Кнопка:
`Обновить очередь`

Старый preview/apply state очистить.

## 6. Error mapping
Manager-friendly тексты для:
- `queue_item_not_waiting`
- `queue_cross_workshop_reorder`
- `queue_contains_protected_fact`
- `queue_replan_failed`

Technical details — только через Debug Mode.

## 7. Permissions
Использовать canonical permission backend/API.

Не использовать `technical_cards.create` как surrogate, если backend PC-05.6C определил отдельное право.

Если permission contract отсутствует:
зафиксировать точный AUTH CONTRACT GAP.

## 8. Kanban
DnD не возвращать.

После reorder:
- current_workshop не меняется;
- lifecycle status не меняется;
- Kanban card не перемещается.

## 9. Calendar
После apply weekly Calendar при refresh/revalidate должен показать новые плановые даты.

Никакого frontend-side replanning.

## 10. UX states
Добавить:
- loading;
- preview loading;
- apply loading;
- empty state;
- API error;
- stale revision;
- success state;
- защита от double apply.

## Tests
Минимум:
- GET renders server order;
- arrows change draft only;
- preview calls backend;
- apply disabled до successful preview;
- apply sends revision/fingerprint;
- success replaces draft with server order;
- stale 409 handled;
- protected row cannot move;
- Kanban unaffected;
- Calendar revalidate;
- permissions.

Full:
- frontend tests;
- eslint;
- tsc;
- production build;
- project check;
- git diff --check.

## Не менять
- backend;
- Scheduler algorithms;
- Kanban semantics;
- Demand/Capacity;
- production facts;
- commit/push.

## Acceptance
Пользователь может:
1. открыть очередь;
2. изменить порядок ожидающих ТК;
3. увидеть серверный preview;
4. применить порядок;
5. после refresh увидеть тот же серверный порядок;
6. увидеть обновлённый Calendar;
7. не изменить Kanban/fact.

Финальная строка:
`PC-05.6D OPERATOR QUEUE UI CONNECTED TO BACKEND`
