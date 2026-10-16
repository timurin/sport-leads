# IC-G03 — Calendar Allocation Date & Unit Consistency

## Исполнитель
Codex

## Источник
PC-05.2 `SL-INVARIANT-COVERAGE-v1`

## Priority
P1

## Контекст
После IC-G01 и IC-G02 остаётся P1-класс ошибок, связанный с тем, что `CalendarAllocation` может не совпадать с:

- датами своего `CalendarAssignment`;
- единицами измерения Demand/Capacity;
- ресурсом/WorkCenter, на который назначена операция;
- фактическим объёмом операции.

Это может давать формально сохранённый план, который математически или календарно некорректен.

## Цель
Защитить consistency цепочки:

`Demand`
→ `CalendarAssignment`
→ `CalendarAllocation`
→ `CapacityResource / WorkCenter`

## Targeted data-flow
Использовать только релевантные цепочки:
- `DF-DEMAND-CAPACITY`
- `DF-WORKCENTER`
- `DF-SCHEDULER-CALENDAR`
- `DF-DIAGNOSTICS`

Не читать весь `SL-DATA-FLOW-v1`.

## Инварианты

### 1. Date bounds
Каждый `CalendarAllocation` должен попадать внутрь интервала своего `CalendarAssignment`.

Проверить:
- allocation.start >= assignment.start
- allocation.end <= assignment.end
- start < end
- timezone/date semantics единообразны

Не допускать allocation вне assignment span.

### 2. Unit compatibility
Единица allocation должна быть совместима с Demand и Capacity target.

Примеры:
- labor-hours ↔ labor resource;
- linear meters ↔ equipment/operation capacity in linear meters;
- items ↔ item/team rate;
- milestone не создаёт capacity allocation.

Нельзя молча конвертировать несовместимые units.

### 3. Quantity / amount consistency
Сумма allocations по assignment должна соответствовать рассчитанной потребности с учётом допустимой точности/округления.

Нельзя:
- потерять часть demand;
- создать лишний allocation;
- удвоить объём;
- оставить stale amount после пересчёта.

### 4. Resource ownership
Allocation должен ссылаться на ресурс, допустимый для конкретной операции.

Для оборудования:
- физическая машина берётся через WorkCenter;
- не должно быть allocation на detached/неактивный WorkCenter;
- не дублировать одну физическую мощность через параллельный CapacityResource.

### 5. Replan
После replan:
- старые allocations удалены/заменены атомарно;
- новые соответствуют новому assignment span и amount;
- не остаётся смесь старых и новых единиц/дат.

## Guards
Проверки должны выполняться:
- до persistence новой allocation;
- при replan;
- при изменении assignment;
- при detach/delete resource/workcenter, если связь используется активным планом.

Invalid state не сохранять.

## Diagnostics
Добавить/уточнить:

- `calendar_allocation_outside_assignment`
- `calendar_allocation_unit_mismatch`
- `calendar_allocation_amount_mismatch`
- `calendar_allocation_resource_mismatch`

Category:
`INTEGRITY` или `DATA_FLOW` — в зависимости от фактической причины.

Diagnostic должен показывать:
- TK;
- snapshot node;
- operation;
- assignment id;
- allocation id;
- expected unit/value/date;
- actual unit/value/date;
- resource/workcenter;
- fix_action.

## Existing data audit
Просканировать существующие allocations.

Разделить:
- active production records;
- test/stress records.

Не выполнять массовый auto-fix.

Для найденных нарушений:
- вывести точный список;
- тестовые записи можно исправить только если это безопасно и явно подтверждено;
- производственные данные не менять автоматически.

## Tests
Минимум:
- valid allocation inside assignment -> pass;
- allocation outside assignment -> rejected;
- incompatible unit -> rejected;
- amount mismatch -> diagnostic/guard;
- replan replaces allocations cleanly;
- detached WorkCenter cannot receive new allocation;
- milestone produces no capacity allocation;
- ONE OF uses allocations only selected member;
- rounding tolerance tested explicitly.

## Data-flow update
Если semantics уточняются:
обновить:
- `DF-DEMAND-CAPACITY`
- `DF-WORKCENTER`
- `DF-SCHEDULER-CALENDAR`
- `DF-DIAGNOSTICS`

Синхронизировать HTML twin.

## Проверки
- targeted tests;
- backend full tests;
- project check;
- DB integrity;
- orphan scan;
- git diff --check.

## Не делать
- Scheduler rewrite;
- новые единицы измерения без необходимости;
- broad capacity refactor;
- frontend changes;
- массовый repair;
- commit/push.

## Отчёт
Коротко:
1. найденные inconsistency gaps;
2. guard locations;
3. diagnostics;
4. existing data findings;
5. tests;
6. следующий P1 backlog item.

Финальная строка:
`IC-G03 CALENDAR ALLOCATION CONSISTENCY PROTECTED`

## Отчёт выполнения — 2026-10-11

Выбрана IC-G03: следующий P1 после IC-G02, прямо назначенный владельцем. Следующая задача не запускалась.

Найденные gaps: manual assignment date move оставлял allocations на старых датах; nonlegacy resource unit edit сохранял старую allocation unit; низкоуровневый writer мог сохранять частичные/лишние amounts; proposal persistence полагался на builder без полного consistency preflight; WorkCenter можно было отключить с сохранённой нагрузкой. Отдельные allocation diagnostics не сравнивали суммы с current selected Demand.

