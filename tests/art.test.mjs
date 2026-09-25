import assert from "node:assert/strict";
import test from "node:test";
import { loadTypescript } from "./load-typescript.mjs";
const { createArt, defaultArtConfiguration: defaults, artExport, artSvg, normalizeArtConfiguration, artPartPoint } = await loadTypescript("../lib/art.ts");
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


test("optional shelves add inward perpendicular leaf outlines and closed slots beyond each bend", () => {
  const art = createArt({ ...defaults, leafShelves: true });
  const shelves = art.parts.filter(p => p.shelf);
  assert.equal(shelves.length, defaults.rows + defaults.columns);
  assert.deepEqual(art.shelfWarnings, []);
  for (const part of shelves) {
    const joint = part.shelf, parent = art.parts.find(p => p.id === joint.parent);
    assert.equal(parent.polygons.length, 1);
    assert.equal(parent.polygons[0].length, 2, "A closed slot leaves the parent connected");
    assert.equal(part.polygons.length, 1);
    assert.equal(part.polygons[0].length, 1);
    assert.ok(joint.slotY - joint.slotHeight / 2 >= (parent.bend.start + parent.bend.length) * 100 + 2 * parent.thickness - 1e-8);
    const hole = parent.polygons[0][1];
    assert.ok(Math.abs(Math.max(...hole.map(p => p[0])) - Math.min(...hole.map(p => p[0])) - joint.slotWidth) < 1e-8);
    assert.ok(Math.abs(joint.slotWidth - joint.tabWidth - defaults.clearance) < 1e-8);
    const anchor = artPartPoint(parent, 0, joint.slotY, parent.thickness / 2);
    const tabCentre = artPartPoint(part, 0, joint.tabDepth / 2, part.thickness / 2);
    for (const key of ["x", "y", "z"]) assert.ok(Math.abs(anchor[key] - tabCentre[key]) < 1e-8);
    const tip = artPartPoint(part, 0, part.height, part.thickness / 2);
    const parentUp = artPartPoint(parent, 0, joint.slotY + 1, parent.thickness / 2);
    const tangent = [parentUp.x - anchor.x, parentUp.y - anchor.y, parentUp.z - anchor.z];
    const growth = [tip.x - anchor.x, tip.y - anchor.y, tip.z - anchor.z];
    assert.ok(Math.abs(growth.reduce((sum, v, i) => sum + v * tangent[i], 0)) < 1e-8, "Shelf projects at 90 degrees to the bent leaf");
    assert.ok(part.direction * (part.family === "a" ? growth[2] : growth[0]) < 0, "Shelf points inward on both families and sides");
    assert.ok(growth[1] > 0, "Inward shelf tilts up with the bent leaf");
    for (const [x,y] of part.polygons[0][0]) {
      const top = artPartPoint(part, x, y, part.thickness);
      const offset = [top.x - anchor.x, top.y - anchor.y, top.z - anchor.z];
      assert.ok(Math.abs(offset.reduce((sum, v, i) => sum + v * tangent[i], 0) - part.thickness / 2) < 1e-8);
    }
    assert.deepEqual(part.polygons[0][0].slice(0, 3), [[-joint.tabWidth / 2, 0], [joint.tabWidth / 2, 0], [joint.tabWidth / 2, joint.tabDepth]]);
  }
  assert.deepEqual(createArt({ ...art.config, leafShelves: false }).parts, createArt(defaults).parts);
});

test("shelf tabs clear the full parent thickness at every supported bend angle", () => {
  for (const angle of [1,35,60,75]) for (const parentThickness of [3,6]) for (const thickness of [3,6]) {
    const art = createArt({ ...defaults, leafShelves: true, width: 600, depth: 600, height: 600, crown: 0, variation: 0, bendAngle: angle, bendVariation: 0,
      individualSheetMaterials: true, sheetThicknesses: { "a-1": parentThickness, "shelf-a-1": thickness } });
    for (const part of art.parts.filter(p => p.shelf)) {
      const joint = part.shelf, parent = art.parts.find(p => p.id === joint.parent);
      assert.equal(joint.slotHeight, part.thickness + art.config.clearance);
      assert.ok(joint.tabDepth > parent.thickness);
      // The tab corners meet the slot on both parent faces after assembly.
      for (const v of [-part.thickness / 2, part.thickness / 2]) for (const n of [-parent.thickness / 2, parent.thickness / 2]) {
        const onParent = artPartPoint(parent, 0, joint.slotY + v, parent.thickness / 2 + n);
        const onShelf = artPartPoint(part, 0, joint.tabDepth / 2 - parent.direction * n, part.thickness / 2 + v);
        for (const key of ["x", "y", "z"]) assert.ok(Math.abs(onParent[key] - onShelf[key]) < 1e-8, "Perpendicular tab and slot faces align");
      }
    }
  }
});

