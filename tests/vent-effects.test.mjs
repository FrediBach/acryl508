import assert from "node:assert/strict";
import test from "node:test";
import { ExtrudeGeometry, ShapeUtils } from "three";
import { loadTypescript } from "./load-typescript.mjs";

const { createBottomVentLayout } = await loadTypescript("../lib/bottom-vents.ts");
const { defaultVentLayer, normalizeVentDesign, sampleVentField, ventPresets, ventWaveforms, ventTargets } = await loadTypescript("../lib/vent-design.ts");
const { defaultConfiguration, caseDimensions, configurationExport, ventStyles, ventDensities } = await loadTypescript("../lib/configurator.ts");
const { createCasePanels } = await loadTypescript("../lib/case-panels.ts");
const { configurationSvg } = await loadTypescript("../lib/svg-export.ts");
const epsilon = 1e-8;
const extreme = (target, amount) => ({ size: 50, seed: 42, layers: [0, 60, 120].map(phase => ({ ...defaultVentLayer, target, amount, frequency: 6, phase, angle: phase })) });

function assertClearance(layout, width, length, thickness) {
  const { openings, minimumWeb, edgeMargin } = layout;
  const usableHalf = (width - 2 * thickness) / 2;
  assert.ok(openings.length > 0, "supported cases retain vents");
  for (let i = 0; i < openings.length; i++) {
    const a = openings[i];
    assert.ok(Object.values(a).every(Number.isFinite));
    assert.ok(a.width >= 0.034 - epsilon && a.height >= a.width - epsilon);
    assert.ok(usableHalf - Math.abs(a.x) - a.width / 2 >= edgeMargin - epsilon, "side border");
    assert.ok(length / 2 - Math.abs(a.y) - a.height / 2 >= edgeMargin - epsilon, "end border");
    assert.ok(Math.abs(a.y) - a.height / 2 >= minimumWeb / 2 - epsilon, "centre strip");
    for (let j = i + 1; j < openings.length; j++) {
      const b = openings[j];
      const gapX = Math.abs(a.x - b.x) - (a.width + b.width) / 2;
      const gapY = Math.abs(a.y - b.y) - (a.height + b.height) / 2;
      assert.ok(gapX >= minimumWeb - epsilon || gapY >= minimumWeb - epsilon, "full web remains between any two openings");
    }
  }
}

test("presets and stacked extreme effects preserve thickness-aware borders and webs", () => {
  const designs = [
    ...ventPresets.map(p => p.design),
    { size: 0, seed: 1, layers: [] },
    ...ventTargets.flatMap(t => [extreme(t.value, 100), extreme(t.value, -100)]),
  ];
  for (const [hp, units, thickness] of [[20, 1, 0.06], [84, 3, 0.05], [168, 9, 0.03], [168, 9, 0.06]]) {
    const width = hp * 0.0508 + 2 * thickness, length = units * 0.4445;
    for (const { value: style } of ventStyles) for (const { value: density } of ventDensities) for (const design of designs) {
      const layout = createBottomVentLayout(width, length, style, density, { thickness, design });
      assertClearance(layout, width, length, thickness);
    }
  }
});

test("each effect field is bounded and each preset produces a distinct reproducible pattern", () => {
  for (const { value: waveform } of ventWaveforms) for (const x of [-0.5, -0.2, 0, 0.25, 0.5]) for (const y of [-0.4, 0, 0.4]) {
    const layer = { ...defaultVentLayer, waveform, angle: 135, phase: 215 };
    const sample = sampleVentField(layer, x, y, 123);
    assert.ok(Number.isFinite(sample) && Math.abs(sample) <= 1 + epsilon);
    assert.equal(sample, sampleVentField(layer, x, y, 123));
  }
  const layouts = ventPresets.map(({ design }) => createBottomVentLayout(4.3672, 1.3335, "long-slits", "medium", { design }).openings);
  assert.equal(new Set(layouts.map(value => JSON.stringify(value))).size, ventPresets.length);
  const wave = layouts[1];
  assert.ok(new Set(wave.map(o => o.height.toFixed(5))).size > 5, "wave changes slit lengths");
  assert.ok(new Set(wave.filter(o => o.y > 0).map(o => o.y.toFixed(5))).size > 5, "wave moves slit centres");
  const design = ventPresets.find(p => p.id === "organic").design;
  const a = createBottomVentLayout(4.3672, 1.3335, "round", "high", { design }).openings;
  assert.deepEqual(a, createBottomVentLayout(4.3672, 1.3335, "round", "high", { design }).openings);
  assert.notDeepEqual(a, createBottomVentLayout(4.3672, 1.3335, "round", "high", { design: { ...design, seed: design.seed + 1 } }).openings);
});

