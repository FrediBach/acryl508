import assert from "node:assert/strict";
import test from "node:test";
import clipping from "polygon-clipping";
import { loadTypescript } from "./load-typescript.mjs";

const { defaultConfiguration, caseDimensions, configurationExport, accessoryBendSpecification } = await loadTypescript("../lib/configurator.ts");
const { backHookLayout } = await loadTypescript("../lib/back-hook.ts");
const { createCasePanels, caseCanExport } = await loadTypescript("../lib/case-panels.ts");
const { bendPoint } = await loadTypescript("../lib/accessory-bends.ts");
const { bentPanelGeometry } = await loadTypescript("../lib/bent-panel-geometry.ts");
const { configurationSvg, caseSheetLayout } = await loadTypescript("../lib/svg-export.ts");
const { caseFabrication } = await loadTypescript("../lib/fabrication.ts");
const { readCase, parseProject, makeProject, initialDesigns } = await loadTypescript("../lib/project.ts");
const near = (a, b, tolerance = 1e-6) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);
const config = { ...defaultConfiguration, vents: false, backHook: true };
const box = (left, bottom, right, top) => [[[[left, bottom], [right, bottom], [right, top], [left, top], [left, bottom]]]];

test("full-width, single and multiple hooks stay within the back edge and keep their roots attached", () => {
  for (const hp of [20, 84, 168]) for (const thickness of [3, 6]) for (const mode of ["full", "segments"]) for (const count of [1, 2, 8]) {
    const current = { ...config, hp, backHookMode: mode, backHookCount: count, backHookWidth: 840, individualPanelTints: true, panelThicknesses: { rear: thickness }, rows: 2, rowUnits: [3, 1], rowAngles: [35, 0] };
    const hook = backHookLayout(current), panels = createCasePanels(current);
    const plain = createCasePanels({ ...current, backHook: false });
    const rim = caseDimensions(current).height / 2;
    assert.ok(caseCanExport(panels));
    assert.equal(panels.faces.rear.original.length, 1, "one continuous sheet");
    assert.deepEqual(panels.layout, plain.layout, "joints and panel dimensions are unchanged");
    assert.deepEqual(clipping.xor(clipping.intersection(panels.faces.rear.original, box(-1000, -1000, 1000, rim)), plain.faces.rear.original), []);
    const strips = clipping.intersection(panels.faces.rear.original, box(-1000, rim + 5, 1000, rim + 6));
    assert.equal(strips.length, hook.count, "one distinct connected root per hook");
    for (const center of hook.centers) assert.ok(Math.abs(center) + hook.width / 2 <= hook.availableWidth / 2 + 1e-6);
    near(hook.centers.reduce((a, b) => a + b, 0), 0);
    if (hook.count > 1) assert.ok(hook.gap >= Math.max(8, thickness * 2));
    if (mode === "full") near(hook.width, hp * 5.08 - 2 * hook.inset);
    else assert.ok(hook.width >= 20);
    near(Math.max(...panels.faces.rear.shapes[0].getPoints().map(p => p.y)) * 100, caseDimensions(current).height + hook.flatHeight);
  }
});

