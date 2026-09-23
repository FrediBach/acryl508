import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import test from "node:test";
import { loadTypescript } from "./load-typescript.mjs";

const { caseDimensions, configurationExport, defaultConfiguration, acrylicTints, footShapes, panelCount, rackRowLayout, rackRows, sidePanelMargin, totalRackUnits } = await loadTypescript("../lib/configurator.ts");

test("build produces the worker, client manifest and social card", async () => {
  await Promise.all(["../dist/server/index.js", "../dist/client/vinext-client-entry-manifest.json", "../dist/client/og.png"].map(path => access(new URL(path, import.meta.url))));
});

test("dimensions preserve exact HP pitch, row height and uniform sheet thickness", () => {
  const base = caseDimensions(defaultConfiguration);
  assert.equal(base.width, 84 * 5.08 + 10);
  assert.equal(base.length, 133.35 + 30);
  assert.equal(base.height, 90);
  const oddHp = caseDimensions({ ...defaultConfiguration, hp: 85 });
  assert.ok(Math.abs(oddHp.width - base.width - 5.08) < 1e-10);
  const thick = caseDimensions({ ...defaultConfiguration, thickness: 6, rows: 3 });
  assert.equal(thick.width, base.width + 2);
  assert.equal(thick.length, 3 * 133.35 + 36);
  assert.equal(thick.height, base.height + 3);
});

test("mixed 1U and 3U rows preserve order and drive dimensions and rail placement", () => {
  const config = { ...defaultConfiguration, rows: 4, rowUnits: [1, 3, 1, 3] };
  const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} ≈ ${expected}`);
  assert.deepEqual(rackRows(config), [1, 3, 1, 3]);
  assert.equal(totalRackUnits(config), 8);
  assert.equal(caseDimensions(config).length, 8 * 44.45 + 30);
  const layout = rackRowLayout(config);
  assert.deepEqual(layout.map(row => row.units), config.rowUnits);
  near(layout[0].center - layout[0].length / 2, -8 * 44.45 / 2);
  for (let index = 1; index < layout.length; index++) {
    near(layout[index - 1].center + layout[index - 1].length / 2, layout[index].center - layout[index].length / 2);
  }
  near(layout.at(-1).center + layout.at(-1).length / 2, 8 * 44.45 / 2);
  const exported = configurationExport(config);
  assert.equal(exported.panelAssembly.railCount, 8);
  assert.equal(exported.panelAssembly.railEndScrewCount, 16);
});

test("side panel margin moves from the original profile to the guarded near-flush profile", () => {
  const original = { ...defaultConfiguration, sideMarginRatio: 2 };
  const nearFlush = { ...defaultConfiguration, sideMarginRatio: 1 };
  assert.equal(sidePanelMargin(original), original.thickness * 2);
  assert.equal(sidePanelMargin(nearFlush), nearFlush.thickness);
  assert.equal(sidePanelMargin({ ...nearFlush, sideMarginRatio: 0 }), nearFlush.thickness);
  assert.equal(sidePanelMargin({ ...nearFlush, sideMarginRatio: 99 }), nearFlush.thickness * 2);
  assert.equal(caseDimensions(original).length - caseDimensions(nearFlush).length, original.thickness * 2);
  assert.equal(caseDimensions(original).height - caseDimensions(nearFlush).height, original.thickness);
  const exported = configurationExport(nearFlush);
  assert.equal(exported.panelAssembly.baseUndersideHeight, nearFlush.thickness);
  assert.equal(exported.panelAssembly.endRetainingMargin, nearFlush.thickness);
  assert.equal(exported.panelAssembly.slotCenterToEdge, nearFlush.thickness * 1.5);
  assert.equal(exported.panelAssembly.minimumSlotCenterToEdge, nearFlush.thickness * 1.5);
});

test("case panels are retained by the rail screws without additional panel fasteners or adhesive", () => {
  for (const rows of [1, 2, 3]) for (const thickness of [3, 4, 5, 6]) {
    const config = { ...defaultConfiguration, rows, thickness };
    const { panelAssembly, outerDimensions } = configurationExport(config);
    assert.equal(panelAssembly.railCount, rows * 2);
    assert.equal(panelAssembly.railEndScrewCount, rows * 4);
    assert.equal(panelAssembly.additionalPanelFasteners, 0);
    assert.equal(panelAssembly.adhesive, false);
    assert.equal(outerDimensions.height - panelAssembly.baseUndersideHeight - thickness, config.depth);
    assert.equal(outerDimensions.length - 2 * panelAssembly.endRetainingMargin - 2 * thickness, rows * 133.35);
    assert.match(panelAssembly.disassembly, /remove the rail-end screws on one side/);
    assert.match(panelAssembly.status, /require fabrication validation/);
  }
});

test("export retains the complete configuration and marks unverified board fit", () => {
  const config = { ...defaultConfiguration, hp: 63, depth: 117, rows: 2, thickness: 4, angle: 20, vents: false, tint: acrylicTints[3], busboard: "trolley", handle: true, footShape: "arch" };
  const exported = JSON.parse(JSON.stringify(configurationExport(config)));
  for (const [key, value] of Object.entries(config)) assert.deepEqual(exported.configuration[key], value);
  assert.deepEqual(exported.outerDimensions, caseDimensions(config));
  assert.equal(exported.status, "design-concept");
  assert.equal(exported.version, 5);
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
    if (angle) {
      assert.equal(exported.footAttachment.boltsPerFoot, 2);
      assert.equal(exported.footAttachment.boltCount, 4);
      assert.equal(exported.footAttachment.locknutCount, 4);
      assert.equal(exported.footAttachment.adhesive, false);
    } else assert.equal(exported.footAttachment, null);
  }
});
