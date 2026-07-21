# Repository Guidelines

## Project Structure & Module Organization

`backend/app/` contains the FastAPI service, organized by responsibility: `api/` for routes, `models/` and `schemas/` for persistence and validation, `collectors/` and `parsers/` for ingestion, and `services/` for workflows. Database migrations live in `backend/alembic/`; smoke and integration scripts are in `backend/tests/`. The Next.js application is under `frontend/`, with routes in `app/`, reusable UI in `components/`, domain definitions in `lib/`, shared types in `types/`, and static files in `public/`. Operational files belong in `scripts/`, `docker/`, and `compose.yaml`; generated data stays in ignored `storage/`, `logs/`, and `backup/` directories.

## Build, Test, and Development Commands

- `docker compose up -d postgres` starts the PostgreSQL dependency configured through `.env`.
- `pip install -r backend/requirements.txt` installs backend dependencies (Python 3.13+).
- From `backend/`, run `alembic upgrade head` to apply migrations and `uvicorn app.main:app --reload` to serve the API.
- From `frontend/`, run `npm ci`, then `npm run dev` for local development, `npm run lint` for ESLint, or `npm run build` for a production build.
- `powershell -File scripts/check.ps1` runs the repository-wide compilation, API, model, migration, frontend, and Compose checks.

## Coding Style & Naming Conventions

Use four spaces and type annotations in Python. Keep modules and functions `snake_case`, classes `PascalCase`, and constants `UPPER_SNAKE_CASE`. TypeScript is strict: use two-space indentation, `PascalCase` React components, `camelCase` functions and variables, and kebab-case filenames such as `entity-workspace.tsx`. Prefer the `@/` import alias for frontend modules. Follow the Next.js ESLint configuration and read `frontend/AGENTS.md` before frontend changes.

## Testing Guidelines

The project currently has no formal pytest configuration or coverage threshold. Treat `scripts/check_project.py` as the required verification suite. Add focused `test_*.py` checks under `backend/tests/` for backend behavior, avoid live-network dependencies where possible, and use the mock collector for deterministic cases. Run the full check before submitting changes.

## Commit & Pull Request Guidelines

Recent commits use short, imperative, sentence-case subjects, for example `Add materials catalog API and database model`. Keep each commit focused. Pull requests should explain the change and validation performed, link relevant issues, call out migrations or configuration changes, and include screenshots for visible frontend work. Never commit `.env`, credentials, logs, downloaded documents, or generated storage files.

# Sport-Lead autonomous development rules

## Канонические документы

Физические источники истины: `docs/roadmap/roadmap.md`, `docs/architecture/project-structure.md`, `docs/architecture/erp-check.md` и связанные ADR в `docs/architecture/decisions/`. Коды `SL-ROADMAP-v1`, `SL-PROJECT-STRUCTURE-v1` и `SL-ERP-CHECK-v1` являются закреплёнными алиасами этих файлов. HTML в `docs/erp/status/` — только визуальное представление. Не создавать параллельные master-документы.

## Управляющие документы

Перед каждой задачей обязательно полностью прочитать:

- AGENTS.md
- docs/architecture/project-structure.md
- docs/architecture/erp-check.md
- docs/roadmap/roadmap.md
- связанные ADR из docs/architecture/decisions/
- docs/releases/latest.md, если файл существует
- последний релизный документ в docs/releases
- текущий task-файл, если он существует

`SL-ROADMAP-v1` определяет последовательность развития.
`SL-ERP-CHECK-v1` определяет фактическую готовность ERP, а `SL-PROJECT-STRUCTURE-v1` — архитектурную структуру и зависимости.

Код документа roadmap не равен версии приложения.

## Главный принцип

Самостоятельно выполнять только следующий незавершённый пункт текущего этапа roadmap.

Не переходить к следующему этапу, пока:

- текущий этап не завершён;
- проверки не прошли;
- нет незакрытых P0/P1;
- пользователь явно не подтвердил переход.

