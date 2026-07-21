# Sport Leads Design System

Базовая дизайн-система портала находится в `frontend/components/ui` и `frontend/components/layout`. Она дополняет Tailwind семантическими токенами и небольшими React-примитивами, не содержит бизнес-логики модулей.

Связанные канонические документы:

- `docs/design-system/ui-audit.md` — аудит маршрутов, состояний, persistence, reference/migration (`5.1.1.*`)
- `docs/design-system/responsive-audit.md` — verification matrix + manual viewport gate (`5.1.4.*`)
- `docs/design-system/token-sources-audit.md` — inventory of token sources and conflicts (`5.2.1.1`)
- `docs/design-system/color-tokens.md` — semantic color dictionary, Decision A (`5.2.1.2`)
- `docs/design-system/typography-tokens.md` — type scale and font stacks (`5.2.1.3`)
- `docs/design-system/spacing-tokens.md` — 4px spacing grid (`5.2.1.4`)
- `docs/design-system/surface-tokens.md` — borders, radius, shadows (`5.2.1.5`)
- `docs/design-system/component-size-tokens.md` — control / icon / avatar / shell sizes (`5.2.1.6`)
- `docs/design-system/interaction-tokens.md` — hover / focus / selected / disabled (`5.2.1.7`)
- `docs/design-system/layout-scrolling-audit.md` — AppShell, widths, scroll/sticky rules (`5.1.3.*`)
- `docs/design-system/component-inventory.md` — инвентарь shared/domain UI (`5.1.2.*`)
- `docs/design-system/shell-contracts.md` — защищённые контракты `DS-SHELL-01` / `DS-SHELL-02`
- `docs/design-system/page-design-checklist.md`, `visual-rules.md`, `responsive-rules.md`
- HTML page references: `docs/design/`
- Platform templates `PT-01`–`PT-08` — Stage 5 roadmap (contracts pending)

## Токены

Цвета (семантика, `5.2.1.2`, Decision A): канон `docs/design-system/color-tokens.md`.
Типографика (`5.2.1.3`): канон `docs/design-system/typography-tokens.md` — Inter, шкала display→caption, utilities `text-portal-*`.
Отступы (`5.2.1.4`): канон `docs/design-system/spacing-tokens.md` — сетка 4 px, utilities `p-portal-*` / `gap-portal-*`.
Поверхности chrome (`5.2.1.5`): канон `docs/design-system/surface-tokens.md` — `rounded-portal-*`, `shadow-portal-*`, border widths.
Объявлены в `frontend/app/globals.css` с префиксом `--portal-*`:

- поверхности: `page`, `surface`, `surface-secondary`;
- текст (цвет): `text`, `text-muted`, `text-subtle`, `text-inverse`;
- типографика: `font-sans` / `font-mono`, `font-size-*`, `leading-*`, `font-weight-*`;
- отступы: `space-0/1/2/3/4/5/6/8/10/12`;
- границы: цвет `border` / `border-strong`; ширина `border-width` / `border-width-strong`;
- радиусы: `radius-none/sm/md/lg/xl/full`;
- тени: `shadow-sm/card/overlay/modal`;
- контролы: `control-compact/default/spacious` (32/40/44), `control-icon`, `icon-*`, `avatar-*`, shell topbar/sidebar reference;
- primary: `#1f5eff` (+ hover / soft / on / gradient stops) — выровнено с DS-SHELL и `docs/design/*`;
- статусы: `success`, `warning`, `danger` (+ soft);
- focus: `focus-ring` + offset/width; interaction states: hover / pressed / selected / disabled; motion-fast/normal;
- каркас: `content-max` (контент-ширины — `5.2.2.2`).

Цвета, типографика, spacing, radius, shadows, control sizes и interaction states зарегистрированы в Tailwind `@theme` / CSS.
Typed mirror: `frontend/lib/design-system/tokens.ts`.

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
