import assert from "node:assert/strict";
import test from "node:test";
import { loadTypescript } from "./load-typescript.mjs";
import clipping from "polygon-clipping";
import { JSDOM } from "jsdom";
const { defaultConfiguration, configurationExport } = await loadTypescript("../lib/configurator.ts");
const { createCasePanels, caseCanExport } = await loadTypescript("../lib/case-panels.ts");
const { defaultLedStrip, resolveEngravings } = await loadTypescript("../lib/engravings.ts");
const { geometryArea, normalizeOutlines, mapPolygons, placedCutout, polygonsToShapes } = await loadTypescript("../lib/custom-cutouts.ts");
const { configurationSvg, caseSheetLayout } = await loadTypescript("../lib/svg-export.ts");
const { caseFabrication, panelFabrication, packSheets, stockSvg } = await loadTypescript("../lib/fabrication.ts");
const { readCase, readPanel } = await loadTypescript("../lib/project.ts");
const { defaultPanelConfiguration, createPanel } = await loadTypescript("../lib/panel-designer.ts");
const { bentPanelGeometry } = await loadTypescript("../lib/bent-panel-geometry.ts");
const rect = (l, b, r, t) => [[l,b],[r,b],[r,t],[l,t],[l,b]];
const ring = normalizeOutlines([[rect(-10,-10,10,10), rect(-5,-5,5,5)]]);
const art = (side = "front", patch = {}) => ({ id: "engraving", name: "O", side, source: { kind: "svg", fileName: "letter.svg" }, polygons: ring, width: 20, x: 0, y: 0, rotation: 0, ...patch });
const near = (a, b) => assert.ok(Math.abs(a-b) < 1e-6, `${a} != ${b}`);

test("engraving preserves the sheet and counters, merges overlapping artwork, and clips at openings", () => {
  const blank = createCasePanels(defaultConfiguration);
  for (const side of ["front", "rear", "left", "right", "bottom"]) {
    const config = { ...defaultConfiguration, engravings: [art(side), art(side, { id: "copy" })] };
    const panels = createCasePanels(config), face = panels.faces[side];
    assert.deepEqual(face.polygons, blank.faces[side].polygons);
    near(geometryArea(face.engraving.polygons), geometryArea(clipping.intersection(face.polygons, placedCutout(art(side)))));
    assert.equal(face.report.removedParts, 0);
    assert.equal(face.engraving.polygons[0].length, 2);
  }
  const sheet = [[rect(-30,-30,30,30), rect(0,-5,8,5)]];
  const result = resolveEngravings(sheet, [art("front", { x: 27 }), art("front", { id: "outside", x: 100 })]);
  assert.deepEqual(result.clipped, ["engraving"]);
  assert.deepEqual(result.outside, ["outside"]);
  near(geometryArea(clipping.difference(result.polygons, sheet)), 0);
});

test("all case sheets get a real thin LED cut and bottom vents leave clearance", () => {
  for (const side of ["front", "rear", "left", "right", "bottom"]) {
    const blank = createCasePanels(defaultConfiguration);
    const panels = createCasePanels({ ...defaultConfiguration, ledStrips: { [side]: { ...defaultLedStrip, enabled: true } } });
    const face = panels.faces[side];
    assert.equal(face.led.error, "", `${side}: ${face.led.error}`);
    assert.equal(caseCanExport(panels), true);
    near(geometryArea(clipping.intersection(face.polygons, face.led.polygons)), 0);
    if (side !== "bottom") near(geometryArea(blank.faces[side].polygons) - geometryArea(face.polygons), 160);
    else assert.ok(panels.ventilation.omitted > 0);
    for (const other of ["front", "rear", "left", "right", "bottom"].filter(s => s !== side)) assert.deepEqual(panels.faces[other].polygons, blank.faces[other].polygons);
  }
});

test("invalid LED slots block fabrication and disabled settings restore the sheet", () => {
  for (const patch of [{ length: 1000 }, { inset: 3 }, { inset: 200 }]) {
    const config = { ...defaultConfiguration, ledStrips: { front: { ...defaultLedStrip, enabled: true, ...patch } } };
    const panels = createCasePanels(config);
    assert.ok(panels.faces.front.led.error);
    assert.equal(caseCanExport(panels), false);
    assert.throws(() => configurationSvg(config, panels));
    assert.equal(caseFabrication(config, panels).blocked, true);
    config.ledStrips.front.enabled = false;
    assert.deepEqual(createCasePanels(config).faces.front.polygons, createCasePanels(defaultConfiguration).faces.front.polygons);
  }
  const panels = createCasePanels({ ...defaultConfiguration, cutouts: [art("front", { y: -20, polygons: normalizeOutlines([[rect(-1,-1,1,1)]]) })], ledStrips: { front: { ...defaultLedStrip, enabled: true } } });
  assert.ok(panels.faces.front.led.error);
});

