# PC-04.4C v2 — 30-card Stress & Visual Acceptance Dataset

## Назначение
Создать и сохранить в локальной dev-базе 30 тестовых standalone TechnicalCard для:

1. визуальной оценки Production Queue;
2. визуальной оценки недельного Production Calendar;
3. стресс-проверки Mass Scheduler;
4. замера времени построения и повторного пересчёта очереди;
5. проверки shared CapacityResource на реалистичной плотности.

После выполнения тестовые ТК, CalendarAssignment и CalendarAllocation НЕ удалять.

Удаление разрешено только после явного утверждения владельцем проекта.

Финальная строка отчёта обязательна:

`VISUAL/STRESS ACCEPTANCE DATASET PRESERVED — WAITING FOR OWNER APPROVAL BEFORE DELETE`

---

# Исполнители

## Codex
- создаёт 30 persistent тестовых ТК;
- готовит валидные данные;
- запускает mass scheduler;
- измеряет backend performance;
- проверяет allocations/capacity/deadlines;
- оставляет dataset в локальной PostgreSQL.

## Cursor
- проверяет Queue и Weekly Calendar на этих 30 ТК;
- оценивает плотность интерфейса;
- проверяет responsive/scroll/layout;
- измеряет frontend rendering/interactions, где это возможно;
- dataset не изменяет и не удаляет.

---

# ЧАСТЬ A — CODEX

## 1. Dataset

Создать ровно 30 новых standalone TechnicalCard.

Prefix:
`VIS-STRESS-`

Номера:
- VIS-STRESS-001
- ...
- VIS-STRESS-030

Ручные номера заказов:
- TEST-3001
- ...
- TEST-3030

Использовать только локальную dev DB.

Не использовать существующие реальные ТК как часть stress dataset.

Все IDs созданных карточек сохранить в отчёте.

---

# 2. Idempotent seed

Предпочтительно создать dev script:

`backend/scripts/seed_calendar_stress_acceptance.py`

Требования:
- повторный запуск не создаёт дубликаты;
- находит ТК по стабильному prefix/code;
- обновляет только собственный VIS-STRESS dataset;
- не трогает остальные данные;
- НЕ содержит auto-cleanup;
- cleanup script в этой задаче НЕ создавать.

---

# 3. Распределение сценариев

Dataset должен быть разнообразным, а не 30 одинаковых карточек.

## Group A — High priority / short deadline
ТК 001–005

- priority: 10–14
- близкие planning_start_date
- ранние shipping_date
- малые/средние quantity

Цель:
первые позиции очереди и высокая конкуренция за ранние даты.

## Group B — Normal priority / shared resources
ТК 006–012

- priority: 20–26
- одинаковые или близкие planning_start_date
- средние quantity
- маршруты с общими CapacityResource

Цель:
проверить последовательное занятие общей мощности.

## Group C — Large / multi-day
ТК 013–018

- priority: 30–35
- большие quantity
- shipping_date с достаточным запасом

Цель:
получить длинные multi-day полоски и перенос между днями/неделями.

## Group D — Deadline risk
ТК 019–023

- priority: 40–44
- валидный readiness
- shipping_date подобрать так, чтобы plan был сохранён, но часть ТК получила `deadline_missed`

Цель:
проверить риски без блокировки планирования.

## Group E — Blocked / missing input
ТК 024–027

Использовать реальные причины:
- missing cutting_method;
- missing sewing norm;
- missing linear-meter volume;
- manual_required design/operator.

Не создавать искусственные ошибки схемы.

Цель:
blocked cards не должны занимать ложную capacity.

## Group F — Low priority / tail
ТК 028–030

- priority: null или 80+
- поздний shipping_date
- валидный Demand

Цель:
проверить хвост очереди и правило `null after explicit priority`.

---

# 4. Даты

Dataset должен покрывать минимум 3–4 календарные недели.

Не пытаться уместить всё в одну неделю.

Цель визуальной проверки:
- текущая неделя;
- следующая;
- ещё минимум одна будущая неделя.

В отчёте указать, какие недели открыть владельцу.

---

# 5. Реальные маршруты

Использовать существующие `routings` и `routing_stage_lines`.

Не создавать новый маршрут только ради stress test, если можно использовать существующий.

