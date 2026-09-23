import assert from "node:assert/strict";
import test from "node:test";
import { loadTypescript } from "./load-typescript.mjs";

const { caseDimensions, defaultConfiguration } = await loadTypescript("../lib/configurator.ts");
const { createCasePanels } = await loadTypescript("../lib/case-panels.ts");
const { configurationSvg } = await loadTypescript("../lib/svg-export.ts");

const group = (svg, id) => svg.match(new RegExp(`<g id="panel-${id}"[\\s\\S]*?</g>`))?.[0] ?? "";
const pathBounds = value => {
  const points = [...value.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map(match => [Number(match[1]), Number(match[2])]);
  return {
    width: Math.max(...points.map(([x]) => x)) - Math.min(...points.map(([x]) => x)),
    height: Math.max(...points.map(([, y]) => y)) - Math.min(...points.map(([, y]) => y)),
  };
};

test("SVG export lays out every enclosure sheet at millimetre scale", () => {
  const svg = configurationSvg(defaultConfiguration, createCasePanels(defaultConfiguration));
  assert.match(svg, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(svg, /width="[\d.]+mm" height="[\d.]+mm" viewBox="0 0 [\d.]+ [\d.]+"/);
  assert.match(svg, /data-units="mm"/);
  assert.doesNotMatch(svg, /NaN|Infinity|undefined/);
  assert.equal((svg.match(/<g id="panel-/g) ?? []).length, 5);
  for (const id of ["bottom", "front", "rear", "left", "right"]) assert.match(group(svg, id), /<path d="M/);
  const dimensions = caseDimensions(defaultConfiguration);
  assert.ok(Math.abs(pathBounds(group(svg, "bottom")).width - dimensions.width) < 0.001);
  assert.ok(Math.abs(pathBounds(group(svg, "left")).width - dimensions.length) < 0.001);
  assert.doesNotMatch(svg, /panel-foot|panel-handle/);
});

test("SVG export integrates stance and handles into side sheets alongside resolved cutouts", () => {
  const cutout = {
    id: "square", name: "Square", side: "front",
    source: { kind: "svg", fileName: "square.svg" },
    polygons: [[[[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]]]],
    width: 20, x: 0, y: 0, rotation: 0,
  };
  const config = { ...defaultConfiguration, rows: 2, rowUnits: [1, 3], angle: 20, handle: true, cutouts: [cutout] };
  const svg = configurationSvg(config, createCasePanels(config));
  assert.equal((svg.match(/<g id="panel-/g) ?? []).length, 5);
  assert.doesNotMatch(svg, /panel-foot|panel-handle/);
  const height = caseDimensions(config).height;
  assert.ok(pathBounds(group(svg, "left")).height > height + 70);
  assert.ok(pathBounds(group(svg, "right")).height > height);
  assert.ok(pathBounds(group(svg, "left")).height > pathBounds(group(svg, "right")).height + 69.99);
  assert.ok((group(svg, "front").match(/\bM/g) ?? []).length >= 2, "front sheet includes the custom cutout loop");
  assert.match(svg, /Acryl508 1U \+ 3U \/ 84HP panel layout/);
});

test("custom handle sizes reach both side sheets and JSON with consistent defaults and bounds", async () => {
  const { configurationExport, handleDimensions } = await loadTypescript("../lib/configurator.ts");
  const config = { ...defaultConfiguration, handle: true, handleMode: "pair", handleWidth: 230, handleHeight: 100, angle: 20, footShape: "sled" };
  const svg = configurationSvg(config, createCasePanels(config));
  for (const side of ["left", "right"]) {
    const bounds = pathBounds(group(svg, side));
    assert.ok(Math.abs(bounds.width - 230) < 0.001);
    assert.ok(bounds.height > caseDimensions(config).height + 100);
  }
  const data = configurationExport(config);
  assert.equal(data.handles.widthMm, 230);
  assert.equal(data.handles.riseMm, 100);
  assert.equal(data.handles.count, 2);
  assert.equal(data.handles.roundedRoots, true);
  assert.equal(data.stance.minimumWebMm, 12.5);
  assert.equal(data.stance.innerCorners, "Rounded");
  assert.deepEqual(handleDimensions({ handleHeight: 50 }), { width: 160, height: 50 });
  assert.deepEqual(handleDimensions({ handleHeight: 20 }), { width: 160, height: 50 });
  assert.deepEqual(handleDimensions({}), { width: 160, height: 70 });
  assert.deepEqual(handleDimensions({ handleWidth: -100, handleHeight: 1000 }), { width: 130, height: 110 });
  assert.deepEqual(handleDimensions({ handleWidth: NaN, handleHeight: Infinity }), { width: 160, height: 70 });
  const off = configurationExport({ ...config, handle: false });
  assert.equal(off.handles.count, 0);
  assert.equal(off.configuration.handleWidth, 230);
  assert.equal(off.configuration.handleHeight, 100);
});
