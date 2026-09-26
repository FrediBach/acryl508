import { BufferGeometry, ExtrudeGeometry, Float32BufferAttribute, type Shape } from "three";
import { bendPoint, bendSlices, type AccessoryBend } from "./accessory-bends";

// Split the flat extrusion at every bend sample before deforming. Merely moving
// the original vertices would turn large face triangles into sharp chords.
export function bentPanelGeometry(shapes: Shape[], depth: number, bends: AccessoryBend[], direction: number, curveSegments = 12, surface?: { offset: number; depth: number }) {
  const source = new ExtrudeGeometry(shapes, { depth, bevelEnabled: false, curveSegments });
  if (surface) source.translate(0, 0, surface.offset);
  if (!bends.length) return source;
  const positions = source.getAttribute("position"), normals = source.getAttribute("normal");
  const output: number[] = [], outputNormals: number[] = [];
  const slices = bendSlices(bends);
  type Vertex = number[];
  const clip = (polygon: Vertex[], height: number, above: boolean) => {
    const result: Vertex[] = [];
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i], b = polygon[(i + 1) % polygon.length];
      const insideA = above ? a[1] >= height : a[1] <= height;
      const insideB = above ? b[1] >= height : b[1] <= height;
      if (insideA) result.push(a);
      if (insideA !== insideB) {
        const t = (height - a[1]) / (b[1] - a[1]);
        result.push(a.map((value, index) => value + (b[index] - value) * t));
      }
    }
    return result;
  };
  const emit = (polygon: Vertex[]) => {
    for (let i = 1; i < polygon.length - 1; i++) for (const v of [polygon[0], polygon[i], polygon[i + 1]]) {
      const p = bendPoint(v[0], v[1], v[2], surface?.depth ?? depth, bends, direction);
      output.push(p.x, p.y, p.z);
      const c = Math.cos(p.angle), s = Math.sin(p.angle);
      outputNormals.push(v[3], c * v[4] - s * v[5], s * v[4] + c * v[5]);
    }
  };
  for (let i = 0; i < positions.count; i += 3) {
    let remaining = [0, 1, 2].map(j => [positions.getX(i + j), positions.getY(i + j), positions.getZ(i + j), normals.getX(i + j), normals.getY(i + j), normals.getZ(i + j)]);
    const low = Math.min(...remaining.map(v => v[1])), high = Math.max(...remaining.map(v => v[1]));
    for (const height of slices) if (height > low && height < high) {
      emit(clip(remaining, height, false));
      remaining = clip(remaining, height, true);
    }
    emit(remaining);
  }
  source.dispose();
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(output, 3));
  geometry.setAttribute("normal", new Float32BufferAttribute(outputNormals, 3));
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return geometry;
}

export function bentPanelEdges(points: [number, number, number][], depth: number, bends: AccessoryBend[], direction: number) {
  const result: [number, number, number][] = [], slices = bendSlices(bends);
  for (let i = 0; i < points.length; i += 2) {
    const a = points[i], b = points[i + 1];
    const stops = [0, ...slices.map(y => (y - a[1]) / (b[1] - a[1])).filter(t => t > 0 && t < 1).sort((a, b) => a - b), 1];
    for (let j = 1; j < stops.length; j++) for (const t of [stops[j - 1], stops[j]]) {
      const p = bendPoint(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, depth, bends, direction);
      result.push([p.x, p.y, p.z]);
    }
  }
  return result;
}
