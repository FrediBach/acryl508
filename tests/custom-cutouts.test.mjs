import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { ExtrudeGeometry } from "three";
import { loadTypescript } from "./load-typescript.mjs";

const { normalizeOutlines, subtractCutouts, placedCutout, polygonBounds, geometryArea, cutoutSides } = await loadTypescript("../lib/custom-cutouts.ts");
const { createCasePanels } = await loadTypescript("../lib/case-panels.ts");
const { defaultConfiguration, configurationExport } = await loadTypescript("../lib/configurator.ts");
const { typefaceFont, textOutlines, importFont, importSvg } = await loadTypescript("../lib/cutout-sources.ts");
const rectangle = (left, bottom, right, top) => [[left, bottom], [right, bottom], [right, top], [left, top], [left, bottom]];
const panel = [[rectangle(-50, -40, 50, 40)]];
const cut = (polygons, overrides = {}) => ({ id: "cut", name: "Test", source: { kind: "svg", fileName: "test.svg" }, polygons, side: "front", width: 20, x: 0, y: 0, rotation: 0, ...overrides });
const near = (actual, expected, tolerance = 1e-7) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);

test("a ring cut removes its enclosed loose centre, leaving exactly one solid sheet", () => {
  const donut = normalizeOutlines([[rectangle(-10, -10, 10, 10), rectangle(-5, -5, 5, 5)]]);
  const result = subtractCutouts(panel, [cut(donut)], "front");
  assert.equal(result.report.removedParts, 1);
  near(result.report.removedArea, 100);
  near(geometryArea(result.polygons), 8000 - 400);
  assert.equal(result.polygons.length, 1);
  assert.equal(result.polygons[0].length, 2);
});

test("overlapping cutouts are combined before deciding which material is loose", () => {
  const square = normalizeOutlines([[rectangle(-1, -1, 1, 1)]]);
  const cuts = [-30, -10, 10, 30].map((y, i) => cut(square, { id: String(i), width: 25, x: 20, y }));
  const result = subtractCutouts(panel, cuts, "front");
  assert.equal(result.report.removedParts, 1);
  near(result.report.removedArea, 17.5 * 80);
  near(geometryArea(result.polygons), 57.5 * 80);
  assert.equal(result.report.clipped.length, 2);
  const reverse = subtractCutouts(panel, [...cuts].reverse(), "front");
  near(geometryArea(reverse.polygons), geometryArea(result.polygons));
});

test("an enclosed island is removed even when larger than the panel frame", () => {
  const ring = normalizeOutlines([[rectangle(-45, -35, 45, 35), rectangle(-44, -34, 44, 34)]]);
  const result = subtractCutouts(panel, [cut(ring, { width: 90 })], "front");
  near(geometryArea(result.polygons), 8000 - 90 * 70);
  near(result.report.removedArea, 88 * 68);
  assert.equal(result.report.removedParts, 1);
});

test("cuts connecting existing openings also remove newly separated parts", () => {
  const existing = [[rectangle(-50, -40, 50, 40), rectangle(10, -30, 20, 30)]];
  const slot = normalizeOutlines([[rectangle(0, 0, 10, 20)]]);
  const result = subtractCutouts(existing, [cut(slot, { width: 10, x: 15, y: -35 }), cut(slot, { id: "upper", width: 10, x: 15, y: 35 })], "front");
  assert.equal(result.report.removedParts, 1);
  near(result.report.removedArea, 30 * 80);
  near(geometryArea(result.polygons), 60 * 80);
});

test("outside cuts, overlapping identical cuts and complete removal are handled", () => {
  const square = normalizeOutlines([[rectangle(-1, -1, 1, 1)]]);
  const outside = subtractCutouts(panel, [cut(square, { x: 500 })], "front");
  assert.deepEqual(outside.report.outside, ["cut"]);
  near(geometryArea(outside.polygons), 8000);
  const duplicate = subtractCutouts(panel, [cut(square), cut(square, { id: "copy" })], "front");
  near(geometryArea(duplicate.polygons), 7600);
  assert.equal(duplicate.report.removedParts, 0);
  const empty = subtractCutouts(panel, [cut(square, { width: 200 })], "front");
  assert.deepEqual(empty.polygons, []);
  assert.equal(empty.report.empty, true);
  const allPerimeterCut = normalizeOutlines([[rectangle(-100, -100, 100, 100), rectangle(-10, -10, 10, 10)]]);
  const detachedCentre = subtractCutouts(panel, [cut(allPerimeterCut, { width: 200 })], "front");
  assert.deepEqual(detachedCentre.polygons, []);
  assert.equal(detachedCentre.report.removedParts, 1);
  assert.equal(detachedCentre.report.empty, true);
  const config = { ...defaultConfiguration, cutouts: [cut(square, { width: 1000 })] };
  const shapes = createCasePanels(config).faces.front.shapes;
  assert.deepEqual(shapes, []);
  const geometry = new ExtrudeGeometry(shapes, { depth: 0.05, bevelEnabled: false });
  assert.equal(geometry.getAttribute("position").count, 0);
  geometry.dispose();
});

