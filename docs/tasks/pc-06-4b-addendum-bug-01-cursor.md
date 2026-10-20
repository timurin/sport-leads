# PC-06.4B ADDENDUM — Include BUG-01 shipping date fix (Cursor)

## Приоритет
Cursor уже выполняет `docs/tasks/pc-06-4b-capacities-e2e-release-cursor.md`. **До commit/push/deploy** включить этот короткий frontend fix в тот же релиз. Это дополнение к текущему заданию, не замена его E2E-проверок. Сначала проверить `git status`, существующий diff и возможные параллельные изменения; не перезаписывать чужой WIP. Если релиз уже отправлен — оформить отдельным коммитом и deploy.

## Источники
`docs/tasks/pc-bug-01-shipping-date-end-to-end-codex.md` — отчёт Codex, причина и тестовые сценарии; фактический код формы создания ТК, DTO/action, `shipping_date`, `desired_date`, планирование. Backend менять не требуется: Codex установил, что создание передаёт `desired_date`, но опускает `shipping_date`.

## Исправить
- В существующем frontend submit создания ТК явно передавать выбранную **Дату отгрузки** в `shipping_date` по backend-контракту. Сохранить независимые поля `desired_date` (если используется) и `shipping_date`; не подменять одно другим, не менять API/DB/миграции.
- Не изменять клиентскую бизнес-логику дат/ETA: сохранённая `shipping_date` должна отображаться в карточке ТК, сохранённом плане производства, ETA/slack/risk по существующим backend read models.
- Покрыть frontend тестом исходный регресс: ввод даты → submit payload `shipping_date`; проверка после reload и в плане. Не переписывать 30 backend регрессий Codex.

## Приёмка и release gate
- Authenticated local E2E: создать **тестовую** ТК с датой отгрузки; проверить API persistence, повторное открытие и план (с тем же значением), расчет риска по имеющемуся backend. Не изменять реальные ТК/производство и не выполнять destructive cleanup. При отсутствии безопасных тестовых данных — блокер и воспроизводимые шаги вместо выдуманного PASS.
- Завершить исходные проверки Capacities PC-06.4B. Targeted FE tests + `python scripts/check_project.py` 10/10 + `git diff --check`; необходимые docs/status и HTML twins синхронизировать.
- Commit оба **завершённых** изменения, task-файлы и релевантные docs; push `main` → deploy → smoke Capacities **и** создание ТК на sport-lead.ru без неразрешённых production writes. HTTP 200 login недостаточно.
- Отчёт: отдельно `PC-06.4B` и `BUG-01` (PASS/BLOCKED), commit SHA, deploy run, локальные и production проверки, не включённые чужие изменения.

## Вне scope
BUG-02, BUG-03, Employee/PlatformUser, новый Capacity API, Scheduler refactor.
