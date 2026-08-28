import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

test("26.3.14 order link lives in Данные по заказу behind Выбрать заказ", () => {
  const card = readFileSync(
    join(root, "components/production/tech-card-order-data-card.tsx"),
    "utf8",
  );
  assert.ok(card.includes('title="Данные по заказу"'));
  assert.ok(card.includes("<StandaloneTechCardLinkPanel"));
  assert.ok(card.includes("data-tech-card-order-link"));
  assert.ok(card.includes(">Заказ<"));
  assert.equal(card.includes("data-tech-card-order-top-row"), false);
  assert.equal(card.includes("sm:grid-cols-2"), false);

  const panel = readFileSync(
    join(root, "components/production/standalone-tech-card-link-panel.tsx"),
    "utf8",
  );
  assert.ok(panel.includes('data-tech-card-select-order'));
  assert.ok(panel.includes("data-tech-card-order-row"));
  assert.ok(panel.includes("data-tech-card-order-number"));
  assert.ok(panel.includes("Номер из другой системы"));
  assert.ok(panel.includes("text-portal-primary"));
  assert.ok(panel.includes("text-portal-muted"));
  assert.ok(panel.includes("Выбрать заказ"));
  assert.ok(panel.includes("justify-between"));
  assert.equal(panel.includes("<SectionCard"), false);

  const workspace = readFileSync(
    join(root, "components/production/tech-card-detail-workspace.tsx"),
    "utf8",
  );
  assert.equal(workspace.includes("StandaloneTechCardLinkPanel"), false);
});
