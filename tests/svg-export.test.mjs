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
