import { Path, Shape } from "three";
import clipping, { type MultiPolygon } from "polygon-clipping";
import { compactPwrInlet as inlet } from "./compactpwr";
import { geometryArea, shapesToPolygons } from "./custom-cutouts";

function rectangle(x: number, y: number, width: number, height: number): MultiPolygon {
  const l = x - width / 2, r = x + width / 2, b = y - height / 2, t = y + height / 2;
  return [[[[l, b], [r, b], [r, t], [l, t], [l, b]]]];
}

// Faceplate-local millimetres, viewed from outside. Published plate and front
// openings only; rear component bodies in the preview are illustrative.
export function compactPwrInletPlate() {
  const plate = new Shape(), w = inlet.plateWidth / 2, h = inlet.plateHeight / 2, r = inlet.cornerRadius;
  plate.moveTo(-w + r, -h);
  plate.lineTo(w - r, -h); plate.absarc(w - r, -h + r, r, -Math.PI / 2, 0, false);
  plate.lineTo(w, h - r); plate.absarc(w - r, h - r, r, 0, Math.PI / 2, false);
  plate.lineTo(-w + r, h); plate.absarc(-w + r, h - r, r, Math.PI / 2, Math.PI, false);
  plate.lineTo(-w, -h + r); plate.absarc(-w + r, -h + r, r, Math.PI, Math.PI * 1.5, false);
  plate.closePath();
  const rocker = new Path();
  const points = rectangle(inlet.switchX, 0, inlet.switchWidth, inlet.switchHeight)[0][0];
  rocker.moveTo(...points[0]);
  for (const point of points.slice(1)) rocker.lineTo(...point);
  plate.holes.push(rocker);
  for (const [x, diameter] of [[-inlet.holePitch / 2, inlet.holeDiameter], [inlet.holePitch / 2, inlet.holeDiameter], [inlet.jackX, inlet.jackDiameter]]) {
    const hole = new Path(); hole.absarc(x, 0, diameter / 2, 0, Math.PI * 2, true); plate.holes.push(hole);
  }
  return plate;
}

// Side-local coordinates in scene units (100 mm). Reserve the entire plate
// plus a sheet-thickness web, including around pre-existing joint/rail holes.
export function addCompactPwrInlet(shape: Shape, innerLength: number, baseTop: number, height: number, thickness: number, side: "left" | "rear" = "left") {
  const web = Math.max(0.03, thickness);
  const width = inlet.plateWidth / 100 + 2 * web, plateHeight = inlet.plateHeight / 100 + 2 * web;
  const original = shapesToPolygons([shape], 32);
  const limit = innerLength / 2 - width / 2;
  const lowest = baseTop + plateHeight / 2, highest = height - plateHeight / 2;
  const columns: number[] = [];
  for (let x = limit; x >= -limit - 1e-8; x -= 0.05) columns.push(side === "rear" ? -x : x);
  // Search low first, starting at the case's rear-left corner on either panel.
  // Rear-panel X is world X: negative is the case's left, viewed from the front.
  for (let y = lowest; y <= highest + 1e-8; y += 0.05) {
    for (const x of columns) {
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
      return { fits: true as const, side, x: x * 100, y: y * 100, reserved };
    }
  }
  return { fits: false as const, side, x: null, y: null, reserved: [] as MultiPolygon };
}

// The inlet model faces outward (+local Z); its X axis reads left-to-right
// from outside. Panel geometry has the opposite X direction on both faces.
export function compactPwrInletTransform(inlet: { side: "left" | "rear"; x: number; y: number }, layout: { innerWidth: number; innerLength: number; thicknesses: { left: number; rear: number } }, explode = 0) {
  const position: [number, number, number] = inlet.side === "left"
    ? [-layout.innerWidth / 2 - layout.thicknesses.left - explode, inlet.y / 100, -inlet.x / 100]
    : [inlet.x / 100, inlet.y / 100, -layout.innerLength / 2 - layout.thicknesses.rear - explode];
  const rotation: [number, number, number] = [0, inlet.side === "left" ? -Math.PI / 2 : Math.PI, 0];
  return { position, rotation };
}
