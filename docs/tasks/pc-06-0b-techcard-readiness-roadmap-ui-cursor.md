# PC-06.0B — TechnicalCard Readiness Roadmap UI

## Исполнитель
Cursor

## Зависимость
После PC-06.0A.

## Цель
Добавить в карточку техкарты manager-facing roadmap/checker готовности на базе существующего:

`GET /technical-cards/{id}/readiness`

UI не должен вычислять readiness самостоятельно.

Production core не менять.

---

## 1. Размещение

Добавить компактный блок в верхней части TechnicalCard, до основных рабочих секций.

Название:

`Готовность техкарты`

Показывать:
- общий статус;
- прогресс `N из 7`;
- 7 шагов;
- возможность свернуть/развернуть.

Не превращать страницу в wizard.

---

## 2. Шаги

Использовать backend order и backend codes:

1. Основные данные
2. Модель и сборка
3. Маршрут
4. Персонализация
5. Нормы производства
6. Планирование
7. Готовность к запуску

Не переопределять порядок на frontend.

---

## 3. Визуальные состояния

Backend status:

- `completed`
- `warning`
- `blocked`
- `pending`

UI:

### completed
Иконка/check, спокойный позитивный статус.

### warning
Жёлтый/amber акцент.

### blocked
Красный акцент.

### pending
Нейтральный серый.

Не использовать агрессивный красный для warning.

---

## 4. Содержимое шага

В collapsed state:
- иконка;
- title;
- короткий status/summary.

При раскрытии:
- summary;
- issues;
- для каждого issue:
  - понятный текст;
  - `Как исправить`;
  - action/link, если backend дал `fix_action` / `fix_url`.

Raw diagnostic code не показывать обычному менеджеру.

Debug details — только если уже включён Debug Mode и contract их отдаёт отдельно.

---

## 5. Пример UX

`Готовность: 5 из 7`

`✓ Основные данные`
`✓ Модель и сборка`
`✓ Маршрут`
`! Персонализация — заполнено 3 из 4`
`× Нормы производства — отсутствует норма печати`
`○ Планирование`
`○ Готовность к запуску`

После раскрытия:

`Персонализация заполнена на 3 из 4 изделий.`

`Как исправить: добавьте ещё 1 изделие или скорректируйте персонализацию.`

Button/link:
`Открыть персонализацию`

---

## 6. Навигация fix_action

Использовать существующие anchors/routes.

Если шаг относится к блоку текущей карточки:
- scroll/focus соответствующий section.

Если backend даёт `fix_url`:
- перейти туда.

Не invent routes.

Если backend action неизвестен:
- показать текст без кнопки.

---

## 7. Launch integration

Кнопка `Запустить ТК` должна использовать backend `can_launch`.

Если `can_launch=false`:
- не запускать;
- по клику/hover показать:
  `Техкарта не готова к запуску`;
- показать количество blocking issues;
- предложить открыть roadmap.

Не создавать второй frontend launch-validator.

Если `can_launch=true`:
- сохранить текущий launch flow.

После успешного launch:
- refresh readiness;
- production fact не стартует автоматически.

---

## 8. Auto refresh

Readiness должен обновляться после успешных действий, влияющих на него:

- save basic data;
- select/change model;
- assembly change;
- apply route;
- personalization save;
- route/norm readiness refresh;
- schedule/replan;
- launch.

Не делать polling.

Использовать существующий page/server refresh/revalidation pattern.

---

## 9. Completed card

Для completed TechnicalCard:
- roadmap остаётся read-only history/status;
- не показывать CTA `Запустить ТК`;
- launch step должен отображать завершённое/финальное состояние согласно backend contract;
- не предлагать исправлять уже завершённую карту без backend issue.

---

## 10. Mobile / desktop

Desktop:
- компактный горизонтальный/вертикальный checklist внутри card;
- не занимать половину первого экрана.

Mobile:
- одна колонка;
- collapsed by default допустимо, но overall progress должен быть виден.

Соблюдать текущий SPORT-LEADS UI style / `SL-UI-CONTEXT-v1`.

---

## 11. Известные P2/P3 не чинить

Не исправлять:
- forecast reload;
- model search;
- duplicate date UX;
- delayed Kanban refresh;
- Calendar operation status;
- completed WIP chip;
- empty `ВТО и Упаковка`;
- hydration warning.

Если roadmap визуально выявляет их — только не расширять scope.

---

## 12. E2E проверки

Минимум на двух картах:

### Incomplete/new card
Проверить:
- blocked/pending steps;
- fix actions;
- launch disabled/blocked correctly.

### Ready card
Проверить:
- 7-step progression;
- warning personalization does not necessarily block if backend `can_launch=true`;
- plan step completed;
- launch available.

Использовать существующие test data или создать отдельную UI test card без изменения production facts существующих 157/158/159.

---

## 13. Tests

Минимум:
- renders 7 backend steps;
- completed/warning/blocked/pending styles;
- issue expansion;
- fix_url navigation;
- fix_action local navigation;
- launch uses `can_launch`;
- no duplicated frontend readiness rules;
- refresh after relevant mutations;
- completed card state.

Проверки:
- frontend targeted tests;
- eslint;
- tsc;
- production build;
- project check;
- git diff --check.

Commit/push не выполнять.

---

## Acceptance

Готово, если:
1. менеджер видит `Готовность техкарты`;
2. ясно, что уже заполнено и что мешает;
3. каждая проблема объясняет, как исправить;
4. UI использует только backend readiness contract;
5. `Запустить ТК` синхронизирована с `can_launch`;
6. production core не изменён;
7. новых P0/P1 нет.

Финальная строка:

`PC-06.0B TECHCARD READINESS ROADMAP UI READY`
