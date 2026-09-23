import assert from "node:assert/strict";
import test from "node:test";
import { ExtrudeGeometry, ShapeUtils } from "three";
import { loadTypescript } from "./load-typescript.mjs";

const { createBottomVentLayout } = await loadTypescript("../lib/bottom-vents.ts");
const { defaultVentLayer, ventPresets } = await loadTypescript("../lib/vent-design.ts");
const { defaultConfiguration, configurationExport } = await loadTypescript("../lib/configurator.ts");
const { createCasePanels } = await loadTypescript("../lib/case-panels.ts");
const { configurationSvg } = await loadTypescript("../lib/svg-export.ts");
const epsilon = 1e-8;
const rowsOf = openings => {
  const rows = new Map();
  for (const opening of openings) {
    const key = opening.y.toFixed(8);
    if (!rows.has(key)) rows.set(key, []);
    rows.get(key).push(opening);
  }
  return [...rows.values()];
};

test("staggered full fields offset alternate rows and retain a sparse perforated-sheet layout", () => {
  const options = { layout: "staggered", coverage: "field" };
  const full = createBottomVentLayout(4.3672, 1.3335, "round", "low", options);
  const bands = createBottomVentLayout(4.3672, 1.3335, "round", "low");
  const rows = rowsOf(full.openings);
  assert.ok(rows.length > rowsOf(bands.openings).length);
  assert.equal(rows[1].length, rows[0].length - 1);
  const pitch = rows[0][1].x - rows[0][0].x;
  assert.ok(Math.abs(rows[1][0].x - rows[0][0].x - pitch / 2) < epsilon);
  assert.ok(pitch / rows[0][0].width > 3, "generous spacing relative to the hole diameter");
  const gap = rows[1][0].y - rows[0][0].y;
  assert.ok(Math.abs(gap - pitch * Math.sqrt(3) / 2) < epsilon, "triangular row spacing");
  assert.ok(full.openings.every(opening => opening.shape === "round"));
});

test("mixed shapes alternate predictably by opening, row or column", () => {
  for (const layout of ["aligned", "staggered"]) for (const mix of ["checkerboard", "rows", "columns"]) {
    const result = createBottomVentLayout(4.3672, 1.3335, "mixed", "low", { layout, coverage: "field", mix });
    const rows = rowsOf(result.openings);
    assert.ok(rows.length >= 4);
    rows.forEach((openings, row) => openings.forEach((opening, column) => {
      const parity = mix === "rows" ? row : mix === "columns" ? column : row + column;
      assert.equal(opening.shape, parity % 2 === 0 ? "round" : "short-slits");
      if (opening.shape === "round") assert.equal(opening.height, opening.width);
      else assert.ok(opening.height > opening.width * 2);
    }));
    assert.equal(new Set(result.openings.map(opening => opening.shape)).size, 2);
  }
});

test("staggered and mixed fields preserve borders, centre strip and full webs under effects", () => {
  const designs = [
    ventPresets[1].design, ventPresets[4].design,
    { size: 50, seed: 9, layers: ["size", "shift-x", "shift-y"].map((target, i) => ({ ...defaultVentLayer, target, amount: 100, frequency: 6, phase: i * 90, angle: i * 60 })) },
  ];
  for (const [hp, units, thickness] of [[20, 1, 0.06], [84, 3, 0.05], [168, 9, 0.03], [168, 9, 0.06]]) {
    const width = hp * 0.0508 + thickness * 2, length = units * 0.4445;
    for (const style of ["round", "hexagonal", "mixed", "short-slits", "long-slits"]) for (const coverage of ["bands", "field"]) for (const design of designs) {
      const result = createBottomVentLayout(width, length, style, "high", { thickness, coverage, layout: "staggered", design });
      assert.ok(result.openings.length > 0);
      const sorted = [...result.openings].sort((a, b) => (a.y - a.height / 2) - (b.y - b.height / 2));
      for (let i = 0; i < sorted.length; i++) {
        const a = sorted[i];
        assert.ok([a.x, a.y, a.width, a.height].every(Number.isFinite));
        assert.ok((width - 2 * thickness) / 2 - Math.abs(a.x) - a.width / 2 >= result.edgeMargin - epsilon);
        assert.ok(length / 2 - Math.abs(a.y) - a.height / 2 >= result.edgeMargin - epsilon);
        assert.ok(Math.abs(a.y) - a.height / 2 >= result.minimumWeb / 2 - epsilon);
        for (let j = i + 1; j < sorted.length; j++) {
          const b = sorted[j];
          if (b.y - b.height / 2 >= a.y + a.height / 2 + result.minimumWeb - epsilon) break;
          const dx = Math.abs(a.x - b.x) - (a.width + b.width) / 2;
          const dy = Math.abs(a.y - b.y) - (a.height + b.height) / 2;
          assert.ok(dx >= result.minimumWeb - epsilon || dy >= result.minimumWeb - epsilon, "even staggered neighbours retain a complete web");
        }
      }
    }
  }
});

