import assert from "node:assert/strict";
import test from "node:test";
import { ExtrudeGeometry, ShapeUtils } from "three";
import { loadTypescript } from "./load-typescript.mjs";

const { defaultConfiguration, caseDimensions, configurationExport, rackEnvelope } = await loadTypescript("../lib/configurator.ts");
const { flatFeetLayout } = await loadTypescript("../lib/flat-feet.ts");
const { createCasePanels } = await loadTypescript("../lib/case-panels.ts");
const { caseLift, footFloor } = await loadTypescript("../lib/acrylic-profiles.ts");
const { configurationSvg } = await loadTypescript("../lib/svg-export.ts");
const { parseProject, initialDesigns } = await loadTypescript("../lib/project.ts");
const near = (a, b, epsilon = 1e-7) => assert.ok(Math.abs(a - b) < epsilon, `${a} != ${b}`);

function verifyExtrusion(shape, thickness) {
  const points = shape.extractPoints(24);
  const expected = Math.abs(ShapeUtils.area(points.shape)) - points.holes.reduce((sum, hole) => sum + Math.abs(ShapeUtils.area(hole)), 0);
  const geometry = new ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, curveSegments: 24 });
  try {
    const p = geometry.getAttribute("position");
    assert.ok(p.array.every(Number.isFinite));
    let area = 0;
    for (let i = 0; i < p.count; i += 3) if ([0, 1, 2].every(j => p.getZ(i + j) === 0)) {
      area += Math.abs((p.getX(i + 1) - p.getX(i)) * (p.getY(i + 2) - p.getY(i)) - (p.getY(i + 1) - p.getY(i)) * (p.getX(i + 2) - p.getX(i))) / 2;
    }
    near(area, expected, 2e-5);
  } finally { geometry.dispose(); }
}

test("flat feet remain level and connected across sizes without moving joints or other panels", () => {
  for (const flatFootStyle of ["pads", "arch", "runners"]) for (const flatFootHeight of [8, 30]) for (const thickness of [3, 6]) for (const rowUnits of [[1], [3], [3, 3, 3]]) {
    const config = { ...defaultConfiguration, rowUnits, rows: rowUnits.length, thickness, sideMarginRatio: 1, vents: false, flatFeet: true, flatFootStyle, flatFootHeight };
    const panels = createCasePanels(config), base = createCasePanels({ ...config, flatFeet: false });
    assert.deepEqual(panels.layout, base.layout);
    for (const side of ["front", "rear", "bottom"]) assert.deepEqual(panels.faces[side].original, base.faces[side].original);
    const length = caseDimensions(config).length / 100;
    const lift = caseLift(length, 0, false, flatFootHeight / 100);
    for (const side of ["left", "right"]) {
      const shape = panels.faces[side].shapes[0], outline = shape.getPoints(24);
      assert.equal(panels.faces[side].shapes.length, 1);
      assert.deepEqual(shape.holes.map(h => h.getPoints()), base.faces[side].shapes[0].holes.map(h => h.getPoints()));
      near(Math.min(...outline.map(p => p.y)), -flatFootHeight / 100);
      near(Math.max(...outline.map(p => p.y)), caseDimensions(config).height / 100);
      assert.ok(outline.every(p => p.y + lift >= footFloor - 1e-9));
      for (const sign of [-1, 1]) assert.ok(outline.some(p => sign * p.x > length / 4 && Math.abs(p.y + lift - footFloor) < 1e-9));
      verifyExtrusion(shape, thickness / 100);
    }
  }
});

test("styles have distinct lower outlines and combine with handles, boards and angled rows", () => {
  const outlines = [];
  for (const flatFootStyle of ["pads", "arch", "runners"]) {
    const config = { ...defaultConfiguration, flatFeet: true, flatFootStyle, handle: true, handleMode: "right", patchBoard: true, rows: 2, rowUnits: [3, 3], rowAngles: [35, 0] };
    const panels = createCasePanels(config), feet = flatFeetLayout(config);
    assert.equal(rackEnvelope(config).angled, true);
    for (const side of ["left", "right"]) {
      const shape = panels.faces[side].shapes[0];
      verifyExtrusion(shape, config.thickness / 100);
      near(Math.min(...shape.getPoints().map(p => p.y)) + caseLift(caseDimensions(config).length / 100, 0, true, feet.height / 100), footFloor);
    }
    outlines.push(JSON.stringify(panels.faces.left.shapes[0].getPoints()));
  }
  assert.equal(new Set(outlines).size, 3);
});

test("flat feet export at full size, round-trip settings and leave disabled or tilted geometry unchanged", () => {
  for (const flatFootStyle of ["pads", "arch", "runners"]) {
    const config = { ...defaultConfiguration, flatFeet: true, flatFootStyle, flatFootHeight: 24 };
    const panels = createCasePanels(config), data = configurationExport(config);
    const restored = parseProject(JSON.stringify(data), initialDesigns).designs.case;
    assert.equal(restored.flatFeet, true);
    assert.equal(restored.flatFootStyle, flatFootStyle);
    assert.equal(restored.flatFootHeight, 24);
    assert.equal(data.flatFeet.heightMm, 24);
    assert.equal(data.flatFeet.contactCount, flatFootStyle === "runners" ? 2 : 4);
    assert.equal(data.acrylicParts.totalPanels, 5);
    const svg = configurationSvg(config, panels);
    assert.equal((svg.match(/<g id="panel-/g) ?? []).length, 5);
    const left = svg.match(/<g id="panel-left"[\s\S]*?<\/g>/)[0];
    const ys = [...left.matchAll(/[ML]-?[\d.]+ (-?[\d.]+)/g)].map(match => Number(match[1]));
    near(Math.max(...ys) - Math.min(...ys), caseDimensions(config).height + 24, 0.001);
    const tilted = { ...config, angle: 20 };
    assert.equal(configurationExport(tilted).flatFeet.enabled, false);
    assert.deepEqual(createCasePanels(tilted).faces.left.original, createCasePanels({ ...tilted, flatFeet: false }).faces.left.original);
  }
  const legacy = { ...defaultConfiguration, flatFeet: undefined, flatFootStyle: undefined, flatFootHeight: undefined };
  assert.deepEqual(createCasePanels(legacy).faces.left.original, createCasePanels(defaultConfiguration).faces.left.original);
  assert.equal(flatFeetLayout({ ...legacy, flatFootHeight: NaN }).height, 15);
  assert.equal(flatFeetLayout({ ...legacy, flatFootHeight: 10000 }).height, 30);
  assert.equal(flatFeetLayout({ ...legacy, flatFootHeight: -2 }).height, 8);
});
