import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../lib/configurator.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { caseDimensions, configurationExport, defaultConfiguration, acrylicTints, footShapes, panelCount } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

test("build produces the worker, client manifest and social card", async () => {
  await Promise.all(["../dist/server/index.js", "../dist/client/vinext-client-entry-manifest.json", "../dist/client/og.png"].map(path => access(new URL(path, import.meta.url))));
});

test("dimensions preserve exact HP pitch, row height and uniform sheet thickness", () => {
  const base = caseDimensions(defaultConfiguration);
  assert.equal(base.width, 84 * 5.08 + 10);
  assert.equal(base.length, 133.35 + 10);
  assert.equal(base.height, 80);
  const oddHp = caseDimensions({ ...defaultConfiguration, hp: 85 });
  assert.ok(Math.abs(oddHp.width - base.width - 5.08) < 1e-10);
  const thick = caseDimensions({ ...defaultConfiguration, thickness: 6, rows: 3 });
  assert.equal(thick.width, base.width + 2);
  assert.equal(thick.length, 3 * 133.35 + 12);
  assert.equal(thick.height, base.height + 1);
});

test("export retains the complete configuration and marks unverified board fit", () => {
  const config = { ...defaultConfiguration, hp: 63, depth: 117, rows: 2, thickness: 4, angle: 20, vents: false, tint: acrylicTints[3], busboard: "trolley", handle: true, footShape: "arch" };
  const exported = JSON.parse(JSON.stringify(configurationExport(config)));
  for (const [key, value] of Object.entries(config)) assert.deepEqual(exported.configuration[key], value);
  assert.deepEqual(exported.outerDimensions, caseDimensions(config));
  assert.equal(exported.status, "design-concept");
  assert.equal(exported.units, "mm");
  assert.equal(exported.configuration.material, "GS cast acrylic");
  assert.match(exported.notes.join(" "), /not a cutting template/);
  assert.match(exported.notes.join(" "), /Trolley Bus.*must be verified/);
  assert.doesNotMatch(configurationExport(defaultConfiguration).notes.join(" "), /requested board family/);
});

test("accessory exports count only installed sheets while retaining the foot preference", () => {
  assert.equal(defaultConfiguration.handle, false);
  assert.equal(defaultConfiguration.angle, 0);
  for (const { value: footShape } of footShapes) for (const angle of [0, 10, 20, 30]) for (const handle of [false, true]) {
    const config = { ...defaultConfiguration, footShape, angle, handle };
    const exported = JSON.parse(JSON.stringify(configurationExport(config)));
    const expectedPanels = 5 + (angle ? 2 : 0) + (handle ? 1 : 0);
    assert.equal(panelCount(config), expectedPanels);
    assert.deepEqual(exported.acrylicParts, { enclosurePanels: 5, footPanels: angle ? 2 : 0, handlePanels: handle ? 1 : 0, totalPanels: expectedPanels });
    assert.equal(exported.configuration.footShape, footShape);
    assert.equal(exported.configuration.handle, handle);
    assert.deepEqual(exported.outerDimensions, caseDimensions(defaultConfiguration));
  }
});
