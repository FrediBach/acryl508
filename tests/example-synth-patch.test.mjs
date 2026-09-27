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
        const tube = new TubeGeometry(curve, 64, Math.min(1.15, layout.controlHeight * 0.09), 8, false);
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

test("synth patches retain visible slack without oversized loops", () => {
  for (const dimensions of [[550, 280, 70], [650, 360, 70], [813, 362, 107], [1400, 450, 70], [319, 133, 107]]) {
    for (const mode of ["envelope", "body"]) {
      const layout = createExampleSynthLayout(...dimensions, mode);
      const controls = createExampleSynthControls(layout);
      assert.ok(controls.patches.length > 0);
      for (const [index, patch] of controls.patches.entries()) {
        const curve = createExampleSynthPatchCurve(layout, controls, patch, index);
        const start = curve.getPoint(0), end = curve.getPoint(1);
        const chord = start.distanceTo(end);
        const label = `${dimensions.join(" × ")} ${mode}, patch ${index}`;
        const lengthRatio = curve.getLength() / chord;
        // Short desktop connections need proportionally more length to turn out
        // of the plugs; long keyboard spans need only a modest amount of slack.
        const keyboard = layout.kind === "keyboard";
        assert.ok(lengthRatio > (keyboard ? 1.025 : 1.25), `${label}: excess cable length provides slack`);
        assert.ok(lengthRatio < (keyboard ? 1.3 : 4), `${label}: spare cable length stays restrained`);

        const dx = end.x - start.x, dz = end.z - start.z;
        const chordSquared = dx * dx + dz * dz;
        const points = curve.getPoints(200);
        const detour = Math.max(...points.map(point => {
          const projection = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.z - start.z) * dz) / chordSquared));
          return Math.hypot(point.x - start.x - projection * dx, point.z - start.z - projection * dz);
        }));
        const lateralBow = Math.max(...points.map(point => Math.abs((point.x - start.x) * dz - (point.z - start.z) * dx) / Math.sqrt(chordSquared)));
        assert.ok(lateralBow > (keyboard ? 12 : 8), `${label}: the cable opens sideways instead of staying taut or folding along its connection line`);
        assert.ok(lateralBow < (keyboard ? 50 : 22), `${label}: the sideways bow stays modest`);
        assert.ok(detour < (keyboard ? 50 : 28), `${label}: the loop stays near its sockets instead of sweeping across the panel`);
      }
    }
  }
});

test("synth cables leave plug tips vertically and sag between shoulders while clearing the knobs", () => {
  for (const dimensions of [[550, 280, 70], [650, 360, 70], [813, 362, 107], [319, 133, 107]]) {
    for (const mode of ["envelope", "body"]) {
      const layout = createExampleSynthLayout(...dimensions, mode);
      const controls = createExampleSynthControls(layout);
      const radius = Math.min(1.15, layout.controlHeight * 0.09);
      const knobTop = layout.panelTop + layout.controlHeight * 0.56 + 0.29;
      for (const [index, patch] of controls.patches.entries()) {
        const curve = createExampleSynthPatchCurve(layout, controls, patch, index);
        const label = `${dimensions.join(" × ")} ${mode}, patch ${index}`;
        const departure = curve.getPoint(0.000001).sub(curve.getPoint(0)).normalize();
        const arrival = curve.getPoint(1).sub(curve.getPoint(0.999999)).normalize();
        assert.ok(departure.y > 0.999, `${label}: the cable rises vertically out of its first plug`);
        assert.ok(arrival.y < -0.999, `${label}: the cable descends vertically into its second plug`);

        const points = Array.from({ length: 201 }, (_, step) => curve.getPoint(step / 200));
        const center = points.slice(80, 121);
        const shoulderTop = Math.max(...points.map(point => point.y));
        const centerBottom = Math.min(...center.map(point => point.y));
        assert.ok(centerBottom < shoulderTop - 0.25, `${label}: the middle sags below its raised shoulders`);
        assert.ok(center.every(point => point.y - radius > knobTop), `${label}: the central cable tube clears the knob caps`);
      }
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
