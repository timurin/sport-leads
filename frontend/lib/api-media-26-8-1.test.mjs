import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  isAllowlistedApiMediaPath,
  rasterImageMimeOrNull,
  sameOriginApiMediaUrl,
} from "./api-media.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("26.8.1 same-origin proxy URLs; loopback API origin is not used", () => {
  assert.equal(
    sameOriginApiMediaUrl("/product-models/104/media/3/content"),
    "/api/media/product-models/104/media/3/content",
  );
  assert.equal(
    sameOriginApiMediaUrl("/nomenclatures/1/media/2/content"),
    "/api/media/nomenclatures/1/media/2/content",
  );
  assert.equal(
    sameOriginApiMediaUrl("/technical-cards/4/media/9/content"),
    "/api/media/technical-cards/4/media/9/content",
  );
  assert.equal(
    sameOriginApiMediaUrl("http://127.0.0.1:8000/product-models/5/cover/content"),
    "/api/media/product-models/5/cover/content",
  );
  assert.equal(sameOriginApiMediaUrl("blob:http://localhost/x"), "blob:http://localhost/x");
  assert.equal(isAllowlistedApiMediaPath("/etc/passwd"), false);
  assert.equal(
    rasterImageMimeOrNull({ type: "", name: "photo.JPEG" }),
    "image/jpeg",
  );
  assert.equal(rasterImageMimeOrNull({ type: "", name: "shot.heic" }), null);

  const cover = readFileSync(join(root, "lib/product-models.ts"), "utf8");
  assert.ok(cover.includes("sameOriginApiMediaUrl"));
  assert.ok(!cover.includes("NEXT_PUBLIC_SPORT_LEADS_API_URL"));

  const nom = readFileSync(join(root, "lib/nomenclature.ts"), "utf8");
  assert.ok(nom.includes("sameOriginApiMediaUrl"));

  const route = readFileSync(
    join(root, "app/api/media/[...path]/route.ts"),
    "utf8",
  );
  assert.ok(route.includes("SPORT_LEADS_API_URL"));
  assert.ok(route.includes("isAllowlistedApiMediaPath"));

  const nextConfig = readFileSync(join(root, "next.config.ts"), "utf8");
  assert.ok(nextConfig.includes('bodySizeLimit: "15mb"'));
});
