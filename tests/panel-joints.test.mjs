import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { ExtrudeGeometry, ShapeUtils } from "three";
import ts from "typescript";

const source = await readFile(new URL("../lib/panel-joints.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText.replace('"three"', JSON.stringify(import.meta.resolve("three")));
const { createPanelProfiles } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
const bounds = points => ({
  left: Math.min(...points.map(point => point.x)), right: Math.max(...points.map(point => point.x)),
  bottom: Math.min(...points.map(point => point.y)), top: Math.max(...points.map(point => point.y)),
});

test("closed slots match base and end tabs in assembled coordinates across the size range", () => {
  for (const hp of [20, 63, 84, 168]) for (const rows of [1, 2, 3]) for (const depth of [0.5, 0.75, 1.8]) for (const thickness of [0.03, 0.04, 0.05, 0.06]) {
    const width = hp * 0.0508 + 2 * thickness;
    const length = rows * 1.3335 + 6 * thickness;
    const height = depth + 3 * thickness;
    const { base, end, side, layout } = createPanelProfiles(width, length, height, thickness);
    near(layout.innerWidth, hp * 0.0508);
    near(layout.innerLength, rows * 1.3335);
    near(height - layout.baseTop, depth);
    const sideSlots = side.holes.map(hole => bounds(hole.getPoints()));
    assert.equal(sideSlots.length, layout.baseTabs.length + 2 * layout.endTabs.length);

    for (const tab of layout.baseTabs) {
      // Base Y and side X both map to world -Z. Slot height equals extrusion.
      const slot = sideSlots.find(slot => Math.abs(slot.left - tab.start) < 1e-9 && Math.abs(slot.right - tab.end) < 1e-9 && Math.abs(slot.bottom - layout.baseBottom) < 1e-9);
      assert.ok(slot, "base tongue has a matching side-wall slot");
      near(slot.top - slot.bottom, thickness);
      for (const sign of [-1, 1]) {
        assert.ok(base.getPoints().some(point => Math.abs(point.x - sign * width / 2) < 1e-9 && Math.abs(point.y - tab.start) < 1e-9));
      }
    }
    for (const sign of [-1, 1]) for (const tab of layout.endTabs) {
      const slot = sideSlots.find(slot => Math.abs((slot.left + slot.right) / 2 - sign * layout.endCenter) < 1e-9 && Math.abs(slot.bottom - tab.start) < 1e-9);
      assert.ok(slot, "end-panel tongue has a matching side-wall slot");
      near(slot.right - slot.left, thickness);
      near(slot.top, tab.end);
      assert.ok(end.getPoints().some(point => Math.abs(point.x - sign * width / 2) < 1e-9 && Math.abs(point.y - tab.start) < 1e-9));
    }
    for (const slot of sideSlots) {
      assert.ok(slot.left >= -length / 2 + 2 * thickness - 1e-9);
      assert.ok(slot.right <= length / 2 - 2 * thickness + 1e-9);
      assert.ok(slot.bottom >= 2 * thickness - 1e-9);
      assert.ok(slot.top <= height - 2 * thickness + 1e-9);
    }
    // Both base tab sets span the inner width plus both side-wall thicknesses:
    // withdrawal requires moving a side panel away after releasing its screws.
    const baseBounds = bounds(base.getPoints());
    near(baseBounds.right - baseBounds.left, width);
    near(baseBounds.top - baseBounds.bottom, layout.innerLength);
  }
});

test("tabbed sheets triangulate without filling slots or changing sheet thickness", () => {
  for (const rows of [1, 3]) for (const thickness of [0.03, 0.06]) for (const depth of [0.5, 1.8]) {
    const profiles = createPanelProfiles(20 * 0.0508 + 2 * thickness, rows * 1.3335 + 6 * thickness, depth + 3 * thickness, thickness);
    for (const shape of [profiles.base, profiles.side, profiles.end]) {
      const points = shape.extractPoints();
      const expectedArea = Math.abs(ShapeUtils.area(points.shape)) - points.holes.reduce((sum, hole) => sum + Math.abs(ShapeUtils.area(hole)), 0);
      const geometry = new ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
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
        assert.ok(Math.abs(capArea - expectedArea) < 1e-6, "triangulated area excludes every slot");
        geometry.computeBoundingBox();
        near(geometry.boundingBox.max.z - geometry.boundingBox.min.z, thickness);
      } finally { geometry.dispose(); }
    }
  }
});
