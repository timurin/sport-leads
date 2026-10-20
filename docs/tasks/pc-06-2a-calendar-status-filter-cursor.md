# PC-06.2A — Calendar Status Filter

## Исполнитель
Cursor

## Цель
Добавить в недельный производственный календарь фильтр по статусу назначения/ТК, чтобы пользователь мог скрывать лишние записи и видеть только нужные состояния.

Текущий Calendar DTO уже отдаёт status конкретной snapshot-операции после PC-06.2. Использовать его как источник истины.

## UI
В toolbar календаря добавить компактный фильтр:

`Статус: [Все ▼]`

Multi-select / checkbox dropdown:
- Все
- Запланирована
- В работе
- Завершена

Если backend возвращает дополнительные canonical состояния, не придумывать новые названия — отобразить их через существующий mapping.

## Поведение
1. По умолчанию: `Все` — текущее поведение без потери данных.
2. Можно выбрать один или несколько статусов.
3. Calendar скрывает assignments, status которых не выбран.
4. Фильтр влияет только на отображение календаря.
5. Не менять:
   - Scheduler;
   - CalendarAssignment;
   - Kanban;
   - Queue;
   - production fact;
   - ручное планирование.
6. Переключение фильтра не должно вызывать перерасчёт production plan.

## Рекомендованный UX
Показывать короткий summary в контроле:
- `Все статусы`
- `В работе`
- `Запланирована + В работе`
- `2 статуса`

Опционально добавить быстрые presets:
- `Активные` = Запланирована + В работе
- `Завершённые` = Завершена

Если это заметно усложняет UI — presets не делать.

## URL state
Если текущий Calendar уже хранит фильтры в query params — использовать тот же pattern.
Если нет — достаточно локального state страницы, без нового backend contract.

## Mobile
На узкой ширине фильтр не должен ломать toolbar.
Разрешён перенос на вторую строку.

## Tests
Минимум:
- default показывает все assignments;
- `В работе` показывает только in_progress;
- `Завершена` показывает только completed;
- multi-select работает;
- empty result не ломает grid;
- фильтр не меняет assignments/production fact;
- desktop/mobile rendering.

## Проверки
- targeted frontend tests;
- eslint;
- tsc;
- production build;
- project check;
- git diff --check.

## Не делать
- backend status redesign;
- Calendar architecture changes;
- Scheduler changes;
- commit/push.

## Acceptance
Готово, если пользователь может быстро отфильтровать недельный Calendar по статусам операций/ТК, а сам production plan остаётся неизменным.

Финальная строка:
`PC-06.2A CALENDAR STATUS FILTER READY`
