import assert from "node:assert/strict";
import test from "node:test";
import { TubeGeometry } from "three";
import { loadTypescript } from "./load-typescript.mjs";

const { createExampleSynthLayout } = await loadTypescript("../lib/example-synth.ts");
const { createExampleSynthControls } = await loadTypescript("../lib/example-synth-controls.ts");
const { createExampleSynthPatchCurve } = await loadTypescript("../lib/example-synth-patch.ts");

test("actual cable meshes stay inside thin, compact, default, and wide synth envelopes", () => {
  for (const width of [180, 319, 445, 550, 813, 1400]) {
    for (const depth of [120, 133, 234.99, 235, 280, 362, 600]) for (const height of [20, 21, 70, 140, 200]) {
      const layout = createExampleSynthLayout(width, depth, height);
      const controls = createExampleSynthControls(layout);
      for (const [index, patch] of controls.patches.entries()) {
        const curve = createExampleSynthPatchCurve(layout, controls, patch, index);
        // Match the renderer's geometry, including tube thickness and frames.
        const tube = new TubeGeometry(curve, 40, Math.min(1.15, layout.controlHeight * 0.09), 8, false);
        tube.computeBoundingBox();
        const { min, max } = tube.boundingBox;
        const name = `${width} × ${depth} × ${height}, patch ${index}`;
        assert.ok(min.x >= -width / 2 && max.x <= width / 2, `${name}: width`);
        assert.ok(min.y >= 0 && max.y <= height, `${name}: height`);
        assert.ok(min.z >= -depth && max.z <= 0, `${name}: depth`);
        tube.dispose();
      }
    }
  }
});

test("cables meet both plug tips exactly and are deterministic", () => {
  for (const dimensions of [[319, 133, 107], [550, 280, 70], [813, 362, 140], [1400, 600, 20]]) {
    const layout = createExampleSynthLayout(...dimensions);
    const controls = createExampleSynthControls(layout);
    assert.ok(controls.patches.length > 0);
    for (const [index, patch] of controls.patches.entries()) {
      const curve = createExampleSynthPatchCurve(layout, controls, patch, index);
      const repeat = createExampleSynthPatchCurve(layout, controls, patch, index);
      for (const [id, t] of [[patch.from, 0], [patch.to, 1]]) {
        const jack = controls.jacks.find(candidate => candidate.id === id);
        assert.deepEqual(curve.getPoint(t).toArray(), [jack.x, layout.panelTop + layout.controlHeight * 0.56, jack.z]);
      }
      assert.deepEqual(curve.getPoints(40), repeat.getPoints(40));
      assert.ok(curve.getPoint(0.5).y > curve.getPoint(0).y, "The cord arches above its plugs");
    }
  }
});

test("invalid endpoints fail explicitly and unexpected patch indices remain bounded", () => {
  const layout = createExampleSynthLayout(550, 280, 20);
  const controls = createExampleSynthControls(layout);
  assert.throws(() => createExampleSynthPatchCurve(layout, controls, { from: "missing", to: "vca-in", color: "#fff" }, 0), /existing sockets/);
  for (const index of [-1, NaN, Infinity, 100]) {
    const curve = createExampleSynthPatchCurve(layout, controls, controls.patches[0], index);
    const radius = Math.min(1.15, layout.controlHeight * 0.09);
    for (const point of curve.getPoints(100)) assert.ok(Number.isFinite(point.y) && point.y + radius <= layout.height);
  }
});
