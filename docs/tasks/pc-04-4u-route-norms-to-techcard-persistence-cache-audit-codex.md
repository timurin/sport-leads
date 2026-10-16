# PC-04.4U — Route Norms → TechnicalCard Persistence + Cache Audit

## Исполнитель
Codex

## Проблема
В Model → `Варианты маршрутов` нормы сохранены, например:
- Дизайн = 1.000 шт.
- Сублимационная печать = 0.700 м.п.
- Термоперенос = 0.700 м.п.
- Раскрой/Пошив/ВТО/Упаковка = 1.000 шт.

Но в TechnicalCard → `Операции / объёмы` те же операции показывают `0.000`.

PC-04.4T исправила часть пересчёта, но основной source norm из варианта маршрута до ТК всё ещё не доходит.

Возможные причины:
- stale snapshot;
- stale frontend/backend cache;
- старые `TechnicalCardOperationLine`;
- route preset/model variant пишет норму в одно поле, а apply/create читает другое;
- новая ТК получает snapshot без актуальной нормы.

## Цель
Найти точный root cause и восстановить flow:

`Model Route Variant norm`
→ `Routing/Route preset`
→ `TechnicalCard snapshot`
→ `TechnicalCardOperationLine`
→ `volume`
→ `Demand`
→ `Scheduler`

Пример: `0.700 × quantity 8 = 5.600 м.п.`

## 1. DB audit
Для одной модели и одной `CAL-STRESS` ТК проверить напрямую PostgreSQL:
- route variant/preset row;
- norm per 1 item;
- routing stage/source line;
- snapshot node;
- TechnicalCardOperationLine;
- stored multiplier/coefficient;
- volume;
- quantity.

Составить краткую таблицу `source -> id -> stored value`.

## 2. Existing vs new TK
Проверить два сценария:

### A. Существующая CAL-STRESS ТК
Почему operation lines остались `0.000`.

### B. Новая временная standalone ТК
Создать из той же Model + Routing и проверить, получает ли она актуальные нормы сразу.

После проверки временную ТК удалить.

Это должно разделить:
- creation/persistence bug;
- stale snapshot/backfill;
- cache/display issue.

## 3. Cache audit
Проверить только реально существующие уровни:
- Next.js fetch cache/revalidate;
- frontend state;
- backend cache, если есть;
- SQLAlchemy session/identity reuse;
- stale API response;
- persisted route snapshot.

Если кеш не причина — явно написать:
`CACHE NOT ROOT CAUSE`.

Если причина в кеше — исправить invalidation/revalidate точечно, без глобального `no-store`.

## 4. Source of truth
Определить одно каноническое поле нормы на 1 изделие.

Route editor, TK creation/reapply, quantity recalculation и Demand должны читать одну semantics.

Не оставлять неоднозначные параллельные значения `volume/base_rate/route norm/copied multiplier`.

Если snapshot должен хранить копию нормы — использовать/зафиксировать понятное поле типа `source_norm_per_item`.

## 5. Snapshot semantics
Определить и сохранить правило:
- новая ТК получает текущую норму template/model variant;
- существующая ТК не меняется от live edit шаблона;
- explicit reapply route получает новые нормы;
- изменение quantity пересчитывает volume по сохранённой snapshot norm;
- Scheduler не читает live model norm для старой ТК.

## 6. Исправление
После root cause восстановить canonical path:

### create/reapply route
`norm_per_item` копируется в snapshot/operation line.

### calculated volume
`volume = norm_per_item × TechnicalCard.quantity`
с учётом существующего multiplicity, где применимо.

### quantity change
Пересчитать volume по сохранённому coefficient/norm.

### manual override
Не затирать, если текущий contract поддерживает manual value.

## 7. E2E proof
На реальном примере quantity = 8:

- Сублимационная печать: `0.700 × 8 = 5.600 м.п.`
- Термоперенос: `0.700 × 8 = 5.600 м.п.`
- `1.000 шт. × 8 = 8.000 шт.`

Проверить:
1. DB source norm;
2. create/apply TK;
3. DB operation lines;
4. GET API;
5. frontend read model/payload;
6. Demand;
7. Scheduler preflight.