## Порядок работы

Перед изменениями:

1. Проверить git status и текущую ветку.
2. Прочитать roadmap и ERP-check.
3. Проанализировать существующий код.
4. Найти уже существующие модели, API, schemas, services и компоненты.
5. Не создавать параллельную реализацию.
6. Составить краткий план.
7. Определить границы текущей итерации.

Во время работы:

- делать минимально необходимый diff;
- использовать существующую архитектуру;
- сохранять обратную совместимость;
- не менять внешний вид без прямой задачи;
- не смешивать несколько этапов roadmap;
- не выполнять массовый рефакторинг;
- не заменять рабочий код mock-данными;
- не скрывать ошибки fallback-механизмами;
- не удалять неизвестные или untracked-файлы;
- не использовать git reset --hard и git clean -fd.

## Защищённый дизайн Platform Sidebar

Компонент `frontend/components/navigation/app-sidebar.tsx` является утверждённым эталоном левого меню платформы.

Код эталона:

`DS-SHELL-01 — Platform Sidebar`

Утверждённый внешний вид и поведение:

- раскрытая ширина меню — `260px`;
- компактная ширина — `72px`;
- светлый фон и единая визуальная система SPORT-LEAD;
- логотип `SL` и название `SPORT-LEAD`;
- группировка разделов и подразделов;
- раскрытие и сворачивание разделов по нажатию на всю строку;
- подсветка активного раздела и активного маршрута;
- отдельный вертикальный скролл без горизонтального скролла;
- сохранение режима sidebar в `localStorage`;
- верхняя и нижняя кнопки переводят sidebar в одинаковый компактный режим;
- профиль пользователя расположен в нижней фиксированной области.

Без отдельного прямого задания пользователя запрещено изменять:

- ширину раскрытого и компактного sidebar;
- цвета, фон, границы, радиусы и типографику;
- размеры и расположение логотипа;
- размеры, отступы и высоту пунктов;
- иконки существующих разделов;
- активные, hover и focus-состояния;
- структуру раскрытия подразделов;
- scrolling и overflow;
- расположение профиля;
- механику compact mode;
- ключ `sport-lead-sidebar-mode`;
- общий JSX-каркас `AppSidebar`;
- визуальный стиль заголовков подразделов.

Разрешено без изменения дизайна:

- добавлять новые разделы в `frontend/lib/navigation.ts`;
- добавлять новые группы и подпункты в `topNavigation`;
- изменять названия маршрутов по отдельной продуктовой задаче;
- добавлять подходящую Lucide-иконку для нового верхнеуровневого раздела;
- исправлять подтверждённые функциональные ошибки без визуального редизайна;
- улучшать доступность без изменения утверждённого внешнего вида.

Правила добавления пунктов:

1. Источником структуры меню является `frontend/lib/navigation.ts`.
2. Верхнеуровневые разделы формируются из `appSections`.
3. Подразделы формируются из `topNavigation`.
4. Нельзя вручную дублировать ссылки внутри `app-sidebar.tsx`.
5. Новый маршрут должен добавляться в существующую логическую группу.
6. Новый верхнеуровневый раздел создаётся только для отдельного крупного модуля платформы.
7. Длинные названия должны помещаться в существующую ширину или завершаться многоточием.
8. Добавление пункта не должно создавать горизонтальный скролл.
9. После изменения `frontend/lib/navigation.ts` необходимо проверить expanded и compact режимы.
10. Любое изменение внешнего вида `DS-SHELL-01` требует отдельного задания и визуального подтверждения пользователя.

В итоговом отчёте задач, затрагивающих навигацию, указывать:

- добавленные или изменённые маршруты;
- изменённые группы меню;
- результат проверки expanded mode;
- результат проверки compact mode;
- подтверждение: `DS-SHELL-01 visual contract preserved`.

## Архитектурные требования

Соблюдать разделение:

- API;
- schemas;
- services;
- repositories;
- database models;
- frontend data layer;
- UI components.

