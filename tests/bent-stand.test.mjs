import assert from "node:assert/strict";
import test from "node:test";
import { loadTypescript } from "./load-typescript.mjs";

const { createSynthStand, defaultStandConfiguration, standExport, standSvg, standSheetLayout } = await loadTypescript("../lib/synth-stand.ts");
const { bentTrayPoint } = await loadTypescript("../lib/bent-stand.ts");
const { readStand, parseProject, initialDesigns } = await loadTypescript("../lib/project.ts");
const { standFabrication, packSheets, stockSvg } = await loadTypescript("../lib/fabrication.ts");
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} ≈ ${b}`);
const config = { ...defaultStandConfiguration, bentSheet: true };

test("bent stand has three connected parts, four separate square mortises and two opposite 90 degree bends", () => {
  for (const width of [180, 550, 1400]) for (const depth of [120, 600]) for (const angle of [0, 25, 45]) for (const thickness of [5, 10]) for (const roundedEdges of [false, true]) {
    const stand = createSynthStand({ ...config, width, depth, angle, thickness, roundedEdges, cornerRadius: 10, clearance: 0.4, frontLipHeight: 50, rearFoldHeight: 150 });
    assert.equal(stand.parts.length, 3);
    const part = stand.parts.find(p => p.tray), tray = part.tray;
    assert.equal(part.polygons[0].length, 5, "four independent closed holes");
    assert.equal(tray.holes.length, 4);
    assert.ok(tray.rearFold > tray.frontLip);
    for (const p of stand.parts) {
      assert.equal(p.polygons.length, 1, `${p.id} connected at ${width}/${depth}/${angle}/${thickness}`);
      assert.ok(p.polygons.flat(2).every(point => point.every(Number.isFinite)));
      near(Math.min(...p.polygons.flat(2).map(p => p[1])), 0);
    }
    const a = angle * Math.PI / 180;
    for (const h of tray.holes) {
      assert.ok(h.y - h.size / 2 > tray.deckStart);
      assert.ok(h.y + h.size / 2 < tray.deckStart + tray.deckDepth);
      assert.ok(Math.abs(h.x) + h.size / 2 < part.width / 2);
      const support = stand.parts.find(p => p.id === h.mate), yaw = support.placement.yaw;
      // Project every tab corner at both surfaces of the tilted tray. No tab
      // material may collide with the square hole wall at any sheet thickness.
      for (const u of [h.tabCenter - h.tabWidth / 2, h.tabCenter + h.tabWidth / 2]) for (const v of [-support.thickness / 2, support.thickness / 2]) for (const n of [-part.thickness, 0]) {
        const x = u * Math.cos(yaw) + v * Math.sin(yaw);
        const z = support.placement.depth + u * Math.sin(yaw) - v * Math.cos(yaw);
        const flatY = tray.deckStart + (z + n * Math.sin(a)) / Math.cos(a);
        assert.ok(Math.abs(x - h.x) < h.size / 2 + 1e-7);
        assert.ok(Math.abs(flatY - h.y) < h.size / 2 + 1e-7);
      }
    }
    for (const d of [0, depth / 2, depth]) {
      const p = bentTrayPoint(tray, thickness, angle, stand.frontHeight, 0, tray.deckStart + d, thickness);
      near(p.z, d * Math.cos(a)); near(p.y, stand.frontHeight + d * Math.sin(a));
    }
    const frontTip = bentTrayPoint(tray, thickness, angle, stand.frontHeight, 0, 0, thickness / 2);
    const frontBase = bentTrayPoint(tray, thickness, angle, stand.frontHeight, 0, tray.frontLip, thickness / 2);
    near(frontTip.y - frontBase.y, tray.frontLip * Math.cos(a));
    const rearBaseY = tray.deckStart + depth + tray.allowance;
    const rearBase = bentTrayPoint(tray, thickness, angle, stand.frontHeight, 0, rearBaseY, thickness / 2);
    const rearTip = bentTrayPoint(tray, thickness, angle, stand.frontHeight, 0, part.height, thickness / 2);
    near(rearBase.y - rearTip.y, tray.rearFold * Math.cos(a));
    assert.ok(rearTip.y >= thickness / 2, "rear fold clears floor");
    near(stand.parts[0].slots[0].root - stand.parts[1].slots[0].root, 0.2);
  }
});

test("mixed thickness, materials and bend dimensions survive export and project reload", () => {
  const input = { ...config, frontLipHeight: 30, rearFoldHeight: 80, individualSheetMaterials: true,
    sheetThicknesses: { "rib-a-1": 5, "rib-b-1": 10, "bent-tray": 8 }, sheetTints: { "bent-tray": defaultStandConfiguration.tint }, sheetTransparencies: { "bent-tray": "opaque" } };
  const stand = createSynthStand(input), saved = standExport(stand);
  assert.deepEqual(createSynthStand(readStand(saved.configuration)).parts, stand.parts);
  assert.deepEqual(createSynthStand(parseProject(JSON.stringify(saved), initialDesigns).designs.stand).parts, stand.parts);
  near(stand.parts[0].slots[0].width, 10.15); near(stand.parts[1].slots[0].width, 5.15);
  near(stand.parts[0].slots[0].root - stand.parts[1].slots[0].root, 0.2);
  assert.equal(saved.construction.trayCount, 1);
  assert.equal(saved.tray.innerRadius, 16);
  assert.ok(saved.notes.some(n => /bend allowances/.test(n)));
  assert.ok(saved.notes.every(n => !/no .*bending/.test(n)));
  const legacy = { ...defaultStandConfiguration }; delete legacy.bentSheet; delete legacy.frontLipHeight; delete legacy.rearFoldHeight;
  assert.deepEqual(createSynthStand(legacy).parts, createSynthStand(defaultStandConfiguration).parts);
});

test("flat blank, bend guides and fabrication use the same geometry without cutting bend lines", () => {
  const stand = createSynthStand(config), svg = standSvg(stand), fabrication = standFabrication(stand);
  assert.equal((svg.match(/data-operation="cut"/g) ?? []).length, 3);
  assert.equal((svg.match(/data-operation="bend-guide"/g) ?? []).length, 2);
  assert.match(svg, /90 degrees up/); assert.match(svg, /90 degrees down/);
  assert.doesNotMatch(svg, /NaN|Infinity|undefined/);
  assert.equal(fabrication.parts.length, 3);
  assert.ok(fabrication.warnings.some(n => /bend allowances/.test(n)));
  const packed = packSheets(fabrication.parts, 1200, 1200, 10, true);
  assert.equal(packed.unplaced.length, 0);
  assert.doesNotMatch(stockSvg(packed.sheets[0], 1200, 1200), /data-operation="bend-guide"|stroke-dasharray/);
  const boxes = standSheetLayout(stand).parts.map(({part, x, y}) => ({ x: x + part.minX, y: y - part.height, w: part.width, h: part.height }));
  boxes.forEach((b, i) => boxes.slice(i + 1).forEach(c => assert.ok(b.x + b.w < c.x || c.x + c.w < b.x || b.y + b.h < c.y || c.y + c.h < b.y)));
});
