import { Path, type Shape } from "three";
import clipping, { type MultiPolygon } from "polygon-clipping";
import { compactPwrInlet as inlet } from "./compactpwr";
import { geometryArea, shapesToPolygons } from "./custom-cutouts";

function rectangle(x: number, y: number, width: number, height: number): MultiPolygon {
  const l = x - width / 2, r = x + width / 2, b = y - height / 2, t = y + height / 2;
  return [[[[l, b], [r, b], [r, t], [l, t], [l, b]]]];
}

// Side-local coordinates in scene units (100 mm). Reserve the entire plate
// plus a sheet-thickness web, including around pre-existing joint/rail holes.
export function addCompactPwrInlet(shape: Shape, innerLength: number, baseTop: number, height: number, thickness: number) {
  const web = Math.max(0.03, thickness);
  const width = inlet.plateWidth / 100 + 2 * web, plateHeight = inlet.plateHeight / 100 + 2 * web;
  const original = shapesToPolygons([shape], 32);
  const rear = innerLength / 2 - width / 2, front = -rear;
  const lowest = baseTop + plateHeight / 2, highest = height - plateHeight / 2;
  // Search low first, rear to front. Never shrink the inlet to force a fit.
  for (let y = lowest; y <= highest + 1e-8; y += 0.05) {
    for (let x = rear; x >= front - 1e-8; x -= 0.05) {
      const reserved = rectangle(x, y, width, plateHeight);
      if (geometryArea(clipping.difference(reserved, original)) > 1e-9) continue;
      const window = rectangle(x, y, inlet.cutoutWidth / 100, inlet.cutoutHeight / 100)[0][0];
      const cut = new Path();
      cut.moveTo(...window[0]);
      for (const point of window.slice(1)) cut.lineTo(...point);
      shape.holes.push(cut);
      for (const offset of [-inlet.holePitch / 200, inlet.holePitch / 200]) {
        const hole = new Path();
        hole.absarc(x + offset, y, inlet.holeDiameter / 200, 0, Math.PI * 2, true);
        shape.holes.push(hole);
      }
      return { fits: true, x: x * 100, y: y * 100, reserved };
    }
  }
  return { fits: false, x: null, y: null, reserved: [] as MultiPolygon };
}
