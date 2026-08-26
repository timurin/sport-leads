import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

test("26.5 lead card opens in Bitrix-style slider over the list", () => {
  const slider = readFileSync(
    join(root, "components/sales/lead-card-slider.tsx"),
    "utf8",
  );
  assert.ok(slider.includes('role="dialog"'));
  assert.ok(slider.includes("data-lead-card-slider"));
  assert.ok(slider.includes("lg:w-[92%]"));
  assert.ok(slider.includes("createPortal"));
  assert.ok(slider.includes("[data-lead-event-modal]"));

  const layout = readFileSync(
    join(root, "app/(workspace)/layout.tsx"),
    "utf8",
  );
  assert.ok(layout.includes("leadSlider"));

  const intercept = readFileSync(
    join(root, "app/(workspace)/@leadSlider/(.)sales/leads/[leadId]/page.tsx"),
    "utf8",
  );
  assert.ok(intercept.includes("LeadCardSlider"));
  assert.ok(intercept.includes("loadLeadRoute"));
});
