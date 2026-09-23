import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { ExtrudeGeometry, ShapeUtils } from "three";
import ts from "typescript";

const source = await readFile(new URL("../lib/acrylic-profiles.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText.replace('"three"', JSON.stringify(import.meta.resolve("three")));
const { caseLift, createFootProfile, createHandleProfile, footFloor, handleLayout, handleRise, handleOverlap } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

function extrude(profile, thickness) {
  const geometry = new ExtrudeGeometry(profile, { depth: thickness, bevelEnabled: false, curveSegments: 24 });
  try {
    assert.ok(geometry.getAttribute("position").count > 0);
    assert.ok(geometry.getAttribute("position").array.every(Number.isFinite));
    geometry.computeBoundingBox();
    assert.ok(Math.abs(geometry.boundingBox.max.z - thickness) < 1e-7);
    assert.equal(geometry.boundingBox.min.z, 0);
  } finally { geometry.dispose(); }
}

test("all foot profiles meet the tilted case and stay above the floor at every stance and sheet thickness", () => {
  for (const rows of [1, 2, 3]) for (const angle of [10, 20, 30]) for (const thickness of [0.03, 0.04, 0.05, 0.06]) {
    const length = rows * 1.3335 + 2 * thickness;
    const radians = angle * Math.PI / 180;
    const half = length * Math.cos(radians) * 0.43;
    const top = x => caseLift(length, angle) - footFloor + x * Math.tan(radians);
    const areas = {};
    for (const style of ["wedge", "arch", "sled"]) {
      const profile = createFootProfile(length, angle, thickness, style);
      const { shape, holes } = profile.extractPoints(24);
      for (const point of [...shape, ...holes.flat()]) {
        assert.ok(point.y >= -1e-9);
        assert.ok(point.y <= top(point.x) + 1e-9);
      }
      for (const x of [-half, half]) assert.ok(shape.some(point => Math.abs(point.x - x) < 1e-9 && Math.abs(point.y - top(x)) < 1e-9));
      areas[style] = Math.abs(ShapeUtils.area(shape)) - holes.reduce((total, hole) => total + Math.abs(ShapeUtils.area(hole)), 0);
      assert.ok(areas[style] > 0);
      assert.equal(holes.length, style === "sled" ? 1 : 0);
      extrude(profile, thickness);
    }
    assert.ok(areas.arch < areas.wedge);
    assert.ok(areas.sled < areas.wedge);
    assert.notEqual(areas.arch, areas.sled);
  }
});

test("handle fits the narrowest case, retains an open grip, and uses the selected sheet thickness", () => {
  for (const hp of [20, 84, 168]) for (const thickness of [0.03, 0.04, 0.05, 0.06]) {
    const innerWidth = hp * 0.0508;
    const profile = createHandleProfile(innerWidth);
    const { width, mountX, mountY } = handleLayout(innerWidth);
    const { shape, holes } = profile.extractPoints(24);
    assert.ok(width < innerWidth);
    assert.equal(holes.length, 3);
    assert.ok(Math.abs(Math.max(...shape.map(point => point.y)) - handleRise) < 1e-9);
    assert.ok(Math.abs(Math.min(...shape.map(point => point.y)) + handleOverlap) < 1e-9);
    assert.ok(Math.min(...holes[0].map(point => point.y)) > 0, "hand opening clears the case rim");
    for (const point of holes.flat()) {
      assert.ok(Math.abs(point.x) < width / 2);
      assert.ok(point.y > -handleOverlap && point.y < handleRise);
    }
    assert.ok(mountX > 0 && mountX < width / 2);
    assert.ok(mountY < 0 && mountY > -handleOverlap);
    extrude(profile, thickness);
  }
});
