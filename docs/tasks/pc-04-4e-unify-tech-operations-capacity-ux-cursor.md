# PC-04.4E — Unify Tech Operations & Capacity UX

## Исполнитель
Cursor

## Контекст

Сейчас существуют два маршрута:

- `/settings/catalogs/tech-operations`
- `/production/calendar/capacity`

Они логически повторяют друг друга:
- технологические операции;
- ресурсы;
- мощности;
- нормы;
- графики;
- исключения.

Различаются в основном внешним видом и набором доступных полей.

Это создаёт две точки настройки одной и той же производственной модели.

Backend уже содержит общий контур:
- TechOperation;
- CapacityResource;
- WorkCenter;
- Scheduler;
- CalendarAllocation.

PC-04.4D backend завершён:
- WorkCenter используется как source of truth для физического оборудования;
- Scheduler выбирает конкретный WorkCenter;
- allocation возвращает `work_center_id`;
- API мощности/исключений/очереди/загрузки машины уже есть.

## Цель

Сделать:

### `/settings/catalogs/tech-operations`
единственным административным интерфейсом настройки:
- операций;
- ресурсов;
- мощности;
- оборудования;
- графика;
- исключений.

### `/production/calendar/capacity`
оперативным read-only экраном:
- текущая мощность;
- загрузка;
- остаток;
- состояние;
- переход к настройке соответствующей операции/WorkCenter.

Не должно существовать двух независимых редакторов одних параметров.

---

# 1. Сначала аудит frontend

До изменения UI проверить:

- components `/settings/catalogs/tech-operations`;
- components `/production/calendar/capacity`;
- server actions;
- API clients;
- data contracts;
- какие поля редактируются в каждом маршруте;
- какие backend endpoints используются;
- где есть дублирование;
- где один экран имеет поля, которых нет на другом.

Составить короткую таблицу:

| Field / action | tech-operations | calendar/capacity | backend source |
|---|---|---|---|

Не создавать новые frontend data models, если backend уже отдаёт нужные данные.

---

# 2. Архитектурное правило UI

Зафиксировать:

## Settings
`/settings/catalogs/tech-operations`

= **редактирование**

## Production
`/production/calendar/capacity`

= **наблюдение / анализ**

На `/production/calendar/capacity` убрать изменение:
- rate;
- hours;
- shifts;
- efficiency;
- resources;
- WorkCenters;
- exceptions;
- calculation mode.

Вместо этого:
`Настроить` → открывает/ведёт в соответствующую TechOperation в Settings.

---

# 3. Новый UX `/settings/catalogs/tech-operations`

Не делать длинную таблицу со всеми техническими полями.

Основной экран — компактный каталог операций.

## Header
- заголовок `Технологические операции`;
- поиск;
- фильтр по цеху;
- фильтр по типу мощности;
- фильтр `Требует настройки`;
- `+ Добавить операцию`.

## Быстрые фильтры / counters
Например:
- Все;
- Печать;
- Раскрой;
- Пошив;
- Без мощности;
- Требуют настройки.

Использовать реальные категории/данные проекта, не hardcode если их нет.

---

# 4. Строка / карточка операции

Показывать только главное:

- название;
- код;
- цех;
- тип расчёта человекочитаемо;
- связанные ресурсы;
- связанные WorkCenters;
- краткая производительность;
- readiness indicator.

Пример концепции:

`Сублимационная печать`
`Печать · 2 WorkCenter`

`Epson SC-F9200 · 15 м/ч`
`SUPERTEX ...`

Справа:
- состояние;
- `Мощность`;
- `Ресурсы`;
- `⋯`.

Не перегружать строку всеми параметрами.

---

# 5. Большая modal/drawer редактирования

Клик по операции / `Редактировать` открывает большой modal/drawer.

Не делать переход на новую отдельную страницу, если текущая архитектура позволяет modal.

Tabs:

- `Основное`
- `Мощность`
- `Оборудование`
- `График`
- `Исключения`

Header modal:
- название операции;
- `Сохранить`;
- `Закрыть`.

Dirty-close:
- X / Escape / backdrop при несохранённых изменениях → confirmation.

