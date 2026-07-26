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
