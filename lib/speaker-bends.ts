import { Euler, Path, Shape, Vector3 } from "three";
import { bendPoint, type AccessoryBend } from "./accessory-bends";
import { bentPanelGeometry } from "./bent-panel-geometry";
import type { SpeakerPart } from "./speaker";

/** Exported dimensions are millimetres, like the rest of the speaker design. */
export type SpeakerBend = { startMm: number; allowanceMm: number; angleDegrees: number; innerRadiusMm: number; clearanceMm: number; addedFlatLengthMm: number; rootReductionMm: number; direction: "outward" };
export const speakerBendDirection = (part: SpeakerPart) => part.id === "left" ? -1 : 1;
export function speakerPartBends(part: SpeakerPart): AccessoryBend[] {
  return part.bend ? [{ start: part.bend.startMm / 100, length: part.bend.allowanceMm / 100, angle: part.bend.angleDegrees * Math.PI / 180, clearance: part.bend.clearanceMm / 100 }] : [];
}
export function speakerPartGeometry(part: SpeakerPart) {
  const shapes = part.polygons.map(polygon => {
    const shape = new Shape();
    polygon.forEach((ring, index) => {
      const path = index ? new Path() : shape;
      ring.forEach(([x, y], i) => i ? path.lineTo(x / 100, y / 100) : path.moveTo(x / 100, y / 100));
      path.closePath(); if (index) shape.holes.push(path);
    });
    return shape;
  });
  const geometry = bentPanelGeometry(shapes, part.thickness / 100, speakerPartBends(part), speakerBendDirection(part), 8);
  geometry.translate(0, 0, -part.thickness / 200);
  return geometry;
}
/** World-space outline points for camera/assembled dimensions, excluding explode. */
export function speakerFormedOutline(part: SpeakerPart) {
  const bends = speakerPartBends(part), direction = speakerBendDirection(part), rotation = new Euler(...part.rotation);
  return part.polygons.flatMap(polygon => polygon[0].flatMap(([x, y]) => [0, part.thickness].map(z => {
    const p = bendPoint(x / 100, y / 100, z / 100, part.thickness / 100, bends, direction);
    return new Vector3(p.x * 100, p.y * 100, p.z * 100 - part.thickness / 2).applyEuler(rotation).add(new Vector3(...part.position));
  })));
}
export function speakerBendNotes(parts: SpeakerPart[]) {
  return parts.filter(p => p.bend).map(part => {
    const b = part.bend!;
    return `${part.label}: form the handle ${b.angleDegrees}° outward with ${b.innerRadiusMm} mm inside radius. Flat sheet includes ${b.addedFlatLengthMm.toFixed(2)} mm of clearance and bend allowance, with ${b.rootReductionMm.toFixed(2)} mm trimmed from the root. Bend starts at local Y ${b.startMm.toFixed(2)} mm. Validate forming and carrying strength on a sample.`;
  });
}
