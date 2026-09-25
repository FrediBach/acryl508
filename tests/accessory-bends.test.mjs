import assert from "node:assert/strict";
import test from "node:test";
import { loadTypescript } from "./load-typescript.mjs";

const { defaultConfiguration, accessoryBendAngles, accessoryBendSpecification, configurationExport, caseDimensions } = await loadTypescript("../lib/configurator.ts");
const { createCasePanels, caseCanExport } = await loadTypescript("../lib/case-panels.ts");
const { bendAllowance, bendPoint, bentHandleTrim } = await loadTypescript("../lib/accessory-bends.ts");
const { bentPanelGeometry, bentPanelEdges } = await loadTypescript("../lib/bent-panel-geometry.ts");
const { panelEdgePoints } = await loadTypescript("../lib/panel-edges.ts");
const { configurationSvg, caseSheetLayout } = await loadTypescript("../lib/svg-export.ts");
const { caseFabrication } = await loadTypescript("../lib/fabrication.ts");
const { readCase } = await loadTypescript("../lib/project.ts");
const near = (a, b, tolerance = 1e-6) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);
const config = { ...defaultConfiguration, vents: false, handle: true, handleMode: "pair", patchBoard: true, patchBoardSide: "both", cableHolder: true };
const top = shape => Math.max(...shape.getPoints().map(p => p.y));

test("legacy and zero-angle sheets remain identical; angle settings survive project and JSON round trips", () => {
  const legacy = { ...config };
  for (const key of ["handleBendAngle", "patchBoardBendAngle", "cableHolderBendAngle"]) delete legacy[key];
  assert.equal(configurationSvg(legacy, createCasePanels(legacy)), configurationSvg(config, createCasePanels(config)));
  const bent = { ...config, handleBendAngle: 25, patchBoardBendAngle: 40, cableHolderBendAngle: 90 };
  assert.deepEqual(readCase(configurationExport(bent).configuration), readCase(bent));
  for (const key of ["handleBendAngle", "patchBoardBendAngle", "cableHolderBendAngle"]) {
    assert.equal(readCase(legacy)[key], 0);
    for (const value of [-1, 91, NaN, Infinity]) assert.throws(() => readCase({ ...bent, [key]: value }));
  }
  assert.equal(accessoryBendAngles({ ...bent, handleBendAngle: 90 }).handle, 50);
  assert.equal(accessoryBendAngles({ ...bent, handleMode: "left", patchBoardSide: "right", handleBendAngle: 90 }).handle, 90);
  assert.deepEqual(accessoryBendSpecification({ ...bent, handle: false, patchBoard: false, cableHolder: false }), []);
});

test("developed profiles add full bend allowance, preserve joints, and keep holes outside heating strips", () => {
  for (const thickness of [3, 5, 6]) for (const angle of [1, 30, 60, 90]) for (const angled of [false, true]) {
    const current = { ...config, thickness, handleBendAngle: angle / 2, patchBoardBendAngle: angle / 2, cableHolderBendAngle: angle,
      ...(angled ? { rows: 3, rowUnits: [3, 3, 3], rowAngles: [0, 30, 30], angle: 20 } : {}) };
    const panels = createCasePanels(current), rim = caseDimensions(current).height / 100;
    assert.deepEqual(panels.layout, createCasePanels({ ...current, handleBendAngle: 0, patchBoardBendAngle: 0, cableHolderBendAngle: 0 }).layout);
    for (const side of ["left", "right", "rear"]) {
      const bends = panels.bends[side], shape = panels.faces[side].shapes[0];
      assert.ok(bends[0].start >= rim + thickness / 100 - 1e-6, "bend clears even the highest angled rim");
      for (const bend of bends) for (const hole of shape.holes) {
        const ys = hole.getPoints().map(p => p.y);
        assert.ok(Math.max(...ys) <= bend.start - bend.clearance + 1e-6 || Math.min(...ys) >= bend.start + bend.length - 1e-6);
      }
      const extra = accessoryBendSpecification(current).filter(b => b.side === side).reduce((sum, b) => sum + b.addedFlatLengthMm / 100, 0);
      near(top(shape), rim + (side === "rear" ? 0.35 : 1.4 - bentHandleTrim(thickness / 100)) + extra);
    }
    assert.ok(caseCanExport(panels));
  }
});

test("quarter-circle forming preserves thickness and neutral-axis arc length and mirrors outward", () => {
  const depth = 0.06, allowance = bendAllowance(90, depth), radius = 2.5 * depth;
  const bends = [{ start: 1, length: allowance.length, angle: allowance.angle }];
  near(allowance.length, radius * Math.PI / 2);
  for (const direction of [-1, 1]) for (const fraction of [0, 0.25, 0.5, 0.75, 1, 2]) {
    const y = 1 + allowance.length * fraction;
    const a = bendPoint(0, y, 0, depth, bends, direction), b = bendPoint(0, y, depth, depth, bends, direction);
    near(Math.hypot(a.y - b.y, a.z - b.z), depth);
    const mid = bendPoint(0, y, depth / 2, depth, bends, direction);
    if (fraction <= 1) near(Math.hypot(mid.y - 1, mid.z - (depth / 2 + direction * radius)), radius);
    else near(mid.y, 1 + radius);
  }
  const first = bends[0], second = { start: first.start + first.length + 0.7, length: first.length, angle: first.angle };
  const gap = bendPoint(0, first.start + first.length + 0.35, depth / 2, depth, [first, second], 1);
  near(gap.y, 1 + radius); near(gap.z, depth / 2 + radius + 0.35);
});

