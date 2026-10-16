# PC-05.1 — Global Debug Center UI

## Исполнитель
Cursor

## Зависимость
После PC-05.0C.

## Цель
Добавить глобальный Debug Mode платформы и модальное окно `Диагностика платформы`.

## 1. System setting
`Платформа -> Системные настройки`

Добавить:
`Режим отладки`

Когда выключен:
- Debug UI скрыт.

Когда включён:
- в platform shell появляется кнопка/иконка `Debug`;
- доступно глобальное modal.

Использовать существующий settings contract; если backend setting отсутствует — точный BACKEND GAP, без frontend-only permanent setting.

## 2. Global modal
`Диагностика платформы`

Показывать:
- Platform Health summary;
- counts by severity/category/module;
- diagnostics table/list;
- search;
- filters:
  - Все
  - Configuration
  - Data Flow
  - Runtime
  - Integrity

## 3. Diagnostic card
Показывать:
- entity;
- field;
- message;
- expected source;
- source value;
- actual value;
- trace;
- fix action;
- deep-link.

Раскрываемый `Технические данные` — safe debug_details, без секретов.

## 4. Data-flow trace
Визуально:
`Source -> Snapshot -> Derived -> Demand -> Scheduler`

Сломанный узел выделять красным.

## 5. Context
Если Debug открывается из конкретного экрана:
- автоматически фильтровать по текущей entity/module;
- дать `Показать все ошибки платформы`.

## 6. Refresh
Кнопка:
`Проверить платформу`

Revalidate diagnostics через backend health API.
Не выполнять auto-fix.

## 7. TechnicalCard Journal
Существующий `Журнал -> Debug` должен использовать тот же diagnostic DTO/API, а не отдельную frontend логику.

## Tests
- debug setting on/off;
- global modal;
- filters/search;
- trace;
- deep-links;
- technical details no secrets;
- entity-context filter;
- Journal Debug reuse;
- frontend tests;
- eslint;
- tsc;
- production build;
- project check;
- git diff --check.

## Не менять
- diagnostic backend semantics;
- Scheduler/Demand/Capacity;
- business data;
- VIS/CAL-STRESS.

## Acceptance
Готово, если владелец может включить Debug Mode и из любого раздела открыть единый Debug Center, увидеть источник ошибки, точку разрыва data-flow и место исправления.

Финальная строка:
`PC-05.1 GLOBAL DEBUG CENTER READY FOR OWNER REVIEW`
