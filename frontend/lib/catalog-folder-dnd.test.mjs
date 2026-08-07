import assert from "node:assert/strict";
import test from "node:test";

import {
  CATALOG_DND_ROOT_ID,
  canNestCatalogFolder,
  catalogFolderDndId,
  catalogFolderWouldChangeParent,
  catalogItemDndId,
  isCatalogFolderDescendant,
  parseCatalogDndId,
} from "./catalog-folder-dnd.ts";

const folders = [
  { id: 1, parent_id: null },
  { id: 2, parent_id: 1 },
  { id: 3, parent_id: 2 },
  { id: 4, parent_id: null },
];

test("parseCatalogDndId reads folder item and root", () => {
  assert.deepEqual(parseCatalogDndId(catalogFolderDndId(12)), {
    kind: "folder",
    id: 12,
  });
  assert.deepEqual(parseCatalogDndId(catalogItemDndId(9)), {
    kind: "item",
    id: 9,
  });
  assert.deepEqual(parseCatalogDndId(CATALOG_DND_ROOT_ID), { kind: "root" });
  assert.equal(parseCatalogDndId("nope"), null);
});

test("isCatalogFolderDescendant walks parents", () => {
  assert.equal(isCatalogFolderDescendant(folders, 3, 1), true);
  assert.equal(isCatalogFolderDescendant(folders, 3, 2), true);
  assert.equal(isCatalogFolderDescendant(folders, 1, 3), false);
  assert.equal(isCatalogFolderDescendant(folders, 4, 1), false);
});

test("canNestCatalogFolder blocks self and descendant targets", () => {
  assert.equal(canNestCatalogFolder(folders, 1, 3), false);
  assert.equal(canNestCatalogFolder(folders, 1, 1), false);
  assert.equal(canNestCatalogFolder(folders, 3, 4), true);
  assert.equal(canNestCatalogFolder(folders, 3, null), true);
  assert.equal(canNestCatalogFolder(folders, 3, 2), true);
});

test("catalogFolderWouldChangeParent detects no-op", () => {
  assert.equal(catalogFolderWouldChangeParent(folders, 2, 1), false);
  assert.equal(catalogFolderWouldChangeParent(folders, 2, null), true);
  assert.equal(catalogFolderWouldChangeParent(folders, 2, 4), true);
});