Правила:

- не возвращать ORM-объекты напрямую из API;
- бизнес-правила размещать в service-слое;
- денежные значения хранить через Decimal/Numeric;
- даты и время должны быть timezone-aware;
- миграции должны иметь upgrade и downgrade;
- не дублировать источник истины;
- не создавать вторую модель существующей сущности;
- не создавать дублирующие routers, operationId и API prefixes;
- frontend не должен незаметно подменять ошибки API demo-данными.

## Работа с roadmap

После завершения итерации:

- обновлять только реально выполненные пункты;
- [x] ставить только после успешных тестов;
- [ ] оставлять для отсутствующей реализации;
- для `docs/roadmap/roadmap.md` использовать только `[x]` и `[ ]`;
- состояние "в работе", блокеры и исключения из scope описывать текстом внутри пункта;
- не менять нумерацию и порядок этапов;
- указывать подтверждающие файлы и тесты.

## Roadmap and microtasks

1. Канонический roadmap: `docs/roadmap/roadmap.md`.
2. HTML roadmap: `docs/erp/status/roadmap.html`.
3. Каждая новая функция разбивается на проверяемые микрозадачи.
4. Одна микрозадача решает одну логическую проблему.
5. Task-файлы создаются только в `docs/tasks/`.
6. Codex выполняет только выбранную микрозадачу.
7. Codex не начинает следующую микрозадачу автоматически.
8. После выполнения закрывается только соответствующий чекбокс.
9. Функциональный пункт закрывается после завершения всех обязательных микрозадач.
10. Пользовательская визуальная проверка является отдельным условием, если она указана.
11. Баги получают отдельные коды `B1`, `B2` и далее.
12. Несвязанный рефакторинг запрещён.
13. Roadmap HTML обновляется вместе с Markdown.
14. Project structure обновляется только если изменилась фактическая готовность.
15. Итоговый отчёт каждой задачи содержит выбранный roadmap-пункт, закрытые микрозадачи, добавленные баг-задачи, изменения roadmap, изменения project structure и результаты проверок.
16. Если roadmap не менялся, писать: `Roadmap: changes not required.`
17. Если структура не менялась, писать: `Project structure checklist: changes not required.`

## Проверки

После каждой итерации запускать применимые проверки.

Backend:

- python scripts/check_project.py
- python -m pytest
- проверка OpenAPI
- проверка Alembic при изменении моделей

Frontend:

- npx tsc --noEmit
- npm run lint
- npm run build

Git:

- git diff --check
- git status --short

При падении проверки определить причину:

- ошибка кода;
- ошибка конфигурации;
- отсутствие зависимости;
- недоступный сервис;
- проблема тестовых данных.

Не маскировать ошибки.

## Критичность

P0:
- потеря данных;
- проблема безопасности;
- приложение не запускается.

P1:
- нарушение архитектурной целостности;
- сломанная миграция;
- сломанный API-контракт;
- неработающий основной сценарий.

P2:
- технический долг, не блокирующий этап.

P3:
- визуальные и косметические недостатки.

Не переходить дальше при P0/P1.
Не отвлекаться на P2/P3 без отдельной задачи.

## Git

Codex может:

- изменять код;
- создавать миграции;
- создавать тесты;
- обновлять roadmap и документацию;
- запускать проверки.

Codex не может без отдельного разрешения:

- делать commit;
- создавать tag;
- выполнять push;
- выполнять merge;
- выполнять rebase;
- переключать основную ветку;
- удалять ветки;
- применять миграции к production;
- удалять данные;
- переходить к следующему этапу roadmap.

## Размер итерации

Одна автономная итерация должна:

- относиться к одному пункту roadmap;
- иметь один законченный результат;
- занимать ограниченную область проекта;
- завершаться тестами и отчётом;
- останавливаться перед следующим пунктом.

Если пункт слишком большой, самостоятельно разделить его на последовательные подзадачи, но выполнить только первую законченную подзадачу.

