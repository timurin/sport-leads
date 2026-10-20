# PC-06.3I — Commit / Push / Verify Manual Planning UX

## Исполнитель
Cursor

## Цель
Зафиксировать уже готовый PC-06.3H без новых функциональных изменений:

- commit;
- push в `main`;
- проверить deploy на `https://sport-lead.ru`;
- подтвердить, что новый Manual Planning UX реально доступен на сервере.

Не расширять scope.

## 1. Перед commit
Проверить:
- `git status`
- `git diff --check`
- `python scripts/check_project.py`

Убедиться, что в commit входят только изменения PC-06.3H и необходимые связанные docs.

Не включать `.env`, secrets, `.next`, screenshots, временные файлы, посторонние незавершённые изменения и task-файлы, если они не являются частью принятого project workflow.

Если working tree содержит чужие/старые незакоммиченные изменения — отделить PC-06.3H безопасно. Не удалять и не откатывать чужую работу.

## 2. Commit
Создать commit:

`feat: improve manual planning dispatcher UX`

Перед commit показать список файлов, которые войдут в него.

Не делать squash/rebase/tag.

## 3. Push
Push текущего `main`:

`git push origin main`

Не использовать force-push.

После push вывести:
- branch;
- commit hash;
- remote result;
- `git status`.

## 4. Проверка GitHub Actions / deploy
Проверить workflow, который разворачивает `main`.

Дождаться финального статуса.

Если deploy упал:
- определить причину;
- исправлять только если ошибка относится к PC-06.3H или его интеграции;
- повторить проверки;
- сделать отдельный fix commit;
- push;
- дождаться успешного deploy.

Не чинить несвязанные инфраструктурные проблемы без отдельного согласования.

## 5. Verify `sport-lead.ru`
После успешного deploy проверить:

`https://sport-lead.ru/production/calendar/planning`

Авторизоваться существующим безопасным способом проекта.

Проверить минимум:

### List
- карточки читаются компактно;
- status badge виден сразу;
- overdue reason отображается;
- filters работают;
- временных сообщений про отсутствие backend-признаков нет.

### Detail
- ETA;
- shipping;
- slack;
- progress;
- одна friendly reason;
- route вертикальный/компактный;
- operation overdue state отображается.

### Replan
- кнопка `Проверить перенос`;
- preview `Что изменится`;
- `Применить перенос` НЕ нажимать при verification.

### Mobile
Проверить 390px:
- одна колонка;
- `← К списку`;
- нет horizontal scroll;
- modal/editor помещается в viewport.

## 6. Data safety
Во время production verification:
- не применять перенос;
- не запускать этапы;
- не завершать этапы;
- не менять production facts;
- не менять даты;
- не менять backend данные.

Только read-only/browser verification.

## 7. Финальный отчёт
Вывести:

### Git
- branch
- commit hash
- push result
- working tree status

### Checks
- project check result
- diff check
- deploy workflow run + result

### Production
Подтвердить:
- list;
- filters;
- detail;
- route;
- preview;
- mobile.

Финальный verdict один из:

`DEPLOY VERIFIED — MANUAL PLANNING UX UPDATED`

или

`PUSH OK — DEPLOY NOT UPDATED`

или

`DEPLOYMENT VERIFICATION BLOCKED`

## Не делать
- новых UI изменений;
- backend changes;
- Planning Health changes;
- Scheduler changes;
- replan semantics changes;
- production fact changes;
- force-push.

## Acceptance
Готово, если:
1. PC-06.3H закоммичен;
2. push в `main` успешен;
3. deploy успешен;
4. новый UI подтверждён на `sport-lead.ru`;
5. production data не изменялись.

Финальная строка:

`PC-06.3I MANUAL PLANNING UX DEPLOY VERIFIED`