---

# 6. Tab `Основное`

Показывать:
- название;
- код;
- цех;
- active;
- единица результата;
- тип/метод расчёта.

Технические значения типа:
- `explicit_hours`
- `cutting_methods`
- `sewing_norm`
- `rate`

не должны быть единственным текстом для пользователя.

Показывать business-friendly label + optional tooltip с техническим кодом.

Примеры:

- `sewing_norm` → `По норме пошива`
- `cutting_methods` → `По способу раскроя`
- `rate` → `По производительности`
- `explicit_hours` → `По норме времени`
- `milestone` → `Без расчёта мощности`

---

# 7. Убрать непонятное `Веха`

В UI не использовать слово `Веха` как тип ресурса без пояснения.

Если backend value = milestone, отображать:

**Контрольная точка — без расчёта мощности**

Tooltip:
`Операция не резервирует производственную мощность и используется как этап/состояние процесса.`

Для WorkCenter / физического оборудования milestone недопустим.

---

# 8. Tab `Мощность`

Показывать только поля, релевантные выбранному calculation mode/resource type.

Не показывать все параметры всегда.

Примеры:

## sewing_norm
- источник нормы;
- linked labor resource;
- readiness;
- расчетная единица.

## cutting_methods
Карточки методов:
- Поштучно — 20 шт/чел·ч
- Настил — 40 шт/чел·ч

Кнопка редактирования каждого метода.

## rate / throughput
- единица;
- производительность;
- рабочее время;
- shifts;
- efficiency;
- вычисляемая дневная мощность.

## milestone
Только пояснение:
`Мощность не рассчитывается`.

---

# 9. Tab `Оборудование`

Использовать WorkCenter.

Не создавать отдельные equipment records.

Показывать связанные WorkCenters:

| WorkCenter | Цех | Производительность | Состояние |
|---|---|---:|---|

Для печати:
- Epson SC-F9200;
- другие реальные машины из БД.

Кнопка:
`+ Подключить оборудование`

Modal выбора должен показывать только существующие WorkCenters.

Не создавать WorkCenter из этого modal, если для этого есть отдельный каталог.

---

# 10. WorkCenter quick edit

Если backend contract PC-04.4D позволяет безопасное редактирование:

по клику на WorkCenter открыть nested modal / side panel:

- название read-only или текущий contract;
- производительность;
- единица;
- часы;
- shifts;
- efficiency;
- working days;
- exceptions;
- color profile — только если backend уже поддерживает.

Если color profile backend ещё не готов:
не делать fake field.

Показать computed:
`Расчётная мощность в день`.

Frontend может отображать backend-derived или простую presentation calculation,
но не использовать её как Scheduler source of truth.

---

# 11. Tab `График`

Сделать визуально понятным.

Пример:

| | Пн | Вт | Ср | Чт | Пт | Сб | Вс |
|---|---|---|---|---|---|---|---|
| Работа | ✓ | ✓ | ✓ | ✓ | ✓ | – | – |
| Часы | 10 | 10 | 10 | 10 | 10 | – | – |

Изменение через небольшой modal.

Использовать текущий backend contract.

---

# 12. Tab `Исключения`

Список:
- дата / период;
- ресурс / WorkCenter;
- unavailable / override;
- значение;
- комментарий, если существует.

Кнопка:
`+ Добавить исключение`

Добавление/редактирование через modal.

Не создавать новый exception model.

---

# 13. Readiness / health-check UI

Это обязательная часть.

Каждая операция должна визуально показывать готовность к Scheduler.

Использовать доступные backend данные и существующие relations.

Минимальные проверки на UI:

- цех назначен;
- ресурс связан;
- WorkCenter есть, если нужен;
- единица мощности есть;
- производительность есть;
- рабочее время есть;
- calculation mode определён;
- для milestone capacity не требуется.

Не пытаться вычислить сложный Demand на frontend.

Если backend уже возвращает readiness — использовать его.

Если нет полного API readiness:
показать только то, что достоверно известно из загруженных данных.

Статусы:

- `Готово`
- `Требует настройки`
- `Без расчёта мощности`