## 8. CAL-STRESS repair
После исправления не делать broad rewrite.

Для `CAL-STRESS-*`:
- найти stale/zero copied norms;
- безопасно reapply/rebuild только stress dataset, если требуется;
- не трогать не-stress ТК.

В отчёте указать количество исправленных stress cards.

## 9. Tests
Добавить regression:
- route norm persists to new TK;
- `0.700 × 8 = 5.600`;
- `1.000 × 8 = 8.000`;
- quantity change recalculates;
- live template norm edit does not mutate existing TK;
- explicit reapply gets new norm;
- manual override preserved;
- ONE OF only selected member participates;
- API/read model returns persisted volume.

Full:
- backend tests;
- frontend tests only if touched;
- project check;
- DB integrity;
- git diff --check.

## Ограничения
- один агент end-to-end;
- не передавать части другим агентам;
- не делать broad reset;
- не перетирать WIP;
- не создавать fake norms;
- не менять Capacity/WorkCenter;
- не менять Scheduler semantics;
- не commit/push.

## Краткий отчёт
1. root cause;
2. cache — причина или нет;
3. canonical source field;
4. DB before/after;
5. existing vs new TK;
6. CAL-STRESS repair count;
7. tests.

Финальная строка:
`PC-04.4U ROUTE NORMS TO TECHCARD FLOW VERIFIED END-TO-END`

## Отчёт выполнения — 2026-10-10

Выбрана только PC-04.4U по запросу владельца после PC-04.4T. Один исполнитель; исходный WIP сохранён, переход стадии/commit/push не выполнялись.

**Root cause:** 29 из 30 старых CAL-STRESS ТК сохраняли `volume=0.000`, `volume_qty_per_item=NULL`: PC-04.4T восстановила только CAL-STRESS-001; миграция не делала backfill. PostgreSQL и API совпадают. Дополнительно producer штучных строк всегда брал коэффициент1, обходя сохранённую норму варианта; исправлен общий выбор совместимой нормы для обеих единиц.

**CACHE NOT ROOT CAUSE.** Next data layer `order-tech-cards-api.ts` уже использует `cache: "no-store"`; server actions выполняют `revalidateTechCardPaths`, UI вызывает `router.refresh()`. Operations выводятся из `card.operation_lines`; drafts обновляются по card/operation_lines/updated_at. Backend в этом flow не кеширует объёмы; `get_db` создаёт Session на запрос, закрывает её, norm repository использует `populate_existing=True`/selectinload. Новую глобальную cache policy не добавляли. Persisted snapshot — источник старых нулей; GET/Demand не должны подменять их live нормой.

### PostgreSQL source → snapshot → объём

| Источник | ID | Stored value |
|---|---|---|
| Model / model-routing link / route | 1 / 2 / 1 | active=true |
| Sublimation / Heat source norms | 3 / 4 | 0.700 linear_meters |
| Design source norm | 2 | 1.000 pieces |
| Route source Sublimation / Heat | 40 / 41 | operations1 / 2 |
| CAL-STRESS-001 snapshot nodes | 840 / 841 | source40 / 41; quantity8 |
| CAL-STRESS-001 operation inputs | см. existing-api.json | basis0.700 → volume5.600; pieces basis1 → volume8 |
| Старый CAL-STRESS-006 model / link / route | 1 / 3 / 2 | quantity28 |
| Его print source norms | 9 / 10 | 0.700 linear_meters |
| Его source → snapshot | 72 / 73 → 579 / 580 | сохранены |
| Его operation lines before → after | 1036 / 1037 | volume0/basisNULL → volume19.600/basis0.700 |
| Новая временная ТК print inputs | 1818 / 1819 | basis0.700 × quantity8 = volume5.600 |

Полная цепочка IDs: ignored `logs/pc-04-4u/db-source-chain.json`, `sources.json`, `before.json`, `repair.json`, `new-card-db.json`, `after.json`. Реальные нормы модели5 сейчас **1.000 м.п.**, модели1 **0.700**; общую 0.700 не подставляли.

