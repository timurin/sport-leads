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

## Управляющие документы

Перед каждой задачей обязательно полностью прочитать:

- docs/roadmap/SL-ROADMAP-v0.3.0.md
- docs/architecture/SL-ERP-CHECK-v0.3.0.md
- docs/releases/latest.md, если файл существует
- последний релизный документ в docs/releases
- текущий task-файл, если он существует

SL-ROADMAP-v0.3.0 определяет последовательность развития.
SL-ERP-CHECK-v0.3.0 определяет архитектурную структуру и критерии целостности.

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
- [~] использовать для частичной или mock/local реализации;
- [ ] оставлять для отсутствующей реализации;
- [!] использовать для нестабильного или непроверенного состояния;
- не менять нумерацию и порядок этапов;
- указывать подтверждающие файлы и тесты.

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


## Контроль изменений roadmap

После завершения каждой итерации Codex обязан обновить:

- docs/roadmap/SL-ROADMAP-v0.3.0.md;
- docs/architecture/SL-ERP-CHECK-v0.3.0.md.

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

git diff -- docs/roadmap/SL-ROADMAP-v0.3.0.md
git diff -- docs/architecture/SL-ERP-CHECK-v0.3.0.md

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