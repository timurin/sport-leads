import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { platformUserToSummary } from "./session-mapping.ts";

async function readSource(relativeFromAuth) {
  const path = fileURLToPath(new URL(relativeFromAuth, import.meta.url));
  return readFile(path, "utf8");
}

test("platformUserToSummary prefers linked sales_user_id", () => {
  const linked = platformUserToSummary({
    id: 7,
    login: "admin",
    display_name: "Админ Тест",
    is_active: true,
    sales_user_id: 3,
  });
  assert.equal(linked.id, "3");
  assert.equal(linked.name, "Админ Тест");
  assert.ok(linked.initials.length >= 1);

  const unlinked = platformUserToSummary({
    id: 7,
    login: "admin",
    display_name: "Админ",
    is_active: true,
    sales_user_id: null,
  });
  assert.equal(unlinked.id, "pu:7");
});

test("login route and workspace gate wired (17.1.1.3)", async () => {
  const session = await readSource("./session.ts");
  assert.ok(session.includes("/auth/me"));
  assert.ok(session.includes("sl_session"));
  assert.ok(session.includes("loginWithPassword"));

  const loginPage = await readSource("../../app/login/page.tsx");
  assert.ok(loginPage.includes("LoginForm"));

  const workspace = await readSource("../../app/(workspace)/layout.tsx");
  assert.ok(workspace.includes("getMe"));
  assert.ok(workspace.includes('redirect("/login")'));

  const leadDetails = await readSource("../sales/lead-details.ts");
  assert.ok(leadDetails.includes("platformUserToSummary"));
  assert.ok(leadDetails.includes("getMe"));
});
