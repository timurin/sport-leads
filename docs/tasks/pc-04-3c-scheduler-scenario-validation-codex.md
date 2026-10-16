# PC-04.3C — Scheduler Scenario Validation

## Контекст
PC-04.3A реализовал Scheduler engine.
PC-04.3B подключил его к standalone TechnicalCard UI.

Перед массовым планированием и дальнейшим UX нужно проверить Scheduler на реалистичных сценариях.

Эта задача — validation/debug slice.
Новые функции не добавлять без выявленного дефекта.

## Цель
Проверить end-to-end backend-сценарии:

TechnicalCard
→ readiness
→ Demand
→ CapacityResource
→ Scheduler
→ CalendarAssignment
→ CalendarAllocation
→ planned completion / deadline status

## Scope
Основной исполнитель: Codex.

Frontend не менять, если backend contract работает корректно.

---

## 1. Подготовить тестовые сценарии

Использовать test fixtures / isolated test data, не портить живые пользовательские ТК.

Минимум 6 сценариев.

### Scenario A — one-day operation
ТК с одним полностью рассчитываемым шагом.

Проверить:
- assignment создаётся;
- start=end;
- allocation не превышает capacity;
- статус on_time.

### Scenario B — multi-day operation
Demand больше дневной мощности.

Проверить:
- allocation распределён по нескольким рабочим дням;
- assignment span соответствует первой/последней allocation date.

### Scenario C — sequential route
Минимум 3 последовательных шага.

Проверить:
- следующий шаг не начинается раньше predecessor;
- planned completion = конец последнего шага.

### Scenario D — shared capacity conflict
Две ТК используют один CapacityResource.

Проверить:
- первая занимает capacity;
- вторая использует остаток / следующие дни;
- overflow отсутствует.

### Scenario E — deadline missed
shipping_date раньше рассчитанной готовности.

Проверить:
- delay_days;
- deadline_missed;
- сам план сохраняется, если readiness/capacity валидны.

### Scenario F — blocked demand
Обязательный шаг возвращает manual_required/missing_input.

Проверить:
- auto plan не создаётся;
- existing previous plan не повреждается;
- причина видна в response.

---

## 2. Дополнительные сценарии

Если fixtures позволяют:

### Working days
Ресурс не работает в выходной:
- Scheduler пропускает дату.

### Exception
Unavailable / override capacity:
- корректно влияет на allocation.

### Manual lock
Существующий manual_adjusted/locked assignment:
- не перемещается;
- Scheduler планирует вокруг него или возвращает conflict.

### Plan locked
TechnicalCard.plan_locked=true:
- автоматический план не перестраивается.

---

## 3. Проверить capacity formulas

Для каждого используемого типа ресурса подтвердить фактический расчёт:

- labor_hour;
- item throughput;
- linear_meter throughput;
- team throughput;
- resource_count;
- hours_per_day;
- shifts_per_day;
- efficiency;
- exceptions.

Составить короткую таблицу:
`resource -> configured daily capacity -> allocated -> remaining`.

Не менять формулы без обнаруженного бага.

---

## 4. Проверить CalendarAllocation

Для каждого успешного сценария:

- сумма allocations по resource = Demand amount;
- allocation <= available capacity;
- unit совпадает;
- duplicate assignment/resource/date отсутствует;
- shared resource учитывает allocations других ТК.

---

## 5. Проверить CalendarAssignment

- один assignment на TechnicalCard + routing_stage_line;
- planned_start_date = первая allocation date;
- planned_end_date = последняя allocation date;
- planning_mode=auto для Scheduler;
- manual assignments не перезаписываются.

---

## 6. Recalculation

Для минимум одного сценария:

1. построить auto plan;
2. изменить capacity или input;
3. запустить schedule ещё раз.

Проверить:
- будущий auto plan заменён;
- allocations старого auto plan удалены/обновлены;
- manual/locked данные сохранены;
- половинчатый план при ошибке не остаётся.

---

## 7. Entry marker

Проверить текущую assignment стадии:
`Подготовка к запуску`

Она:
- не должна дублироваться;
- не должна потреблять capacity;
- не должна ломать unique constraints;
- должна вести себя по контракту PC-04.3A после успешного schedule.

---

## 8. Response contract

Зафиксировать реальный response:
- status;
- persisted;
- planned_completion_date;
- on_time;
- buffer_days;
- delay_days;
- assignments/steps;
- deviations.

Проверить соответствие frontend PC-04.3B.

Если frontend ожидает поле, которого backend не возвращает:
- зафиксировать integration defect;
- не придумывать fallback.

---

## 9. Что НЕ делать

- не добавлять mass scheduler;
- не добавлять background jobs;
- не добавлять backward scheduling;
- не менять priority logic;
- не вводить новые Demand rules;
- не менять frontend, если contract корректен;
- не делать commit/push/merge.

