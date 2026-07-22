import assert from "node:assert/strict";
import test from "node:test";

import { appSections } from "./navigation.ts";

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
      { id: "size-grids", href: "/settings/catalogs/size-grids" },
      { id: "patterns", href: "/settings/catalogs/patterns" },
    ],
  );
});