## Project structure checklist

`docs/architecture/project-structure.md` — канонический чек-лист функциональной структуры проекта.

Правила ведения:

1. После завершения задачи Codex обязан проверить, закрывает ли она один или несколько пунктов структуры.
2. Завершённые и проверенные пункты отмечаются `[x]`.
3. Незавершённые пункты остаются `[ ]`.
4. Частично реализованный модуль необходимо разделить на более точные подпункты, а не помечать как завершённый целиком.
5. Нельзя закрывать чекбокс только по наличию UI, API, модели или документации.
6. Чекбокс закрывается только после проверки полного объёма, обозначенного конкретной строкой.
7. Новые функциональные области добавляются в соответствующий раздел структуры.
8. Удалённые или изменённые требования должны отражаться в структуре.
9. При каждом изменении Markdown-файла одновременно обновляется `docs/erp/status/project-structure.html`.
10. Markdown и HTML должны содержать одинаковые разделы, пункты и состояния чекбоксов.
11. Итоговый отчёт по задаче должен явно указывать, какие пункты структуры закрыты, добавлены, изменены, и обновлён ли HTML.
12. Если задача не влияет на структуру, в отчёте явно писать: `Project structure checklist: changes not required.`
13. Структуру нужно обновлять в той же задаче, которая завершает функциональность, а не отдельной будущей задачей.
14. Roadmap не заменяет структуру: roadmap определяет последовательность, а структура фиксирует фактическую готовность модулей.


## Контроль изменений канонических документов

После завершения каждой итерации Codex обязан обновить:

- docs/roadmap/roadmap.md;
- docs/architecture/project-structure.md;
- docs/architecture/erp-check.md;
- только затронутые ADR и process-документы.
- структуру проекта, если она изменилась;
- docs/erp/status/project-structure.html;
- docs/erp/status/roadmap.html.

HTML-отчёты должны быть автономными HTML5-файлами с встроенным CSS, без внешних зависимостей; их статусы подтверждаются кодом и тестами. Нельзя отмечать модуль завершённым только по наличию страницы.

Правила обновления:

- [x] ставить только при полном завершении пункта и успешных обязательных тестах;
- [~] ставить при частичной реализации, mock, local-only или незавершённой интеграции;
- [!] ставить при нестабильной реализации или необходимости проверки;
- [ ] оставлять, если пункт не завершён;
- не менять формулировку, порядок и нумерацию этапов без отдельного разрешения;
- не удалять незавершённые пункты;
- не объединять несколько пунктов roadmap в один;
- рядом с обновлённым пунктом указывать:
  - версию итерации;
  - краткий результат;
  - подтверждающие файлы;
  - тесты;
  - оставшиеся ограничения.

Перед завершением Codex обязан показать:

git diff -- docs/roadmap/roadmap.md
git diff -- docs/architecture/project-structure.md
git diff -- docs/architecture/erp-check.md

Codex не делает commit, пока пользователь не проверит:

- код;
- тесты;
- изменения roadmap;
- изменения ERP-check.

Если пользователь отклоняет результат, Codex обязан откатить только изменения текущей итерации, не затрагивая ранее существовавшие изменения.


## Отчёт

После каждой итерации показать:

1. Какой пункт roadmap выбран.
2. Почему он следующий.
3. Что было реализовано.
4. Какие файлы изменены.
5. Какие модели и контракты использованы.
6. Какие миграции созданы.
7. Результаты проверок.
8. Найденные P0–P3.
9. Что обновлено в roadmap и ERP-check.
10. Что остаётся незавершённым.
11. Следующую рекомендуемую итерацию.

После отчёта остановиться.

## Model selection

Модель Codex выбирается владельцем проекта вручную до запуска задачи.

Не изменяй модель, не проси переключить модель и не создавай отчеты о необходимости смены модели.

Если задача заблокирована отсутствующим архитектурным или бизнес-решением, останови только спорную часть, зафиксируй блокер и сообщи владельцу проекта.
