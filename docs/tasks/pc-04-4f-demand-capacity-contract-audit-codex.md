# PC-04.4F — Demand ↔ Capacity Contract Audit

## Исполнитель
Codex

## Контекст

Production Scheduler уже умеет:
- читать TechnicalCard;
- получать маршрут;
- считать Demand;
- учитывать CapacityResource / WorkCenter;
- создавать CalendarAssignment / CalendarAllocation;
- массово планировать ТК.

Но ручная проверка показала архитектурную путаницу между:

### Demand
Сколько работы требуется конкретной ТК.

и

### Capacity
Сколько работы может выполнить ресурс/оборудование.

Пример проблемы:
операция `Ручной раскрой` связана с трудовым ресурсом в режиме `По норме времени`,
но сама ТК/модель не даёт однозначную норму потребности, из-за чего Scheduler возвращает:
`manual_required / missing_operator_norm`.

Нужно проверить всю цепочку и отделить:
- норму операции;
- потребность ТК;
- мощность ресурса.

---

# Цель

Получить точную карту:

`TechnicalCard -> Model -> Routing -> TechOperation -> Demand -> Resource/WorkCenter -> Capacity -> Scheduler`

И определить, где текущая реализация:
- корректна;
- дублирует данные;
- смешивает Demand и Capacity;
- требует минимального исправления.

Не начинать stress-test.
Не менять frontend.
Не придумывать новые производственные нормы.

---

# 1. Сначала аудит, потом изменения

До правок кода собрать таблицу по всем основным операциям.

Минимум:

- Пошив
- Ручной раскрой
- Раскрой настилом
- Лазер
- Сублимационная печать
- Термоперенос
- ВТО
- Упаковка
- Дизайн
- Оператор печати / подготовка

Таблица:

| Operation | Demand source | Demand unit | Capacity source | Capacity unit | Calculation mode | Ready / Gap |
|---|---|---|---|---|---|---|

---

# 2. Базовый принцип

Проверить код на соответствие правилу:

## Demand отвечает на вопрос
**Сколько работы требует эта ТК?**

Источники Demand могут быть:
- Model / AssemblyVariant;
- quantity;
- TechnicalCardOperationLine.volume;
- cutting_method;
- explicit business norm;
- другие реальные поля ТК.

## Capacity отвечает на вопрос
**Сколько работы может выполнить ресурс за день/смену?**

Источники Capacity:
- CapacityResource;
- WorkCenter;
- rate;
- hours_per_day;
- shifts;
- efficiency;
- working days;
- exceptions.

Scheduler не должен использовать Capacity-поля как замену отсутствующей норме Demand.

---

# 3. Пошив

Проверить текущую формулу.

Ожидаемая логика:

`sum(duration_seconds × quantity_per_item × TK.quantity) / 3600`

= Demand в чел.-часах.

Проверить:
- где хранится `duration_seconds`;
- где хранится `quantity_per_item`;
- что делает строка с `duration_seconds = 0`;
- почему появляется `missing_sewing_norm`;
- что означает `sewing_norm_unverified`;
- есть ли отдельный статус "не подтверждено";
- можно ли отличить реально отсутствующую норму от нулевой операции.

Не заполнять нормы автоматически.

---

# 4. Ручной раскрой

Особенно внимательно проверить.

Сейчас существуют:
- операция `Ручной раскрой`;
- ресурс `Ручной раскрой`;
- ресурс/пул раскройщиков;
- `cutting_methods`;
- `manual_single`;
- `manual_lay`;
- нормы 20 / 40 шт/час или их текущий эквивалент.

Нужно ответить:

1. Где должна храниться норма:
   - поштучный раскрой;
   - раскрой настилом?

2. Где должен храниться общий фонд раскройщиков?

3. Должна ли ТК хранить только `cutting_method`?

4. Как из:
   - quantity;
   - cutting_method;
   - norm
   получить Demand?

5. Как Capacity раскройщиков должна сравниваться с этим Demand?

Проверить, не ошибочно ли сейчас ресурс `manual_cut` с `explicit_hours`
используется одновременно как:
- норма операции;
- и мощность ресурса.

---

# 5. Раскрой настилом

Проверить, является ли это:
- отдельной TechOperation;
или
- вариантом выполнения `Ручного раскроя`.

Не менять архитектуру сразу.

Сначала описать фактическую текущую модель и возможное противоречие.

Если `manual_single/manual_lay` уже достаточны внутри одной операции,
отметить дублирование отдельной операции `Раскрой настилом`.

---

# 6. Лазер

Проверить:

Demand:
- из quantity?
- из pieces?
- из другого поля?

Capacity:
- WorkCenter laser;
- item/hour;
- hours/day;
- shifts;
- efficiency.

