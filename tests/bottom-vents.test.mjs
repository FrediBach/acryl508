import assert from "node:assert/strict";
import test from "node:test";
import { ExtrudeGeometry, ShapeUtils } from "three";
import { loadTypescript } from "./load-typescript.mjs";

const { createBottomVents } = await loadTypescript("../lib/bottom-vents.ts");
const { createCasePanels } = await loadTypescript("../lib/case-panels.ts");
const { caseDimensions, configurationExport, defaultConfiguration, ventStyles, ventDensities } = await loadTypescript("../lib/configurator.ts");
const { configurationSvg } = await loadTypescript("../lib/svg-export.ts");
const bounds = path => {
  const points = path.getPoints(16);
  return {
    left: Math.min(...points.map(p => p.x)), right: Math.max(...points.map(p => p.x)),
    bottom: Math.min(...points.map(p => p.y)), top: Math.max(...points.map(p => p.y)),
  };
};

test("all vent patterns stay separate and inside the base across the size range", () => {
  for (const hp of [20, 84, 168]) for (const units of [1, 3, 9]) for (const thickness of [3, 6]) {
    const config = { ...defaultConfiguration, hp, thickness, rows: 1, rowUnits: units === 9 ? [3, 3, 3] : [units] };
    if (units === 9) config.rows = 3;
    const width = caseDimensions(config).width / 100, length = units * 0.4445;
    for (const { value: style } of ventStyles) {
      let previousCount = 0;
      for (const { value: density } of ventDensities) {
        const holes = createBottomVents(width, length, style, density).map(bounds);
        assert.ok(holes.length > previousCount, `${style}: density increases the opening count`);
        previousCount = holes.length;
        for (let i = 0; i < holes.length; i++) {
          const a = holes[i];
          assert.ok(a.left > -hp * 0.0508 / 2 && a.right < hp * 0.0508 / 2, "vents stay clear of side tabs");
          assert.ok(a.bottom > -length / 2 && a.top < length / 2, "vents retain front and rear borders");
          assert.ok(a.top < 0 || a.bottom > 0, "centre strip remains solid");
          for (const b of holes.slice(i + 1)) {
            assert.ok(a.right < b.left || b.right < a.left || a.top < b.bottom || b.top < a.bottom, "openings never overlap or touch");
          }
        }
      }
    }
  }
});

test("vented panels triangulate to the intended material area for every pattern", () => {
  for (const { value: ventStyle } of ventStyles) for (const { value: ventDensity } of ventDensities) {
    const config = { ...defaultConfiguration, hp: 20, rowUnits: [1], ventStyle, ventDensity };
    const shape = createCasePanels(config).faces.bottom.shapes[0];
    const points = shape.extractPoints(8);
    const expected = Math.abs(ShapeUtils.area(points.shape)) - points.holes.reduce((sum, hole) => sum + Math.abs(ShapeUtils.area(hole)), 0);
    const geometry = new ExtrudeGeometry(shape, { depth: config.thickness / 100, bevelEnabled: false, curveSegments: 8 });
    try {
      const positions = geometry.attributes.position;
      assert.ok(positions.array.every(Number.isFinite));
      let area = 0;
      for (let i = 0; i < positions.count; i += 3) {
        if ([i, i + 1, i + 2].every(j => positions.getZ(j) === 0)) {
          area += Math.abs((positions.getX(i + 1) - positions.getX(i)) * (positions.getY(i + 2) - positions.getY(i)) - (positions.getY(i + 1) - positions.getY(i)) * (positions.getX(i + 2) - positions.getX(i))) / 2;
        }
      }
      assert.ok(Math.abs(area - expected) < 1e-6, `${ventStyle}/${ventDensity}: holes remain open`);
    } finally { geometry.dispose(); }
  }
});

test("vent choices reach JSON and SVG, and switching off retains the choices", () => {
  for (const { value: ventStyle } of ventStyles) for (const { value: ventDensity } of ventDensities) {
    const config = { ...defaultConfiguration, ventStyle, ventDensity };
    const panels = createCasePanels(config);
    const svg = configurationSvg(config, panels);
    const bottom = svg.match(/<g id="panel-bottom"[\s\S]*?<\/g>/)[0];
    assert.equal((bottom.match(/\bM/g) ?? []).length, panels.faces.bottom.shapes[0].holes.length + 1);
    const exported = configurationExport(config).configuration;
    assert.equal(exported.ventStyle, ventStyle);
    assert.equal(exported.ventDensity, ventDensity);
    const disabled = { ...config, vents: false };
    assert.equal(createCasePanels(disabled).faces.bottom.shapes[0].holes.length, 0);
    assert.equal(configurationExport(disabled).configuration.ventStyle, ventStyle);
    assert.equal(configurationExport(disabled).configuration.ventDensity, ventDensity);
  }
});

test("legacy configurations retain the original long slits and custom cuts combine with every pattern", () => {
  const legacy = { ...defaultConfiguration };
  delete legacy.ventStyle; delete legacy.ventDensity;
  const legacyHoles = createCasePanels(legacy).faces.bottom.shapes[0].holes;
  const width = caseDimensions(defaultConfiguration).width / 100;
  assert.equal(legacyHoles.length, 2 * Math.floor((width - 0.5) / 0.12));
  const first = bounds(legacyHoles[0]);
  assert.ok(Math.abs(first.right - first.left - 0.034) < 1e-9);
  assert.ok(Math.abs(first.top - first.bottom - (1.3335 * 0.18 + 0.034)) < 1e-9);
  for (const { value: ventStyle } of ventStyles) {
    const config = { ...defaultConfiguration, ventStyle, ventDensity: "high", cutouts: [{
      id: "bottom-cut", name: "Bottom cut", side: "bottom", source: { kind: "svg", fileName: "test.svg" },
      polygons: [[[[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]]]], width: 20, x: 0, y: 35, rotation: 0,
    }] };
    const panel = createCasePanels(config).faces.bottom;
    assert.equal(panel.report.error, undefined);
    assert.equal(panel.report.empty, false);
    assert.equal(panel.shapes.length, 1);
    assert.ok(panel.shapes[0].holes.length > 0);
  }
});
