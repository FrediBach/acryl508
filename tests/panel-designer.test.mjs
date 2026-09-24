import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";
import clipping from "polygon-clipping";
import { loadTypescript } from "./load-typescript.mjs";

const { createPanel, defaultPanelConfiguration: defaults, panelFormats, newPanelComponent, componentOutline, panelRectangle, panelSvg, panelExport, alignPanelItems } = await loadTypescript("../lib/panel-designer.ts");
const { geometryArea, normalizeOutlines, outlinePath, polygonBounds } = await loadTypescript("../lib/custom-cutouts.ts");
const { typefaceFont, textOutlines } = await loadTypescript("../lib/cutout-sources.ts");
const { ventPresets } = await loadTypescript("../lib/vent-design.ts");
const near = (a, b, tolerance = 1e-4) => assert.ok(Math.abs(a - b) < tolerance, `${a} ≈ ${b}`);
const art = (polygons, patch = {}) => ({ id: "art", name: "Artwork", source: { kind: "svg", fileName: "art.svg" }, side: "front", operation: "engrave", polygons: normalizeOutlines(polygons), x: 0, y: 0, rotation: 0, width: 20, ...patch });

test("the three formats follow their manufacturers' height and mounting drawings", () => {
  for (const [format, expected] of Object.entries({ "3u": [128.5, 122.5, 7.5, 3.2], "intellijel-1u": [39.65, 33.65, 7.5, 3.2], "pulp-logic-1u": [43.18, 37.1856, 5.08, 3.175] })) {
    const panel = createPanel({ ...defaults, format, hp: 12 });
    near(panel.width, 60.66); near(panel.height, expected[0]);
    assert.equal(panel.mounts.length, 4);
    near(panel.mounts[1].y - panel.mounts[0].y, expected[1]);
    near(panel.mounts[0].x + panel.width / 2, expected[2]); near(panel.mounts[0].diameter, expected[3]);
    near((panel.mounts[2].x - panel.mounts[0].x) / 5.08, format === "pulp-logic-1u" ? 10 : 9);
    assert.equal(panel.polygons.length, 1); assert.equal(panel.polygons[0].length, 5);
    assert.equal(panel.canExport, true); assert.deepEqual(panel.warnings, []);
  }
  assert.equal(createPanel({ ...defaults, format: "pulp-logic-1u", hp: 7 }).config.hp, 6);
});

test("narrow panels and slots keep mounting openings inside the acrylic", () => {
  for (const hp of [2, 3, 4, 8, 12, 84]) for (const format of Object.keys(panelFormats)) for (const mounting of ["holes", "slots"]) {
    const panel = createPanel({ ...defaults, format, hp, mounting, mountingCount: "four", slotTravel: 4, widthClearance: 0.5 });
    assert.equal(panel.canExport, true);
    for (const mount of panel.mounts) {
      const b = polygonBounds(mount.polygons);
      assert.ok(b.left > -panel.width / 2 && b.right < panel.width / 2);
      assert.ok(b.bottom > -panel.height / 2 && b.top < panel.height / 2);
    }
  }
});

test("circles, rectangles and slots transform around the component centre", () => {
  const c = { ...newPanelComponent("display", "screen"), x: 12, y: -8, width: 24, height: 12, rotation: 90 };
  const b = polygonBounds(componentOutline(c));
  near(b.width, 12); near(b.height, 24); near((b.left + b.right) / 2, 12); near((b.bottom + b.top) / 2, -8);
  for (const shape of ["circle", "rectangle", "slot"]) {
    const panel = createPanel({ ...defaults, components: [{ ...c, x: 0, y: 0, shape }] });
    assert.equal(panel.polygons[0].length, 6);
    near(geometryArea(clipping.intersection(panel.polygons, panel.components[0].polygons)), 0);
  }
});

test("engraving retains letter counters; cutting removes their loose islands", async () => {
  const font = typefaceFont(JSON.parse(await readFile(new URL("../public/fonts/helvetiker-regular.json", import.meta.url))), "Test");
  const artwork = { ...art(panelRectangle(20, 10)), polygons: textOutlines(font, "ABO8"), width: 32 };
  const blank = createPanel(defaults), engraved = createPanel({ ...defaults, artwork: [artwork] });
  near(geometryArea(engraved.polygons), geometryArea(blank.polygons));
  assert.equal(engraved.engravings[0].polygons.reduce((sum, p) => sum + p.length - 1, 0), 6);
  const cut = createPanel({ ...defaults, artwork: [{ ...artwork, operation: "cut" }] });
  assert.equal(cut.report.removedParts, 6); assert.equal(cut.engravings.length, 0);
  assert.ok(geometryArea(cut.polygons) < geometryArea(blank.polygons));
  assert.match(cut.warnings.join(" "), /loose part/);
});

test("engraving clips at cutouts and sheet edges without altering the cut geometry", () => {
  const component = newPanelComponent("jack", "jack");
  const panel = createPanel({ ...defaults, components: [component], artwork: [art(panelRectangle(20, 20)), art(panelRectangle(20, 20), { id: "outside", x: 28 })] });
  for (const engraving of panel.engravings) {
    near(geometryArea(clipping.difference(engraving.polygons, panel.polygons)), 0);
    near(geometryArea(clipping.intersection(engraving.polygons, panel.components[0].polygons)), 0);
  }
  assert.match(panel.warnings.join(" "), /engraving outside retained acrylic/);
});

