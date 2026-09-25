import polygonClipping, { type MultiPolygon, type Pair } from "polygon-clipping";
import { defaultTint, defaultTransparency, type AcrylicTint, type AcrylicTransparency } from "./acrylic-material";
import { bendAllowance, bendPoint, type AccessoryBend } from "./accessory-bends";
import { standPathData } from "./synth-stand";

export const artLimits = {
  width: { min: 120, max: 600 }, depth: { min: 120, max: 600 },
  rows: { min: 2, max: 10 }, columns: { min: 2, max: 10 },
  height: { min: 100, max: 600 }, variation: { min: 0, max: 100 }, crown: { min: 0, max: 100 },
  bendAngle: { min: 0, max: 75 }, bendLocation: { min: 10, max: 85 }, bendVariation: { min: 0, max: 100 },
  seed: { min: 1, max: 9999 }, thickness: { min: 3, max: 6 }, clearance: { min: 0, max: 0.4 },
};
export type ArtOverride = { height?: number; bendAngle?: number; bendLocation?: number };
export type ArtConfiguration = Record<keyof typeof artLimits, number> & {
  bends: boolean; tint: AcrylicTint; transparency?: AcrylicTransparency; sheets: Record<string, ArtOverride>;
};
export const defaultArtConfiguration: ArtConfiguration = {
  width: 240, depth: 240, rows: 4, columns: 4, height: 300, variation: 40, crown: 65,
  bends: true, bendAngle: 35, bendLocation: 45, bendVariation: 30, seed: 508,
  thickness: 4, clearance: 0.15, tint: defaultTint, transparency: defaultTransparency, sheets: {},
};
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
export function normalizeArtConfiguration(input: ArtConfiguration): ArtConfiguration {
  const config = { ...defaultArtConfiguration, ...input, sheets: {} as Record<string, ArtOverride> };
  for (const key of Object.keys(artLimits) as (keyof typeof artLimits)[]) {
    const { min, max } = artLimits[key];
    config[key] = clamp(Number.isFinite(input[key]) ? input[key] : defaultArtConfiguration[key], min, max);
  }
  config.rows = Math.round(config.rows / 2) * 2; config.columns = Math.round(config.columns / 2) * 2;
  config.seed = Math.round(config.seed);
  const minimumPitch = 5 * config.thickness + config.clearance;
  config.width = Math.max(config.width, config.columns * minimumPitch);
  config.depth = Math.max(config.depth, config.rows * minimumPitch);
  for (const [id, override] of Object.entries(input.sheets ?? {})) {
    if (!/^[ab]-([1-9]|10)$/.test(id) || !override || typeof override !== "object") continue;
    const clean: ArtOverride = {};
    for (const key of ["height", "bendAngle", "bendLocation"] as const) if (Number.isFinite(override[key])) clean[key] = clamp(override[key]!, artLimits[key].min, artLimits[key].max);
    config.sheets[id] = clean;
  }
  return config;
}
function noise(seed: number, family: number, index: number, channel: number) {
  let n = (seed ^ Math.imul(family + 1, 374761393) ^ Math.imul(index + 1, 668265263) ^ Math.imul(channel + 1, 1274126177)) >>> 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177); n ^= n >>> 16;
  return (n >>> 0) / 4294967295;
}
const rectangle = (x: number, y: number, w: number, h: number): MultiPolygon => [[[[x,y],[x+w,y],[x+w,y+h],[x,y+h],[x,y]]]];
export type ArtPart = {
  id: string; label: string; family: "a" | "b"; position: number; width: number; height: number;
  leafWidth: number; polygons: MultiPolygon; bend: AccessoryBend | null; direction: number;
  settings: Required<ArtOverride>; slots: { center: number; root: number; opens: "up" | "down"; mate: string }[];
};
export function createArt(input: ArtConfiguration) {
  const config = normalizeArtConfiguration(input), t = config.thickness;
  const baseHeight = 8 * t, jointHeight = baseHeight / 2, slotWidth = t + config.clearance;
  // Even counts reserve an open central bay for the leaves of the other family.
  const positions = (span: number, count: number) => Array.from({ length: count }, (_, i) => (i - (count - 1) / 2) * span / count);
  const rows = positions(config.depth, config.rows), columns = positions(config.width, config.columns);
  const parts: ArtPart[] = [];
  for (const family of ["a", "b"] as const) {
    const offsets = family === "a" ? rows : columns, crossings = family === "a" ? columns : rows.map(value => -value);
    const width = family === "a" ? config.width : config.depth;
    const pitch = width / crossings.length;
    const leafWidth = Math.max(2 * t, pitch - slotWidth - 2 * t);
    offsets.forEach((position, index) => {
      const id = `${family}-${index + 1}`, f = family === "a" ? 0 : 1;
      const edge = Math.abs((index - (offsets.length - 1) / 2) / (offsets.length / 2));
      const generated = {
        height: clamp(config.height * (1 - config.crown / 100 * edge * 0.6 + (noise(config.seed, f, index, 0) - 0.5) * config.variation / 100 * 0.7), 100, 600),
        bendAngle: clamp(config.bendAngle + (noise(config.seed, f, index, 1) - 0.5) * config.bendVariation * 0.5, 0, 75),
        bendLocation: clamp(config.bendLocation + (noise(config.seed, f, index, 2) - 0.5) * config.bendVariation * 0.4, 10, 85),
      };
      const settings = { ...generated, ...config.sheets[id] };
      const angle = config.bends ? settings.bendAngle : 0;
      const allowance = bendAllowance(angle, t / 100);
      const leafLength = settings.height - baseHeight;
      const bend = angle > 0 ? { start: (baseHeight + leafLength * settings.bendLocation / 100) / 100, length: allowance.length, angle: allowance.angle } : null;
      const height = settings.height + allowance.length * 100;
      // A broad root, parallel lower sides, then a rounded lance-shaped crown.
      const outline: Pair[] = [[-width / 2,0],[width / 2,0],[width / 2,baseHeight],[leafWidth / 2,baseHeight]];
      const shoulder = baseHeight + (height - baseHeight) * 0.5;
      outline.push([leafWidth / 2,shoulder]);
      for (let step = 0; step <= 24; step++) {
        const theta = step / 24 * Math.PI;
        outline.push([leafWidth / 2 * Math.cos(theta), shoulder + (height - shoulder) * Math.sin(theta)]);
      }
      outline.push([-leafWidth / 2,baseHeight],[-width / 2,baseHeight],[-width / 2,0]);
      const opens = family === "a" ? "down" : "up";
      const root = jointHeight + (opens === "down" ? 0.1 : -0.1);
      const slots: ArtPart["slots"] = crossings.map((center, i) => ({ center, root, opens, mate: `${family === "a" ? "b" : "a"}-${i + 1}` }));
      const cuts = slots.map(slot => rectangle(slot.center - slotWidth / 2, opens === "down" ? -1 : root, slotWidth, opens === "down" ? root + 1 : baseHeight - root + 1));
      const polygons = polygonClipping.difference([[outline]], ...cuts);
      // B is rotated +90° about Y, so its local +Z points toward world +X.
      parts.push({ id, label: `Sheet ${id.toUpperCase()}`, family, position, width, height, leafWidth, polygons, bend, direction: Math.sign(position), settings, slots });
    });
  }
  const points = parts.flatMap(part => part.polygons.flatMap(polygon => polygon.flatMap(ring => ring.map(([x,y]) => {
    const p = bendPoint(x / 100, y / 100, t / 200, t / 100, part.bend ? [part.bend] : [], part.direction);
    const offset = (p.z - t / 200) * 100;
    return part.family === "a" ? [x, p.y * 100, part.position + offset] : [part.position + offset, p.y * 100, -x];
  }))));
  const dimensions = { width: Math.max(...points.map(p => p[0])) - Math.min(...points.map(p => p[0])) + t, depth: Math.max(...points.map(p => p[2])) - Math.min(...points.map(p => p[2])) + t, height: Math.max(...points.map(p => p[1])) };
  return { config, parts, baseHeight, jointHeight, slotWidth, dimensions };
}
export type Art = ReturnType<typeof createArt>;
export function artSheetLayout(art: Art) {
  let x = 10, y = 10, rowHeight = 0, right = 0;
  const parts = art.parts.map(part => {
    if (x > 10 && x + part.width > 910) { x = 10; y += rowHeight + 15; rowHeight = 0; }
    const placed = { part, x: x + part.width / 2, y: y + part.height };
    right = Math.max(right, x + part.width); rowHeight = Math.max(rowHeight, part.height); x += part.width + 15;
    return placed;
  });
  return { parts, width: right + 10, height: y + rowHeight + 10 };
}
export const artBuildNotes = [
  "Stand family B slots-up, then lower family A slots-down. All crossings share the same joint height; the leaves rise through open central bays.",
  "Height, crown and variation create a repeatable plant-like form. The seed changes its pattern. Individual sheet overrides stay fixed until reset.",
  "Bends start above the slotted base and point away from the centre. Form after assembly; bending before assembly can obstruct insertion. Preview and flat patterns use a mid-sheet neutral axis and an inside radius of twice the thickness.",
  "Cut a slot-fit coupon from measured GS acrylic first. Apply laser kerf compensation once in CAM. Blue dashed SVG lines are bend-start guides, not cuts.",
  "This is a decorative prototype. Test forming, joint fit and stability; leaf collisions and tipping are not simulated. Keep the assembled grid supported while forming.",
];
export function artExport(art: Art) {
  return { product: "Acryl508", mode: "art", version: 1, units: "mm", status: "unvalidated-prototype", configuration: art.config,
    dimensions: art.dimensions, construction: { baseHeight: art.baseHeight, jointHeight: art.jointHeight, slotWidth: art.slotWidth, method: "Open half-lap grid", hardware: 0 },
    coordinates: "Part outlines are millimetres, X along the sheet, Y up. A sheets lie along world X at Z=position. B sheets rotate +90 degrees around Y and lie at X=position. Bend start/length are in 100 mm scene units; bend angle is radians. Bend direction follows the sign of position, away from the centre.",
    parts: art.parts, notes: artBuildNotes };
}
export function artSvg(art: Art) {
  const layout = artSheetLayout(art);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}mm" height="${layout.height}mm" viewBox="0 0 ${layout.width} ${layout.height}"><title>Acryl508 art / ${art.parts.length} sheets</title><desc>GS acrylic ${art.config.thickness} mm. Slots ${art.slotWidth} mm. Red: finished cut edges. Blue dashed: bend-start guides, do not cut. Bend allowance included; mid-sheet neutral axis, inside radius ${2 * art.config.thickness} mm. Form outward after slotting together. Prototype fit, forming and stability.</desc>${layout.parts.map(({part,x,y}) => `<g id="${part.id}" transform="translate(${x} ${y})"><title>${part.label} / ${part.bend ? `${part.settings.bendAngle.toFixed(1)} degrees outward; bend starts ${(part.bend.start * 100).toFixed(1)} mm above base bottom` : "flat"}</title><path data-operation="cut" d="${standPathData(part.polygons)}" fill="none" stroke="#ef4444" stroke-width="0.2"/>${part.bend ? `<path data-operation="bend-guide" d="M${-part.leafWidth/2} ${-part.bend.start*100}H${part.leafWidth/2}" fill="none" stroke="#2563eb" stroke-width="0.2" stroke-dasharray="2 2"/>` : ""}</g>`).join("")}</svg>`;
}
