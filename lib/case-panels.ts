import { Path, type Shape } from "three";
import { caseDimensions, handleCount, handleDimensions, rackEnvelope, rackRowLayout, rackRowPoint, sidePanelMargin, type CaseConfiguration } from "./configurator";
import { patchBoardLayout, patchBoardSides } from "./patch-board";
import { createSideProfile } from "./acrylic-profiles";
import { createPanelProfiles } from "./panel-joints";
import { createBottomVentLayout, type VentBounds } from "./bottom-vents";
import { cableHolderLayout, cableHolderTopEdge } from "./cable-holder";
import { sinusodaHoles, sinusodaJuice, sinusodaPlacement } from "./sinusoda";
import { trolleyBus, trolleyMountingHoles, trolleyPlacement } from "./trolley";
import { compactPwr, compactPwrHoles, compactPwrPlacement } from "./compactpwr";
import { cutoutSides, mapPolygons, placedCutout, polygonBounds, polygonsToShapes, shapesToPolygons, subtractCutouts, type CutoutSide } from "./custom-cutouts";

function hole(shape: Shape, x: number, y: number, radius: number) {
  const path = new Path(); path.absarc(x, y, radius, 0, Math.PI * 2, true); shape.holes.push(path);
}

export function createCasePanels(config: CaseConfiguration) {
  const dimensions = caseDimensions(config);
  const w = dimensions.width / 100, l = dimensions.length / 100, h = dimensions.height / 100, t = config.thickness / 100;
  const edgeMargin = sidePanelMargin(config) / 100;
  const rack = rackEnvelope(config), rows = rackRowLayout(config);
  const frontHeight = (config.depth + config.thickness) / 100 + edgeMargin;
  const holder = cableHolderLayout(config);
  const panels = createPanelProfiles(w, l, frontHeight, t, edgeMargin, config.cableHolder ? shape => cableHolderTopEdge(shape, h, holder) : undefined, h);
  const { innerLength } = panels.layout;
  const base = panels.base;
  const boardDefinitions = {
    sinusoda: { board: sinusodaJuice, place: sinusodaPlacement, holes: sinusodaHoles },
    trolley: { board: trolleyBus, place: trolleyPlacement, holes: trolleyMountingHoles() },
    compactpwr: { board: compactPwr, place: compactPwrPlacement, holes: compactPwrHoles },
  };
  const definition = config.busboard === "none" ? null : boardDefinitions[config.busboard];
  const placeBoard = definition?.place;
  const powerBoard = placeBoard?.(config.hp * 5.08, rack.length, config.depth) ?? null;
  const mountingHoles = powerBoard?.fits ? definition!.holes : [];
  const mountingRadius = (definition?.board.holeDiameter ?? 0) / 200;
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
  for (const row of rows) for (const end of [-1, 1]) {
    const point = rackRowPoint(row, end * row.railOffset, -7);
    hole(side, -point.z / 100, frontHeight + point.y / 100, 0.019);
  }
  const rim = rack.angled ? [
    { x: l / 2, y: h },
    ...rows.flatMap(row => [-1, 1].map(end => {
      const point = rackRowPoint(row, end * row.length / 2);
      return { x: -point.z / 100, y: frontHeight + point.y / 100 };
    })),
    { x: -l / 2, y: frontHeight },
  ] : undefined;
  const grips = handleCount(config);
  const size = handleDimensions(config);
  const handleSize = { width: size.width / 100, height: size.height / 100 };
  const board = patchBoardLayout(config), boardSides = patchBoardSides(config);
  const left = createSideProfile(side, l, h, t, config.angle, config.footShape, grips > 0, handleSize, rim, rack.angled, boardSides.includes("left") ? board : undefined);
  const right = createSideProfile(side, l, h, t, config.angle, config.footShape, grips === 2, handleSize, rim, rack.angled, boardSides.includes("right") ? board : undefined);
  const originals = { front: panels.end, rear: panels.rear, left, right, bottom: base };
  const faces = Object.fromEntries(cutoutSides.map(({ value }) => {
    // Each editor face is viewed from outside, centred in millimetres, Y up.
    // Mirror the back/left/underside so lettering reads correctly on the case.
    const direction = ["rear", "left", "bottom"].includes(value) ? -1 : 1;
    const centerY = value === "bottom" ? 0 : (value === "front" ? frontHeight : h) / 2;
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

export function caseCanExport(panels: CasePanels) {
  return panels.reports.every(report => !report.empty && !report.error);
}
