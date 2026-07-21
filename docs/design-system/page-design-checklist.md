# Checklist дизайна страницы

## Каркас

- [ ] Используются существующие `AppShell`, sidebar и topbar.
- [ ] Страница обёрнута в `PageLayout` (`DS-PAGE-01`); toolbar при необходимости — `PageToolbar` (`DS-PAGE-02`).
- [ ] Заголовок сущности — через `EntityHeader` (page title в toolbar не используется).
- [ ] Контент ограничен `PageContent` либо осознанно использует `width="full"`; базовый контейнер сохраняет `w-full min-w-0`.
- [ ] Один основной вертикальный scrollbar находится в `[data-app-shell-main]` (`DS-PAGE-05`); корень страницы не добавляет `h-screen` или `overflow-y-auto`.
- [ ] Loading/error сегментов используют `PageLoadingState` / `PageErrorState` с `reset` (`DS-PAGE-06`), либо доменный skeleton с тем же retry.

## Компоненты

- [ ] Проверены `SectionCard`, `InfoCard`, `MetricCard`, `StatusBadge`, `EmptyState`, `CompactTabs`, `DataList` и `ActionMenu` до создания нового компонента.
- [ ] Кнопки используют существующий `Button` и подходящий размер.
- [ ] Новый общий компонент принимает данные/children и не импортирует доменные сервисы, API или store.
- [ ] Empty/loading/error состояния сохранены.

## Визуальная система

- [ ] Цвета и размеры опираются на `--portal-*` или зарегистрированные Tailwind-токены.
- [ ] Нет случайных inline hex, чрезмерных теней и дублирующих рамок.
- [ ] Размеры текста соответствуют иерархии; обычный текст не разбивается посимвольно.
- [ ] Primary-действие одно на рабочую зону; danger используется только для разрушительных операций.

## Адаптивность

- [ ] Проверены 1920, 1600, 1440, 1280, 1024, 768 и 390 px.
- [ ] Grid использует `minmax(0, 1fr)` или `ResponsiveGrid`.
- [ ] `ResponsiveGrid` сохраняет `min(100%, N)` для вариантов 230/300/390 px и не расширяет узкий контейнер.
- [ ] Действия переносятся или уходят в меню; `PageActions align="between"` на mobile выровнен по началу строки.
- [ ] Таблицы и длинные tab strips имеют локальную мобильную стратегию.
- [ ] Нет глобального `min-width`, горизонтального overflow страницы и второго основного scrollbar.

## Качество

- [ ] Работают keyboard focus, aria-label/roles и закрытие overlay по Escape.
- [ ] Нет hydration mismatch и ошибок Console.
- [ ] Выполнены `npx tsc --noEmit`, `npm run lint`, `npm run build`.
- [ ] Проверены существующие пользовательские сценарии страницы.
