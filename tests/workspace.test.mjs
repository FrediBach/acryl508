import assert from "node:assert/strict";
import test from "node:test";
import { loadTypescript } from "./load-typescript.mjs";

const { makeProject, parseProject, initialDesigns } = await loadTypescript("../lib/project.ts");
const { historyReducer } = await loadTypescript("../lib/history.ts");
const { geometryInputCache } = await loadTypescript("../lib/geometry-input.ts");
const { createCasePanels, caseCanExport } = await loadTypescript("../lib/case-panels.ts");
const { configurationSvg } = await loadTypescript("../lib/svg-export.ts");
const { configurationExport } = await loadTypescript("../lib/configurator.ts");
const { createPanel, panelExport } = await loadTypescript("../lib/panel-designer.ts");
const { createSynthStand, standExport } = await loadTypescript("../lib/synth-stand.ts");
const { createSynthProtector, protectorExport } = await loadTypescript("../lib/synth-protector.ts");
const { packSheets, stockSvg, fitCoupon } = await loadTypescript("../lib/fabrication.ts");
const { polygonBounds, geometryArea } = await loadTypescript("../lib/custom-cutouts.ts");
const square = [[[[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5], [-0.5, -0.5]]]];
const artwork = { id: "text-1", name: "ABC", source: { kind: "text", text: "ABC", fontId: "custom", fontName: "Custom" }, polygons: square, side: "front", width: 20, x: 0, y: 0, rotation: 0 };

test("project files preserve four designs, source models, text and font bytes", () => {
  const object = { name: "triangle.obj", vertices: [0, 0, 0, 100, 0, 0, 0, 50, 100], units: "mm", up: "y", turn: 90 };
  const designs = { ...initialDesigns,
    case: { ...initialDesigns.case, hp: 100, cutouts: [artwork], individualPanelTints: true, panelTints: { front: { id: "custom", label: "Custom", color: "#123456" } }, panelTransparencies: { front: "opaque" } },
    stand: { ...initialDesigns.stand, object, angle: 35 },
    protector: { ...initialDesigns.protector, object: { ...object, turn: 180 }, headroom: 60 },
    panel: { ...initialDesigns.panel, artwork: [{ ...artwork, operation: "engrave" }] },
  };
  const fonts = [{ id: "custom", name: "Custom", data: "AAECAw==" }];
  const loaded = parseProject(JSON.stringify(makeProject("Studio", "panel", designs, fonts)));
  assert.equal(loaded.name, "Studio"); assert.equal(loaded.mode, "panel");
  assert.deepEqual(loaded.fonts, fonts);
  assert.deepEqual(loaded.designs.stand.object, object);
  assert.equal(loaded.designs.protector.object.turn, 180);
  assert.equal(loaded.designs.case.hp, 100);
  assert.deepEqual(loaded.designs.case.cutouts, [artwork]);
  assert.equal(loaded.designs.case.panelTints.front.color, "#123456");
  assert.equal(loaded.designs.case.panelTransparencies.front, "opaque");
  assert.deepEqual(loaded.designs.panel.artwork, designs.panel.artwork);
});

test("legacy mode exports import into their mode without replacing other designs", () => {
  const exports = { case: configurationExport(initialDesigns.case), stand: standExport(createSynthStand(initialDesigns.stand)), protector: protectorExport(createSynthProtector(initialDesigns.protector)), panel: panelExport(createPanel(initialDesigns.panel)) };
  for (const [mode, data] of Object.entries(exports)) {
    const result = parseProject(JSON.stringify(data), initialDesigns);
    assert.equal(result.mode, mode);
    for (const other of Object.keys(initialDesigns).filter(key => key !== mode)) assert.equal(result.designs[other], initialDesigns[other]);
  }
  const legacy = { ...exports.case, version: 1, configuration: { hp: 84, rows: 2 } };
  assert.deepEqual(parseProject(JSON.stringify(legacy)).designs.case.rowUnits, [3, 3]);
});

test("invalid project versions, enum values, arrays and malformed meshes reject before restore", () => {
  const fresh = () => structuredClone(makeProject("Studio", "case", initialDesigns, []));
  const invalid = [
    p => { p.version = 999; }, p => { p.designs.case.busboard = "unknown"; },
    p => { p.designs.case.rowUnits = [9]; }, p => { p.designs.panel.components = null; },
    p => { p.designs.stand.object = { name: "broken", vertices: [1, 2], units: "mm", up: "y", turn: 0 }; },
    p => { p.designs.case.cutouts = [{ ...artwork, polygons: [[[null]]] }]; },
    p => { p.designs.panel.artwork = [{ ...artwork, operation: "laser-anything" }]; },
    p => { p.designs.case.tint.color = "url(https://example.com)"; },
  ];
  for (const mutate of invalid) { const project = fresh(); mutate(project); assert.throws(() => parseProject(JSON.stringify(project))); }
  assert.throws(() => parseProject('{"hello":"world"}'));
});

