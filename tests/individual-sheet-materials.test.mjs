import assert from "node:assert/strict";
import test from "node:test";
import polygonClipping from "polygon-clipping";
import { BoxGeometry } from "three";
import { loadTypescript } from "./load-typescript.mjs";
const { createArt, artExport, artSvg } = await loadTypescript("../lib/art.ts");
const { createSynthStand, standExport, standSvg } = await loadTypescript("../lib/synth-stand.ts");
const { createSynthProtector, protectorExport, protectorSvg } = await loadTypescript("../lib/synth-protector.ts");
const { initialDesigns, makeProject, parseProject } = await loadTypescript("../lib/project.ts");
const { artFabrication, standFabrication, protectorFabrication, packSheets } = await loadTypescript("../lib/fabrication.ts");
const { sheetMaterial, allSheetMaterials } = await loadTypescript("../lib/sheet-materials.ts");
const { geometryInputCache } = await loadTypescript("../lib/geometry-input.ts");
const { geometryArea, polygonBounds } = await loadTypescript("../lib/custom-cutouts.ts");
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} ≈ ${b}`);
const rect = (l, b, r, t) => [[[[l,b],[r,b],[r,t],[l,t],[l,b]]]];
const blue = { id: "blue", label: "Blue", color: "#15a8dc" };
const variants = [
  { mode: "art", create: createArt, export: artExport, svg: artSvg, fabrication: artFabrication, id: "a-1", other: "b-1", thickness: 6 },
  { mode: "stand", create: createSynthStand, export: standExport, svg: standSvg, fabrication: standFabrication, id: "rib-1", other: "brace-1", thickness: 10 },
  { mode: "protector", create: createSynthProtector, export: protectorExport, svg: protectorSvg, fabrication: protectorFabrication, id: "top-sheet", other: "foot-left-1", thickness: 10 },
];
for (const variant of variants) test(`${variant.mode}: optional sheet materials persist, export and pack separately`, () => {
  const { mode, id, other, thickness } = variant, defaults = initialDesigns[mode];
  const config = { ...defaults, individualSheetMaterials: true, sheetTints: { [id]: blue }, sheetTransparencies: { [id]: "opaque" }, sheetThicknesses: { [id]: thickness } };
  const design = variant.create(config), data = variant.export(design);
  assert.deepEqual(sheetMaterial(design.config, id), { tint: blue, transparency: "opaque", thickness });
  assert.equal(sheetMaterial(design.config, other).thickness, defaults.thickness);
  assert.deepEqual(variant.create({ ...config, individualSheetMaterials: false }).parts, variant.create(defaults).parts);
  assert.deepEqual(JSON.parse(JSON.stringify(parseProject(JSON.stringify(data)).designs[mode])), design.config);
  const project = makeProject("Mixed sheets", mode, { ...initialDesigns, [mode]: design.config }, []);
  assert.deepEqual(JSON.parse(JSON.stringify(parseProject(JSON.stringify(project)).designs[mode])), design.config);
  assert.equal(data.sheetMaterials.find(p => p.id === id).thickness, thickness);
  assert.match(variant.svg(design), new RegExp(`id="${id}" data-thickness-mm="${thickness}" data-color="#15a8dc" data-transparency="opaque"`));
  const fabrication = variant.fabrication(design), packed = packSheets(fabrication.parts, 1400, 1000, 10, true);
  assert.deepEqual(packed.unplaced, []);
  const sheet = packed.sheets.find(sheet => sheet.parts.some(part => part.id === id));
  assert.equal(sheet.thickness, thickness);
  assert.equal(sheet.material, "Blue · Opaque");
  assert.equal(sheet.parts.length, 1);
  const color = { ...config, ...allSheetMaterials(config, { tint: blue }) };
  assert.equal(sheetMaterial(color, other).tint, blue);
  assert.equal(sheetMaterial(color, id).transparency, "opaque");
  assert.equal(sheetMaterial(color, id).thickness, thickness);
  const uniform = { ...config, ...allSheetMaterials(config, { thickness: defaults.thickness }) };
  assert.equal(sheetMaterial(uniform, id).thickness, defaults.thickness);
  assert.deepEqual(uniform.sheetTints, config.sheetTints);
  const cache = geometryInputCache(), original = cache(config);
  assert.equal(cache({ ...config, sheetTints: {}, sheetTransparencies: {} }), original);
  assert.notEqual(cache(uniform), original);
  for (const patch of [{ sheetThicknesses: { [id]: 100 } }, { sheetTints: { [id]: { ...blue, color: "not a color" } } }, { sheetTransparencies: { [id]: "invalid" } }, { sheetThicknesses: { invalid: 6 } }]) {
    assert.throws(() => parseProject(JSON.stringify({ ...data, configuration: { ...config, ...patch } })));
  }
});
function checkJoints(design) {
  for (const part of design.parts) {
    assert.equal(part.polygons.length, 1, `${part.id} stays connected`);
    assert.ok(part.polygons.flat(2).flat().every(Number.isFinite));
    for (const slot of part.slots) {
      const mate = design.parts.find(p => p.id === slot.mate);
      near(slot.width, mate.thickness + design.config.clearance);
      const reciprocal = mate.slots.find(s => s.mate === part.id);
      assert.ok(reciprocal);
      near(Math.abs(slot.root - reciprocal.root), 0.2);
      const opening = slot.opens === "down" ? rect(slot.center - mate.thickness / 2, -1, slot.center + mate.thickness / 2, slot.root) : rect(slot.center - mate.thickness / 2, slot.root, slot.center + mate.thickness / 2, part.height + 1);
      near(geometryArea(polygonClipping.intersection(part.polygons, opening)), 0);
    }
  }
}
test("art mixed thicknesses size reciprocal slots and each leaf's bend allowance", () => {
  const config = { ...initialDesigns.art, width: 120, depth: 120, rows: 10, columns: 10, individualSheetMaterials: true, sheetThicknesses: { "a-1": 3, "b-1": 6, "a-2": 5 } };
  const art = createArt(config);
  checkJoints(art);
  const sameGeometry = createArt({ ...config, sheetTints: { "b-1": blue } });
  assert.deepEqual(sameGeometry.parts, art.parts);
  for (const id of ["a-1", "b-1", "a-2"]) {
    const part = art.parts.find(p => p.id === id);
    const uniform = createArt({ ...config, thickness: part.thickness, individualSheetMaterials: false });
    near(part.bend.length, uniform.parts.find(p => p.id === id).bend.length);
  }
});
function boxModel() {
  const geometry = new BoxGeometry(550, 70, 280).toNonIndexed();
  const vertices = Array.from(geometry.attributes.position.array); geometry.dispose();
  return { name: "synth.obj", vertices, units: "mm", up: "y", turn: 0 };
}
test("standard, diagonal and model-fitted stands accept different rib and brace thicknesses", () => {
  for (const advancedMode of [false, true]) for (const object of [undefined, boxModel()]) for (const angle of [0, 25, 45]) {
    const first = createSynthStand({ ...initialDesigns.stand, advancedMode, object, angle });
    const sheetThicknesses = Object.fromEntries(first.parts.map((p, i) => [p.id, i % 2 ? 10 : 5]));
    const stand = createSynthStand({ ...first.config, individualSheetMaterials: true, sheetThicknesses, cableHoles: true, roundedEdges: true });
    checkJoints(stand);
    for (const p of stand.parts) assert.equal(p.thickness, sheetThicknesses[p.id] ?? stand.config.thickness);
  }
});
test("protector cover slots, flush tabs and retaining holes fit their individual mating sheets", () => {
  for (const object of [undefined, boxModel()]) for (const lockingStrips of [false, true]) {
    const p = createSynthProtector({ ...initialDesigns.protector, object, angle: object ? 25 : 0, allSides: true, lockingStrips, individualSheetMaterials: true,
      sheetThicknesses: { "top-sheet": 10, "foot-left-1": 5, "foot-right-2": 10, "strip-left": 5, "strip-right": 10, "strip-front": 8 } });
    const cover = p.parts[0];
    assert.equal(cover.thickness, 10);
    for (const foot of p.parts.filter(p => p.kind === "foot")) {
      const nx = Math.round(Math.cos(foot.rotationY)), nd = Math.round(Math.sin(foot.rotationY));
      const tab = rect(-p.tabWidth / 2, -foot.thickness / 2, p.tabWidth / 2, foot.thickness / 2).map(poly => poly.map(ring => ring.map(([x,y]) => [foot.center[0] + nx*x - nd*y, foot.center[1] + nd*x + nx*y])));
      near(geometryArea(polygonClipping.intersection(tab, cover.polygons)), 0);
      const expected = sheetMaterial(p.config, `strip-${foot.edge}`).thickness;
      near(polygonBounds(foot.polygons).top, lockingStrips ? p.retention.holeBottom + expected + p.config.clearance + 6 : p.config.headroom + cover.thickness);
      if (lockingStrips) {
        const hole = polygonBounds([[foot.polygons[0][1]]]);
        near(hole.height, expected + p.config.clearance);
        near(hole.bottom, p.config.headroom + cover.thickness + 0.2);
      }
    }
  }
});
