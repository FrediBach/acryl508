import { Path, Shape, Vector2 } from "three";
import { sledWebThickness, type FootShape } from "./configurator";

// Preview units: 1 = 100 mm. Stance and grip are part of the side sheet.
export const handleRise = 0.7;
export const footFloor = 0.015;

export function caseLift(length: number, angle: number) {
  return angle > 0 ? Math.sin(angle * Math.PI / 180) * length / 2 + 0.08 : 0.035;
}

type HandleSize = { width: number; height: number };

// Round inside a convex window: tangent circular fillets only add material.
function roundedWindow(points: Vector2[], radius: number) {
  const path = new Path();
  const corners = points.map((point, index) => {
    const before = points[(index + points.length - 1) % points.length].clone().sub(point);
    const after = points[(index + 1) % points.length].clone().sub(point);
    const beforeLength = before.length(), afterLength = after.length();
    before.normalize(); after.normalize();
    const halfAngle = Math.acos(Math.max(-1, Math.min(1, before.dot(after)))) / 2;
    const distance = Math.min(radius / Math.tan(halfAngle), beforeLength * 0.45, afterLength * 0.45);
    const actualRadius = distance * Math.tan(halfAngle);
    const center = before.clone().add(after).normalize().multiplyScalar(actualRadius / Math.sin(halfAngle)).add(point);
    return { entry: before.multiplyScalar(distance).add(point), exit: after.multiplyScalar(distance).add(point), center, radius: actualRadius };
  });
  path.moveTo(corners[0].entry.x, corners[0].entry.y);
  for (const corner of corners) {
    path.lineTo(corner.entry.x, corner.entry.y);
    path.absarc(corner.center.x, corner.center.y, corner.radius,
      Math.atan2(corner.entry.y - corner.center.y, corner.entry.x - corner.center.x),
      Math.atan2(corner.exit.y - corner.center.y, corner.exit.x - corner.center.x), true);
  }
  path.closePath();
  return path;
}

function gripOpening(width: number, height: number, rise: number) {
  const path = new Path();
  const half = (width - 0.32) / 2, bottom = height + 0.2, top = height + rise - 0.16;
  const radius = Math.min(0.08, (top - bottom) / 2);
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

export function createSideProfile(panel: Shape, length: number, height: number, thickness: number, angle: number, style: FootShape, handle: boolean, handleSize: HandleSize = { width: 1.6, height: handleRise }) {
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
    const outer = handleSize.width / 2, top = height + handleSize.height, radius = 0.1, root = 0.14;
    const widePanel = half > outer + root;
    if (widePanel) {
      shape.lineTo(outer + root, height);
      shape.quadraticCurveTo(outer, height, outer, height + root);
    } else {
      // Narrow panels flow straight from the vertical side into the flared
      // grip, with vertical tangents at both ends and no sharp shoulder.
      shape.bezierCurveTo(half, height + 0.06, outer, height + 0.08, outer, height + root);
    }
    shape.lineTo(outer, top - radius);
    shape.quadraticCurveTo(outer, top, outer - radius, top);
    shape.lineTo(-outer + radius, top);
    shape.quadraticCurveTo(-outer, top, -outer, top - radius);
    shape.lineTo(-outer, height + root);
    if (widePanel) {
      shape.quadraticCurveTo(-outer, height, -outer - root, height);
      shape.lineTo(-half, height);
    } else {
      shape.bezierCurveTo(-outer, height + 0.08, -half, height + 0.06, -half, height);
    }
    shape.holes.push(gripOpening(handleSize.width, height, handleSize.height));
  } else shape.lineTo(-half, height);
  shape.closePath();

  if (angle > 0 && style === "sled") {
    // Retain at least 12 mm or 2.5 sheet thicknesses around the opening.
    // Offset the sloping floor perpendicularly, not just vertically.
    const web = sledWebThickness(thickness * 100) / 100;
    const radius = Math.max(0.08, thickness * 1.5);
    const left = Math.max(-half + web, (footFloor - caseLift(length, angle) + (web + 2 * radius) * cos + web) / sin);
    const right = half - web;
    if (right - left > 2 * radius) {
      shape.holes.push(roundedWindow([
        new Vector2(left, -web), new Vector2(right, -web),
        new Vector2(right, floor(right) + web / cos), new Vector2(left, floor(left) + web / cos),
      ], radius));
    }
  }
  return shape;
}