test("cutouts scale uniformly, rotate around their centre and translate in mm", () => {
  const wide = normalizeOutlines([[rectangle(10, 20, 50, 40)]]);
  const bounds = polygonBounds(placedCutout(cut(wide, { width: 40, rotation: 90, x: 30, y: -10 })));
  near(bounds.width, 20); near(bounds.height, 40);
  near(bounds.left, 20); near(bounds.bottom, -30);
  assert.throws(() => normalizeOutlines([]), /No filled outline/);
  assert.throws(() => normalizeOutlines([[[[NaN, 0], [1, 0], [1, 1]]]]), /invalid coordinates/);
});

test("both bundled fonts remove all enclosed centres for A, B, O and 8", async () => {
  for (const name of ["helvetiker", "optimer"]) {
    const data = JSON.parse(await readFile(new URL(`../public/fonts/${name}-regular.json`, import.meta.url)));
    const font = typefaceFont(data, name);
    for (const [text, count] of [["A", 1], ["B", 2], ["O", 1], ["8", 2], ["ABO8", 6]]) {
      const result = subtractCutouts(panel, [cut(textOutlines(font, text), { width: 50 })], "front");
      assert.equal(result.report.error, undefined);
      assert.equal(result.report.removedParts, count, `${name}: ${text}`);
      assert.ok(result.report.removedArea > 0);
    }
    assert.throws(() => textOutlines(font, "   "), /Enter some text/);
    assert.throws(() => textOutlines(font, "😀"), /no outline/);
  }
});

test("imported OpenType fonts preserve counters and report missing glyphs", async () => {
  const { default: opentype } = await import("opentype.js");
  const path = new opentype.Path();
  path.moveTo(0, 0); path.lineTo(600, 0); path.lineTo(600, 700); path.lineTo(0, 700); path.close();
  path.moveTo(200, 200); path.lineTo(200, 500); path.lineTo(400, 500); path.lineTo(400, 200); path.close();
  const font = new opentype.Font({ familyName: "Test", styleName: "Regular", unitsPerEm: 1000, ascender: 800, descender: -200, glyphs: [new opentype.Glyph({ name: ".notdef", advanceWidth: 600, path: new opentype.Path() }), new opentype.Glyph({ name: "O", unicode: 79, advanceWidth: 700, path })] });
  const imported = await importFont(font.toArrayBuffer(), "Test");
  const result = subtractCutouts(panel, [cut(textOutlines(imported, "O"))], "front");
  assert.equal(result.report.removedParts, 1);
  assert.throws(() => textOutlines(imported, "X"), /no outline/);
  await assert.rejects(importFont(new ArrayBuffer(8), "Broken"), /could not be read/);
});

