# Sport Leads Design System

Базовая дизайн-система портала находится в `frontend/components/ui` и `frontend/components/layout`. Она дополняет Tailwind семантическими токенами и небольшими React-примитивами, не содержит бизнес-логики модулей.

## Токены

Токены объявлены в `frontend/app/globals.css` с префиксом `--portal-*`:

- поверхности: `page`, `surface`, `surface-secondary`;
- цвета: `border`, `text`, `text-muted`, `primary`, `success`, `warning`, `danger`;
- радиусы: `radius-sm`, `radius-md`, `radius-lg`, `radius-xl`;
- тени: `shadow-sm`, `shadow-card`, `shadow-overlay`;
- интервалы: `space-1/2/3/4/6/8`;
- контролы: `control-compact/default/spacious`;
- каркас: `sidebar-width`, `content-max`.

Основные цвета зарегистрированы в Tailwind как `portal-page`, `portal-surface`, `portal-border`, `portal-text`, `portal-muted` и семантические tone-цвета.

## Компоненты

Layout:

- `AppShell`, `AppSidebar`, `AppTopbar` — глобальный каркас;
- `PageContent` — ширина и внешние отступы страницы;
- `PageActions` — переносимая группа действий;
- `ResponsiveGrid` — auto-fit сетка с безопасным `minmax`;
- `PageHeader`, `EntityHeader` — заголовки страницы и сущности.

`PageContent` всегда занимает доступную ширину (`w-full min-w-0`), а варианты `width` задают только максимальную ширину: `default`, `wide` или `full`. Варианты `size` управляют внешними отступами.

`PageActions` переносит действия на новую строку. Выравнивание `start` всегда начинается слева, `end` становится правым от `sm`, а `between` распределяет элементы по краям только от `sm`; на mobile оба адаптивных режима начинаются слева.

`ResponsiveGrid` использует глобальные классы `portal-grid-small`, `portal-grid-medium` и `portal-grid-large` из `frontend/app/globals.css`. Их безопасные минимумы — 230, 300 и 390 px с ограничением `min(100%, ...)`, поэтому колонка не расширяет узкий контейнер.

UI:

- `Button` — `primary`, `secondary`, `ghost`, `danger`; размеры `compact`, `default`, `spacious`;
- `SectionCard`, `InfoCard`, `MetricCard`;
- `StatusBadge`;
- `EmptyState`;
- `ActionMenu`, `ActionMenuItem`;
- `CompactTabs`;
- `DataList`.

## Пример страницы

```tsx
import { PageContent, PageActions, ResponsiveGrid } from "@/components/layout/page-layout";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { MetricCard, SectionCard } from "@/components/ui/section-card";

export default function ExamplePage() {
  return <>
    <PageHeader title="Заказы" description="Рабочее пространство заказов" actions={<Button variant="primary">Создать</Button>} />
    <PageContent>
      <ResponsiveGrid minItemWidth="small">
        <MetricCard label="Всего" value={24} />
        <MetricCard label="В работе" value={8} tone="primary" />
      </ResponsiveGrid>
      <SectionCard title="Последние заказы" className="mt-4">Содержимое</SectionCard>
    </PageContent>
  </>;
}
```

Миграция страниц выполняется постепенно. Нельзя заменять рабочий компонент только ради единообразия, если это меняет состояние, события или доступность.

## Каркас и прокрутка

`AppShell` занимает высоту viewport и содержит sidebar, `AppTopbar` и `WorkspaceTabs`. `AppTopbar` напрямую переиспользует существующий `TopNavigation`. Основной вертикальный scrollbar принадлежит `[data-app-shell-main]`; корневые контейнеры страниц не должны добавлять `h-screen` или второй `overflow-y-auto`. Локальная прокрутка допустима только для самостоятельных рабочих областей вроде чата, dialog, dropdown и длинных списков.
