import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("nomenclature card wires non-image attachments (4.4.5)", () => {
  const lib = readFileSync(join(root, "lib/nomenclature.ts"), "utf8");
  assert.ok(lib.includes("NOMENCLATURE_FILE_ACCEPT"));
  assert.ok(lib.includes("validateNomenclatureAttachmentFile"));
  assert.ok(lib.includes("guessNomenclatureAttachmentMime"));

  const card = readFileSync(
    join(root, "components/settings/nomenclature-card.tsx"),
    "utf8",
  );
  assert.ok(card.includes('title="Вложения"'));
  assert.ok(card.includes("uploadAttachments"));
  assert.ok(card.includes("attachmentItems"));
  assert.ok(card.includes("NOMENCLATURE_FILE_ACCEPT"));

  const actions = readFileSync(
    join(
      root,
      "app/(workspace)/settings/catalogs/nomenclature/characteristics-actions.ts",
    ),
    "utf8",
  );
  assert.ok(actions.includes("mime_type"));
});
