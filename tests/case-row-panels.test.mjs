import assert from "node:assert/strict";
import test from "node:test";
import clipping from "polygon-clipping";
import { loadTypescript } from "./load-typescript.mjs";

const { defaultConfiguration, rackRowLayout, rackRowPoint, rackEnvelope, caseThicknesses, sidePanelMargin, panelCount, configurationExport } = await loadTypescript("../lib/configurator.ts");
const { createCasePanels, caseCanExport } = await loadTypescript("../lib/case-panels.ts");
const { caseRowPanelConfiguration } = await loadTypescript("../lib/case-row-panels.ts");
const { newPanelComponent, panelRectangle } = await loadTypescript("../lib/panel-designer.ts");
const { caseSheetLayout, configurationSvg } = await loadTypescript("../lib/svg-export.ts");
const { caseFabrication } = await loadTypescript("../lib/fabrication.ts");
const { geometryArea, normalizeOutlines, polygonBounds } = await loadTypescript("../lib/custom-cutouts.ts");
const { readCase, parseProject } = await loadTypescript("../lib/project.ts");
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} ≈ ${b}`);
function fixture(hp = 104) {
  const config = { ...defaultConfiguration, hp, rows: 3, rowUnits: [1, 3, 1], rowAngles: [25, 15, 0], vents: false };
  config.rowPanels = [caseRowPanelConfiguration(config, 0), null, caseRowPanelConfiguration(config, 2)];
  return config;
}

test("top and bottom panels span the case and use side tabs without mounting holes", () => {
  for (const hp of [20, 84, 104, 168]) {
    const config = fixture(hp), panels = createCasePanels(config);
    assert.equal(panelCount(config), 7);
    assert.equal(panels.rowPanels.length, 2);
    for (const { panel, attachment } of panels.rowPanels) {
      near(panel.width, hp * 5.08);
      near(panel.height, 39.65);
      assert.equal(panel.mounts.length, 0);
      assert.equal(panel.polygons[0].length, 1);
      assert.equal(attachment.tabs.length, 2);
      near(polygonBounds(panel.polygons).width, hp * 5.08 + 10);
      assert.equal(panel.railReserve, 0);
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
  assert.ok(fabrication.hardware.includes("2 rails cut to 104 HP"));
  assert.ok(!fabrication.hardware.some(note => note.includes("panel mounting screws")));
  assert.equal(configurationExport(config).panelAssembly.railEndScrewCount, 4);
  const restored = parseProject(JSON.stringify(configurationExport(config))).designs.case;
  assert.deepEqual(restored.rowPanels, config.rowPanels);
  assert.equal(configurationSvg(restored, createCasePanels(restored)), svg);
  const widened = createCasePanels({ ...restored, hp: 168 }).rowPanels[0].panel;
  near(widened.width, 168 * 5.08);
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


test("side slots match tab thickness, slope and position, with material retained above", () => {
  for (const angled of [false, true]) for (const thickness of [1.5, 3, 6]) {
    const config = fixture(84);
    config.rowAngles = angled ? [60, 15, 0] : [0, 0, 0];
    config.individualPanelTints = true;
    config.panelThicknesses = { left: 3, right: 6 };
    config.rowPanels[0].thickness = thickness;
    config.rowPanels[2].thickness = thickness;
    const panels = createCasePanels(config), rows = rackRowLayout(config), sheets = caseThicknesses(config);
    const rimHeight = config.depth + sheets.bottom + sidePanelMargin(config);
    for (const { index, panel, attachment } of panels.rowPanels) {
      near(polygonBounds(panel.original).width, config.hp * 5.08 + sheets.left + sheets.right);
      for (const offset of [-panel.height / 2, panel.height / 2]) for (const normal of [attachment.normal, attachment.normal + thickness]) {
        const point = rackRowPoint(rows[index], offset, normal);
        assert.ok(Math.abs(point.z) <= rackEnvelope(config).length / 2 + 1e-6, "Recessed sheet clears the front and rear walls, even at steep angles");
      }
      const sideRegion = (tab, normal, height) => {
        const ring = [[tab.start, normal], [tab.end, normal], [tab.end, normal + height], [tab.start, normal + height]].map(([offset, n]) => {
          const p = rackRowPoint(rows[index], -offset, n);
          return [-p.z, rimHeight + p.y - panels.faces.right.centerY * 100];
        });
        ring.push(ring[0]); return [[ring]];
      };
      for (const end of [-1, 1]) {
        const oldRail = rackRowPoint(rows[index], end * rows[index].railOffset, -7);
        const x = -oldRail.z, y = rimHeight + oldRail.y - panels.faces.right.centerY * 100;
        const screwCentre = [[[[x - 0.1, y - 0.1], [x + 0.1, y - 0.1], [x + 0.1, y + 0.1], [x - 0.1, y + 0.1], [x - 0.1, y - 0.1]]]];
        near(geometryArea(clipping.intersection(panels.faces.right.original, screwCentre)), 0.04);
      }
      for (const tab of attachment.tabs) {
        const exactSlot = sideRegion(tab, attachment.normal, thickness);
        const points = panels.faces.right.original.flatMap(polygon => polygon.flat());
        for (const [x, y] of exactSlot[0][0]) assert.ok(points.some(([px, py]) => Math.hypot(px - x, py - y) < 1e-6), "Matching tab corner exists in the side slot");
        const slot = sideRegion({ start: tab.start + 0.01, end: tab.end - 0.01 }, attachment.normal + 0.01, thickness - 0.02);
        near(geometryArea(clipping.intersection(panels.faces.right.original, slot)), 0);
        const web = sideRegion(tab, -thickness + 0.1, thickness - 0.2);
        near(geometryArea(clipping.intersection(panels.faces.right.original, web)), geometryArea(web));
      }
    }
    assert.equal(caseCanExport(panels), true);
  }
});

test("cuts through attachment tabs or roots block case exports", () => {
  const config = fixture(84);
  const attached = createCasePanels(config).rowPanels[0];
  const tab = attached.attachment.tabs[0];
  config.rowPanels[0].components = [{ ...newPanelComponent("jack", "bad-cut"), x: attached.panel.width / 2, y: (tab.start + tab.end) / 2 }];
  const panels = createCasePanels(config);
  assert.match(panels.rowPanels[0].panel.report.error, /attachment tabs/);
  assert.equal(caseCanExport(panels), false);
  assert.throws(() => configurationSvg(config, panels), /Resolve/);
});
