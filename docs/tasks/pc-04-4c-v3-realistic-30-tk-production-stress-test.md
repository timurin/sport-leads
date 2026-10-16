# PC-04.4C v3 — Realistic 30-TK Production Stress Test

## Статус
Эта задача **заменяет предыдущий stress dataset PC-04.4C v2**.

В локальной БД уже существуют:
`VIS-STRESS-001…030`

Их НЕ удалять.

Нужно **перестроить содержимое этих 30 ТК**, чтобы они представляли реальные разные производственные заказы, а не 30 копий одного сценария.

После подготовки dataset остаётся в БД до визуального утверждения владельцем проекта.

---

# Цель

Получить реалистичную производственную очередь из 30 ТК, в которой различаются:

- изделия / модели;
- маршруты производства;
- количество;
- размеры / размерные наборы, если они уже есть в модели ТК;
- персонализация;
- операции;
- объём печати;
- способ раскроя;
- нагрузка на пошив;
- сроки;
- priority;
- используемые WorkCenter;
- длительность выполнения.

После этого:

1. прогнать mass Scheduler;
2. проверить распределение по мощностям;
3. измерить скорость;
4. оставить все ТК и планы в БД;
5. Cursor проверяет очередь и календарь визуально.

---

# Исполнитель 1 — CODEX

## Этап 0. Ничего не генерировать вслепую

Перед изменением `VIS-STRESS` провести аудит реальных данных локальной БД.

Проверить существующие:

- Product / Nomenclature;
- Model;
- AssemblyVariant / sewing norms;
- Routing;
- RoutingStageLine;
- TechOperation;
- WorkCenter;
- CapacityResource;
- personalization types/fields;
- size/size-set fields;
- TechnicalCardOperationLine;
- существующие реальные/демо TechnicalCard, которые можно использовать как пример структуры.

Сначала сформировать таблицу доступных вариантов:

| Model | Product | Routing | Sewing norm ready | Print | Cutting | Packaging | Suitable for stress |
|---|---|---|---|---|---|---|---|

Не менять бизнес-справочники только ради теста.

---

# Этап 1. Требования к разнообразию 30 ТК

Не допускается создавать 30 одинаковых ТК с изменением только номера.

Dataset должен содержать минимум:

- **5 разных моделей изделий**, если столько реально есть в БД;
- если реально доступно меньше 5 — использовать все существующие и явно зафиксировать ограничение;
- **минимум 3 различных маршрута**, если они существуют;
- **минимум 4 различных уровня количества**;
- несколько вариантов персонализации;
- несколько вариантов раскроя;
- несколько вариантов печатного и непечатного производства.

Не создавать фиктивные модели/маршруты только ради количества.

---

# Этап 2. Матрица 30 ТК

Сформировать dataset примерно по следующей структуре.

## Group A — короткие стандартные заказы
`VIS-STRESS-001…005`

Цель:
короткие производственные заказы.

Требования:
- минимум 2 разных модели;
- quantity ориентировочно 10–30;
- простой существующий маршрут;
- без персонализации либо минимальная;
- валидные sewing norms;
- валидный cutting input;
- нормальный shipping_date;
- priority 10–14.

---

## Group B — средние заказы
`VIS-STRESS-006…010`

Требования:
- другие модели или комбинации моделей/маршрутов;
- quantity 30–70;
- минимум 2 маршрута внутри группы;
- часть с персонализацией;
- priority 20–24.

Цель:
обычная производственная загрузка.

---

## Group C — большие заказы
`VIS-STRESS-011…015`

Требования:
- quantity 100–300;
- минимум 2 разные модели;
- валидная норма пошива;
- минимум одна ТК должна давать multi-day sewing;
- минимум одна — multi-day cutting или packaging, если мощность реально приводит к этому;
- priority 30–34.

---

## Group D — печатный цех / плоттеры
`VIS-STRESS-016…021`

Обязательно использовать текущее PC-04.4D-A:
- WorkCenter;
- 4 отдельных плоттера;
- разные производительности машин;
- allocation с `work_center_id`.

Требования:
- минимум 6 ТК с печатным маршрутом;
- разные объёмы печати;
- минимум 3 разные quantity;
- использовать существующие print-related модели/операции;
- заполнить `TechnicalCardOperationLine.volume` реальными тестовыми значениями, соответствующими размеру заказа;
- не оставлять volume=0;
- минимум две машины должны реально получить работу;
- по возможности задействовать 3–4 плоттера;
- одна ТК должна быть достаточно крупной для заметной загрузки машины.

