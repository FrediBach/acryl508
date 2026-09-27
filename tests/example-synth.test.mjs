import assert from "node:assert/strict";
import test from "node:test";
import { loadTypescript } from "./load-typescript.mjs";

const { createExampleSynthLayout } = await loadTypescript("../lib/example-synth.ts");

test("footprints select ordinary full-size keyboards or desktop analog modules", () => {
  for (const [width, depth, expected] of [
    [319, 133, 0], [420, 280, 0], [813, 220, 0],
    [480, 280, 25], [550, 280, 32], [650, 280, 37],
    [813, 362, 49], [1000, 350, 61], [1150, 400, 73], [1400, 450, 88],
  ]) {
    const layout = createExampleSynthLayout(width, depth, 107);
    assert.equal(layout.keyCount, expected, `${width} × ${depth} mm`);
    assert.equal(layout.keys.length, expected);
    assert.equal(layout.kind, expected ? "keyboard" : "desktop");
    assert.equal(layout.wheels.length, expected ? 2 : 0);
    if (expected) assert.equal(layout.whiteKeyPitch, 23.5);
  }
});

test("keybeds have chromatic notes, correct two/three black-key groups, and raised shorter black keys", () => {
  const blackClasses = [1, 3, 6, 8, 10];
  for (const width of [480, 550, 650, 813, 1000, 1150, 1400]) {
    const layout = createExampleSynthLayout(width, 362, 140);
    const { keys } = layout;
    assert.equal(keys[0].midi, keys.length === 88 ? 21 : 48);
    let previousWhite;
    keys.forEach((key, index) => {
      assert.equal(key.midi, keys[0].midi + index);
      assert.equal(key.black, blackClasses.includes(key.midi % 12));
      if (key.black) {
        const before = keys[index - 1], after = keys[index + 1];
        assert.ok(before && after && !before.black && !after.black);
        assert.equal(key.x, (before.x + after.x) / 2);
        assert.ok(key.y - key.height / 2 >= before.y + before.height / 2 - 1e-8);
        assert.ok(key.depth < before.depth * 0.65);
        assert.equal(key.z - key.depth / 2, before.z - before.depth / 2);
      } else {
        if (previousWhite) assert.equal(key.x - previousWhite.x, 23.5);
        previousWhite = key;
      }
    });
    if (keys.length === 49) assert.equal(keys.filter(key => key.black).length, 20);
    if (keys.length === 88) assert.equal(keys.filter(key => key.black).length, 36);
  }
});

test("all keys, wheels, and control surfaces remain within every supported boundary envelope", () => {
  const epsilon = 1e-8;
  for (const width of [180, 319, 430, 444.49, 444.5, 445, 480, 550, 650, 813, 1000, 1150, 1329.99, 1330, 1400]) {
    for (const depth of [120, 133, 234.99, 235, 280, 362, 600]) for (const height of [20, 21, 70, 140, 200]) {
      const layout = createExampleSynthLayout(width, depth, height);
      const assertBox = box => {
        assert.ok(Math.abs(box.x) + box.width / 2 <= width / 2 + epsilon);
        assert.ok(box.y - box.height / 2 >= -epsilon);
        assert.ok(box.y + box.height / 2 <= height + epsilon);
        assert.ok(box.z - box.depth / 2 >= -depth - epsilon);
        assert.ok(box.z + box.depth / 2 <= epsilon);
      };
      for (const key of layout.keys) assertBox(key);
      for (const wheel of layout.wheels) assertBox({ ...wheel, height: wheel.radius * 2, depth: wheel.radius * 2 });
      const { panel } = layout;
      assertBox({ ...panel, y: layout.panelTop + layout.controlHeight / 2, height: layout.controlHeight });
      assert.ok(panel.width < width - 2 * layout.cheekWidth);
      assert.ok(panel.depth > 0);
      assert.ok(layout.frontTop > 0 && layout.frontTop <= layout.panelTop);
      assert.ok(layout.controlHeight > 0);
      if (layout.kind === "keyboard") {
        assert.ok(panel.depth >= 80, "Rear panel leaves usable room for controls");
        for (const key of layout.keys) assert.ok(key.z - key.depth / 2 > panel.z + panel.depth / 2);
        for (const wheel of layout.wheels) assert.ok(wheel.x + wheel.width / 2 < layout.keys[0].x - layout.keys[0].width / 2);
      }
    }
  }
});

test("layout is deterministic, independent between calls, and normalizes invalid dimensions", () => {
  const reference = createExampleSynthLayout(550, 280, 70);
  assert.deepEqual(reference, createExampleSynthLayout(550, 280, 70));
  for (const value of [NaN, Infinity, -Infinity, undefined]) assert.deepEqual(createExampleSynthLayout(value, value, value), reference);
  assert.deepEqual(createExampleSynthLayout(-1, -1, -1), createExampleSynthLayout(180, 120, 20));
  assert.deepEqual(createExampleSynthLayout(2000, 1000, 300), createExampleSynthLayout(1400, 600, 200));
  reference.keys[0].x = 999;
  assert.notEqual(createExampleSynthLayout(550, 280, 70).keys[0].x, 999);
});
