import assert from "node:assert/strict";
import test from "node:test";
import { Euler, ExtrudeGeometry, ShapeUtils, Vector3 } from "three";
import { loadTypescript } from "./load-typescript.mjs";
const { busboards, defaultConfiguration, configurationExport, caseDimensions } = await loadTypescript("../lib/configurator.ts");
const { createCasePanels, caseCanExport } = await loadTypescript("../lib/case-panels.ts");
const { configurationSvg } = await loadTypescript("../lib/svg-export.ts");
const { compactPwr, compactPwrHoles, compactPwrHeaders } = await loadTypescript("../lib/compactpwr.ts");
const { compactPwrInletPlate, compactPwrInletTransform } = await loadTypescript("../lib/compactpwr-inlet.ts");
const { readCase, parseProject, makeProject, initialDesigns } = await loadTypescript("../lib/project.ts");
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
  assert.equal(data.powerBoard.placement.rotation, 180);
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

test("rear selection relocates all inlet cuts, exports and custom-artwork protection", () => {
  const rearConfig = { ...config, compactPwrInletSide: "rear" };
  const panels = createCasePanels(rearConfig), bare = createCasePanels({ ...config, busboard: "none" });
  assert.equal(panels.inlet.side, "rear");
  assert.equal(panels.inlet.fits, true);
  near(panels.inlet.x, -panels.layout.innerWidth * 50 + 35 + panels.layout.thicknesses.rear * 100);
  assert.ok(panels.inlet.x < 0, "Rear inlet belongs near the case's left side");
  for (const side of ["left", "right", "front", "rear"]) {
    assert.equal(panels.faces[side].shapes[0].holes.length, bare.faces[side].shapes[0].holes.length + (side === "rear" ? 3 : 0));
  }
  assert.match(configurationSvg(rearConfig, panels), /Rear inlet:/);
  assert.equal(configurationExport(rearConfig).powerBoard.inlet.side, "rear");
  const cutout = { id: "rear-inlet", name: "Square", side: "rear", source: { kind: "svg", fileName: "square.svg" },
    polygons: [[[[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]]]], width: 10,
    x: -panels.inlet.x - 29.5, y: panels.inlet.y - caseDimensions(rearConfig).height / 2, rotation: 0 };
  const conflict = createCasePanels({ ...rearConfig, cutouts: [cutout] });
  assert.equal(caseCanExport(conflict), false);
  assert.match(conflict.faces.rear.report.error, /CompactPWR inlet/);
  assert.equal(createCasePanels({ ...rearConfig, depth: 25 }).inlet.fits, false);
});

test("half-turn brings the CompactPWR input toward either inlet and preserves the mount pattern", () => {
  for (const side of ["left", "rear"]) {
    const panels = createCasePanels({ ...config, compactPwrInletSide: side });
    const angle = panels.powerBoard.rotation * Math.PI / 180;
    const rotation = new Euler(0, angle, 0);
    // The preview's input terminal is at PCB-local X=80 mm, Z=0.
    const before = new Vector3(0.8, panels.layout.baseTop + 0.116, 0);
    const after = before.clone().applyEuler(rotation);
    near(after.x, -0.8);
    const inlet = new Vector3(...compactPwrInletTransform(panels.inlet, panels.layout).position);
    assert.ok(after.distanceTo(inlet) < before.distanceTo(inlet));
    for (const { x, y } of compactPwrHoles) {
      const rotated = new Vector3(x, 0, -y).applyEuler(rotation);
      assert.ok(panels.mountingHoles.some(p => Math.hypot(p.x - rotated.x, p.y + rotated.z) < 1e-8));
    }
  }
});

test("inlet selection survives saved projects and legacy cases default to the left", () => {
  const rear = { ...config, compactPwrInletSide: "rear" };
  const project = makeProject("Rear inlet", "case", { ...initialDesigns, case: rear }, []);
  assert.equal(parseProject(JSON.stringify(project)).designs.case.compactPwrInletSide, "rear");
  assert.equal(parseProject(JSON.stringify(configurationExport(rear))).designs.case.compactPwrInletSide, "rear");
  const legacy = { ...config }; delete legacy.compactPwrInletSide;
  assert.equal(readCase(legacy).compactPwrInletSide, "left");
  assert.throws(() => readCase({ ...config, compactPwrInletSide: "bottom" }), /inlet panel/);
});

test("3D inlet screw axes coincide with both panel patterns and follow exploded sheets", () => {
  for (const side of ["left", "rear"]) for (const explode of [0, 0.4]) for (const thickness of [3, 6]) {
    const panels = createCasePanels({ ...config, compactPwrInletSide: side, individualPanelTints: true, panelThicknesses: { left: thickness, rear: thickness } });
    const transform = compactPwrInletTransform(panels.inlet, panels.layout, explode);
    const rotation = new Euler(...transform.rotation), origin = new Vector3(...transform.position);
    const normal = new Vector3(0, 0, 1).applyEuler(rotation);
    near(side === "left" ? normal.x : normal.z, -1);
    const model = [-29.5, 29.5].map(x => new Vector3(x / 100, 0, 0).applyEuler(rotation).add(origin));
    const actual = panels.faces[side].shapes[0].holes.slice(-2).map(hole => {
      const { aX: x, aY: y } = hole.curves[0];
      return side === "left" ? new Vector3(-panels.layout.innerWidth / 2 - thickness / 100 - explode, y, -x)
        : new Vector3(x, y, -panels.layout.innerLength / 2 - thickness / 100 - explode);
    });
    for (const point of model) assert.ok(actual.some(hole => hole.distanceTo(point) < 1e-8));
  }
});

test("3D faceplate retains the dimensioned openings and triangulates without filling them", () => {
  const plate = compactPwrInletPlate(), points = plate.extractPoints(32);
  near(Math.max(...points.shape.map(p => p.x)) - Math.min(...points.shape.map(p => p.x)), 70);
  near(Math.max(...points.shape.map(p => p.y)) - Math.min(...points.shape.map(p => p.y)), 40);
  assert.equal(plate.holes.length, 4);
  const geometry = new ExtrudeGeometry(plate, { depth: 1.5, bevelEnabled: false, curveSegments: 32 });
  const positions = geometry.getAttribute("position");
  assert.ok(positions.array.every(Number.isFinite));
  let capArea = 0;
  for (let i = 0; i < positions.count; i += 3) {
    if ([0, 1, 2].every(j => positions.getZ(i + j) === 0)) {
      const a = new Vector3().fromBufferAttribute(positions, i), b = new Vector3().fromBufferAttribute(positions, i + 1), c = new Vector3().fromBufferAttribute(positions, i + 2);
      capArea += b.sub(a).cross(c.sub(a)).length() / 2;
    }
  }
  const expected = Math.abs(ShapeUtils.area(points.shape)) - points.holes.reduce((sum, hole) => sum + Math.abs(ShapeUtils.area(hole)), 0);
  assert.ok(Math.abs(capArea - expected) < 0.001);
  geometry.dispose();
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