test("engraved SVG and stock layouts keep every outside face readable and aligned with cuts", () => {
  for (const side of ["front", "rear", "left", "right", "bottom"]) {
    const item = art(side, { x: 27, rotation: 17 });
    const config = { ...defaultConfiguration, vents: false, engravings: [item], ledStrips: { [side]: { ...defaultLedStrip, enabled: true } } };
    const panels = createCasePanels(config), face = panels.faces[side];
    const layout = caseSheetLayout(panels).parts.find(p => p.item.id === side).item;
    const expected = mapPolygons(face.engraving.polygons, (x,y) => [x, -y-face.centerY*100]);
    near(geometryArea(clipping.xor(expected, layout.engraving)), 0);
    near(geometryArea(clipping.difference(layout.engraving, layout.polygons)), 0);
    const svg = new JSDOM(configurationSvg(config, panels), { contentType: "image/svg+xml" }).window.document;
    assert.ok(svg.querySelector(`#engrave-${side}[data-operation="engrave"] path`));
    assert.equal(svg.querySelector(`#engrave-${side}`).getAttribute("stroke"), "none");
    const fab = caseFabrication(config, panels);
    const packed = packSheets(fab.parts, 600, 600, 5, true);
    assert.deepEqual(packed.unplaced, []);
    for (const sheet of packed.sheets) for (const part of sheet.parts.filter(p => p.engraving?.length)) {
      near(geometryArea(part.engraving), geometryArea(expected));
      near(geometryArea(clipping.difference(part.engraving, part.polygons)), 0);
      assert.match(stockSvg(sheet, 600, 600), /id="engrave"/);
    }
  }
});

test("old projects default to no engraving or lights; new settings round trip and invalid settings reject", () => {
  const old = { ...defaultConfiguration }; delete old.engravings; delete old.ledStrips;
  assert.deepEqual(readCase(old).engravings, []); assert.deepEqual(readCase(old).ledStrips, {});
  const config = { ...defaultConfiguration, engravings: [art("rear")], ledStrips: { rear: { ...defaultLedStrip, enabled: true, color: "#ff0055", intensity: 0 } } };
  assert.deepEqual(readCase(JSON.parse(JSON.stringify(configurationExport(config).configuration))).engravings, config.engravings);
  assert.deepEqual(readCase(config).ledStrips, config.ledStrips);
  for (const patch of [{ length: NaN }, { color: "red" }, { intensity: 5 }, { slotHeight: 0 }, { enabled: "yes" }]) assert.throws(() => readCase({ ...config, ledStrips: { front: { ...defaultLedStrip, ...patch } } }));
  assert.throws(() => readCase({ ...config, ledStrips: { invalid: defaultLedStrip } }));
});

test("panel designer LED slots avoid mounting hardware, components and vents and persist", () => {
  const config = { ...defaultPanelConfiguration, artwork: [{ ...art(), operation: "engrave" }], ledStrip: { ...defaultPanelConfiguration.ledStrip, enabled: true } };
  const panel = createPanel(config);
  assert.equal(panel.led.error, ""); assert.equal(panel.canExport, true);
  near(geometryArea(clipping.intersection(panel.polygons, panel.led.polygons)), 0);
  assert.deepEqual(readPanel(config).ledStrip, config.ledStrip);
  assert.ok(panelFabrication(panel).parts[0].engraving.length);
  assert.equal(createPanel({ ...config, ledStrip: { ...config.ledStrip, inset: 5 } }).canExport, false);
});

test("engraving surface geometry follows the correct outside face and accessory bend", () => {
  const shapes = polygonsToShapes([[rect(-0.1,0,0.1,1)]]);
  const front = bentPanelGeometry(shapes, 0.0003, [], 1, 12, { offset: 0.0501, depth: 0.05 });
  front.computeBoundingBox(); near(front.boundingBox.min.z, 0.0501);
  const back = bentPanelGeometry(shapes, 0.0003, [], -1, 12, { offset: -0.0004, depth: 0.05 });
  back.computeBoundingBox(); assert.ok(back.boundingBox.max.z < 0);
  const bent = bentPanelGeometry(shapes, 0.0003, [{ start: 0.3, length: 0.2, angle: Math.PI/2, clearance: 0 }], 1, 12, { offset: 0.0501, depth: 0.05 });
  bent.computeBoundingBox(); assert.ok(bent.boundingBox.max.z > front.boundingBox.max.z);
  for (const geometry of [front, back, bent]) { assert.ok(Array.from(geometry.attributes.position.array).every(Number.isFinite)); geometry.dispose(); }
});
