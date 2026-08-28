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

export const SEWING_CABINET_NAV_ITEM: NavigationGroup = {
  id: "production-sewing-cabinet",
  title: "Кабинет швеи",
  href: "/production/sewing-cabinet",
};

export const SEWING_CABINETS_NAV_ITEM: NavigationGroup = {
  id: "production-sewing-cabinets",
  title: "Кабинеты швей",
  href: "/production/sewing-cabinet/sewers",
};

/** Existing sales report routes — promoted to a sidebar section in `26.9.1` (no new pages). */
export const SALES_REPORTS_NAV_CHILDREN: NavigationChild[] = [
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
];

export type SidebarContourId = "sales" | "production";

export type SidebarContour = {
  id: SidebarContourId;
  title: string;
  sectionIds: readonly string[];
};

/** Left-rail visual groups (`26.9.1`). Settings leave the rail in `26.9.2`. */
export const SIDEBAR_CONTOURS: readonly SidebarContour[] = [
  {
    id: "sales",
    title: "Продажи",
    sectionIds: ["dashboard", "sales", "reports", "finance", "analytics"],
  },
  {
    id: "production",
    title: "Производство",
    sectionIds: ["production", "warehouse", "purchases"],
  },
];

export type SidebarContourGroup = {
  id: string;
  title: string;
  sections: AppSection[];
};

export function groupSectionsByContour(
  sections: ReadonlyArray<AppSection>,
): SidebarContourGroup[] {
  const byId = new Map(sections.map((section) => [section.id, section]));
  const used = new Set<string>();
  const groups: SidebarContourGroup[] = [];

  for (const contour of SIDEBAR_CONTOURS) {
    const contourSections = contour.sectionIds
      .map((id) => byId.get(id))
      .filter((section): section is AppSection => Boolean(section));
    if (contourSections.length === 0) {
      continue;
    }
    for (const section of contourSections) {
      used.add(section.id);
    }
    groups.push({
      id: contour.id,
      title: contour.title,
      sections: contourSections,
    });
  }

  const leftover = sections.filter(
    (section) => !used.has(section.id) && section.id !== "settings",
  );
  if (leftover.length > 0) {
    groups.push({ id: "other", title: "Прочее", sections: leftover });
  }

  return groups;
}

/** Fallback seed order when AppShell cannot load ProductionStage catalog. */
const DEFAULT_SHOP_STAGE_NAV: ReadonlyArray<NavigationChild> = [
  { id: "design", title: "Дизайн", href: "/production/stages/design" },
  { id: "cutting", title: "Раскрой", href: "/production/stages/cutting" },
  { id: "print", title: "Печать", href: "/production/stages/print" },
  { id: "sewing", title: "Пошив", href: "/production/stages/sewing" },
  { id: "wto", title: "ВТО", href: "/production/stages/wto" },
  { id: "qc", title: "ОТК", href: "/production/stages/qc" },
  { id: "packaging", title: "Упаковка", href: "/production/stages/packaging" },
  {
    id: "ready_to_ship",
    title: "Готовы к отгрузке",
    href: "/production/stages/ready_to_ship",
  },
  { id: "shipped", title: "Отгружены", href: "/production/stages/shipped" },
];

export type ShopStageNavSource = {
  code: string;
  title: string;
  href: string;
};

/** Build app nav; цеховые modules follow ProductionStage catalog order when provided. */
export function buildAppSections(
  shopModules?: ReadonlyArray<ShopStageNavSource>,
): AppSection[] {
  const shopChildren: NavigationChild[] =
    shopModules
      ? shopModules.map((stage) => ({
          id: stage.code,
          title: stage.title,
          href: stage.href,
        }))
      : [...DEFAULT_SHOP_STAGE_NAV];

  return [
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
        id: "collaboration-notifications",
        title: "Уведомления сотрудничества",
        href: "/sales/collaboration-notifications",
      },
    ],
  },
  {
    id: "reports",
    title: "Отчеты",
    shortTitle: "О",
    href: "/sales/reports/funnel",
    topNavigation: SALES_REPORTS_NAV_CHILDREN.map((child) => ({
      id: child.id,
      title: child.title,
      href: child.href,
    })),
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
        id: "production-tech-cards",
        title: "Техкарты",
        href: "/production/tech-cards",
      },
      SEWING_CABINET_NAV_ITEM,
      SEWING_CABINETS_NAV_ITEM,
      {
        id: "production-orders",
        title: "Заказы",
        href: "/production/orders",
      },
      {
        id: "production-specifications",
        title: "Спецификации",
        href: "/production/specifications",
      },
      {
        id: "design-projects",
        title: "Дизайн-проекты",
        href: "/design/projects",
      },
      {
        id: "production-tasks",
        title: "Задания",
        href: "/production/tasks",
      },
      {
        id: "production-shop-modules",
        title: "Цеховые модули",
        children: shopChildren,
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
        title: "Номенклатура",
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
            id: "warehouses",
            title: "Склады",
            href: "/settings/catalogs/warehouses",
          },
          {
            id: "contractors",
            title: "Контрагенты",
            href: "/settings/catalogs/contractors",
          },
          {
            id: "vat-rates",
            title: "Ставки НДС",
            href: "/settings/catalogs/vat-rates",
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
            id: "units",
            title: "Единицы измерения",
            href: "/settings/catalogs/units-of-measure",
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
            id: "product-types",
            title: "Вид изделия",
            href: "/settings/catalogs/product-types",
          },
          {
            id: "detailing",
            title: "Деталировка",
            href: "/settings/catalogs/detailing",
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
        id: "production-catalogs",
        title: "Производство",
        children: [
          {
            id: "production-stages",
            title: "Этапы",
            href: "/settings/catalogs/production-stages",
          },
          {
            id: "tech-operations",
            title: "Тех операции",
            href: "/settings/catalogs/tech-operations",
          },
          {
            id: "work-centers",
            title: "Оборудование",
            href: "/settings/catalogs/work-centers",
          },
          {
            id: "shop-routings",
            title: "Маршруты",
            href: "/settings/catalogs/routings",
          },
        ],
      },
      {
        id: "tech-cards",
        title: "Техкарты",
        href: "/settings/catalogs/tech-cards",
      },
      {
        id: "platform-admin",
        title: "Платформа",
        children: [
          {
            id: "system-settings",
            title: "Системные настройки",
            href: "/settings/system",
          },
          {
            id: "platform-directories",
            title: "Справочники платформы",
            href: "/settings/platform-directories",
          },
          {
            id: "platform-cities",
            title: "Города",
            href: "/settings/platform-directories/cities",
          },
          {
            id: "print-forms",
            title: "Печатные формы",
            href: "/settings/print-forms",
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
        title: "Почтовый ящик",
        href: "/settings/integrations",
      },
    ],
  },
  ];
}

