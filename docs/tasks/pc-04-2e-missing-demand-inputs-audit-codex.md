# PC-04.2E — Missing Demand Inputs Audit

## Статус
Аудит архитектуры и данных. Без Scheduler engine и без новых расчётов.

## Контекст
PC-04.2B реализовал read-only Demand.
PC-04.2C выровнял единицы CapacityResource и Demand.
PC-04.2D синхронизировал frontend с новым backend-контрактом.

Технические unit mismatch в основном устранены.

Остаются реальные `manual_required` / `missing_input`:
- designers;
- print_operator;
- calender_operator;
- laser_operator;
- cutting_methods;
- возможно другие ресурсы/операции, которые выявит аудит.

## Цель
Определить для каждого оставшегося `manual_required`:

1. какие данные уже существуют в модели;
2. можно ли рассчитать Demand из существующих данных;
3. каких данных реально не хватает;
4. где эти данные должны храниться;
5. требуется ли новое поле/контракт;
6. что НЕ нужно добавлять, чтобы не плодить дублирование.

Никаких новых бизнес-норм не придумывать.

---

## Scope
Backend/code/data audit only.

Не менять:
- DB;
- API;
- frontend;
- Scheduler;
- Demand adapters;
- routings;
- capacity resources.

Результат — архитектурный отчёт.

---

# 1. Designers

Проверить:

- какие данные уже есть в TechnicalCard;
- есть ли design variants;
- есть ли размеры/лекала;
- есть ли количество уникальных комплектов;
- есть ли сложность/коэффициент;
- есть ли базовая норма дизайна;
- есть ли design approval state;
- есть ли отдельные design operation lines.

Ответить:

- можно ли получить design labor_hours автоматически;
- если нельзя — каких конкретных входов не хватает;
- где их хранить:
  - TechOperation;
  - RoutingStep;
  - TechnicalCard;
  - model/pattern data;
  - CapacityResource;
  - nowhere yet.

Важно:
ожидание согласования клиента не считать labor demand.

---

# 2. Print operator

Проверить:

- как сейчас хранится подготовка файлов/печати;
- есть ли fixed per card / per batch norm;
- есть ли operation volume;
- есть ли machine runtime;
- есть ли связь с plotter usage;
- есть ли отдельная operator operation;
- можно ли вычислить labor hours без ложного умножения на число плоттеров.

Ответить:

- нужна ли отдельная фиксированная норма;
- нужна ли норма на запуск;
- где хранить;
- можно ли использовать существующие поля.

Не выводить operator hours автоматически из plotter machine load без подтверждённого правила.

---

# 3. Calender operator

Проверить:

- есть ли отдельная операция каландрования;
- есть ли linear meters;
- есть ли operator/resource link;
- есть ли норма оператора;
- может ли один оператор обслуживать весь calender runtime 1:1;
- есть ли это правило в текущих данных.

Если правила нет:
- не придумывать.

Определить минимальный недостающий вход.

---

# 4. Laser operator

Проверить:

- отдельный ли это ресурс;
- есть ли operation line;
- можно ли считать labor hours как machine active time;
- есть ли подтверждённое правило 1 оператор = 1 лазер;
- есть ли shift/equipment semantics.

Если нет явного правила:
- оставить manual_required;
- зафиксировать, какое поле/правило нужно.

---

# 5. Cutting methods

Проверить:

- где сейчас хранится способ раскроя;
- есть ли manual / stack / laser;
- есть ли split по quantity;
- может ли одна ТК использовать смешанный режим;
- есть ли нужные поля в TechnicalCardOperationLine / routing step / model / TK details.

Нужно определить минимальный контракт:

например:
- cutting_mode
или
- manual_quantity
- laser_quantity

Но только если это действительно нужно и не дублирует существующие данные.

---

# 6. Packaging / team resources

Даже если Demand уже ready, проверить:
- не дублируется ли численность команды;
- не хранится ли team size в другом месте;
- нужен ли вообще отдельный вход в ТК.

Если не нужен — явно зафиксировать.

---

# 7. Sewing

Подтвердить, что:
- текущих данных достаточно;
- no new fields required.

Если есть edge cases:
- missing assembly variant;
- ambiguous norm;
- model mismatch;
описать отдельно.

---

# 8. Linear-meter operations

Проверить:
- откуда приходит operation volume;
- насколько этот источник стабилен;
- нужен ли отдельный contract для volume;
- нет ли дублирования между routing snapshot и TechnicalCardOperationLine.

Если текущий источник достаточен — не добавлять новые поля.

---

# 9. Milestones

Подтвердить, какие milestones:
- readiness;
- procurement;
- QA;
- ready to ship.

Определить:
- нужен ли Demand input;
- какие из них должны быть только state/gate;
- не добавлять capacity fields, если не нужны.

---

# 10. Итоговая матрица

Составить таблицу:

| Resource / mode | Current status | Existing inputs | Missing inputs | Proposed owner | New field needed? |
|---|---|---|---|---|---|

Для каждого missing input обязательно указать:
- точное имя/смысл;
- где должен жить;
- почему именно там;
- почему не в другом существующем справочнике.

---

# 11. Классификация результата

Каждый missing input отнести в одну категорию:

### A. Уже есть
Ничего менять не нужно.

### B. Можно вычислить
Нужно только реализовать adapter.

### C. Нужен новый параметр TechOperation
Например fixed labor norm per card.

### D. Нужен новый параметр RoutingStep
Если зависит от конкретного маршрута/шага.

### E. Нужен новый параметр TechnicalCard
Если зависит от конкретного заказа/ТК.

### F. Нужен manual input
Если автоматизация пока не оправдана.

---

# 12. Не делать

- не добавлять поля;
- не писать миграцию;
- не менять API;
- не менять frontend;
- не менять Demand adapters;
- не писать Scheduler;
- не менять CapacityResource;
- не создавать новые справочники;
- не делать commit/push/merge.

---

## Проверки
- project check;
- existing backend tests;
- git diff --check;
- ссылки на реальные модели/поля/сервисы в отчёте.

## Acceptance
Готово, если после аудита понятно:

- какие `manual_required` можно закрыть существующими данными;
- какие требуют минимальных новых полей;
- где именно эти поля должны жить;
- какие данные точно не надо дублировать.

## Отчёт Codex
Формат:
1. краткий вывод;
2. таблица по каждому ресурсу/режиму;
3. список уже существующих источников;
4. список реально недостающих входов;
5. минимальные рекомендуемые schema changes;
6. что оставить manual;
7. что можно реализовать без migration;
8. tests/checks;
9. подтвердить отсутствие изменений code/DB/frontend и commit/push.
