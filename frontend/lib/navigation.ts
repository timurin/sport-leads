export type NavigationChild = {
  id: string;
  title: string;
  href: string;
  description?: string;
};

export type NavigationGroup = {
  id: string;
  title: string;
  href?: string;
  children?: NavigationChild[];
};

export type AppSection = {
  id: string;
  title: string;
  shortTitle: string;
  href: string;
  badge?: string;
  topNavigation: NavigationGroup[];
};

export const appSections: AppSection[] = [
  {
    id: "dashboard",
    title: "Главная",
    shortTitle: "Г",
    href: "/dashboard",
    topNavigation: [
      {
        id: "overview",
        title: "Обзор",
        href: "/dashboard",
      },
      {
        id: "activity",
        title: "Активность",
        href: "/dashboard/activity",
      },
      {
        id: "analytics",
        title: "Аналитика",
        href: "/dashboard/analytics",
      },
    ],
  },
  {
    id: "sales",
    title: "Продажи",
    shortTitle: "П",
    href: "/sales",
    topNavigation: [
      {
        id: "sales-dashboard",
        title: "Дашборд",
        href: "/sales/dashboard",
      },
      {
        id: "leads",
        title: "Лиды",
        href: "/sales/leads",
      },
      {
        id: "orders",
        title: "Заказы покупателей",
        href: "/sales/orders",
      },
      {
        id: "clients",
        title: "Клиенты",
        href: "/sales/clients",
      },
      {
        id: "tasks",
        title: "Задачи",
        href: "/sales/tasks",
      },
      {
        id: "sales-reports",
        title: "Отчёты",
        children: [
          {
            id: "sales-funnel",
            title: "Воронка продаж",
            href: "/sales/reports/funnel",
          },
          {
            id: "manager-performance",
            title: "Работа менеджеров",
            href: "/sales/reports/managers",
          },
          {
            id: "sales-dynamics",
            title: "Динамика продаж",
            href: "/sales/reports/dynamics",
          },
        ],
      },
    ],
  },
  {
    id: "production",
    title: "Производство",
    shortTitle: "ПР",
    href: "/production",
    topNavigation: [
      {
        id: "production-dashboard",
        title: "Дашборд",
        href: "/production",
      },
      {
        id: "production-orders",
        title: "Заказы",
        href: "/production/orders",
      },
      {
        id: "production-tasks",
        title: "Задания",
        href: "/production/tasks",
      },
      {
        id: "production-stages",
        title: "Этапы",
        children: [
          {
            id: "cutting",
            title: "Раскрой",
            href: "/production/stages/cutting",
          },
          {
            id: "printing",
            title: "Печать",
            href: "/production/stages/printing",
          },
          {
            id: "sewing",
            title: "Пошив",
            href: "/production/stages/sewing",
          },
          {
            id: "quality",
            title: "Контроль качества",
            href: "/production/stages/quality",
          },
        ],
      },
    ],
  },
  {
    id: "warehouse",
    title: "Склад",
    shortTitle: "С",
    href: "/warehouse",
    topNavigation: [
      {
        id: "warehouse-dashboard",
        title: "Дашборд",
        href: "/warehouse",
      },
      {
        id: "stock",
        title: "Остатки",
        href: "/warehouse/stock",
      },
      {
        id: "movements",
        title: "Движения",
        href: "/warehouse/movements",
      },
      {
        id: "inventory",
        title: "Инвентаризация",
        href: "/warehouse/inventory",
      },
    ],
  },
  {
    id: "purchases",
    title: "Закупки",
    shortTitle: "З",
    href: "/purchases",
    topNavigation: [
      {
        id: "purchases-dashboard",
        title: "Дашборд",
        href: "/purchases",
      },
      {
        id: "purchase-orders",
        title: "Заказы поставщикам",
        href: "/purchases/orders",
      },
      {
        id: "suppliers",
        title: "Поставщики",
        href: "/purchases/suppliers",
      },
    ],
  },
  {
    id: "finance",
    title: "Финансы",
    shortTitle: "Ф",
    href: "/finance",
    topNavigation: [
      {
        id: "finance-dashboard",
        title: "Дашборд",
        href: "/finance",
      },
      {
        id: "payments",
        title: "Платежи",
        href: "/finance/payments",
      },
      {
        id: "reports",
        title: "Отчёты",
        children: [
          {
            id: "profit-loss",
            title: "P&L",
            href: "/finance/reports/profit-loss",
          },
          {
            id: "cash-flow",
            title: "ДДС",
            href: "/finance/reports/cash-flow",
          },
          {
            id: "order-margin",
            title: "Маржинальность заказов",
            href: "/finance/reports/order-margin",
          },
        ],
      },
    ],
  },
  {
    id: "analytics",
    title: "Аналитика",
    shortTitle: "А",
    href: "/analytics",
    topNavigation: [
      {
        id: "analytics-dashboard",
        title: "Обзор",
        href: "/analytics",
      },
      {
        id: "sales-analytics",
        title: "Продажи",
        href: "/analytics/sales",
      },
      {
        id: "production-analytics",
        title: "Производство",
        href: "/analytics/production",
      },
    ],
  },
  {
    id: "settings",
    title: "Настройки",
    shortTitle: "Н",
    href: "/settings",
    topNavigation: [
      {
        id: "catalogs",
        title: "Справочники",
        children: [
          {
            id: "materials",
            title: "Материалы",
            href: "/settings/catalogs/materials",
          },
          {
            id: "cities",
            title: "Города",
            href: "/settings/catalogs/cities",
          },
          {
            id: "warehouses",
            title: "Склады",
            href: "/settings/catalogs/warehouses",
          },
          {
            id: "contractors",
            title: "Контрагенты",
            href: "/settings/catalogs/contractors",
          },
        ],
      },
      {
        id: "organizations",
        title: "Организации",
        children: [
          {
            id: "companies",
            title: "Организации",
            href: "/settings/organizations",
          },
          {
            id: "employees",
            title: "Сотрудники",
            href: "/settings/organizations/employees",
          },
          {
            id: "departments",
            title: "Подразделения",
            href: "/settings/organizations/departments",
          },
        ],
      },
      {
        id: "nomenclature",
        title: "Номенклатура",
        children: [
          {
            id: "nomenclature-list",
            title: "Номенклатура",
            href: "/settings/catalogs/nomenclature",
          },
          {
            id: "units",
            title: "Единицы измерения",
            href: "/settings/catalogs/units-of-measure",
          },
          {
            id: "nomenclature-categories",
            title: "Категории номенклатуры",
            href: "/settings/catalogs/nomenclature-categories",
          },
          {
            id: "nomenclature-characteristics",
            title: "Характеристики номенклатуры",
            href: "/settings/catalogs/product-characteristics",
          },
          {
            id: "nomenclature-types",
            title: "Тип номенклатуры",
            href: "/settings/catalogs/nomenclature-types",
          },
        ],
      },
      {
        id: "pattern-base",
        title: "База лекал",
        children: [
          {
            id: "product-models",
            title: "Модели изделий",
            href: "/settings/catalogs/product-models",
          },
          {
            id: "size-grids",
            title: "Размерные сетки",
            href: "/settings/catalogs/size-grids",
          },
          {
            id: "sewing-operations",
            title: "Операции пошива",
            href: "/settings/catalogs/sewing_operations",
          },
        ],
      },
      {
        id: "users",
        title: "Пользователи",
        href: "/settings/users",
      },
      {
        id: "integrations",
        title: "Интеграции",
        href: "/settings/integrations",
      },
    ],
  },
];

export function getSectionByPathname(
  pathname: string,
): AppSection {
  const sortedSections = [...appSections].sort(
    (first, second) =>
      second.href.length - first.href.length,
  );

  return (
    sortedSections.find(
      (section) =>
        pathname === section.href ||
        pathname.startsWith(`${section.href}/`),
    ) ?? appSections[0]
  );
}

export function isNavigationPathActive(
  pathname: string,
  href: string,
): boolean {
  return (
    pathname === href ||
    pathname.startsWith(`${href}/`)
  );
}
