import assert from "node:assert/strict";
import test from "node:test";

import {
  clientMatchesFolderScope,
  fromApiClientFolder,
} from "./client-folders.ts";

test("maps folder and filters descendants plus unfiled", () => {
  const root = fromApiClientFolder({
    id: 1,
    name: "Регионы",
    parent_id: null,
    sort_order: 0,
  });
  const child = fromApiClientFolder({
    id: 2,
    name: "Казань",
    parent_id: 1,
    sort_order: 0,
  });
  const folders = [root, child];

  assert.equal(clientMatchesFolderScope(2, "all", folders), true);
  assert.equal(clientMatchesFolderScope(null, "unfiled", folders), true);
  assert.equal(clientMatchesFolderScope(2, "unfiled", folders), false);
  assert.equal(clientMatchesFolderScope(2, 1, folders), true);
  assert.equal(clientMatchesFolderScope(1, 2, folders), false);
});
