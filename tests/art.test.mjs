import assert from "node:assert/strict";
import test from "node:test";
import { loadTypescript } from "./load-typescript.mjs";
const { createArt, defaultArtConfiguration: defaults, artExport, artSvg, normalizeArtConfiguration } = await loadTypescript("../lib/art.ts");
const { parseProject, makeProject, initialDesigns } = await loadTypescript("../lib/project.ts");
const { artFabrication, packSheets, stockSvg } = await loadTypescript("../lib/fabrication.ts");

test("growth is deterministic and material edits preserve generated outlines", () => {
  const first = createArt(defaults);
  assert.deepEqual(first, createArt(defaults));
  const changed = createArt({ ...defaults, seed: defaults.seed + 1 });
  assert.notDeepEqual(first.parts.map(p => p.settings), changed.parts.map(p => p.settings));
  assert.deepEqual(first.parts, createArt({ ...defaults, tint: { id: "green", label: "Green", color: "#008844" }, transparency: "opaque" }).parts);
  assert.equal(new Set(first.parts.map(p => p.settings.height)).size, first.parts.length);
  const uniform = createArt({ ...defaults, crown: 0, variation: 0, bendVariation: 0 });
  assert.ok(uniform.parts.every(p => p.settings.height === defaults.height && p.settings.bendAngle === defaults.bendAngle));
});

test("every crossing has a reciprocal slot at the same assembled location", () => {
  for (const rows of [2,4,10]) for (const columns of [2,6,10]) {
    const art = createArt({ ...defaults, rows, columns, width: 120, depth: 120, thickness: 6 });
    assert.equal(art.parts.length, rows + columns);
    for (const part of art.parts) {
      assert.equal(part.polygons.length, 1, "Every sheet stays connected");
      assert.equal(part.polygons[0].length, 1, "All slots open at the perimeter");
      assert.equal(part.slots.length, part.family === "a" ? columns : rows);
      for (const slot of part.slots) {
        const mate = art.parts.find(p => p.id === slot.mate);
        const reciprocal = mate.slots.find(s => s.mate === part.id);
        assert.equal(slot.center, part.family === "a" ? mate.position : -mate.position);
        assert.equal(reciprocal.center, mate.family === "a" ? part.position : -part.position);
        assert.notEqual(slot.opens, reciprocal.opens);
        assert.ok(Math.abs(slot.root - reciprocal.root) <= 0.201);
        assert.ok(Math.abs(slot.center) - art.slotWidth / 2 >= part.leafWidth / 2 + art.config.thickness - 1e-8, "Slots retain a web beside each leaf");
      }
      assert.ok(part.bend.start * 100 > art.baseHeight);
      assert.ok((part.bend.start + part.bend.length) * 100 < part.height);
      assert.equal(part.direction, Math.sign(part.position));
      assert.ok(part.polygons.flat(2).flat().every(Number.isFinite));
    }
  }
});

test("individual overrides survive generation; disabling bends produces flat sheets", () => {
  const config = { ...defaults, sheets: { "b-2": { height: 420, bendAngle: 60, bendLocation: 80 } } };
  for (const seed of [1,508,9999]) {
    const part = createArt({ ...config, seed }).parts.find(p => p.id === "b-2");
    assert.deepEqual(part.settings, config.sheets["b-2"]);
    assert.ok(part.height > 420, "Developed sheet adds bend allowance");
  }
  const straight = createArt({ ...config, bends: false });
  assert.ok(straight.parts.every(p => p.bend === null && p.height === p.settings.height));
  assert.equal(straight.parts.find(p => p.id === "b-2").settings.bendAngle,60);
  assert.equal(normalizeArtConfiguration({ ...defaults, rows: 3, seed: NaN }).rows,4);
});

test("art round-trips through design and project JSON and older projects gain defaults", () => {
  const art = createArt({ ...defaults, sheets: { "a-1": { height: 410, bendAngle: 0 } } });
  const single = parseProject(JSON.stringify(artExport(art)));
  assert.equal(single.mode,"art"); assert.deepEqual(single.designs.art,art.config);
  const project = makeProject("Botany","art",{ ...initialDesigns, art: art.config },[]);
  assert.deepEqual(parseProject(JSON.stringify(project)).designs.art,project.designs.art);
  assert.equal(parseProject(JSON.stringify(project)).mode,"art");
  delete project.designs.art; project.mode = "case";
  assert.deepEqual(parseProject(JSON.stringify(project)).designs.art,defaults);
  assert.throws(() => parseProject(JSON.stringify({ ...artExport(art), configuration: { ...art.config, sheets: { "a-1": { height: "bad" } } } })), /height/);
});

test("cutting SVG and stock sheets retain every part and separate bend guides", () => {
  const art = createArt(defaults), svg = artSvg(art);
  assert.equal((svg.match(/data-operation="cut"/g) ?? []).length,art.parts.length);
  assert.equal((svg.match(/data-operation="bend-guide"/g) ?? []).length,art.parts.length);
  assert.doesNotMatch(artSvg(createArt({ ...defaults, bends: false })),/data-operation="bend-guide"/);
  const fabrication = artFabrication(art), packed = packSheets(fabrication.parts,1000,600,10,true);
  assert.deepEqual(packed.unplaced,[]);
  assert.equal(packed.sheets.reduce((sum,sheet) => sum+sheet.parts.length,0),art.parts.length);
  assert.match(stockSvg(packed.sheets[0],1000,600,fabrication.warnings),/bend allowance/);
});
