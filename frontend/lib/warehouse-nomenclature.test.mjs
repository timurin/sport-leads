import assert from "node:assert/strict";
import test from "node:test";

import { primaryNomenclatureCoverContentUrl } from "./warehouse-nomenclature-covers.ts";

test("primaryNomenclatureCoverContentUrl prefers primary media", () => {
  assert.equal(
    primaryNomenclatureCoverContentUrl([
      { content_url: "/media/a.jpg", is_primary: false },
      { content_url: "/media/b.jpg", is_primary: true },
    ]),
    "/media/b.jpg",
  );
});

test("primaryNomenclatureCoverContentUrl falls back to first media", () => {
  assert.equal(
    primaryNomenclatureCoverContentUrl([
      { content_url: "/media/only.jpg", is_primary: false },
    ]),
    "/media/only.jpg",
  );
});

test("primaryNomenclatureCoverContentUrl returns null when media empty", () => {
  assert.equal(primaryNomenclatureCoverContentUrl([]), null);
});