Разрешено:
- выбирать разные существующие маршруты;
- заполнять operation line inputs;
- задавать volume;
- задавать cutting_method;
- quantity;
- planning/shipping/priority.

Не менять глобальные production rules.

---

# 6. Demand readiness

Цель:
минимум 22 из 30 ТК должны получить сохранённый auto-plan.

Минимум:
- 15 planned/on-time;
- 5 multi-day;
- 3 deadline_missed;
- 3–4 blocked с реальной причиной.

Если текущая модель не позволяет ровно такое распределение:
не менять бизнес-логику; указать фактический результат.

---

# 7. Первый Mass Scheduler run

Запустить:
`POST /production-calendar/schedule`

Замерить отдельно:

- total wall-clock time;
- backend service calculation time, если доступно без intrusive profiling;
- DB/persistence time, если легко измеряется;
- число ТК;
- planned;
- blocked;
- deadline_missed;
- количество созданных CalendarAssignment;
- количество CalendarAllocation.

Не добавлять постоянный instrumentation в production runtime только ради теста.

Допустим test/dev timing wrapper.

---

# 8. Повторный Mass Scheduler run

Запустить второй раз без изменения данных.

Замерить:
- wall-clock time;
- количество изменённых assignments/allocations;
- детерминированность результата;
- отсутствие дубликатов;
- отсутствие capacity overflow.

Повторный запуск dataset НЕ удаляет.

---

# 9. Priority reshuffle test

После первого стабильного плана:

Изменить priority у 3 ТК собственного stress dataset, например:
- одну из Group C поднять выше Group A;
- одну из Group A опустить;
- одну null сделать явной.

Запустить mass scheduler ещё раз.

Проверить:
- будущий auto-plan перестроился;
- shared capacity перераспределилась;
- manual/locked данные других сущностей не затронуты;
- результат deterministic.

После теста оставить итоговое состояние dataset в базе.

В отчёте указать финальные priorities.

---

# 10. Performance thresholds

Не вводить жёсткий P0 threshold без текущего baseline.

Но обязательно записать фактические времена:

- seed 30 ТК;
- first mass schedule;
- second identical schedule;
- priority reshuffle schedule.

Дополнительно:
- число SQL queries, если можно получить штатным способом;
- peak memory только если легко измеряется.

Не усложнять задачу profiler-инфраструктурой.

Если один mass schedule > 5 секунд локально:
отметить как performance concern и собрать краткий профиль/причину.

Если > 15 секунд:
считать значимым performance issue и не переходить молча дальше.

---

# 11. Capacity validation

Для минимум 5 самых загруженных ресурсов вывести:

| Resource | Period | Configured capacity | Allocated | Utilization | Cards |
|---|---|---:|---:|---:|---:|

Проверить:
- allocation не превышает capacity;
- shared resources учитывают все 30 ТК;
- blocked ТК не резервируют capacity;
- null/explicit priority влияет только на порядок, а не на формулу мощности.

---

# 12. CalendarAllocation validation

Проверить автоматически:

- duplicate `(assignment, resource, date)` отсутствует;
- `allocated_amount > 0`;
- unit совпадает;
- сумма allocations соответствует Demand там, где Demand ready;
- assignment span совпадает с первой/последней allocation date;
- нет allocations orphaned от assignment.

---

# 13. Persistent dataset rule

КРИТИЧНО:

После всех backend tests:

НЕ удалять:
- 30 TechnicalCard;
- operation lines;
- assignments;
- allocations;
- planning inputs.

Если обычные pytest fixtures rollback:
persistent seed выполнять ПОСЛЕ test suite отдельной командой.

В конце Codex обязан повторно проверить:
- в БД ровно 30 `VIS-STRESS-*`;
- planned assignments всё ещё существуют;
- dataset доступен frontend.

---

# 14. Codex tests

- targeted mass scheduler tests;
- full backend tests;
- project check;
- git diff --check.

Новых migration не создавать ради dataset.

Commit/push не выполнять.

---

# ЧАСТЬ B — CURSOR

Начать после отчёта Codex и подтверждения, что 30 ТК сохранены.

## 15. Queue UI stress check

Открыть:
`/production/calendar`

→ `Очередь`

Проверить на 30 ТК:

