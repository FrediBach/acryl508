import { Path, Shape } from "three";
import type { FootShape } from "./configurator";

// Preview units: 1 = 100 mm. Every profile is extruded by the sheet thickness.
export const handleRise = 0.6;
export const handleOverlap = 0.28;
export const footFloor = 0.015;
export const footHoleRadius = 0.03;
export const footPanelGap = 0.01;

export function footMountLayout(length: number, angle: number, thickness: number) {
  const radians = angle * Math.PI / 180;
  const caseY = 3 * thickness + 0.12;
  return [-1, 1].map(end => {
    const caseZ = end * length * 0.29;
    return {
      caseY, caseZ,
      x: -caseZ * Math.cos(radians) - caseY * Math.sin(radians),
      y: caseLift(length, angle) + caseY * Math.cos(radians) - caseZ * Math.sin(radians) - footFloor,
    };
  });
}

export function caseLift(length: number, angle: number) {
  return angle > 0 ? Math.sin(angle * Math.PI / 180) * length / 2 + 0.08 : 0.035;
}

export function createFootProfile(length: number, angle: number, thickness: number, style: FootShape) {
  const radians = angle * Math.PI / 180;
  const half = length * Math.cos(radians) * 0.43;
  const center = caseLift(length, angle) - footFloor;
  // Local X is -Z in the assembled preview. The body stays below the base;
  // the upper flange overlaps the outside of the case wall for through-bolts.
  const top = (x: number) => center + x * Math.tan(radians);
  const flange = 3 * thickness + 0.24;
  const band = Math.max(thickness * 1.5, 0.06);
  const shape = new Shape();

  if (style === "arch") {
    const inner = half - Math.min(half * 0.3, Math.max(band * 1.5, 0.15));
    shape.moveTo(-half, 0);
    shape.lineTo(-inner, 0);
    shape.bezierCurveTo(-inner, Math.max(0.01, top(-inner) - band), inner, top(inner) - band, inner, 0);
    shape.lineTo(half, 0);
  } else if (style === "sled") {
    const radius = Math.min(0.06, top(-half) / 3);
    shape.moveTo(-half, radius);
    shape.quadraticCurveTo(-half, 0, -half + radius, 0);
    shape.lineTo(half - radius, 0);
    shape.quadraticCurveTo(half, 0, half, radius);
  } else {
    shape.moveTo(-half, 0);
    shape.lineTo(half, 0);
  }

  shape.lineTo(half, top(half));
  shape.lineTo(half - flange * Math.sin(radians), top(half) + flange * Math.cos(radians));
  shape.lineTo(-half - flange * Math.sin(radians), top(-half) + flange * Math.cos(radians));
  shape.lineTo(-half, top(-half));
  shape.closePath();

  if (style === "sled") {
    // Keep material above and below the window, even on a short 10° foot.
    const left = Math.max(-half + band, (2 * band + 0.025 - center) / Math.tan(radians));
    const right = half - band;
    if (right > left) {
      const window = new Path();
      window.moveTo(left, band);
      window.lineTo(left, top(left) - band);
      window.lineTo(right, top(right) - band);
      window.lineTo(right, band);
      window.closePath();
      shape.holes.push(window);
    }
  }
  for (const mount of footMountLayout(length, angle, thickness)) {
    const hole = new Path();
    hole.absarc(mount.x, mount.y, footHoleRadius, 0, Math.PI * 2, true);
    shape.holes.push(hole);
  }
  return shape;
}

function roundedRectangle(width: number, bottom: number, top: number, radius: number) {
  const shape = new Shape();
  const half = width / 2;
  shape.moveTo(-half + radius, bottom);
  shape.lineTo(half - radius, bottom);
  shape.quadraticCurveTo(half, bottom, half, bottom + radius);
  shape.lineTo(half, top - radius);
  shape.quadraticCurveTo(half, top, half - radius, top);
  shape.lineTo(-half + radius, top);
  shape.quadraticCurveTo(-half, top, -half, top - radius);
  shape.lineTo(-half, bottom + radius);
  shape.quadraticCurveTo(-half, bottom, -half + radius, bottom);
  shape.closePath();
  return shape;
}

export function handleLayout(innerWidth: number) {
  const width = Math.min(1.6, innerWidth - 0.12);
  return { width, mountX: width / 2 - 0.16, mountY: -0.15 };
}

export function createHandleProfile(innerWidth: number) {
  const { width, mountX, mountY } = handleLayout(innerWidth);
  const shape = roundedRectangle(width, -handleOverlap, handleRise, 0.1);
  shape.holes.push(roundedRectangle(width - 0.32, 0.08, handleRise - 0.16, 0.08));
  for (const side of [-1, 1]) {
    const hole = new Path();
    hole.absarc(side * mountX, mountY, 0.022, 0, Math.PI * 2, true);
    shape.holes.push(hole);
  }
  return shape;
}
