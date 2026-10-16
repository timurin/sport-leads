# PC-04.4N — Unified Readiness Error Stickers UI

## Исполнитель
Cursor

## Зависимость
Начинать после PC-04.4M.

## Цель
На трёх экранах показывать одинаковые diagnostics из backend:
- `/settings/catalogs/tech-operations`
- `/settings/catalogs/routings/[id]`
- `/production/tech-cards/[id]`

Не вычислять ошибки во frontend.

## UI
Под заголовком страницы/карточки добавить компактную строку стикеров diagnostics.

Примеры:
- `⚠ Подготовка макетов к печати · Норма времени`
- `⚠ Печатник / подготовка · Рабочих часов в день`
- `✕ Epson SC-F9200 · Производительность`

### Sticker содержит
- severity;
- конкретное `entity_name`;
- конкретное `field`;
- короткое сообщение в tooltip/expanded view.

Не показывать общие сообщения без конкретизации вроде:
- `Маршрут требует настройки`
- `Нужен ручной ввод`

## Поведение
1. Один backend diagnostic = одинаковая подпись на всех применимых экранах.
2. Клик по sticker:
   - TechOperation — открыть/сфокусировать нужную вкладку и поле;
   - Routing — выделить проблемную operation и дать `Настроить операцию`;
   - TechnicalCard — показать место исправления и deep-link в admin screen.
3. Если diagnostics много: первые 3 + `Ещё N`.
4. Severity:
   - blocking/error = красный;
   - warning = оранжевый;
   - info = нейтральный.
5. После исправления и reload/revalidate sticker исчезает везде.
6. Старые дублирующие большие warning blocks убрать/свернуть в этот механизм.

## Тексты
Основной источник текста — backend `message`.
Frontend не должен переименовывать одну и ту же ошибку по-разному на разных страницах.

## Tests
- одинаковый diagnostic на трёх экранах;
- entity + field;
- click/deep-link;
- `Ещё N`;
- no duplicate warning;
- resolved diagnostic disappears;
- ONE OF selected/default;
- frontend tests;
- eslint;
- tsc;
- production build;
- project check;
- git diff --check.

## Не менять
- backend;
- Scheduler/Demand;
- Routing/Snapshot;
- Capacity;
- VIS-STRESS.

Финальная строка:
`PC-04.4N READINESS ERROR STICKERS READY FOR OWNER REVIEW`
