import clipping, { type MultiPolygon } from "polygon-clipping";
import type { Shape } from "three";
import type { CaseConfiguration } from "./configurator";
import { caseThicknesses } from "./sheet-thickness";
import { mapPolygons, polygonsToShapes, shapesToPolygons } from "./custom-cutouts";
import { tabbedProfile } from "./panel-joints";

export const backboardMountLimits = {
  angle: { min: 0, max: 40 },
  thickness: { min: 6, max: 50 }, clearance: { min: 0, max: 3 },
  engagement: { min: 40, max: 180 }, elevation: { min: -200, max: 150 },
};

export const backboardMountNotes = [
  "Slide the assembled case down over the desk backboard until both side saddles rest on its top edge.",
  "The two contact sheets use the rear panel's thickness and material. Their tabs fit closed slots above the backboard and are captured by the side panels; install and tighten the rail-end screws before use. Remove a side panel to assemble or remove the contact sheets.",
  "Inside case-to-mount corners retain extra acrylic in a tangent radius of up to three times the thicker side sheet. Short adjoining edges limit the radius; board seating faces and joint slots stay square.",
  "Measure the actual backboard and test the fit with scrap; the clearance is the total extra gap, including any protective lining. Keep the full engagement length clear on both faces of the backboard.",
  "This geometry has no load rating. Verify the acrylic, joints, backboard and desk with the intended equipment and patching force before use; add positive retention if accidental upward lifting is possible.",
];

type Dimensions = { width: number; length: number; height: number };
type Point = [number, number];

export function backboardMountParameters(config: Pick<CaseConfiguration, "backboardMount" | "backboardThickness" | "backboardClearance" | "backboardEngagement" | "backboardElevation" | "angle">) {
  const bounded = (value: number | undefined, fallback: number, limits: { min: number; max: number }) =>
    Math.min(limits.max, Math.max(limits.min, Number.isFinite(value) ? value! : fallback));
  const thickness = bounded(config.backboardThickness, 18, backboardMountLimits.thickness);
  const clearance = bounded(config.backboardClearance, 0.5, backboardMountLimits.clearance);
  return {
    enabled: Boolean(config.backboardMount), thickness, clearance, gap: thickness + clearance,
    engagement: bounded(config.backboardEngagement, 80, backboardMountLimits.engagement),
    elevation: bounded(config.backboardElevation, 30, backboardMountLimits.elevation),
    angle: bounded(config.angle, 0, backboardMountLimits.angle),
  };
}

// Normalized inputs above are millimetres. All geometry below uses scene units
// (1 = 100 mm), before the preview translates the assembled case upwards.
export function backboardMountLayout(config: CaseConfiguration, dimensions: Dimensions) {
  const parameters = backboardMountParameters(config);
  const sheets = caseThicknesses(config);
  const angleRadians = parameters.angle * Math.PI / 180;
  const sin = Math.sin(angleRadians), cos = Math.cos(angleRadians);
  const length = dimensions.length / 100, height = dimensions.height / 100;
  const jawThickness = sheets.rear / 100;
  const web = Math.max(8, 1.5 * Math.max(sheets.left, sheets.right, sheets.rear)) / 100;
  const tabHeight = Math.max(12, sheets.rear * 2) / 100;
  const bridgeHeight = web * 3 + tabHeight * 2;
  // Below zero, stop before the saddle roof consumes the web beneath the
  // inclined enclosure, even with the mount moved fully behind its rear edge.
  // Zero remains valid for level/short cases using the existing rearward pose.
  const minimumElevation = Math.min(0, Math.max(backboardMountLimits.elevation.min,
    Math.ceil((-sin * length + bridgeHeight + web / cos) * 100)));
  const requestedElevation = parameters.elevation;
  const elevation = Math.max(minimumElevation, requestedElevation);
  const boardTop = -sin * length / 2 - elevation / 100;
  const boardBottom = boardTop - parameters.engagement / 100;
  const tabs = [0, 1].map(index => ({
    start: boardTop + web + index * (tabHeight + web),
    end: boardTop + web + index * (tabHeight + web) + tabHeight,
  }));
  const bridgeTop = boardTop + bridgeHeight;
  const jawTop = bridgeTop - web / 2;
  const rootDepth = Math.min(length * 0.45, Math.max(0.45, web * 4));
  const rootHeight = Math.min(height, Math.max(0.45, web * 4));
  const rootRadius = 3 * Math.max(sheets.left, sheets.right) / 100;
  const rootLeft = length / 2 - rootDepth;
  // Tuck the saddle under the rear support root instead of always placing it
  // behind the case. Its top-front corner must leave one retaining web below
  // the inclined underside, so the contact sheets and slots clear the body.
  // Where that is impossible, keep the saddle behind the rear bottom corner.
  const rearCorner = cos * length / 2;
  const undersideLimit = sin > 1e-6 ? (cos * bridgeTop + web) / sin
    : bridgeTop <= -web ? -Infinity : rearCorner;
  const frontOuter = Math.min(rearCorner, Math.max(cos * rootLeft, undersideLimit));
  const frontInner = frontOuter + web + jawThickness;
  const rearInner = frontInner + parameters.gap / 100;
  const rearOuter = rearInner + jawThickness + web;
  const compactInsetMm = (rearCorner - frontOuter) * 100;
  return {
    ...parameters, elevation, requestedElevation, minimumElevation, elevationLimited: elevation !== requestedElevation,
    angleRadians, sin, cos, length, height, jawThickness, web, tabHeight,
    boardTop, boardBottom, frontInner, rearInner, frontOuter, rearOuter, bridgeTop, jawTop, tabs,
    innerWidth: (dimensions.width - sheets.left - sheets.right) / 100,
    rootLeft, rootRight: length / 2, rootHeight, rootRadius, compactInsetMm,
    boardCenter: [(frontInner + rearInner) / 2, (boardTop + boardBottom) / 2] as Point,
    worldBounds: { minY: Math.min(boardBottom, -sin * length / 2), maxY: Math.max(bridgeTop, sin * length / 2 + cos * height), minZ: -Math.max(rearOuter, rearCorner), maxZ: cos * length / 2 + sin * height },
  };
}

