import polygonClipping, { type MultiPolygon } from "polygon-clipping";
import { defaultTint, defaultTransparency, type AcrylicTint, type AcrylicTransparency } from "./acrylic-material";
import { standPathData } from "./synth-stand";

export const protectorLimits = {
  width: { min: 180, max: 1400 }, depth: { min: 120, max: 600 }, height: { min: 20, max: 200 },
  headroom: { min: 15, max: 120 }, overhang: { min: 20, max: 60 },
  footInset: { min: 15, max: 100 }, edgeGap: { min: 0, max: 2 },
  thickness: { min: 5, max: 10 }, clearance: { min: 0, max: 0.4 },
};
export type ProtectorConfiguration = Record<keyof typeof protectorLimits, number> & { tint: AcrylicTint; transparency?: AcrylicTransparency };
export const defaultProtectorConfiguration: ProtectorConfiguration = {
  width: 550, depth: 280, height: 70, headroom: 35, overhang: 20, footInset: 30, edgeGap: 0.5,
  thickness: 6, clearance: 0.15, tint: defaultTint, transparency: defaultTransparency,
};
export type ProtectorPart = { id: string; label: string; kind: "cover" | "foot"; polygons: MultiPolygon; width: number; height: number; minX: number; minY: number; side: number; depthPosition: number };
const rect = (x1: number, y1: number, x2: number, y2: number): MultiPolygon => [[[[x1, y1], [x2, y1], [x2, y2], [x1, y2], [x1, y1]]]];
export function createSynthProtector(input: ProtectorConfiguration) {
  const config = { ...input, transparency: input.transparency ?? defaultTransparency };
  for (const key of Object.keys(protectorLimits) as (keyof typeof protectorLimits)[]) {
    const { min, max } = protectorLimits[key];
    config[key] = Math.max(min, Math.min(max, Number.isFinite(input[key]) ? input[key] : defaultProtectorConfiguration[key]));
  }
  config.footInset = Math.min(config.footInset, config.depth / 3);
  const { width, depth, height, headroom, overhang, thickness: t, clearance, edgeGap } = config;
  const coverWidth = width + 2 * overhang, coverDepth = depth + 2 * overhang;
  const slotWidth = t + clearance, tabWidth = 16, slotLength = tabWidth + clearance;
  const lipDepth = 12, contactWidth = 12 - edgeGap;
  const outerFoot = overhang - edgeGap - 3;
  const footOutline: MultiPolygon = [[[[-12, 0], [0, 0], [0, -lipDepth], [outerFoot, -lipDepth], [outerFoot, headroom], [8, headroom], [8, headroom + t], [-8, headroom + t], [-8, headroom], [-12, headroom], [-12, 0]]]];
  const feet: ProtectorPart[] = [-1, 1].flatMap(side => [-1, 1].map(end => ({
    id: `foot-${side < 0 ? "left" : "right"}-${end < 0 ? "front" : "rear"}`,
    label: `${side < 0 ? "Left" : "Right"} ${end < 0 ? "front" : "rear"} foot`, kind: "foot" as const,
    polygons: footOutline, width: outerFoot + 12, height: headroom + t + lipDepth, minX: -12, minY: -lipDepth,
    side, depthPosition: end * (depth / 2 - config.footInset),
  })));
  const slots = feet.map(foot => {
    const x = foot.side * (width / 2 + edgeGap), y = foot.depthPosition;
    return rect(x - slotLength / 2, y - slotWidth / 2, x + slotLength / 2, y + slotWidth / 2);
  });
  const cover: ProtectorPart = { id: "top-sheet", label: "Protective top sheet", kind: "cover", polygons: polygonClipping.difference(rect(-coverWidth / 2, -coverDepth / 2, coverWidth / 2, coverDepth / 2), ...slots), width: coverWidth, height: coverDepth, minX: -coverWidth / 2, minY: -coverDepth / 2, side: 0, depthPosition: 0 };
  return { config, parts: [cover, ...feet], slotWidth, slotLength, tabWidth, lipDepth, contactWidth,
    coverUnderside: height + headroom, dimensions: { width: coverWidth, depth: coverDepth, height: headroom + t + lipDepth },
    overallHeight: height + headroom + t };
}
export type SynthProtector = ReturnType<typeof createSynthProtector>;
export const protectorBuildNotes = [
  "Place two feet on each side of the synth. The 12 mm shoulders sit on a flat, unobstructed body edge; the short outside lips locate against the sides with your chosen edge gap. Move the feet inward from the front and rear to avoid connectors.",
  "Lower the top sheet onto the four upward tabs until it rests on the foot shoulders. Tabs finish flush with the sheet. The sheet underside sits at the selected clearance above the body; allow room for your tallest pots, switches and any desired extra space.",
  "This first option assumes a rectangular synth with level top edges. Feet rest on the instrument, not the desk. Check the contact areas on your own synth; sloped panels, keys and curved cheeks may need a different foot profile. Allow for any protective pads in your measurements.",
  "All five parts use one thickness of GS cast acrylic. Slots include fit clearance; apply kerf compensation once in CAM and cut a fit sample. This is a removable tab-and-slot assembly, with no glue or hardware; lift the cover and feet separately.",
  "Prototype fit and sheet flex before use. This is a dust and accidental-contact cover concept with no tested impact or load rating; do not stack equipment on it. Internal corner relief and fabrication settings need review with your cutter.",
];
export function protectorSheetLayout(protector: SynthProtector) {
  const margin = 10, gap = 15;
  let x = margin;
  const parts = protector.parts.map((part, index) => {
    const left = index === 0 ? margin : x;
    const top = index === 0 ? margin : margin + protector.dimensions.depth + gap;
    if (index > 0) x += part.width + gap;
    return { part, x: left - part.minX, y: top + part.minY + part.height };
  });
  return { parts, width: Math.max(protector.dimensions.width + 2 * margin, x - gap + margin), height: 2 * margin + protector.dimensions.depth + gap + protector.parts[1].height };
}
const n = (value: number) => String(Number(value.toFixed(3)));
export function protectorSvg(protector: SynthProtector) {
  const layout = protectorSheetLayout(protector);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${n(layout.width)}mm" height="${n(layout.height)}mm" viewBox="0 0 ${n(layout.width)} ${n(layout.height)}" fill="none" stroke="#000" stroke-width="0.2" data-units="mm">
<title>Acryl508 synth protector / top sheet and four feet</title>
<desc>Unvalidated prototype. GS acrylic ${n(protector.config.thickness)} mm. Body-to-cover clearance ${n(protector.config.headroom)} mm; edge gap ${n(protector.config.edgeGap)} mm; slots ${n(protector.slotLength)} by ${n(protector.slotWidth)} mm. Finished-edge outlines; apply kerf compensation in CAM. No load or impact rating. Test fit and review internal corner relief before fabrication.</desc>
${layout.parts.map(({ part, x, y }) => `<g id="${part.id}" transform="translate(${n(x)} ${n(y)})"><title>${part.label}</title><path d="${standPathData(part.polygons)}" /></g>`).join("\n")}
</svg>\n`;
}
export function protectorExport(protector: SynthProtector) {
  return { product: "Acryl508", mode: "synth-protector", version: 1, units: "mm", status: "unvalidated-prototype",
    configuration: protector.config, material: "GS cast acrylic", dimensions: protector.dimensions, overallHeight: protector.overallHeight,
    construction: { method: "Four edge-locating feet with upward tabs into closed cover slots", totalParts: 5, slotWidth: protector.slotWidth, slotLength: protector.slotLength, tabWidth: protector.tabWidth, lipDepth: protector.lipDepth, contactWidth: protector.contactWidth, coverUnderside: protector.coverUnderside, hardware: 0, adhesive: false, kerfCompensated: false, loadRating: null },
    coordinates: "Outlines in mm, Y up. Cover: X across synth, Y front-to-rear. Feet: X outward from synth side plus edge gap, Y relative to synth body top. Mirror left feet in X; place each at depthPosition. Cover underside is height + headroom above the desk.",
    parts: protector.parts, notes: protectorBuildNotes };
}
