# ADR-029 — Sewing cabinet work ledger

**Status:** принято (`2026-08-24`); **amended `2026-08-28` (`26.10.1`):** `operation` `unit_price` from assembly snapshot, not catalog  
**Date:** `2026-08-24`  
**Roadmap:** Stage `24` (`24.0.1`–`24.0.2` contract)  
**Amends:** ADR-016 §6.4 (Пошив shop fact stays; this ADR adds a **separate** multi-sewer work ledger); ADR-024 (sewing cabinet codes/roles seeded in `24.1.1`); **amended by ADR-030** (split WIP: take/queue by unit lines on sewing)  
**Depends on:** ADR-023 (`PlatformUser`), ADR-024 (RBAC), ADR-016 (technical card / unit lines / sewing op snapshots), `17.1.2.8` (stage executors), Stage `21` (profile)  
**Evidence:** `docs/tasks/v1.00-stage-24-sewing-cabinet.md` (`SL-SEWING-CABINET-v1`)

## Контекст

Цех Пошив уже пишет **факт этапа** на ТК (`11.7`: `performer_name` / `work_done` / `duration_seconds` на `TechnicalCardStageResult`). Это поверхность «цех прошёл шаг», без поштучного учёта, кто какую штуку или операцию **взял**.

Нужен кабинет швеи: несколько `PlatformUser` на одной ТК, резерв штук и/или операций пошива, заработок по снимку **цены сборки** (вариант / order-item snapshot), ограниченная оболочка (швея видит только свой кабинет). Справочник `Employee` (`2.4.2`) — не этот контур. QR и разрез карты по цехам — Stage `25`.

## Решение

### 1. Кто такая швея

| Есть | Нет |
|------|-----|
| `PlatformUser` + роли/права (ADR-023 / 024) | `Employee` (`2.4.2`) как SoT кабинета |
| Профиль кабинета: `display_name` / contacts / later avatar из Stage `21` | Отдельная таблица «швей» |
| Stage-executor bind на цех Пошив (`17.1.2.8`) **может** фильтровать очередь; не заменяет RBAC кабинета | `SalesUser` / CRM responsible |

### 2. Два SoT на пошиве (не смешивать)

| SoT | Владелец | Что хранит | Что не хранит |
|-----|----------|------------|---------------|
| `TechnicalCardStageResult` (`11.7`) | Shop module `/production/stages/sewing` | Факт прохождения цеха (кто/что/время **этапа**) | Резерв штук, пооперационный заработок, очередь «взяла» |
| **Sewing work ledger** (Stage `24`) | Кабинет швеи | Кто взял / сколько / операция или штука / статус резерва / снимок цены / закрытие | Статус маршрута ТК, материалы, QR |

`11.7` **не** становится книгой назначений. Кабинет **не** пишет `performer_name` как единственный учёт резерва.

### 3. Журнал (логические поля; таблицы в `24.2.1`)

Таблица: `sewing_work_ledger_entries` (Alembic `c2d3e4f5a678`). Одна строка журнала:

- `platform_user_id` — кто взял (сессия; не Employee);
- `technical_card_id` — ТК, у которой **текущий** шаг маршрута = Пошив (`code=sewing`);
- `kind`: `piece` | `operation`;
- для `operation`: FK на `technical_card_operation_lines` со `source_kind=sewing` (не routing TechOperation);
- `qty` > 0;
- `status`: `reserved` | `completed` | `released`;
- снимок на **take**: `unit_price` (Decimal) + подпись (`operation_name` или «изделие» / вариант сборки);
- timestamps take / complete / release.

**Цена снимка**

| `kind` | `unit_price` на take |
|--------|----------------------|
| `operation` | Assembly economics: order-item sewing-op snapshot matching the TC line, else live `AssemblyOperationLine` on the variant linked to the TC (`26.10.7`). **Not** `SewingOperation.cost` (catalog has no cost after `26.10.2`) |
| `piece` | `TechnicalCard.assembly_variant_total_cost` (per item). Если null — take `piece` отклоняется, пока нет стоимости варианта |

Заработок строки = `qty × unit_price` только в статусе `completed`. `released` = 0. Пересчёт сборки / каталога после take **не** меняет снимок.

