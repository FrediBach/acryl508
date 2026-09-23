import { Path } from "three";
import type { VentDensity, VentStyle } from "./configurator";
import { normalizeVentDesign, sampleVentField, type VentDesign } from "./vent-design";

export type VentBounds = { left: number; right: number; bottom: number; top: number };
export type VentOpening = { x: number; y: number; width: number; height: number };
type VentOptions = { thickness?: number; design?: Partial<VentDesign>; exclusions?: VentBounds[] };
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function ventOpeningPath(opening: VentOpening, style: VentStyle) {
  const { x, y, width, height } = opening;
  const path = new Path();
  if (style === "long-slits" || style === "short-slits") {
    const radius = width / 2, halfStraight = Math.max(0, height / 2 - radius);
    path.moveTo(x - radius, y - halfStraight);
    path.lineTo(x - radius, y + halfStraight);
    path.absarc(x, y + halfStraight, radius, Math.PI, 0, true);
    path.lineTo(x + radius, y - halfStraight);
    path.absarc(x, y - halfStraight, radius, 0, Math.PI, true);
  } else if (style === "round") {
    path.absarc(x, y, width / 2, 0, Math.PI * 2, true);
  } else {
    for (let vertex = 0; vertex < 6; vertex++) {
      const angle = -vertex * Math.PI / 3;
      const px = x + width / 2 * Math.cos(angle), py = y + width / 2 * Math.sin(angle);
      if (vertex === 0) path.moveTo(px, py); else path.lineTo(px, py);
    }
  }
  path.closePath();
  return path;
}

// Preview units: 1 = 100 mm. These are conservative geometry guardrails,
// not a load/thermal certification: web >= sheet thickness, border >= 2×.
// Each opening owns a disjoint cell inset by half a web on each side.
// Effects can only resize or move inside that cell, so layers cannot collide.
export function createBottomVentLayout(width: number, innerLength: number, style: VentStyle = "long-slits", density: VentDensity = "medium", options: VentOptions = {}) {
  const thickness = Number.isFinite(options.thickness) ? clamp(options.thickness!, 0.03, 0.06) : 0.05;
  const minimumWeb = Math.max(0.03, thickness), edgeMargin = Math.max(0.08, 2 * thickness), minimumOpening = 0.034;
  const openings: VentOpening[] = [];
  let omitted = 0, limited = 0;
  const design = normalizeVentDesign(options.design);
  const slits = style === "long-slits" || style === "short-slits";
  const nominalWidth = slits ? 0.034 : style === "round" ? 0.05 : 0.06;
  const requestedPitch = (slits ? { low: 0.18, medium: 0.12, high: 0.085 } : { low: 0.24, medium: 0.18, high: 0.13 })[density] ?? 0.12;
  const pitch = Math.max(requestedPitch, nominalWidth + minimumWeb);
  const usableWidth = width - 2 * thickness - 2 * edgeMargin;
  const bandHeight = Math.min(innerLength * 0.18 + 0.034, (innerLength - 2 * edgeMargin - minimumWeb) / 2);
  const nominalHeight = slits ? style === "long-slits" ? bandHeight : Math.min(0.12, bandHeight) : nominalWidth;
  const rowPitch = nominalHeight + Math.max(minimumWeb, requestedPitch - nominalWidth);
  const columns = Math.max(0, Math.min(Math.floor((width - 0.5) / pitch), Math.floor((usableWidth + minimumWeb) / pitch)));
  const rows = bandHeight < nominalHeight || nominalHeight < minimumOpening ? 0 : Math.floor((bandHeight - nominalHeight + 1e-9) / rowPitch) + 1;
  const cellWidth = Math.min(pitch - minimumWeb, usableWidth - (columns - 1) * pitch);
  const bandCenter = clamp(innerLength * 0.28, (minimumWeb + bandHeight) / 2, (innerLength - bandHeight) / 2 - edgeMargin);
  for (const side of [-1, 1]) for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
    const centerX = (column - (columns - 1) / 2) * pitch;
    const centerY = side * bandCenter + (row - (rows - 1) / 2) * rowPitch;
    const cellHeight = Math.min(rowPitch - minimumWeb, bandHeight - (rows - 1) * rowPitch);
    const modulation = { size: 0, "shift-x": 0, "shift-y": 0 };
    for (const layer of design.layers) {
      modulation[layer.target] += layer.amount / 100 * sampleVentField(layer, centerX / Math.max(usableWidth, 0.01), centerY / Math.max(innerLength, 0.01), design.seed);
    }
    const requestedSize = design.size / 100 + modulation.size / 2;
    const size = clamp(requestedSize, 0, 1);
    const maxHeight = Math.min(nominalHeight, cellHeight);
    const openingWidth = slits ? nominalWidth : minimumOpening + (nominalWidth - minimumOpening) * size;
    const openingHeight = slits ? minimumOpening + (maxHeight - minimumOpening) * size : openingWidth;
    const shiftX = clamp(modulation["shift-x"], -1, 1), shiftY = clamp(modulation["shift-y"], -1, 1);
    if (size !== requestedSize || shiftX !== modulation["shift-x"] || shiftY !== modulation["shift-y"]) limited++;
    const opening = {
      x: centerX + shiftX * Math.max(0, (cellWidth - openingWidth) / 2),
      y: centerY + shiftY * Math.max(0, (cellHeight - openingHeight) / 2),
      width: openingWidth, height: openingHeight,
    };
    // Keep full webs around custom cuts too. Their bounding boxes intentionally
    // reserve a little extra material for rotated or intricate imported shapes.
    const excluded = options.exclusions?.some(box =>
      opening.x + opening.width / 2 > box.left - minimumWeb - 1e-9 && opening.x - opening.width / 2 < box.right + minimumWeb + 1e-9 &&
      opening.y + opening.height / 2 > box.bottom - minimumWeb - 1e-9 && opening.y - opening.height / 2 < box.top + minimumWeb + 1e-9);
    if (excluded) omitted++; else openings.push(opening);
  }
  return { paths: openings.map(opening => ventOpeningPath(opening, style)), openings, minimumWeb, edgeMargin, minimumOpening, limited, omitted, pitchAdjusted: pitch > requestedPitch };
}

export function createBottomVents(width: number, innerLength: number, style: VentStyle = "long-slits", density: VentDensity = "medium", options: VentOptions = {}) {
  return createBottomVentLayout(width, innerLength, style, density, options).paths;
}
