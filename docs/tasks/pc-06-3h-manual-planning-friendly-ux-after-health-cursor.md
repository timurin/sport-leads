# PC-06.3H — Manual Planning Friendly UX after Planning Health

## Исполнитель
Cursor

## Цель
Довести `/production/calendar/planning` до понятного рабочего интерфейса диспетчера после подключения PC-06.3F/3G.

Не менять backend Planning Health и replan semantics.

---

## 1. Левая колонка — карточки ТК

Каждая ТК должна читаться за 2–3 секунды.

Показывать:
- № ТК / заказ;
- модель;
- количество;
- текущий участок;
- ETA;
- отгрузку;
- запас дней;
- прогресс маршрута;
- один главный status badge.

Приоритет badge:
1. Просрочено
2. Риск срока
3. Требует перепланирования
4. План актуален

Для просрочки дополнительно:
- earliest overdue operation;
- planned date;
- overdue_days;
- overdue count, если >1.

Убрать второстепенный технический шум.

---

## 2. Фильтры

Оставить компактно:

- Все
- Просроченные
- В риске
- Требуют перепланирования
- Без проблем

Фильтр работает только по canonical Planning Health fields.

Добавить счётчики, если они доступны без дополнительных запросов.

---

## 3. Правая часть — выбранная ТК

Верхний summary:

- № ТК;
- модель;
- текущий участок;
- ETA;
- отгрузка;
- запас;
- risk / overdue / replan state;
- progress.

Если есть проблема — одна дружелюбная строка причины.

Пример:
`Просрочена операция «ВТО» на 3 дня.`

---

## 4. Маршрут

Показать компактный route timeline / stepper.

Для каждой операции:
- название;
- участок;
- статус;
- плановая дата;
- overdue badge при необходимости;
- lock/protected indicator;
- can_replan.

Completed/current operations визуально отделить от future operations.

Не перегружать карточки служебными полями.

---

## 5. Перенос операции

Редактор переноса показывать только после выбора future/replannable operation.

Поля:
- операция;
- текущая дата;
- новая дата;
- режим:
  - Только эту операцию
  - Эту и последующие

Кнопка:
`Проверить перенос`

После preview показать отдельный компактный блок:

### Что изменится
- какие операции сдвинутся;
- новая ETA;
- новый запас;
- риск срока;
- warnings/blockers.

Кнопка:
`Применить перенос`

Если backend вернул dependency blocker — показать friendly message и предложить downstream mode, но не переключать автоматически.

---

## 6. Пустые и проблемные состояния

Использовать понятные тексты:

- `Нет техкарт для ручного планирования`
- `Просроченных операций не найдено`
- `Техкарт с риском срока нет`
- `Нет техкарт, требующих перепланирования`
- `Нет техкарт с актуальным планом`

Не показывать backend codes пользователю.

---

## 7. Desktop / Mobile

Desktop:
- master-detail layout;
- минимум пустого пространства;
- левая колонка достаточно широкая для статуса и ETA.

390px:
- одна колонка;
- список → detail;
- route вертикальный;
- editor и preview без горизонтального скролла.

---

## 8. Consistency

Для одной ТК значения должны совпадать с TechnicalCard:

- ETA;
- shipping;
- slack;
- planning state;
- overdue count;
- earliest overdue operation;
- risk;
- progress.

Frontend ничего из этого не пересчитывает.

---

## 9. Browser E2E

Проверить минимум:

### id 163 / PC063D-OVERDUE-20261016-1
- overdue badge;
- earliest overdue operation;
- overdue days;
- фильтр `Просроченные`;
- detail совпадает со списком;
- preview/apply не ломаются.

Дополнительно:
- healthy card;
- risk/replan card, если есть безопасная тестовая ТК;
- desktop;
- 390px.

Не менять production facts защищённых ТК.

---

## 10. Проверки

- targeted frontend tests;
- eslint;
- tsc;
- production build;
- `python scripts/check_project.py`;
- `git diff --check`.

---

## 11. Git

В этой задаче:
- commit/push НЕ выполнять;
- сначала показать результат и browser screenshots/report.

---

## Не делать

- backend changes;
- Scheduler changes;
- Planning Health semantics changes;
- Kanban/Queue changes;
- production fact changes;
- local Calendar Dashboard;
- warehouse/fulfillment changes.

---

## Acceptance

Готово, если ручное планирование выглядит как диспетчерский инструмент, а не техническая таблица:

1. проблемные ТК видны сразу;
2. overdue/risk/replan читаются без открытия карточки;
3. route компактен;
4. перенос понятен как последовательность `выбрать → проверить → применить`;
5. preview объясняет последствия;
6. frontend не содержит бизнес-расчётов Planning Health;
7. desktop/mobile проверены;
8. tests PASS.

Финальная строка:

`PC-06.3H MANUAL PLANNING FRIENDLY UX READY`
