import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { characteristicsApiPath } from "../nomenclature.ts";

test("uses the canonical characteristics API prefix without duplicate segments", () => {
  assert.equal(characteristicsApiPath("/definitions"), "/characteristics/definitions");
  assert.equal(
    characteristicsApiPath("nomenclatures/7/variants"),
    "/characteristics/nomenclatures/7/variants",
  );
  assert.equal(
    characteristicsApiPath("/characteristics/definitions"),
    "/characteristics/definitions",
  );
});

test("nomenclature card keeps PT-08 chrome and isolated async editing contracts", async () => {
  const cardPath = fileURLToPath(new URL("../../components/settings/nomenclature-card.tsx", import.meta.url));
  const source = await readFile(cardPath, "utf8");
  for (const marker of [
    "VersionedWorkspace",
    "CatalogVersionedCardLayout",
    "updateNomenclatureRequisites",
    "saveNomenclatureCustomField",
    "assignNomenclatureCharacteristic",
    "Основные реквизиты",
    "Дополнительные реквизиты",
    "NomenclatureMediaCarousel",
    "Редактировать",
    "Отмена",
    "Сохранение…",
    "Сохранено",
    "Ошибка сохранения",
    "router.refresh()",
    "category_id",
    "storage_unit_id",
  ]) {
    assert.ok(source.includes(marker), `missing editing marker: ${marker}`);
  }
  assert.equal(source.includes("lg:col-start-1"), false, "legacy 65/35 grid must be removed");
});

test("nomenclature media gallery keeps upload and media management contracts", async () => {
  const galleryPath = fileURLToPath(new URL("../../components/settings/nomenclature-media-gallery.tsx", import.meta.url));
  const source = await readFile(galleryPath, "utf8");
  for (const marker of [
    "@uppy/core",
    "@uppy/thumbnail-generator",
    "multiple",
    "autoProceed: false",
    "ThumbnailGenerator",
    "uploadNomenclatureMedia",
    "updateNomenclatureMedia",
    "deleteNomenclatureMedia",
    "image/jpeg,image/png,image/webp",
    "10 * 1024 * 1024",
    "is_primary",
    "sort_order",
    "Сделать главным",
    "Удалить",
  ]) {
    assert.ok(source.includes(marker), `missing media gallery marker: ${marker}`);
  }
});