test("lower handle bends retain the grip opening and top rail with a compact two-thickness root", () => {
  for (const thickness of [3, 5, 6]) for (const handleHeight of [50, 70, 110]) for (const rowUnits of [[1], [3], [3, 3]]) {
    const current = { ...config, thickness, handleHeight, rowUnits, rows: rowUnits.length, patchBoard: false, handleBendAngle: 60 };
    const panels = createCasePanels(current), flat = createCasePanels({ ...current, handleBendAngle: 0 });
    const shape = panels.faces.left.shapes[0], straight = flat.faces.left.shapes[0];
    const bend = panels.bends.left[0], rim = caseDimensions(current).height / 100;
    near(bend.start - rim, thickness / 100);
    const opening = shape.holes.at(-1).getPoints(), originalOpening = straight.holes.at(-1).getPoints();
    const lower = Math.min(...opening.map(p => p.y)), upper = Math.max(...opening.map(p => p.y));
    near(lower - bend.start - bend.length, 2 * thickness / 100);
    near(top(shape) - upper, 0.16);
    const shift = opening[0].y - originalOpening[0].y;
    opening.forEach((p, i) => { near(p.x, originalOpening[i].x); near(p.y - shift, originalOpening[i].y); });
    near(top(shape) - top(straight), thickness / 100 + bend.length - (0.2 - 2 * thickness / 100));
    assert.ok(caseCanExport(panels));
  }
});

test("preview tessellates curves and matching edges without mutating the flat exports", () => {
  const current = { ...config, handleBendAngle: 45, patchBoardBendAngle: 45, cableHolderBendAngle: 90,
    panelThicknesses: { left: 3, right: 6, rear: 4 } };
  const panels = createCasePanels(current), svg = configurationSvg(current, panels), stock = caseSheetLayout(panels);
  for (const side of ["left", "right", "rear"]) {
    const depth = current.panelThicknesses[side] / 100, direction = side === "right" ? 1 : -1;
    const shapes = panels.faces[side].shapes;
    const geometry = bentPanelGeometry(shapes, depth, panels.bends[side], direction);
    try {
      assert.ok(geometry.getAttribute("position").array.every(Number.isFinite));
      assert.ok(geometry.getAttribute("normal").array.every(Number.isFinite));
      assert.ok(geometry.boundingBox.max.z - geometry.boundingBox.min.z > depth + 0.2);
      const points = geometry.getAttribute("position");
      const start = panels.bends[side][0].start, length = panels.bends[side][0].length;
      const count = Math.ceil(panels.bends[side][0].angle / (Math.PI / 60));
      const sample = bendPoint(0, start + length * Math.floor(count / 2) / count, 0, depth, panels.bends[side], direction);
      assert.ok(Array.from({ length: points.count }, (_, i) => Math.abs(points.getY(i) - sample.y) + Math.abs(points.getZ(i) - sample.z)).some(d => d < 1e-5), "face has vertices inside the bend, not only at its ends");
      const edges = bentPanelEdges(panelEdgePoints(shapes, depth), depth, panels.bends[side], direction);
      assert.ok(edges.flat().every(Number.isFinite));
      for (const point of edges) for (let axis = 0; axis < 3; axis++) {
        assert.ok(point[axis] >= geometry.boundingBox.min.getComponent(axis) - 1e-5 && point[axis] <= geometry.boundingBox.max.getComponent(axis) + 1e-5);
      }
    } finally { geometry.dispose(); }
  }
  assert.equal(configurationSvg(current, panels), svg);
  assert.deepEqual(caseSheetLayout(panels), stock);
  assert.match(svg, /Flat, unbent cutting profiles/);
  const fabrication = caseFabrication(current, panels);
  assert.deepEqual(fabrication.parts.map(p => p.polygons), stock.parts.map(p => p.item.polygons));
  assert.equal(fabrication.blocked, false);
});

test("custom artwork cannot cut through a bend's solid clearance strip", () => {
  const current = { ...config, cableHolderBendAngle: 90 };
  const base = createCasePanels(current), rim = caseDimensions(current).height / 100;
  const cut = { id: "bend-cut", name: "Square", side: "rear", source: { kind: "svg", fileName: "square.svg" },
    polygons: [[[[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5], [-0.5, -0.5]]]], width: 4, x: 0, y: rim * 50 + 7, rotation: 0 };
  const panels = createCasePanels({ ...current, cutouts: [cut] });
  assert.match(panels.faces.rear.report.error, /bend and clearance/);
  assert.equal(caseCanExport(panels), false);
  assert.throws(() => configurationSvg(current, panels));
  assert.equal(caseCanExport(createCasePanels({ ...current, cutouts: [{ ...cut, y: 0 }] })), true);
  assert.equal(caseCanExport(createCasePanels({ ...current, cutouts: [{ ...cut, width: 2, y: rim * 50 - 4 }] })), true, "shorter clearance does not reserve the old margin below the rim");
  assert.equal(caseCanExport(base), true);
});
