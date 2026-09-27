import polygonClipping, { type MultiPolygon, type Pair } from "polygon-clipping";
import { bendPoint, type AccessoryBend } from "./accessory-bends";
import { maxSheetThickness, sheetThickness } from "./sheet-materials";
import type { StandPart, SynthStand } from "./synth-stand";

export type BentTray = {
  frontLip: number; rearFold: number; deckDepth: number; deckStart: number;
  innerRadius: number; neutralRadius: number; allowance: number;
  bends: AccessoryBend[];
  holes: { x: number; y: number; size: number; mate: string; tabCenter: number; tabWidth: number }[];
};
const rect = (x1: number, y1: number, x2: number, y2: number): MultiPolygon => [[[[x1, y1], [x2, y1], [x2, y2], [x1, y2], [x1, y1]]]];

// Millimetres, world width/height/depth. The top contact plane starts at
// (depth=0, height=frontHeight); the bend model uses a mid-sheet neutral axis.
export function bentTrayPoint(tray: BentTray, thickness: number, angle: number, frontHeight: number, x: number, y: number, z: number) {
  const p = bendPoint(x, y, z, thickness, tray.bends, 1);
  const d = -tray.neutralRadius + p.z - thickness / 2;
  const n = tray.neutralRadius + tray.frontLip - p.y - thickness / 2;
  const a = angle * Math.PI / 180;
  return { x, y: frontHeight + d * Math.sin(a) + n * Math.cos(a), z: d * Math.cos(a) - n * Math.sin(a) };
}