Ошибочные состояния показывать как конкретные пункты:
- Нет ресурса
- Нет рабочего времени
- Нет WorkCenter
- Нет производительности
и т.д.

---

# 14. `/production/calendar/capacity`

Полностью перестроить назначение страницы.

Это больше НЕ редактор.

Название:
**Мощности и загрузка**

Показывать:

| Ресурс / WorkCenter | Цех | Доступно | Занято | Остаток | Загрузка |
|---|---|---:|---:|---:|---:|

Использовать существующие API:
- capacity;
- load;
- WorkCenter queue;
- exceptions.

Период:
- сегодня;
- текущая неделя;
- выбранная неделя — если текущий UI уже позволяет.

Для каждой строки:
`Настроить` → открыть соответствующую TechOperation / WorkCenter settings.

---

# 15. Capacity page interactions

Допустимы:
- фильтр по цеху;
- фильтр по перегрузке;
- фильтр по WorkCenter/resource;
- tooltip;
- details modal;
- переход `Настроить`.

Недопустимы:
- редактирование rate;
- редактирование смен;
- редактирование resources;
- редактирование WorkCenter;
- редактирование calculation mode.

---

# 16. Navigation

Сохранить toolbar Production Calendar:

- Календарь
- Ручное планирование
- Мощности
- Дашборд
- Центр отклонений

`Мощности` продолжает вести на `/production/calendar/capacity`.

Но теперь это monitor, не settings.

---

# 17. Deep-link к операции

Сделать возможность из capacity page открыть конкретную операцию в settings.

Предпочтительно:
`/settings/catalogs/tech-operations?operation=<id>`

или существующий route/modal state.

При переходе нужная операция должна сразу открываться в modal/drawer.

Не создавать отдельный duplicate edit screen.

---

# 18. Не менять backend без необходимости

Scope задачи — frontend.

Если обнаружено, что необходимое поле:
- отсутствует в API;
- невозможно получить source operation;
- невозможно получить WorkCenter load;
- невозможно deep-link operation;

не придумывать client-side workaround.

Зафиксировать:
`BACKEND GAP`

и описать минимально необходимый endpoint/field.

Не расширять backend самостоятельно в этой задаче.

---

# 19. VIS-STRESS

Не удалять и не изменять:
`VIS-STRESS-001…030`.

Эта задача независима от ручного исправления производственных данных владельцем.

Не запускать новый stress-test.

---

# 20. Tests

Минимум:

## Tech Operations
- list/search/filter;
- operation modal open/close;
- dirty close confirm;
- relevant fields by calculation mode;
- WorkCenter list;
- milestone label;
- readiness status;
- save error preserves draft.

## Capacity
- read-only;
- load values render;
- filters;
- settings deep-link;
- no editing actions.

## Regression
- existing TechnicalOperation create/edit;
- CapacityResource relations;
- WorkCenter relations;
- calendar navigation.

Проверки:
- targeted tests;
- full frontend tests;
- eslint;
- tsc;
- production build;
- project check;
- git diff --check.

---

# Acceptance

Задача готова, если:

1. `/settings/catalogs/tech-operations` — единственный UI для редактирования операций/мощностей;
2. `/production/calendar/capacity` — read-only monitor;
3. одни и те же backend данные используются обоими маршрутами;
4. отсутствуют два независимых редактора мощности;
5. операция редактируется в удобном modal/drawer;
6. поля сгруппированы по вкладкам;
7. WorkCenters отображаются как физическое оборудование;
8. `Веха` заменена понятной терминологией;
9. readiness проблемы видны до запуска Scheduler;
10. capacity monitor ведёт к конкретной настройке;
11. VIS-STRESS dataset не затронут;
12. backend не менялся, либо gaps только документированы.

## Отчёт Cursor

Указать:
- frontend audit двух маршрутов;
- найденное дублирование;
- изменённые components/routes;
- итоговую структуру TechOperation modal;
- readiness UX;
- новый Capacity monitor;
- deep-link behavior;
- backend gaps, если есть;
- tests/checks;
- backend unchanged;
- VIS-STRESS untouched;
- commit/push не выполнялись.
