# ADR-013 — Create UX: inspector / drawer (materials pattern)

**Status:** принято  
**Date:** `2026-07-21`  
**Roadmap:** `5.4.2.3.*`  
**Reference UI:** `EntityInspector` create mode in `EntityWorkspace` (materials and other entity catalogs)

## Контекст

Кнопка «Создать» на page toolbar открывает создание тремя разными способами:

1. правый inspector (материалы / `EntityWorkspace`) — эталон владельца;
2. центрированный modal (`LeadCreateDialog`, временные panels номенклатуры);
3. demo-заглушка (`DemoActionDialog` на заказах/сделках/задачах).

Нужен единый платформенный паттерн create для лидов, заказов, номенклатуры и элементов справочников.

## Решение

1. **Эталон create** — правый **inspector / drawer**, как в материалах (`EntityInspector` в режиме `create`): панель справа от списка, заголовок «Новый …», форма, закрытие без потери контекста списка.
2. Shared shell — `CreateDrawer` (`frontend/components/ui/create-drawer.tsx`):
   - **docked** — встроенная колонка ~520px (как materials);
   - **overlay** — тот же chrome поверх страницы, если постоянного inspector-колонки нет (kanban и т.п.).
3. Центрированные modal **не** используются для create сущностей.
4. Modal dialogs остаются допустимы только для confirm / delete / узких одноразовых действий и demo-only до миграции.
5. `EntityWorkspace` как **data-слой** для новых persistent-каталогов по-прежнему не целевой (см. inventory D5); переиспользуется **UX create-панели**, не demo-persistence.

## Миграция (roadmap)

| Микрозадача | Содержание |
|---|---|
| `5.4.2.3.1` | Зафиксировать стандарт (этот ADR) |
| `5.4.2.3.2` | Shared `CreateDrawer` shell |
| `5.4.2.3.3` | Номенклатура / категория → CreateDrawer |
| `5.4.2.3.4` | Лид → CreateDrawer |
| `5.4.2.3.5` | Заказ / сделка / задача (убрать DemoActionDialog) |
| `5.4.2.3.6` | Остальные справочники раздела номенклатуры (UoM, характеристики, …) |
| `5.4.2.3.7` | Границы modal vs drawer + visual verification |

## Последствия

- Page toolbar «Создать» всегда открывает правую create-панель (или меню → выбранную панель).
- Глобальная кнопка topbar «Создать» не меняется этим ADR (отдельная задача wiring).
- Lead/Order create сохраняют API-контракты; меняется только оболочка UX.

**Связанные:** DS-SHELL page toolbar vs topbar; inventory D5/D8; ADR-009 (команды создания в workspace).