Цветовые профили НЕ являются blocker этой задачи, пока PC-04.4D UI/profile часть не завершена.

Не изобретать profile compatibility.

---

## Group E — персонализация
`VIS-STRESS-022…025`

Цель:
проверить, что реальные различия ТК сохраняются и видны пользователю.

Использовать существующий механизм персонализации.

Сделать разные случаи, если контракт это поддерживает:
- без персонализации;
- фамилия/номер;
- логотип;
- несколько персонализированных позиций;
- различное количество персонализированных единиц.

Не создавать новую модель персонализации.

Если персонализация сейчас не влияет на Scheduler — это нормально.
Она нужна для реалистичности ТК и визуальной проверки карточки.

---

## Group F — deadline / priority conflicts
`VIS-STRESS-026…028`

Три валидные планируемые ТК:

- разные модели;
- разные quantity;
- общий ограниченный ресурс;
- пересекающиеся planning_start_date;
- конфликтующие shipping_date;
- разные priority.

Нужно получить:
- минимум одну `deadline_missed`;
- минимум одну on-time;
- наглядное влияние priority на порядок.

Не блокировать эти ТК missing-input.

---

## Group G — намеренно blocked
`VIS-STRESS-029…030`

Только 2 ТК оставить намеренно blocked.

Использовать реальные причины:
- например missing_cutting_mode;
- либо другой реальный `manual_required`.

Blocked scenario должен быть осознанным.

Остальные 28 ТК не должны быть blocked из-за случайно незаполненных тестовых данных.

---

# Этап 3. Модели изделий

Для каждой VIS-STRESS ТК использовать реальный существующий Model.

Не использовать один Model для всех 30.

Цель:
- минимум 5 моделей;
- равномерное распределение;
- ни одна модель не должна занимать > 40% dataset, если достаточно моделей в БД.

В отчёте:

| Model | Number of cards | Routes used | Qty range |
|---|---:|---|---|

---

# Этап 4. Маршруты

Не присваивать один и тот же маршрут всем ТК.

Использовать реальные существующие `Routing`.

Для каждой комбинации Model + Routing сначала проверить совместимость.

Цель:
- минимум 3 маршрута;
- маршруты должны реально давать различную последовательность операций.

В отчёте показать:

| Routing | Cards | Operations |
|---|---|---|

---

# Этап 5. Количество

Quantity должно быть распределено, а не идти почти одинаковым диапазоном.

Использовать ориентировочные классы:

- 10–20;
- 25–50;
- 60–100;
- 120–200;
- 250–400.

Не обязано быть ровно по этим числам.

Цель — получить разные нагрузки на Scheduler.

---

# Этап 6. Sewing norm

Это критично.

До запуска mass Scheduler:

для каждой планируемой ТК проверить Demand пошива.

`sewing_norm_unverified` НЕ допускается у 28 planned candidates.

Использовать только Model / AssemblyVariant с подтверждённой валидной нормой.

Если подходящих моделей недостаточно:
- не подделывать norm;
- остановиться;
- перечислить какие модели не имеют нормы и что конкретно отсутствует.

Нельзя снова создать 30 ТК, которые заранее не могут пройти Demand.

---

# Этап 7. Cutting

Для planned candidates:

если маршрут содержит `manual-cut`,
обязательно заполнить:
- `manual_single`
или
- `manual_lay`

Распределить оба варианта между разными ТК.

Примерно:
- часть малых заказов -> manual_single;
- часть средних/крупных -> manual_lay.

Не применять это к laser/opt-cut.

---

# Этап 8. Printing volume

Если маршрут содержит печать с demand в linear_meter:

`TechnicalCardOperationLine.volume > 0`

Объём должен различаться.

Не ставить всем одинаковое значение.

Использовать разумную зависимость от:
- модели;
- quantity;
- существующего `norm_qty_per_item`, если это корректный источник;
- либо явно заданный тестовый объём.

Если расчёт итогового метража пока системой не автоматизирован:
допустимо задать тестовый volume вручную только для VIS-STRESS ТК.

В отчёте отметить способ.

---

# Этап 9. Capacity readiness

Перед массовым запуском проверить ВСЕ ресурсы, необходимые planned candidates.

Для каждого:

- capacity configured;
- hours/day или shift data есть;
- unit совместим с Demand;
- WorkCenter active;
- exception не блокирует весь период.

Сформировать readiness report:

| Resource / WorkCenter | Unit | Rate | Daily capacity | Ready |
|---|---|---:|---:|---|

