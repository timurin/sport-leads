import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

test("26.3.12 manager Макет has add/delete; shop stays readOnly", () => {
  const workspace = readFileSync(
    join(root, "components/production/tech-card-detail-workspace.tsx"),
    "utf8",
  );
  const mockup = workspace.indexOf('title="Макет"');
  const carousel = workspace.indexOf("<TechCardMediaCarousel", mockup);
  const nextCard = workspace.indexOf("<TechCardOrderDataCard", mockup);
  assert.ok(mockup > 0 && carousel > mockup && carousel < nextCard);
  const chunk = workspace.slice(carousel, nextCard);
  assert.ok(chunk.includes("onAdd={onAddMedia}"));
  assert.ok(chunk.includes("onDelete={onDeleteMedia}"));
  assert.equal(chunk.includes("readOnly={true}"), false);
  assert.equal(chunk.includes("readOnly={!"), false);

  const carouselSrc = readFileSync(
    join(root, "components/production/tech-card-media-carousel.tsx"),
    "utf8",
  );
  assert.ok(carouselSrc.includes("group-hover:opacity-100"));
  assert.ok(carouselSrc.includes('label="Добавить фото"'));
  assert.ok(carouselSrc.includes('label="Удалить"'));
  assert.ok(carouselSrc.includes("TECH_CARD_MEDIA_MAX"));

  const shop = readFileSync(
    join(root, "components/production/tech-card-shop-floor-body.tsx"),
    "utf8",
  );
  assert.ok(shop.includes("readOnly={!mediaEditable}"));
});
