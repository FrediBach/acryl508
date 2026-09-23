import { Path, Shape } from "three";
import type { FootShape } from "./configurator";

// Preview units: 1 = 100 mm. Stance and grip are part of the side sheet.
export const handleRise = 0.7;
export const footFloor = 0.015;

export function caseLift(length: number, angle: number) {
  return angle > 0 ? Math.sin(angle * Math.PI / 180) * length / 2 + 0.08 : 0.035;
}

export function handleLayout(length: number) {
  // Short 1U sides flare above the rim to retain a usable hand opening.
  const width = Math.max(1.3, Math.min(1.6, length - 0.12));
  return { width, neck: Math.min(width / 2, length / 2 - 0.02) };
}

function gripOpening(width: number, height: number) {
  const path = new Path();
  const half = (width - 0.32) / 2, bottom = height + 0.2, top = height + handleRise - 0.16, radius = 0.08;
  path.moveTo(-half + radius, bottom);
  path.lineTo(half - radius, bottom);
  path.quadraticCurveTo(half, bottom, half, bottom + radius);
  path.lineTo(half, top - radius);
  path.quadraticCurveTo(half, top, half - radius, top);
  path.lineTo(-half + radius, top);
  path.quadraticCurveTo(-half, top, -half, top - radius);
  path.lineTo(-half, bottom + radius);
  path.quadraticCurveTo(-half, bottom, -half + radius, bottom);
  path.closePath();
  return path;
}

export function createSideProfile(panel: Shape, length: number, height: number, thickness: number, angle: number, style: FootShape, handle: boolean) {
  const shape = new Shape();
  shape.holes = panel.holes.map(hole => hole.clone());
  const half = length / 2;
  const radians = angle * Math.PI / 180;
  const sin = Math.sin(radians), cos = Math.cos(radians);
  // Local X becomes world -Z. Rotate this edge with the enclosure and every
  // contact point lands on the same horizontal floor, at the chosen stance.
  const floor = (x: number) => (footFloor - caseLift(length, angle) - x * sin) / cos;
  const band = Math.max(thickness, 0.035);
  shape.moveTo(-half, angle > 0 ? floor(-half) : 0);
  if (angle > 0 && style === "arch") {
    const pad = Math.min(0.22, length * 0.2);
    const left = -half + pad, right = half - pad;
    shape.lineTo(left, floor(left));
    shape.bezierCurveTo(left, -band, right, -band, right, floor(right));
  }
  shape.lineTo(half, angle > 0 ? floor(half) : 0);
  shape.lineTo(half, height);
  if (handle) {
    const { width, neck } = handleLayout(length);
    const outer = width / 2, top = height + handleRise, radius = 0.1;
    shape.lineTo(neck, height);
    shape.lineTo(outer, height + 0.14);
    shape.lineTo(outer, top - radius);
    shape.quadraticCurveTo(outer, top, outer - radius, top);
    shape.lineTo(-outer + radius, top);
    shape.quadraticCurveTo(-outer, top, -outer, top - radius);
    shape.lineTo(-outer, height + 0.14);
    shape.lineTo(-neck, height);
    shape.holes.push(gripOpening(width, height));
  }
  shape.lineTo(-half, height);
  shape.closePath();

  if (angle > 0 && style === "sled") {
    // Window stays below the enclosure, with a sheet-width web above the
    // floor and below the base. Leave solid material on very shallow stances.
    const left = Math.max(-half + band, (footFloor - caseLift(length, angle) + 2 * band * cos + band) / sin);
    const right = half - band;
    if (right - left > band) {
      const window = new Path();
      window.moveTo(left, -band);
      window.lineTo(right, -band);
      window.lineTo(right, floor(right) + band / cos);
      window.lineTo(left, floor(left) + band / cos);
      window.closePath();
      shape.holes.push(window);
    }
  }
  return shape;
}
