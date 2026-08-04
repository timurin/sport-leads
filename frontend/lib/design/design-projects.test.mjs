import assert from "node:assert/strict";
import test from "node:test";

import {
  designAssetKindLabel,
  designProjectStatusLabel,
  designVersionStatusLabel,
  filterDesignProjectsClient,
} from "./design-projects.ts";

test("designProjectStatusLabel covers MVP statuses", () => {
  assert.equal(designProjectStatusLabel("draft"), "Черновик");
  assert.equal(designProjectStatusLabel("in_progress"), "В работе");
  assert.equal(designProjectStatusLabel("ready"), "Готов");
  assert.equal(designProjectStatusLabel("archived"), "В архиве");
});

test("designVersionStatusLabel covers MVP statuses", () => {
  assert.equal(designVersionStatusLabel("draft"), "Черновик");
  assert.equal(designVersionStatusLabel("current"), "Текущая");
  assert.equal(designVersionStatusLabel("superseded"), "Заменена");
});

test("filterDesignProjectsClient matches number title and order", () => {
  const rows = [
    {
      id: 1,
      sales_order_id: 10,
      sales_order_number: "SO-1",
      number: "DP-SO-1-1",
      project_seq: 1,
      status: "draft",
      title: "Макет формы",
      notes: null,
      version_count: 0,
      current_version_no: null,
      created_at: "",
      updated_at: "",
    },
    {
      id: 2,
      sales_order_id: 20,
      sales_order_number: "SO-2",
      number: "DP-SO-2-1",
      project_seq: 1,
      status: "ready",
      title: "Логотип",
      notes: null,
      version_count: 1,
      current_version_no: 1,
      created_at: "",
      updated_at: "",
    },
  ];
  assert.equal(filterDesignProjectsClient(rows, "формы").length, 1);
  assert.equal(filterDesignProjectsClient(rows, "DP-SO-2").length, 1);
  assert.equal(filterDesignProjectsClient(rows, "20").length, 1);
  assert.equal(filterDesignProjectsClient(rows, "").length, 2);
});

test("designAssetKindLabel covers MVP kinds", () => {
  assert.equal(designAssetKindLabel("layout"), "Макет");
  assert.equal(designAssetKindLabel("logo"), "Логотип");
  assert.equal(designAssetKindLabel("other"), "Прочее");
});
