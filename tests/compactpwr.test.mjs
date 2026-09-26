import assert from "node:assert/strict";
import test from "node:test";
import { loadTypescript } from "./load-typescript.mjs";
const { busboards, defaultConfiguration, configurationExport, caseDimensions } = await loadTypescript("../lib/configurator.ts");
const { createCasePanels, caseCanExport } = await loadTypescript("../lib/case-panels.ts");
const { configurationSvg } = await loadTypescript("../lib/svg-export.ts");
const { compactPwr, compactPwrHoles, compactPwrHeaders } = await loadTypescript("../lib/compactpwr.ts");
const config = { ...defaultConfiguration, busboard: "compactpwr", vents: false };
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} ≈ ${b}`);

test("CompactPWR selection exports precise published dimensions and estimated mounting provenance", () => {
  assert.equal(busboards.compactpwr, "CompactPWR");
  const data = configurationExport(config);
  assert.equal(data.configuration.busboard, "compactpwr");
  assert.deepEqual([data.powerBoard.width, data.powerBoard.length, data.powerBoard.height], [174, 79, 20]);
  assert.equal(data.powerBoard.geometryStatus, "photo-estimate");
  assert.match(data.powerBoard.accuracy, /estimated from the top photo/);
  assert.match(data.notes.join(" "), /CompactPWR.*photo-derived/);
  assert.match(data.powerBoard.inputModule, /mounting holes on the left side/);
  assert.equal(data.powerBoard.inlet.holePitch, 59);
  assert.equal(data.powerBoard.inlet.holeDiameter, 3.5);
  assert.equal(data.powerBoard.placement.moduleClearance, 50);
  assert.equal(compactPwrHeaders.length, 20);
  assert.equal(compactPwrHeaders.filter(p => p.y > 0).length, 10);
  assert.equal(compactPwrHoles.length, 4);
  assert.equal(new Set(compactPwrHoles.map(p => `${p.x},${p.y}`)).size, 4);
});

test("supplied inlet adds its full-size clearance window and two screws only to the left panel", () => {
  const panels = createCasePanels(config);
  const bare = createCasePanels({ ...config, busboard: "none" });
  assert.equal(panels.inlet.fits, true);
  const left = panels.faces.left.shapes[0];
  assert.equal(left.holes.length, bare.faces.left.shapes[0].holes.length + 3);
  assert.equal(panels.faces.right.shapes[0].holes.length, bare.faces.right.shapes[0].holes.length);
  const [window, a, b] = left.holes.slice(-3);
  const points = window.getPoints();
  near((Math.max(...points.map(p => p.x)) - Math.min(...points.map(p => p.x))) * 100, 45);
  near((Math.max(...points.map(p => p.y)) - Math.min(...points.map(p => p.y))) * 100, 25);
  near((b.curves[0].aX - a.curves[0].aX) * 100, 59);
  near(a.curves[0].xRadius * 200, 3.5);
  near(a.curves[0].aY, b.curves[0].aY);
  const count = svg => (svg.match(/<g id="panel-left"[\s\S]*?<\/g>/)[0].match(/\bM/g) ?? []).length;
  assert.equal(count(configurationSvg(config, panels)), count(configurationSvg({ ...config, busboard: "none" }, bare)) + 3);
  for (const busboard of ["none", "sinusoda", "trolley"]) assert.equal(createCasePanels({ ...config, busboard }).inlet, null);
});

test("inlet fit respects shallow sides, sheet thickness and angled rows without scaling", () => {
  const shallow = createCasePanels({ ...config, depth: 25 });
  assert.equal(shallow.inlet.fits, false);
  assert.match(configurationSvg({ ...config, depth: 25 }, shallow), /Inlet plate does not fit/);
  for (const thickness of [3, 4, 5, 6]) for (const rowAngles of [[0, 0], [45, 0]]) {
    const panels = createCasePanels({ ...config, thickness, rows: 2, rowUnits: [3, 3], rowAngles });
    assert.equal(panels.inlet.fits, true);
    assert.ok(panels.inlet.y - 20 >= panels.layout.baseTop * 100 + thickness - 1e-7);
    assert.equal(caseCanExport(panels), true);
  }
});

test("custom artwork cannot remove the inlet mounting web without blocking fabrication", () => {
  const { inlet } = createCasePanels(config);
  const cutout = { id: "inlet-overlap", name: "Square", side: "left", source: { kind: "svg", fileName: "square.svg" },
    polygons: [[[[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]]]], width: 10,
    x: -inlet.x - 29.5, y: inlet.y - caseDimensions(config).height / 2, rotation: 0 };
  const panels = createCasePanels({ ...config, cutouts: [cutout] });
  assert.equal(caseCanExport(panels), false);
  assert.match(panels.faces.left.report.error, /CompactPWR inlet/);
});

test("four bottom holes preserve the 166 × 69 mm estimated pitch at millimetre scale", () => {
  const panels = createCasePanels(config);
  assert.equal(panels.faces.bottom.shapes[0].holes.length, 4);
  for (const [i, h] of panels.faces.bottom.shapes[0].holes.entries()) {
    near(h.curves[0].aX * 100, compactPwrHoles[i].x);
    near(h.curves[0].aY * 100, compactPwrHoles[i].y);
    near(h.curves[0].xRadius * 200, 3.2);
  }
  near(compactPwrHoles[1].x - compactPwrHoles[0].x, 166);
  near(compactPwrHoles[2].y - compactPwrHoles[0].y, 69);
  const svg = configurationSvg(config, panels);
  const bottom = svg.match(/<g id="panel-bottom"[\s\S]*?<\/g>/)[0];
  assert.equal((bottom.match(/\bM/g) ?? []).length, 5);
  assert.match(bottom, /M84\.6 -34\.5/);
  assert.match(svg, /CompactPWR.*estimated from the top photo/);
});

test("CompactPWR fits from 35 HP and 2U without resizing; switching boards replaces the pattern", () => {
  for (const patch of [{ hp: 34 }, { rows: 1, rowUnits: [1] }, { depth: 24 }]) {
    const small = { ...config, ...patch }, panels = createCasePanels(small);
    assert.equal(panels.powerBoard.fits, false);
    assert.equal(panels.mountingHoles.length, 0);
    assert.equal(panels.faces.bottom.shapes[0].holes.length, 0);
    assert.match(configurationSvg(small, panels), /does not fit; no mounting holes exported/);
    assert.equal(configurationExport(small).powerBoard.width, 174);
  }
  assert.equal(createCasePanels({ ...config, hp: 35, rows: 2, rowUnits: [1, 1], depth: 25 }).powerBoard.fits, true);
  for (const [busboard, count] of [["none", 0], ["sinusoda", 28], ["trolley", 8], ["compactpwr", 4]]) {
    assert.equal(createCasePanels({ ...config, hp: 104, busboard }).mountingHoles.length, count);
  }
});

test("all vent styles retain the full mounting web for CompactPWR", () => {
  for (const thickness of [3, 4, 5, 6]) for (const ventStyle of ["long-slits", "short-slits", "round", "hexagonal", "mixed"]) for (const ventLayout of ["aligned", "staggered"]) {
    const panels = createCasePanels({ ...config, thickness, ventStyle, ventLayout, vents: true, ventCoverage: "field", ventDensity: "high" });
    for (const opening of panels.ventilation.openings) for (const p of panels.mountingHoles) {
      assert.ok(Math.abs(opening.x * 100 - p.x) >= opening.width * 50 + compactPwr.holeDiameter / 2 + thickness - 1e-7
        || Math.abs(opening.y * 100 - p.y) >= opening.height * 50 + compactPwr.holeDiameter / 2 + thickness - 1e-7);
    }
  }
});

test("CompactPWR flags custom cutouts near its corner mounts", () => {
  const cutout = { id: "mount-overlap", name: "Square", side: "bottom", source: { kind: "svg", fileName: "square.svg" },
    polygons: [[[[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]]]], width: 10, x: -83, y: 34.5, rotation: 0 };
  const cut = { ...config, cutouts: [cutout] }, panels = createCasePanels(cut);
  assert.equal(panels.mountingConflicts, 1);
  assert.match(configurationSvg(cut, panels), /WARNING: custom cutouts approach or overlap 1 mounting points/);
  assert.equal(createCasePanels({ ...cut, cutouts: [{ ...cutout, x: 0, y: 0 }] }).mountingConflicts, 0);
});
