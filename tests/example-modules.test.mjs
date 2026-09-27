import assert from "node:assert/strict";
import test from "node:test";
import { loadTypescript } from "./load-typescript.mjs";

const { exampleModuleCatalog, createExampleRackRow } = await loadTypescript("../lib/example-modules.ts");

test("every supported width and row height gets an exact, deterministic, non-overlapping fit", () => {
  for (const units of [1, 3]) for (let hp = 20; hp <= 168; hp += 1) for (const rowIndex of [0, 1, 2]) {
    const rack = createExampleRackRow(hp, units, rowIndex);
    assert.deepEqual(rack, createExampleRackRow(hp, units, rowIndex));
    assert.equal(new Set(rack.modules.map(module => module.id)).size, rack.modules.length);
    let endHp = 0;
    for (const { startHp, definition } of rack.modules) {
      assert.equal(startHp, endHp, `${hp} HP: modules must be adjacent`);
      assert.equal(definition.units, units);
      assert.ok(definition.hp > 0);
      endHp += definition.hp;
      assert.ok(endHp <= hp, `${hp} HP: panel must stay inside its row`);
    }
    assert.equal(endHp, hp);
    assert.ok(rack.modules.filter(module => module.definition.blank).length <= 1);
  }
});

test("case width selects a compact voice, then modulation, sequencing and wider modules", () => {
  const ids = hp => createExampleRackRow(hp, 3).modules.map(module => module.definition.id);
  assert.deepEqual(ids(20), ["vco-6", "vcf-6", "vca-4", "output-4"]);
  assert.ok(ids(30).includes("env-6"));
  assert.ok(ids(30).includes("lfo-4"));
  assert.ok(ids(48).includes("seq-12"));
  assert.ok(ids(72).includes("vco-12"));
  assert.ok(ids(72).includes("seq-16"));
  assert.ok(ids(104).includes("delay-14"));
  assert.ok(new Set(createExampleRackRow(104, 3).modules.map(module => module.definition.hp)).size >= 5);
  assert.notDeepEqual(createExampleRackRow(84, 3, 0).modules.map(module => module.definition.id), createExampleRackRow(84, 3, 1).modules.map(module => module.definition.id));
});

