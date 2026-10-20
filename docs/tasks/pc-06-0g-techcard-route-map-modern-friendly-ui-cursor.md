# PC-06.0G — TechnicalCard Route Map Modern Friendly UI

## Исполнитель
Cursor

## Цель
Переделать блок `Технологический процесс` в карточке техкарты, чтобы маршрут производства и расчёт сроков читались быстро и занимали меньше вертикального пространства.

Текущий экран слишком растянут:
- маршрут идёт длинной вертикальной колонкой;
- много пустого пространства;
- расчёт сроков визуально оторван от маршрута;
- неочевидно, где текущий этап, что завершено и что впереди;
- служебный блок дат выглядит как отдельная форма, а не часть производственного плана.

Backend / route semantics / Scheduler не менять.

---

## 1. Новый layout блока

Desktop: сделать компактный двухуровневый layout.

### Верхняя строка — summary
Слева:
- `Технологический процесс`
- route name
- readiness/status badge

Справа компактная сводка плана:
- `Готовность: 15.10.2026`
- `Отгрузка: 31.10.2026`
- `Запас: 16 дней`
- risk/status badge

Не делать отдельную большую боковую карточку.

---

## 2. Маршрут — горизонтальная схема

Вместо длинной вертикальной цепочки сделать горизонтальный маршрут по workshop-блокам:

`Дизайн → Печать → Раскрой → Пошив → Контроль качества`

Внутри workshop компактно показать child operations:

Печать:
- Сублимационная печать
- Термоперенос

Контроль качества:
- ВТО
- Упаковка

Статус workshop / operation должен быть визуально понятен:
- completed — check / muted green;
- in_progress — active accent;
- waiting / planned — neutral;
- blocked / requires setup — warning/error.

Не использовать огромные карточки одинакового размера для 1–2 строк текста.

---

## 3. Состояние текущего этапа

Текущий workshop должен выделяться сильнее остальных.

Пример:
`Печать · В работе`

Для operation:
- `Сублимационная печать · Завершена`
- `Термоперенос · Ожидает`

Не переносить факт из Calendar.
Использовать существующий production/readiness contract.

---

## 4. Расчёт сроков встроить в маршрут

Вместо текущего оторванного блока справа сделать компактную панель:

### Производственный план
- Начало: `15.10.2026`
- Готовность: `15.10.2026`
- Отгрузка: `31.10.2026`
- Запас: `16 дней`
- Риск: `В срок`

Кнопки:
- `Изменить даты`
- `Пересчитать план`

По умолчанию поля даты НЕ должны выглядеть как постоянно открытая форма.

Редактирование дат открывать:
- inline panel;
или
- compact popover/modal.

После сохранения возвращать summary view.

---

## 5. Планирование / stale state

Если план не рассчитан:

`План не рассчитан`
`Укажите даты и рассчитайте производственный план.`

CTA:
`Рассчитать план`

Если plan stale:

`План нужно обновить`
`После изменений в техкарте сохранённый расчёт больше не актуален.`

CTA:
`Пересчитать`

Не показывать manager-facing raw diagnostics.

---

## 6. Уменьшить пустое пространство

Цель desktop:
- весь основной маршрут должен помещаться примерно в один экран по высоте;
- блок не должен иметь сотни пикселей пустого пространства между workshop;
- ширину использовать рационально.

Допустим горизонтальный scroll только внутри route-map при очень длинном маршруте, но не всей страницы.

---

## 7. Сборка изделия

Сейчас в схеме может появляться дополнительный визуальный блок `Пошив базовой футболки`, который пользователь воспринимает как ещё один production workshop.

Нужно визуально отделить assembly от route progression.

Предпочтительно показывать assembly как metadata над маршрутом:

`Сборка: Пошив базовой футболки`

Не рисовать assembly как равноправный этап маршрута, если она не является snapshot workshop/stage.

Не менять backend semantics.

---

## 8. Route operation detail

По клику на workshop или operation можно раскрыть compact detail:
- operation name;
- planned date;
- status;
- norm/readiness issue, если есть;
- current/future fact state.

Не показывать всё сразу.

---

## 9. Readiness integration

Если route/norm/planning имеет blocker:
- показать маленький badge на соответствующем workshop/operation;
- по клику показать friendly explanation;
- использовать существующий readiness/diagnostics contract.

Не создавать новый validator.

---

## 10. Responsive

### Desktop
Горизонтальный route map + compact plan summary.

### Tablet
Route map может переноситься в 2 строки.

### Mobile
Вертикальный компактный stepper:
- workshop title;
- status;
- child operations collapsed.

План — отдельный compact card под route map.

Без горизонтального scroll всей страницы.

---

## 11. Не менять

- snapshot route semantics;
- Scheduler;
- Calendar;
- Kanban;
- Queue;
- readiness backend;
- planning API;
- production fact;
- migrations.

Только frontend presentation + existing read models.

---

## 12. Browser acceptance

Проверить минимум:

1. draft / requires setup;
2. planned waiting;
3. in_progress;
4. completed;
5. route with multiple operations inside one workshop;
6. route without calculated plan;
7. stale plan;
8. desktop 1440+;
9. laptop;
10. mobile 390px.

Сделать screenshots до/после.

---

## 13. Tests

- route grouping by workshop;
- child operation rendering;
- current/completed/planned states;
- assembly shown as metadata, not fake workshop;
- planning summary;
- edit dates flow;
- no-plan/stale states;
- mobile layout;
- no duplicated business logic.

Проверки:
- targeted frontend tests;
- eslint;
- tsc;
- production build;
- `python scripts/check_project.py`;
- git diff --check.

Commit/push не выполнять.

---

## Acceptance

Готово, если:
1. маршрут читается за несколько секунд;
2. текущий этап очевиден;
3. child operations понятны;
4. расчёт сроков визуально связан с маршрутом;
5. блок занимает заметно меньше места;
6. assembly не выглядит как второй production route step;
7. backend/production semantics не изменены.

Финальная строка:

`PC-06.0G TECHCARD ROUTE MAP MODERN UI READY`

## Результат

Схема читает `stage_results` и `production_state`. Строка `source_kind=sewing` уходит в подпись «Сборка: …». На 1310-1 план пустой, маршрут горизонтальный, даты скрыты до «Изменить даты». На E2E-PROD-001-1 сборка «Пошив футболки» над маршрутом, Дизайн/Печать/Раскрой завершены, Пошив ожидает, запас 16 дней. Узкий экран складывает цеха в колонку без прокрутки страницы. Устаревший план покрыт тестом представления; на открытых карточках его не было.
