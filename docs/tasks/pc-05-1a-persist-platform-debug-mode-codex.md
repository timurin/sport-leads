# PC-05.1A — Persist Platform Debug Mode

## Исполнитель
Codex

## Контекст
PC-05.1 frontend завершён, но `Режим отладки` не сохраняется.

BACKEND GAP:
`platform-system-settings` не содержит поля `debug_mode`.

Frontend уже ожидает:
- `debug_mode: true|false`;
- при `false` Debug UI скрыт;
- при `true` доступен глобальный Debug Center;
- TechnicalCard Journal использует тот же diagnostics API.

## Цель
Добавить постоянную backend-настройку `debug_mode` в существующий контракт системных настроек платформы.

## Требования

### 1. Existing settings model
Использовать существующий `platform-system-settings`.
Не создавать отдельный settings store без необходимости.

Добавить:
`debug_mode: boolean`

Default:
`false`

### 2. API
Существующие GET/UPDATE system settings должны:
- возвращать `debug_mode`;
- принимать изменение `debug_mode`;
- сохранять значение;
- после backend restart значение остаётся сохранённым.

Не добавлять отдельный endpoint без необходимости.

### 3. Persistence
Если нужна migration:
- минимальная и обратимая;
- existing installations получают `false`;
- остальные settings не менять.

Если settings хранятся не колонками — использовать существующий canonical persistence mechanism.

### 4. Authorization
Изменение Debug Mode использует те же права, что и остальные системные настройки.

### 5. Contract
API всегда возвращает однозначно:
`debug_mode: false`
или
`debug_mode: true`

Не nullable/undefined.

### 6. E2E proof
Проверить:
1. GET -> false;
2. UPDATE -> true;
3. GET -> true;
4. backend restart/reload;
5. GET -> true;
6. UPDATE -> false;
7. GET -> false.

Проверить реальную local DB persistence.

### 7. Frontend compatibility
Не переписывать PC-05.1 UI.
Только убедиться, что текущий frontend contract работает с новым полем.

Если DTO расходится — минимально синхронизировать contract.

## Data-flow
Если производственные цепочки не затронуты:
`Data-flow: no changes required`.

## Tests
- system settings GET;
- system settings UPDATE;
- default false;
- persistence;
- authorization;
- backend full tests;
- project check;
- git diff --check.

## Не делать
- изменения Platform Diagnostics Engine;
- Scheduler/Demand/Calendar changes;
- auto-fix diagnostics;
- commit/push.

## Acceptance
Готово, если переключатель:
`Платформа -> Системные настройки -> Режим отладки`

реально сохраняется, переживает reload/restart и управляет уже реализованным Debug UI.

Финальная строка:
`PC-05.1A PLATFORM DEBUG MODE PERSISTENCE READY`

## Отчёт выполнения — 2026-10-10

Выбрана PC-05.1A по запросу владельца. Root cause: singleton `platform_system_settings` не имел поля debug_mode, read/update DTO и сервис его не передавали. Дополнительно PC-05.1 frontend имел BACKEND GAP вместо переключателя, а PUT action не отправлял поле. Сделана только минимальная синхронизация этого контракта, Debug Center не переписан.

Добавлена NOT NULL Boolean колонка `PlatformSystemSettings.debug_mode` с Python/server default=false. Существующие GET/PUT возвращают boolean; UPDATE принимает strict boolean, NULL отклоняется422. Явное изменение сохраняется через прежний settings service; legacy PUT без поля сохраняет существующее значение, не сбрасывая true. Права прежние: authenticated read / `system_settings.write` для изменения. Brand subset не расширялся, отдельного store/endpoint нет.

Migration `e1f2a3b4c567` после `d0e1f2a3b456`: upgrade добавляет только debug_mode defaultfalse, downgrade удаляет только колонку. Local PostgreSQL5432 upgrade выполнен. Owned temporary schema cycle upgrade/downgrade/upgrade PASS; legacy notes/settings сохранены, existing row получает false. Production/VPS не затрагивались. Evidence ignored `logs/pc-05-1a/migration-cycle.json`.

Frontend minimum: settings read/draft DTO, dirty-state comparison, PUT payload и существующий settings section подключены к boolean; вместо gap показан обычный checkbox в прежней форме Save. Gap helper теперь возвращает пустую строку при валидном boolean. Existing server action уже revalidates settings + root layout, markSaved уже вызывает router.refresh; новых cache rules нет. Shell JSX/spacing/navigation не менялись: **DS-SHELL-01 visual contract preserved; DS-SHELL-02 visual contract preserved**. Проверены существующая `/settings/system` и Debug visibility при1440×1000/390×1000; общий settings pattern сохранён, новых layout templates нет.

E2E реального local HTTP/DB/UI: GETfalse → PUTtrue/GETtrue → backend process restart на8000 → GETtrue → UI Savefalse/Debug hidden → UI Savetrue/reload/Debug visible → PUTfalse/GETfalse. Итог debug_mode=false; остальные settings совпали с исходными (updated_at закономерно изменён сохранением). Временная auth session отозвана. Evidence ignored `logs/pc-05-1a/e2e.json`, `debug-mode-1440.png`, `debug-mode-390.png`. Первоначальный stat reload завис на graceful shutdown; затем выполнен проверенный backend-only restart. Helper ожидал inherited background pipes, исправлен на DEVNULL и повторная цепочка PASS. Frontend3001 и порт3000 при рестарте не затрагивались.

Focused checks: 4 backend settings API tests PASS (default/read/update/persist/legacy omitted flag/NULL422/permission403), 8 frontend contract tests PASS. Full project check **10/10 PASS**, **775 backend / 388 frontend tests**; OpenAPI/Alembic/frontend lint/tsc/test/build/Compose included. Evidence: `logs/pc-05-1a/project-check.log`. Both generator --check and git diff --check PASS.

Файлы: backend settings model/schema/service + migration, существующий API regression file; frontend platform-system-settings DTO/helper/tests, platform-debug helper/tests, settings workspace и action; этот отчёт и canonical status twins. Platform Diagnostics Engine/Scheduler/Demand/Calendar не менялись. Исходный WIP сохранён. Новых P0/P1 реализации не обнаружено; исходные диагностические data gaps остаются отдельными задачами.

Data-flow: no changes required. Производственные DF-цепочки и их HTML не менялись. Roadmap/project-structure/ERP-check фиксируют только PC-05.1A с синхронными HTML twins; общий PC-05/PC-04.4S остаются открытыми. Следующий шаг — проверка владельцем сохранения переключателя в текущем UI; автоматически новую задачу не начинать. Commit/push не выполнялись.

PC-05.1A PLATFORM DEBUG MODE PERSISTENCE READY

Final canonical verification: **HTML twin synced**. A prior project-structure HTML checkpoint displayed PC-05.0D text under a duplicate PC-05.0C code; corrected its code to PC-05.0D before closing this iteration. PC-05.0C, PC-05.0D and PC-05.1A now have unique matching done=true objects; unfinished PC-04.4S remains done=false.

PC-05.1A PLATFORM DEBUG MODE PERSISTENCE READY