### 4. Пулы остатка (shared remaining)

Два независимых пула на одну ТК:

| Пул | Плановый объём | Занято |
|-----|----------------|--------|
| Штуки | число **unit lines** ТК (= qty позиции на sync) | Σ `qty` строк `kind=piece` со статусом `reserved` или `completed` |
| Операция | `TechnicalCardOperationLine.volume` этой sewing-строки | Σ `qty` строк `kind=operation` на этот line id со статусом `reserved` или `completed` |

**Take** отклоняется (409), если `qty` > остаток пула. `released` возвращает объём в пул.

`11.7` stage fact **не** входит в арифметику пула: у факта этапа нет поштучного qty. Числовой лимит — только журнал. Закрытие шага Пошив в `11.7` не заменяет `complete` строк журнала.

Нельзя take, если **локация выбранных штук** ≠ Пошив. До Stage 25 карта целиком на пошиве. **Amend `2026-08-24` (ADR-030):** после split WIP take/очередь кабинета смотрят unit lines на Пошив, не «current step карты = sewing».

### 5. Команды

| Команда | Из | В | Правило |
|---------|----|---|---------|
| **take** | — | `reserved` | Остаток пула; актёр = session user |
| **release** | `reserved` | `released` | Только автор строки (или `sewing_cabinet.write` + `read_any` у менеджера на эту строку) |
| **complete** | `reserved` | `completed` | Тот же ACL; qty не меняется |

Нет DELETE. Нет правки `unit_price` после take.

Очередь кабинета: ТК с current stage = Пошив. Вход — список очереди **внутри кабинета**, не QR.

### 6. Доступ (seed `24.1.1`; restricted shell `24.1.2`)

| Code | Смысл |
|------|--------|
| `sewing_cabinet.read_own` | Свой кабинет |
| `sewing_cabinet.read_any` | Список швей + чужой кабинет |
| `sewing_cabinet.write` | take / release / complete |

Роль **`sewer` (Швея)**: `read_own` + `write`. Без `read_any`.

Роли **`admin`**, **`company_lead`**, **`technologist`**, **`shop_master`**: `read_any` + `write` (+ admin уже all). `shop_operator` **не** получает кабинет автоматически (это kanban цеха, не швея).

**Restricted shell** (`24.1.2`): если есть `read_own` и **нет** `read_any` — в nav и API виден только кабинет (и login/me/logout). Визуалы DS-SHELL-01/02 не менять: режется **состав** навигации, не рамка. Пользователь с `read_any` видит полный ERP.

Хосты (`24.3`/`24.4`): `/production/sewing-cabinet` (свой); `/production/sewing-cabinet/sewers` (список, `read_any`); `/production/sewing-cabinet/[platformUserId]` (`read_any`).

### 7. Границы

| Не в Stage 24 | Куда |
|---------------|------|
| QR / скан / current-or-next | Stage `25` |
| Разрезание ТК по цехам / child TC | Stage `25` |
| Spec документ | Stage `7` |
| Склад `12.4`–`12.5`, платежи `14` | свои этапы |
| Связка Employee↔User | отложена с `2.4.2.4` |
| Персональные расценки швеи | нет; только каталог |

## Последствия

- `24.1` сеет права/роли и режет оболочку.
- `24.2` добавляет таблицу журнала + API очереди/take/release/complete.
- `24.3` / `24.4` — UI своего и чужого кабинета.
- Stage `25` пошив-скан пишет в **этот** журнал (те же пулы).
- Shop `/production/stages/sewing` (`11.7`) остаётся.

## Alternatives rejected

- Писать резерв в `TechnicalCardStageResult.performer_name` — нет qty, нет нескольких швей, нет снимка цены.
- Швея = `Employee` — ломает Stage 21 login и очередь `24`/`25` (owner: sewer = `PlatformUser`).
- Live-пересчёт `SewingOperation.cost` после take — ломает заработок за период (после `26.10` каталог cost не существует; то же правило для live `AssemblyOperationLine.cost` после take).
- Общий пул «заказ qty» на операции и штуки вместе — разные единицы (`volume` vs unit lines).
