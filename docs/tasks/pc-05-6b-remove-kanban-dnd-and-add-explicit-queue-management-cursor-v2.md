# PC-05.6B v2 — Remove Kanban DnD + Operator Queue UX

## Исполнитель
Cursor

## Зависимость
После PC-05.6A.

## Цель
Убрать DnD из Kanban и привести интерфейс к окончательной производственной семантике:

- **Calendar = план производства на неделю**
- **Queue = порядок выполнения ожидающих ТК**
- **Kanban = фактический текущий участок ТК**
- **Operator actions = Принять в работу / Завершить**

Kanban не должен управлять планированием и очередью.

Использовать:
- `SL-PROJECT-MEMORY-v1`
- `SL-UI-CONTEXT-v1`
- только релевантные frontend-компоненты и API contracts

Без repo-wide scan.

---

## 1. Kanban — убрать DnD полностью

Удалить:
- drag handles;
- drag/drop между колонками;
- подсказки про DnD;
- frontend вызовы transition API через drag;
- любые визуальные affordance, создающие впечатление, что карточку можно переносить вручную между участками.

Карточка остаётся кликабельной для открытия ТК.

---

## 2. Kanban = факт

Колонки Kanban соответствуют текущим workshops/участкам.

Одна ТК должна отображаться только в одном текущем участке.

Будущие назначения в Calendar не должны визуально переносить карточку в будущий участок.

Badge карточки:
- `Ожидает`
- `В работе`

Если backend contract поддерживает и другие fact-safe состояния — использовать их.

Не вычислять current workshop на frontend.

---

## 3. Действия оператора

В карточке/деталях ТК должны использоваться существующие backend actions:

### Ожидает
Кнопка:
`Принять в работу`

После успешного backend response:
- участок остаётся тем же;
- badge → `В работе`;
- факт начала фиксируется backend.

### В работе
Кнопка:
`Завершить`

После успешного backend response:
- если все required operations текущего workshop завершены,
  backend переводит ТК на следующий workshop;
- Kanban автоматически показывает карточку в следующей колонке как `Ожидает`.

Не делать transition логикой frontend.

---

## 4. Очередь участка

Kanban не управляет очередью.

Очередь участка должна быть отдельным представлением списка ожидающих ТК.

Источник порядка:
`Scheduler / CalendarAssignment / canonical planning priority`

Показывать минимум:
- позицию в очереди;
- № ТК;
- модель;
- количество;
- плановую дату;
- ETA/риск, если API отдаёт;
- status `Ожидает`.

---

## 5. Ручное управление очередью

Ручное изменение очереди доступно только для ещё не начатых ТК.

Не делать drag между Kanban columns.

Допустимый UX:
- `↑`
- `↓`
или
- DnD только внутри списка очереди одного участка

Важно:
DnD внутри queue list допустим, потому что меняется только порядок ожидающих ТК, а не фактический участок.

Не разрешать менять порядок:
- `in_progress`;
- `completed`;
- protected fact records.

---

## 6. Применение изменения очереди

Изменение порядка не должно silently менять производственный факт.

Перед сохранением:
- показать preview;
- какие ТК меняют позицию;
- старый/новый порядок;
- если backend отдаёт impact — изменение дат/ETA.

Primary action:
`Применить очередь`

После сохранения backend выполняет canonical replan/priority update.

Если backend API для безопасной queue reorder отсутствует:
зафиксировать `BACKEND GAP`.
Не реализовывать frontend-only fake ordering.

---

## 7. Calendar

Production Calendar остаётся weekly planning view.

Не пытаться синхронно переставлять Kanban card при изменении Calendar future assignments.

Calendar может показывать одну ТК на нескольких участках в разные дни — это план и это нормально.

---

## 8. TechnicalCard list

Показывать только backend values:
- lifecycle status;
- current workshop.

Не выводить:
- `Черновик`, если backend уже считает ТК запущенной;
- будущий workshop из Calendar как текущий участок.

---

## 9. Empty / protected states

Если очередь участка пустая:
`Нет ожидающих техкарт`

Если пользователь не имеет права менять порядок:
- очередь read-only;
- оператор всё равно может `Принять в работу`, если backend разрешает.

Если ТК protected/in_progress:
- без queue controls.

---

## 10. Tests

### Kanban
- no DnD;
- no drag handles;
- future Calendar assignment не двигает карточку;
- current workshop приходит из backend;
- `Принять в работу`;
- `Завершить`;
- после completion карточка переходит только после backend state change.

### Queue
- only waiting/unstarted;
- reorder only within one workshop;
- in_progress/completed read-only;
- preview before apply;
- no frontend-only persisted order;
- BACKEND GAP shown if API missing.

### Full
- frontend tests;
- eslint;
- tsc;
- production build;
- project check;
- git diff --check.

---

## Не менять
- Scheduler algorithms;
- backend lifecycle semantics;
- Demand/Capacity;
- production facts;
- route snapshot semantics;
- commit/push.

---

## Acceptance
Готово, если:
1. Kanban больше нельзя использовать как planner;
2. оператор управляет только фактом `Ожидает → В работе → Завершить`;
3. очередь вынесена в отдельное представление;
4. ручной reorder доступен только для ожидающих ТК;
5. Calendar остаётся weekly plan;
6. frontend не дублирует backend transition logic.

Финальная строка:
`PC-05.6B KANBAN FACT UX AND OPERATOR QUEUE READY`
