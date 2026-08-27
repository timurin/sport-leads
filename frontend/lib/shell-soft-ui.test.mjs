import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";

async function readRelative(path) {
  return readFile(fileURLToPath(new URL(path, import.meta.url)), "utf8");
}

test("Soft UI shell keeps nav SoT and compact mechanics", async () => {
  const sidebar = await readRelative("../components/navigation/app-sidebar.tsx");
  const topbar = await readRelative("../components/navigation/top-navigation.tsx");
  const css = await readRelative("../app/globals.css");

  for (const marker of [
    'data-sl-shell="v1"',
    "sl-shell-rail-card",
    "SIDEBAR_STORAGE_KEY",
    "sport-lead-sidebar-mode",
    "1299",
    'from "@/lib/navigation"',
    "groupSectionsByContour",
    "data-sidebar-contour",
  ]) {
    assert.ok(sidebar.includes(marker), `sidebar missing ${marker}`);
  }

  for (const marker of [
    'data-sl-shell="v1"',
    "sl-shell-topbar-card",
    'from "@/lib/navigation"',
    "setSearchOpen",
    "Создать",
    "data-settings-topbar-link",
    'href="/settings"',
  ]) {
    assert.ok(topbar.includes(marker), `topbar missing ${marker}`);
  }

  assert.ok(css.includes("--portal-shell-sidebar-expanded: max(220px, 10vw)"));
  assert.ok(css.includes("flex-basis: var(--portal-shell-sidebar-expanded)"));
  assert.ok(sidebar.includes('data-sidebar-mode={mode}'));
  assert.ok(!sidebar.includes("w-[var(--portal-shell-sidebar-expanded)]"));
  assert.ok(css.includes("--portal-shell-sidebar-compact: 72px"));
  assert.ok(css.includes(".sl-shell-rail-card"));

  assert.ok(!sidebar.includes("А. Козлов"));
  assert.ok(!topbar.includes("Уведомления"));
  assert.ok(!topbar.includes("topbar-meta"));
});
