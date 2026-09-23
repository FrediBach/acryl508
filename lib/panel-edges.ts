import type { Shape } from "three";

// Trace the source contours instead of triangulation edges: aligned holes can
// leave unmatched triangle edges across an otherwise continuous panel face.
export function panelEdgePoints(shapes: Shape | Shape[], depth: number, curveSegments = 12, threshold = 15) {
  const points: [number, number, number][] = [];
  const thresholdDot = Math.cos(threshold * Math.PI / 180);
  for (const shape of Array.isArray(shapes) ? shapes : [shapes]) {
    const extracted = shape.extractPoints(curveSegments);
    for (const contour of [extracted.shape, ...extracted.holes]) {
      const ring = contour.filter((point, index) => index === 0 || point.distanceToSquared(contour[index - 1]) > 1e-20);
      if (ring.length > 1 && ring[0].distanceToSquared(ring[ring.length - 1]) <= 1e-20) ring.pop();
      if (ring.length < 3) continue;
      for (let index = 0; index < ring.length; index++) {
        const previous = ring[(index + ring.length - 1) % ring.length];
        const current = ring[index], next = ring[(index + 1) % ring.length];
        for (const z of [0, depth]) points.push([current.x, current.y, z], [next.x, next.y, z]);
        const incoming = current.clone().sub(previous).normalize();
        const outgoing = next.clone().sub(current).normalize();
        // Retain thickness edges at corners, without striping smooth curves.
        if (incoming.dot(outgoing) <= thresholdDot) points.push([current.x, current.y, 0], [current.x, current.y, depth]);
      }
    }
  }
  return points;
}
