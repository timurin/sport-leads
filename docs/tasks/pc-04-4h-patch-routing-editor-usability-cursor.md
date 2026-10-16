# PC-04.4H PATCH — Routing Editor Usability

## Исполнитель
Cursor

## Контекст

Текущий Visual Routing Graph Editor архитектурно принят.

Не менять базовую модель:
- родитель = Цех;
- дочерние элементы = TechOperation;
- Routing template = единственный source of truth;
- explicit parallel dependencies сохраняются в backend graph;
- snapshot существующих ТК не меняется.

Нужно улучшить UX редактора без переписывания архитектуры.

---

# 1. Левая панель

Сейчас каталог визуально перегружен.

Сделать два явно разделённых блока:

## Цеха
- поиск;
- список цехов;
- компактные строки;
- выбранный/используемый цех визуально отмечать.

## Технологические операции
- отдельный поиск;
- название крупнее;
- code вторичной строкой;
- readiness индикатор справа.

Не смешивать Цех и TechOperation как один список.

Уменьшить лишние вертикальные отступы.

---

# 2. Zoom controls

Текущие текстовые кнопки:

- Уменьшить
- Увеличить
- По размеру

заменить на компактные icon buttons:

- `−`
- `+`
- `fit-to-screen`

Расположить слева сверху над canvas.

Tooltip:
- Уменьшить
- Увеличить
- По размеру

Текущий процент масштаба оставить рядом.

---

# 3. Убрать action list из карточки операции

Сейчас внутри operation card раскрывается большой список:

- Добавить после
- Создать параллельную ветку
- Выше
- Ниже
- Удалить из маршрута

Это визуально тяжело и плохо читается.

Убрать эти действия из тела карточки.

---

# 4. Карточка операции

В обычном состоянии показывать только:

- drag handle;
- название;
- code;
- readiness;
- indicator dependency/parallel при необходимости;
- `⋯`.

Не показывать постоянно текстовые action links.

---

# 5. Context menu `⋯`

В `⋯` оставить:

- Настроить операцию;
- Переместить в другой цех;
- Удалить из маршрута.

Опционально:
- Выше;
- Ниже

только как accessibility/fallback для DnD, но не основное действие.

Не помещать `Создать параллельную ветку` сюда как главный UX.

---

# 6. Добавление следующей операции через связь

Между последовательными operation cards визуально показывать connector/arrow.

На connector добавить компактную круглую кнопку:

`+`

При клике открыть small popover:

### Добавить операцию
- Следующая операция
- Параллельная ветка

Таким образом пользователь добавляет новую node именно в нужную точку graph.

Пример:

[Подготовка]
     |
    (+)
     |
[Печать]

Клик `+`:
- Добавить следующую операцию
- Добавить параллельную ветку

---

# 7. Parallel branch UX

При выборе:

`Добавить параллельную ветку`

не просто добавлять новую строку.

Показать выбор TechOperation,
после чего отрисовать branch визуально рядом.

Пример:

        ┌─ [Операция B] ─┐
[A] ────┤                 ├── [D]
        └─ [Операция C] ─┘

Параллельные operation cards должны визуально находиться рядом/в одной branch group,
а не выглядеть как обычная вертикальная последовательность.

Join отображать явно.

Не создавать parallel автоматически.

---

# 8. `+ Операция` в Workshop

Кнопку в заголовке цеха сохранить.

Но по клику открывать единый modal:

# Добавить операцию в «Печать»

Два действия:

## 1. Выбрать существующую
Поиск по TechOperation catalog.

Строка:
- название;
- code;
- readiness.

После выбора:
операция сразу добавляется в текущий Workshop draft.

## 2. Создать новую техоперацию

Кнопка:
`+ Создать новую техоперацию`

Открывает quick-create modal.

---

# 9. Quick create TechOperation

Цель:
пользователь должен уметь создать, например:

`Подготовка макетов к печати`

не покидая Routing Editor.

Минимальные поля:

- Наименование *
- Код
- Цех *

Цех по умолчанию:
текущий Workshop, из которого открыт modal.

После создания:

1. TechOperation сохраняется через существующий API;
2. новая операция автоматически добавляется в текущий Routing draft;
3. operation card появляется в Workshop;
4. inspector может показать:
   `Требует настройки`
   пока не настроены Demand/Capacity.

Не требовать в quick-create:
- ресурс;
- мощность;
- график;
- оборудование.

Это настраивается позже через:
`Настроить операцию`.

Если backend уже имеет create TechOperation API — использовать его.