test("history groups full gestures, restores deleted content, branches, and caps snapshots", () => {
  let state = { past: [], present: { x: 0, items: ["artwork"] }, future: [] };
  const apply = action => { state = historyReducer(state, action); };
  apply({ type: "begin" });
  for (let x = 1; x <= 30; x++) apply({ type: "set", value: { ...state.present, x } });
  apply({ type: "end" }); assert.equal(state.past.length, 1);
  apply({ type: "undo" }); assert.equal(state.present.x, 0);
  apply({ type: "redo" }); assert.equal(state.present.x, 30);
  apply({ type: "set", value: { x: 30, items: [] } });
  apply({ type: "undo" }); assert.deepEqual(state.present.items, ["artwork"]);
  apply({ type: "set", value: { ...state.present, x: 31 } }); assert.equal(state.future.length, 0);
  for (let x = 32; x < 100; x++) apply({ type: "set", value: { ...state.present, x } });
  assert.equal(state.past.length, 50);
  apply({ type: "reset", value: { x: 0, items: [] } }); assert.equal(state.past.length, 0);
});

test("appearance edits preserve geometry input identity; dimension and mesh edits invalidate it", () => {
  for (const config of Object.values(initialDesigns)) {
    const cache = geometryInputCache(), original = cache(config);
    assert.equal(cache({ ...config, tint: { id: "red", label: "Red", color: "#ff0000" }, transparency: "opaque", individualPanelTints: true, panelTints: {} }), original);
    assert.notEqual(cache({ ...config, thickness: config.thickness + 1 }), original);
  }
  const cache = geometryInputCache(), object = { vertices: [1, 2, 3] };
  const input = cache({ ...initialDesigns.stand, object });
  assert.equal(cache({ ...initialDesigns.stand, object, transparency: "opal" }), input);
  assert.notEqual(cache({ ...initialDesigns.stand, object: { ...object } }), input);
});

test("case SVG blocks missing panels and calculation failures at the export boundary", () => {
  const config = { ...initialDesigns.case, cutouts: [{ ...artwork, width: 1000 }] }, panels = createCasePanels(config);
  assert.equal(panels.faces.front.report.empty, true);
  assert.equal(caseCanExport(panels), false);
  assert.throws(() => configurationSvg(config, panels), /Resolve/);
  const intact = createCasePanels(initialDesigns.case);
  intact.reports[0].error = "Boolean operation failed";
  assert.throws(() => configurationSvg(initialDesigns.case, intact), /Resolve/);
});

test("stock layouts keep full-size geometry separated, bounded, and grouped by material", () => {
  const parts = Array.from({ length: 18 }, (_, i) => ({ id: `part-${i}`, label: `Part ${i}`, material: i % 3 === 0 ? "Red" : "Orange", polygons: [[[[-20, -5], [60, -5], [60, 25], [-20, 25], [-20, -5]]]], engraving: [[[[-10, 0], [0, 0], [0, 5], [-10, 5], [-10, 0]]]] }));
  const { sheets, unplaced } = packSheets(parts, 180, 110, 5, true);
  assert.deepEqual(unplaced, []); assert.equal(sheets.flatMap(sheet => sheet.parts).length, parts.length);
  for (const sheet of sheets) {
    for (const part of sheet.parts) {
      const b = polygonBounds(part.polygons);
      assert.ok(b.left >= 5 && b.bottom >= 5 && b.right <= 175 && b.top <= 105);
      assert.equal(part.material, sheet.material);
      assert.ok(Math.abs(geometryArea(part.polygons) - 2400) < 1e-8);
      assert.ok(Math.abs(geometryArea(part.engraving) - 50) < 1e-8);
    }
    for (let i = 0; i < sheet.parts.length; i++) for (let j = i + 1; j < sheet.parts.length; j++) {
      const a = polygonBounds(sheet.parts[i].polygons), b = polygonBounds(sheet.parts[j].polygons);
      assert.ok(a.right + 5 <= b.left || b.right + 5 <= a.left || a.top + 5 <= b.bottom || b.top + 5 <= a.bottom);
    }
    const svg = stockSvg(sheet, 180, 110, ["Check <fit>"]);
    assert.match(svg, /width="180mm" height="110mm"/); assert.match(svg, /id="engrave"/); assert.match(svg, /Check &lt;fit&gt;/);
  }
  assert.equal(packSheets(parts.slice(0, 1), 50, 110, 5, false).unplaced.length, 1);
  assert.equal(packSheets(parts.slice(0, 1), 50, 110, 5, true).sheets[0].parts[0].rotated, true);
});

test("fit coupon includes requested clearance at real millimetre scale", () => {
  const coupon = fitCoupon(6.2, 0.25);
  assert.ok(coupon.clearances.includes(0.25));
  assert.match(coupon.svg, /6.45 mm \(0.25 clearance\)/);
  assert.match(coupon.svg, /id="cut"/); assert.match(coupon.svg, /id="engrave"/);
  assert.throws(() => fitCoupon(0, 0.15));
});
