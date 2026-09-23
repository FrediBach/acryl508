import { Path, type Shape } from "three";
import { caseDimensions, handleCount, handleDimensions, rackRowLayout, sidePanelMargin, type CaseConfiguration } from "./configurator";
import { createSideProfile } from "./acrylic-profiles";
import { createPanelProfiles } from "./panel-joints";
import { createBottomVentLayout, type VentBounds } from "./bottom-vents";
import { cableHolderLayout, cableHolderTopEdge } from "./cable-holder";
import { sinusodaHoles, sinusodaJuice, sinusodaPlacement } from "./sinusoda";
import { trolleyBus, trolleyMountingHoles, trolleyPlacement } from "./trolley";
import { cutoutSides, mapPolygons, placedCutout, polygonBounds, polygonsToShapes, shapesToPolygons, subtractCutouts, type CutoutSide } from "./custom-cutouts";

function hole(shape: Shape, x: number, y: number, radius: number) {
  const path = new Path(); path.absarc(x, y, radius, 0, Math.PI * 2, true); shape.holes.push(path);
}

export function createCasePanels(config: CaseConfiguration) {
  const dimensions = caseDimensions(config);
  const w = dimensions.width / 100, l = dimensions.length / 100, h = dimensions.height / 100, t = config.thickness / 100;
  const edgeMargin = sidePanelMargin(config) / 100;
  const holder = cableHolderLayout(config);
  const panels = createPanelProfiles(w, l, h, t, edgeMargin, config.cableHolder ? shape => cableHolderTopEdge(shape, h, holder) : undefined);
  const { innerLength } = panels.layout;
  const base = panels.base;
  const placeBoard = config.busboard === "sinusoda" ? sinusodaPlacement : config.busboard === "trolley" ? trolleyPlacement : null;
  const powerBoard = placeBoard?.(panels.layout.innerWidth * 100, innerLength * 100, config.depth) ?? null;
  const mountingHoles = powerBoard?.fits ? config.busboard === "trolley" ? trolleyMountingHoles() : sinusodaHoles : [];
  const mountingRadius = (config.busboard === "trolley" ? trolleyBus : sinusodaJuice).holeDiameter / 200;
  const exclusions: VentBounds[] = (config.cutouts ?? []).filter(cutout => cutout.side === "bottom").flatMap(cutout => placedCutout(cutout).map(polygon =>
    polygonBounds(mapPolygons([polygon], (x, y) => [-x / 100, y / 100]))));
  const mountingConflicts = mountingHoles.filter(({ x, y }) => exclusions.some(box =>
    x / 100 + mountingRadius + t > box.left && x / 100 - mountingRadius - t < box.right &&
    y / 100 + mountingRadius + t > box.bottom && y / 100 - mountingRadius - t < box.top)).length;
  exclusions.push(...mountingHoles.map(({ x, y }) => ({ left: x / 100 - mountingRadius, right: x / 100 + mountingRadius, bottom: y / 100 - mountingRadius, top: y / 100 + mountingRadius })));
  const ventilation = createBottomVentLayout(w, innerLength, config.ventStyle, config.ventDensity, { thickness: t, design: config.ventDesign, exclusions, layout: config.ventLayout, coverage: config.ventCoverage, mix: config.ventMix });
  if (config.vents) base.holes.push(...ventilation.paths);
  for (const { x, y } of mountingHoles) hole(base, x / 100, y / 100, mountingRadius);
  const side = panels.side;
  for (const row of rackRowLayout(config)) for (const end of [-1, 1]) {
    hole(side, row.center / 100 + end * row.railOffset / 100, h - 0.07, 0.019);
  }
  const grips = handleCount(config);
  const size = handleDimensions(config);
  const handleSize = { width: size.width / 100, height: size.height / 100 };
  const left = createSideProfile(side, l, h, t, config.angle, config.footShape, grips > 0, handleSize);
  const right = createSideProfile(side, l, h, t, config.angle, config.footShape, grips === 2, handleSize);
  const originals = { front: panels.end, rear: panels.rear, left, right, bottom: base };
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
  return { faces, layout: panels.layout, ventilation, powerBoard, mountingHoles, mountingConflicts, reports: cutoutSides.map(({ value }) => faces[value].report) };
}
export type CasePanels = ReturnType<typeof createCasePanels>;
