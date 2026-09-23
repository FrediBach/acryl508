import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { ExtrudeGeometry, ShapeUtils, Vector2 } from "three";
import ts from "typescript";

const source = await readFile(new URL("../lib/acrylic-profiles.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText.replace('"three"', JSON.stringify(import.meta.resolve("three")));
const { caseLift, createFootProfile, createHandleProfile, footFloor, footHoleRadius, footMountLayout, handleLayout, handleRise, handleOverlap } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

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

test("all foot profiles overlap the tilted case and stay above the floor at every stance and sheet thickness", () => {
  for (const rows of [1, 2, 3]) for (const angle of [10, 20, 30]) for (const thickness of [0.03, 0.04, 0.05, 0.06]) {
    const length = rows * 1.3335 + 6 * thickness;
    const radians = angle * Math.PI / 180;
    const half = length * Math.cos(radians) * 0.43;
    const top = x => caseLift(length, angle) - footFloor + x * Math.tan(radians);
    const areas = {};
    for (const style of ["wedge", "arch", "sled"]) {
      const profile = createFootProfile(length, angle, thickness, style);
      const { shape, holes } = profile.extractPoints(24);
      for (const point of [...shape, ...holes.flat()]) {
        assert.ok(point.y >= -1e-9);
        assert.ok(point.y <= top(point.x) + (3 * thickness + 0.24) / Math.cos(radians) + 1e-9);
      }
      for (const x of [-half, half]) assert.ok(shape.some(point => Math.abs(point.x - x) < 1e-9 && Math.abs(point.y - top(x)) < 1e-9));
      areas[style] = Math.abs(ShapeUtils.area(shape)) - holes.reduce((total, hole) => total + Math.abs(ShapeUtils.area(hole)), 0);
      assert.ok(areas[style] > 0);
      assert.equal(holes.length, style === "sled" ? 3 : 2);
      extrude(profile, thickness);
    }
    assert.ok(areas.arch < areas.wedge);
    assert.ok(areas.sled < areas.wedge);
    assert.notEqual(areas.arch, areas.sled);
  }
});

function distanceToEdge(point, a, b) {
  const direction = b.clone().sub(a);
  const progress = Math.max(0, Math.min(1, point.clone().sub(a).dot(direction) / direction.lengthSq()));
  return point.distanceTo(a.clone().addScaledVector(direction, progress));
}

test("foot bolt holes align with side-wall holes and retain material around every joint", () => {
  for (const rows of [1, 2, 3]) for (const angle of [10, 20, 30]) for (const thickness of [0.03, 0.04, 0.05, 0.06]) {
    const length = rows * 1.3335 + thickness * 6;
    const radians = angle * Math.PI / 180;
    const mounts = footMountLayout(length, angle, thickness);
    assert.equal(mounts.length, 2);
    for (const style of ["wedge", "arch", "sled"]) {
      const { shape, holes } = createFootProfile(length, angle, thickness, style).extractPoints(32);
      for (const [index, mount] of mounts.entries()) {
        // Independently rotate the matching side-wall hole into world space.
        assert.ok(Math.abs(footFloor + mount.y - (caseLift(length, angle) + mount.caseY * Math.cos(radians) - mount.caseZ * Math.sin(radians))) < 1e-9);
        assert.ok(Math.abs(-mount.x - (mount.caseY * Math.sin(radians) + mount.caseZ * Math.cos(radians))) < 1e-9);
        assert.ok(mount.caseY - 3 * thickness >= 0.09, "clear of the base slots");
        assert.ok(0.5 - (mount.caseY - 3 * thickness) >= 0.09, "clear of rails at minimum depth");
        const center = new Vector2(mount.x, mount.y);
        const hole = holes[holes.length - 2 + index];
        for (const point of hole) assert.ok(Math.abs(point.distanceTo(center) - footHoleRadius) < 1e-9);
        // Check the outline and any foot window, excluding the two bolt holes.
        for (const outline of [shape, ...holes.slice(0, -2)]) for (let i = 0; i < outline.length - 1; i++) {
          if (outline[i].equals(outline[i + 1])) continue;
          assert.ok(distanceToEdge(center, outline[i], outline[i + 1]) >= 0.09 - 1e-9, "hole center stays at least 1.5 hole diameters from an edge");
        }
      }
    }
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

test("foot mounts follow the adjustable side-panel margin", () => {
  for (const thickness of [0.03, 0.05, 0.06]) for (const ratio of [1, 1.5, 2]) {
    const edgeMargin = ratio * thickness;
    const length = 1.3335 + 2 * thickness + 2 * edgeMargin;
    const mounts = footMountLayout(length, 20, thickness, edgeMargin);
    for (const mount of mounts) assert.ok(Math.abs(mount.caseY - edgeMargin - thickness - 0.12) < 1e-9);
    for (const style of ["wedge", "arch", "sled"]) extrude(createFootProfile(length, 20, thickness, style, edgeMargin), thickness);
  }
});