test("shelf limits preserve connected leaves and explain omitted shelves", () => {
  for (const height of [100,600]) for (const count of [2,10]) for (const bendLocation of [10,85]) for (const bendAngle of [1,75]) {
    const art = createArt({ ...defaults, leafShelves: true, height, rows: count, columns: count, width: 120, depth: 120, thickness: 6, bendLocation, bendAngle, bendVariation: 0 });
    const shelves = art.parts.filter(p => p.shelf);
    assert.equal(shelves.length + art.shelfWarnings.length, count * 2);
    for (const part of art.parts) {
      assert.equal(part.polygons.length, 1);
      assert.ok(part.polygons.flat(2).flat().every(Number.isFinite));
      if (!part.shelf) assert.equal(part.polygons[0].length, shelves.some(p => p.shelf.parent === part.id) ? 2 : 1);
    }
  }
  const straight = createArt({ ...defaults, leafShelves: true, bends: false });
  assert.ok(straight.parts.every(p => !p.shelf && p.polygons[0].length === 1));
  const mixed = createArt({ ...defaults, leafShelves: true, sheets: { "a-1": { bendAngle: 0 } } });
  assert.equal(mixed.parts.filter(p => p.shelf).length, 7);
});

test("shelves and their materials survive projects, cut exports and stock packing", () => {
  const art = createArt({ ...defaults, leafShelves: true, shelfWidth: 90, shelfDepth: 100, individualSheetMaterials: true,
    sheetThicknesses: { "shelf-a-1": 6 }, sheetTints: { "a-1": { id: "blue", label: "Blue", color: "#0044cc" } } });
  assert.deepEqual(parseProject(JSON.stringify(artExport(art))).designs.art, art.config);
  assert.deepEqual(parseProject(JSON.stringify(makeProject("Shelves", "art", { ...initialDesigns, art: art.config }, []))).designs.art, art.config);
  const oldConfig = { ...defaults }; delete oldConfig.leafShelves; delete oldConfig.shelfWidth; delete oldConfig.shelfDepth;
  assert.equal(parseProject(JSON.stringify({ ...artExport(art), configuration: oldConfig })).designs.art.leafShelves, false);
  const svg = artSvg(art);
  assert.equal((svg.match(/data-operation="cut"/g) ?? []).length, art.parts.length);
  assert.equal((svg.match(/data-operation="bend-guide"/g) ?? []).length, 8);
  assert.match(svg, /id="shelf-a-1" data-thickness-mm="6" data-color="#0044cc"/);
  const fabrication = artFabrication(art), packed = packSheets(fabrication.parts, 1000, 600, 10, true);
  assert.deepEqual(packed.unplaced, []);
  assert.equal(packed.sheets.flatMap(s => s.parts).length, art.parts.length);
  assert.ok(packed.sheets.some(s => s.thickness === 6 && s.parts.some(p => p.id === "shelf-a-1")));
});


test("shelf appearance follows parent edits and overrides old independent shelf colors everywhere", () => {
  const blue = { id: "blue", label: "Blue", color: "#0044cc" };
  const red = { id: "red", label: "Red", color: "#ff0000" };
  const config = { ...defaults, leafShelves: true, individualSheetMaterials: true,
    sheetTints: { "a-1": blue, "shelf-a-1": red, "b-4": red, "shelf-b-4": blue },
    sheetTransparencies: { "a-1": "opaque", "shelf-a-1": "transparent" } };
  for (const input of [config, { ...config, sheetTints: { ...config.sheetTints, "a-1": red } }, { ...config, individualSheetMaterials: false }]) {
    const art = createArt(input), materials = artExport(art).sheetMaterials, fabrication = artFabrication(art);
    for (const part of art.parts.filter(p => p.shelf)) {
      const parent = materials.find(m => m.id === part.shelf.parent), shelf = materials.find(m => m.id === part.id);
      assert.deepEqual(shelf.tint, parent.tint);
      assert.equal(shelf.transparency, parent.transparency);
      assert.equal(fabrication.parts.find(p => p.id === part.id).material, fabrication.parts.find(p => p.id === part.shelf.parent).material);
      assert.ok(artSvg(art).includes(`id="${part.id}" data-thickness-mm="${part.thickness}" data-color="${parent.tint.color}" data-transparency="${parent.transparency}"`));
    }
  }
  const restored = createArt(parseProject(JSON.stringify(artExport(createArt(config)))).designs.art);
  assert.equal(artExport(restored).sheetMaterials.find(m => m.id === "shelf-a-1").tint.color, blue.color);
});
