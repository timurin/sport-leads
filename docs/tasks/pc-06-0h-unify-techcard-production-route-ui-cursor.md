# PC-06.0H — Unify TechnicalCard Production Route UI

## Исполнитель
Cursor

## Цель
Объединить два текущих блока маршрута в техкарте в один единый блок `План производства / Маршрут`.

Сейчас в карточке есть две параллельные проекции одного маршрута:
- верхняя компактная схема по цехам;
- нижняя вкладка `Маршрут 7` с отдельными карточками операций и собственными действиями.

Это создаёт дублирование UI, повторение статусов и риск расхождения логики.

## Основной принцип
Одна техкарта должна иметь один визуальный production-route блок.

Источник данных:
`route snapshot + production state + persisted planning summary/read model`

Frontend не должен держать две независимые route projections.

## 1. Удалить дублирующий нижний маршрут
Убрать отдельную вкладку/секцию:
`Маршрут 7`

Не оставлять второй полноценный route renderer в другом месте страницы.

Количество операций показывать внутри единого блока, например:
`Маршрут · 7 операций`

## 2. Единый блок
Секция:
`План производства`

В шапке показывать:
- название маршрута;
- количество операций;
- ETA;
- дата отгрузки;
- запас дней;
- риск / план актуален / требует пересчёта;
- `Изменить даты`;
- `Пересчитать план`.

Не делать отдельную большую боковую форму дат постоянно открытой.
Редактирование дат открывать только по действию `Изменить даты`.

## 3. Горизонтальный маршрут по цехам
Показывать компактную последовательность:

`Дизайн → Печать → Раскрой → Пошив → Контроль качества`

Каждый workshop-card содержит:
- название цеха;
- workshop status;
- дочерние операции;
- operation status;
- плановую дату / диапазон дат;
- назначенное оборудование, если есть;
- issue/warning indicator, если есть.

Пример:

**Печать · В работе**
- Сублимационная печать · В работе · 17.10
- Термоперенос · Запланирована · 18.10
- Epson SC-F9200

## 4. Раскрытие деталей
По клику на workshop-card раскрывать подробности внутри того же блока:
- operation;
- state;
- planned date;
- started_at/completed_at;
- equipment/work center;
- executor, если contract уже отдаёт;
- diagnostic/readiness issue;
- plan/fact data, если уже есть.

Не создавать вторую отдельную секцию ниже.

## 5. Убрать управление production fact из TechnicalCard
Удалить из карточки техкарты действия:
- `Начать`;
- `Завершить`;
- любые другие кнопки, которые напрямую двигают production fact.

Факт должен меняться только через operator Kanban.

TechnicalCard остаётся read-only по production fact:
- `Ожидает`;
- `В работе`;
- `Завершено`;
- timestamps;
- equipment;
- executor.

Не менять backend transition endpoints.

## 6. Сборка
Assembly / `Пошив базовой футболки` не показывать как ещё один route stage, если это не snapshot operation.

Сборку отображать отдельной metadata строкой в шапке production block:
`Сборка: Пошив футболки`

Не смешивать assembly model и route progression.

## 7. Planning health integration
Если уже доступны данные:
- ETA;
- shipping date;
- slack;
- risk;
- stale/replan state;

показывать их в шапке единого блока.

Не рассчитывать это на frontend.

Если после будущего PC-06.3F появятся дополнительные поля overdue/risk, компонент должен быть готов принять их без нового redesign.

## 8. Readiness / issues
Если workshop/operation имеет blocking issue:
- компактный warning badge на соответствующем workshop;
- раскрытие показывает manager-facing explanation;
- fix action использует существующий readiness/diagnostic contract.

Не дублировать readiness checker полностью внутри route block.

## 9. Adaptive UX
Desktop:
- horizontal route;
- cards компактные;
- без огромных пустых областей.

Tablet:
- перенос карточек на вторую строку.

Mobile:
- vertical stepper / stacked cards;
- текущий этап виден сразу;
- details раскрываются inline.

## 10. Визуальные состояния
Минимум:
- completed;
- in_progress;
- waiting/current;
- planned;
- blocked/warning.

Не использовать workshop color как замену operation state.

## 11. Browser acceptance
Проверить минимум:
1. draft/planned ТК;
2. in_progress ТК;
3. completed ТК;
4. ТК с двумя operations внутри одного workshop;
5. mobile 390px;
6. desktop.

Проверить, что:
- route отображается один раз;
- statuses согласованы;
- assembly не выглядит как отдельный stage;
- production fact нельзя менять из TechnicalCard;
- planning summary читается без открытия формы дат.

## 12. Tests
Минимум:
- single route projection rendered;
- lower duplicate route section removed;
- workshop grouping correct;
- operation statuses preserved;
- assembly separated from route;
- no start/complete controls in TechnicalCard;
- date editor opens on demand;
- completed/in_progress/planned states;
- mobile layout.

Проверки:
- targeted frontend tests;
- eslint;
- tsc;
- production build;
- `python scripts/check_project.py`;
- git diff --check.

## Не делать
- backend production changes;
- Scheduler changes;
- Kanban/Queue changes;
- route snapshot semantics changes;
- migrations;
- commit/push.

## Acceptance
Готово, если:
1. в TechnicalCard остаётся только один production-route UI;
2. route, planning summary и operation states читаются в одном блоке;
3. duplicate route section удалена;
4. production fact нельзя двигать из карточки;
5. assembly не смешивается с route stages;
6. layout компактнее и понятнее текущего;
7. production core не изменён.

Финальная строка:

`PC-06.0H TECHCARD PRODUCTION ROUTE UI UNIFIED`
