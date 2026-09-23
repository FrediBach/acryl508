import assert from "node:assert/strict";
import test from "node:test";
import { ExtrudeGeometry, ShapeUtils } from "three";
import { loadTypescript } from "./load-typescript.mjs";

const { caseLift, createSideProfile, footFloor, handleRise } = await loadTypescript("../lib/acrylic-profiles.ts");
const { createPanelProfiles } = await loadTypescript("../lib/panel-joints.ts");
const { createCasePanels } = await loadTypescript("../lib/case-panels.ts");
const { caseDimensions, defaultConfiguration, handleCount } = await loadTypescript("../lib/configurator.ts");
const near = (actual, expected, epsilon = 1e-8) => assert.ok(Math.abs(actual - expected) < epsilon, `${actual} != ${expected}`);

function checkExtrusion(profile, thickness) {
  const points = profile.extractPoints(24);
  const area = Math.abs(ShapeUtils.area(points.shape)) - points.holes.reduce((sum, hole) => sum + Math.abs(ShapeUtils.area(hole)), 0);
  const geometry = new ExtrudeGeometry(profile, { depth: thickness, bevelEnabled: false, curveSegments: 24 });
  try {
    const positions = geometry.getAttribute("position");
    assert.ok(positions.array.every(Number.isFinite));
    let capArea = 0;
    for (let i = 0; i < positions.count; i += 3) {
      if ([0, 1, 2].every(offset => positions.getZ(i + offset) === 0)) {
        const ax = positions.getX(i), ay = positions.getY(i);
        const bx = positions.getX(i + 1), by = positions.getY(i + 1);
        const cx = positions.getX(i + 2), cy = positions.getY(i + 2);
        capArea += Math.abs((bx - ax) * (cy - ay) - (by - ay) * (cx - ax)) / 2;
      }
    }
    near(capArea, area, 1e-5);
    geometry.computeBoundingBox();
    near(geometry.boundingBox.max.z, thickness);
    near(geometry.boundingBox.min.z, 0);
  } finally { geometry.dispose(); }
}

test("integrated sides sit level, preserve joints and triangulate with open grips at every stance", () => {
  for (const units of [1, 3, 9]) for (const angle of [0, 10, 20, 30]) for (const thickness of [0.03, 0.06]) for (const ratio of [1, 2]) {
    const length = units * 0.4445 + 2 * thickness * (1 + ratio), height = 0.5 + thickness * (1 + ratio);
    const { side } = createPanelProfiles(4.4, length, height, thickness, ratio * thickness);
    for (const style of ["wedge", "arch", "sled"]) for (const handle of [false, true]) {
      const profile = createSideProfile(side, length, height, thickness, angle, style, handle);
      const { shape, holes } = profile.extractPoints(24);
      const worldY = point => caseLift(length, angle) + point.y * Math.cos(angle * Math.PI / 180) + point.x * Math.sin(angle * Math.PI / 180);
      assert.ok(shape.every(point => worldY(point) >= footFloor - 1e-9));
      if (angle) assert.ok(shape.filter(point => Math.abs(worldY(point) - footFloor) < 1e-9).length >= 2);
      else assert.ok(shape.every(point => point.y >= 0));
      near(Math.max(...shape.map(point => point.y)), height + (handle ? handleRise : 0));
      side.holes.forEach((hole, index) => assert.deepEqual(holes[index], hole.getPoints(24)));
      if (handle) {
        const grip = holes[side.holes.length];
        assert.ok(Math.min(...grip.map(point => point.y)) > height);
        assert.ok(Math.max(...grip.map(point => point.x)) - Math.min(...grip.map(point => point.x)) >= 0.98 - 1e-9);
        near(Math.max(...grip.map(point => point.y)) - Math.min(...grip.map(point => point.y)), 0.34);
      }
      checkExtrusion(profile, thickness);
    }
  }
});

test("arch and sled remove stance material without cutting into the enclosure", () => {
  const { side } = createPanelProfiles(4.4, 3, 0.9, 0.05);
  const profiles = Object.fromEntries(["wedge", "arch", "sled"].map(style => [style, createSideProfile(side, 3, 0.9, 0.05, 20, style, false)]));
  const area = profile => {
    const { shape, holes } = profile.extractPoints(24);
    return Math.abs(ShapeUtils.area(shape)) - holes.reduce((sum, hole) => sum + Math.abs(ShapeUtils.area(hole)), 0);
  };
  assert.ok(area(profiles.arch) < area(profiles.wedge));
  assert.ok(area(profiles.sled) < area(profiles.wedge));
  assert.ok(profiles.sled.holes.at(-1).getPoints().every(point => point.y <= -0.05));
});

test("automatic and explicit handle layouts shape only the selected sides without accessory holes", () => {
  for (const hp of [20, 84, 85, 168]) for (const rowUnits of [[1], [3], [3, 3]]) for (const handleMode of [undefined, "auto", "single", "pair"]) for (const handle of [false, true]) {
    const config = { ...defaultConfiguration, hp, rows: rowUnits.length, rowUnits, handleMode, handle, angle: 20, vents: false };
    const count = !handle ? 0 : handleMode === "single" ? 1 : handleMode === "pair" ? 2 : hp > 84 || rowUnits.length === 2 ? 2 : 1;
    assert.equal(handleCount(config), count);
    const panels = createCasePanels(config), height = caseDimensions(config).height / 100;
    for (const [side, hasHandle] of [["left", count > 0], ["right", count === 2]]) {
      const shape = panels.faces[side].shapes[0];
      near(Math.max(...shape.getPoints().map(point => point.y)), height + (hasHandle ? handleRise : 0));
      assert.equal(shape.holes.length, panels.layout.baseTabs.length + 2 * panels.layout.endTabs.length + rowUnits.length * 2 + Number(hasHandle));
    }
    assert.equal(panels.faces.rear.shapes[0].holes.length, 0);
  }
});
