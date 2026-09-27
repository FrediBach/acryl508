import assert from "node:assert/strict";
import test from "node:test";
import { loadTypescript } from "./load-typescript.mjs";

const { createExampleSynthControls } = await loadTypescript("../lib/example-synth-controls.ts");

test("example synth controls fit small modules and full keyboards without overlapping", () => {
  for (const kind of ["desktop", "keyboard"]) {
    const widths = kind === "desktop" ? [156, 220, 291, 450, 700] : [400, 560, 850, 1400];
    const depths = kind === "desktop" ? [104, 117, 200, 430] : [80, 110, 200, 430];
    for (const width of widths) for (const depth of depths) {
      const panel = { x: 17, z: -23, width, depth };
      const layout = { kind, panel };
      const result = createExampleSynthControls(layout);
      assert.deepEqual(result, createExampleSynthControls(layout));
      assert.ok(result.knobs.length >= 5 && result.knobs.length <= 40);
      assert.ok(result.jacks.length <= 32);
      const controls = [
        ...result.knobs.map(knob => ({ ...knob, rearClearance: knob.radius + 4, halfWidth: knob.radius, halfDepth: knob.radius })),
        ...result.jacks.map(jack => ({ ...jack, rearClearance: 5, halfWidth: 3.5, halfDepth: 3.5 })),
        ...result.buttons.map(button => ({ ...button, rearClearance: 6, halfWidth: button.width / 2, halfDepth: button.depth / 2 })),
      ];
      assert.equal(new Set(controls.map(control => control.id)).size, controls.length);
      for (const control of controls) {
        assert.ok(Math.abs(control.x - panel.x) + control.halfWidth <= width / 2, `${kind} ${width}×${depth}: ${control.id} clears the panel side`);
        assert.ok(control.z + control.halfDepth <= panel.z + depth / 2, `${kind} ${width}×${depth}: ${control.id} clears the front`);
        assert.ok(control.z - control.rearClearance >= panel.z - depth / 2 + 12, `${kind} ${width}×${depth}: ${control.id} clears the brand`);
      }
      for (let index = 0; index < controls.length; index += 1) for (const other of controls.slice(index + 1)) {
        const control = controls[index];
        assert.ok(Math.abs(control.x - other.x) >= control.halfWidth + other.halfWidth + 1 || Math.abs(control.z - other.z) >= control.halfDepth + other.halfDepth + 1,
          `${kind} ${width}×${depth}: ${control.id} and ${other.id} overlap`);
      }
      for (let index = 0; index < result.knobs.length; index += 1) for (const other of result.knobs.slice(index + 1)) {
        assert.ok(Math.hypot(result.knobs[index].x - other.x, result.knobs[index].z - other.z) >= 18);
      }
      for (let index = 0; index < result.jacks.length; index += 1) for (const other of result.jacks.slice(index + 1)) {
        assert.ok(Math.hypot(result.jacks[index].x - other.x, result.jacks[index].z - other.z) >= 11.5);
      }
    }
  }
});

test("patch leads connect real output and input sockets with one plug per socket", () => {
  for (const kind of ["keyboard", "desktop"]) {
    const result = createExampleSynthControls({ kind, panel: { x: 0, z: -20, width: kind === "keyboard" ? 750 : 291, depth: 117 } });
    const occupied = new Set();
    assert.equal(result.patches.length, 4);
    for (const patch of result.patches) {
      const from = result.jacks.find(jack => jack.id === patch.from);
      const to = result.jacks.find(jack => jack.id === patch.to);
      assert.equal(from?.direction, "output");
      assert.equal(to?.direction, "input");
      for (const id of [patch.from, patch.to]) {
        assert.ok(!occupied.has(id));
        occupied.add(id);
      }
    }
  }
});
