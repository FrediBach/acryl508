import assert from "node:assert/strict";
import test from "node:test";
import { loadTypescript } from "./load-typescript.mjs";
const { defaultConfiguration, configurationExport } = await loadTypescript("../lib/configurator.ts");
const { createCasePanels } = await loadTypescript("../lib/case-panels.ts");
const { configurationSvg } = await loadTypescript("../lib/svg-export.ts");
const { trolleyBus, trolleyHoles, trolleyHeaders, trolleyCover } = await loadTypescript("../lib/trolley.ts");
const config = { ...defaultConfiguration, hp: 104, busboard: "trolley", vents: false };
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} ≈ ${b}`);

test("Trolley retains both published widths and the eight-mount screw adaptation", () => {
  const data = configurationExport(config).powerBoard;
  assert.deepEqual([data.width, data.length, data.height, data.lowProfileHeight], [423, 80, 25, 15]);
  assert.equal(data.installationWidth, 435);
  assert.equal(data.geometryStatus, "photo-estimate");
  assert.match(data.accuracy, /inferred/);
  assert.match(data.mounting, /adhesive/);
  assert.equal(data.placement.x, -6);
  assert.equal(data.placement.moduleClearance, 45);
  assert.equal(trolleyHeaders.length, 28);
  assert.equal(trolleyHeaders.filter(p => p.y > 0).length, 14);
  assert.equal(trolleyHoles.length, 8);
  assert.equal(new Set(trolleyHoles.map(p => `${p.x},${p.y}`)).size, 8);
  for (const x of trolleyCover.screwXs) assert.ok(!trolleyHoles.some(p => p.x === x && p.y === 0));
});

test("bottom mounts translate with the PCB and preserve its asymmetric spacing in SVG", () => {
  const panels = createCasePanels(config), data = configurationExport(config).powerBoard;
  assert.equal(panels.mountingHoles.length, 8);
  for (const [i, h] of panels.faces.bottom.shapes[0].holes.entries()) {
    near(h.curves[0].aX * 100, trolleyHoles[i].x - 6);
    near(h.curves[0].aY * 100, trolleyHoles[i].y);
    near(h.curves[0].xRadius * 200, 3.2);
    near(data.mountingHoleCentersMm[i].x, h.curves[0].aX * 100);
  }
  const svg = configurationSvg(config, panels);
  const bottom = svg.match(/<g id="panel-bottom"[\s\S]*?<\/g>/)[0];
  assert.equal((bottom.match(/\bM/g) ?? []).length, 9);
  assert.match(bottom, /M-211\.9 -24/);
  assert.match(svg, /Cover screws are not case mounts/);
  assert.match(svg, /435 mm/);
});

test("fit includes the projecting connector; no board scaling or holes in undersized cases", () => {
  for (const patch of [{ hp: 84 }, { hp: 85 }, { rows: 1, rowUnits: [1] }, { depth: 29 }]) {
    const small = { ...config, ...patch }, panels = createCasePanels(small);
    assert.equal(panels.powerBoard.fits, false);
    assert.equal(panels.mountingHoles.length, 0);
    assert.equal(panels.faces.bottom.shapes[0].holes.length, 0);
    assert.match(configurationSvg(small, panels), /does not fit; no mounting holes exported/);
  }
  assert.equal(createCasePanels({ ...config, hp: 86, rows: 2, rowUnits: [1, 1], depth: 30 }).powerBoard.fits, true);
});

test("Trolley vents keep a complete web around all eight translated mounting points", () => {
  for (const thickness of [3, 4, 5, 6]) for (const ventStyle of ["long-slits", "short-slits", "round", "hexagonal", "mixed"]) for (const ventLayout of ["aligned", "staggered"]) {
    const panels = createCasePanels({ ...config, thickness, ventStyle, ventLayout, vents: true, ventCoverage: "field", ventDensity: "high" });
    for (const opening of panels.ventilation.openings) for (const p of panels.mountingHoles) {
      assert.ok(Math.abs(opening.x * 100 - p.x) >= opening.width * 50 + trolleyBus.holeDiameter / 2 + thickness - 1e-7
        || Math.abs(opening.y * 100 - p.y) >= opening.height * 50 + trolleyBus.holeDiameter / 2 + thickness - 1e-7);
    }
  }
});

test("asymmetric mounts use underside coordinates for custom-cutout warnings", () => {
  const cutout = { id: "mount-overlap", name: "Square", side: "bottom", source: { kind: "svg", fileName: "square.svg" },
    polygons: [[[[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]]]], width: 10, x: 125, y: 24, rotation: 0 };
  const cut = { ...config, cutouts: [cutout] }, panels = createCasePanels(cut);
  assert.equal(panels.mountingConflicts, 1);
  assert.match(configurationSvg(cut, panels), /WARNING: custom cutouts approach or overlap 1 mounting points/);
  assert.equal(createCasePanels({ ...cut, cutouts: [{ ...cutout, x: -125 }] }).mountingConflicts, 0);
  const none = createCasePanels({ ...config, busboard: "none" });
  assert.equal(none.powerBoard, null);
  assert.equal(none.mountingHoles.length, 0);
});
