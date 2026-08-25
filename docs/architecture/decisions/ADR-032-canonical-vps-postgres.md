# ADR-032 — Canonical VPS Postgres and local-git-VPS workflow

**Status:** принято (`2026-08-25`)  
**Date:** `2026-08-25`  
**Roadmap:** `v1.00` Stage `0.5` (`0.5.1` contract)  
**Depends on:** in-repo production stack `17.2.1`–`17.2.3` (Compose/Caddy/deploy/backup); LAN `0.3`; auth ADR-023  
**Amends:** none of `17.2.1`–`17.2.3` checkboxes (stay closed as in-repo artifacts)  
**Evidence:** `docs/tasks/v1.00-stage-0.5-vps-canonical.md` (`SL-VPS-CANONICAL-v1`)

## Контекст

Stage `17.2` уже дал `compose.prod.yaml`, Caddy, `workflow_dispatch` SSH deploy и backup/restore. Живой хост не applied. Локальная работа шла на Docker Postgres + uvicorn `:8000` + Next `:3001` (LAN ≠ production).

Нужна каноническая схема владельца:

1. **Данные** — Postgres на VPS.  
2. **Код** — локальный репозиторий.  
3. **Транспорт кода** — GitHub `origin/main`.  
4. **Рантайм пользователей** — **`https://sport-lead.ru`** за Caddy `:80`/`:443` (`0.5.6.1`).

Локальный backend может читать/писать ту же БД через **SSH tunnel** (owner opt-in). Агент и CI не должны попадать в эту БД.

## Решение

### 1. Sources of truth

| Что | Где | Не является SoT |
|-----|-----|-----------------|
| Код | GitHub `main` after local commit+push | rsync/scp дерева в обход Git |
| Строки БД | Postgres в `compose.prod.yaml` на VPS | локальный Docker Postgres (только dev/tests) |
| Пользовательский UI | **`https://sport-lead.ru`** (`SPORT_LEADS_DOMAIN`, Stage `0.5.6.1`) | LAN `192.168.x:3001` (агент/тесты) |
| Медиафайлы | диск VPS `storage/` (bind `./storage:/app/storage`) | dump Postgres; локальный `storage/` без sync |
| Секреты | host `.env.production` / local `.env.tunnel` (gitignored) | репозиторий |

### 2. Деплой

Локальный репо → `git push origin main` → GitHub Actions `deploy-production.yml` (`workflow_dispatch`) → SSH `git fetch` + `docker compose -f compose.prod.yaml --env-file .env.production up -d --build`.

Не копировать проект на VPS в обход Git. Alembic на проде — старт контейнера API (`alembic upgrade head`). Агент **не** гоняет `alembic` против tunnel.

### 3. SSH tunnel (owner opt-in)

- Postgres на VPS публикуется **только** `127.0.0.1:5432` (не `0.0.0.0`).  
- С Windows: `ssh -N -L 5433:127.0.0.1:5432 user@vps` (`scripts/vps-db-tunnel.ps1`).  
- Локальный Docker Postgres остаётся на `:5432` для pytest / `check_project.py`.  
- Owner uvicorn читает `.env.tunnel` (`POSTGRES_PORT=5433`).  
- Два писателя (контейнер API + локальный uvicorn) допустимы для одного владельца; агент tunnel сам не поднимает.

### 4. Запреты

- Публичный Postgres / CI (`checks.yml`) на VPS DB.  
- Агент: `DATABASE_URL` на `:5433`; `alembic upgrade` / pytest / restore против tunnel.  
- Default `dev-servers.ps1` остаётся Docker Postgres + LAN bind. Tunnel ≠ default.  
- Порт `3000` на Windows по-прежнему вне scope (внутри Docker Next слушает `3000` только в контейнере).

### 5. Границы vs закрытый 17.2 и LAN 0.3

- `17.2.1`–`17.2.3` = in-repo контракт; не переоткрывать. Live apply = `0.5.4`+.  
- `0.3` = локальный стек в LAN. Не путать с Caddy VPS.

### 6. Публичный hostname (`0.5.6.1`)

Единственный пользовательский origin: **`https://sport-lead.ru`**. DNS A/AAAA на регистраторе → IPv4 VPS **до** Let's Encrypt (`0.5.6`). `PUBLIC_APP_ORIGIN=https://sport-lead.ru` (QR Stage 25). `www` — опционально и только после DNS; не включать site block `www` в Caddy, пока запись не резолвится. Агент не ведёт пользовательскую работу на LAN `:3001` вместо этого origin.

### 7. Host OS (`0.5.4.1`)

VPS = **Ubuntu 26.04**. Хостовое окружение: Docker Engine + Compose plugin, git, UFW. Python 3.13 / Node 22 только в образах `compose.prod.yaml`, не `apt` на хосте. Live assemble: `scripts/vps-bootstrap-ubuntu-26.04.sh` (`docs/ops/vps-canonical-0-5.md` §1).

## Последствия

- Перед первым clone на VPS код закрытых контуров (Spec / inventory и т.п.) должен быть в `main` (`0.5.3`).  
- Одноразовый dump локальной БД → `prod-restore-db` до параллельной работы двух писателей (`0.5.7`).  
- Медиа — отдельный sync (`0.5.10`); dump БД файлы не переносит.
