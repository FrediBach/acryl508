import { Path, Shape, Vector2 } from "three";
import { flatFeetBottomEdge, type flatFeetLayout } from "./flat-feet";
import type { patchBoardLayout } from "./patch-board";
import { sledWebThickness, type FootShape } from "./configurator";
import { bentHandleTrim } from "./accessory-bends";

// Preview units: 1 = 100 mm. Stance and grip are part of the side sheet.
export const handleRise = 0.7;
export const footFloor = 0.015;

export function caseLift(length: number, angle: number, automaticFeet = false, flatFeetRise = 0) {
  return angle > 0 ? Math.sin(angle * Math.PI / 180) * length / 2 + 0.08 : flatFeetRise > 0 ? footFloor + flatFeetRise : automaticFeet ? 0.08 : 0.035;
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

function gripOpening(width: number, height: number, rise: number, bottomWeb = 0.2) {
  const path = new Path();
  const half = (width - 0.32) / 2, bottom = height + bottomWeb, top = height + rise - 0.16;
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

export function createSideProfile(panel: Shape, length: number, height: number, thickness: number, angle: number, style: FootShape, handle: boolean, handleSize: HandleSize = { width: 1.6, height: handleRise }, rim?: { x: number; y: number }[], automaticFeet = false, patchBoard?: ReturnType<typeof patchBoardLayout>, flatFeet?: ReturnType<typeof flatFeetLayout>, bendSpace = { board: 0, handle: 0 }) {
  const shape = new Shape();
  shape.holes = panel.holes.map(hole => hole.clone());
  const half = length / 2;
  const radians = angle * Math.PI / 180;
  const sin = Math.sin(radians), cos = Math.cos(radians);
  // Local X becomes world -Z. Rotate this edge with the enclosure and every
  // contact point lands on the same horizontal floor, at the chosen stance.
  const floor = (x: number) => (footFloor - caseLift(length, angle, automaticFeet) - x * sin) / cos;
  const hasFeet = angle > 0 || automaticFeet;
  // The rim runs from the high rear edge (+X) to the front (-X).
  const rimHeight = (x: number) => {
    if (!rim?.length) return height;
    for (let index = 1; index < rim.length; index++) {
      const rear = rim[index - 1], front = rim[index];
      if (x >= front.x && x <= rear.x) return front.y + (rear.y - front.y) * (x - front.x) / (rear.x - front.x);
    }
    return x > rim[0].x ? rim[0].y : rim[rim.length - 1].y;
  };
  const traceRim = (from: number, to: number) => {
    for (const point of rim ?? []) if (point.x < from && point.x > to) shape.lineTo(point.x, point.y);
    shape.lineTo(to, rimHeight(to));
  };
  const band = Math.max(thickness, 0.035);
  if (angle === 0 && flatFeet?.enabled) {
    flatFeetBottomEdge(shape, length, thickness, flatFeet);
  } else {
    shape.moveTo(-half, hasFeet ? floor(-half) : 0);
    if (hasFeet && (style === "arch" || (automaticFeet && angle === 0))) {
      const pad = Math.min(0.22, length * 0.2);
      const left = -half + pad, right = half - pad;
      shape.lineTo(left, floor(left));
      const archTop = automaticFeet && angle === 0 ? 0 : -band;
      shape.bezierCurveTo(left, archTop, right, archTop, right, floor(right));
    }
    shape.lineTo(half, hasFeet ? floor(half) : 0);
  }
  shape.lineTo(half, rimHeight(half));
  if (handle || patchBoard) {
    const width = Math.max(handle ? handleSize.width : 0, (patchBoard?.width ?? 0) / 100);
    const boardRise = (patchBoard?.height ?? 0) / 100 + bendSpace.board;
    const handleTrim = bendSpace.handle ? bentHandleTrim(thickness) : 0;
    const rise = boardRise + (handle ? handleSize.height - handleTrim + bendSpace.handle : 0);
    // Seat the level grip above the highest rim point under its roots.
    if (rim && !bendSpace.board && !bendSpace.handle) height = rimHeight(Math.min(half, width / 2 + 0.14));
    const root = bendSpace.board || (!patchBoard && bendSpace.handle) ? thickness : 0.14;
    const outer = width / 2, top = height + rise, radius = 0.1;
    const widePanel = half > outer + root;
    if (widePanel) {
      if (rim) traceRim(half, outer + root);
      shape.lineTo(outer + root, height);
      shape.quadraticCurveTo(outer, height, outer, height + root);
    } else {
      // Narrow panels flow straight from the vertical side into the flared
      // grip, with vertical tangents at both ends and no sharp shoulder.
      shape.bezierCurveTo(half, height + root * 3 / 7, outer, height + root * 4 / 7, outer, height + root);
    }
    shape.lineTo(outer, top - radius);
    shape.quadraticCurveTo(outer, top, outer - radius, top);
    shape.lineTo(-outer + radius, top);
    shape.quadraticCurveTo(-outer, top, -outer, top - radius);
    shape.lineTo(-outer, height + root);
    if (widePanel) {
      shape.quadraticCurveTo(-outer, height, -outer - root, height);
      if (rim) {
        shape.lineTo(-outer - root, rimHeight(-outer - root));
        traceRim(-outer - root, -half);
      } else shape.lineTo(-half, height);
    } else {
      shape.bezierCurveTo(-outer, height + root * 4 / 7, -half, rimHeight(-half) + root * 3 / 7, -half, rimHeight(-half));
    }
    if (handle) shape.holes.push(gripOpening(handleSize.width, height + boardRise + bendSpace.handle, handleSize.height - handleTrim, 0.2 - handleTrim));
    for (const center of patchBoard?.centers ?? []) {
      const hole = new Path();
      hole.absarc(center.x / 100, height + bendSpace.board + center.y / 100, patchBoard!.holeDiameter / 200, 0, Math.PI * 2, true);
      shape.holes.push(hole);
    }
  } else traceRim(half, -half);
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
