import polygonClipping, { type MultiPolygon, type Pair } from "polygon-clipping";
import { acrylicTints, type AcrylicTint } from "./configurator";

export type StandConfiguration = {
  width: number; depth: number; height: number; angle: number;
  thickness: number; clearance: number; tint: AcrylicTint;
};
export const standLimits = {
  width: { min: 180, max: 1400 }, depth: { min: 120, max: 600 },
  height: { min: 20, max: 200 }, angle: { min: 0, max: 45 },
  thickness: { min: 5, max: 10 }, clearance: { min: 0, max: 0.4 },
};
export const defaultStandConfiguration: StandConfiguration = {
  width: 550, depth: 280, height: 70, angle: 25, thickness: 6, clearance: 0.15, tint: acrylicTints[1],
};
export type StandPart = {
  id: string; label: string; kind: "rib" | "brace"; position: number;
  polygons: MultiPolygon; width: number; height: number; minX: number;
};
export function normalizeStandConfiguration(input: StandConfiguration): StandConfiguration {
  const config = { ...input };
  for (const key of Object.keys(standLimits) as (keyof typeof standLimits)[]) {
    const { min, max } = standLimits[key];
    config[key] = Math.max(min, Math.min(max, Number.isFinite(input[key]) ? input[key] : defaultStandConfiguration[key]));
  }
  return config;
}
const rectangle = (left: number, bottom: number, right: number, top: number): MultiPolygon => [[[[left, bottom], [right, bottom], [right, top], [left, top], [left, bottom]]]];
function circle(x: number, y: number, radius: number): MultiPolygon {
  const ring: Pair[] = Array.from({ length: 24 }, (_, index) => {
    const angle = index / 24 * Math.PI * 2;
    return [x + Math.cos(angle) * radius, y + Math.sin(angle) * radius];
  });
  return [[ [...ring, ring[0]] ]];
}
// Root relief removes material beyond the nominal slot, so square mating
// shoulders can seat without being blocked by an inward corner fillet.
function slot(center: number, width: number, root: number, open: number, radius: number) {
  return polygonClipping.union(rectangle(center - width / 2, Math.min(root, open), center + width / 2, Math.max(root, open)),
    circle(center - width / 2, root, radius), circle(center + width / 2, root, radius));
}