Общая проверка — `backend/app/services/calendar_allocation_consistency.py`. Existing adapters рассчитывают Demand; Scheduler не переписан. Guards подключены до записи add_allocation, manual assignment save и persist_plan (все proposed steps проверяются до удаления прежнего плана/audit), к canonical/legacy resource edits/delete, WorkCenter deactivate/move и unlink использованного operation/resource. Сохраняются scheduler/card/assignment locking и transactional replacement IC-G02. Ни dates, ни units, ни суммы не мигрируются автоматически.

Контракт дат сохранён: CalendarAllocation хранит один local planning DATE, assignment — включительные DATE bounds. start<=end, same-day валиден; отдельных allocation.start/end timestamps в модели нет. Условие start<end из общего описания не вводится для дневного chunk. Каждая date должна оставаться внутри proposed assignment span. Расширение span, сохраняющее нагрузку, разрешено; исключение сохранённых дней возвращает409 и требует explicit replan.

Суммы по каждому mandatory resource равны рассчитанному Demand, один раз округлённому вверх до0.0001. Raw Demand1/3600 даёт saved total0.0003;0.0002 теряет работу и отклоняется,0.0004 создаёт лишний quantum и также отклоняется. Нет дополнительного floating epsilon или независимого rounding каждой копии Demand. Физическая машина — ровно один eligible WorkCenter; inactive/incompatible alternative не блокирует выбранную валидную машину (reused eligible_machine_keys). Existing nonphysical M:N sharing между цехами сохранён. Milestone не создаёт capacity allocation, исключённый ONE OF member не получает нагрузку.

Single add_allocation проверяет полный prospective assignment: частичная/unverified multi-resource запись не коммитится. Для многодневного/многоресурсного плана используется atomic Scheduler persistence. Неизвестный Demand не заменяется вымышленным amount; такой сохранённый plan получает DATA_FLOW current_demand_unverified и не проходит новые allocation/assignment writes. Сравнение с current Demand не является frozen revision contract; quantity/norm source writers и execution revision gates остаются IC-G04.

Diagnostics: INTEGRITY calendar_allocation_outside_assignment, calendar_allocation_unit_mismatch, calendar_allocation_resource_mismatch; DATA_FLOW calendar_allocation_amount_mismatch, включая явный unverified reason. Details: TK/node/op/assignment/allocation/resource/WorkCenter и expected/actual date/unit/value, fix_action. Unknown expected amount=NULL. Shared card/platform resolver используется без auto-fix; старые generic date/unit duplicates заменены подробной выдачей. HTTP409 сохраняет строковый detail; X-Diagnostic-Code/Category отражают фактическую category. Несовместимая unit на low-level request также может быть отвергнута существующей schema/service validation до insert.

Existing data audit: local localhost:5432, allocations0; active production/unknown0, test/stress candidates0, historical/unknown0; violations0, SQL writes0, repair performed=false. Stress classification была бы только name-based candidate, не разрешением на ремонт. Аудит пустого набора не является подтверждением качества будущих production plans. Exact report: ignored `logs/ic-g03/allocation-audit.json`. FK/orphan scan проверил247 ссылок, orphan refs0. Производственные, неизвестные и тестовые локальные данные не менялись; VPS не использовался.

Файлы: новый allocation consistency service; интеграции production_calendar, calendar_allocations, production_scheduler, production_diagnostics, platform_health, capacity_resources, production_capacity, shop_routings, tech_operations; PlanLinkageConflict.category теперь сохраняет INTEGRITY/DATA_FLOW из diagnostic. Добавлен test_calendar_allocation_consistency_ic_g03.py (22 сценария); IC-SC-05/IC-DC-03 gap-proof превращены в reject regressions, старые lifecycle/storage/equipment fixtures адаптированы к строгому контракту и typed conflict. Legacy storage fixtures намеренно используют isolated ORM для проверки хранения, не выдумывают Demand. DB models/DTO без изменений, миграция не требуется, frontend не изменён.

Проверки:230 targeted passed; full backend880 passed; frontend390 passed; project check10/10, включая OpenAPI/Alembic/lint/tsc/test/build. Alembic: no new upgrade operations. Data-flow/invariant/production-calendar generator --check и git diff --check прошли. Initial equipment test ожидал старый CalendarError вместо нового controlled INTEGRITY conflict; исправлено ожидание с проверкой diagnostic code, guard не ослаблен. Final required checks проходят; remaining warnings — existing dependency/cache deprecations. Evidence: ignored `logs/ic-g03/project-check.log`, `targeted.log`, `db-integrity.json`, `allocation-audit.json`, `canonical-docs.diff`.

P0/IC-G01 и P1/IC-G02 regressions сохранены. IC-SC-05/IC-DC-03 закрыты на covered write paths. Матрица41 invariants: P0=0/P1=4/P2=13/P3=24. Остаются IC-G04 (quantity/norm/input revision impact), IC-G05 (frozen completeness), IC-G06 (destructive operation deletion); unrelated model/assembly binding требует отдельного review. P2/P3 попутно не исправлялись. Следующая рекомендуемая итерация — IC-G04, не запускалась.

Data-flow updated: DF-DEMAND-CAPACITY, DF-WORKCENTER, DF-SCHEDULER-CALENDAR, DF-DIAGNOSTICS. Invariant matrix и ADR-017 обновлены. Roadmap/Project structure/ERP-check: IC-G03 выполнен, owner review pending; MD[x] ↔ HTML done:true проверены. HTML twin synced. PC-05/PC-04.4S и stage transition не закрывались. Commit/push не выполнялись; существующий WIP сохранён.

IC-G03 CALENDAR ALLOCATION CONSISTENCY PROTECTED
