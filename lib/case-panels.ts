import { Path, type Shape } from "three";
import { caseDimensions, handleCount, rackRowLayout, sidePanelMargin, type CaseConfiguration } from "./configurator";
import { createSideProfile } from "./acrylic-profiles";
import { createPanelProfiles } from "./panel-joints";
import { createBottomVentLayout } from "./bottom-vents";
import { cutoutSides, mapPolygons, placedCutout, polygonBounds, polygonsToShapes, shapesToPolygons, subtractCutouts, type CutoutSide } from "./custom-cutouts";

function hole(shape: Shape, x: number, y: number, radius: number) {
  const path = new Path(); path.absarc(x, y, radius, 0, Math.PI * 2, true); shape.holes.push(path);
}

export function createCasePanels(config: CaseConfiguration) {
  const dimensions = caseDimensions(config);
  const w = dimensions.width / 100, l = dimensions.length / 100, h = dimensions.height / 100, t = config.thickness / 100;
  const edgeMargin = sidePanelMargin(config) / 100;
  const panels = createPanelProfiles(w, l, h, t, edgeMargin);
  const { innerLength } = panels.layout;
  const base = panels.base;
  const exclusions = (config.cutouts ?? []).filter(cutout => cutout.side === "bottom").flatMap(cutout => placedCutout(cutout).map(polygon =>
    polygonBounds(mapPolygons([polygon], (x, y) => [-x / 100, y / 100]))));
  const ventilation = createBottomVentLayout(w, innerLength, config.ventStyle, config.ventDensity, { thickness: t, design: config.ventDesign, exclusions, layout: config.ventLayout, coverage: config.ventCoverage, mix: config.ventMix });
  if (config.vents) base.holes.push(...ventilation.paths);
  const side = panels.side;
  for (const row of rackRowLayout(config)) for (const end of [-1, 1]) {
    hole(side, row.center / 100 + end * row.railOffset / 100, h - 0.07, 0.019);
  }
  const grips = handleCount(config);
  const left = createSideProfile(side, l, h, t, config.angle, config.footShape, grips > 0);
  const right = createSideProfile(side, l, h, t, config.angle, config.footShape, grips === 2);
  const originals = { front: panels.end, rear: panels.end, left, right, bottom: base };
  const faces = Object.fromEntries(cutoutSides.map(({ value }) => {
    // Each editor face is viewed from outside, centred in millimetres, Y up.
    // Mirror the back/left/underside so lettering reads correctly on the case.
    const direction = ["rear", "left", "bottom"].includes(value) ? -1 : 1;
    const centerY = value === "bottom" ? 0 : h / 2;
    const original = mapPolygons(shapesToPolygons([originals[value]]), (x, y) => [direction * x * 100, (y - centerY) * 100]);
    const cuts = (config.cutouts ?? []).filter(cutout => cutout.side === value);
    const result = subtractCutouts(original, cuts, value);
    const shapes = cuts.length && !result.report.error
      ? polygonsToShapes(mapPolygons(result.polygons, (x, y) => [direction * x / 100, y / 100 + centerY]))
      : [originals[value]];
    return [value, { ...result, original, shapes }];
  })) as Record<CutoutSide, ReturnType<typeof subtractCutouts> & { original: ReturnType<typeof shapesToPolygons>; shapes: Shape[] }>;
  return { faces, layout: panels.layout, ventilation, reports: cutoutSides.map(({ value }) => faces[value].report) };
}
export type CasePanels = ReturnType<typeof createCasePanels>;
