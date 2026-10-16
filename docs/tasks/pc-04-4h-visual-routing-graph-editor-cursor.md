# PC-04.4H — Visual Routing Graph Editor

## Исполнитель
Cursor

## Контекст

PC-04.4G закрыта.

Backend теперь использует единый routing runtime:

`Routing template`
→ `TechnicalCard immutable route snapshot`
→
- Kanban = текущий Workshop/цех;
- Scheduler/Calendar = дочерние TechOperation;
- dependencies = snapshot DAG.

Источник шаблона:
`/settings/catalogs/routings`

Нужно заменить текущий табличный редактор маршрута на понятный визуальный конструктор.

Важно:
UI НЕ создаёт отдельную calendar-routing модель.
Редактор работает только с backend graph contract Routing template.

---

# Цель

Сделать визуальный DnD-конструктор производственного маршрута:

- родительские блоки = Цеха;
- дочерние блоки = Технологические операции;
- порядок по умолчанию последовательный;
- параллельность создаётся только явно;
- зависимости видны визуально;
- graph валидируется до сохранения.

---

# 1. Маршрут страницы

Основной маршрут:

`/settings/catalogs/routings`

Существующий список маршрутов сохранить.

Клик по маршруту:
- либо открывает detail/editor;
- либо большую modal/workspace;
- использовать текущий проектный паттерн.

Не создавать отдельный Calendar route editor.

---

# 2. Основной layout редактора

Рекомендуемая структура:

## Header
- название маршрута;
- код;
- активен;
- `Сохранить`;
- `Закрыть`;
- статус `Есть несохранённые изменения`;
- validation status.

## Левая панель
Каталог:
- Цеха;
- Технологические операции.

Поиск.

## Canvas
Визуальная схема маршрута.

## Правая панель / inspector
Настройки выбранного:
- цеха;
- операции;
- зависимости.

---

# 3. Родительский блок = Цех

Цех отображается как крупный контейнер.

Пример:

┌─────────────────────────────┐
│ ПЕЧАТЬ                      │
│ 3 операции                  │
│                             │
│ [Подготовка макетов]        │
│       ↓                     │
│ [Сублимационная печать]     │
│       ↓                     │
│ [Каландрирование]           │
└─────────────────────────────┘

Следующий цех:

┌─────────────────────────────┐
│ РАСКРОЙ                     │
│ [Ручной раскрой]            │
└─────────────────────────────┘

Цех не является отдельной TechOperation.

---

# 4. DnD цехов

Пользователь может:
- менять порядок цехов drag-and-drop;
- добавлять существующий цех;
- удалять цех из маршрута.

При удалении:
- confirmation;
- показать сколько операций внутри будет удалено из template;
- не удалять сам Workshop из справочника.

По умолчанию порядок между цехами последовательный.

---

# 5. DnD операций

Внутри Workshop:

- добавить существующую TechOperation;
- изменить порядок;
- перетащить операцию в другой Workshop;
- удалить операцию из маршрута.

Удаление из маршрута НЕ удаляет TechOperation из каталога.

Карточка операции показывает минимум:
- название;
- code;
- readiness status;
- resource/workcenter summary при наличии.

---

# 6. Последовательность по умолчанию

Если пользователь просто разместил:

A
B
C

backend contract должен получить:
A -> B
B -> C

Не требовать ручного соединения каждой обычной последовательности.

UI должен явно показывать default arrows.

---

# 7. Explicit parallel mode

Параллельность не должна возникать случайно.

Добавить явное действие:

`Создать параллельную ветку`

или equivalent UX.

Пример:

        ┌─ B ─┐
A ──────┤     ├─ D
        └─ C ─┘

Пользователь должен понимать:
- B и C могут стартовать после A;
- D ждёт завершения B и C.

---

# 8. Dependencies

Использовать backend DAG contract PC-04.4G.

Редактор должен уметь:
- создать dependency;
- удалить dependency;
- показать predecessor/successor;
- показать join;
- показать parallel branch.

Не создавать calendar-specific edges.

---

# 9. Graph interaction

Рекомендуемые действия:

На operation card:
- drag handle;
- `⋯`;
- `Добавить после`;
- `Создать параллельную ветку`;
- `Зависимости`;
- `Удалить из маршрута`.

На Workshop:
- drag handle;
- `+ Операция`;
- `⋯`;
- `Удалить из маршрута`.

---

# 10. Inspector операции

При выборе operation:

Показывать read-only summary:
- TechOperation;
- Workshop;
- calculation mode;
- resource;
- WorkCenters;
- readiness.

Действие:
`Настроить операцию`

→ deep-link:
`/settings/catalogs/tech-operations?operation=<id>`

Не дублировать editor мощности внутри Routing.

---

# 11. Readiness в graph

Каждая operation card должна иметь понятный индикатор:

- `Готово`
- `Требует настройки`
- `Без расчёта мощности`

Если `Требует настройки`:
tooltip/list:
- нет ресурса;
- нет рабочего времени;
- нет оборудования;
- не настроено правило потребности;
и т.п.

