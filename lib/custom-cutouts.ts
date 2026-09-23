import clipping, { type MultiPolygon, type Polygon, type Ring } from "polygon-clipping";
import { Path, Shape, Vector2 } from "three";

export const cutoutSides = [
  { value: "front", label: "Front" }, { value: "rear", label: "Rear" },
  { value: "left", label: "Left" }, { value: "right", label: "Right" },
  { value: "bottom", label: "Bottom" },
] as const;
export type CutoutSide = typeof cutoutSides[number]["value"];
export type CustomCutout = {
  id: string; name: string; side: CutoutSide;
  source: { kind: "svg"; fileName: string } | { kind: "text"; text: string; fontId: string; fontName: string };
  // Outlines have unit width, are centred at (0, 0), and use Y up.
  polygons: MultiPolygon;
  width: number; x: number; y: number; rotation: number;
};
export type CutoutAction = { type: "add"; cutout: CustomCutout } | { type: "update"; id: string; patch: Partial<CustomCutout> } | { type: "remove"; id: string };
export type CutoutReport = {
  side: CutoutSide; removedParts: number; removedArea: number; empty: boolean;
  outside: string[]; clipped: string[]; error?: string;
};
export const maxCutouts = 20;
export const maxOutlinePoints = 16000;

export function ringArea(ring: Ring) {
  return Math.abs(ring.reduce((area, point, i) => {
    const next = ring[(i + 1) % ring.length];
    return area + point[0] * next[1] - next[0] * point[1];
  }, 0) / 2);
}
export function polygonArea(polygon: Polygon) {
  return ringArea(polygon[0]) - polygon.slice(1).reduce((area, ring) => area + ringArea(ring), 0);
}
export function geometryArea(polygons: MultiPolygon) {
  return polygons.reduce((area, polygon) => area + polygonArea(polygon), 0);
}
export function polygonBounds(polygons: MultiPolygon) {
  let left = Infinity, right = -Infinity, bottom = Infinity, top = -Infinity;
  for (const polygon of polygons) for (const ring of polygon) for (const [x, y] of ring) {
    left = Math.min(left, x); right = Math.max(right, x); bottom = Math.min(bottom, y); top = Math.max(top, y);
  }
  return { left, right, bottom, top, width: right - left, height: top - bottom };
}
export function mapPolygons(polygons: MultiPolygon, transform: (x: number, y: number) => [number, number]): MultiPolygon {
  return polygons.map(polygon => polygon.map(ring => ring.map(([x, y]) => transform(x, y))));
}
export function shapesToPolygons(shapes: Shape[], divisions = 16): MultiPolygon {
  return shapes.map(shape => {
    const { shape: outline, holes } = shape.extractPoints(divisions);
    return [outline, ...holes].map(points => points.map(({ x, y }) => [x, y] as [number, number]));
  });
}
export function polygonsToShapes(polygons: MultiPolygon) {
  return polygons.map(([outline, ...holes]) => {
    const shape = new Shape(outline.map(([x, y]) => new Vector2(x, y)));
    shape.holes = holes.map(ring => new Path(ring.map(([x, y]) => new Vector2(x, y))));
    return shape;
  });
}
export function normalizeOutlines(polygons: MultiPolygon): MultiPolygon {
  let count = 0;
  for (const polygon of polygons) for (const ring of polygon) for (const point of ring) {
    if (!point.every(Number.isFinite)) throw new Error("The outline contains invalid coordinates.");
    if (++count > maxOutlinePoints) throw new Error("This outline is too complex. Simplify it before importing (16,000 points maximum).");
  }
  const bounds = polygonBounds(polygons);
  if (!count || bounds.width <= 1e-8 || bounds.height <= 1e-8) throw new Error("No filled outline found. Convert text and strokes to filled paths first.");
  const normalized = mapPolygons(polygons, (x, y) => [(x - (bounds.left + bounds.right) / 2) / bounds.width, (y - (bounds.bottom + bounds.top) / 2) / bounds.width]);
  const merged = clipping.union(normalized);
  if (geometryArea(merged) < 1e-10) throw new Error("The outline has no filled area.");
  return merged;
}
export function placedCutout(cutout: CustomCutout): MultiPolygon {
  const angle = cutout.rotation * Math.PI / 180;
  return mapPolygons(cutout.polygons, (x, y) => [
    cutout.x + cutout.width * (x * Math.cos(angle) - y * Math.sin(angle)),
    cutout.y + cutout.width * (x * Math.sin(angle) + y * Math.cos(angle)),
  ]);
}

function sharesPerimeter(piece: Polygon, panel: MultiPolygon) {
  // Require a shared edge, not a single touching point. An enclosed counter
  // remains scrap even when it is larger than the surviving panel frame.
  return piece[0].some((a, i, ring) => {
    const b = ring[(i + 1) % ring.length];
    return panel.some(([outer]) => outer.some((c, j) => {
      const d = outer[(j + 1) % outer.length];
      const dx = d[0] - c[0], dy = d[1] - c[1], length = Math.hypot(dx, dy);
      if (length < 1e-8) return false;
      const cross = (p: [number, number]) => Math.abs((p[0] - c[0]) * dy - (p[1] - c[1]) * dx) / length;
      if (cross(a) > 1e-7 || cross(b) > 1e-7) return false;
      const project = (p: [number, number]) => ((p[0] - c[0]) * dx + (p[1] - c[1]) * dy) / length;
      const start = project(a), end = project(b);
      return Math.min(length, Math.max(start, end)) - Math.max(0, Math.min(start, end)) > 1e-7;
    }));
  });
}

// Perform one boolean subtraction for the complete panel before finding connected
// components. This catches islands made by overlapping cuts or existing vents.
export function subtractCutouts(panel: MultiPolygon, cutouts: CustomCutout[], side: CutoutSide) {
  const report: CutoutReport = { side, removedParts: 0, removedArea: 0, empty: false, outside: [], clipped: [] };
  if (!cutouts.length) return { polygons: panel, report };
  try {
    const cuts = cutouts.map(cutout => {
      const placed = placedCutout(cutout);
      const overlap = geometryArea(clipping.intersection(panel, placed));
      if (overlap < 1e-7) report.outside.push(cutout.id);
      // Compare with the outer sheet, so crossing a pre-existing hole isn't
      // described as going beyond the panel edge.
      const beyond = geometryArea(clipping.difference(placed, panel.map(polygon => [polygon[0]])));
      if (overlap >= 1e-7 && beyond > 1e-7) report.clipped.push(cutout.id);
      return placed;
    });
    const pieces = clipping.difference(panel, ...cuts).sort((a, b) => polygonArea(b) - polygonArea(a));
    const retained = pieces.find(piece => sharesPerimeter(piece, panel));
    const loose = pieces.filter(piece => piece !== retained);
    report.removedParts = loose.length;
    report.removedArea = geometryArea(loose);
    report.empty = !retained;
    return { polygons: retained ? [retained] : [], report };
  } catch {
    report.error = "These cutouts could not be calculated. Simplify the outlines or reduce their number. This panel is shown without custom cuts.";
    return { polygons: panel, report };
  }
}

export function outlinePath(polygons: MultiPolygon) {
  return polygons.map(polygon => polygon.map(ring => ring.map(([x, y], i) => `${i ? "L" : "M"}${x},${-y}`).join(" ") + "Z").join(" ")).join(" ");
}
