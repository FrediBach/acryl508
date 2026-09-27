import assert from "node:assert/strict";
import test from "node:test";
import { TubeGeometry } from "three";
import { loadTypescript } from "./load-typescript.mjs";

const { createExampleSynthLayout } = await loadTypescript("../lib/example-synth.ts");
const { createExampleSynthControls } = await loadTypescript("../lib/example-synth-controls.ts");
const { createExampleSynthPatchCurve } = await loadTypescript("../lib/example-synth-patch.ts");
const epsilon = 1e-5;

function* bodyLayouts() {
  for (const width of [180, 319, 480, 550, 813, 1400]) {
    for (const depth of [120, 133, 235, 280, 362, 600]) {
      for (const height of [20, 70, 200]) yield createExampleSynthLayout(width, depth, height, "body");
    }
  }
}

test("protector examples infer ordinary keyboards and expanders while retaining the body contact height", () => {
  for (const [width, depth, keyCount] of [
    [319, 133, 0], [420, 280, 0], [813, 220, 0],
    [480, 280, 25], [550, 280, 32], [650, 280, 37],
    [813, 362, 49], [1000, 350, 61], [1150, 400, 73], [1400, 450, 88],
  ]) for (const height of [20, 70, 200]) {
    const layout = createExampleSynthLayout(width, depth, height, "body");
    assert.equal(layout.keyCount, keyCount, `${width} × ${depth} mm`);
    assert.equal(layout.kind, keyCount ? "keyboard" : "desktop");
    assert.equal(layout.panelTop, height, "The protector's body measurement remains its support plane");
    assert.equal(layout.height, height + layout.controlHeight);
    assert.ok(layout.controlHeight > 0, "Controls extend above the body contact plane");
    assert.deepEqual(
      createExampleSynthLayout(width, depth, height),
      createExampleSynthLayout(width, depth, height, "envelope"),
      "The stand keeps total-envelope height semantics by default",
    );
  }
});

test("protector examples leave 12 mm level contact edges clear of keys, wheels, and controls", () => {
  for (const layout of bodyLayouts()) {
    const label = `${layout.width} × ${layout.depth} × ${layout.panelTop}`;
    assert.equal(layout.rimWidth, 12);
    assert.ok(layout.cheekWidth >= 12);
    const insideEdges = ({ x, z, width, depth }, name) => {
      assert.ok(Math.abs(x) + width / 2 <= layout.width / 2 - 12 + epsilon, `${label}: ${name} clears side contacts`);
      assert.ok(z - depth / 2 >= -layout.depth + 12 - epsilon, `${label}: ${name} clears rear contacts`);
      assert.ok(z + depth / 2 <= -12 + epsilon, `${label}: ${name} clears front contacts`);
    };
    insideEdges(layout.panel, "control panel");
    for (const key of layout.keys) {
      insideEdges(key, `key ${key.midi}`);
      if (!key.black) assert.ok(Math.abs(key.y + key.height / 2 - layout.panelTop) < epsilon, "White keys remain accessible above the front rim");
    }
    for (const wheel of layout.wheels) insideEdges({ ...wheel, depth: wheel.radius * 2 }, "wheel");
    const controls = createExampleSynthControls(layout);
    for (const knob of controls.knobs) insideEdges({ ...knob, width: 2 * (knob.radius + 0.7), depth: 2 * (knob.radius + 0.7) }, knob.id);
    for (const jack of controls.jacks) insideEdges({ ...jack, width: 6.7, depth: 6.7 }, jack.id);
    for (const button of controls.buttons) insideEdges(button, button.id);
  }
});

test("protector keys, wheels, and actual cable tubes fit the minimum 15 mm body-to-cover clearance", () => {
  let keyboardCount = 0, desktopCount = 0, patchCount = 0;
  for (const layout of bodyLayouts()) {
    const ceiling = layout.panelTop + 15;
    const label = `${layout.width} × ${layout.depth} × ${layout.panelTop}`;
    if (layout.kind === "keyboard") keyboardCount += 1; else desktopCount += 1;
    for (const key of layout.keys) {
      assert.ok(key.y - key.height / 2 >= 0);
      assert.ok(key.y + key.height / 2 < ceiling, `${label}: key ${key.midi} clears the cover`);
    }
    for (const wheel of layout.wheels) {
      assert.ok(wheel.y - wheel.radius >= 0);
      assert.ok(wheel.y + wheel.radius + 0.3 < ceiling, `${label}: wheel and marker clear the cover`);
    }
    const controls = createExampleSynthControls(layout);
    for (const [index, patch] of controls.patches.entries()) {
      const curve = createExampleSynthPatchCurve(layout, controls, patch, index);
      const tube = new TubeGeometry(curve, 40, Math.min(1.15, layout.controlHeight * 0.09), 8, false);
      tube.computeBoundingBox();
      const { min, max } = tube.boundingBox;
      assert.ok(min.y >= layout.panelTop, `${label}: cable stays above the panel`);
      assert.ok(max.y < ceiling, `${label}: cable ${index} clears the cover including tube thickness`);
      assert.ok(min.x >= -layout.width / 2 + 12 - epsilon && max.x <= layout.width / 2 - 12 + epsilon, `${label}: cable clears side contacts`);
      assert.ok(min.z >= -layout.depth + 12 - epsilon && max.z <= -12 + epsilon, `${label}: cable clears front and rear contacts`);
      tube.dispose();
      patchCount += 1;
    }
  }
  assert.ok(keyboardCount > 0 && desktopCount > 0 && patchCount > 0);
});
