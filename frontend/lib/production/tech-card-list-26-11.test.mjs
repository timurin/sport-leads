import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

test("26.11 list toolbar: view segment + icon-only create/generate + responsible", () => {
  const workspace = readFileSync(
    join(root, "components/production/tech-cards-workspace.tsx"),
    "utf8",
  );
  assert.ok(workspace.includes("data-tech-card-list-view-tabs"));
  assert.ok(workspace.includes('{ id: "list", label: "Техкарты" }'));
  assert.ok(workspace.includes('{ id: "kanban", label: "Канбан" }'));
  assert.ok(workspace.includes("data-tech-card-toolbar-create"));
  assert.ok(workspace.includes("data-tech-card-toolbar-generate"));
  assert.ok(workspace.includes('label="Создать"'));
  assert.ok(workspace.includes('label="Сформировать из заказа"'));
  assert.equal(workspace.includes("Сформировать из заказа}"), false);
  assert.ok(workspace.includes(">Ответственный<"));
  assert.ok(workspace.includes("card.responsible_name"));
  assert.ok(workspace.includes('label="Ответственный"'));
  assert.ok(workspace.includes("data-tech-card-filter-responsible"));
  assert.ok(workspace.includes("responsible: responsibleFilter"));
  assert.ok(workspace.includes('variant="center"'));
  assert.ok(workspace.includes("data-tech-card-create-nomenclature-chrome"));
  assert.ok(workspace.includes("data-tech-card-create-nomenclature-edit"));
  assert.ok(workspace.includes("data-tech-card-create-nomenclature-cancel"));
  assert.ok(workspace.includes("data-tech-card-create-nomenclature-save"));
  assert.ok(workspace.includes("data-tech-card-create-nomenclature-catalog"));
  assert.ok(workspace.includes("<NomenclaturePickModal"));
  assert.ok(workspace.includes("data-tech-card-row-copy"));
  assert.ok(workspace.includes("data-tech-card-row-delete"));
  assert.ok(workspace.includes('String(card.status) === "draft"'));

  const page = readFileSync(
    join(root, "app/(workspace)/production/tech-cards/page.tsx"),
    "utf8",
  );
  assert.ok(page.includes("parseTechCardListView"));
  assert.ok(page.includes("hideToolbar"));

  const kanbanPage = readFileSync(
    join(root, "app/(workspace)/production/kanban/page.tsx"),
    "utf8",
  );
  assert.ok(kanbanPage.includes('redirect("/production/tech-cards?view=kanban")'));
});

test("26.11 manager tabs order and labels", () => {
  const workspace = readFileSync(
    join(root, "components/production/tech-card-detail-workspace.tsx"),
    "utf8",
  );
  const tabsStart = workspace.indexOf("const MANAGER_DOC_TABS = [");
  const tabsEnd = workspace.indexOf("] as const;", tabsStart);
  const block = workspace.slice(tabsStart, tabsEnd);
  assert.ok(tabsStart > 0);
  const assembly = block.indexOf('{ id: "assembly", label: "Персонализация" }');
  const materials = block.indexOf('{ id: "materials", label: "Материалы" }');
  const operations = block.indexOf('{ id: "operations", label: "Операции" }');
  const scheme = block.indexOf('{ id: "scheme", label: "Пошив" }');
  const route = block.indexOf('{ id: "route", label: "Маршрут" }');
  assert.ok(assembly >= 0 && assembly < materials && materials < operations);
  assert.ok(operations < scheme && scheme < route);
  assert.ok(workspace.includes('useState<ManagerDocTabId>("assembly")'));
});