Не запускать основной stress test, пока случайные capacity gaps блокируют почти весь dataset.

---

# Этап 10. Design / print operator / другие manual_required

Если существующий маршрут содержит обязательную операцию, которая сейчас требует отсутствующей нормы `explicit_hours`, нельзя просто игнорировать это.

Использовать один из вариантов:

1. выбрать другой существующий маршрут, если это соответствует модели;
2. использовать существующее подтверждённое правило, если оно уже есть;
3. если все реальные маршруты блокируются одним и тем же отсутствующим бизнес-правилом — STOP и отчёт владельцу.

НЕ придумывать часы дизайнера/оператора.

---

# Этап 11. Preflight — главное новое требование

До записи итогового production plan сделать preflight всех 30 ТК.

Для каждой вызвать Demand/readiness без изменения календаря.

Сформировать таблицу:

| TK | Model | Routing | Qty | Personalization | Demand status | Expected scheduler status |
|---|---|---|---:|---|---|---|

Acceptance preflight:

- минимум **28 ТК готовы к Scheduler**;
- ровно/примерно 2 ТК намеренно blocked.

Если готово меньше 25:
**НЕ считать dataset подготовленным**.

Исправить только собственные VIS-STRESS данные и повторить preflight.

---

# Этап 12. Очистка старого stress plan

Разрешено очистить только старые AUTO CalendarAssignment / CalendarAllocation,
принадлежащие `VIS-STRESS-*`, если они существуют.

НЕ удалять сами 30 ТК.

НЕ трогать:
- реальные ТК;
- manual assignments;
- locked assignments;
- данные вне VIS-STRESS.

---

# Этап 13. Mass Scheduler

После успешного preflight:

запустить:
`POST /production-calendar/schedule`

Замерить:

1. first run;
2. identical rerun;
3. priority reshuffle;
4. rerun after reshuffle.

Для каждого:
- wall-clock;
- SQL query count, если штатно доступно;
- assignments created;
- allocations created;
- planned cards;
- blocked;
- deadline_missed.

---

# Этап 14. Priority reshuffle

После первого плана изменить priority минимум у 4 VIS-STRESS ТК из разных групп.

Например:
- крупную ТК поднять вверх;
- короткую опустить;
- поменять две конфликтующие печатные ТК;
- null priority дать одной tail-card, если такая используется.

Пересчитать.

Проверить реальное изменение:
- очереди;
- start/end;
- allocation конкретных WorkCenter;
- deadline result.

---

# Этап 15. WorkCenter stress

Для печатных ТК проверить:

- какие Plotter WorkCenter выбраны;
- сколько ТК на каждом;
- allocated linear meters;
- available capacity;
- utilization.

Таблица:

| WorkCenter | Rate | Cards | Allocated m | Available m | Utilization |
|---|---:|---:|---:|---:|---:|

Обязательные условия:
- минимум 2 плоттера реально используются;
- отсутствует double booking;
- individual rate влияет на распределение.

---

# Этап 16. Реалистичность результата

После Scheduler должны присутствовать:

- short single-day assignments;
- multi-day assignments;
- несколько ТК одновременно в разных производственных этапах;
- конкуренция за shared resources;
- печать на разных плоттерах;
- минимум 1 deadline_missed;
- минимум 1 blocked;
- различные planned completion dates.

Если календарь снова почти пустой — stress test считается НЕ выполненным.

---

# Этап 17. Performance

Замерить:

- seed/update 30 existing VIS-STRESS;
- preflight 30;
- first mass schedule;
- repeated mass schedule;
- priority reshuffle schedule.

Отметить:
- < 5 сек — приемлемо для текущего MVP;
- 5–15 сек — performance concern;
- >15 сек — существенная проблема.

Это диагностический threshold, не новый business SLA.

---

# Этап 18. Сохранение dataset

После всех тестов:

НЕ удалять:
- VIS-STRESS-001…030;
- их operation lines;
- personalization;
- planning data;
- CalendarAssignment;
- CalendarAllocation.

Итоговый результат после priority reshuffle оставить в БД.

Обязательная финальная строка:

`REALISTIC VIS-STRESS DATASET PRESERVED — WAITING FOR OWNER VISUAL APPROVAL BEFORE DELETE`

---

# Этап 19. Codex tests/checks

- targeted Demand tests;
- targeted WorkCenter/Scheduler tests;
- mass scheduler regression;
- full backend tests;
- project check;
- git diff --check.

Не менять Scheduler algorithm, если дефект не найден.

Не commit/push.

---