export function createSynthStand(input: StandConfiguration) {
  const config = normalizeStandConfiguration(input);
  const { width, depth, height, thickness: t, clearance } = config;
  const angle = config.angle * Math.PI / 180, sin = Math.sin(angle), cos = Math.cos(angle);
  const braceHeight = 8 * t;
  const frontHeight = braceHeight + 3 * t;
  const stopHeight = Math.min(18, height * 0.6);
  const stopDepth = 2 * t;
  // Enclose the whole rectangular instrument's horizontal projection with
  // 30 mm fore/aft margins, including its forward shift when tilted.
  const front = -height * sin - 30 - stopDepth;
  const rear = depth * cos + 30;
  const inset = Math.max(25, 4 * t);
  const supportSpan = width - 2 * inset;
  // A layout heuristic, not an acrylic load or deflection calculation.
  const ribCount = Math.max(2, Math.ceil(supportSpan / 220) + 1);
  const ribPositions = Array.from({ length: ribCount }, (_, i) => -supportSpan / 2 + i * supportSpan / (ribCount - 1));
  const bracePositions = [0.18, 0.5, 0.82].map(fraction => depth * cos * fraction);
  const braceWidth = supportSpan + 6 * t;
  const slotWidth = t + clearance;
  const reliefRadius = Math.min(1.5, t * 0.2);
  const jointCenter = braceHeight / 2;
  const profile: Pair[] = [
    [front, 0], [rear, 0], [rear, frontHeight + depth * sin],
    [depth * cos, frontHeight + depth * sin], [0, frontHeight],
    [-stopHeight * sin, frontHeight + stopHeight * cos],
    [-stopHeight * sin - stopDepth * cos, frontHeight + stopHeight * cos - stopDepth * sin],
    [-stopDepth * cos, frontHeight - stopDepth * sin], [front, frontHeight - stopDepth * sin], [front, 0],
  ];
  const ribPolygons = polygonClipping.difference([[profile]], ...bracePositions.map(center => slot(center, slotWidth, jointCenter + 0.1, -1, reliefRadius)));
  const bracePolygons = polygonClipping.difference(rectangle(-braceWidth / 2, 0, braceWidth / 2, braceHeight), ...ribPositions.map(center => slot(center, slotWidth, jointCenter - 0.1, braceHeight + 1, reliefRadius)));
  const ribHeight = Math.max(...profile.map(point => point[1]));
  const parts: StandPart[] = [
    ...ribPositions.map((position, i): StandPart => ({ id: `rib-${i + 1}`, label: `Support rib ${i + 1}`, kind: "rib", position, polygons: ribPolygons, width: rear - front, height: ribHeight, minX: front })),
    ...bracePositions.map((position, i): StandPart => ({ id: `brace-${i + 1}`, label: `${["Front", "Middle", "Rear"][i]} cross brace`, kind: "brace", position, polygons: bracePolygons, width: braceWidth, height: braceHeight, minX: -braceWidth / 2 })),
  ];
  return { config, parts, ribCount, ribPositions, bracePositions, braceWidth, braceHeight, frontHeight, stopHeight, front, rear,
    slotWidth, reliefRadius, jointCenter, supportSpacing: supportSpan / (ribCount - 1),
    dimensions: { width: braceWidth, depth: rear - front, height: ribHeight },
    synthTop: frontHeight + depth * sin + height * cos,
  };
}
export type SynthStand = ReturnType<typeof createSynthStand>;
export const standBuildNotes = [
  "Stand the three cross braces on a level surface with their slots facing up. Align the support ribs, slots facing down, and lower them together until every foot is level. The joint shoulders have 0.2 mm total vertical clearance.",
  "The integral front stops locate the synth. All stand parts are flat GS cast acrylic of one thickness; no screws, glue, bending or separate hardware. Lift the instrument off before moving the stand: open half-lap joints are not captive.",
  "Automatic rib spacing is at most 220 mm, a layout heuristic only. Solid ribs, three cross braces and an extended footprint resist movement in multiple directions, but no load capacity or stability rating is calculated. Check actual feet, underside vents, controls and cable clearance.",
  "Slot width is measured sheet thickness plus fit clearance. Cut a fit sample first; never force an interference fit in acrylic. SVG outlines describe finished edges: apply kerf compensation once in the laser software. Rounded slot-root relief is included.",
  "Prototype before loading valuable equipment. Validate joint fit, acrylic flex, racking, surface grip and tipping under playing forces. Dimensions alone do not establish strength; mass and centre of gravity are not modelled.",
];
const number = (value: number) => String(Number(value.toFixed(3)));
export function standPathData(polygons: MultiPolygon) {
  return polygons.map(polygon => polygon.map(ring => ring.map(([x, y], i) => `${i ? "L" : "M"}${number(x)} ${number(-y)}`).join(" ") + " Z").join(" ")).join(" ");
}
export function standSheetLayout(stand: SynthStand) {
  const gap = 15, margin = 10;
  const shelfWidth = Math.max(stand.braceWidth, stand.dimensions.depth, 900);
  let x = margin, y = margin, rowHeight = 0, right = 0;
  const parts = stand.parts.map(part => {
    if (x > margin && x + part.width > shelfWidth + margin) { x = margin; y += rowHeight + gap; rowHeight = 0; }
    const placed = { part, x: x - part.minX, y: y + part.height };
    right = Math.max(right, x + part.width); rowHeight = Math.max(rowHeight, part.height); x += part.width + gap;
    return placed;
  });
  return { parts, width: right + margin, height: y + rowHeight + margin };
}
export function standSvg(stand: SynthStand) {
  const layout = standSheetLayout(stand);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${number(layout.width)}mm" height="${number(layout.height)}mm" viewBox="0 0 ${number(layout.width)} ${number(layout.height)}" fill="none" stroke="#000000" stroke-width="0.2" data-units="mm">
  <title>Acryl508 synth stand / ${stand.config.angle} degrees / ${stand.parts.length} parts</title>
  <desc>Prototype design. GS acrylic ${stand.config.thickness} mm; slot width ${number(stand.slotWidth)} mm. Finished-edge outlines; kerf compensation must be applied in CAM. No validated load rating. Test fit, strength and stability before use. Layout is not nested to a stock sheet size.</desc>
${layout.parts.map(({ part, x, y }) => `  <g id="${part.id}" transform="translate(${number(x)} ${number(y)})"><title>${part.label}</title><path d="${standPathData(part.polygons)}" /></g>`).join("\n")}
</svg>\n`;
}
export function standExport(stand: SynthStand) {
  return { product: "Acryl508", mode: "synth-stand", version: 1, units: "mm", status: "unvalidated-prototype",
    configuration: stand.config, material: "GS cast acrylic", dimensions: stand.dimensions,
    construction: { method: "Open half-lap slots", ribCount: stand.ribCount, braceCount: 3, totalParts: stand.parts.length, hardware: 0, adhesive: false, supportSpacing: stand.supportSpacing, slotWidth: stand.slotWidth, slotRootReliefRadius: stand.reliefRadius, kerfCompensated: false, loadRating: null },
    coordinates: "Part outlines: X right, Y up. Ribs: X is front-to-rear depth, position is width-axis centre. Braces: X is width, position is front-to-rear depth. All part bottoms sit at Y=0. Instrument front underside is at depth=0 and Y=frontHeight.",
    frontHeight: stand.frontHeight, parts: stand.parts, notes: standBuildNotes,
  };
}
