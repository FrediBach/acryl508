import assert from "node:assert/strict";
import test from "node:test";
import { loadTypescript } from "./load-typescript.mjs";

const { defaultConfiguration, configurationExport } = await loadTypescript("../lib/configurator.ts");
const { createCasePanels } = await loadTypescript("../lib/case-panels.ts");
const { configurationSvg } = await loadTypescript("../lib/svg-export.ts");
const { sinusodaJuice, sinusodaHeaders, sinusodaHoles } = await loadTypescript("../lib/sinusoda.ts");
const config = { ...defaultConfiguration, busboard: "sinusoda", vents: false };
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} ≈ ${expected}`);

test("Juice preserves the specified envelope and counts, with honest estimate provenance", () => {
  const data = configurationExport(config).powerBoard;
  assert.deepEqual([data.width, data.length, data.height], [226, 86, 19]);
  assert.equal(sinusodaHeaders.length, 23);
  assert.equal(sinusodaHoles.length, 28);
  assert.equal(new Set(sinusodaHoles.map(p => `${p.x},${p.y}`)).size, 28);
  assert.equal(data.geometryStatus, "photo-estimate");
  assert.match(data.accuracy, /estimated from Figure 1/);
  assert.equal(data.minimumScrews, 14);
  assert.equal(data.placement.moduleClearance, 51);
});

test("all 28 bottom holes match the board coordinates and diameter at scene scale", () => {
  const panels = createCasePanels(config);
  assert.equal(panels.faces.bottom.shapes[0].holes.length, 28);
  for (const [i, hole] of panels.faces.bottom.shapes[0].holes.entries()) {
    const curve = hole.curves[0];
    near(curve.aX * 100, sinusodaHoles[i].x);
    near(curve.aY * 100, sinusodaHoles[i].y);
    near(curve.xRadius * 200, 3.2);
  }
  const svg = configurationSvg(config, panels);
  const bottom = svg.match(/<g id="panel-bottom"[\s\S]*?<\/g>/)[0];
  assert.equal((bottom.match(/\bM/g) ?? []).length, 29);
  assert.match(svg, /photo-derived estimates/);
  // Top row at +39 mm maps to -39 mm in the exported sheet's SVG coordinates.
  assert.match(bottom, /M104\.6 -39/);
});

test("insufficient width or row length omits the board mounts rather than scaling", () => {
  for (const patch of [{ hp: 44 }, { rows: 1, rowUnits: [1] }, { depth: 20 }]) {
    const small = { ...config, ...patch }, panels = createCasePanels(small);
    assert.equal(panels.powerBoard.fits, false);
    assert.equal(panels.mountingHoles.length, 0);
    assert.equal(panels.faces.bottom.shapes[0].holes.length, 0);
    assert.equal(configurationExport(small).powerBoard.width, 226);
    assert.match(configurationSvg(small, panels), /does not fit; no mounting holes exported/);
  }
  assert.equal(createCasePanels({ ...config, hp: 45, rows: 2, rowUnits: [1, 1] }).powerBoard.fits, true);
  for (const busboard of ["none"]) {
    assert.equal(createCasePanels({ ...config, busboard }).mountingHoles.length, 0);
  }
});

test("all vent styles preserve mounting webs across sheet thicknesses and layouts", () => {
  for (const thickness of [3, 4, 5, 6]) for (const ventStyle of ["long-slits", "short-slits", "round", "hexagonal", "mixed"]) for (const ventLayout of ["aligned", "staggered"]) {
    const panels = createCasePanels({ ...config, vents: true, thickness, ventStyle, ventLayout, ventCoverage: "field", ventDensity: "high" });
    for (const opening of panels.ventilation.openings) for (const point of sinusodaHoles) {
      const separated = Math.abs(opening.x * 100 - point.x) >= opening.width * 50 + sinusodaJuice.holeDiameter / 2 + thickness - 1e-7
        || Math.abs(opening.y * 100 - point.y) >= opening.height * 50 + sinusodaJuice.holeDiameter / 2 + thickness - 1e-7;
      assert.ok(separated, `${ventStyle}, ${thickness} mm: vent overlaps mount web`);
    }
  }
});

test("bottom cutouts near mounting points are flagged including underside mirroring", () => {
  const cutout = { id: "mount-overlap", name: "Square", side: "bottom", source: { kind: "svg", fileName: "square.svg" },
    polygons: [[[[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]]]], width: 10, x: -103, y: 39, rotation: 0 };
  const cut = { ...config, cutouts: [cutout] }, panels = createCasePanels(cut);
  assert.equal(panels.mountingConflicts, 1);
  assert.match(configurationSvg(cut, panels), /WARNING: custom cutouts approach or overlap 1 mounting points/);
});
