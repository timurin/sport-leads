# PC-03.2 — Production Queue Navigation Integration

## Контекст
PC-03.1 завершён:
- недельная очередь работает;
- существующую ТК можно назначить на участок и дату;
- перенос, удаление, фильтр и ссылка на ТК работают;
- persistence подтверждён;
- Project check 10/10;
- backend 479 passed;
- frontend 299 passed;
- lint 0 errors;
- TypeScript/build/browser checks прошли.

Production Calendar остаётся лёгким инструментом формирования очереди загрузки производства.

## Цель
Интегрировать Production Queue в основную навигацию платформы без изменения бизнес-логики календаря.

## Навигация
В разделе **«Производство»** добавить/переименовать основной пункт:

**Очередь производства**

Он должен быть родительским пунктом для всех экранов Production Calendar.

### Подпункты
Минимальный набор:
- Очередь / Неделя — основной UI-A;
- Ручное планирование — UI-E;
- Мощности — UI-F;
- Дашборд — UI-G;
- Центр отклонений — UI-H.

Если UI-B/UI-C/UI-D являются контекстными экранами карточки/детализации, не выводить их отдельными постоянными пунктами меню без необходимости.

## UX
- «Очередь производства» — основной вход в календарный контур.
- По клику на родительский пункт открывается недельная очередь UI-A.
- Подпункты раскрываются/сворачиваются в существующем стиле sidebar.
- Активный маршрут корректно подсвечивается.
- Не менять визуальный контракт sidebar.
- Не создавать отдельный пункт «Производственный календарь» рядом с «Очередью производства».

## Терминология
В навигации использовать **«Очередь производства»**.
Внутренние заголовки экранов можно сохранить, если они уже утверждены и понятны пользователю.

## Scope
- sidebar/navigation config;
- route mapping;
- breadcrumbs/labels, если требуется для согласованности;
- тесты навигации.

## Не делать
- не менять backend/API/DB;
- не менять CalendarAssignment;
- не добавлять новую бизнес-логику;
- не перерабатывать UI-A–UI-H;
- не начинать capacity/analytics automation;
- не делать commit/push/merge.

## Тесты
Проверить:
1. пункт «Очередь производства» отображается внутри раздела «Производство»;
2. родитель открывает UI-A;
3. подпункты ведут на правильные маршруты;
4. активное состояние работает для каждого подпункта;
5. нет дублирующего отдельного «Производственного календаря»;
6. mobile/collapsed sidebar не ломается;
7. navigation tests;
8. full frontend tests;
9. npm run lint;
10. npx tsc --noEmit;
11. production build;
12. git diff --check;
13. project check.

## Acceptance
Готово, если пользователь может из левого меню открыть:
**Производство → Очередь производства**
и из неё перейти ко всем основным разделам календаря без дублирования навигации.

## Отчёт Codex
Кратко:
- какие файлы навигации изменены;
- какие маршруты добавлены/переиспользованы;
- какие подпункты выведены;
- проверки;
- подтвердить, что backend/DB/business logic Production Queue не менялись;
- подтвердить отсутствие commit/push.


## Результат — 2026-10-05

PC-03.2: интеграция навигации выполнена по прямому выбору владельца после PC-03.1. PC-03 остаётся открытым.

- `frontend/lib/navigation.ts`: один родитель «Очередь производства», href `/production/calendar`; подпункты «Очередь / Неделя», «Ручное планирование», «Мощности», «Дашборд», «Центр отклонений».
- `frontend/components/navigation/app-sidebar.tsx`: группа с href + children теперь поддерживает ссылку родителя и отдельную кнопку раскрытия; активная секция учитывает детей. Иные группы и общий JSX frame сохранены. TopNavigation не изменён, использует существующие dropdown/mobile menu из конфигурации.
- `frontend/app/(workspace)/production/calendar/[section]/page.tsx`: `/planning`, `/capacity`, `/dashboard`, `/deviations` — явные страницы «Раздел ещё не реализован», возврат к неделе; неизвестный section → notFound. Полные UI-E/F/G/H отсутствуют в приложении, есть только автономные HTML-прототипы. Уточнение владельцу отправлено, ответа в итерации нет; выбран ограниченный вариант входных страниц, без реализации или публикации демопрототипов.
- `frontend/lib/navigation.test.mjs`: родитель/пять названий и маршрутов, точное и вложенное активное состояние, граница path prefix, отсутствие дубля, права ограниченного кабинета швеи.
- Документы: эта задача, `roadmap-v1.1.md`, `production-calendar-v0.1.md`, HTML twins `erp/status/roadmap-v1.1.html`, `roadmap/production-calendar-v0.1.html`; генератор учитывает PC-03.2.

### Проверки и границы доказательств

- Project check системным Python: **10/10**, backend **479 passed / 71 warnings**, frontend **300 passed**, navigation **15 passed**, lint **0 errors / 84 прежних warnings**, TypeScript и production build passed. OpenAPI, Alembic и Compose входят в project check.
- Первый запуск через `.venv` дал 7/10: dependency failure `argon2` отсутствует; повтор системным Python, которым запускаются dev-серверы, прошёл. Код и requirements для обхода ошибки не менялись.
- Chromium component QA: настоящие AppSidebar/TopNavigation/navigation.ts и CSS локального приложения, тестовый адаптер Next Link/usePathname; **1440/1024/768/390/320 px**, все пять путей, раскрытие/сворачивание, родитель → неделя, active child, active compact section, mobile menu links, отсутствие горизонтального document overflow. Это компонентная проверка, не авторизованный end-to-end приложения. Desktop 1440/mobile 390 screenshots просмотрены.
- Реальные `/login` на 3001 и `/health` на 8000 вернули 200. Bootstrap auth вернул **401**; пароли/пользователи/БД не менялись. Проверка экранов после реального входа остаётся владельцу. Screenshot mobile показывает прежнее поведение topbar: одинаковый openMenuId раскрывает одновременно desktop portal и compact menu; компонент TopNavigation этой задачей не менялся. P3 наблюдение, отдельная задача при подтверждении в приложении.
- Evidence (ignored): `storage/pc-03-2-project-final.log`, `pc-03-2-ui-check.log`, `pc-03-2-shell-{width}.png`, QA harness `pc-03-2-{bundle.cjs,loader.cjs,next.tsx,entry.tsx,ui-check.py}`.
- `git diff --check` passed. **HTML twin synced**: PC-03.2 [x] ↔ done:true; PC-03 [ ] ↔ done:false. Генерируемый HTML проверен `--check`.

Новые модели/API/DTO/миграции: нет. Backend/DB/CalendarAssignment/business logic не менялись. Уровень ERP-readiness не повышен. P0/P1 новых нет; P2 — прежние lint warnings; P3 — указанное наблюдение compact topbar, без исправления в данной итерации.

**DS-SHELL-01 visual contract preserved. DS-SHELL-02 visual contract preserved.** Template: существующий AppShell и PageLayout/PageContent; входные status pages не заявлены реализованными PT dashboard/capacity экранами. Project structure checklist: changes not required. ERP-check: changes not required. Их HTML twins и global roadmap twins этой итерацией не затронуты; прежний WIP сохранён.

Следующее: владелец проверяет навигацию после входа на `http://127.0.0.1:3001/production/calendar`; затем отдельно выбирает реализацию UI-E/F/G/H. Автоматический переход к следующей микрозадаче не выполнялся. **Commit/push/merge/tag не выполнялись.**
