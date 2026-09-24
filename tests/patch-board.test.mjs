import assert from "node:assert/strict";
import test from "node:test";
import { ExtrudeGeometry, ShapeUtils } from "three";
import { loadTypescript } from "./load-typescript.mjs";

const { defaultConfiguration, configurationExport } = await loadTypescript("../lib/configurator.ts");
const { patchBoardLayout, patchBoardSides } = await loadTypescript("../lib/patch-board.ts");
const { createCasePanels } = await loadTypescript("../lib/case-panels.ts");
const { configurationSvg } = await loadTypescript("../lib/svg-export.ts");
const { readCase } = await loadTypescript("../lib/project.ts");
const near = (a, b, tolerance = 1e-7) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);

test("patch grids stay centred, evenly spaced and clear of rounded borders at all sizes", () => {
  for (const patchBoardWidth of [100, 160, 240]) for (const patchBoardHeight of [40, 70, 140]) for (const patchBoardSpacing of [12, 15, 24]) {
    const board = patchBoardLayout({ patchBoardWidth, patchBoardHeight, patchBoardSpacing });
    assert.ok(board.holeCount > 0);
    for (let i = 0; i < board.centers.length; i++) {
      const point = board.centers[i];
      assert.ok(Math.abs(point.x) + board.holeDiameter / 2 <= board.width / 2 - 16);
      assert.ok(point.y - board.holeDiameter / 2 >= 16);
      assert.ok(point.y + board.holeDiameter / 2 <= board.height - 16);
      near(point.x, -board.centers.at(-i - 1).x);
      near(point.y, board.height - board.centers.at(-i - 1).y);
      if (i % board.columns) near(point.x - board.centers[i - 1].x, board.spacing);
    }
  }
  assert.deepEqual(patchBoardLayout({ patchBoardWidth: NaN, patchBoardHeight: Infinity }), patchBoardLayout({}));
});

test("selected side sheets contain every circular hole without changing joints or other sheets", () => {
  for (const patchBoardSide of ["left", "right", "both"]) {
    const config = { ...defaultConfiguration, patchBoard: true, patchBoardSide };
    const panels = createCasePanels(config), base = createCasePanels({ ...config, patchBoard: false });
    const board = patchBoardLayout(config);
    assert.deepEqual(panels.layout, base.layout);
    for (const side of ["left", "right", "front", "rear", "bottom"]) {
      if (!patchBoardSides(config).includes(side)) { assert.deepEqual(panels.faces[side].original, base.faces[side].original); continue; }
      const holes = panels.faces[side].shapes[0].holes;
      const originalCount = base.faces[side].shapes[0].holes.length;
      assert.equal(holes.length, originalCount + board.holeCount);
      for (const hole of holes.slice(originalCount)) {
        const points = hole.getPoints(12);
        near((Math.max(...points.map(p => p.x)) - Math.min(...points.map(p => p.x))) * 100, 4);
      }
    }
  }
});

test("boards and handles triangulate together on narrow, wide and angled cases", () => {
  for (const rowUnits of [[1], [3], [3, 3]]) for (const handle of [false, true]) for (const width of [100, 240]) {
    const config = { ...defaultConfiguration, rowUnits, rows: rowUnits.length, rowAngles: [0, 45], angle: 20, footShape: "sled", handle, handleMode: "pair", patchBoard: true, patchBoardSide: "both", patchBoardWidth: width, patchBoardHeight: 40, patchBoardSpacing: 24 };
    const shape = createCasePanels(config).faces.left.shapes[0];
    const points = shape.extractPoints(12);
    const expectedArea = Math.abs(ShapeUtils.area(points.shape)) - points.holes.reduce((sum, hole) => sum + Math.abs(ShapeUtils.area(hole)), 0);
    const geometry = new ExtrudeGeometry(shape, { depth: 0.05, bevelEnabled: false, curveSegments: 12 });
    try {
      const positions = geometry.getAttribute("position");
      assert.ok(positions.array.every(Number.isFinite));
      let area = 0;
      for (let i = 0; i < positions.count; i += 3) {
        if ([0, 1, 2].every(offset => positions.getZ(i + offset) === 0)) {
          area += Math.abs((positions.getX(i + 1) - positions.getX(i)) * (positions.getY(i + 2) - positions.getY(i)) - (positions.getY(i + 1) - positions.getY(i)) * (positions.getX(i + 2) - positions.getX(i))) / 2;
        }
      }
      near(area, expectedArea, 1e-5);
    } finally { geometry.dispose(); }
  }
});

test("legacy projects stay unchanged and board settings round-trip through JSON with all SVG holes", () => {
  const legacy = { ...defaultConfiguration };
  for (const key of Object.keys(legacy).filter(key => key.startsWith("patchBoard"))) delete legacy[key];
  assert.equal(readCase(legacy).patchBoard, false);
  assert.deepEqual(createCasePanels(legacy).faces.left.original, createCasePanels(defaultConfiguration).faces.left.original);
  const config = { ...defaultConfiguration, patchBoard: true, patchBoardSide: "right", patchBoardWidth: 180, patchBoardHeight: 90, patchBoardSpacing: 18 };
  const exported = configurationExport(config);
  assert.deepEqual(readCase(JSON.parse(JSON.stringify(exported.configuration))), readCase(config));
  assert.equal(exported.acrylicParts.totalPanels, 5);
  assert.equal(exported.patchBoard.holesPerSide, patchBoardLayout(config).holeCount);
  assert.deepEqual(exported.patchBoard.sides, ["right"]);
  assert.throws(() => readCase({ ...config, patchBoardSide: "bad" }), /patch cable board side/);
  const panels = createCasePanels(config), svg = configurationSvg(config, panels);
  const right = svg.match(/<g id="panel-right"[\s\S]*?<\/g>/)[0];
  assert.equal((right.match(/M/g) ?? []).length, panels.faces.right.shapes[0].holes.length + 1);
  assert.equal((svg.match(/<g id="panel-/g) ?? []).length, 5);
});
