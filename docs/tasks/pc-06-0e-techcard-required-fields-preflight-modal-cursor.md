# PC-06.0E — TechnicalCard Required Fields Preflight Modal

## Исполнитель
Cursor

## Цель
Расширить существующую проверку техкарты перед расчётом/планированием.

Сейчас уже есть modal `Нормы операций не заполнены!`.
Нужно добавить в тот же preflight/checker другие обязательные условия, без дублирования backend business rules на frontend.

## Обязательные новые проверки

### 1. Не выбрана сборка
Если у выбранной модели нет выбранной сборки / assembly variant:
- блокирующее предупреждение `Сборка изделия не выбрана`;
- текст: `Для выбранной модели необходимо выбрать сборку изделия.`;
- action `Выбрать сборку`;
- переход к существующему блоку модели/сборки.

Не выбирать сборку автоматически.

### 2. В сборке изделия не заполнены обязательные данные
Если сборка выбрана, но в ней отсутствуют обязательные данные для расчёта/производства:
- блокирующее предупреждение `В сборке изделия не заполнены обязательные данные`;
- показать конкретно отсутствующие поля;
- action `Заполнить сборку`.

Примеры только если они реально обязательны по текущему backend/schema:
- стоимость / цена пошива;
- время / duration;
- операционная норма;
- иные обязательные поля сборки.

ВАЖНО: не хардкодить список по догадке.
Cursor должен определить обязательные поля по backend schemas/services/readiness/diagnostics/validation rules.
Если backend contract неоднозначен — зафиксировать `BACKEND GAP`, а не придумывать frontend rule.

## 3. Проверить остальные обязательные условия для проведения ТК
Targeted-аудитом определить, какие ещё существующие обязательные условия реально блокируют:
- расчёт ТК;
- планирование;
- запуск ТК.

Минимально проверить:
- модель;
- сборка;
- маршрут;
- verified route snapshot;
- ONE OF selection, если требуется;
- quantity;
- дата начала / дата отгрузки;
- operation norms;
- material/demand inputs;
- обязательные параметры сборки;
- planning readiness;
- stale/invalid plan;
- другие blocking diagnostics backend.

Не добавлять новые бизнес-правила.

## 4. Единое модальное окно preflight
Вместо отдельных несвязанных alert/modal сделать единый manager-facing modal.

Пример:

### Техкарта требует настройки
`Перед расчётом и запуском устраните ошибки:`

- `Сборка изделия не выбрана` → `[Выбрать сборку]`
- `В сборке не заполнено время пошива` → `[Заполнить сборку]`
- `Не заполнены нормы операций` → список операций → `[Заполнить нормы]`
- `Персонализация заполнена на 3 из 4 изделий` → warning, если backend считает non-blocking.

## 5. Severity
Использовать backend/readiness semantics:
- blocked → красный, действие запрещено;
- warning → amber, не обязательно блокирует;
- completed не показывать;
- pending показывать только если реально препятствует текущему действию.

Каждая проблема должна объяснять:
- что не заполнено;
- почему это важно;
- как исправить.

## 6. Источник истины
Предпочтительно использовать `GET /technical-cards/{id}/readiness` и существующие diagnostics.

Frontend не должен второй раз вычислять:
- обязательность сборки;
- обязательность полей сборки;
- norms readiness;
- can_launch.

Если readiness сейчас не содержит assembly completeness:
- targeted проверить backend contract;
- зафиксировать точный `BACKEND GAP`;
- не строить параллельную validation system на frontend.

Допустим только presentation mapping существующих backend diagnostics.

## 7. Когда показывать modal
Показывать при действиях, для которых readiness обязательна:
- расчёт / пересчёт производственного плана;
- запуск ТК;
- при необходимости после выбора модели, если уже известна блокирующая configuration error.

Не показывать modal при каждом открытии страницы.
При обычном просмотре ошибки остаются видны в readiness roadmap.

## 8. UX
Modal:
- компактный;
- список ошибок сгруппирован;
- каждая ошибка имеет action;
- `Закрыть` всегда доступна;
- mobile friendly.

После закрытия:
- данные пользователя не сбрасываются;
- выбранная модель/маршрут сохраняются;
- после исправления и возврата readiness перечитывается.

## 9. Tests
Минимум:
1. model without selected assembly -> modal + `Выбрать сборку`;
2. selected assembly missing required field -> modal lists exact missing field;
3. assembly complete -> no assembly blocker;
4. missing operation norms -> existing norms issue preserved;
5. multiple blockers -> one modal with grouped issues;
6. warning + blocker -> different severity;
7. non-blocking personalization warning does not become blocker;
8. fix action navigates to correct section;
9. after fix + refresh issue disappears;
10. frontend does not duplicate backend readiness rules.

Проверки:
- targeted frontend tests;
- eslint;
- tsc;
- production build;
- `python scripts/check_project.py`;
- git diff --check.

## Не делать
- не менять production core;
- не менять Scheduler;
- не менять Kanban/Queue/Calendar;
- не придумывать обязательные поля без backend contract;
- не commit/push.

## Acceptance
Готово, если:
1. отсутствие сборки явно блокирует нужное действие;
2. неполная сборка показывает конкретные отсутствующие обязательные поля;
3. existing missing norms входят в тот же preflight UX;
4. другие backend blocking conditions отображаются там же;
5. у каждой проблемы есть понятное объяснение и способ исправления;
6. frontend не создаёт вторую независимую validation system.

Финальная строка:
`PC-06.0E TECHCARD PREFLIGHT REQUIRED FIELDS CHECKER READY`

## Результат

Окно собирает уже пришедшие issues readiness и существующий список незаполненных норм модели. Клиент не вычисляет обязательность сборки, полей сборки, норм и `can_launch`.

BACKEND GAP: `GET /technical-cards/{id}/readiness` не называет конкретное поле неполной сборки. `missing_sewing_norm` приходит с `field_label` «Сборка изделия / нормы пошива» и покрывает сразу два случая Demand: нет строк пошива и `duration_seconds <= 0` или `quantity_per_item < 1`. Отдельных кодов для длительности и кратности нет. Стоимость сборки Demand не требует. Пока сервер не пришлёт отдельное имя поля, окно показывает `field_label` и сообщение readiness, а не выдуманный список «время / цена».