Если API отсутствует:
зафиксировать exact `BACKEND GAP`,
не делать fake local TechOperation.

---

# 10. Пример рабочего сценария

Workshop:
`ПЕЧАТЬ`

Пользователь нажимает:
`+ Операция`

Modal:

`Добавить операцию в «Печать»`

Поиск:
`Подготовка макетов`

Если её нет:

`+ Создать новую техоперацию`

Quick-create:
- Наименование: Подготовка макетов к печати
- Код: print-preparation
- Цех: Печать

Сохранить.

Результат:

ПЕЧАТЬ
- Подготовка макетов к печати
- Сублимационная печать
- Термоперенос

Далее пользователь DnD меняет порядок.

---

# 11. Workshop controls

В header Workshop оставить:

- `+ Операция`
- drag handle
- `⋯`

Убрать постоянные текстовые:
- Выше
- Ниже

Оставить их только в `⋯` как fallback.

---

# 12. Visual hierarchy

Сделать Workshop заметнее operation cards:

Workshop:
- более выраженный header;
- название uppercase/semibold;
- количество операций;
- readiness summary опционально.

Operation:
- компактная карточка;
- меньше высота;
- status secondary.

Цель:
с первого взгляда видно:

`ЦЕХ`
→ `операции`

---

# 13. Error node

Карточка типа:

`Новая операция`
`Требует настройки`

сейчас может выглядеть как полноценная operation.

Если `tech_operation_id` отсутствует:

показывать явно:

`Операция не выбрана`

CTA:
`Выбрать операцию`

Не оставлять generic `Новая операция`.

---

# 14. Header errors

Сохранить общий warning в header.

Но сделать текст actionable.

Например:

`Операция без технологической операции`

→ клик/scroll/focus на проблемный node.

---

# 15. Readiness

Не использовать красную рамку для любого `Требует настройки`.

Красный:
- structural error;
- operation not selected;
- graph invalid.

Жёлтый/оранжевый:
- Demand/Capacity не настроены.

Зелёный:
- готово.

Так route structure error не смешивается с production readiness.

---

# 16. Inspector

Inspector выбранной операции оставить.

Если operation существует:
- операция;
- цех;
- способ расчёта;
- ресурс;
- оборудование;
- readiness;
- `Настроить операцию`.

Если operation не выбрана:
- selector TechOperation;
- `Создать новую техоперацию`.

---

# 17. Не менять

Не менять:

- backend routing semantics;
- snapshot;
- Scheduler;
- Kanban;
- Calendar;
- dependency persistence;
- Demand/Capacity;
- WorkCenter;
- ProductionStage;
- VIS-STRESS.

---

# 18. Tests

Проверить:

## Catalog
- visual split Workshops / TechOperations;
- search independently.

## Zoom
- icons;
- tooltips;
- fit screen.

## Operation UX
- compact card;
- no large inline action list;
- context menu.

## Add
- + connector;
- add sequential;
- add parallel;
- + Operation from Workshop.

## Quick-create
- create TechOperation;
- auto-add into selected Workshop;
- current Workshop preselected;
- API failure preserves editor draft.

## Error
- missing TechOperation shown as `Операция не выбрана`;
- structural error red;
- readiness warning orange/yellow.

## Regression
- DnD Workshop;
- DnD Operation;
- save;
- explicit DAG;
- cycle validation;
- snapshot warning.

Full:
- frontend tests;
- eslint;
- tsc;
- production build;
- project check;
- git diff --check.

---

# 19. Acceptance

Готово, если:

1. левая панель читается как два отдельных справочника;
2. zoom controls компактные icon buttons;
3. operation card больше не содержит большой список действий;
4. следующая operation добавляется через `+` между nodes;
5. parallel branch создаётся через тот же понятный add flow;
6. `+ Операция` открывает searchable selector;
7. из Routing Editor можно создать новую TechOperation;
8. новая TechOperation автоматически добавляется в выбранный Workshop;
9. `Новая операция` без выбора больше не выглядит валидной;
10. readiness и structural errors визуально различаются;
11. backend routing architecture не меняется.

---

# 20. Отчёт Cursor

Указать:

- изменения левой панели;
- zoom controls;
- operation card/menu;
- connector `+`;
- parallel branch UX;
- existing operation selector;
- quick-create TechOperation;
- используемый API;
- error/readiness colors;
- tests/checks;
- backend gaps;
- backend runtime unchanged;
- VIS-STRESS untouched;
- commit/push не выполнялись.

Финальная строка:

`PC-04.4H UX PATCH READY FOR OWNER REVIEW`
