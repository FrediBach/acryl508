import assert from "node:assert/strict";
import test from "node:test";
import { ExtrudeGeometry, ShapeUtils } from "three";
import { loadTypescript } from "./load-typescript.mjs";

const { defaultConfiguration, caseDimensions, configurationExport } = await loadTypescript("../lib/configurator.ts");
const { cableHolderLayout } = await loadTypescript("../lib/cable-holder.ts");
const { createCasePanels } = await loadTypescript("../lib/case-panels.ts");
const { configurationSvg } = await loadTypescript("../lib/svg-export.ts");
const near = (a, b, tolerance = 1e-7) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);

function intersections(shape, y) {
  const points = shape.getPoints(32), xs = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    if ((a.y > y) !== (b.y > y)) xs.push(a.x + (y - a.y) * (b.x - a.x) / (b.y - a.y));
  }
  return xs.sort((a, b) => a - b);
}

test("rear fingers and open slits stay equal and symmetric across case widths and holder sizes", () => {
  for (const hp of [20, 21, 42, 84, 168]) for (const thickness of [3, 6]) for (const cableHolderSlitWidth of [3, 5, 8]) for (const cableHolderHeight of [20, 70]) {
    const config = { ...defaultConfiguration, hp, thickness, vents: false, cableHolder: true, cableHolderSlitWidth, cableHolderHeight };
    const layout = cableHolderLayout(config), panels = createCasePanels(config);
    const rear = panels.faces.rear.shapes[0], rim = caseDimensions(config).height / 100;
    assert.equal(panels.faces.rear.shapes.length, 1);
    assert.equal(rear.holes.length, 0, "slots belong to the perimeter and remain open");
    near(Math.max(...rear.getPoints().map(p => p.y)), rim + cableHolderHeight / 100);
    const xs = intersections(rear, rim + (layout.rootHeight + cableHolderSlitWidth + 1) / 100);
    assert.equal(xs.length, layout.fingerCount * 2);
    assert.ok(layout.fingerWidth >= 14);
    for (let i = 0; i < xs.length; i += 2) {
      near((xs[i + 1] - xs[i]) * 100, layout.fingerWidth);
      near(xs[i], -xs.at(-i - 1));
      if (i + 2 < xs.length) near((xs[i + 2] - xs[i + 1]) * 100, cableHolderSlitWidth);
    }
    assert.equal(intersections(rear, rim + (layout.rootHeight - 1) / 100).length, 2, "continuous material joins every finger above the rim");
    for (const side of ["front", "left", "right"]) assert.ok(Math.max(...panels.faces[side].shapes[0].getPoints().map(p => p.y)) <= rim + 1e-8);
  }
});

test("extended rear sheet triangulates with no material across its open slits", () => {
  const config = { ...defaultConfiguration, hp: 20, thickness: 6, cableHolder: true, cableHolderHeight: 70, cableHolderSlitWidth: 8 };
  const shape = createCasePanels(config).faces.rear.shapes[0];
  const expectedArea = Math.abs(ShapeUtils.area(shape.extractPoints(12).shape));
  const geometry = new ExtrudeGeometry(shape, { depth: 0.06, bevelEnabled: false, curveSegments: 12 });
  try {
    const positions = geometry.getAttribute("position");
    assert.ok(positions.array.every(Number.isFinite));
    let area = 0;
    for (let i = 0; i < positions.count; i += 3) {
      if ([0, 1, 2].every(offset => positions.getZ(i + offset) === 0)) {
        area += Math.abs((positions.getX(i + 1) - positions.getX(i)) * (positions.getY(i + 2) - positions.getY(i)) - (positions.getY(i + 1) - positions.getY(i)) * (positions.getX(i + 2) - positions.getX(i))) / 2;
      }
    }
    near(area, expectedArea, 1e-6);
  } finally { geometry.dispose(); }
});

test("legacy and disabled holders keep original panels; JSON and SVG include the enabled rear extension", () => {
  const legacy = { ...defaultConfiguration, cableHolder: undefined, cableHolderHeight: undefined, cableHolderSlitWidth: undefined };
  const base = createCasePanels(legacy);
  assert.deepEqual(base.faces.rear.original, createCasePanels(defaultConfiguration).faces.rear.original);
  const config = { ...defaultConfiguration, cableHolder: true, cableHolderHeight: 50, cableHolderSlitWidth: 4 };
  const panels = createCasePanels(config), data = configurationExport(config);
  for (const side of ["front", "left", "right", "bottom"]) assert.deepEqual(panels.faces[side].original, base.faces[side].original);
  assert.equal(data.acrylicParts.totalPanels, 5);
  assert.equal(data.cableHolder.heightMm, 50);
  assert.equal(data.cableHolder.slitWidthMm, 4);
  assert.equal(data.cableHolder.slitCount, cableHolderLayout(config).slitCount);
  assert.equal(configurationExport(legacy).cableHolder.enabled, false);
  const svg = configurationSvg(config, panels);
  const rear = svg.match(/<g id="panel-rear"[\s\S]*?<\/g>/)[0];
  const ys = [...rear.matchAll(/[ML]-?[\d.]+ (-?[\d.]+)/g)].map(match => Number(match[1]));
  near(Math.max(...ys) - Math.min(...ys), caseDimensions(config).height + 50, 0.001);
  assert.equal((svg.match(/<g id="panel-/g) ?? []).length, 5);
  assert.deepEqual(cableHolderLayout({ ...legacy, cableHolderHeight: NaN, cableHolderSlitWidth: Infinity }), cableHolderLayout(legacy));
});

test("rear custom cuts preserve the holder and original joint positions", () => {
  const config = { ...defaultConfiguration, cableHolder: true, cutouts: [{
    id: "rear-square", name: "Square", side: "rear", source: { kind: "svg", fileName: "square.svg" },
    polygons: [[[[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]]]], width: 20, x: 0, y: 0, rotation: 0,
  }] };
  const panels = createCasePanels(config), base = createCasePanels({ ...config, cableHolder: false });
  assert.deepEqual(panels.layout, base.layout);
  assert.equal(panels.faces.rear.shapes.length, 1);
  assert.equal(panels.faces.rear.shapes[0].holes.length, 1);
  near(Math.max(...panels.faces.rear.shapes[0].getPoints().map(p => p.y)), (caseDimensions(config).height + 35) / 100);
});