export type BackboardMountLayout = ReturnType<typeof backboardMountLayout>;
export type BackboardMountPart = {
  id: "mount-front" | "mount-rear"; label: string; shapes: Shape[]; thickness: number;
  // Raw extrusion is [0, thickness/100], matching the other case sheets.
  position: [number, number, number]; rotation: [number, number, number];
};

function rectangle(left: number, bottom: number, right: number, top: number): MultiPolygon {
  return [[[[left, bottom], [right, bottom], [right, top], [left, top], [left, bottom]]]];
}

function hull(points: Point[]): MultiPolygon {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (a: Point, b: Point, c: Point) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const half = (list: Point[]) => {
    const result: Point[] = [];
    for (const point of list) {
      while (result.length > 1 && cross(result[result.length - 2], result[result.length - 1], point) <= 0) result.pop();
      result.push(point);
    }
    return result.slice(0, -1);
  };
  const ring = [...half(sorted), ...half(sorted.reverse())];
  return [[ring.concat([ring[0]])]];
}

export function createBackboardMount(config: CaseConfiguration, dimensions: Dimensions) {
  const layout = backboardMountLayout(config, dimensions);
  if (!layout.enabled) return { enabled: false, layout, parts: [] as BackboardMountPart[], extension: [] as MultiPolygon, slots: [] as MultiPolygon, reserved: [] as MultiPolygon, notes: backboardMountNotes, error: undefined as string | undefined };
  const { sin, cos, frontInner, rearInner, jawThickness, boardBottom, boardTop, bridgeTop, frontOuter, rearOuter, rootLeft, rootRight, rootHeight } = layout;
  const toWorld = (x: number, y: number): Point => [cos * x - sin * y, sin * x + cos * y];
  const toLocal = (u: number, v: number): Point => [cos * u + sin * v, -sin * u + cos * v];
  const root = rectangle(rootLeft, 0, rootRight, rootHeight);
  const bridge = hull([
    ...root[0][0].map(([x, y]) => toWorld(x, y)),
    [frontOuter, boardTop], [rearOuter, boardTop], [frontOuter, bridgeTop], [rearOuter, bridgeTop],
  ]);
  const saddle = clipping.difference(
    clipping.union(bridge, rectangle(frontOuter, boardBottom, rearOuter, bridgeTop)),
    rectangle(frontInner, boardBottom - 1, rearInner, boardTop),
  );
  const extension = mapPolygons(saddle, toLocal);
  const slots = layout.tabs.flatMap(tab => [
    ...mapPolygons(rectangle(frontInner - jawThickness, tab.start, frontInner, tab.end), toLocal),
    ...mapPolygons(rectangle(rearInner, tab.start, rearInner + jawThickness, tab.end), toLocal),
  ]) as MultiPolygon;
  // Reserve the whole added structure plus its overlap with the original side:
  // a decorative cut must not sever either the cantilever root or a slot web.
  const reserved = clipping.union(extension, root);
  const sheets = caseThicknesses(config);
  const parts: BackboardMountPart[] = layout.enabled ? (["mount-front", "mount-rear"] as const).map(id => {
    const extrusionStart = id === "mount-front" ? frontInner : rearInner + jawThickness;
    const tabs = layout.tabs.map(tab => ({ start: tab.start - boardBottom, end: tab.end - boardBottom }));
    const shape = tabbedProfile(layout.innerWidth, 0, layout.jawTop - boardBottom, tabs, sheets.left / 100, sheets.right / 100);
    return {
      id, label: id === "mount-front" ? "Backboard mount · front contact sheet" : "Backboard mount · rear contact sheet",
      shapes: [shape], thickness: sheets.rear,
      position: [0, cos * boardBottom - sin * extrusionStart, -sin * boardBottom - cos * extrusionStart],
      rotation: [-layout.angleRadians, 0, 0],
    };
  }) : [];
  return { enabled: layout.enabled, layout, parts, extension, slots, reserved, notes: backboardMountNotes, error: undefined as string | undefined };
}