Проверить, что machine capacity не смешивается с operator labor.

---

# 7. Печать

Проверить отдельно:

## Machine Demand
- откуда берутся погонные метры;
- `TechnicalCardOperationLine.volume`;
- unit `linear_meter`.

## Machine Capacity
- WorkCenter;
- индивидуальная скорость каждого плоттера;
- hours/day;
- shifts;
- efficiency.

## Operator Demand
- существует ли реальная бизнес-норма;
- если нет, почему `print_operator` использует `explicit_hours`;
- нельзя ли текущую настройку ошибочно считать Capacity вместо Demand.

Не придумывать норму оператора.

---

# 8. ВТО

Определить фактическую текущую модель:

- TechOperation;
- linked resource;
- calculation mode;
- unit;
- Demand source;
- Capacity source.

Если Demand rule отсутствует:
чётко зафиксировать:
`BUSINESS RULE MISSING`.

Не превращать ВТО в milestone автоматически.

---

# 9. Упаковка

Проверить текущую логику:

Demand:
`TK.quantity`

Capacity:
например:
`80 шт/ч × hours/day × shifts × efficiency`

Проверить, не дублируется ли quantity/rate.

---

# 10. Дизайн

Проверить:
- какой Demand ожидает adapter;
- почему `explicit_hours`;
- есть ли где-то уже данные по сложности / числу размеров / деталей;
- можно ли получить Demand из существующих данных без выдуманного правила.

Если нет:
`BUSINESS RULE MISSING`.

Не внедрять новую формулу.

---

# 11. CapacityResource vs WorkCenter

После PC-04.4D-A:

- WorkCenter = physical equipment source of truth;
- Scheduler возвращает `work_center_id`.

Проверить, что для physical equipment:
- rate не хранится независимо в двух местах;
- CalendarAllocation однозначно относится к WorkCenter;
- CapacityResource не дублирует physical machine capacity.

Для labor/team ресурсов WorkCenter не навязывать.

---

# 12. Найти ошибочные/двусмысленные поля

Особенно проверить поля типа:

- `base_rate`;
- `resource_count`;
- `hours_per_day`;
- `calculation_mode`;
- `capacity_unit`.

Для каждого определить:
- относится к Demand;
- относится к Capacity;
- относится к routing/config.

Составить таблицу:

| Field | Entity | Meaning | Demand / Capacity / Other |
|---|---|---|---|

Если поле используется одновременно в двух смыслах — отметить как архитектурный дефект.

---

# 13. Проверить Scheduler adapters

Для каждого adapter:

- входные данные;
- output ResourceDemand;
- unit;
- reasons;
- source/details.

Проверить:
- не читает ли adapter Capacity поля для вычисления Demand;
- не требует ли ручные часы там, где уже есть производственная норма;
- нет ли дублирующих adapters для одной бизнес-операции.

---

# 14. Минимальные исправления

После аудита разделить findings:

## A. Data/config issue
Можно исправить вручную в справочниках.

## B. Backend contract bug
Нужна правка кода.

## C. Missing business rule
Нельзя исправить без решения владельца.

## D. UI naming/confusion
Не менять здесь, только отметить для Cursor.

---

# 15. Правки в этой задаче

Разрешены ТОЛЬКО минимальные backend-правки,
если обнаружен очевидный contract bug, например:

- Demand adapter берёт неправильный source;
- операция связана с неверным resource type из-за seed/config code;
- capacity unit ошибочно используется как demand unit;
- duplicate source of truth.

Если исправление требует бизнес-решения:
НЕ делать.

Если нужен schema/migration:
сначала описать причину в отчёте;
не расширять scope автоматически.

---

# 16. Никаких stress data

Не трогать:
- VIS-STRESS-001…030;
- их planning;
- assignments;
- allocations.

Не запускать массовый stress-test.

Можно использовать read-only Demand endpoint на существующих ТК.

---

# 17. Acceptance

PC-04.4F готова, если:

1. есть полная таблица Demand vs Capacity;
2. по каждой основной операции понятно:
   - откуда Demand;
   - в какой единице;
   - откуда Capacity;
   - в какой единице;
3. ручной раскрой разобран однозначно;
4. пошив разобран однозначно;
5. печать разделена machine vs operator;
6. ВТО и дизайн отмечены как ready или `BUSINESS RULE MISSING`;
7. CapacityResource/WorkCenter не дублируют machine capacity;
8. найденные defects классифицированы;
9. минимальные безопасные backend fixes выполнены только если очевидны;
10. stress dataset не изменён.

---

# 18. Проверки

Если код менялся:
- targeted tests;
- full backend tests;
- project check;
- git diff --check.

