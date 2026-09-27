import assert from "node:assert/strict";
import test from "node:test";
import clipping from "polygon-clipping";
import { loadTypescript } from "./load-typescript.mjs";

const { defaultConfiguration, rackRowLayout, panelCount, configurationExport } = await loadTypescript("../lib/configurator.ts");
const { createCasePanels, caseCanExport } = await loadTypescript("../lib/case-panels.ts");
const { caseRowPanelConfiguration } = await loadTypescript("../lib/case-row-panels.ts");
const { newPanelComponent, panelRectangle } = await loadTypescript("../lib/panel-designer.ts");
const { caseSheetLayout, configurationSvg } = await loadTypescript("../lib/svg-export.ts");
const { caseFabrication } = await loadTypescript("../lib/fabrication.ts");
const { geometryArea, normalizeOutlines } = await loadTypescript("../lib/custom-cutouts.ts");
const { readCase, parseProject } = await loadTypescript("../lib/project.ts");
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} ≈ ${b}`);
function fixture(hp = 104) {
  const config = { ...defaultConfiguration, hp, rows: 3, rowUnits: [1, 3, 1], rowAngles: [25, 15, 0], vents: false };
  config.rowPanels = [caseRowPanelConfiguration(config, 0), null, caseRowPanelConfiguration(config, 2)];
  return config;
}

test("top and bottom panels match the case width and existing rail centres at all supported widths", () => {
  for (const hp of [20, 84, 104, 168]) {
    const config = fixture(hp), panels = createCasePanels(config), rows = rackRowLayout(config);
    assert.equal(panelCount(config), 7);
    assert.equal(panels.rowPanels.length, 2);
    for (const { index, panel } of panels.rowPanels) {
      near(panel.width, hp * 5.08 - 0.3);
      near(panel.height, 39.65);
      assert.equal(panel.mounts.length, 4);
      for (const mount of panel.mounts) near(Math.abs(mount.y), rows[index].railOffset);
      assert.equal(panel.canExport, true);
    }
    assert.equal(caseCanExport(panels), true);
    assert.equal(caseSheetLayout(panels).parts.length, 7);
    assert.equal(caseFabrication(config, panels).parts.length, 7);
  }
});

test("component cuts and engravings survive case fabrication and project round trips", () => {
  const config = fixture();
  config.rowPanels[0].components = [{ ...newPanelComponent("jack", "jack-1"), x: -50 }];
  config.rowPanels[0].thickness = 2;
  config.rowPanels[0].artwork = [{ id: "label", name: "Label", source: { kind: "svg", fileName: "label.svg" }, side: "front", operation: "engrave", polygons: normalizeOutlines(panelRectangle(12, 4)), width: 12, x: 30, y: 0, rotation: 0 }];
  const panels = createCasePanels(config), panel = panels.rowPanels[0].panel;
  near(geometryArea(clipping.intersection(panel.polygons, panel.components[0].polygons)), 0);
  assert.ok(geometryArea(panel.engraving.polygons) > 0);
  const svg = configurationSvg(config, panels);
  assert.match(svg, /id="panel-row-1" data-part="row-1" data-thickness-mm="2"/);
  assert.match(svg, /id="engrave-row-1"/);
  assert.match(svg, /id="panel-row-3"/);
  const fabrication = caseFabrication(config, panels);
  assert.equal(fabrication.parts.find(part => part.id === "row-1").thickness, 2);
  assert.ok(fabrication.hardware.some(note => note.includes("Top 1U panel: 4 panel mounting screws")));
  const restored = parseProject(JSON.stringify(configurationExport(config))).designs.case;
  assert.deepEqual(restored.rowPanels, config.rowPanels);
  assert.equal(configurationSvg(restored, createCasePanels(restored)), svg);
  const widened = createCasePanels({ ...restored, hp: 168 }).rowPanels[0].panel;
  near(widened.width, 168 * 5.08 - 0.3);
  assert.equal(widened.components[0].x, -50);
});

test("invalid row placement is rejected and empty custom sheets block fabrication", () => {
  const config = fixture(84);
  assert.throws(() => readCase({ ...config, rowPanels: [null, config.rowPanels[0], null] }), /top or bottom 1U/);
  assert.throws(() => readCase({ ...config, rowUnits: [3, 3, 1] }), /top or bottom 1U/);
  config.rowPanels[0].artwork = [{ id: "erase", name: "Erase", source: { kind: "svg", fileName: "erase.svg" }, side: "front", operation: "cut", polygons: normalizeOutlines(panelRectangle(500, 500)), width: 500, x: 0, y: 0, rotation: 0 }];
  const panels = createCasePanels(config);
  assert.equal(caseCanExport(panels), false);
  assert.equal(caseFabrication(config, panels).blocked, true);
  assert.throws(() => configurationSvg(config, panels), /Resolve/);
  assert.equal(createCasePanels(defaultConfiguration).rowPanels.length, 0);
  assert.equal(panelCount(defaultConfiguration), 5);
});