test("mixed staggered exports reproduce both shapes and honor custom-cut clearance", () => {
  const config = { ...defaultConfiguration, hp: 42, ventStyle: "mixed", ventLayout: "staggered", ventCoverage: "field", ventMix: "rows", ventDesign: ventPresets[1].design, cutouts: [{ id: "cut", name: "Cut", source: { kind: "svg", fileName: "square.svg" }, side: "bottom", polygons: [[[[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]]]], width: 20, x: 30, y: 35, rotation: 0 }] };
  const panels = createCasePanels(config);
  assert.ok(panels.ventilation.omitted > 0);
  assert.equal(panels.faces.bottom.report.error, undefined);
  for (const opening of panels.ventilation.openings) {
    const dx = Math.abs(opening.x + 0.3) - (opening.width + 0.2) / 2;
    const dy = Math.abs(opening.y - 0.35) - (opening.height + 0.2) / 2;
    assert.ok(dx >= 0.05 - epsilon || dy >= 0.05 - epsilon);
  }
  const saved = JSON.parse(JSON.stringify(configurationExport(config))).configuration;
  assert.equal(saved.ventLayout, "staggered");
  assert.equal(saved.ventCoverage, "field");
  assert.equal(saved.ventMix, "rows");
  assert.deepEqual(createCasePanels(saved).ventilation.openings, panels.ventilation.openings);
  const svg = configurationSvg(config, panels).match(/<g id="panel-bottom"[\s\S]*?<\/g>/)[0];
  assert.equal((svg.match(/\bM/g) ?? []).length, panels.faces.bottom.polygons[0].length);
  const shape = panels.faces.bottom.shapes[0], outline = shape.extractPoints(8);
  const expected = Math.abs(ShapeUtils.area(outline.shape)) - outline.holes.reduce((area, hole) => area + Math.abs(ShapeUtils.area(hole)), 0);
  const geometry = new ExtrudeGeometry(shape, { depth: 0.05, bevelEnabled: false, curveSegments: 8 });
  try {
    const p = geometry.attributes.position;
    let area = 0;
    for (let i = 0; i < p.count; i += 3) if ([i, i + 1, i + 2].every(j => p.getZ(j) === 0)) {
      area += Math.abs((p.getX(i + 1) - p.getX(i)) * (p.getY(i + 2) - p.getY(i)) - (p.getY(i + 1) - p.getY(i)) * (p.getX(i + 2) - p.getX(i))) / 2;
    }
    assert.ok(Math.abs(area - expected) < 1e-6);
  } finally { geometry.dispose(); }
  const legacy = { ...defaultConfiguration };
  delete legacy.ventLayout; delete legacy.ventCoverage; delete legacy.ventMix;
  assert.deepEqual(createCasePanels(legacy).ventilation.openings, createCasePanels(defaultConfiguration).ventilation.openings);
});
