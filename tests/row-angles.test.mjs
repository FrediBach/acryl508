import assert from "node:assert/strict";
import test from "node:test";
import { ExtrudeGeometry, ShapeUtils } from "three";
import { loadTypescript } from "./load-typescript.mjs";

const { defaultConfiguration, rackRowAngles, rackRowLayout, rackRowPoint, rackEnvelope, caseDimensions, configurationExport, sidePanelMargin } = await loadTypescript("../lib/configurator.ts");
const { createCasePanels } = await loadTypescript("../lib/case-panels.ts");
const { caseLift, footFloor } = await loadTypescript("../lib/acrylic-profiles.ts");
const { configurationSvg } = await loadTypescript("../lib/svg-export.ts");
const near = (a, b, epsilon = 1e-8) => assert.ok(Math.abs(a - b) < epsilon, `${a} != ${b}`);
const configFor = (rowUnits, rowAngles, extra = {}) => ({ ...defaultConfiguration, rows: rowUnits.length, rowUnits, rowAngles, vents: false, ...extra });

function verifyExtrusion(shape, thickness) {
  const points = shape.extractPoints(24);
  const area = Math.abs(ShapeUtils.area(points.shape)) - points.holes.reduce((sum, hole) => sum + Math.abs(ShapeUtils.area(hole)), 0);
  const geometry = new ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, curveSegments: 24 });
  try {
    const positions = geometry.getAttribute("position");
    assert.ok(positions.array.every(Number.isFinite));
    let cap = 0;
    for (let i = 0; i < positions.count; i += 3) {
      if ([0, 1, 2].every(offset => positions.getZ(i + offset) === 0)) {
        const ax = positions.getX(i), ay = positions.getY(i), bx = positions.getX(i + 1), by = positions.getY(i + 1), cx = positions.getX(i + 2), cy = positions.getY(i + 2);
        cap += Math.abs((bx - ax) * (cy - ay) - (by - ay) * (cx - ax)) / 2;
      }
    }
    near(cap, area, 2e-5);
  } finally { geometry.dispose(); }
}

test("row increments accumulate toward the rear and preserve standard rail pitch", () => {
  const config = configFor([3, 1, 3], [25, 15, 0], { angle: 10 });
  const rows = rackRowLayout(config);
  assert.deepEqual(rows.map(row => row.angle), [40, 15, 0]);
  for (const row of rows) {
    const a = rackRowPoint(row, -row.railOffset, -7), b = rackRowPoint(row, row.railOffset, -7);
    near(Math.hypot(a.z - b.z, a.y - b.y), row.length - 10.85);
  }
  for (let index = 0; index < rows.length - 1; index++) {
    const rear = rackRowPoint(rows[index], rows[index].length / 2);
    const front = rackRowPoint(rows[index + 1], -rows[index + 1].length / 2);
    near(Math.hypot(rear.z - front.z, rear.y - front.y), rows[index].gap);
    near(rows[index].gap, (10 + 14 * Math.tan(rows[index].increment * Math.PI / 360)) / 3);
  }
  assert.ok(rackEnvelope(config).rise > 0);
  near(caseDimensions(config).height, config.depth + config.thickness + sidePanelMargin(config) + rackEnvelope(config).rise);
});

test("legacy, zero, invalid and excessive increments remain bounded", () => {
  assert.deepEqual(rackRowAngles(configFor([3, 3, 3], undefined)), [0, 0, 0]);
  assert.deepEqual(rackRowAngles(configFor([3, 3, 3], [60, 60, 99], { angle: 30 })), [0, 45, 0]);
  assert.deepEqual(rackRowAngles(configFor([1, 1, 1, 1], [NaN, -10, Infinity, 0])), [0, 0, 0, 0]);
  assert.equal(rackEnvelope(configFor([3], [60])).angled, false);
  assert.deepEqual(caseDimensions(configFor([3, 1], [0, 0])), caseDimensions(configFor([3, 1], undefined)));
});

test("sloped panels retain rail holes, mating end tabs, level feet and valid triangulation", () => {
  for (const rowUnits of [[3, 3], [1, 3, 1], [3, 3, 3], [1, 1, 1, 1, 1, 1, 1, 1, 1]]) {
    for (const increment of [1, 20, 60]) for (const angle of [0, 30]) for (const thickness of [3, 6]) for (const handle of [false, true]) {
      const config = configFor(rowUnits, rowUnits.map(() => increment), { angle, thickness, handle, handleMode: "pair", footShape: "arch", sideMarginRatio: 1 });
      const panels = createCasePanels(config), dimensions = caseDimensions(config), rows = rackRowLayout(config);
      const side = panels.faces.right.shapes[0];
      const railHoles = side.holes.slice(panels.layout.baseTabs.length + panels.layout.endTabs.length + panels.layout.rearTabs.length, -Number(handle) || undefined);
      assert.equal(railHoles.length, 2 * rows.length);
      let index = 0;
      for (const row of rows) for (const end of [-1, 1]) {
        const center = rackRowPoint(row, end * row.railOffset, -7);
        const arc = railHoles[index++].curves[0];
        near(arc.aX, -center.z / 100);
        near(arc.aY, (config.depth + thickness + sidePanelMargin(config) + center.y) / 100);
      }
      const radians = angle * Math.PI / 180;
      const worldY = p => caseLift(dimensions.length / 100, angle, true) + p.y * Math.cos(radians) + p.x * Math.sin(radians);
      const outline = side.getPoints(24);
      assert.ok(outline.every(p => worldY(p) >= footFloor - 1e-9));
      assert.ok(outline.filter(p => Math.abs(worldY(p) - footFloor) < 1e-9).length >= 4, "front and rear feet contact the table");
      near(Math.max(...panels.faces.rear.shapes[0].getPoints().map(p => p.y)), dimensions.height / 100);
      near(Math.max(...panels.faces.front.shapes[0].getPoints().map(p => p.y)), (config.depth + thickness + sidePanelMargin(config)) / 100);
      for (const [sign, tabs] of [[-1, panels.layout.endTabs], [1, panels.layout.rearTabs]]) for (const tab of tabs) {
        assert.ok(side.holes.some(hole => {
          const points = hole.getPoints();
          return Math.abs(Math.min(...points.map(p => p.x)) - (sign * panels.layout.endCenter - thickness / 200)) < 1e-8 && Math.abs(Math.min(...points.map(p => p.y)) - tab.start) < 1e-8;
        }));
      }
      for (const face of Object.values(panels.faces)) face.shapes.forEach(shape => verifyExtrusion(shape, thickness / 100));
    }
  }
});

test("JSON, SVG and power-board fit use the same angled enclosure", () => {
  const config = configFor([3, 3], [45, 0], { busboard: "compactpwr", cableHolder: true, handle: true });
  const panels = createCasePanels(config), exported = configurationExport(config);
  assert.deepEqual(exported.rowLayout.rows, rackRowLayout(config));
  assert.equal(exported.rowLayout.automaticFeet, true);
  assert.deepEqual(exported.powerBoard.placement, panels.powerBoard);
  assert.equal(exported.acrylicParts.totalPanels, 5);
  const svg = configurationSvg(config, panels);
  assert.equal((svg.match(/data-part=/g) ?? []).length, 5);
  assert.ok(!/NaN|Infinity/.test(svg));
  assert.notEqual(svg, configurationSvg({ ...config, rowAngles: [0, 0] }, createCasePanels({ ...config, rowAngles: [0, 0] })));
});
