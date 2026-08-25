import assert from "node:assert/strict";
import test from "node:test";

import {
  employeeMatchesQuery,
  fromApiEmployee,
  validateEmployeeEmail,
} from "./employees.ts";

test("maps EmployeeRead without inventing login or inspector tabs", () => {
  const view = fromApiEmployee({
    id: 7,
    full_name: "Мария Иванова",
    organization_id: 4,
    organization_name: "ИП Вектор",
    position: "Менеджер по продажам",
    department: "Отдел продаж",
    phone: "+7 999 100-20-30",
    email: "m.ivanova@mosmade.ru",
    employment_date: "2024-02-10",
    is_active: true,
    created_at: "2026-08-24T10:00:00+00:00",
    updated_at: "2026-08-24T10:00:00+00:00",
  });
  assert.equal(view.id, 7);
  assert.equal(view.fullName, "Мария Иванова");
  assert.equal(view.organizationName, "ИП Вектор");
  assert.equal(view.employmentDate, "2024-02-10");
  assert.equal(view.isActive, true);
  assert.equal("platformUserId" in view, false);
  assert.equal("tasks" in view, false);
});

test("employeeMatchesQuery searches name, org and phone", () => {
  const view = fromApiEmployee({
    id: 1,
    full_name: "Алексей Смирнов",
    organization_id: 2,
    organization_name: "ООО Спорт",
    position: "Дизайнер",
    department: "Дизайн",
    phone: "+7 999 200-30-40",
    email: null,
    employment_date: null,
    is_active: false,
    created_at: "2026-08-24T10:00:00+00:00",
    updated_at: "2026-08-24T10:00:00+00:00",
  });
  assert.equal(employeeMatchesQuery(view, "смирнов"), true);
  assert.equal(employeeMatchesQuery(view, "спорт"), true);
  assert.equal(employeeMatchesQuery(view, "200-30"), true);
  assert.equal(employeeMatchesQuery(view, "неттакого"), false);
});

test("validateEmployeeEmail allows blank and rejects junk", () => {
  assert.equal(validateEmployeeEmail(""), null);
  assert.equal(validateEmployeeEmail("a@b.ru"), null);
  assert.equal(validateEmployeeEmail("не email"), "Укажите корректный email");
});
