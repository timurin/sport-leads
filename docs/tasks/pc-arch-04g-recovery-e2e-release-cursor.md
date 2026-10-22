# ARCH-04G-R — Resume E2E and gated release (Cursor)

## Источники истины
- `docs/architecture/decisions/ADR-036-employee-platform-user-link.md`
- `docs/architecture/employee-user-link-arch-04a.md`
- `docs/architecture/access-groups-arch-04e.md`
- `docs/architecture/unified-employee-access-navigation-arch-04d.md`
- `docs/tasks/pc-arch-04g-unified-access-e2e-release-cursor.md`
- `AGENTS.md` и текущий UI-контракт; не повторять уже подтверждённые тесты без необходимости.

## Контекст
ARCH-04G остановлен без commit/push/deploy, HEAD `236cc65`. Локальные миграции upgrade/downgrade/upgrade и E2E связи Employee 2 ↔ PlatformUser 18, двух групп и optimistic locking (409) прошли. Backend :8000 сейчас недоступен. В браузере оставлен **несохранённый** черновик матрицы `arch04g_beta` с `size_grids.write`; последнее подтверждённое GET не содержало этого права. Тестовые сущности в локальной `sport_leads`: Employee 2, PlatformUser 18, `arch04g_alpha` (version 2), `arch04g_beta`. Рабочие admin (1), lm@mosmade.ru (2) не затронуты.

## Выполнить
1. Диагностировать и восстановить локальный backend :8000; проверить API/auth и БД, не сбрасывая данные/миграции и не изменяя production. Сначала снять фактический снимок фикстур и эффективных прав. Если состояние отличается от отчёта — зафиксировать расхождение и остановить опасные изменения.
2. Для несохранённого черновика группы `arch04g_beta` проверить отмену/закрытие и отсутствие записи `size_grids.write` через GET; **не применять** это право ради теста. После этого проверить штатное сохранение матрицы preview/apply на безопасном тестовом разрешении, с повторным GET и version; вернуть тестовую матрицу в начальное состояние либо удалить фикстуру.
3. Проверить unlink с `expected_employee_id`, подтверждением, повторным GET и корректным возвратом UI; негативные 403, 409, защиту системной группы и последнего администратора — на изолированных фикстурах/безопасных запросах или тестами, не меняя admin и реальные роли. Никаких повышений привилегий рабочим пользователям.
4. NAV-04 E2E: list → employee modal → access/groups matrix → Escape/Close обратно по стеку; Back/Forward, прямой URL, фокус, сохранение/сброс черновика и отсутствие горизонтального overflow на 1440/768/390/320. Проверить, что legacy `/settings/users?user=1` открывает **учётную запись**, а не Employee 1.
5. Аккуратно удалить **только** созданные для ARCH-04G локальные фикстуры после проверки зависимостей и подтверждения их принадлежности тесту; перед удалением отвязать Employee 2 ↔ PlatformUser 18. Проверить GET, что не осталось тестовых связей, прав и групп. Если безопасное удаление невозможно — описать оставшиеся записи, не использовать массовую очистку.
6. `python scripts/check_project.py` (10/10), targeted E2E/tests, `git diff --check`, ревью diff и миграций ARCH-04A/04E; убедиться, что нет чужого WIP и скрытых деструктивных изменений.
7. Только после полного PASS: один осмысленный commit ARCH-04A/04D/04E/04F/04G (только относящиеся изменения), push `main`, успешный deploy и production QA **без записи** в реальные сотрудники/учётки/группы. Проверить миграцию и версию production безопасно; не запускать destructive downgrade. При блокере — STOP, никакого commit/push/deploy.

## Отчёт
Краткая матрица PASS/BLOCKED, результаты read-back после apply/unlink, фактическая очистка фикстур, PROJECT CHECK, `git status`, commit SHA, workflow URL и production checks. NAV-04 пока **не** переносить в глобальные правила `AGENTS.md` до отдельного утверждения после E2E.

## Результат локальных ворот
Снимок совпал с отчётом ARCH-04G. Черновик `size_grids.write` отброшен, GET его не содержал. Безопасное apply добавило `audit.read` в `arch04g_beta` (version 2); эффективные права учётки 18 не выросли. Повтор PATCH со старым fingerprint вернул 409 `access_changed` и не изменил матрицу. Матрица возвращена к `sewing_cabinet.read_own` (version 3), затем группы удалены. Unlink PlatformUser 18 выполнен POST `/employee-unlink` с `expected_employee_id=2`; GET вернул `employee_id=null`, карточка показала «Нет учётной записи». Чужой `expected_employee_id=999` вернул 404 и связь не снял. Admin (1) и lm@mosmade.ru (2) не менялись. Системная группа и self-lockout проверены preview без apply; last-admin покрыт тестом, живым пользователям роль admin не назначалась. NAV-04: стек, Back/Forward, прямой URL как полная страница, фокус, overflow 0 на 1440/768/390/320. `/settings/users?user=1` открыл `/settings/employees/accounts/1`. Группы `arch04g_alpha` и `arch04g_beta` удалены (GET 404). Employee 2 архивирован (`is_active=false`), PlatformUser 18 деактивирован, без связи и без прав. `python scripts/check_project.py`: 10/10, pytest 1098, frontend tests 510.