**Existing vs new:** новая standalone ТК id120 создана из model1 / assembly1 / routing1 / quantity8 и зафиксирована commit. Новая PostgreSQL Session, GET API, frontend payload и две загрузки страницы подтвердили `5.600` м.п. и `8.000` шт. После проверки удалены только временная ТК и её собственная новая группа; integrity/fingerprints подтверждены, временная auth session отозвана. Проверены existing86, repaired91, new120 при 1440×1000; UI дважды совпал с DB/API. Скриншоты/тексты/API: `logs/pc-04-4u/*-ui.png`, `*-ui-0.json`, `*-ui-1.json`, `*-api.json`. Шаблон detail сохранён; frontend/Protected Shell не менялись.

**Source of truth:** `ProductModelOperationNorm.norm_qty_per_item` + `unit`, scoped active model/routing + operation/workshop, — поле редактора/create/reapply. `TechnicalCardOperationLine.volume_qty_per_item` — frozen source norm per item, `volume` — rounded total basis × quantity. Новое параллельное поле не добавлено; `CapacityResource.base_rate` — мощность, не норма объёма. Уникальная operation-specific норма приоритетнее workshop default для meters и pieces. Default1 для pieces — только без настроенной нормы; invalid/zero configured norm не маскируется. Live edit не меняет старую ТК; quantity использует frozen basis; explicit route reapply принимает текущие нормы согласно существующему контракту замены snapshot. Manual shop write очищает basis и переживает quantity change. Demand whole-card item/time правила не переопределены штучным коэффициентом; Scheduler не читает live model norm для старых meter inputs.

**CAL-STRESS repair:** в одной транзакции существующая явная привязка той же модели/сборки восстановила **29 ТК / 329 входов**, включая **22 meter rows на 11 ТК**. Guard: точные IDs86..115 / CAL-STRESS-001..030, standalone/draft, все ремонтируемые строки zero/null; смешанные/manual строки останавливают repair. Card86 не менялась. Routing operation IDs, stage nodes/edges/source IDs, ONE OF groups/selections/status, quantity/priority/dates/locks, все calendar assignments/allocations сохранены. Sewing rows заменены штатной синхронизацией сборки. Все30 ТК остались; non-stress и справочники не изменились. Evidence/script: `logs/pc-04-4u/verify.py`, `repair.json`, `fingerprints-before.json`, `fingerprints-after.json`, `frozen-before.json`, `frozen-after.json`, `integrity.json`.

До365 нулей, после36 meter zeros на18 ТК без подходящих source norms. Diagnostics:36 missing_linear_meters,30 missing_sewing_norm,5 route_snapshot_mismatch (laser pieces vs capacity linear_meter). Ready0/blocked30, Scheduler dry-run показывает реальные блокеры; массовое планирование не выполнялось. PC-04.4S остаётся открытой. Capacity/WorkCenter/Scheduler semantics и production/VPS не затрагивались.

**Файлы/проверки:** runtime diff только `backend/app/services/technical_cards.py`. В существующий `backend/tests/test_operation_input_population_pc_04_4t.py` добавлено5 cases: piece norm2.5; два invalid cases; live edit/reapply через commit/new Session; API persisted read-model. Existing cases покрывают5.6/8, qty/frozen, manual и ONE OF. Focused **22 passed**; PostgreSQL/API/UI/integrity **PASS**; полный `scripts/check_project.py` **10/10 PASS** (761 backend / 381 frontend), подробности `logs/pc-04-4u/project-check.log`. Модели/DTO/миграции U не менялись, используется T migration `d0e1f2a3b456`. Focused pytest предупреждал о локальном `.pytest_cache` (config, тесты прошли); неизвестный cache файл не удаляли. Новых P0/P1 дефектов реализации не обнаружено, исходные data/config blockers S сохраняются.

Roadmap/ERP-check/project-structure и HTML twins обновлены в этой итерации: **HTML twin synced**. Следующая рекомендуемая итерация — реальные отсутствующие meter/time нормы и согласование laser units, затем повторная PC-04.4S acceptance; автоматически не начата. Commit/push не выполнялись.

PC-04.4U ROUTE NORMS TO TECHCARD FLOW VERIFIED END-TO-END
