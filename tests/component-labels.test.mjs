import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import clipping from "polygon-clipping";
import { loadTypescript } from "./load-typescript.mjs";

const { createPanel, defaultPanelConfiguration, newPanelComponent, componentLabelArtwork, alignPanelItems, panelRectangle } = await loadTypescript("../lib/panel-designer.ts");
const { typefaceFont, textOutlines } = await loadTypescript("../lib/cutout-sources.ts");
const { placedCutout, polygonBounds, geometryArea, normalizeOutlines } = await loadTypescript("../lib/custom-cutouts.ts");
const { defaultConfiguration, configurationExport } = await loadTypescript("../lib/configurator.ts");
const { createCasePanels } = await loadTypescript("../lib/case-panels.ts");
const { caseRowPanelConfiguration } = await loadTypescript("../lib/case-row-panels.ts");
const { configurationSvg } = await loadTypescript("../lib/svg-export.ts");
const { caseFabrication } = await loadTypescript("../lib/fabrication.ts");
const { parseProject, readPanel } = await loadTypescript("../lib/project.ts");
const font = typefaceFont(JSON.parse(await readFile(new URL("../public/fonts/helvetiker-regular.json", import.meta.url))), "Helvetiker · Sans");
const label = text => ({ text, polygons: textOutlines(font, text), height: 2.5, gap: 1.5, position: "above" });
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-5, `${a} ≈ ${b}`);

test("component labels follow body size, translation, rotation and alignment", () => {
  for (const kind of ["jack", "pot", "switch", "display", "custom"]) {
    const component = { ...newPanelComponent(kind, kind), x: 20, y: -8, label: label("LEVEL") };
    const above = polygonBounds(placedCutout(componentLabelArtwork(component)));
    near(above.height, 2.5);
    near((above.left + above.right) / 2, component.x);
    near(above.bottom, component.y + component.bodyHeight / 2 + 1.5);
    const below = polygonBounds(placedCutout(componentLabelArtwork({ ...component, label: { ...component.label, position: "below" } })));
    near(below.top, component.y - component.bodyHeight / 2 - 1.5);
    const rotated = polygonBounds(placedCutout(componentLabelArtwork({ ...component, rotation: 90 })));
    near(rotated.width, 2.5);
    near(rotated.right, component.x - component.bodyHeight / 2 - 1.5);
    const moved = alignPanelItems({ ...defaultPanelConfiguration, components: [component] }, [kind], "center-x");
    near(componentLabelArtwork(moved.components[0]).x, 0);
  }
});

test("labels and custom engravings combine without cutting acrylic or changing artwork", () => {
  const component = { ...newPanelComponent("jack", "input"), label: label("INPUT") };
  const custom = { id: "art", name: "Logo", source: { kind: "svg", fileName: "logo.svg" }, operation: "engrave", side: "front", polygons: normalizeOutlines(panelRectangle(10, 4)), width: 10, x: -25, y: 5, rotation: 0 };
  const base = { ...defaultPanelConfiguration, hp: 84, format: "intellijel-1u", components: [component] };
  const blank = createPanel({ ...base, components: [{ ...component, label: null }] });
  const automatic = createPanel(base), both = createPanel({ ...base, artwork: [custom] });
  assert.equal(automatic.engravings.length, 1);
  assert.equal(both.engravings.length, 2);
  assert.deepEqual(both.polygons, blank.polygons);
  assert.deepEqual(both.config.artwork, [custom]);
  near(geometryArea(both.engraving.polygons), geometryArea(automatic.engraving.polygons) + 40);
  const removed = createPanel({ ...base, components: [], artwork: [custom] });
  assert.equal(removed.labels.length, 0);
  assert.equal(removed.engravings.length, 1);
  const copy = createPanel({ ...base, components: [component, { ...component, id: "copy", x: 25 }] });
  assert.equal(new Set(copy.labels.map(label => label.id)).size, 2);
});

test("ventilation avoids labels and off-sheet engravings produce a warning", () => {
  const component = { ...newPanelComponent("jack", "input"), label: label("INPUT") };
  const config = { ...defaultPanelConfiguration, hp: 84, components: [component], vents: { ...defaultPanelConfiguration.vents, enabled: true } };
  const panel = createPanel(config), text = placedCutout(panel.labels[0]);
  assert.ok(panel.vents.length > 0);
  for (const vent of panel.vents) near(geometryArea(clipping.intersection(vent, text)), 0);
  const outside = createPanel({ ...config, components: [{ ...component, y: 62 }] });
  assert.ok(outside.warnings.some(warning => warning.includes("INPUT") && warning.includes("outside retained acrylic")));
});

test("1U labels persist through case imports and reach fabrication and SVG engraving layers", () => {
  const config = { ...defaultConfiguration, rows: 2, rowUnits: [1, 3], vents: false };
  config.rowPanels = [{ ...caseRowPanelConfiguration(config, 0), components: [{ ...newPanelComponent("pot", "volume"), label: label("VOLUME") }] }, null];
  const panels = createCasePanels(config), engraving = panels.rowPanels[0].panel.engraving.polygons;
  assert.ok(geometryArea(engraving) > 0);
  assert.match(configurationSvg(config, panels), /id="engrave-row-1"/);
  near(geometryArea(caseFabrication(config, panels).parts.find(part => part.id === "row-1").engraving), geometryArea(engraving));
  const restored = parseProject(JSON.stringify(configurationExport(config))).designs.case;
  assert.deepEqual(restored.rowPanels[0].components[0].label, config.rowPanels[0].components[0].label);
  assert.deepEqual(createCasePanels(restored).rowPanels[0].panel.engraving.polygons, engraving);
  assert.equal(readPanel(defaultPanelConfiguration).components.length, 0);
  assert.throws(() => readPanel({ ...defaultPanelConfiguration, components: [{ ...newPanelComponent("jack", "bad"), label: { ...label("X"), polygons: [] } }] }), /outlines/);
});
