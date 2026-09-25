import assert from "node:assert/strict";
import test from "node:test";
import { ExtrudeGeometry, ShapeUtils } from "three";
import { loadTypescript } from "./load-typescript.mjs";

const { defaultConfiguration, panelThickness, caseThicknesses, caseDimensions, rackEnvelope, configurationExport } = await loadTypescript("../lib/configurator.ts");
const { createPanelProfiles } = await loadTypescript("../lib/panel-joints.ts");
const { createCasePanels } = await loadTypescript("../lib/case-panels.ts");
const { configurationSvg } = await loadTypescript("../lib/svg-export.ts");
const { caseFabrication, packSheets, stockSvg } = await loadTypescript("../lib/fabrication.ts");
const { readCase, parseProject, makeProject, initialDesigns } = await loadTypescript("../lib/project.ts");
const { geometryInputCache } = await loadTypescript("../lib/geometry-input.ts");
const { geometryArea } = await loadTypescript("../lib/custom-cutouts.ts");
const { cableHolderLayout } = await loadTypescript("../lib/cable-holder.ts");
const near = (a, b, epsilon = 1e-8) => assert.ok(Math.abs(a - b) < epsilon, `${a} != ${b}`);
const rounded = value => JSON.parse(JSON.stringify(value, (_, item) => typeof item === "number" ? Number(item.toFixed(8)) : item));
const bounds = points => ({ left: Math.min(...points.map(p => p.x)), right: Math.max(...points.map(p => p.x)), bottom: Math.min(...points.map(p => p.y)), top: Math.max(...points.map(p => p.y)) });
const mixed = { ...defaultConfiguration, individualPanelTints: true, panelThicknesses: { left: 3, right: 6, front: 4, rear: 5, bottom: 6 }, vents: false };

function checkExtrusion(shape, thickness) {
  const points = shape.extractPoints(24);
  const area = Math.abs(ShapeUtils.area(points.shape)) - points.holes.reduce((sum, hole) => sum + Math.abs(ShapeUtils.area(hole)), 0);
  const geometry = new ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, curveSegments: 24 });
  try {
    const p = geometry.getAttribute("position");
    assert.ok(p.array.every(Number.isFinite));
    let cap = 0;
    for (let i = 0; i < p.count; i += 3) if ([0, 1, 2].every(j => p.getZ(i + j) === 0)) {
      cap += Math.abs((p.getX(i + 1) - p.getX(i)) * (p.getY(i + 2) - p.getY(i)) - (p.getY(i + 1) - p.getY(i)) * (p.getX(i + 2) - p.getX(i))) / 2;
    }
    near(cap, area, 2e-5);
    geometry.computeBoundingBox();
    near(geometry.boundingBox.max.z, thickness, 1e-7);
  } finally { geometry.dispose(); }
}

test("all 32 extreme thickness combinations mate flush with both side walls and preserve closed slots", () => {
  for (let mask = 0; mask < 32; mask++) {
    const t = Object.fromEntries(["bottom", "front", "rear", "left", "right"].map((side, i) => [side, mask & (1 << i) ? 0.06 : 0.03]));
    for (const innerLength of [0.4445, 4.0005]) {
      const width = 1.016 + t.left + t.right, margin = Math.max(t.bottom, t.front, t.rear);
      const length = innerLength + 2 * Math.max(t.front, t.rear) + 2 * margin;
      const height = 0.5 + t.bottom + margin;
      const { layout, base, end, rear, side } = createPanelProfiles(width, length, height, t.bottom, margin, undefined, height + 0.3, t);
      near(layout.innerWidth, 1.016); near(layout.innerLength, innerLength);
      near(height - layout.baseTop, 0.5);
      const slots = side.holes.map(hole => bounds(hole.getPoints()));
      for (const tab of layout.baseTabs) {
        const slot = slots.find(s => Math.abs(s.left - tab.start) < 1e-8 && Math.abs(s.bottom - margin) < 1e-8);
        assert.ok(slot); near(slot.top - slot.bottom, t.bottom); near(slot.right, tab.end);
      }
      for (const [direction, thickness, tabs] of [[-1, t.front, layout.endTabs], [1, t.rear, layout.rearTabs]]) {
        for (const tab of tabs) {
          const center = direction * (innerLength / 2 + thickness / 2);
          const slot = slots.find(s => Math.abs((s.left + s.right) / 2 - center) < 1e-8 && Math.abs(s.bottom - tab.start) < 1e-8);
          assert.ok(slot); near(slot.right - slot.left, thickness); near(slot.top, tab.end);
          assert.ok(slot.left >= -length / 2 + margin - 1e-8 && slot.right <= length / 2 - margin + 1e-8);
        }
      }
      for (const [shape, thickness] of [[base, t.bottom], [end, t.front], [rear, t.rear]]) {
        const b = bounds(shape.getPoints());
        near(b.left, -1.016 / 2 - t.left); near(b.right, 1.016 / 2 + t.right);
        checkExtrusion(shape, thickness);
      }
      checkExtrusion(side, t.left); checkExtrusion(side, t.right);
    }
  }
});

