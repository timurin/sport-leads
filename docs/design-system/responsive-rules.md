# Адаптивные правила

Канонические токены: `docs/design-system/breakpoint-tokens.md`, `content-width-tokens.md`.

## Контрольные ширины

- Wide desktop: от `--portal-bp-wide-min` (1500 px) доступной ширины контента.
- Desktop: от `--portal-bp-desktop-min` (1280 px / Tailwind `xl`).
- Laptop: от `--portal-bp-laptop-min` (1024 px / `lg`) — desktop section nav.
- Tablet: от `--portal-bp-tablet-min` (768 px / `md`).
- Mobile: до `--portal-bp-mobile-max` (767 px); узкий mobile — до `--portal-bp-narrow-mobile-max` (600 px).

Viewport-breakpoints применяются к глобальному каркасу. Для вложенных рабочих областей предпочтительны container queries: карточка должна реагировать на собственную ширину, а не на ширину окна.

Ниже `md` Platform Sidebar скрыт; навигация — через topbar menu (`shell-contracts.md`).

## Сетки

- Каждый grid/flex-потомок, содержащий пользовательские данные, получает `min-width: 0`.
- `ResponsiveGrid` использует `repeat(auto-fit, minmax(min(100%, N), 1fr))` с `--portal-grid-min-sm|md|lg` (230 / 300 / 390).
- Нельзя убирать ограничение `min(100%, N)`.
- Две колонки разрешены только при комфортной минимальной ширине обеих частей.
- На mobile карточки идут последовательно; действия переносятся или сворачиваются в `ActionMenu`.

`PageContent` использует `mx-auto w-full min-w-0`; `width` задаёт только max: `default` → `--portal-content-default`, `wide` → `--portal-content-max`, `full` → none.

## Прокрутка

- `AppShell` занимает viewport, а один основной вертикальный scrollbar находится в `[data-app-shell-main]`.
- Корневой контейнер страницы внутри shell не использует собственные `h-screen` и `overflow-y-auto`; глобальный `min-width` запрещён.
- Внутренняя вертикальная прокрутка допустима для чата, dialog и явно раскрытого длинного списка.
- Горизонтальная прокрутка разрешена локально для таблиц, tab/channel strips и stage rail.
- Sidebar может иметь собственную прокрутку навигации, но не должен создавать горизонтальный overflow страницы.

## Таблицы и формы

- Таблица на mobile превращается в карточки/строки либо получает локальный горизонтальный scroll.
- Поля формы переходят с нескольких колонок на одну без изменения порядка tab-навигации.
- Кнопка подтверждения остаётся видимой и не сжимается; вторичные действия могут переноситься.

## Z-index и motion

- Оверлеи: `docs/design-system/z-index-tokens.md` (`z-portal-*`).
- Движение: `docs/design-system/motion-tokens.md`; уважать `prefers-reduced-motion`.

## Page templates

- PT-01 Dashboard: `docs/design-system/pt-01-dashboard.md` (`DS-PT-01`) — KPI `ResponsiveGrid`, section grids `md`/`xl`, local table overflow.
- PT-02 List/Table: `docs/design-system/pt-02-list-table.md` (`DS-PT-02`) — `md+` `DataTable` local x-scroll; `<md` card stack (R3).
- PT-03 Kanban: `docs/design-system/pt-03-kanban.md` (`DS-PT-03`) — local board x-scroll + snap; full-width mobile toolbar (R2).

## Проверка

Минимальный набор viewport: 1920, 1600, 1440, 1280, 1024, 768 и 390 px. Проверять длинные названия, email, пустые значения, открытые dropdown/dialog и состояние с максимальным числом действий.