Если найден реальный P0/P1 bug:
- исправить минимально;
- добавить regression test;
- описать отдельно.

Если дефект требует изменения architecture:
- остановиться и сообщить.

---

## 10. Проверки

- targeted scheduler tests;
- full backend tests;
- project check;
- git diff --check.

Если код не менялся:
- отчёт + тестовые доказательства достаточно.

## Acceptance

PC-04.3C закрыта, если подтверждено:

- Scheduler не превышает capacity;
- route sequencing корректен;
- multi-day allocation корректен;
- shared resources работают;
- deadline risk рассчитывается;
- blocked Demand не создаёт ложный план;
- manual/locked data сохраняются;
- repeated schedule детерминирован;
- response совпадает с frontend contract.

## Отчёт Codex

### Выполнение 2026-10-07 — PC-04.3C закрыта

Задача выбрана владельцем после backend PC-04.3A и существующей UI-интеграции PC-04.3B. Добавлены 13 сценарных HTTP-тестов в `backend/tests/test_scheduler_scenarios_pc_04_3c.py`; используются изолированные SQLite fixtures PC-04.3A, настоящие Demand adapters, ORM и endpoint. Зафиксированы только часы, auth и DB dependency; Demand/мощность не подменяются. Конкурентные команды дополнительно проверены существующим тестом в UUID-схеме локального PostgreSQL :5432. Пользовательские ТК не изменялись.

| Сценарий | Проверенный результат |
|---|---|
| A: одна операция, 100 item | Один AUTO assignment, 07.10=start=end, allocation 100, on_time=true, buffer=15 |
| B: 250 item, рабочие дни Пн–Пт, начало 09.10 | 09.10:100, 12.10:100, 13.10:50; выходные пропущены; span 09–13.10 |
| C: три последовательных шага по 150 item на общем ресурсе | Шаги 07–08.10, 08–09.10, 10–11.10; completion=11.10; общий бюджет каждого дня ≤100 |
| D: две ТК, Demand 60 и 100 item | ТК1:07.10=60; ТК2:07.10=40, 08.10=60; остаток общего ресурса учтён |
| E: 250 item, shipping=07.10 | План сохранён; completion=09.10, on_time=false, buffer=-2, delay=2, deadline_missed |
| F1: manual_required | missing_operator_norm виден в response; steps=[]; все прежние строки/allocations неизменны |
| F2: missing_input | missing_linear_meters виден в response; ложный план не создан; прежний план неизменен |
| Формулы: item, linear_meter, team, labor_hour | Проверены четыре отдельных сквозных случая с настоящими Demand и суммами allocations |
| Exceptions | 07.10 unavailable:0; 08.10 override:30; 09.10 остаток Demand:70 |
| Пересчёт, manual anchor, plan_locked, ошибка | Рост мощности 100→200 переносит второй AUTO-шаг с 08.10 на 07.10; старых allocations 08.10 нет. Ручной первый шаг и entry сохраняются. Повтор даёт те же даты/amounts. plan_locked и неактивная следующая операция оставляют точный прежний снимок |

Для каждого успешного HTTP-сценария общий helper сверяет persisted assignment с response, Demand totals по каждому ресурсу, единицы, первые/последние даты allocations, уникальность assignment/resource/date и ТК/route-line, AUTO mode, sequencing, completion и суммарный дневной бюджет всех ТК. Проверяются идентификатор, note, position и lock entry marker id=10; он не получает allocations и не дублируется. AUTO identifiers при пересчёте не являются стабильным контрактом. Decimal Demand округляется вверх к storage quantum 0.0001, как в PC-04.3A; для выбранных сценарных значений суммы точные.

### Таблица мощности

Это независимые ожидаемые бюджеты fixtures; проверка использует их, а не приватную функцию Scheduler. Числа allocation/remaining относятся к первому рабочему дню.

| Resource / canonical unit | Настройки и configured daily capacity | Demand | Allocated | Remaining |
|---|---|---:|---:|---:|
| item throughput | 4h × 2 shifts × 0.5 efficiency × 3 resource_count × 10 item/h =120 | 100 | 100 | 20 |
| linear_meter throughput | 4h × 2 × 0.5 × 3 × 5 m/h =60 | 100 m | 60 | 0 |
| team throughput | 4h × 2 × 0.5 × 1 team × 10 item/h =40 | 100 | 40 | 0 |
| labor_hour sewing | 4h × 2 × 0.375 × 2 employees =6 labor_hour; verified assembly 360s/item × 100 /3600 =10h Demand | 10h | 6h | 0 |
| unavailable exception | Full override=0 | 100 | 0 | 0 |
| dated capacity override | Full override=30 item, без повторного применения count/efficiency | 100 | 30 | 0 |
| shared item resource | 100 item/day; ТК1 заняла 60 | ТК2=100 | ТК2=40 | 0 |