export function createBentStand(base: SynthStand, round: (outline: Pair[], radius: number) => MultiPolygon): SynthStand {
  const { config } = base, t = maxSheetThickness(config), trayThickness = sheetThickness(config, "bent-tray");
  const a = config.angle * Math.PI / 180, sin = Math.sin(a), cos = Math.cos(a), r = Math.SQRT1_2;
  const frontLip = config.frontLipHeight, rearFold = Math.max(config.rearFoldHeight, frontLip + t);
  const neutralRadius = 2.5 * trayThickness, allowance = neutralRadius * Math.PI / 2;
  const deckStart = frontLip + allowance, flatHeight = deckStart + config.depth + allowance + rearFold;
  const tray: BentTray = { frontLip, rearFold, deckDepth: config.depth, deckStart, innerRadius: 2 * trayThickness, neutralRadius, allowance,
    bends: [{ start: frontLip, length: allowance, angle: Math.PI / 2 }, { start: deckStart + config.depth, length: allowance, angle: -Math.PI / 2 }], holes: [] };
  // Keep the rear fold clear of the floor, including at zero playing angle.
  const frontHeight = Math.max(11 * t, (neutralRadius + rearFold + trayThickness / 2) * cos - (config.depth + neutralRadius) * sin + 2 * t);
  const middle = config.depth * cos / 2;
  const span = Math.min(config.width - 4 * t, config.depth * cos - 2 * t);
  const half = span / (2 * r), tabCenters = [-half * 0.65, half * 0.65];
  const radius = config.roundedEdges ? config.cornerRadius : 0;
  const supports: StandPart[] = (["a", "b"] as const).map((family, index) => {
    const id = `rib-${family}-1`, mate = `rib-${family === "a" ? "b" : "a"}-1`, thickness = sheetThickness(config, id);
    const yaw = family === "a" ? Math.PI / 4 : 3 * Math.PI / 4;
    const top = (u: number) => frontHeight + (middle + u * r) * Math.tan(a) - thickness * r * Math.tan(a) / 2;
    const shoulder = (u: number) => top(u) - trayThickness / cos;
    const extension = config.frontExtension ? config.frontExtensionLength / r : 0;
    const minX = -half - extension;
    const outline: Pair[] = [[minX, 0], [half, 0], [half, shoulder(half)], [-half, shoulder(-half)], [minX, shoulder(-half)], [minX, 0]];
    const slotWidth = sheetThickness(config, mate) + config.clearance;
    const root = (frontHeight + middle * Math.tan(a) - t * r * Math.tan(a) / 2 - trayThickness / cos) / 2;
    let polygons = round(outline, radius);
    for (const u of tabCenters) {
      const tabWidth = thickness;
      const left = u - tabWidth / 2, right = u + tabWidth / 2;
      polygons = polygonClipping.union(polygons, [[[[left, shoulder(left) - t], [right, shoulder(right) - t], [right, top(right) - 0.1], [left, top(left) - 0.1], [left, shoulder(left) - t]]]]);
      // Square mortises enclose the entire oblique tab through the full tray
      // thickness. The slope also shifts its projection across the thickness.
      const size = Math.max((tabWidth + thickness) * r, (tabWidth + thickness) * r / cos + trayThickness * Math.tan(a)) + config.clearance;
      tray.holes.push({ x: u * Math.cos(yaw), y: deckStart + (middle + u * r - trayThickness * sin / 2) / cos, size, mate: id, tabCenter: u, tabWidth });
    }
    const opens = index === 0 ? "down" : "up";
    const jointRoot = root + (index === 0 ? 0.1 : -0.1);
    polygons = polygonClipping.difference(polygons, rect(-slotWidth / 2, opens === "down" ? -1 : jointRoot, slotWidth / 2, opens === "down" ? jointRoot : top(half) + 1));
    const height = Math.max(...polygons.flat(2).map(p => p[1]));
    return { id, label: `Diagonal support ${family.toUpperCase()}`, thickness, kind: "rib", family, position: 0,
      placement: { width: 0, depth: middle, yaw }, polygons, minX, width: half - minX, height,
      slots: [{ center: 0, root: jointRoot, opens, mate, width: slotWidth }], cableHoleCenters: [] };
  });
  const trayWidth = config.width + 2 * t;
  const holes = tray.holes.map(h => rect(h.x - h.size / 2, h.y - h.size / 2, h.x + h.size / 2, h.y + h.size / 2));
  const polygons = polygonClipping.difference(round(rect(-trayWidth / 2, 0, trayWidth / 2, flatHeight)[0][0], radius), ...holes);
  const top: StandPart = { id: "bent-tray", label: "Bent top sheet", thickness: trayThickness, kind: "tray", family: "a", position: 0,
    placement: { width: 0, depth: 0, yaw: 0 }, polygons, width: trayWidth, minX: -trayWidth / 2, height: flatHeight, slots: [], cableHoleCenters: [], tray };
  const parts = [...supports, top];
  const points = [0, flatHeight, deckStart, deckStart + config.depth, ...tray.bends.flatMap(b => Array.from({ length: 31 }, (_, i) => b.start + b.length * i / 30))]
    .flatMap(y => [0, trayThickness].map(z => bentTrayPoint(tray, trayThickness, config.angle, frontHeight, 0, y, z)));
  const footprint = supports.flatMap(p => p.polygons.flat(2).flatMap(([u, y]) => [-p.thickness / 2, p.thickness / 2].map(v => ({
    x: u * Math.cos(p.placement.yaw) + v * Math.sin(p.placement.yaw), y,
    z: middle + u * Math.sin(p.placement.yaw) - v * Math.cos(p.placement.yaw),
  }))));
  const front = Math.min(...points.map(p => p.z), ...footprint.map(p => p.z));
  const rear = Math.max(...points.map(p => p.z), ...footprint.map(p => p.z));
  return { ...base, parts, frontHeight, stopHeight: frontLip, front, rear, ribCount: 2, braceCount: 0, ribPositions: [0, 0], bracePositions: [],
    braceWidth: trayWidth, braceHeight: 0, reliefRadius: 0, supportSpacing: span, jointCenter: supports[0].slots[0].root - 0.1,
    diagonal: { enabled: true, angle: 45, intersectionAngle: 90 },
    cableHoles: { ...base.cableHoles, enabled: false, centers: [], centersByBrace: [], countPerBrace: 0, totalCount: 0 },
    frontExtension: { enabled: config.frontExtension, length: config.frontExtension ? config.frontExtensionLength : 0, stopOuterX: front, floorFrontX: Math.min(...footprint.map(p => p.z)) },
    dimensions: { width: Math.max(trayWidth, ...footprint.map(p => 2 * Math.abs(p.x))), depth: rear - front, height: Math.max(...points.map(p => p.y), ...supports.map(p => p.height)) },
    synthTop: frontHeight + config.depth * sin + config.height * cos,
  };
}

export const bentStandNotes = [
  "Three parts: one formed tray and two perpendicular diagonal supports. Join support B slots-up with A slots-down, then lower the tray over the four locating tabs. Square mortises allow clearance around the diagonal tabs; they locate the tray but are not captive fasteners. Lift the instrument off before moving the stand.",
  "Form the front lip 90 degrees upward and the larger rear fold 90 degrees downward relative to the deck. Flat pattern includes two bend allowances, each using an inside radius of twice the tray thickness and a mid-sheet neutral axis. Validate the forming allowance on a sample. Blue dashed SVG lines are bend-zone boundaries, not cuts; stock-sheet exports contain cut paths only.",
  "Two supports remain fixed in count. Tray overhang and deflection increase with instrument width. Prototype joint fit, bends, flex, grip and tipping before loading equipment; no load rating is calculated. Uploaded models set the tray envelope; the tray does not follow underside contours.",
];
