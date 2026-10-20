# PC-06.0I — Commit / Deploy TechnicalCard 0E–0H

## Исполнитель
Cursor

## Контекст
Production `main` уже содержит PC-06.3J (`ffa3efe`).

В рабочем дереве остались незакоммиченные изменения PC-06.0E–0H:
- preflight required fields;
- friendly preflight copy/dedup;
- modern route/plan UI;
- объединение двух маршрутных блоков в один `План производства`;
- удаление управляющих production fact кнопок из карточки ТК;
- связанные targeted tests.

Также в dirty tree есть независимые изменения:
- PC-06.2A calendar status filter;
- roadmap / ERP-check / project structure;
- project memory / UI context;
- task files.

Их в этот commit НЕ включать.

## Цель
Без новых функциональных изменений:
1. точно выделить изменения PC-06.0E–0H;
2. проверить их;
3. закоммитить отдельным атомарным commit;
4. push в `main`;
5. дождаться deploy;
6. read-only проверить `sport-lead.ru`.

---

## 1. Scope

Ожидаемые файлы PC-06.0E–0H:

- `frontend/app/(workspace)/production/tech-cards/[id]/page.tsx`
- `frontend/components/production/tech-card-detail-workspace.tsx`
- `frontend/components/production/tech-card-shop-floor-body.tsx`
- `frontend/components/production/tech-card-model-route-card.tsx`
- `frontend/components/production/tech-card-production-plan.tsx`
- `frontend/components/production/tech-card-route-variants.tsx`
- `frontend/components/production/tech-card-readiness-roadmap.tsx`
- `frontend/components/production/tech-card-preflight-modal.tsx`
- `frontend/lib/production/tech-card-preflight.ts`
- `frontend/lib/production/tech-card-readiness.ts`
- связанные `tech-card-*.test.mjs`
- `frontend/lib/platform-debug.test.mjs` только если diff относится именно к 0E–0H

Не включать:
- `calendar-status-filter*`
- weekly calendar files
- `docs/tasks/*`
- roadmap / erp-check / project-structure
- project memory / UI context, если их невозможно отделить чисто
- любые unrelated changes

---

## 2. Audit

Не делать repo-wide refactor.

Для каждого candidate-файла:
- посмотреть `git diff -- <path>`;
- подтвердить, что diff относится к 0E–0H;
- если файл смешивает unrelated changes — stage только нужные hunks.

Можно использовать `git add -p`, но не `git add .` и не `git add -A`.

---

## 3. Проверки

До commit:

- targeted tests PC-06.0E–0H;
- eslint;
- `tsc --noEmit`;
- production build;
- `python scripts/check_project.py`;
- `git diff --check`.

Browser local smoke:
- одна ТК с планом;
- одна in_progress;
- одна completed;
- preflight modal;
- 390px.

Не менять production facts и данные.

---

## 4. Commit

Перед commit вывести:

`git diff --cached --name-only`

В staged должны быть только файлы PC-06.0E–0H.

Commit message:

`feat: unify technical card production planning UI`

Не делать squash/rebase/tag.

---

## 5. Push / Deploy

- `git push origin main`
- дождаться `Deploy production`;
- если workflow падает из-за изменения этой задачи — исправить отдельным fix commit;
- не чинить unrelated infra.

---

## 6. Production verify

Read-only проверить на:

`https://sport-lead.ru`

Минимум:

### TechnicalCard
- один блок `План производства`;
- нет отдельной вкладки `Маршрут`;
- нет `Начать этап`, `Завершить этап`, `Откатить`;
- сборка показывается строкой `Сборка: ...`;
- route operations внутри единого блока;
- ETA / shipping / slack / status видны;
- preflight показывает friendly grouped messages;
- нет diagnostic codes;
- нет duplicate cards.

### Cases
Проверить безопасно:
- planned;
- in_progress;
- completed;
- 390px.

Никаких write actions.

---

## 7. Dirty tree после commit

После deploy:

`git status --short`

Подтвердить, что отдельно остались:
- PC-06.2A calendar status filter;
- docs/status updates;
- project memory/UI context;
- task files.

Не удалять их.

---

## Acceptance

Готово, если:

1. 0E–0H выделены отдельным commit;
2. unrelated dirty tree не затронут;
3. tests/build/check_project PASS;
4. push/deploy PASS;
5. новый TechnicalCard UI подтверждён на sport-lead.ru;
6. production data не менялись.

Финальная строка:

`PC-06.0I TECHCARD 0E-0H DEPLOY VERIFIED`
