# PC-05.14 — Final Full Production E2E on STAB-P1

## Исполнитель
Cursor

## Цель
Продолжить существующую `STAB-P1-001-1` (id 159) от текущей точки и довести её до полного `Completed`.

Не исправлять архитектуру по ходу.
Не создавать новую ТК.
Не трогать карты 157 и 158.
Если встречается новый P0/P1 — остановиться на точном воспроизводимом blocker и выдать отчёт.

## Текущее подтверждённое состояние
`STAB-P1-001-1`
- SKU 201.2;
- quantity = 4;
- personalization sum = 4;
- Дизайн завершён;
- Печать начата;
- material fact modal для Сублимации работает корректно;
- Термоперенос ещё не завершён;
- production facts предыдущих этапов не сбрасывать.

## 1. Пройти оставшийся маршрут
Продолжить через UI по snapshot route этой ТК:
- завершить текущую операцию Печати;
- Термоперенос;
- Раскрой;
- Пошив;
- ВТО / Контроль качества;
- Упаковка;
- `Completed`.

Фактический порядок брать только из snapshot, не из визуального расположения блоков.

## 2. Для каждого шага
На каждой операции/участке:
1. открыть Kanban;
2. проверить current workshop;
3. проверить Queue;
4. если waiting — `Принять в работу`;
5. дождаться server response;
6. проверить TechnicalCard / Kanban / Queue / Calendar;
7. `Завершить`;
8. если нужен material fact — пройти canonical modal flow;
9. дождаться server response;
10. проверить переход на следующий snapshot node/workshop;
11. сохранить screenshot;
12. записать PASS/FAIL.

Не использовать DnD.

## 3. Проверять после каждого transition
Таблица:

`Step | Snapshot node | Lifecycle | Current workshop | Kanban | Queue | Calendar | Qty | Personalization | PASS/FAIL`

Ожидания:
- quantity всегда 4;
- personalization всегда 4;
- Kanban = текущий факт;
- Queue = только waiting текущего workshop;
- Calendar не двигает Kanban сам;
- следующий шаг открывается только после successful complete;
- material fact относится только к текущей операции.

## 4. Известные P2 — только фиксировать
Не чинить в рамках этой задачи.

### Forecast
После reload проверить, сохраняется ли ETA.

### Kanban refresh
Проверить, обновляется ли доска сразу после start/complete без full reload.

### Calendar operation status
Проверить, не получает ли соседняя pending operation статус текущей `В работе`.

### Search / date UX / duplicate controls
Не исследовать глубже, только если напрямую мешают текущему E2E.

## 5. Финальное ожидаемое состояние
После последней required operation:
- lifecycle = completed;
- current_workshop = none/completed semantics;
- Kanban не содержит ТК среди активных;
- Queue не содержит ТК;
- все required snapshot nodes completed;
- quantity = 4;
- personalization = 4;
- Calendar plan/history сохранён;
- material facts сохранены только на соответствующих operations;
- assignments/allocations без orphan;
- новых P0/P1 нет.

## 6. Финальная projection consistency
Собрать таблицу:

`Projection | Expected | Actual | PASS/FAIL`

Минимум:
- TechnicalCard;
- route snapshot;
- stage results;
- Kanban;
- Queue;
- Calendar;
- quantity;
- personalization;
- material facts;
- assignments;
- allocations.

## 7. Verdict
Если полный маршрут завершён без нового P0/P1:

`PASS — PRODUCTION CORE END-TO-END CONFIRMED`

В этом случае:
- production core считать baseline candidate;
- не предлагать новый architectural refactor;
- P2/P3 вынести отдельным UX stabilization backlog.

Если найден новый blocker:

`FAIL — PRODUCTION CORE BLOCKED`

Зафиксировать только:
- exact step;
- expected;
- actual;
- API/action;
- probable layer;
- severity;
- screenshot/log.

Не чинить blocker внутри этой задачи.

## 8. Артефакты
Сохранить:
- screenshots: `logs/pc-05-14/screenshots/`
- debug/logs: `logs/pc-05-14/`
- report:
  `docs/tasks/pc-05-14-final-full-production-e2e-stab-p1-cursor.md`

## Ограничения
Не делать:
- architecture refactor;
- Scheduler redesign;
- Calendar redesign;
- Kanban redesign;
- Queue redesign;
- new migrations;
- permission redesign;
- commit/push.

Если код не менялся — полный test suite не нужен; это E2E/diagnostic task.

## Acceptance
Готово, если:
1. `STAB-P1-001-1` полностью `Completed` либо остановлена на новом воспроизводимом P0/P1;
2. есть пошаговый PASS/FAIL;
3. есть final projection consistency;
4. известные P2 перечислены отдельно;
5. можно принять решение: freeze production core или ещё один точечный blocker-fix.

Финальная строка:

`PC-05.14 FINAL FULL PRODUCTION E2E COMPLETE`

## Результат прогона

Карта `STAB-P1-001-1` (id 159) доведена по snapshot-порядку до `completed`. Новая карта не создавалась. Карты 157 (`E2E-PROD-001-1`, in_progress, quantity 4, stage 5) и 158 (`UX-OP-001-1`, in_progress, quantity 1, stage 2) не менялись. Код, миграции и roadmap не менялись.