test("mixed cases preserve rack clearance and triangulate with angled rows, feet and accessories", () => {
  for (const angle of [0, 30]) for (const rowAngles of [[0, 0], [40, 0]]) {
    const config = { ...mixed, rows: 2, rowUnits: [1, 3], rowAngles, angle, handle: true, handleMode: "pair", patchBoard: true, patchBoardSide: "both", cableHolder: true, footShape: "sled", flatFeet: true };
    const panels = createCasePanels(config), d = caseDimensions(config);
    near(panels.layout.innerWidth * 100, config.hp * 5.08);
    near(panels.layout.innerLength * 100, rackEnvelope(config).length);
    near(d.width, config.hp * 5.08 + 9);
    near(d.height - rackEnvelope(config).rise - panels.layout.baseTop * 100, config.depth);
    for (const [side, face] of Object.entries(panels.faces)) {
      assert.equal(face.report.empty, false); assert.equal(face.report.error, undefined);
      for (const shape of face.shapes) checkExtrusion(shape, panelThickness(config, side) / 100);
    }
  }
});

test("base vents and mounting clearances use bottom thickness independently of side thickness", () => {
  for (const bottom of [3, 6]) {
    const config = { ...mixed, vents: true, busboard: "compactpwr", panelThicknesses: { ...mixed.panelThicknesses, bottom } };
    const panels = createCasePanels(config);
    const equivalent = createCasePanels({ ...defaultConfiguration, thickness: bottom, vents: true, busboard: "compactpwr" });
    assert.deepEqual(rounded(panels.ventilation.openings), rounded(equivalent.ventilation.openings));
    assert.deepEqual(panels.mountingHoles, equivalent.mountingHoles);
    const changedSides = createCasePanels({ ...config, panelThicknesses: { ...config.panelThicknesses, left: 6, right: 3 } });
    assert.deepEqual(rounded(changedSides.ventilation.openings), rounded(panels.ventilation.openings));
  }
  assert.deepEqual(cableHolderLayout(mixed), cableHolderLayout({ ...defaultConfiguration, thickness: 5 }));
});

test("custom cuts and SVG keep the resolved mixed-thickness outlines", () => {
  const cut = { id: "cut", name: "Square", source: { kind: "svg", fileName: "square.svg" }, polygons: [[[[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5], [-0.5, -0.5]]]], width: 10, x: 0, y: 0, rotation: 0 };
  const config = { ...mixed, cutouts: Object.keys(caseThicknesses(mixed)).map(side => ({ ...cut, id: side, side })) };
  const panels = createCasePanels(config), uncut = createCasePanels(mixed), svg = configurationSvg(config, panels);
  for (const [side, face] of Object.entries(panels.faces)) {
    near(geometryArea(uncut.faces[side].polygons) - geometryArea(face.polygons), 100, 0.01);
    assert.match(svg, new RegExp(`data-part="${side}" data-thickness-mm="${panelThickness(config, side)}"`));
  }
});

test("project round trips preserve overrides, legacy files fall back, and invalid thicknesses reject", () => {
  const project = makeProject("Mixed", "case", { ...initialDesigns, case: mixed }, []);
  assert.deepEqual(parseProject(JSON.stringify(project)).designs.case.panelThicknesses, mixed.panelThicknesses);
  assert.deepEqual(parseProject(JSON.stringify(configurationExport(mixed))).designs.case.panelThicknesses, mixed.panelThicknesses);
  assert.equal(panelThickness(readCase({ ...defaultConfiguration, individualPanelTints: true }), "left"), 5);
  const partial = readCase({ ...mixed, panelThicknesses: { left: 3.5 } });
  assert.equal(panelThickness(partial, "left"), 3.5); assert.equal(panelThickness(partial, "rear"), 5);
  for (const invalid of [0, 7, NaN, Infinity, "4", null]) assert.throws(() => readCase({ ...mixed, panelThicknesses: { left: invalid } }));
  const disabled = { ...mixed, individualPanelTints: false };
  for (const side of Object.keys(mixed.panelThicknesses)) assert.equal(panelThickness(disabled, side), 5);
  const original = createCasePanels({ ...defaultConfiguration, vents: false }), restored = createCasePanels(disabled);
  for (const side of Object.keys(restored.faces)) assert.deepEqual(rounded(restored.faces[side].polygons), rounded(original.faces[side].polygons));
});

test("material switches invalidate cached geometry and thicknesses separate identical-colored stock", () => {
  const cache = geometryInputCache(), active = cache(mixed);
  assert.equal(cache({ ...mixed, tint: { id: "red", color: "#ff0000", label: "Red" } }), active);
  const disabled = cache({ ...mixed, individualPanelTints: false });
  assert.notEqual(disabled, active); assert.equal(panelThickness(disabled, "left"), 5);
  assert.notEqual(cache({ ...mixed, panelThicknesses: { ...mixed.panelThicknesses, left: 4 } }), active);
  const fabrication = caseFabrication(mixed, createCasePanels(mixed));
  const { sheets, unplaced } = packSheets(fabrication.parts, 2000, 2000, 10, true);
  assert.deepEqual(unplaced, []); assert.equal(sheets.length, 4);
  for (const sheet of sheets) {
    for (const part of sheet.parts) assert.equal(part.thickness, sheet.thickness);
    assert.match(stockSvg(sheet, 2000, 2000), new RegExp(`${sheet.thickness} mm`));
  }
});
