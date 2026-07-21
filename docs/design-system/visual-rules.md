# Визуальные правила

## Поверхности и иерархия

- Фон страницы — `portal-page`; основная карточка — `portal-surface`; вторичная зона — `portal-surface-secondary`.
- Карточка по умолчанию: тонкая граница `border-portal-border`, `rounded-portal-lg`, `shadow-portal-card` (`docs/design-system/surface-tokens.md`).
- Вложенные зоны отделять фоном или одним разделителем; не складывать несколько одинаковых теней.
- Primary-цвет `#1f5eff` (`portal-primary`) — для выбранного состояния и главного действия. Soft-фон выбора — `portal-primary-soft`. Success, warning и danger — только по смыслу (`docs/design-system/color-tokens.md`).

## Типографика

- Основной шрифт — **Inter** с fallback на Segoe UI и Arial (`--portal-font-sans`). Geist не используется.
- Шкала размеров: display 30 / page 24 / entity 20 / section 16 / section-sm 14 / body 14 / dense 13 / meta 12 / caption 11 (`docs/design-system/typography-tokens.md`).
- Заголовок страницы: `text-portal-page` (24); компактный entity: `text-portal-entity` (20); секция: `text-portal-section` (16).
- Основной текст: `text-portal-body` (14); CRM dense: `text-portal-dense` (13); метаданные: `text-portal-meta` / `text-portal-caption`.
- Обычный текст переносится по словам. `overflow-wrap:anywhere` разрешён для email, URL, ID и технических значений.

## Плотность

- `compact` — CRM-списки, таблицы, боковые панели и короткие формы.
- `default` — стандарт страницы.
- `spacious` — только onboarding, пустые состояния и редкие обзорные страницы.
- Отступы — шкала 4 px (`docs/design-system/spacing-tokens.md`): `portal-space-1…12`, utilities `p-portal-*` / `gap-portal-*`.
- PageContent: compact `3→4`, default `4→6`, spacious `5→8` (в шагах шкалы).
- Высоты контролов: compact 32 / default 40 / spacious 44 (`h-portal-control-*`, `docs/design-system/component-size-tokens.md`).

## Действия и состояния

- На экране должно быть одно очевидное primary-действие в пределах одной рабочей зоны.
- Вторичные действия используют `secondary` или `ghost`; destructive — `danger`.
- Hover / pressed / focus-visible / selected / disabled — `docs/design-system/interaction-tokens.md` (класс `.portal-focus-ring`).
- Группы действий собираются через `PageActions`: они допускают перенос, а `align="between"` распределяет элементы по краям только начиная с `sm`.
- Статусы оформляются через `StatusBadge`, а не случайными сочетаниями цветов.
- Пустое состояние объясняет отсутствие данных и предлагает действие только при наличии рабочего callback.

## Запрещено

- Inline hex и новые непредусмотренные CSS variables в модульных компонентах.
- Глобальный `min-width`, `body { overflow: hidden }` и фиксированная высота корневого контейнера страницы внутри `AppShell`.
- Бизнес-условия внутри компонентов дизайн-системы.
- Параллельные реализации кнопок, карточек и badge без проверки существующих примитивов.
- Второй основной вертикальный scrollbar рядом со скроллером `[data-app-shell-main]`.