Старт прогона: Дизайн и Сублимационная печать уже completed; текущий узел — Термоперенос (stage 1142), участок Печать, waiting.

| Step | Snapshot node | Lifecycle | Current workshop | Kanban | Queue | Calendar | Qty | Personalization | PASS/FAIL |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Принять Термоперенос | 3 Термоперенос in_progress; раскрой pending | in_progress | Печать | колонка Печать; после reload «В работе» / «Завершить» | после accept очередь Печати карту не содержит | назначения 365–371 на месте, канбан сам не переехал | 4 | 4 | PASS |
| Завершить Термоперенос | 3 completed; модалки материалов нет | in_progress | Раскрой, waiting | после reload колонка Раскрой, «Принять в работу» | очередь участка 2 содержит 159; 3/4/6 нет | план не сдвинул колонку | 4 | 4 | PASS |
| Принять Раскрой | 4 Ручной раскрой in_progress; пошив pending | in_progress | Раскрой | колонка Раскрой, «В работе»; сосед SO-2026-000004-2 остался «Ожидает» | после accept очередь раскроя карту не содержит | соседний pending-узел карты не стал in_progress | 4 | 4 | PASS |
| Завершить Раскрой | 4 completed; модалки материалов нет | in_progress | Пошив, waiting | после reload колонка Пошив, «Принять в работу» | очередь пошива принимает карту | план не сдвинул колонку | 4 | 4 | PASS |
| Принять Пошив | 5 Пошив in_progress; ВТО pending | in_progress | Пошив | колонка Пошив, «В работе»; сосед E2E-PROD-001-1 остался «Ожидает» | после accept очередь участка 4 пуста для 159 | поздние узлы остались pending | 4 | 4 | PASS |
| Завершить Пошив | 5 completed; модалки материалов нет | in_progress | Контроль качества, waiting | колонка «Контроль качества», «Принять в работу» | очередь участка 6: операция ВТО, waiting | план не сдвинул колонку | 4 | 4 | PASS |
| Принять ВТО | 6 ВТО in_progress; Упаковка pending | in_progress | Контроль качества | колонка «Контроль качества», «В работе» | после accept очередь участка 6 пуста | Упаковка не стартовала вместе с ВТО | 4 | 4 | PASS |
| Завершить ВТО | 6 completed; модалки материалов нет | in_progress | Контроль качества, waiting | та же колонка, снова «Принять в работу» | очередь участка 6: операция Упаковка, waiting | план не сдвинул колонку | 4 | 4 | PASS |
| Принять Упаковку | 7 Упаковка in_progress | in_progress | Контроль качества | колонка «Контроль качества», «Завершить» | после accept очередь участка 6 пуста | предыдущие узлы completed | 4 | 4 | PASS |
| Завершить Упаковку | 7 completed; модалки материалов нет | completed | none / workshop_state completed | среди активных карточек нет | очереди участков 1, 2, 3, 4, 6 карту не содержат | 7 назначений сохранены, operation_state completed | 4 | 4 | PASS |

### Projection

| Projection | Expected | Actual | PASS/FAIL |
| --- | --- | --- | --- |
| TechnicalCard | completed | status completed, current_stage_order пустой | PASS |
| route snapshot | 7 узлов маршрута «Дизайн + Сублим + Пошив» | узлы 1140–1146 на месте | PASS |
| stage results | все required узлы completed, со started_at и completed_at | 1–7 completed | PASS |
| Kanban | нет среди активных | после reload колонки без STAB-P1-001-1 | PASS |
| Queue | нет | waiting-очереди участков 1, 2, 3, 4, 6 без 159 | PASS |
| Calendar | план сохранён и сам канбан не двигает | назначения 365–371, даты 2026-10-15…2026-10-15, board API operation_state completed, quantity 4 | PASS |
| quantity | 4 | 4.000; номер STAB-P1-001-1/4 | PASS |
| personalization | 4 | 4 unit lines, вкладка «Персонализация (4)» | PASS |
| material facts | только материалы текущей операции | только сублимационная бумага 3.200 и чернила 32.000, op 1; Термоперенос, раскрой, пошив, ВТО и упаковка завершились без модалки | PASS |
| assignments | по узлу, без сирот | 7 строк, stage_result 1140–1146 | PASS |
| allocations | по назначению, без сирот | 7 allocations, по одной на назначение | PASS |

`PASS — PRODUCTION CORE END-TO-END CONFIRMED`

Production core можно считать baseline candidate. Новый architectural refactor не предлагается.

### P2/P3, отдельно, не чинились

- Kanban не обновляет кнопку на месте: сразу после «Принять в работу» и «Завершить» подпись остаётся прежней, факт уже записан на сервере. Полная навигация показывает верное состояние.
- Прогноз на карточке после reload пустой: «Прогноз появится после расчёта плана», хотя назначения есть.
- На завершённой карточке рядом с зелёным «Завершена» остаётся синий чип «В работе»: `wip_status` остался `in_work`.
- Блок «Технологический процесс» на завершённой карточке показывает «Требует настройки».
- Канбан имеет пустую колонку «ВТО и Упаковка»; факт участка для ВТО и Упаковки — «Контроль качества». Карточка встала в колонку факта.
- Hydration warning в оболочке (известный P3).

Скриншоты: `logs/pc-05-14/screenshots/`.

PC-05.14 FINAL FULL PRODUCTION E2E COMPLETE