Если код не менялся:
- report-only допустим.

Frontend не менять.
Commit/push не выполнять.

---

# 19. Отчёт Codex

Структура отчёта обязательна:

## 1. Executive summary
Коротко:
- есть ли архитектурная ошибка;
- где именно;
- что является главным blocker.

## 2. Demand/Capacity matrix

| Operation | Demand source | Demand unit | Capacity source | Capacity unit | Status |
|---|---|---|---|---|---|

## 3. Manual cutting
Отдельный разбор:
- operations;
- resources;
- cutting_method;
- rates;
- recommended contract.

## 4. Sewing
- source norms;
- zero duration behavior;
- why current models fail.

## 5. Printing
- machine demand;
- machine capacity;
- operator demand;
- WorkCenter relation.

## 6. VTO / Design
Что отсутствует именно как business rule.

## 7. Fields classification

| Field | Entity | Meaning | Demand / Capacity / Other |

## 8. Defects
Разделить:
- CONFIG;
- CODE;
- BUSINESS RULE;
- UI.

## 9. Changes
Что изменено в backend, если изменено.

## 10. Next actions
Не больше 5 шагов в порядке приоритета.

## 11. Checks
tests/project check/diff.

Финальная строка:
`VIS-STRESS DATASET UNCHANGED`

## Выполнение — 2026-10-07

PC-04.4F завершена как audit-only результат. [Полный отчёт с обязательными разделами1–11](../architecture/demand-capacity-audit-pc-04-4f.md) содержит Demand/Capacity matrix по всем десяти требуемым направлениям, карту источников, adapter inventory, классификацию полей, отдельные разборы раскроя/пошива/печати/ВТО/дизайна и findings CONFIG/CODE/BUSINESS RULE/UI.

Главный config blocker: manual-cut связан с manual_cut/explicit_hours, хотя cutters/cutting_methods/item с method rates20/40 уже существует, но не связан и не настроен. base_rate200/400/500 в explicit labor resources не является нормой ТК. Печать связана только с print_operator; нужные machine links отсутствуют. У packaging Demand quantity ready, но Capacity hours не настроены. Для ВТО/дизайна/оператора печати — BUSINESS RULE MISSING. Пошив использует verified assembly/order snapshots,14 из33 локальных assembly norm rows имеют нулевую длительность; ноль не означает подтверждённую бесплатную работу.

CODE findings C1/P2: cutting Demand readiness зависит от наличия capacity rate, хотя amount=quantity. C2/P2: legacy machine load-state вычисляет часы, но маркирует unit item/meters; overrides канонических единиц нельзя безопасно смешивать с этими часами. Scheduler и новый WorkCenter load используют canonical units корректно. Исправления C1/C2 требуют согласованного contract/consumer cutover; нормы, данные и runtime здесь не изменялись.

Read-only local PostgreSQL :5432 audit с SET TRANSACTION READ ONLY; восемь Demand reads, in-memory unit/rate probes и9 existing focused tests passed. Source VIS-STRESS snapshot включает все30 ТК, planning/locks, assignments и allocations; before/after equality проверена. Ни live mass command, ни stress/seed scripts не выполнялись. Существующий WIP и frontend сохранены. Модели, migrations, config/links/norms не менялись; commit/push/merge и production apply не выполнялись.

Audit checkbox PC-04.4F закрыт отдельно от функциональной готовности; PC-04.4D и исторический PC-04 остаются открыты. Markdown и HTML twins обновлены в той же итерации. Рекомендуемая следующая итерация начинается с решения владельца по manual-cut/manual_lay/opt-cut и общему фонду; не более пяти действий перечислены в полном отчёте. Следующий этап/stress автоматически не начат.

Проверки: 9 focused Demand/cutting tests passed (1 migration/config test deselected в focused наборе); полный `python scripts/check_project.py` — exit0, 10/10 / PROJECT CHECK PASSED, 641 backend tests и351 frontend tests, OpenAPI/models/Alembic/lint/tsc/build/Compose. Полный check выполнял существующие isolated fixtures, не live stress dataset. Лог: `logs/pc-04-4f-project-check.log`. Renderer `--check`, `git diff --check` и matching code flags passed: PC-04.4F `[x]`↔done:true, PC-04.4D `[ ]`↔done:false. **HTML twin synced**. Известные dependency/cache/lint warnings не скрывались. Изменены только audit/task reports, canonical MD/HTML и документационный renderer; runtime/frontend/data/config не менялись. Новых P0/P1 не найдено; C1/C2 — P2 contract findings, CONFIG/BUSINESS readiness blockers оставлены явными.

VIS-STRESS DATASET UNCHANGED
