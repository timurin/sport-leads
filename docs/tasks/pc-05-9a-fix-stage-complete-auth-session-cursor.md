# PC-05.9A — Fix Stage Complete Auth Session

## Исполнитель
Cursor

## Приоритет
P1

## Reproduction
В PC-05.9:
- `Принять в работу` проходит;
- `Завершить` возвращает `Требуется вход`;
- stage остаётся `in_progress`;
- `completed_at` не записывается.

Разрыв:
`Kanban UI -> completeTechnicalCardStage -> postTechnicalCardAction -> POST /technical-cards/{id}/stages/{order}/complete`

Backend требует `PERM_SHOP_KANBAN_TRANSITION`, а frontend complete action не передаёт `sessionAuthHeaders`.

## Цель
Исправить только auth/session propagation для guarded production actions.

## Context
Использовать:
- `SL-PROJECT-MEMORY-v1`
- `SL-UI-CONTEXT-v1`
- targeted frontend auth/actions files

Без repo-wide scan.

## Сделать
1. Найти canonical authenticated request helper.
2. Использовать его для complete stage.
3. Проверить rollback stage и другие guarded production actions только если у них тот же дефект.
4. Не менять backend permissions.
5. Не обходить auth и не использовать hardcoded credentials.
6. 401/403 должны оставаться реальными auth/permission errors.

## Regression tests
- authenticated complete -> success;
- session headers передаются;
- missing session -> auth error;
- insufficient permission -> permission error;
- rollback authenticated, если guarded;
- start остаётся рабочим;
- UI меняется только после успешного response.

## E2E proof
На безопасной E2E-ТК:
1. открыть Kanban;
2. `Завершить` текущий участок;
3. проверить completed fact;
4. проверить переход current_workshop;
5. проверить Kanban/Queue после server response.

## Проверки
- targeted frontend tests;
- eslint;
- tsc;
- build;
- project check;
- git diff --check.

## Не делать
- backend permission changes;
- Calendar/Kanban architecture changes;
- forecast fix;
- P3 cleanup;
- commit/push.

Финальная строка:
`PC-05.9A STAGE COMPLETE AUTH FIXED`
