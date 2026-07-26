import assert from "node:assert/strict";
import test from "node:test";

import {
  appSections,
  isNavigationPathActive,
} from "./navigation.ts";

test("sales navigation exposes leads and customer orders without deals", () => {
  const sales = appSections.find((section) => section.id === "sales");
  assert.ok(sales);
  assert.deepEqual(
    sales.topNavigation.filter((item) => ["leads", "orders", "deals"].includes(item.id)),
    [
      { id: "leads", title: "Лиды", href: "/sales/leads" },
      { id: "orders", title: "Заказы покупателей", href: "/sales/orders" },
    ],
  );
  assert.equal(sales.topNavigation.some((item) => item.href === "/sales/deals"), false);
});

test("settings navigation exposes tech-cards after pattern-base", () => {
  const settings = appSections.find((section) => section.id === "settings");
  assert.ok(settings);
  const ids = settings.topNavigation.map((item) => item.id);
  const patternIdx = ids.indexOf("pattern-base");
  const productionIdx = ids.indexOf("production-catalogs");
  const techIdx = ids.indexOf("tech-cards");
  const usersIdx = ids.indexOf("users");
  assert.ok(patternIdx >= 0);
  assert.ok(productionIdx === patternIdx + 1);
  assert.ok(techIdx === productionIdx + 1);
  assert.ok(usersIdx === techIdx + 1);
  const techCards = settings.topNavigation.find((item) => item.id === "tech-cards");
  assert.deepEqual(techCards, {
    id: "tech-cards",
    title: "Техкарты",
    href: "/settings/catalogs/tech-cards",
  });
  assert.equal(
    isNavigationPathActive(
      "/settings/catalogs/tech-cards",
      "/settings/catalogs/tech-cards",
    ),
    true,
  );
});

test("settings navigation exposes production catalogs after pattern-base", () => {
  const settings = appSections.find((section) => section.id === "settings");
  assert.ok(settings);
  const production = settings.topNavigation.find(
    (item) => item.id === "production-catalogs",
  );
  assert.ok(production?.children);
  assert.deepEqual(
    production.children.map((item) => ({ id: item.id, href: item.href })),
    [
      {
        id: "tech-operations",
        href: "/settings/catalogs/tech-operations",
      },
      {
        id: "shop-routings",
        href: "/settings/catalogs/routings",
      },
    ],
  );
});

test("settings navigation exposes the product characteristics directory", () => {
  const settings = appSections.find((section) => section.id === "settings");
  assert.ok(settings);
  const nomenclature = settings.topNavigation.find((item) => item.id === "nomenclature");
  assert.ok(nomenclature?.children);
  assert.ok(
    nomenclature.children.some(
      (item) => item.href === "/settings/catalogs/product-characteristics",
    ),
  );
});

test("settings navigation exposes pattern-base catalogs", () => {
  const settings = appSections.find((section) => section.id === "settings");
  assert.ok(settings);
  const patternBase = settings.topNavigation.find((item) => item.id === "pattern-base");
  assert.ok(patternBase?.children);
  assert.deepEqual(
    patternBase.children.map((item) => ({ id: item.id, href: item.href })),
    [
      { id: "product-models", href: "/settings/catalogs/product-models" },
      { id: "product-types", href: "/settings/catalogs/product-types" },
      { id: "size-grids", href: "/settings/catalogs/size-grids" },
      {
        id: "sewing-operations",
        href: "/settings/catalogs/sewing_operations",
      },
    ],
  );
});

test("settings navigation no longer exposes standalone materials catalog", () => {
  const settings = appSections.find((section) => section.id === "settings");
  assert.ok(settings);
  const hrefs = settings.topNavigation.flatMap((item) => [
    item.href,
    ...(item.children?.map((child) => child.href) ?? []),
  ]);
  assert.equal(hrefs.includes("/settings/catalogs/materials"), false);
});

test("production navigation exposes tech-cards after dashboard", () => {
  const production = appSections.find((section) => section.id === "production");
  assert.ok(production);
  const ids = production.topNavigation.map((item) => item.id);
  assert.deepEqual(ids.slice(0, 3), [
    "production-dashboard",
    "production-tech-cards",
    "production-orders",
  ]);
  const techCards = production.topNavigation.find(
    (item) => item.id === "production-tech-cards",
  );
  assert.deepEqual(techCards, {
    id: "production-tech-cards",
    title: "Техкарты",
    href: "/production/tech-cards",
  });
  assert.equal(
    isNavigationPathActive("/production/tech-cards", "/production"),
    false,
  );
  assert.equal(
    isNavigationPathActive("/production/tech-cards", "/production/tech-cards"),
    true,
  );
});

test("warehouse navigation labels stock route as nomenclature", () => {
  const warehouse = appSections.find((section) => section.id === "warehouse");
  assert.ok(warehouse);
  const stock = warehouse.topNavigation.find((item) => item.id === "stock");
  assert.deepEqual(stock, {
    id: "stock",
    title: "Номенклатура",
    href: "/warehouse/stock",
  });
  assert.equal(
    warehouse.topNavigation.some((item) => item.title === "Остатки"),
    false,
  );
});

test("settings nav drops nomenclature list and categories (warehouse primary)", () => {
  const settings = appSections.find((section) => section.id === "settings");
  assert.ok(settings);
  const nomenclature = settings.topNavigation.find(
    (item) => item.id === "nomenclature",
  );
  assert.ok(nomenclature?.children);
  const hrefs = nomenclature.children.map((item) => item.href);
  assert.equal(hrefs.includes("/settings/catalogs/nomenclature"), false);
  assert.equal(
    hrefs.includes("/settings/catalogs/nomenclature-categories"),
    false,
  );
  assert.ok(hrefs.includes("/settings/catalogs/units-of-measure"));
  assert.ok(hrefs.includes("/settings/catalogs/product-characteristics"));
  assert.ok(hrefs.includes("/settings/catalogs/nomenclature-types"));
});

test("warehouse stock does not keep section dashboard active", () => {
  assert.equal(isNavigationPathActive("/warehouse/stock", "/warehouse"), false);
  assert.equal(
    isNavigationPathActive("/warehouse/stock", "/warehouse/stock"),
    true,
  );
  assert.equal(isNavigationPathActive("/warehouse", "/warehouse"), true);
  assert.equal(
    isNavigationPathActive("/warehouse/stock/extra", "/warehouse/stock"),
    true,
  );
  assert.equal(
    isNavigationPathActive("/warehouse/movements", "/warehouse"),
    false,
  );
});

test("purchases and finance dashboards yield to deeper routes", () => {
  assert.equal(
    isNavigationPathActive("/purchases/orders", "/purchases"),
    false,
  );
  assert.equal(
    isNavigationPathActive("/purchases/orders", "/purchases/orders"),
    true,
  );
  assert.equal(
    isNavigationPathActive("/finance/payments", "/finance"),
    false,
  );
});
