# PC-04.4L — Route Readiness = Demand Runtime Readiness

## Исполнитель
Codex

## Источник истины
Использовать текущие PC-04.4G snapshot/runtime graph, PC-04.4I ONE OF runtime, Demand resolver/Scheduler blockers и существующий route/tech-operation readiness API.

## Проблема
В `/settings/catalogs/routings/[id]` операции показываются `Готово`, но standalone ТК с тем же маршрутом получает `missing_operator_norm` и `Маршрут требует настройки`.

Значит editor readiness и Scheduler/Demand readiness используют разные критерии.

## Цель
Сделать единый источник readiness: если Scheduler/Demand не может построить потребность обязательной выбранной операции, маршрут не должен показывать её полностью готовой.

## Сделать
1. Найти конкретную операцию(и), которая даёт `missing_operator_norm` для текущего маршрута, и зафиксировать regression test.
2. Не добавлять ручной ввод в ТК.
3. Route/template readiness должен возвращать по node: status, human message, internal reason code, operation id/name.
4. Для ONE OF readiness маршрута проверять default/selected member; невыбранные alternatives не блокируют runtime plan.
5. Использовать тот же Demand/runtime resolver, что Scheduler, либо общий shared helper. Не дублировать правила.
6. `missing_operator_norm` должен указывать конкретную TechOperation.
7. Resource/work schedule readiness не считать достаточным, если Demand rule отсутствует.
8. Корректно настроенные маршруты не ломать.

## Ожидаемый результат
Например:
- operation: `Подготовка макетов к печати`
- status: `blocked`
- reason: `missing_operator_norm`
- message: `Не настроена производственная норма операции «Подготовка макетов к печати»`

## Не делать
- manager manual hours;
- Scheduler semantics changes;
- Capacity/WorkCenter changes;
- ONE OF semantics changes;
- VIS-STRESS changes;
- новый общий аудит;
- commit/push.

## Проверки
- targeted regression текущего конфликта;
- all demand rules -> ready;
- required node missing norm -> blocked;
- ONE OF only selected/default member affects route readiness;
- Scheduler blocker и readiness reason совпадают;
- backend tests;
- project check;
- git diff --check.

## Краткий отчёт
Только root cause, изменённый shared readiness source, конкретная проблемная операция, тесты и remaining gap.

Финальная строка:
`PC-04.4L ROUTE READINESS CONSISTENT WITH DEMAND RUNTIME`