test("fit checks identify body clashes, mounting conflicts, edge cuts and thread limits", () => {
  const a = { ...newPanelComponent("pot", "a"), name: "Level", maxPanelThickness: 2 };
  const b = { ...newPanelComponent("jack", "b"), name: "Input", x: 8 };
  const c = { ...newPanelComponent("switch", "c"), name: "Switch", x: -22.83, y: 61.25 };
  const panel = createPanel({ ...defaults, components: [a, b, c] });
  const warnings = panel.warnings.join(" ");
  assert.match(warnings, /body clearance boxes overlap/); assert.match(warnings, /exceeds the specified 2 mm/);
  assert.match(warnings, /approaches a mounting hole/); assert.match(warnings, /rail reserve/); assert.match(warnings, /less than 3 mm/);
});

test("vent patterns stay connected, avoid reserved areas and reproduce their seed", () => {
  for (const shape of ["circles", "slots", "hexagons"]) for (const preset of ventPresets) {
    const config = { ...defaults, hp: 20, components: [newPanelComponent("pot", "pot")], artwork: [art(panelRectangle(20, 8), { y: 25 })], vents: { ...defaults.vents, enabled: true, shape, design: preset.design } };
    const panel = createPanel(config);
    assert.ok(panel.vents.length > 0); assert.equal(panel.canExport, true); assert.equal(panel.report.removedParts, 0);
    const body = panel.components[0].body;
    for (const vent of panel.vents) {
      const b = polygonBounds(vent);
      assert.ok(b.left >= -panel.width / 2 + panel.ventMargin - 1e-4 && b.right <= panel.width / 2 - panel.ventMargin + 1e-4);
      near(geometryArea(clipping.intersection(vent, body)), 0);
      for (const mount of panel.mounts) near(geometryArea(clipping.intersection(vent, mount.polygons)), 0);
    }
    assert.deepEqual(createPanel(config).vents, panel.vents);
  }
  const narrow = createPanel({ ...defaults, hp: 2, vents: { ...defaults.vents, enabled: true } });
  assert.equal(narrow.vents.length, 0); assert.match(narrow.warnings.join(" "), /No ventilation openings fit/);
  const dense = createPanel({ ...defaults, hp: 84, thickness: 1.5, vents: { ...defaults.vents, enabled: true, pitch: 4, size: 1, margin: 4 } });
  assert.ok(dense.vents.length > 0 && dense.vents.length <= 600);
  assert.ok(dense.ventPitch > 4);
});

test("alignment and distribution work across component and artwork selections", () => {
  const a = { ...newPanelComponent("jack", "a"), x: -20, y: -10 }, b = { ...newPanelComponent("pot", "b"), x: 6, y: 4 };
  const c = art(panelRectangle(10, 5), { id: "c", x: 20, y: 10 });
  const config = { ...defaults, components: [a, b], artwork: [c] };
  const row = alignPanelItems(config, ["a", "b", "c"], "row");
  assert.deepEqual([...row.components, ...row.artwork].map(i => i.y), [-10, -10, -10]);
  const distributed = alignPanelItems(config, ["a", "b", "c"], "distribute-x");
  assert.deepEqual([...distributed.components, ...distributed.artwork].map(i => i.x), [-20, 0, 20]);
  const centred = alignPanelItems(config, ["a", "b"], "center-x");
  near(centred.components[0].x + centred.components[1].x, 0); near(centred.components[1].x - centred.components[0].x, 26);
  assert.equal(centred.artwork[0].x, 20);
});

test("SVG and JSON preserve full-size shared geometry and separate fabrication operations", () => {
  const panel = createPanel({ ...defaults, components: [newPanelComponent("jack", "jack")], artwork: [art(panelRectangle(10, 5), { name: 'A&B <"test">', y: 25 })] });
  const dom = new JSDOM(panelSvg(panel), { contentType: "image/svg+xml" });
  const doc = dom.window.document;
  assert.equal(doc.documentElement.getAttribute("width"), `${panel.width}mm`);
  assert.equal(doc.documentElement.getAttribute("height"), `${panel.height}mm`);
  assert.equal(doc.querySelector("#panel-cut").getAttribute("d"), outlinePath(panel.polygons));
  assert.equal(doc.querySelector("#engrave path").getAttribute("d"), outlinePath(panel.engravings[0].polygons));
  assert.equal(doc.querySelector("#engrave path").getAttribute("data-name"), 'A&B <"test">');
  assert.equal(doc.querySelectorAll("text").length, 0);
  assert.equal(doc.querySelector("#cut").getAttribute("data-operation"), "cut");
  const data = JSON.parse(JSON.stringify(panelExport(panel)));
  assert.equal(data.mode, "panel-designer"); assert.deepEqual(data.layers.cut, panel.polygons);
  assert.deepEqual(createPanel(data.configuration).polygons, panel.polygons);
  assert.deepEqual(createPanel(data.configuration).engravings, panel.engravings);
  dom.window.close();
});

test("empty panels cannot produce a misleading SVG", () => {
  const panel = createPanel({ ...defaults, artwork: [art(panelRectangle(1, 1), { operation: "cut", width: 500 })] });
  assert.equal(panel.canExport, false); assert.throws(() => panelSvg(panel), /Resolve the panel geometry/);
  assert.equal(panelExport(panel).canExportSvg, false);
});
