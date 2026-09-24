import polygonClipping, { type MultiPolygon, type Pair } from "polygon-clipping";

export type StandObject = {
  name: string;
  /** Unindexed triangles in the source coordinate system. */
  vertices: number[];
  units: "mm" | "cm" | "m" | "in";
  up: "x" | "-x" | "y" | "-y" | "z" | "-z";
  turn: number;
};
export type ObjectPoint = [number, number, number]; // width, height, depth
export const maxObjectTriangles = 30000;
export function validateObjectVertices(vertices: number[]) {
  if (!vertices.length || vertices.length % 9 || vertices.some(v => !Number.isFinite(v))) throw new Error("The model must contain finite, triangulated surfaces.");
  if (vertices.length / 9 > maxObjectTriangles) throw new Error("This model is too detailed. Export a simplified mesh with at most 30,000 triangles.");
}
export function positionStandObject(model: StandObject, angle: number, floor: number) {
  validateObjectVertices(model.vertices);
  const scale = { mm: 1, cm: 10, m: 1000, in: 25.4 }[model.units];
  const turn = model.turn * Math.PI / 180, a = angle * Math.PI / 180;
  const points: ObjectPoint[] = [];
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < model.vertices.length; i += 3) {
    const sourceX = model.vertices[i] * scale, sourceY = model.vertices[i + 1] * scale, sourceZ = model.vertices[i + 2] * scale;
    const orientation: Record<StandObject["up"], ObjectPoint> = {
      x: [-sourceY, sourceX, -sourceZ], "-x": [sourceY, -sourceX, -sourceZ],
      y: [sourceX, sourceY, -sourceZ], "-y": [sourceX, -sourceY, sourceZ],
      z: [sourceX, sourceZ, sourceY], "-z": [sourceX, -sourceZ, -sourceY],
    };
    const [x, y, z] = orientation[model.up];
    const point: ObjectPoint = [x * Math.cos(turn) - z * Math.sin(turn), y, x * Math.sin(turn) + z * Math.cos(turn)];
    points.push(point);
    point.forEach((v, k) => { min[k] = Math.min(min[k], v); max[k] = Math.max(max[k], v); });
  }
  const dimensions = { width: max[0] - min[0], height: max[1] - min[1], depth: max[2] - min[2] };
  if (dimensions.width < 60 || dimensions.width > 1400 || dimensions.depth < 40 || dimensions.depth > 1000 || dimensions.height < 1 || dimensions.height > 1000) {
    throw new Error("Check the units and orientation: supported size is 60–1400 mm wide, 40–1000 mm deep and 1–1000 mm high.");
  }
  let lowY = Infinity, lowZ = Infinity, highY = -Infinity, highZ = -Infinity;
  for (const p of points) {
    p[0] -= (min[0] + max[0]) / 2;
    const y = p[1] - min[1], z = p[2] - min[2];
    p[1] = z * Math.sin(a) + y * Math.cos(a);
    p[2] = z * Math.cos(a) - y * Math.sin(a);
    lowY = Math.min(lowY, p[1]); highY = Math.max(highY, p[1]);
    lowZ = Math.min(lowZ, p[2]); highZ = Math.max(highZ, p[2]);
  }
  for (const p of points) { p[1] += floor - lowY; p[2] -= lowZ; }
  return { points, dimensions, depth: highZ - lowZ, top: highY - lowY + floor };
}
function clipSlab(points: ObjectPoint[], bound: number, sign: number): ObjectPoint[] {
  const result: ObjectPoint[] = [];
  points.forEach((p, i) => {
    const q = points[(i + 1) % points.length];
    const insideP = sign * (p[2] - bound) >= 0, insideQ = sign * (q[2] - bound) >= 0;
    if (insideP) result.push(p);
    if (insideP !== insideQ) {
      const t = (bound - p[2]) / (q[2] - p[2]);
      result.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, bound]);
    }
  });
  return result;
}
/** Project every triangle crossing the whole sheet thickness, then remove its
 * upward shadow. This preserves the exact piecewise-linear lower envelope,
 * including feet and concavities, without sampling or bridging narrow features. */
export function objectContactCut(points: ObjectPoint[], position: { width: number; depth: number; yaw: number }, thickness: number, ceiling: number) {
  const cuts: MultiPolygon[] = [];
  const intervals: Pair[] = [];
  const cos = Math.cos(position.yaw), sin = Math.sin(position.yaw);
  for (let i = 0; i < points.length; i += 3) {
    let triangle = points.slice(i, i + 3).map(([x, y, z]): ObjectPoint => [(x - position.width) * cos + (z - position.depth) * sin, y, (x - position.width) * sin - (z - position.depth) * cos]);
    triangle = clipSlab(clipSlab(triangle, -thickness / 2, 1), thickness / 2, -1);
    if (triangle.length < 2) continue;
    // Snap below a micrometre before boolean operations so triangles sharing
    // an edge also share its exact projected coordinates after clipping.
    const projected: Pair[] = triangle.map(p => [Math.round(p[0] * 1e7) / 1e7, Math.floor(p[1] * 1e7) / 1e7]);
    projected.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const lower: Pair[] = [];
    for (const point of projected) {
      if (lower.length && point[0] === lower[lower.length - 1][0]) continue;
      while (lower.length >= 2) {
        const a = lower[lower.length - 2], b = lower[lower.length - 1];
        if ((b[0] - a[0]) * (point[1] - b[1]) - (b[1] - a[1]) * (point[0] - b[0]) > 0) break;
        lower.pop();
      }
      lower.push(point);
    }
    if (lower.length < 2) continue;
    const low = lower[0][0], high = lower[lower.length - 1][0];
    if (high - low < 1e-8) continue;
    intervals.push([low, high]);
    cuts.push([[ [...lower, [high, ceiling], [low, ceiling], lower[0]] ]]);
  }
  const merged: Pair[] = [];
  intervals.sort((a, b) => a[0] - b[0]).forEach(interval => {
    const last = merged[merged.length - 1];
    if (last && interval[0] <= last[1] + 1e-7) last[1] = Math.max(last[1], interval[1]);
    else merged.push([...interval]);
  });
  let batches = cuts;
  while (batches.length > 1) {
    const next: MultiPolygon[] = [];
    for (let i = 0; i < batches.length; i += 64) next.push(polygonClipping.union(batches[i], ...batches.slice(i + 1, i + 64)));
    batches = next;
  }
  return { cut: batches[0] ?? [], intervals: merged };
}