Команда fixtures `resource_count` использует канонический synonym `staff_count`. Team count=1: сотрудники команды не умножают throughput повторно. Проверка sewing использует реальную AssemblyOperationLine и применённую TechnicalCardOperationLine. Linear-meter Demand использует совпадающий route/stage/operation snapshot объёмом 100m. Формулы не менялись.

### Фактический response и PC-04.3B

HTTP 200 для успешного позднего сценария E (полный JSON записан тестом в `logs/pc-04-3c-scenarios.log`):

```json
{
  "technical_card_id": 1,
  "status": "planned",
  "persisted": true,
  "planning_from": "2026-10-07",
  "horizon_end": "2027-02-03",
  "planned_completion_date": "2026-10-09",
  "on_time": false,
  "buffer_days": -2,
  "delay_days": 2,
  "steps": [{
    "routing_stage_line_id": 1,
    "production_stage_id": 1,
    "planned_start_date": "2026-10-07",
    "planned_end_date": "2026-10-09",
    "preserved": false,
    "assignment_id": 11,
    "allocations": [
      {"resource_key":"items","date":"2026-10-07","allocated_amount":"100.0000","capacity_unit":"item"},
      {"resource_key":"items","date":"2026-10-08","allocated_amount":"100.0000","capacity_unit":"item"},
      {"resource_key":"items","date":"2026-10-09","allocated_amount":"50.0000","capacity_unit":"item"}
    ]
  }],
  "deviations": [{"code":"deadline_missed","reason":"completion_after_shipping_date","routing_stage_line_id":null,"resource_key":null}]
}
```

Для blocked: status=blocked, persisted=false, steps=[], planned_completion_date/on_time/buffer_days/delay_days=null; deviations содержит code, reason, route-line и resource. В F1 это manual_required/missing_operator_norm, в F2 demand_calculation_missing/missing_linear_meters. Отдельного поля assignments нет: UI получает steps. Allocations — дополнительное поле backend; UI его не использует.

Проверены `frontend/lib/production/tech-card-schedule.ts`, API data layer, server action и `tech-card-production-plan.tsx`: все требуемые UI поля присутствуют. Новая команда `node --experimental-strip-types scripts/check_scheduler_scenarios_ui_contract.mjs` воспроизводимо передаёт четыре настоящих HTTP JSON (A/E/F1/F2) функциям UI: deadlineStatusText, deviationText, scheduleStepRows и autoStepCount. Проверены запас 15 дней, опоздание 2 дня, null deadline для blocked, причины и диапазон 07.10–09.10. Integration defect не найден. Это проверка backend/presentation contract; новый браузерный visual acceptance не заявляется.

### Проверки, дефекты и границы

- `python -m pytest backend/tests/test_scheduler_scenarios_pc_04_3c.py -q -s` — 13 passed; HTTP JSON evidence в `logs/pc-04-3c-scenarios.log`.
- Scheduler scenario/core/concurrency + Demand/unit alignment targeted — 44 passed; `logs/pc-04-3c-targeted.log`. PostgreSQL concurrency реально выполнен, не skipped.
- UI response replay — PASS, четыре HTTP-ответа; `logs/pc-04-3c-ui-contract.log`.
- `python scripts/check_project.py` — PROJECT CHECK PASSED, 10/10; 614 backend tests и 340 frontend tests, lint/tsc/build/OpenAPI/Alembic/models/Compose; `logs/pc-04-3c-project-check.log`.
- Генератор production-calendar HTML `--check` и `git diff --check` — passed. Известные warning dependency/cache/lint/module type не являются новыми дефектами Scheduler; ошибок checks нет.

Новых P0/P1 и integration defects не выявлено. Runtime-код, модели, API/schema contracts, frontend и миграции в этой итерации не менялись; добавлены только validation tests/script и документы. Ранее существовавшие незакоммиченные PC-04.3A/3B изменения сохранены. Известные границы PC-04.3A остаются: 120 дат, одна норма cutting method на общий ресурс/день (возможен неиспользованный остаток), external allocation writers должны соблюдать resource locks. P2/P3 вне выбранного slice не исправлялись.

PC-04.3C добавлена и закрыта в roadmap-v1.1 и project-structure; глобальный roadmap и ERP-check получили evidence note. **HTML twin synced** для всех изменённых Markdown; исторический PC-04 и остальная готовность календаря остаются открытыми. Generator поддерживает новый код PC-04.3C. Следующая итерация — следующий выбранный владельцем незавершённый микротаск; массовый Scheduler здесь не начат. Commit/push/merge и production apply не выполнялись.

Кратко:
1. таблица сценариев и результат;
2. найденные defects;
3. исправления, если были;
4. пример allocation одного multi-day заказа;
5. пример shared-resource conflict;
6. пример deadline missed;
7. response contract;
8. tests/checks;
9. frontend/migrations changes;
10. commit/push не выполнялись.