# Исполнитель 2 — CURSOR

Начинать ТОЛЬКО после сообщения Codex:

- минимум 25/30 реально planned;
- dataset сохранён;
- указаны недели календаря для просмотра.

---

# Этап 20. Queue visual stress

На `/production/calendar` -> `Очередь`

Проверить 30 разнообразных ТК.

Особенно:
- разные модели;
- разные количества;
- priority;
- deadline risk;
- blocked;
- planned completion.

Оценить:
- читаемость 30 строк;
- необходимость внутреннего scroll;
- высоту панели;
- sticky header;
- длинные значения;
- status visibility.

Ничего автоматически не переделывать.

Сначала отчёт.

---

# Этап 21. Calendar visual stress

Проверить минимум 4 недели.

Должны реально присутствовать полоски VIS-STRESS.

Проверить:
- разные операции;
- разные длины;
- несколько ТК в одной строке;
- перенос между неделями;
- разные WorkCenter печати;
- overlapping lanes;
- строку пошива;
- раскрой;
- упаковку;
- deadline risk;
- отсутствие полосок blocked ТК.

Если 30 ТК делают доску неудобной:
зафиксировать конкретно где и почему.

Не внедрять `+N` или virtualization без решения владельца.

---

# Этап 22. TechnicalCard sampling

Открыть минимум 8 ТК:

- 2 коротких;
- 2 больших;
- 2 печатных;
- 1 персонализированную;
- 1 deadline/blocked.

Проверить, что различия данных реально видны:
- model/product;
- quantity;
- personalization;
- route;
- dates;
- planned steps.

---

# Этап 23. WorkCenter visual check

Для печатных ТК проверить, что UI/tooltip/details позволяет понять,
на каком конкретном плоттере стоит работа.

Если UI этого пока не показывает:
зафиксировать как UI gap PC-04.4D-B.

Не подменять номер машины названием абстрактного ресурса.

---

# Этап 24. UI timing

Замерить ориентировочно:

- opening calendar;
- opening queue with 30 rows;
- switching week;
- opening TK modal;
- refresh after mass schedule.

Проверить минимум:
- 1440 px;
- 1280 px;
- 1024 px.

---

# Этап 25. Acceptance

Stress test считается успешным только если:

1. сохранены все 30 VIS-STRESS;
2. использовано минимум 5 реальных моделей, если они существуют;
3. использовано минимум 3 реальных маршрута, если они существуют;
4. quantity реально различается;
5. есть персонализированные и неперсонализированные ТК;
6. есть manual_single и manual_lay там, где применимо;
7. print volume различается;
8. минимум 25 ТК получили auto-plan;
9. минимум 5 ТК имеют multi-day assignment;
10. минимум 2 плоттера реально заняты Scheduler;
11. минимум одна ТК deadline_missed;
12. 1–2 ТК blocked намеренно;
13. очередь и календарь реально заполнены;
14. времена mass schedule измерены;
15. dataset НЕ удалён.

Если любой пункт невозможен из-за реального состояния справочников,
не подделывать результат — указать точный blocker.

---

# Отчёт Codex

Обязательно:

### Dataset matrix
| TK | Product | Model | Route | Qty | Personalization | Cutting | Print m | Priority | Shipping | Result |

### Distribution
- models count;
- routes count;
- quantities;
- personalization count;
- cutting methods;
- print cards.

### Scheduler
- planned;
- blocked;
- deadline missed;
- multi-day;
- assignments;
- allocations.

### WorkCenters
- plotter utilization;
- cards per plotter.

### Performance
- seed/update;
- preflight;
- first run;
- rerun;
- priority reshuffle.

### Persistence
Подтвердить:
`REALISTIC VIS-STRESS DATASET PRESERVED — WAITING FOR OWNER VISUAL APPROVAL BEFORE DELETE`

---

# Отчёт Cursor

- 30 cards visible in Queue;
- weeks checked;
- visible density;
- operation rows;
- WorkCenter visibility;
- sample TK verification;
- UI timings;
- responsive result;
- defects found;
- dataset untouched.

---

# Что НЕ делать

- не удалять VIS-STRESS;
- не создавать ещё 30 дублей;
- не использовать одну модель для всех;
- не использовать один маршрут для всех;
- не оставлять все quantity почти одинаковыми;
- не оставлять случайные missing sewing norms;
- не оставлять print volume=0 на planned print cards;
- не выдумывать production norms;
- не менять business catalogs ради прохождения теста;
- не менять Scheduler без подтверждённого defect;
- не commit/push/merge.
