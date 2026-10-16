# PC-04.4V — TechnicalCard Journal Debug Mode

## Исполнитель
Cursor

## Цель
В существующем блоке `Журнал` техкарты добавить режим `Debug`, который показывает все технические ошибки/diagnostics по текущей ТК в одном месте с понятным описанием.

Backend не менять, если существующих API достаточно.

## UI

В блоке `Журнал` добавить переключатель:
- `Журнал`
- `Debug`

`Debug` доступен только в техкарте и не заменяет обычную историю.

## Что показывать в Debug

Собрать все доступные diagnostics/errors текущей ТК из существующих API:

- route/readiness diagnostics;
- Demand blockers;
- Scheduler blockers;
- ONE OF selection errors;
- operation volume errors;
- assembly/sewing norm errors;
- resource/capacity errors;
- WorkCenter/equipment errors;
- snapshot/routing errors;
- calendar assignment/replan errors;
- API errors, если они уже сохранены/возвращаются для текущего состояния.

Не придумывать ошибки во frontend.

## Формат записи

Каждая запись должна показывать:

- severity: error / warning / info;
- code;
- источник/слой:
  - Routing
  - Snapshot
  - Demand
  - Capacity
  - Scheduler
  - Calendar
  - Assembly
  - Operation
- entity name;
- field;
- human-readable message;
- technical details в раскрываемом блоке;
- timestamp, если он реально доступен;
- entity id / operation id / snapshot node id, если доступны.

Пример:

`ERROR · Demand`
`Сублимационная печать · Объём операции`
`Не рассчитан объём операции для техкарты.`

Details:
- code: `missing_operation_volume`
- operation_id: 12
- snapshot_node_id: 45

## Группировка

По умолчанию:
- сначала blocking errors;
- потом warnings;
- потом info.

Добавить фильтр:
- Все
- Ошибки
- Предупреждения

Дополнительно можно группировать по слоям.

## UX

Если ошибок нет:
`Ошибок и предупреждений не обнаружено.`

Если есть ошибки:
показывать count рядом с `Debug`, например:
`Debug 3`

Клик по записи, если возможно:
- scroll/focus на проблемный блок;
- либо deep-link в соответствующий admin screen.

Не делать обязательным, если backend metadata недостаточна.

## Refresh

Добавить кнопку:
`Обновить диагностику`

Она должна revalidate текущие данные и обновлять список без полного reload страницы.

## Technical details

Раскрываемый блок `Технические данные` может показывать raw diagnostic payload в компактном read-only виде.

Не показывать секреты, cookies, токены, пароли, connection strings.

## Не менять

Не менять:
- backend business logic;
- Scheduler;
- Demand;
- Capacity;
- Routing/Snapshot;
- Calendar semantics;
- VIS-STRESS/CAL-STRESS data.

Если какого-то diagnostic source нет в API:
зафиксировать `BACKEND GAP`, не создавать fake source.

## Tests

Проверить:
- Debug tab;
- empty state;
- multiple errors;
- severity sorting;
- filtering;
- refresh;
- technical details;
- no secrets;
- normal Journal unaffected.

Full:
- frontend tests;
- eslint;
- tsc;
- production build;
- project check;
- git diff --check.

## Acceptance

Готово, если по любой проблемной ТК пользователь может открыть:
`Журнал → Debug`
и увидеть в одном месте:
- что сломано;
- где;
- код ошибки;
- человекочитаемое описание;
- технические детали.

Финальная строка:
`PC-04.4V TECHCARD JOURNAL DEBUG MODE READY FOR OWNER REVIEW`
