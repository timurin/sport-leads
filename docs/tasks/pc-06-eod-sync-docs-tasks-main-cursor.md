# PC-06 EOD — Sync completed docs/tasks to main

## Исполнитель
Cursor

## Контекст
Production уже содержит завершённые функциональные изменения:
- PC-06.3J same-origin Manual Planning fetch;
- PC-06.0E–0H unified TechnicalCard production planning UI;
- PC-06.2A calendar status filter.

Последний production commit:
`344fe49501a5e7396b5f115097d64c844023d73f`

В рабочем дереве остались только документационные/служебные изменения:
- roadmap;
- ERP-check;
- project-structure;
- project memory;
- UI context;
- task files.

## Цель
Закрыть рабочий день так, чтобы все завершённые изменения были зафиксированы в `main`, а локальное дерево не содержало завершённой незакоммиченной работы.

## 1. Audit remaining dirty tree
Выполнить:
- `git status --short`
- `git diff --stat`
- `git diff --check`

Классифицировать оставшиеся изменения только как:
A. Документация, отражающая уже завершённые задачи — коммитить.
B. Незавершённая работа — не коммитить, перечислить отдельно.

## 2. Consistency check
Проверить, что docs соответствуют production:
- PC-06.0E–0H завершены и deployed;
- PC-06.2A/2B завершены и deployed;
- PC-06.3F/3G/3H/3I/3J завершены;
- Manual Planning использует canonical Planning Health;
- TechnicalCard имеет один блок `План производства`;
- Kanban = production fact;
- Calendar = plan;
- Manual Planning = controlled future replan.

Устаревшие формулировки исправлять только в документации.

## 3. Task files
Добавить в git task-файлы уже выполненных задач, если они являются частью project workflow.
Не добавлять временные recovery-дубли, если они не нужны как история.
Если есть сомнение — не удалять, перечислить в отчёте.

## 4. Checks
- `git diff --check`
- `python scripts/check_project.py`

## 5. Commit
Stage только завершённые docs/tasks.
Перед commit:
`git diff --cached --name-only`

Commit:
`docs: sync completed production planning work`

Не использовать `git add .` вслепую.

## 6. Push
- `git push origin main`
- если docs commit запускает deploy — дождаться success.

## 7. End-of-day clean state
После push:
- `git status --short`

Цель:
- working tree clean;
или
- остаются только явно незавершённые файлы.

Фраза:
`WORKING TREE CLEAN FOR COMPLETED TASKS`

## 8. Final report
Показать:
- branch;
- commit hash;
- push/deploy result;
- какие docs/task files синхронизированы;
- какие локальные изменения остались и почему.

Verdict:
`EOD SYNC COMPLETE — ALL COMPLETED TASKS IN MAIN`
или
`EOD SYNC COMPLETE — ONLY UNFINISHED WORK REMAINS LOCAL`
или
`EOD SYNC BLOCKED`

## Не делать
- новых функциональных изменений;
- backend/frontend refactor;
- production data changes;
- force-push;
- cleanup веток/worktree в этой задаче.

Финальная строка:
`PC-06 EOD SYNC COMPLETE`
