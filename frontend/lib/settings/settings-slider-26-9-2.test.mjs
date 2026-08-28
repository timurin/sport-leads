import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

test("26.9.2 settings hub opens in a lead-style slider from the topbar", () => {
  const slider = readFileSync(
    join(root, "components/settings/settings-card-slider.tsx"),
    "utf8",
  );
  assert.ok(slider.includes('role="dialog"'));
  assert.ok(slider.includes("data-settings-card-slider"));
  assert.ok(slider.includes("lg:w-[92%]"));
  assert.ok(slider.includes("createPortal"));
  assert.ok(slider.includes('router.push("/dashboard")'));

  const layout = readFileSync(
    join(root, "app/(workspace)/layout.tsx"),
    "utf8",
  );
  assert.ok(layout.includes("settingsSlider"));

  const intercept = readFileSync(
    join(root, "app/(workspace)/@settingsSlider/(.)settings/page.tsx"),
    "utf8",
  );
  assert.ok(intercept.includes("SettingsCardSlider"));
  assert.ok(intercept.includes("SettingsPage"));

  const topbar = readFileSync(
    join(root, "components/navigation/top-navigation.tsx"),
    "utf8",
  );
  assert.ok(topbar.includes("data-settings-topbar-link"));
  assert.ok(topbar.includes('href="/settings"'));
});

test("26.9.4 settings hub links leave the slider with a full navigation", () => {
  const link = readFileSync(
    join(root, "components/settings/settings-hub-link.tsx"),
    "utf8",
  );
  assert.ok(link.includes("data-settings-hub-link"));
  assert.ok(link.includes("data-settings-card-slider"));
  assert.ok(link.includes("window.location.assign"));

  const hub = readFileSync(
    join(root, "app/(workspace)/settings/page.tsx"),
    "utf8",
  );
  assert.ok(hub.includes("SettingsHubLink"));
  assert.equal(hub.includes('from "next/link"'), false);
});
