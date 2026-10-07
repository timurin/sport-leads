# PREFLIGHT-FE-02 — Fix 3 failing frontend tests

## Контекст
PC-PREFLIGHT-01 завершён: локальный PostgreSQL работает, Alembic на head, backend 468 tests passed.
Общий project check сейчас 9/10 из-за 3 frontend-тестов.
Frontend lint уже очищен до 0 errors / 81 warnings, TypeScript проходит.

## Цель
Найти и исправить только 3 текущих падающих frontend-теста и довести общий frontend test check до зелёного состояния без изменения бизнес-логики.

## Scope
- Найти точные 3 failing tests и причины падения.
- Исправить минимально необходимый код или сами тесты, если ожидания устарели.
- Не менять Production Calendar.
- Не менять backend, БД, Alembic, API, roadmap, ERP-check.
- Не рефакторить соседний код без необходимости.
- Не исправлять 81 lint warning в этой задаче.

## Обязательные проверки
1. Запустить целевой набор тестов для воспроизведения.
2. После исправления запустить полный frontend test suite.
3. `npm run lint`
4. `npx tsc --noEmit`
5. `git diff --check`

## Ограничения
- Не делать commit / push / merge.
- Не начинать PC-03.
- Не трогать незакоммиченные изменения Codex вне frontend.
- Если причина теста указывает на реальный regression, исправить regression, а не маскировать тест.

## Отчёт
Кратко указать:
- какие 3 теста падали;
- причина каждого;
- какие файлы изменены;
- итог всех проверок;
- подтвердить, что Production Calendar, backend и БД не менялись.
