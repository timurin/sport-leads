# ADR-021 — DesignProject + DesignVersion domain

**Status:** принято (`2026-08-01`)  
**Date:** `2026-08-01`  
**Roadmap:** Stage 10 § `10.1.1.1` (entity/versions); feeds `10.1.1.2`–`10.1.1.5`, `10.1.2`  
**Depends on:** ADR-003 (`design_approval_status`), ADR-016 (TC media vs Stage 10), ADR-011 (media storage pattern)  
**Evidence:** `docs/tasks/v0.9.0-stage-10.1.1-design-project.md`

## Контекст

Нужна граница между:

- **коммерческим гейтом согласования макета** на заказе (`SalesOrder.design_approval_status`, `3.4.1`);
- **цеховым исполнением «Дизайн»** на техкарте (`11.4` — кто / что / время);
- **лёгкой галереей** на ТК (`TechnicalCardMedia`, до 3 фото) — interim UI до полного модуля;
- **версионируемыми дизайн-активами** (проект + версии макетов) — Stage `10.1`;
- **чатом сотрудников** (Stage `19`) и комментариями дизайн-модуля (`10.1.2`).

Нельзя: подменять `design_approval_status` статусом версии; писать shop fact в DesignProject; превращать `TechnicalCardMedia` во второй SoT версий; строить клиентский approval portal (`10.2` cancelled).

## Решение

### 1. Сущности

| Сущность | Роль |
|----------|------|
| **DesignProject** | Контейнер дизайн-работы по заказу покупателя. Живёт в контуре Stage 10 (не settings catalog). |
| **DesignVersion** | Версия активов внутри проекта (номер/метка, статус, примечание). Файлы макетов / логотипы / комментарии — `10.1.2`. |

### 2. Кардинальность (MVP)

```
SalesOrder 1 ─── N DesignProject
DesignProject 1 ─── N DesignVersion
DesignVersion 0..1 ─── SalesOrderItem   (optional line scope)
DesignVersion 0..1 ─── TechnicalCard    (optional soft link; not required)
```

Правила:

- `DesignProject.sales_order_id` **обязателен** (live FK).
- На одном заказе допускается несколько проектов (например, разные линии / подрядчики); UI MVP может стартовать с одного.
- Внутри проекта **ровно одна** `DesignVersion` со статусом `current` (или ни одной, пока нет первой версии).
- Версия **не** создаёт и **не** заменяет `TechnicalCard` / `TechnicalCardMedia`.
- Soft-link на ТК/позицию — опциональная навигация и контекст печати; SoT галереи ТК остаётся `TechnicalCardMedia` до явного wire в `10.1.2` / print Stage 18.

### 3. Статусы (MVP)

**DesignProject**

| Status | Meaning |
|--------|---------|
| `draft` | Создан; версии можно набирать |
| `in_progress` | Есть ≥1 версия; работа идёт |
| `ready` | Текущая версия готова к коммерческому согласованию (не то же самое, что `design_approval_status=approved`) |
| `archived` | Закрыт; новые версии запрещены |

**DesignVersion**

| Status | Meaning |
|--------|---------|
| `draft` | Черновик версии |
| `current` | Активная версия проекта (≤1 на проект) |
| `superseded` | Снята с current при появлении новой current |

Смена `current` → прежняя `current` становится `superseded`. Детальные transition guards — в API `10.1.1.3`.

### 4. Нумерация (default)

| Document | Pattern | Notes |
|----------|---------|-------|
| DesignProject | `DP-{salesOrderNumber}-{seq}` | `seq` = 1…N внутри `SalesOrder` |
| DesignVersion | `v{n}` label + integer `version_no` | `version_no` монотонно растёт внутри проекта |

### 5. Связи с соседними контурами

| Контур | Правило |
|--------|---------|
| `SalesOrder.design_approval_status` (`3.4.1`) | Коммерческий gate → `production`. DesignProject/Version **не** пишут и **не** зеркалят этот enum автоматически. Manager может выставить `ready` на проекте, затем отдельно согласовать заказ. |
| Stage `19` chat/microtasks | Операционное согласование / правки с клиентом и дизайнером — чат на заказе/ТК. Не заменяется статусами DesignVersion. |
| `TechnicalCardMedia` | Interim ≤3 фото на ТК (ADR-016). Не версионный SoT Stage 10. Позже soft-link current version → mockup display (`10.1.2` / print). |
| Shop «Дизайн» `11.4` | Fact на ТК (performer / duration). Не CRUD DesignProject. |
| Stage `10.1.2` | Layouts, logos, file attachments, design-module comments на `DesignVersion` — **ADR-022**. |
| Nomenclature media (ADR-011) | Другой контур (каталог). Не смешивать storage roots без явного shared lib. |
| Print Stage `18.3` | Может показывать current design version / TC media на Side 1 — wire later. |

### 6. UI placement (intent)

- Workspace: `/design/projects` (list) + `/design/projects/[id]` (card) — nav добавить в `10.1.1.4` (не ломая DS-SHELL contracts без задачи).
- Deep-link с карточки заказа / ТК — опционально в `10.1.1.4` / `10.1.2`.
- **Не** CRUD внутри `/settings/catalogs/*`.

### 7. Вне scope ADR (implementation follows microtasks)

- Таблицы — `10.1.1.2` (shipped: `design_projects` / `design_versions`, Alembic `p3q4r5s6t789`)
- API — `10.1.1.3` (shipped: `/design-projects`; evidence `test_design_projects_10_1_1_3.py`)
- UI — `10.1.1.4` (shipped: `/design/projects`; Production nav «Дизайн-проекты»)
- Owner visual — `10.1.1.5` STOP
- Файлы макетов, логотипы, комментарии (`10.1.2`)
- Авто-синхронизация `design_approval_status`
- Клиентский портал ревью (`10.2` cancelled)
- Auth/roles (`17.1`)
- Object storage / CDN (reuse ADR-011 local storage pattern initially)

## Последствия

- Появляется явный SoT для версий дизайна, отдельный от TC gallery и order approval flag.
- `10.1.2` расширяет версии активами без смены кардинальности.
- Shop и commercial gates остаются на уже закрытых контурах.

## Связанные документы

- ADR-003 — sales design approval status
- ADR-016 — TC media vs Stage 10
- ADR-011 — media storage pattern
- ADR-022 — DesignVersion assets + module comments
- Roadmap Stage 10 boundary note (`2026-08-01`)
