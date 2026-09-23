import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("builds the Acryl508 configurator application", async () => {
  const [page, layout, shell, controls, preview, summary, packageJson] =
    await Promise.all([
      readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
      readFile(new URL("../components/configurator-shell.tsx", import.meta.url), "utf8"),
      readFile(new URL("../components/configuration-panel.tsx", import.meta.url), "utf8"),
      readFile(new URL("../components/case-preview.tsx", import.meta.url), "utf8"),
      readFile(new URL("../components/build-summary.tsx", import.meta.url), "utf8"),
      readFile(new URL("../package.json", import.meta.url), "utf8"),
    ]);

  await Promise.all([
    access(new URL("../dist/server/index.js", import.meta.url)),
    access(new URL("../dist/client/vinext-client-entry-manifest.json", import.meta.url)),
  ]);

  assert.match(page, /ConfiguratorShell/);
  assert.match(layout, /Acryl508 — Eurorack Case Creator/);
  assert.match(shell, /ConfigurationPanel/);
  assert.match(shell, /PreviewStage/);
  assert.match(shell, /BuildSummary/);
  assert.match(controls, /Shape your/);
  assert.match(controls, /Acrylic tint/);
  assert.match(preview, /@react-three\/fiber/);
  assert.match(preview, /OrbitControls/);
  assert.match(summary, /Prepare fabrication files/);
  assert.match(packageJson, /"doctor": "react-doctor \. --verbose"/);
  assert.doesNotMatch(page + layout + packageJson, /codex-preview|react-loading-skeleton/i);
});