export function backboardMountSideProfile(shape: Shape, mount: ReturnType<typeof createBackboardMount>) {
  if (!mount.enabled) return shape;
  const [original] = shapesToPolygons([shape]);
  // Preserve the enclosure's existing rail and joining holes. Unioning the
  // filled support into a shape with holes would otherwise fill those holes.
  const joined = clipping.union([[original[0]]], mount.extension);
  const { rounded, reinforcement } = roundMountRoots(joined, mount.layout);
  // The fillet fills the concave wedge. Protect that added acrylic just like
  // the original support root, including from automatic inlet placement.
  if (reinforcement.length) mount.reserved = clipping.union(mount.reserved, reinforcement);
  const holes: MultiPolygon = original.slice(1).map(ring => [ring]);
  const finished = clipping.difference(rounded, holes, mount.slots);
  const shapes = polygonsToShapes(finished);
  if (shapes.length !== 1) throw new Error("The backboard saddle must remain connected to its side panel.");
  return shapes[0];
}

function roundMountRoots(polygons: MultiPolygon, layout: BackboardMountLayout) {
  const reinforcement: MultiPolygon = [];
  const rounded: MultiPolygon = polygons.map(polygon => {
    const points = polygon[0].slice(0, -1), rounded: Point[] = [];
    points.forEach((point, index) => {
      const previous = points[(index + points.length - 1) % points.length], next = points[(index + 1) % points.length];
      // polygon-clipping emits CCW outlines. Follow the flat underside from
      // the case front into the descending support; never round the board seat.
      const isRoot = Math.abs(point[1]) < 1e-8 && Math.abs(previous[1]) < 1e-8 &&
        previous[0] < point[0] - 1e-8 && next[1] < -1e-8 && point[0] <= layout.rootRight + 1e-8;
      if (!isRoot) { rounded.push([point[0], point[1]]); return; }
      const beforeLength = point[0] - previous[0], afterLength = Math.hypot(next[0] - point[0], next[1] - point[1]);
      const after: Point = [(next[0] - point[0]) / afterLength, (next[1] - point[1]) / afterLength];
      const halfAngle = Math.acos(Math.max(-1, Math.min(1, -after[0]))) / 2;
      const tangent = Math.min(layout.rootRadius / Math.tan(halfAngle), beforeLength * 0.45, afterLength * 0.45);
      const radius = tangent * Math.tan(halfAngle);
      const offset = radius / Math.sin(halfAngle) / Math.hypot(after[0] - 1, after[1]);
      const center: Point = [point[0] + (after[0] - 1) * offset, point[1] + after[1] * offset];
      const entry: Point = [point[0] - tangent, point[1]];
      const exit: Point = [point[0] + after[0] * tangent, point[1] + after[1] * tangent];
      // Reserve the curve and its adjoining web by their bounds. This avoids
      // subtracting coincident outlines, which creates unstable tiny slivers.
      reinforcement.push(...rectangle(Math.min(entry[0], exit[0]), exit[1], Math.max(point[0], exit[0]), point[1]));
      const start = Math.atan2(entry[1] - center[1], entry[0] - center[0]);
      const sweep = -(Math.PI - 2 * halfAngle);
      const steps = Math.max(2, Math.ceil(Math.abs(sweep) / (Math.PI / 36)));
      rounded.push(entry);
      for (let i = 1; i < steps; i++) {
        const angle = start + sweep * i / steps;
        rounded.push([center[0] + radius * Math.cos(angle), center[1] + radius * Math.sin(angle)]);
      }
      rounded.push(exit);
    });
    return [[...rounded, rounded[0]], ...polygon.slice(1)];
  });
  return { rounded, reinforcement };
}
