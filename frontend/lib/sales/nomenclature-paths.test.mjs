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
    "saveNomenclatureCharacteristicValue",
    "removeNomenclatureCharacteristicValue",
    "Основные реквизиты",
    "Характеристики номенклатуры",
    "NomenclatureAddCharacteristicForm",
    "NomenclatureMediaCarousel",
    "ProductModelToolbarActions",
    "onEdit={startEdit}",
    "onCancel={cancelEdit}",
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
  assert.equal(
    source.includes("saveNomenclatureCustomField"),
    false,
    "custom-field save shim must be removed",
  );
  assert.equal(
    source.includes("custom-fields-actions"),
    false,
    "custom-fields-actions import must be removed",
  );
  assert.equal(
    source.includes("Дополнительные реквизиты"),
    false,
    "legacy custom-fields block title must be removed",
  );
  assert.equal(
    source.includes("NomenclatureAddCustomFieldForm"),
    false,
    "legacy add-custom-field form must be removed",
  );
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
