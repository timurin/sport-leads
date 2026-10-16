import assert from "node:assert/strict";
import test from "node:test";

import { variantConflictMessage, variantStatusLabel } from "./route-variants.ts";

test("variant conflicts stay in Russian and hide the backend text", () => {
  assert.equal(
    variantConflictMessage("Cannot change variant: selected operation or its successor has started/completed"),
    "Способ раскроя нельзя изменить: операция уже запущена в производство.",
  );
  assert.equal(
    variantConflictMessage("Old variant has manual/locked assignments; resolve them before changing selection"),
    "Нельзя изменить вариант: у прежнего варианта есть ручные или заблокированные назначения.",
  );
  assert.equal(
    variantConflictMessage("Card plan is locked; unlock before changing variant"),
    "Нельзя изменить вариант: план техкарты заблокирован. Сначала разблокируйте план.",
  );
  assert.equal(
    variantConflictMessage("Confirmed selection cannot be demoted without changing the variant"),
    "Подтверждённый вариант нельзя вернуть в предварительный без смены операции.",
  );
  assert.equal(
    variantConflictMessage("Variant selection is not editable on this card/group"),
    "Этот вариант сейчас нельзя изменить.",
  );
  assert.equal(variantConflictMessage("HTTP 409 unexpected"), "Не удалось изменить вариант.");
  assert.equal(variantConflictMessage("HTTP 409 unexpected").includes("409"), false);
  assert.equal(variantStatusLabel("preliminary"), "Предварительно");
  assert.equal(variantStatusLabel("confirmed"), "Подтверждено");
});
