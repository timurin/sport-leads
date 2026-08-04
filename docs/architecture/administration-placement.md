# Administration placement rules (Stage 18.1.3)

**Code:** `SL-ADMIN-PLACEMENT-v1`  
**Date:** `2026-08-02`  
**Roadmap:** `18.1.3`  
**Related:** `18.1.4` templates, `18.2` platform directories, Stage `9.6` tech-card settings

## Purpose

Единые правила, **куда класть** справочники и настройки: оболочка Администрирования (группа «Платформа») vs доменные группы Настроек / модульные workspaces.

## Contours

| Contour | Owns | Nav home | Examples |
|---------|------|----------|----------|
| **A — Platform shell** | Кросс-модульные параметры и справочники без доменного владельца | Настройки → **Платформа** | Системные настройки (`18.1.2`), справочники платформы (`18.2`), печатные формы (`18.3`) |
| **B — Domain catalog** | Справочник принадлежит одному доменному stage | Свои группы Настроек / Склад / Производство | Номенклатура (`4`), база лекал (`6`), склады (`12`), ставки НДС (`3.3`), настройки техкарт (`9.6`) |
| **C — Access / ops** | Auth, RBAC, stage executors, production ops | Пользователи / ops docs | `17.1`, `17.2` — **не** Stage 18 directories |

## Placement tests (in order)

1. **Есть ли доменный SoT и stage-владелец?** → contour **B** (не дублировать в Платформе).
2. **Сущность нужна ≥2 независимым модулям и не является мастер-каталогом домена?** → contour **A** (`18.2`).
3. **Это бренд/локаль/TZ инсталляции?** → `18.1.2` system settings (не справочник).
4. **Это шаблон печати?** → `18.3` (≠ data import `4.5` / ≠ ops journal `18.4`→v1.00).
5. **Это роль/сессия/audit?** → Stage `17.1` (не Administration directories).

## Explicit stay in domain (do not move to 18.2)

| Item | Why |
|------|-----|
| Номенклатура / категории / UoM / characteristics | ADR-012 / Stage `4` |
| Модели, размерные сетки, операции пошива | ADR-014 / Stage `6` |
| Склады, складские документы | Stage `12` |
| Организации / сотрудники / подразделения | Stage org contour |
| Ставки НДС | Commercial / Stage `3` |
| Настройки техкарт | Stage `9.6` (explicitly ≠ platform directories) |
| Клиенты | CRM `2.2` (`/sales/clients`) — «Контрагенты» hub stub не = `18.2` MVP |

## Platform directories MVP (`18.2`)

First registry entry: **Города** (`cities`) — география, потребляется CRM/заказами/коллектором без доменного каталога SoT.

Hub `/settings/platform-directories` lists registry entries; each live directory has list/card under `/settings/platform-directories/{code}`.

## Anti-patterns

- Дублировать UoM / warehouses / product-models под «Платформу».
- Класть print templates в domain modules (SoT = `18.3` registry).
- Считать stub hub-карточки («Контрагенты») уже закрытыми `18.2` без contract + API.

## Evidence

- Task: `docs/tasks/v0.9.0-stage-18.1.3-administration-placement.md`
- Templates: `docs/architecture/administration-page-templates.md` (`18.1.4`)
- Registry: `docs/architecture/platform-directories.md` (`18.2.1`)