/** Default seed-order sections (tests / offline fallback). Prefer `buildAppSections(catalogModules)` in shell. */
export const appSections: AppSection[] = buildAppSections();

function collectSectionPathCandidates(section: AppSection): string[] {
  const hrefs = [section.href];
  for (const group of section.topNavigation) {
    if (group.href) hrefs.push(group.href);
    for (const child of group.children ?? []) {
      hrefs.push(child.href);
    }
  }
  return hrefs;
}

/** Longest matching section root or topNavigation href (aligns topbar with sidebar). */
function sectionPathMatchScore(pathname: string, section: AppSection): number {
  let best = 0;
  for (const href of collectSectionPathCandidates(section)) {
    if (pathname === href || pathname.startsWith(`${href}/`)) {
      best = Math.max(best, href.length);
    }
  }
  return best;
}

export function getSectionByPathname(
  pathname: string,
  sections: ReadonlyArray<AppSection> = appSections,
): AppSection {
  let bestSection: AppSection | null = null;
  let bestScore = 0;
  for (const section of sections) {
    const score = sectionPathMatchScore(pathname, section);
    if (score > bestScore) {
      bestScore = score;
      bestSection = section;
    }
  }
  return bestSection ?? sections[0];
}

function collectNavigationHrefs(): string[] {
  const hrefs: string[] = [];

  for (const section of appSections) {
    hrefs.push(section.href);
    for (const group of section.topNavigation) {
      if (group.href) {
        hrefs.push(group.href);
      }
      for (const child of group.children ?? []) {
        hrefs.push(child.href);
      }
    }
  }

  return hrefs;
}

const navigationHrefs = collectNavigationHrefs();

function pathMatchesHref(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Active nav item: exact or nested under `href`, but only the
 * longest registered navigation href wins (avoids `/warehouse`
 * lighting up on `/warehouse/stock`).
 */
export function isNavigationPathActive(
  pathname: string,
  href: string,
): boolean {
  if (!pathMatchesHref(pathname, href)) {
    return false;
  }

  const betterMatch = navigationHrefs.some(
    (other) =>
      other !== href &&
      other.length > href.length &&
      pathMatchesHref(pathname, other),
  );

  return !betterMatch;
}

export function filterAppSectionsForSession(
  sections: AppSection[],
  permissions: readonly string[] | undefined,
): AppSection[] {
  const perms = permissions ?? [];
  const hasOwn = perms.includes("sewing_cabinet.read_own");
  const hasAny = perms.includes("sewing_cabinet.read_any");
  const hasWrite = perms.includes("sewing_cabinet.write");
  const restricted = hasOwn && !hasAny;
  if (restricted) {
    const production = sections.find((section) => section.id === "production");
    if (!production) {
      return [
        {
          id: "production",
          title: "Производство",
          shortTitle: "ПР",
          href: "/production/sewing-cabinet",
          topNavigation: [SEWING_CABINET_NAV_ITEM],
        },
      ];
    }
    return [
      {
        ...production,
        href: "/production/sewing-cabinet",
        topNavigation: [SEWING_CABINET_NAV_ITEM],
      },
    ];
  }
  return sections.map((section) => {
    if (section.id !== "production") return section;
    return {
      ...section,
      topNavigation: section.topNavigation.filter((item) => {
        if (item.id === "production-sewing-cabinet") {
          return hasOwn || hasWrite || hasAny;
        }
        if (item.id === "production-sewing-cabinets") return hasAny;
        return true;
      }),
    };
  });
}
