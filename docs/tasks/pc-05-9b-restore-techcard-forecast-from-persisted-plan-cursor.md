# PC-05.9B — Restore TechnicalCard Forecast from Persisted Plan

## Исполнитель
Cursor

## Приоритет
P2

## Reproduction
После `Пересчитать план` карточка показывает ETA, но после reload снова показывает:
`Прогноз появится после расчёта плана`

При этом CalendarAssignments сохранены и Calendar их показывает.

## Цель
TechnicalCard planning panel должен восстанавливать forecast/ETA из persisted plan при обычной загрузке страницы.

## Context
Использовать:
- `SL-PROJECT-MEMORY-v1`
- `SL-UI-CONTEXT-v1`
- `DF-SCHEDULER-CALENDAR`
- targeted TechnicalCard read-model/components

Без repo-wide scan.

## Source of truth
Использовать существующий persisted planning source:
- TechnicalCard planning read model;
- CalendarAssignment summary;
- persisted ETA, если canonical.

Не считать ETA на frontend вручную, если backend уже владеет semantics.

## Сделать
1. На initial load получать persisted planning summary.
2. Показывать ETA/expected completion.
3. После replan UI может обновиться из action response, но reload должен дать тот же результат.
4. Empty state показывать только когда сохранённого плана действительно нет.
5. Stale/replan_required не показывать как актуальный forecast.

## Backend gap
Если текущий API не отдаёт достаточный persisted planning summary:
- зафиксировать точный `BACKEND GAP`;
- не дублировать scheduler logic на frontend;
- остановить реализацию после доказанного gap.

## Tests
- no plan -> empty;
- plan exists -> ETA visible on initial load;
- reload preserves ETA;
- replan updates ETA;
- stale plan not shown as current;
- persisted assignments exist without transient action state -> ETA visible.

## Проверки
- targeted frontend tests;
- eslint;
- tsc;
- build;
- project check;
- git diff --check.

## Не делать
- Scheduler changes;
- stage auth fix;
- Kanban/Queue changes;
- P3 cleanup;
- commit/push.

Финальная строка:
`PC-05.9B TECHCARD PERSISTED FORECAST RESTORED`

## BACKEND GAP — 2026-10-14

Реализация остановлена. Код не менялся.

Панель прогноза (`TechCardProcess`) читает только `useState` ответа `POST /technical-cards/{id}/schedule`. После reload состояние пустое, поэтому виден `Прогноз появится после расчёта плана`, хотя `CalendarAssignment` уже сохранены.

На обычной загрузке карточки нет канонического persisted ETA:

- `TechnicalCardRead` и `ProductionState` отдают `planning_state` (`unplanned` / `partial` / `planned` / `stale` / `invalid`), но не `planned_completion_date`, `on_time`, `buffer_days`, `delay_days`.
- `GET /technical-cards/{id}/production-diagnostics` отдаёт `calendar_assignments[].planned_start/planned_end`. Клиент этот список отбрасывает и оставляет только `diagnostics`. Сводить даты к ETA на фронте нельзя: каноническая формула `max(planned_end)` и запас к отгрузке принадлежат планировщику (`production_scheduler.py`, то же чтение в `workshop_queue.py`).
- `planned_completion_date` есть только у `ScheduleRead` после `POST /technical-cards/{id}/schedule` и `POST /production-calendar/schedule`. Отдельного read сохранённого плана нет.

Нужен read-only summary на загрузке ТК: persisted `planned_completion_date` плюс свежесть (`planning_state`, чтобы `stale` / `replan_required` не показывались как актуальный прогноз). Считать эту дату на фронте из назначений нельзя.
