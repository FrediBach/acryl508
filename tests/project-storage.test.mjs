import assert from "node:assert/strict";
import test from "node:test";
import { indexedDB } from "fake-indexeddb";
import { loadTypescript } from "./load-typescript.mjs";

globalThis.indexedDB = indexedDB;
const { readSavedProject, writeSavedProject, listSavedProjects } = await loadTypescript("../lib/project-storage.ts");
const { makeProject, initialDesigns } = await loadTypescript("../lib/project.ts");
const { addProjectFont, getFontAssets, getFonts, prepareFonts, replaceFonts } = await loadTypescript("../lib/project-fonts.ts");
const { builtinFonts } = await loadTypescript("../lib/cutout-sources.ts");

test("autosaves and named copies persist independently and reads cannot mutate saved data", async () => {
  const project = makeProject("Version one", "case", initialDesigns, []);
  await writeSavedProject("copy-one", project);
  await writeSavedProject("autosave", { ...project, name: "Working draft" });
  assert.equal((await readSavedProject("autosave")).project.name, "Working draft");
  const saved = await readSavedProject("copy-one");
  saved.project.designs.case.hp = 150;
  assert.equal((await readSavedProject("copy-one")).project.designs.case.hp, 84);
  assert.deepEqual((await listSavedProjects()).map(item => item.id), ["copy-one"]);
  await writeSavedProject("autosave", { ...project, name: "Latest draft" });
  assert.equal((await readSavedProject("autosave")).project.name, "Latest draft");
  assert.equal((await readSavedProject("copy-one")).project.name, "Version one");
  assert.equal(await readSavedProject("missing"), undefined);
});

test("project font bytes restore editable outlines and malformed fonts leave the registry intact", async () => {
  const { default: opentype } = await import("opentype.js");
  const path = new opentype.Path(); path.moveTo(0, 0); path.lineTo(600, 0); path.lineTo(600, 700); path.lineTo(0, 700); path.close();
  const font = new opentype.Font({ familyName: "Workspace Test", styleName: "Regular", unitsPerEm: 1000, ascender: 800, descender: -200, glyphs: [new opentype.Glyph({ name: ".notdef", advanceWidth: 600, path: new opentype.Path() }), new opentype.Glyph({ name: "A", unicode: 65, advanceWidth: 700, path })] });
  const buffer = font.toArrayBuffer();
  const id = await addProjectFont({ name: "workspace.ttf", size: buffer.byteLength, arrayBuffer: async () => buffer });
  const records = structuredClone(getFontAssets());
  assert.equal(records[0].id, id);
  const shapes = getFonts().find(font => font.id === id).font.shapes("AA");
  assert.equal(shapes.length, 2);
  replaceFonts([], []); assert.deepEqual(getFonts().map(font => font.id), builtinFonts.map(font => font.id));
  replaceFonts(records, await prepareFonts(records));
  assert.equal(getFonts().find(font => font.id === id).font.shapes("AAA").length, 3);
  const before = getFonts();
  await assert.rejects(prepareFonts([{ id: "broken", name: "Broken", data: "AA==" }]));
  assert.equal(getFonts(), before);
  await writeSavedProject("font-project", makeProject("With fonts", "panel", initialDesigns, records));
  assert.deepEqual((await readSavedProject("font-project")).project.fonts, records);
});