test("invalid or excessive effect settings normalize to finite bounded geometry", () => {
  const design = normalizeVentDesign({ size: Infinity, seed: NaN, layers: Array.from({ length: 20 }, () => ({ waveform: "invalid", target: "invalid", amount: Infinity, frequency: -100, angle: 900, phase: NaN })) });
  assert.equal(design.layers.length, 3);
  assert.equal(design.size, 100);
  assert.equal(design.layers[0].frequency, 0.25);
  assert.equal(design.layers[0].angle, 180);
  const layout = createBottomVentLayout(1.136, 0.4445, "long-slits", "high", { thickness: 0.06, design });
  assertClearance(layout, 1.136, 0.4445, 0.06);
  assert.equal(layout.pitchAdjusted, true);
  assert.deepEqual(normalizeVentDesign({ layers: [null] }).layers[0], { waveform: "sine", target: "size", amount: 0, frequency: 2, phase: 0, angle: 0 });
});

test("effects triangulate without filling holes, including minimum-size slits", () => {
  for (const { value: ventStyle } of ventStyles) for (const design of [ventPresets[1].design, ventPresets[4].design, { size: 0, seed: 1, layers: [] }]) {
    const config = { ...defaultConfiguration, hp: 20, rowUnits: [1], thickness: 6, ventStyle, ventDensity: "high", ventDesign: design };
    const shape = createCasePanels(config).faces.bottom.shapes[0];
    const outline = shape.extractPoints(8);
    const expected = Math.abs(ShapeUtils.area(outline.shape)) - outline.holes.reduce((area, hole) => area + Math.abs(ShapeUtils.area(hole)), 0);
    const geometry = new ExtrudeGeometry(shape, { depth: 0.06, bevelEnabled: false, curveSegments: 8 });
    try {
      const p = geometry.attributes.position;
      assert.ok(p.array.every(Number.isFinite));
      let area = 0;
      for (let i = 0; i < p.count; i += 3) if ([i, i + 1, i + 2].every(j => p.getZ(j) === 0)) {
        area += Math.abs((p.getX(i + 1) - p.getX(i)) * (p.getY(i + 2) - p.getY(i)) - (p.getY(i + 1) - p.getY(i)) * (p.getX(i + 2) - p.getX(i))) / 2;
      }
      assert.ok(Math.abs(area - expected) < 1e-6);
    } finally { geometry.dispose(); }
  }
});

test("bottom custom cuts reserve a full web and preserve the same effects in exports", () => {
  const config = { ...defaultConfiguration, ventDesign: ventPresets[1].design, cutouts: [{ id: "opening", name: "Opening", source: { kind: "svg", fileName: "square.svg" }, side: "bottom", polygons: [[[[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]]]], width: 20, x: 30, y: 35, rotation: 0 }] };
  const panels = createCasePanels(config);
  assert.ok(panels.ventilation.omitted > 0);
  assert.equal(panels.faces.bottom.report.error, undefined);
  // Outside bottom X is mirrored into the base's coordinates.
  const box = { x: -0.3, y: 0.35, width: 0.2, height: 0.2 };
  for (const opening of panels.ventilation.openings) {
    const dx = Math.abs(opening.x - box.x) - (opening.width + box.width) / 2;
    const dy = Math.abs(opening.y - box.y) - (opening.height + box.height) / 2;
    assert.ok(dx >= 0.05 - epsilon || dy >= 0.05 - epsilon);
  }
  const saved = JSON.parse(JSON.stringify(configurationExport(config)));
  assert.deepEqual(saved.configuration.ventDesign, config.ventDesign);
  assert.deepEqual(createCasePanels(saved.configuration).ventilation.openings, panels.ventilation.openings);
  const svg = configurationSvg(config, panels);
  const bottom = svg.match(/<g id="panel-bottom"[\s\S]*?<\/g>/)[0];
  assert.equal((bottom.match(/\bM/g) ?? []).length, panels.faces.bottom.polygons[0].length);
  const dimensions = caseDimensions(config);
  assertClearance(panels.ventilation, dimensions.width / 100, panels.layout.innerLength, config.thickness / 100);
});
