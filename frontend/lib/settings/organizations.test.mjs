import assert from "node:assert/strict";
import test from "node:test";

import {
  fromApiOrganization,
  organizationMatchesQuery,
} from "./organizations.ts";

test("maps OrganizationRead without inventing demo banking tabs", () => {
  const view = fromApiOrganization({
    id: 4,
    name: "ООО Спорт",
    legal_form: "ООО",
    tax_id: "7707083893",
    ogrn: "1027700132195",
    kpp: "770001001",
    tax_system: "УСН",
    director: "Иванов",
    legal_address: "Москва",
    is_active: true,
    created_at: "2026-08-24T10:00:00+00:00",
    updated_at: "2026-08-24T10:00:00+00:00",
  });
  assert.equal(view.id, 4);
  assert.equal(view.taxId, "7707083893");
  assert.equal(view.legalForm, "ООО");
  assert.equal(view.isActive, true);
  assert.equal("bankAccounts" in view, false);
});

test("organizationMatchesQuery searches name and INN", () => {
  const view = fromApiOrganization({
    id: 1,
    name: "ИП Вектор",
    legal_form: "ИП",
    tax_id: "1655000000",
    ogrn: null,
    kpp: null,
    tax_system: null,
    director: null,
    legal_address: null,
    is_active: false,
    created_at: "2026-08-24T10:00:00+00:00",
    updated_at: "2026-08-24T10:00:00+00:00",
  });
  assert.equal(organizationMatchesQuery(view, "вектор"), true);
  assert.equal(organizationMatchesQuery(view, "1655"), true);
  assert.equal(organizationMatchesQuery(view, "неттакого"), false);
});