- читаемость списка;
- сортировку priority;
- высоту/плотность строк;
- scrolling;
- sticky/header behavior, если есть;
- не ломается ли panel/drawer;
- blocked/risk различимы;
- planned completion читается;
- длинные номера не ломают layout.

Не сокращать dataset ради красоты.

---

# 16. Weekly Calendar stress check

Проверить минимум 3 недели, указанные Codex.

Оценить:

- сколько полосок одновременно в одной стадии;
- высоту строк;
- отсутствие наложений;
- отсутствие дубликатов assignment;
- читаемость номера;
- multi-day span;
- перенос через границу недели;
- пастельные цвета;
- deadline-risk;
- blocked ТК не получает ложные полоски;
- scrollbar / page height;
- производительность scroll и переключения недель.

Все заказы показывать по текущему контракту, без `+N`, если UI именно так утверждён.

Если 30 ТК делают строку неприемлемо высокой — зафиксировать UX defect, НЕ скрывать его автоматической доработкой в этой задаче.

---

# 17. Visual density report

Cursor должен дать владельцу конкретную оценку:

Для каждой проверенной недели:
- число видимых ТК;
- максимальное число одновременных полосок в одной стадии;
- самая высокая строка;
- есть ли horizontal/vertical overflow;
- субъективно читается ли номер ТК за 2–3 секунды;
- найденные проблемные места.

Не менять дизайн без отдельного подтверждения владельца.

---

# 18. Frontend timing

Измерить ориентировочно:

- открытие `/production/calendar`;
- открытие `Очередь`;
- переключение недели;
- открытие read-only modal ТК;
- обновление после mass schedule.

Достаточно browser/dev timing; production telemetry не добавлять.

Если заметны подвисания — указать компонент/сценарий.

---

# 19. Modal sampling

Открыть минимум:
- 2 planned;
- 1 multi-day;
- 1 deadline-risk;
- 1 blocked, если blocked отображается как доступный объект очереди.

Проверить данные и отсутствие ошибок.

---

# 20. Responsive smoke test

Минимум:
- 1440
- 1280
- 1024

Mobile не является главным экраном производственного планирования, но существующий layout нельзя ломать.

Если текущие проектные проверки требуют меньшие размеры — прогнать существующий набор.

---

# 21. Cursor tests

- targeted calendar/queue tests;
- full frontend tests;
- lint;
- tsc;
- production build;
- project check;
- git diff --check.

Dataset НЕ удалять.

Backend НЕ менять.

---

# 22. Что НЕ делать

- не удалять stress dataset;
- не уменьшать 30 ТК до 5 после тестов;
- не очищать allocations;
- не менять Scheduler algorithm без выявленного P0/P1;
- не переделывать UI автоматически;
- не добавлять virtualized list без отдельного решения;
- не добавлять `+N` вместо всех карточек без решения владельца;
- не менять business capacity ради красивой картинки;
- не commit/push/merge.

---

# 23. Acceptance

Технически задача выполнена, если:

- в локальной БД сохранено 30 VIS-STRESS ТК;
- минимум 22 планируются или фактический blocker документирован;
- есть multi-day assignments;
- есть deadline-risk;
- есть blocked;
- mass schedule замерен;
- повторный schedule детерминирован;
- priority reshuffle проверен;
- capacity overflow отсутствует;
- Queue UI проверена на 30 ТК;
- Calendar проверен минимум на 3 недели;
- dataset оставлен владельцу.

Финальное визуальное утверждение делает только владелец проекта.

Финальная строка:

`VISUAL/STRESS ACCEPTANCE DATASET PRESERVED — WAITING FOR OWNER APPROVAL BEFORE DELETE`

---

# 24. Отчёт Codex

Обязательно:
- 30 IDs / номеров ТК;
- группы A–F;
- priority / qty / dates;
- planned/blocked/risk;
- время первого mass schedule;
- время повторного mass schedule;
- время после priority reshuffle;
- assignments count;
- allocations count;
- top-5 resource utilization;
- недели для визуальной проверки;
- подтверждение сохранения dataset.

# 25. Отчёт Cursor

Обязательно:
- какие недели проверены;
- сколько ТК видно;
- max concurrency в строке;
- Queue density;
- Calendar density;
- timings UI;
- modal samples;
- responsive checks;
- визуальные дефекты без самовольного redesign;
- подтверждение, что 30 ТК сохранены.