Использовать существующие данные.
Не вычислять Demand сложным frontend-кодом.

---

# 12. Validation

До сохранения выполнять frontend validation + backend DAG validation.

Минимальные ошибки:

- маршрут пуст;
- цех без операций;
- операция без TechOperation;
- cycle;
- orphan edge;
- dependency на отсутствующий node;
- duplicate node;
- invalid cross-route reference.

Ошибки показывать:
- в header summary;
- на конкретном node.

---

# 13. Save model

Сохранять через существующий Routing graph API.

Не делать серию хаотичных PATCH на каждый drag, если backend поддерживает atomic graph save.

Предпочтительно:
- локальный draft;
- `Сохранить`;
- один validated save.

После save:
- backend DAG validator;
- success state;
- dirty=false.

---

# 14. Dirty state

При любом:
- move;
- add;
- delete;
- dependency change

ставить dirty state.

Закрытие:
- X;
- navigation;
- route change

при dirty → confirmation.

---

# 15. Snapshot warning

В editor добавить спокойное пояснение:

`Изменения маршрута применяются только к новым техкартам или при явном повторном применении маршрута. Уже созданные техкарты сохраняют свой снимок.`

Это критично после PC-04.4G.

---

# 16. Existing TechnicalCard

Не добавлять automatic propagation.

Не давать ложную кнопку:
`Обновить все текущие ТК`.

Если существует explicit apply route action для standalone TK:
не менять её здесь.

---

# 17. Kanban preview

Добавить компактный preview:

**Kanban**
`Печать → Раскрой → Пошив → Контроль качества`

Строится только из Workshop order.

Не отдельный editor.

---

# 18. Calendar preview

Добавить компактный read-only preview:

**Календарь**
- Подготовка макетов
- Сублимационная печать
- Каландрирование
- Ручной раскрой
- Пошив
- ВТО
- Упаковка

При parallel branch показать branch визуально.

Цель:
пользователь сразу видит:
- что увидит Kanban;
- что будет планировать Calendar.

---

# 19. Zoom / canvas

Если операций много:
- zoom in/out;
- fit-to-screen;
- pan.

Не усложнять mini-map в первой версии.

---

# 20. Responsive

Primary:
- 1440;
- 1280;
- 1024.

Для mobile:
можно fallback в вертикальный список,
DnD может быть ограничен.

Не ломать existing responsive contract проекта.

---

# 21. Keyboard / accessibility

Минимум:
- modal/drawer accessible;
- Escape;
- focus;
- buttons have labels;
- drag handles distinguishable.

Если используем DnD library:
обеспечить keyboard move если библиотека поддерживает.

---

# 22. Не использовать Canvas product

Речь о UI canvas внутри приложения.
Не связано с ChatGPT Canvas.

---

# 23. Не менять backend без причины

Если backend graph API недостаточно:
- оформить `BACKEND GAP`;
- указать exact missing endpoint/field;
- не создавать client-only shadow graph.

---

# 24. Не менять runtime

Не менять:
- Scheduler;
- snapshot semantics;
- Kanban transition;
- Demand;
- Capacity;
- WorkCenter;
- CalendarAllocation.

Это frontend/editor task.

---

# 25. VIS-STRESS

Не удалять и не пересоздавать:
`VIS-STRESS-001…030`.

Stress-test не запускать.

---

# 26. Tests

Минимум:

## Editor
- load graph;
- add workshop;
- reorder workshop;
- add operation;
- reorder operation;
- move operation between workshops;
- remove operation;
- dirty state.

## Dependencies
- sequential default;
- create parallel;
- join;
- delete edge;
- cycle rejected.

## Save
- atomic save;
- backend validation error;
- save success;
- draft preserved on failure.

## UX
- readiness indicators;
- Kanban preview;
- Calendar preview;
- snapshot warning;
- deep-link TechOperation.

## Regression
- routes list;
- existing routing edit;
- readonly graph API;
- navigation.

Full:
- frontend tests;
- eslint;
- tsc;
- production build;
- project check;
- git diff --check.

---

# 27. Acceptance

PC-04.4H готова, если администратор может:

1. открыть существующий Routing;
2. видеть цеха как parent blocks;
3. видеть TechOperation как child blocks;
4. менять порядок DnD;
5. переносить operation между цехами;
6. создавать explicit parallel branch;
7. видеть dependency graph;
8. получить validation до save;
9. сохранить graph через backend Routing API;
10. видеть Kanban preview по Workshop;
11. видеть Calendar preview по TechOperation;
12. понимать snapshot rule;
13. не создавать отдельную calendar routing logic.

---

# 28. Отчёт Cursor

Указать:

- выбранную DnD/library implementation;
- изменённые routes/components;
- graph API usage;
- save contract;
- workshop DnD;
- operation DnD;
- parallel dependency UX;
- validation;
- previews;
- snapshot warning;
- backend gaps;
- tests/checks;
- backend unchanged;
- VIS-STRESS untouched;
- commit/push не выполнялись.

Финальная строка:

`PC-04.4H VISUAL ROUTING GRAPH EDITOR READY FOR OWNER REVIEW`
