import polygonClipping, { type MultiPolygon } from "polygon-clipping";
import { defaultTint, defaultTransparency, type AcrylicTint, type AcrylicTransparency } from "./acrylic-material";
import { standPathData } from "./synth-stand";

export const protectorLimits = {
  width: { min: 180, max: 1400 }, depth: { min: 120, max: 600 }, height: { min: 20, max: 200 },
  headroom: { min: 15, max: 120 }, overhang: { min: 20, max: 60 },
  footInset: { min: 15, max: 100 }, edgeGap: { min: 0, max: 2 },
  sideExtraFeet: { min: 0, max: 6 }, endExtraFeet: { min: 0, max: 8 },
  thickness: { min: 5, max: 10 }, clearance: { min: 0, max: 0.4 },
};
export type ProtectorConfiguration = Record<keyof typeof protectorLimits, number> & { tint: AcrylicTint; transparency?: AcrylicTransparency; allSides: boolean; lockingStrips: boolean };
export const defaultProtectorConfiguration: ProtectorConfiguration = {
  width: 550, depth: 280, height: 70, headroom: 35, overhang: 20, footInset: 30, edgeGap: 0.5,
  allSides: false, lockingStrips: false, sideExtraFeet: 0, endExtraFeet: 0,
  thickness: 6, clearance: 0.15, tint: defaultTint, transparency: defaultTransparency,
};
export type ProtectorEdge = "left" | "right" | "front" | "rear";
export type ProtectorPart = { id: string; label: string; kind: "cover" | "foot" | "strip"; polygons: MultiPolygon; width: number; height: number; minX: number; minY: number; side: number; depthPosition: number; edge?: ProtectorEdge; center: [number, number]; rotationY: number };
const rect = (x1: number, y1: number, x2: number, y2: number): MultiPolygon => [[[[x1, y1], [x2, y1], [x2, y2], [x1, y2], [x1, y1]]]];
export function protectorSupportLimits(config: ProtectorConfiguration) {
  // Keep perpendicular feet and the wider strip stop heads apart at corners.
  const insetMin = config.allSides ? Math.max(15, config.thickness / 2 + (config.lockingStrips ? 20 : 14)) : 15;
  const insetMax = Math.min(100, config.depth / 3, config.allSides ? config.width / 3 : Infinity);
  const inset = Math.max(insetMin, Math.min(insetMax, config.footInset));
  const minimumSpacing = 2 * config.thickness + config.clearance + 4;
  const count = (length: number, max: number) => Math.max(0, Math.min(max, Math.floor((length - 2 * inset) / minimumSpacing) - 1));
  return { insetMin, insetMax, sideExtraMax: count(config.depth, 6), endExtraMax: count(config.width, 8), minimumSpacing };
}
export function createSynthProtector(input: ProtectorConfiguration) {
  const config = { ...input, transparency: input.transparency ?? defaultTransparency, allSides: input.allSides === true, lockingStrips: input.lockingStrips === true };
  for (const key of Object.keys(protectorLimits) as (keyof typeof protectorLimits)[]) {
    const { min, max } = protectorLimits[key];
    config[key] = Math.max(min, Math.min(max, Number.isFinite(input[key]) ? input[key] : defaultProtectorConfiguration[key]));
  }
  const supportLimits = protectorSupportLimits(config);
  config.footInset = Math.max(supportLimits.insetMin, Math.min(supportLimits.insetMax, config.footInset));
  config.sideExtraFeet = Math.min(supportLimits.sideExtraMax, Math.round(config.sideExtraFeet));
  config.endExtraFeet = Math.min(supportLimits.endExtraMax, Math.round(config.endExtraFeet));
  const { width, depth, height, headroom, overhang, thickness: t, clearance, edgeGap, lockingStrips } = config;
  const coverWidth = width + 2 * overhang, coverDepth = depth + 2 * overhang;
  const slotWidth = t + clearance, tabWidth = 16, slotLength = tabWidth + clearance;
  const lipDepth = 12, contactWidth = 12 - edgeGap;
  const outerFoot = overhang - edgeGap - 3;
  const stripWidth = 8, stripEnd = t / 2 + 12;
  const holeBottom = headroom + t + 0.2, holeHeight = t + clearance;
  const tabTop = lockingStrips ? holeBottom + holeHeight + 6 : headroom + t;
  const stripBottom = holeBottom + clearance / 2;
  const outline: MultiPolygon = [[[[-12, 0], [0, 0], [0, -lipDepth], [outerFoot, -lipDepth], [outerFoot, headroom], [8, headroom], [8, tabTop], [-8, tabTop], [-8, headroom], [-12, headroom], [-12, 0]]]];
  const footOutline = lockingStrips ? polygonClipping.difference(outline, rect(-(stripWidth + clearance) / 2, holeBottom, (stripWidth + clearance) / 2, holeBottom + holeHeight)) : outline;
  const edges: { edge: ProtectorEdge; normal: [number, number]; length: number; offset: number; extra: number }[] = [
    { edge: "left", normal: [-1, 0], length: depth, offset: width / 2 + edgeGap, extra: config.sideExtraFeet },
    { edge: "right", normal: [1, 0], length: depth, offset: width / 2 + edgeGap, extra: config.sideExtraFeet },
    ...(config.allSides ? [
      { edge: "front" as const, normal: [0, -1] as [number, number], length: width, offset: depth / 2 + edgeGap, extra: config.endExtraFeet },
      { edge: "rear" as const, normal: [0, 1] as [number, number], length: width, offset: depth / 2 + edgeGap, extra: config.endExtraFeet },
    ] : []),
  ];
  const feet: ProtectorPart[] = [], strips: ProtectorPart[] = [];
  for (const { edge, normal: [nx, nd], length, offset, extra } of edges) {
    const span = length - 2 * config.footInset, rotationY = Math.atan2(nd, nx);
    for (let i = 0; i < extra + 2; i++) {
      const along = -span / 2 + i * span / (extra + 1);
      feet.push({ id: `foot-${edge}-${i + 1}`, label: `${edge[0].toUpperCase() + edge.slice(1)} foot ${i + 1}`, kind: "foot", polygons: footOutline,
        width: outerFoot + 12, height: tabTop + lipDepth, minX: -12, minY: -lipDepth, side: nx,
        depthPosition: nd * offset + nx * along, edge, center: [nx * offset - nd * along, nd * offset + nx * along], rotationY });
    }
    if (lockingStrips) {
      const halfLength = span / 2 + stripEnd;
      // The widened trailing head stops the strip at its insertion end.
      const stripOutline = polygonClipping.union(rect(-stripWidth / 2, -halfLength, stripWidth / 2, halfLength), rect(-6, -halfLength, 6, -halfLength + 12));
      strips.push({ id: `strip-${edge}`, label: `${edge[0].toUpperCase() + edge.slice(1)} retaining strip`, kind: "strip", polygons: stripOutline,
        width: 12, height: 2 * halfLength, minX: -6, minY: -halfLength, side: nx, depthPosition: nd * offset, edge, center: [nx * offset, nd * offset], rotationY });
    }
  }
  const slots = feet.map(foot => {
    const [x, y] = foot.center, sideEdge = foot.edge === "left" || foot.edge === "right";
    const sx = sideEdge ? slotLength : slotWidth, sy = sideEdge ? slotWidth : slotLength;
    return rect(x - sx / 2, y - sy / 2, x + sx / 2, y + sy / 2);
  });
  const cover: ProtectorPart = { id: "top-sheet", label: "Protective top sheet", kind: "cover", polygons: polygonClipping.difference(rect(-coverWidth / 2, -coverDepth / 2, coverWidth / 2, coverDepth / 2), ...slots), width: coverWidth, height: coverDepth, minX: -coverWidth / 2, minY: -coverDepth / 2, side: 0, depthPosition: 0, center: [0, 0], rotationY: 0 };
  return { config, parts: [cover, ...feet, ...strips], footCount: feet.length, stripCount: strips.length, supportLimits, slotWidth, slotLength, tabWidth, lipDepth, contactWidth,
    retention: { enabled: lockingStrips, stripWidth, stripBottom, holeBottom, holeHeight, holeWidth: stripWidth + clearance, tabTop, protrusion: tabTop - headroom - t, stopHeadWidth: 12 },
    coverUnderside: height + headroom, dimensions: { width: coverWidth, depth: coverDepth, height: tabTop + lipDepth }, overallHeight: height + tabTop };
}
export type SynthProtector = ReturnType<typeof createSynthProtector>;
export const protectorBuildNotes = [
  "Place the feet on clear, level body edges. Choose left/right support or all four edges; additional feet are evenly spaced between the end feet. Foot count and corner inset are limited to keep slots, feet and strips apart. The 12 mm shoulders and outside lips locate against the synth with the selected edge gap.",
  "Lower the top sheet onto the foot tabs until it rests on their shoulders. Clearance is measured from body top to sheet underside. With locking strips disabled the tabs finish flush; with strips enabled they extend above the sheet and contain rectangular pass-through holes.",
  "For retention, slide the narrow end of each strip through every raised tab along its edge, until the wider stop head reaches the first foot. The strips block feet from dropping through the sheet. They remain removable and can slide back out; check fit before lifting the assembly. Never lift the synth by the cover.",
  "All parts use one thickness of GS cast acrylic, with no glue or hardware. Slots and strip holes include fit clearance; cut a sample and apply kerf compensation once in CAM. Feet rest on the instrument, not the desk. Check controls, connectors and contact surfaces on every supported edge, especially keys at the front.",
  "Prototype fit, retention and sheet flex before use. Extra supports reduce edge spans but do not establish an impact or load rating, or support the middle of the sheet. Do not stack equipment on the cover. Review internal corner relief and cutting settings with your fabricator.",
];
export function protectorSheetLayout(protector: SynthProtector) {
  const margin = 10, gap = 15;
  const shelfWidth = Math.max(protector.dimensions.width, ...protector.parts.map(part => part.width));
  let x = margin, y = margin, rowHeight = 0, right = 0;
  const parts = protector.parts.map(part => {
    if (x > margin && x + part.width > shelfWidth + margin) { x = margin; y += rowHeight + gap; rowHeight = 0; }
    const placed = { part, x: x - part.minX, y: y + part.minY + part.height };
    right = Math.max(right, x + part.width); rowHeight = Math.max(rowHeight, part.height); x += part.width + gap;
    return placed;
  });
  return { parts, width: right + margin, height: y + rowHeight + margin };
}
const n = (value: number) => String(Number(value.toFixed(3)));
export function protectorSvg(protector: SynthProtector) {
  const layout = protectorSheetLayout(protector);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${n(layout.width)}mm" height="${n(layout.height)}mm" viewBox="0 0 ${n(layout.width)} ${n(layout.height)}" fill="none" stroke="#000" stroke-width="0.2" data-units="mm">
<title>Acryl508 synth protector / top sheet, ${protector.footCount} feet, ${protector.stripCount} retaining strips</title>
<desc>Unvalidated prototype. GS acrylic ${n(protector.config.thickness)} mm. Body-to-cover clearance ${n(protector.config.headroom)} mm; edge gap ${n(protector.config.edgeGap)} mm; slots ${n(protector.slotLength)} by ${n(protector.slotWidth)} mm. Retention: ${protector.retention.enabled ? "raised tabs with closed holes and removable headed strips" : "flush tabs"}. Finished-edge outlines; apply kerf compensation in CAM. No load or impact rating. Test fit and review internal corner relief before fabrication.</desc>
${layout.parts.map(({ part, x, y }) => `<g id="${part.id}" transform="translate(${n(x)} ${n(y)})"><title>${part.label}</title><path d="${standPathData(part.polygons)}" /></g>`).join("\n")}
</svg>\n`;
}
export function protectorExport(protector: SynthProtector) {
  return { product: "Acryl508", mode: "synth-protector", version: 2, units: "mm", status: "unvalidated-prototype",
    configuration: protector.config, material: "GS cast acrylic", dimensions: protector.dimensions, overallHeight: protector.overallHeight,
    construction: { method: protector.retention.enabled ? "Raised foot tabs with pass-through retaining strips" : "Edge-locating feet with flush tabs into closed cover slots", totalParts: protector.parts.length, footCount: protector.footCount, stripCount: protector.stripCount, minimumFootSpacing: protector.supportLimits.minimumSpacing, slotWidth: protector.slotWidth, slotLength: protector.slotLength, tabWidth: protector.tabWidth, lipDepth: protector.lipDepth, contactWidth: protector.contactWidth, coverUnderside: protector.coverUnderside, hardware: 0, adhesive: false, kerfCompensated: false, loadRating: null },
    retention: { ...protector.retention, removal: "Slide each strip out by its widened stop head before separating cover and feet", captiveStrips: false },
    coordinates: "Outlines in mm, Y up. Cover: X across synth, Y front-to-rear. Feet: X outward from synth side plus edge gap, Y relative to synth body top. Each part center is [width-axis X, front-to-rear depth]; rotationY is the Three.js Y rotation in radians. Feet use local X outward and Y up with thickness centered tangentially. Strips use local X outward and local Y along the edge, laid horizontal at body height + stripBottom. Cover underside is height + headroom above the desk.",
    parts: protector.parts, notes: protectorBuildNotes };
}