test("patches use existing, compatible output-to-input sockets only once", () => {
  for (const units of [1, 3]) for (let hp = 20; hp <= 168; hp += 1) for (const rowIndex of [0, 1, 2]) {
    const { modules, cables } = createExampleRackRow(hp, units, rowIndex);
    const occupied = new Set();
    assert.equal(new Set(cables.map(cable => cable.id)).size, cables.length);
    for (const cable of cables) {
      const sockets = [cable.from, cable.to].map(endpoint => {
        const placement = modules.find(candidate => candidate.id === endpoint.moduleId);
        assert.ok(placement, "Cable module exists in this row");
        const socket = placement.definition.jacks.find(candidate => candidate.id === endpoint.jackId);
        assert.ok(socket, "Cable socket exists on the module");
        const key = `${endpoint.moduleId}:${endpoint.jackId}`;
        assert.ok(!occupied.has(key), "A socket accepts one plug");
        occupied.add(key);
        return socket;
      });
      assert.notEqual(cable.from.moduleId, cable.to.moduleId);
      assert.equal(sockets[0].direction, "output");
      assert.equal(sockets[1].direction, "input");
      assert.equal(sockets[0].signal, sockets[1].signal);
      assert.match(cable.color, /^#[\da-f]{6}$/i);
    }
    if (units === 3) assert.ok(cables.length >= 3, "Every 3U row has a patched audio voice");
  }
});

test("the compact voice and expanded voice form sensible audio and control paths", () => {
  const connections = hp => {
    const { modules, cables } = createExampleRackRow(hp, 3);
    return cables.map(cable => {
      const from = modules.find(module => module.id === cable.from.moduleId).definition.id;
      const to = modules.find(module => module.id === cable.to.moduleId).definition.id;
      return `${from}:${cable.from.jackId}>${to}:${cable.to.jackId}`;
    });
  };
  assert.deepEqual(connections(20), ["vco-6:saw>vcf-6:in", "vcf-6:out>vca-4:in", "vca-4:out>output-4:in"]);
  assert.ok(!connections(26).includes("env-6:out>vca-4:cv"), "An untriggered envelope must not close the VCA");
  assert.ok(connections(46).includes("vco-8:saw>mixer-6:in"), "A single-oscillator mixer still belongs in the audio chain");
  assert.ok(connections(46).includes("mixer-6:out>vcf-8:in"));
  const expanded = connections(104);
  for (const path of ["vco-12:saw>mixer-6:in", "vco-8:saw>mixer-6:in2", "mixer-6:out>vcf-10:in", "env-8:out>vca-6:cv", "seq-16:pitch>vco-12:pitch", "seq-16:gate>env-8:gate", "vca-6:out>delay-14:in", "delay-14:out>output-6:in"]) assert.ok(expanded.includes(path), path);
});

test("1U modulation reaches the VCA CV input when a multiple is also fitted", () => {
  const { modules, cables } = createExampleRackRow(104, 1);
  const attenuator = modules.find(placement => placement.definition.id === "atten-1u");
  const amplifier = modules.find(placement => placement.definition.id === "vca-1u");
  assert.ok(modules.some(placement => placement.definition.id === "mult-1u"));
  assert.ok(!modules.some(placement => placement.definition.id === "slew-1u"));
  assert.ok(cables.some(cable => cable.from.moduleId === attenuator.id && cable.to.moduleId === amplifier.id && cable.to.jackId === "cv"));
});

test("catalog controls stay on their panels with realistic separation", () => {
  assert.equal(new Set(exampleModuleCatalog.map(module => module.id)).size, exampleModuleCatalog.length);
  for (const definition of exampleModuleCatalog) {
    const halfWidth = definition.hp * 5.08 / 2;
    const halfHeight = definition.units === 3 ? 128.5 / 2 : 39.6 / 2;
    const controls = [...definition.knobs, ...definition.jacks.map(jack => ({ ...jack, radius: 3.5 })), ...(definition.switches ?? []).map(toggle => ({ ...toggle, radius: 3 }))];
    assert.equal(new Set(definition.jacks.map(jack => jack.id)).size, definition.jacks.length, `${definition.id} socket IDs are unique`);
    for (let i = 0; i < controls.length; i += 1) {
      const control = controls[i];
      assert.ok(Math.abs(control.x) + control.radius < halfWidth, `${definition.id}: ${control.label} clears the panel edge`);
      assert.ok(Math.abs(control.z) + control.radius < halfHeight - 5, `${definition.id}: ${control.label} clears the rails`);
      for (const other of controls.slice(i + 1)) {
        const distance = Math.hypot(control.x - other.x, control.z - other.z);
        assert.ok(distance >= 12, `${definition.id}: ${control.label} and ${other.label} have finger clearance`);
        assert.ok(distance >= control.radius + other.radius + 1, `${definition.id}: controls do not overlap`);
      }
    }
    for (const knob of definition.knobs) assert.ok(knob.value >= 0 && knob.value <= 1);
    if (definition.display) for (const control of controls) {
      const dx = Math.max(0, Math.abs(control.x - definition.display.x) - definition.display.width / 2);
      const dz = Math.max(0, Math.abs(control.z - definition.display.z) - definition.display.height / 2);
      assert.ok(Math.hypot(dx, dz) > control.radius, `${definition.id}: display clears controls`);
    }
  }
});

test("invalid or undersized widths never create overflowing modules", () => {
  for (const width of [0, -4, NaN, Infinity]) assert.deepEqual(createExampleRackRow(width, 3), { modules: [], cables: [] });
  assert.equal(createExampleRackRow(12, 1).modules[0].definition.hp, 12);
  assert.equal(createExampleRackRow(20.8, 3).modules.reduce((sum, module) => sum + module.definition.hp, 0), 20);
});