test("cutouts affect only the selected panel and read correctly from every outside face", () => {
  const original = createCasePanels(defaultConfiguration);
  const square = normalizeOutlines([[rectangle(-1, -1, 1, 1)]]);
  for (const { value: side } of cutoutSides) {
    const model = createCasePanels({ ...defaultConfiguration, vents: false, cutouts: [cut(square, { side, x: 25, y: 5, width: 10 })] });
    for (const { value: other } of cutoutSides.filter(item => item.value !== side && item.value !== "bottom")) {
      assert.deepEqual(model.faces[other].polygons, original.faces[other].polygons);
    }
    const addedHole = model.faces[side].shapes[0].holes.map(hole => polygonBounds([[[...hole.getPoints().map(point => [point.x, point.y])]]])).find(bounds => Math.abs(bounds.width - 0.1) < 1e-6 && Math.abs(bounds.height - 0.1) < 1e-6);
    assert.ok(addedHole, side);
    const sign = ["left", "rear", "bottom"].includes(side) ? -1 : 1;
    near((addedHole.left + addedHole.right) / 2, sign * 0.25);
    near((addedHole.bottom + addedHole.top) / 2, side === "bottom" ? 0.05 : 0.5);
    const geometry = new ExtrudeGeometry(model.faces[side].shapes, { depth: 0.05, bevelEnabled: false });
    try {
      assert.ok(geometry.getAttribute("position").array.every(Number.isFinite));
      const positions = geometry.getAttribute("position");
      let area = 0;
      for (let i = 0; i < positions.count; i += 3) if ([0, 1, 2].every(j => positions.getZ(i + j) === 0)) {
        area += Math.abs((positions.getX(i + 1) - positions.getX(i)) * (positions.getY(i + 2) - positions.getY(i)) - (positions.getY(i + 1) - positions.getY(i)) * (positions.getX(i + 2) - positions.getX(i))) / 2;
      }
      near(area, geometryArea(model.faces[side].polygons) / 10000, 1e-6);
    } finally { geometry.dispose(); }
  }
});

test("resizing and enabling accessories recalculate cuts without stale warnings", () => {
  const ring = normalizeOutlines([[rectangle(-1, -1, 1, 1), rectangle(-0.5, -0.5, 0.5, 0.5)]]);
  for (const thickness of [3, 6]) for (const angle of [0, 30]) for (const rows of [1, 3]) {
    const config = { ...defaultConfiguration, hp: 20, thickness, angle, rows, handle: true, cutouts: [cut(ring)] };
    const model = createCasePanels(config);
    assert.equal(model.faces.front.report.removedParts, 1);
    const without = createCasePanels({ ...config, cutouts: [] });
    assert.ok(without.reports.every(report => !report.removedParts));
    const exported = JSON.parse(JSON.stringify(configurationExport(config, model.reports, { front: model.faces.front.polygons })));
    assert.deepEqual(exported.configuration.cutouts, config.cutouts);
    assert.equal(exported.customCutouts.reports.find(report => report.side === "front").removedParts, 1);
    assert.match(exported.customCutouts.loosePartPolicy, /largest connected/);
    assert.deepEqual(exported.customCutouts.resolvedPanelOutlinesMm.front, model.faces.front.polygons);
    near(geometryArea(exported.customCutouts.resolvedPanelOutlinesMm.front), geometryArea(model.faces.front.original) - 400);
  }
});

test("SVG imports preserve transforms, fill rules and hidden shapes; reject unsafe or unsupported content", async () => {
  const { JSDOM } = await import("jsdom");
  const dom = new JSDOM("");
  globalThis.DOMParser = dom.window.DOMParser;
  globalThis.XMLSerializer = dom.window.XMLSerializer;
  try {
    const svg = body => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${body}</svg>`;
    const imported = importSvg(svg('<g transform="translate(10 20) scale(2)"><path fill-rule="evenodd" d="M0 0h20v20H0Z M5 5h10v10H5Z"/></g><g style="display:none"><rect width="1000" height="1000"/></g>'));
    assert.equal(subtractCutouts(panel, [cut(imported)], "front").report.removedParts, 1);
    near(polygonBounds(imported).height, 1);
    const filled = importSvg(svg('<path fill-rule="nonzero" d="M0 0h20v20H0Z M5 5h10v10H5Z"/>'));
    assert.equal(subtractCutouts(panel, [cut(filled)], "front").report.removedParts, 0);
    const inline = importSvg(svg('<rect style="fill:black;stroke:none" x="10" y="20" width="40" height="10"/>'));
    near(polygonBounds(inline).height, 0.25);
    assert.throws(() => importSvg("not svg"), /valid SVG/);
    assert.throws(() => importSvg(svg('<path d="M0 0L10 10" stroke="black" fill="none"/>')), /strokes to filled paths/);
    for (const body of ['<script>alert(1)</script>', '<text>Hello</text>', '<image href="https://example.com/a.png"/>', '<use href="#x"/>', '<rect width="10" height="10" onclick="alert(1)"/>', '<rect width="10" height="10" fill="url(https://example.com/a)"/>']) {
      assert.throws(() => importSvg(svg(body)));
    }
  } finally { dom.window.close(); delete globalThis.DOMParser; delete globalThis.XMLSerializer; }
});
