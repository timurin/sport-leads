# PC-06.2B — Commit / Deploy Calendar Status Filter

## Исполнитель
Cursor

## Контекст
`main` и production уже содержат:
- PC-06.3J — same-origin Manual Planning fetch;
- PC-06.0E–0H — unified TechnicalCard production planning UI.

Последний подтверждённый production commit:
`738295edd40aeded9a0a6118a06fced2d5fb8810`

В рабочем дереве отдельно остался завершённый PC-06.2A:
- фильтр статусов недельного календаря;
- связанные helper/component/test.

Также отдельно остаются docs/status/task files. Их в этот commit не включать.

## Цель
Без новых функциональных изменений:
1. выделить только PC-06.2A;
2. проверить;
3. commit;
4. push в `main`;
5. дождаться deploy;
6. read-only проверить `sport-lead.ru`.

---

## Scope

Ожидаемые файлы:
- `frontend/components/production/calendar-weekly-board.tsx`
- `frontend/components/production/calendar-status-filter.tsx`
- `frontend/lib/production/calendar-status-filter.ts`
- `frontend/lib/production/calendar-status-filter.test.mjs`

Если diff показывает другие файлы — включать только если они явно относятся к PC-06.2A.

Не включать:
- roadmap;
- ERP-check;
- project-structure;
- project memory;
- UI context;
- `docs/tasks/*`;
- unrelated changes.

---

## Проверки

До commit:

- targeted calendar status filter tests;
- eslint;
- `tsc --noEmit`;
- production build;
- `python scripts/check_project.py`;
- `git diff --check`.

Browser local smoke:
- `/production/calendar`;
- статусы:
  - Все;
  - Запланировано;
  - В работе;
  - Завершено;
  - Пропущено, если реально есть;
- фильтр скрывает только stickers;
- load/grid/queue не пересчитываются;
- пустой результат сохраняет сетку;
- 390px.

---

## Commit

Stage только точные файлы PC-06.2A.

Перед commit:
`git diff --cached --name-only`

Commit message:
`feat: add production calendar status filter`

Не использовать `git add .` / `git add -A`.

---

## Push / deploy

- `git push origin main`
- дождаться `Deploy production`;
- если ошибка связана только с этим scope — исправить отдельным fix commit;
- unrelated infra не трогать.

---

## Production verify

Read-only проверить:
`https://sport-lead.ru/production/calendar`

Подтвердить:
- фильтр виден;
- переключение статусов работает;
- stickers корректно скрываются;
- grid остаётся;
- load не меняется от фильтра;
- mobile не ломается;
- production data не изменяются.

---

## Dirty tree после commit

Вывести:
`git status --short`

Оставшиеся изменения должны относиться только к:
- docs/status;
- project memory/UI context;
- task files;
- другим явно незавершённым задачам.

---

## Acceptance

Готово, если:
1. PC-06.2A выделен отдельным commit;
2. tests/build/check_project PASS;
3. push/deploy PASS;
4. filter подтверждён на sport-lead.ru;
5. docs/task files не затронуты;
6. production data не менялись.

Финальная строка:

`PC-06.2B CALENDAR STATUS FILTER DEPLOY VERIFIED`
