# PC-03.4C — Capacity UI Live API Integration

## Контекст
PC-03.4A завершён Codex:
- backend настроек мощности и исключений готов;
- persistence подтверждён;
- load state reserve/near/over/unknown реализован;
- переиспользованы ProductionStage / WorkCenter;
- migration: `v1w2x3y4z567`;
- backend tests: 513 passed;
- project check: 10/10.

PC-03.4B завершён Cursor:
- UI-F готов;
- frontend adapter сейчас ожидает `/capacity/rules`;
- при 404 использует локальный fallback.

Реальный backend-контракт опубликован в:
`docs/architecture/production-calendar-capacity-pc-03-4a.md`

## Цель
Подключить UI-F к реальному API PC-03.4A без изменения backend-контракта.

## Scope
Только frontend / Cursor.

### 1. Прочитать опубликованный контракт
Использовать как источник истины:
`docs/architecture/production-calendar-capacity-pc-03-4a.md`

Не придумывать новый API.

### 2. Обновить adapter
Привести:
`frontend/lib/production/calendar-capacity.ts`

к реальным endpoints `/capacity/settings` и payloads из опубликованного контракта.

### 3. Убрать fallback как основной режим
После появления live API:
- не использовать локальные demo/settings при обычном 404;
- 404/5xx показывать как реальную ошибку API;
- локальный fixture можно оставить только для isolated tests/story/dev fixture, если он нужен тестам;
- production runtime не должен скрывать отсутствие backend.

### 4. UI-F
Существующий экран сохранить:
`/production/calendar/capacity`

Не переделывать дизайн и UX.

Проверить реальные операции:
- load settings;
- edit base capacity;
- save;
- create date exception;
- update exception, если поддерживается контрактом;
- delete exception;
- reload persistence.

### 5. Типы
Синхронизировать frontend types 1:1 с backend contract.

Не добавлять frontend-only поля в request payload.
Допустимые derived/display поля держать отдельно от API DTO.

### 6. Ошибки
Показать понятное сообщение при:
- 400/422 validation error;
- 404;
- 500/network error.

Не подменять ошибку локальными значениями.

## Не делать
- не менять backend;
- не менять DB/migrations;
- не менять UI-A;
- не делать load indicators в недельной очереди;
- не менять navigation;
- не трогать UI-G/H;
- не делать commit/push/merge.

## Тесты
- adapter contract tests;
- GET live-shape parsing;
- update base capacity;
- create/delete exception;
- validation/error states;
- no silent fallback on 404;
- full frontend tests.

## Проверки
- targeted frontend tests;
- full frontend tests;
- npm run lint;
- npx tsc --noEmit;
- production build;
- git diff --check;
- project check.

Если доступна авторизованная локальная сессия:
- проверить live API persistence в браузере.
Если нет — подтвердить adapter/API интеграцию тестами и не блокировать задачу только из-за отсутствия login session.

## Acceptance
Готово, если:
1. UI-F читает данные из реального `/capacity/settings`;
2. сохранение уходит в backend;
3. исключения сохраняются и удаляются;
4. после reload данные остаются;
5. 404 больше не маскируется локальным fallback;
6. backend/DB/UI-A не изменены.

## Отчёт Cursor
Кратко:
- какие endpoints подключены;
- какие frontend файлы изменены;
- какие поля контракта используются;
- подтверждение persistence;
- tests/checks;
- подтвердить отсутствие изменений backend/DB/UI-A;
- подтвердить отсутствие commit/push.
