# Production Calendar v0.1 — утверждение дизайна

**Решение владельца:** [Lightweight Design Freeze](../../tasks/pc-02-1-lightweight-design-freeze-implementation-contract.md), `2026-10-05`. **DESIGN-APPROVED = true.** Это фиксация дизайна и минимального контракта; реализация не начата.

| Экран | Назначение / спецификация | Решение |
|---|---|---|
| UI-A | [Основной недельный календарь](screens/weekly-board.md) | OWNER-APPROVED |
| UI-B | [Добавление плана по существующей ТК](screens/create-order.md) | OWNER-APPROVED |
| UI-C | [Карточка календарного плана](screens/production-order.md) | OWNER-APPROVED |
| UI-D | [Участок за дату](screens/section-day.md) | OWNER-APPROVED |
| UI-E | [Ручное планирование](screens/manual-scheduling.md) | OWNER-APPROVED |
| UI-F | [Настройки мощностей](screens/capacity-settings.md) | OWNER-APPROVED |
| UI-G | [Дашборд производственного календаря](screens/gantt.md) | OWNER-APPROVED |
| UI-H | [Центр отклонений](screens/risks-conflicts.md) | OWNER-APPROVED |

- [x] Владелец подтвердил UI-A–UI-H и общий дизайн в указанной задаче.
- [x] Карта переходов и unified UI contract зафиксированы; PC-UI-02/03 закрыты документационно.
- [x] UI-A — основная ежедневная работа; UI-G/H — необязательный обзор и контроль.
- [x] Минимальный ввод и переиспользование ERP зафиксированы в [implementation contract](../../architecture/production-calendar-implementation-v0.1.md).
- [x] PC-02.1 закрыт как документационный этап; отдельный P1 B1 остаётся открытым.
- [ ] Проверить runtime frontend при реализации: loading/error/403, реальные DTO/права, сохранение контекста ссылок и optimistic concurrency.
- [ ] Проверить новые UI-G/H в Edge 1440/1280/768/390/320 px, keyboard/console и отсутствие переполнения. Предыдущая недоступность браузера не объявлена успешной проверкой.
- [ ] Выполнить обязательные integration/regression checks перед выпуском; прежний baseline 7/10 не считается исправленным.

Прототипы остаются локальными синтетическими файлами, не readiness приложения. Следующий выбор — отдельная задача устранения P1/блокеров либо разрешённый подэтап PC-03 после допуска; автоматического перехода нет. DS-SHELL-01 visual contract preserved; DS-SHELL-02 visual contract preserved.