test("two formed bends point backward then down, preserving thickness and the developed export", () => {
  for (const thickness of [3, 5, 6]) for (const mode of ["full", "segments"]) {
    const current = { ...config, backHookMode: mode, backHookCount: 3, individualPanelTints: true, panelThicknesses: { rear: thickness } };
    const panels = createCasePanels(current), hook = backHookLayout(current), depth = thickness / 100;
    const bends = panels.bends.rear, rim = caseDimensions(current).height / 100;
    const radius = depth * 2.5, end = rim + hook.flatHeight / 100;
    assert.equal(bends.length, 2);
    const shoulderEnd = bendPoint(0, bends[0].start + bends[0].length, depth / 2, depth, bends, -1);
    near(shoulderEnd.angle, -Math.PI / 2);
    const tip = bendPoint(0, end, depth / 2, depth, bends, -1);
    near(tip.angle, -Math.PI);
    near(tip.y, bends[0].start - hook.drop / 100);
    near(tip.z, depth / 2 - 2 * radius - hook.reach / 100);
    for (let i = 0; i <= 100; i++) {
      const y = rim + (end - rim) * i / 100;
      const a = bendPoint(0, y, 0, depth, bends, -1), b = bendPoint(0, y, depth, depth, bends, -1);
      near(Math.hypot(a.y - b.y, a.z - b.z), depth);
    }
    const svg = configurationSvg(current, panels), stock = caseSheetLayout(panels);
    const geometry = bentPanelGeometry(panels.faces.rear.shapes, depth, bends, -1);
    try {
      assert.ok(geometry.getAttribute("position").array.every(Number.isFinite));
      assert.ok(geometry.getAttribute("normal").array.every(Number.isFinite));
      assert.ok(geometry.boundingBox.min.z < -hook.reach / 100);
    } finally { geometry.dispose(); }
    assert.equal(configurationSvg(current, panels), svg);
    assert.match(svg, /backHookShoulder: bend 90 degrees/);
    assert.match(svg, /backHookReturn: bend 90 degrees/);
    assert.deepEqual(caseFabrication(current, panels).parts.map(p => p.polygons), stock.parts.map(p => p.item.polygons));
    assert.equal(caseFabrication(current, panels).parts.length, 5);
    const specs = accessoryBendSpecification(current);
    near(specs.reduce((sum, s) => sum + s.addedFlatLengthMm, 0), hook.flatHeight - hook.rise - hook.reach - hook.drop);
  }
});

test("both heating strips reject custom cutouts, while gaps between narrow hooks remain empty", () => {
  const current = { ...config, backHookMode: "segments", backHookCount: 2, backHookWidth: 30 };
  const panels = createCasePanels(current), hook = backHookLayout(current), rim = caseDimensions(current).height / 100;
  const cut = { id: "hook-cut", name: "Square", side: "rear", source: { kind: "svg", fileName: "square.svg" }, polygons: box(-0.5, -0.5, 0.5, 0.5), width: 4, rotation: 0 };
  for (const bend of panels.bends.rear) {
    const y = (bend.start + bend.length / 2 - rim / 2) * 100;
    const conflict = createCasePanels({ ...current, cutouts: [{ ...cut, x: hook.centers[0], y }] });
    assert.match(conflict.faces.rear.report.error, /bend and clearance/);
    assert.equal(caseCanExport(conflict), false);
    assert.throws(() => configurationSvg(current, conflict));
    const gap = createCasePanels({ ...current, cutouts: [{ ...cut, x: 0, y }] });
    assert.equal(caseCanExport(gap), true);
  }
});

test("hook settings round-trip through projects and exports, with safe legacy defaults and validated imports", () => {
  const current = { ...config, backHookMode: "segments", backHookCount: 3, backHookWidth: 25, backHookRise: 40, backHookReach: 55, backHookDrop: 35 };
  const expected = readCase(current);
  assert.deepEqual(parseProject(JSON.stringify(configurationExport(current))).designs.case, expected);
  assert.deepEqual(parseProject(JSON.stringify(makeProject("Hooks", "case", { ...initialDesigns, case: current }, []))).designs.case, expected);
  const legacy = { ...defaultConfiguration };
  for (const key of Object.keys(legacy).filter(key => key.startsWith("backHook"))) delete legacy[key];
  assert.equal(readCase(legacy).backHook, false);
  assert.equal(configurationSvg(legacy, createCasePanels(legacy)), configurationSvg(defaultConfiguration, createCasePanels(defaultConfiguration)));
  for (const [key, invalid] of [["backHookMode", "other"], ["backHookCount", 1.5], ["backHookCount", 9], ["backHookWidth", 0], ["backHookRise", NaN], ["backHookReach", 101], ["backHookDrop", -1]]) {
    assert.throws(() => readCase({ ...current, [key]: invalid }));
  }
  const both = { ...current, cableHolder: true, cableHolderBendAngle: 45 };
  assert.equal(readCase(both).cableHolder, false);
  assert.equal(configurationExport(both).cableHolder.enabled, false);
  assert.deepEqual(createCasePanels(both).bends.rear, createCasePanels(current).bends.rear);
});
