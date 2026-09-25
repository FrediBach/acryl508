import { Path, type Shape } from "three";
import clipping, { type MultiPolygon } from "polygon-clipping";
import { accessoryBendAngles, caseDimensions, caseThicknesses, handleSides, handleDimensions, rackEnvelope, rackRowLayout, rackRowPoint, sidePanelMargin, type CaseConfiguration } from "./configurator";
import { bendAllowance, type AccessoryBend } from "./accessory-bends";
import { flatFeetLayout } from "./flat-feet";
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
  const mm = caseThicknesses(config);
  const thicknesses = { bottom: mm.bottom / 100, front: mm.front / 100, rear: mm.rear / 100, left: mm.left / 100, right: mm.right / 100 };
  const w = dimensions.width / 100, l = dimensions.length / 100, h = dimensions.height / 100, t = thicknesses.bottom;
  const edgeMargin = sidePanelMargin(config) / 100;
  const rack = rackEnvelope(config), rows = rackRowLayout(config);
  const frontHeight = (config.depth + mm.bottom) / 100 + edgeMargin;
  const holder = cableHolderLayout(config);
  const angles = accessoryBendAngles(config);
  const rearBend = bendAllowance(angles.holder, thicknesses.rear);
  const bends: Record<CutoutSide, AccessoryBend[]> = { front: [], rear: [], left: [], right: [], bottom: [] };
  if (rearBend.angle) bends.rear.push({ start: h + rearBend.clearance, length: rearBend.length, angle: rearBend.angle });
  const panels = createPanelProfiles(w, l, frontHeight, t, edgeMargin, config.cableHolder ? shape => cableHolderTopEdge(shape, h, holder, rearBend.extra) : undefined, h, thicknesses);
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
  const ventilation = createBottomVentLayout(w, innerLength, config.ventStyle, config.ventDensity, { thickness: t, innerWidth: panels.layout.innerWidth, design: config.ventDesign, exclusions, layout: config.ventLayout, coverage: config.ventCoverage, mix: config.ventMix });
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
  const grips = handleSides(config);
  const feet = flatFeetLayout(config);
  const size = handleDimensions(config);
  const handleSize = { width: size.width / 100, height: size.height / 100 };
  const board = patchBoardLayout(config), boardSides = patchBoardSides(config);
  const sideProfile = (name: "left" | "right") => {
    const hasBoard = boardSides.includes(name), hasHandle = grips.includes(name);
    const boardBend = bendAllowance(hasBoard ? angles.board : 0, thicknesses[name]);
    const handleBend = bendAllowance(hasHandle ? angles.handle : 0, thicknesses[name]);
    const shape = createSideProfile(side, l, h, thicknesses[name], config.angle, config.footShape, hasHandle, handleSize, rim, rack.angled, hasBoard ? board : undefined, feet, { board: boardBend.extra, handle: handleBend.extra });
    // Derive the same level root used by the profile, including angled racks.
    const rise = (hasBoard ? board.height / 100 : 0) + boardBend.extra + (hasHandle ? handleSize.height : 0) + handleBend.extra;
    const root = Math.max(...shape.getPoints().map(point => point.y)) - rise;
    if (boardBend.angle) bends[name].push({ start: root + boardBend.clearance, length: boardBend.length, angle: boardBend.angle });
    if (handleBend.angle) bends[name].push({ start: root + (hasBoard ? board.height / 100 : 0) + boardBend.extra + handleBend.clearance, length: handleBend.length, angle: handleBend.angle });
    return shape;
  };
  const left = sideProfile("left"), right = sideProfile("right");
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
    // User artwork must also leave the heating strip intact. Keep displaying
    // the requested cut, but block fabrication until the conflict is resolved.
    if (!result.report.error && cuts.length && bends[value].length) {
      try {
        const conflicts = cuts.filter(cut => bends[value].some(bend => {
          const bottom = (bend.start - 0.14 - centerY) * 100, top = (bend.start + bend.length - centerY) * 100;
          const strip: MultiPolygon = [[[[-10000, bottom], [10000, bottom], [10000, top], [-10000, top], [-10000, bottom]]]];
          return clipping.intersection(original, placedCutout(cut), strip).length > 0;
        }));
        if (conflicts.length) result.report.error = "Move custom cutouts out of the accessory bend and clearance strips before exporting.";
      } catch {
        result.report.error = "Unable to verify accessory bend clearance. Move or remove custom cutouts before exporting.";
      }
    }
    return [value, { ...result, original, shapes }];
  })) as Record<CutoutSide, ReturnType<typeof subtractCutouts> & { original: ReturnType<typeof shapesToPolygons>; shapes: Shape[] }>;
  return { faces, bends, layout: panels.layout, ventilation, powerBoard, mountingHoles, mountingConflicts, reports: cutoutSides.map(({ value }) => faces[value].report) };
}
export type CasePanels = ReturnType<typeof createCasePanels>;

export function caseCanExport(panels: CasePanels) {
  return panels.reports.every(report => !report.empty && !report.error);
}
