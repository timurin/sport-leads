# PC-UI-01 — аудит платформенного UI для календаря

**Статус:** UI-A–UI-H = OWNER-APPROVED; DESIGN-APPROVED = true, `2026-10-05`, по [решению владельца](../../tasks/pc-02-1-lightweight-design-freeze-implementation-contract.md). Дизайн зафиксирован; реализация не начата. Проверки runtime/Edge, ранее не выполненные, остаются техническими проверками реализации.

| Паттерн | Реальный источник | Применение в UI-A |
|---|---|---|
| AppShell и две зоны прокрутки | `frontend/components/layout/app-shell.tsx` | Контент календаря живёт в `data-app-shell-main`; shell не создаётся заново в приложении. Автономный HTML показывает только декоративный контекст. |
| Sidebar и topbar | `frontend/components/navigation/app-sidebar.tsx`, `top-navigation.tsx`, `docs/design-system/shell-contracts.md` | DS-SHELL-01/02 визуально сохранены: 220px/72px rail, 56px/52px topbar, компактная навигация на mobile. Новых пунктов shell прототип не добавляет. |
| Источник маршрутов | `frontend/lib/navigation.ts` | Производство уже содержит `/production`, `/production/orders`, `/production/tech-cards`; будущий URL календаря пока предложение, не добавлен в навигацию. |
| Цвета, типографика, отступы | `frontend/app/globals.css`, `docs/design-system/color-tokens.md`, `spacing-tokens.md`, `typography-tokens.md` | Светлый фон `#f6f8fc`, белые поверхности, основной `#1f5eff`, текст `#101828`, граница `#dfe5ef`, Inter/Segoe UI. Отступы по сетке 4px. |
| Размеры и адаптивность | `frontend/app/globals.css`, `docs/design-system/breakpoint-tokens.md`, `component-size-tokens.md` | Контролы 32/40px; desktop ≥1280, laptop ≥1024, tablet ≥768, mobile <768. Документ размера токенов содержит устаревшие 64/72px для topbar; актуальный `globals.css` и shell-контракт задают 52/56px. |
| Кнопки и focus | `frontend/components/ui/button.tsx` | Основная/вторичная кнопка, focus ring, disabled. Неделя — компактные вторичные кнопки. |
| Вкладки | `frontend/components/ui/compact-tabs.tsx` | UI-A не вводит вкладки ради одной матрицы; если они понадобятся в общем модуле, использовать `CompactTabs`, без второго вида nav внутри страницы. |
| Таблица | `frontend/components/ui/data-table.tsx`, `docs/design-system/pt-02-list-table.md` | Плотная матрица с заголовком и локальной горизонтальной прокруткой на tablet; mobile — карточки дня, без горизонтальной прокрутки всей страницы. Ближайший шаблон PT-02, адаптированный к матрице расписания. |
| Модальное окно/панель | `frontend/components/ui/create-drawer.tsx`, `demo-create-drawer.tsx` | Создание заказа UI-B позже использует платформенный drawer. В UI-A детали дня показаны как доступный диалог просмотра; он не записывает данные. |
| Производственный визуальный референс | `docs/design/production/orders-workspace-reference-v1.html`, `docs/design/shared/preview.css` | Использовать плотность панели, метрики и светлый Soft UI, без копирования демо-заказов и внешних CSS: требуемый прототип single-file. |

**Несовместимости и решения.** Старый документ `ui-audit.md` описывает ранний набор маршрутов; текущий `navigation.ts` и компоненты — более актуальный источник. Старые локальные HTML-макеты используют общие `preview.css`/`shell.js`, а новый прототип автономен, поэтому нужные стили встроены как отображение текущих токенов. Календарь не должен создавать второй sidebar/topbar или выдавать демонстрационные значения за API. Иконки в прототипе — простые контурные SVG, без новой библиотеки. Реальный будущий экран должен использовать платформенные компоненты вместо копии разметки HTML.

**Утверждение:** PC-UI-01 остаётся `[ ]` до просмотра владельцем и согласования выбора UI-референсов. `DS-SHELL-01 visual contract preserved`; `DS-SHELL-02 visual contract preserved` — код shell не менялся.
