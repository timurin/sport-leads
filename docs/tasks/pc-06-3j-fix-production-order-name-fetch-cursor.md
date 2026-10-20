# PC-06.3J — Fix production order-name fetch via same-origin API

## Исполнитель
Cursor

## Контекст
`main` и `https://sport-lead.ru` сейчас на `767159b`.

Planning Health endpoints на production работают через same-origin proxy, но экран:
`/production/calendar/planning`

пытается получить имена заказов через абсолютный URL:
`http://127.0.0.1:8000/technical-cards`

На локальной машине это скрыто `NEXT_PUBLIC_SPORT_LEADS_API_URL`, а в production браузер не может обратиться к localhost VPS/контейнера пользователя.

Итог: экран Manual Planning на sport-lead.ru показывает `Failed to fetch`.

## Цель
Исправить только transport/API routing для получения данных техкарт/имен заказов так, чтобы browser frontend в production использовал same-origin API/proxy.

Не менять Planning Health semantics, Scheduler, replan, UI-дизайн или production facts.

---

## 1. Найти источник абсолютного localhost URL

Точечно проверить код Manual Planning и helper/client, который формирует запрос к:

`/technical-cards`

Определить, почему production bundle получает `127.0.0.1:8000`.

Не делать repo-wide refactor.

---

## 2. Исправить через существующий same-origin pattern

Использовать тот же подход, который уже работает для:

- `/api/production-calendar/manual-planning/cards`
- `/api/technical-cards/{id}/planning-health`

Предпочтение:
- browser → `/api/...`
- Next.js route/server proxy → backend internal origin

Не требовать `NEXT_PUBLIC_*` backend URL для browser fetch.

Если для `/technical-cards` нет proxy route — добавить минимальный совместимый proxy в текущей архитектуре.

Не дублировать auth/session logic вручную, если уже есть canonical helper/proxy.

---

## 3. Проверить локально

На `http://127.0.0.1:3001/production/calendar/planning`:

- список загружается;
- имена заказов отображаются;
- Planning Health остаётся рабочим;
- preview replan остаётся рабочим;
- browser network не содержит запросов к `127.0.0.1:8000` из клиентского bundle.

---

## 4. Tests

Добавить/обновить targeted test, который гарантирует:

- browser-side manual planning не строит абсолютный backend URL;
- production path использует same-origin `/api/...`.

Запустить:

- targeted frontend tests;
- eslint;
- `tsc --noEmit`;
- production build;
- `python scripts/check_project.py`;
- `git diff --check`.

---

## 5. Commit scope

В рабочем дереве есть много чужих/предыдущих незакоммиченных изменений PC-06.0E–0H, PC-06.2A, docs и task-файлы.

В этот commit включить ТОЛЬКО изменения PC-06.3J.

Не:
- удалять;
- stash/drop чужую работу;
- коммитить 0E–0H;
- коммитить 2A;
- коммитить 15 task files;
- коммитить старые docs updates, если они не нужны для 3J.

Перед commit показать точный staged file list.

Commit:
`fix: use same-origin api for manual planning orders`

---

## 6. Push + deploy

После PASS:

- commit;
- `git push origin main`;
- дождаться deploy workflow;
- проверить `https://sport-lead.ru/production/calendar/planning`.

Production verification read-only:

1. страница открывается без `Failed to fetch`;
2. список TK загружается;
3. имена заказов отображаются;
4. Planning Health badges/ETA видны;
5. filters работают;
6. открыть одну TK;
7. `Проверить перенос` можно вызвать, но `Применить перенос` НЕ нажимать;
8. DevTools/network: нет browser request к `127.0.0.1:8000`.

Не менять production data.

---

## 7. Не трогать оставшееся dirty tree

После deploy повторно вывести:

`git status --short`

и подтвердить, что прежние незакоммиченные PC-06.0E–0H / PC-06.2A / docs/task files остались на месте.

---

## Acceptance

Готово, если:

1. production Manual Planning больше не падает `Failed to fetch`;
2. browser использует same-origin API;
3. локально и production данные загружаются;
4. только 3J попал в commit;
5. deploy успешен;
6. старое dirty tree сохранено.

Финальная строка:

`PC-06.3J PRODUCTION MANUAL PLANNING FETCH FIX DEPLOYED`
