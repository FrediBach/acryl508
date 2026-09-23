import polygonClipping, { type MultiPolygon, type Pair } from "polygon-clipping";
import { acrylicTints, type AcrylicTint } from "./configurator";

export type StandConfiguration = {
  width: number; depth: number; height: number; angle: number;
  thickness: number; clearance: number; tint: AcrylicTint;
  cableHoles: boolean; cableHoleDiameter: number;
  roundedEdges: boolean; cornerRadius: number;
  frontExtension: boolean; frontExtensionLength: number;
};
export const standLimits = {
  width: { min: 180, max: 1400 }, depth: { min: 120, max: 600 },
  height: { min: 20, max: 200 }, angle: { min: 0, max: 45 },
  thickness: { min: 5, max: 10 }, clearance: { min: 0, max: 0.4 },
  cableHoleDiameter: { min: 8, max: 32 },
  cornerRadius: { min: 1, max: 10 },
  frontExtensionLength: { min: 5, max: 100 },
};
export const defaultStandConfiguration: StandConfiguration = {
  width: 550, depth: 280, height: 70, angle: 25, thickness: 6, clearance: 0.15, tint: acrylicTints[1],
  cableHoles: false, cableHoleDiameter: 20,
  roundedEdges: false, cornerRadius: 3,
  frontExtension: false, frontExtensionLength: 15,
};
export type StandPart = {
  id: string; label: string; kind: "rib" | "brace"; position: number;
  polygons: MultiPolygon; width: number; height: number; minX: number;
};
export function normalizeStandConfiguration(input: StandConfiguration): StandConfiguration {
  const config = { ...input, cableHoles: input.cableHoles === true, roundedEdges: input.roundedEdges === true, frontExtension: input.frontExtension === true };
  for (const key of Object.keys(standLimits) as (keyof typeof standLimits)[]) {
    const { min, max } = standLimits[key];
    config[key] = Math.max(min, Math.min(max, Number.isFinite(input[key]) ? input[key] : defaultStandConfiguration[key]));
  }
  return config;
}
const rectangle = (left: number, bottom: number, right: number, top: number): MultiPolygon => [[[[left, bottom], [right, bottom], [right, top], [left, top], [left, bottom]]]];
// Fillet only convex corners of the CCW outer profile, before cutting joints.
// This removes material; concave synth-contact corners stay exact. Limit each
// tangent run to 45% of its edge so adjacent fillets cannot overlap.
function roundedOutline(outline: Pair[], radius: number): MultiPolygon {
  if (!radius) return [[outline]];
  const points = outline.slice(0, -1);
  const rounded: Pair[] = [];
  points.forEach((point, index) => {
    const previous = points[(index + points.length - 1) % points.length], next = points[(index + 1) % points.length];
    const incoming = [point[0] - previous[0], point[1] - previous[1]];
    const outgoing = [next[0] - point[0], next[1] - point[1]];
    const beforeLength = Math.hypot(...incoming), afterLength = Math.hypot(...outgoing);
    const cross = incoming[0] * outgoing[1] - incoming[1] * outgoing[0];
    if (cross <= 1e-8 || beforeLength < 1e-8 || afterLength < 1e-8) { rounded.push(point); return; }
    const before = [-incoming[0] / beforeLength, -incoming[1] / beforeLength];
    const after = [outgoing[0] / afterLength, outgoing[1] / afterLength];
    const halfAngle = Math.acos(Math.max(-1, Math.min(1, before[0] * after[0] + before[1] * after[1]))) / 2;
    const tangent = Math.min(radius / Math.tan(halfAngle), beforeLength * 0.45, afterLength * 0.45);
    const actualRadius = tangent * Math.tan(halfAngle);
    const bisectorLength = Math.hypot(before[0] + after[0], before[1] + after[1]);
    const offset = actualRadius / Math.sin(halfAngle) / bisectorLength;
    const center = [point[0] + (before[0] + after[0]) * offset, point[1] + (before[1] + after[1]) * offset];
    const entry: Pair = [point[0] + before[0] * tangent, point[1] + before[1] * tangent];
    const exit: Pair = [point[0] + after[0] * tangent, point[1] + after[1] * tangent];
    const start = Math.atan2(entry[1] - center[1], entry[0] - center[0]);
    const sweep = Math.PI - 2 * halfAngle;
    // At most 5° per segment; the largest permitted radius has <0.01 mm sag.
    const steps = Math.max(2, Math.ceil(sweep / (Math.PI / 36)));
    rounded.push(entry);
    for (let i = 1; i < steps; i++) {
      const angle = start + sweep * i / steps;
      rounded.push([center[0] + actualRadius * Math.cos(angle), center[1] + actualRadius * Math.sin(angle)]);
    }
    rounded.push(exit);
  });
  return [[ [...rounded, rounded[0]] ]];
}
function circle(x: number, y: number, radius: number, segments = 24): MultiPolygon {
  const ring: Pair[] = Array.from({ length: segments }, (_, index) => {
    const angle = index / segments * Math.PI * 2;
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
  // Compact feet end under the outside of the front stop. An optional toe
  // extends horizontally from there, independently of the instrument height.
  const stopOuterX = -stopHeight * sin - stopDepth * cos;
  const frontExtensionLength = config.frontExtension ? config.frontExtensionLength : 0;
  const front = stopOuterX - frontExtensionLength;
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
  // One aligned passage in each bay across all three braces. Keep two sheet
  // thicknesses of material to the edges and the entire joint-relief envelope.
  const cableHoleWeb = 2 * t;
  const supportSpacing = supportSpan / (ribCount - 1);
  const cableHoleDiameter = Math.min(config.cableHoleDiameter, braceHeight - 2 * cableHoleWeb,
    supportSpacing - slotWidth - 2 * reliefRadius - 2 * cableHoleWeb);
  const cableHoleCenters = config.cableHoles ? ribPositions.slice(1).map((right, index) => ({ x: (ribPositions[index] + right) / 2, y: jointCenter })) : [];
  const profile: Pair[] = [
    [front, 0], [rear, 0], [rear, frontHeight + depth * sin],
    [depth * cos, frontHeight + depth * sin], [0, frontHeight],
    [-stopHeight * sin, frontHeight + stopHeight * cos],
    [stopOuterX, frontHeight + stopHeight * cos - stopDepth * sin],
    [front, frontHeight - stopDepth * sin], [front, 0],
  ];
  const cornerRadius = config.roundedEdges ? config.cornerRadius : 0;
  const ribPolygons = polygonClipping.difference(roundedOutline(profile, cornerRadius), ...bracePositions.map(center => slot(center, slotWidth, jointCenter + 0.1, -1, reliefRadius)));
  const bracePolygons = polygonClipping.difference(roundedOutline(rectangle(-braceWidth / 2, 0, braceWidth / 2, braceHeight)[0][0], cornerRadius),
    ...ribPositions.map(center => slot(center, slotWidth, jointCenter - 0.1, braceHeight + 1, reliefRadius)),
    ...cableHoleCenters.map(({ x, y }) => circle(x, y, cableHoleDiameter / 2, 64)));
  const ribHeight = Math.max(...ribPolygons.flat(2).map(point => point[1]));
  const parts: StandPart[] = [
    ...ribPositions.map((position, i): StandPart => ({ id: `rib-${i + 1}`, label: `Support rib ${i + 1}`, kind: "rib", position, polygons: ribPolygons, width: rear - front, height: ribHeight, minX: front })),
    ...bracePositions.map((position, i): StandPart => ({ id: `brace-${i + 1}`, label: `${["Front", "Middle", "Rear"][i]} cross brace`, kind: "brace", position, polygons: bracePolygons, width: braceWidth, height: braceHeight, minX: -braceWidth / 2 })),
  ];
  return { config, parts, ribCount, ribPositions, bracePositions, braceWidth, braceHeight, frontHeight, stopHeight, front, rear,
    slotWidth, reliefRadius, jointCenter, supportSpacing,
    frontExtension: { enabled: config.frontExtension, length: frontExtensionLength, stopOuterX, floorFrontX: front },
    cableHoles: { enabled: config.cableHoles, diameter: cableHoleDiameter, minimumWeb: cableHoleWeb, centers: cableHoleCenters, countPerBrace: cableHoleCenters.length, totalCount: cableHoleCenters.length * bracePositions.length },
    dimensions: { width: braceWidth, depth: rear - front, height: ribHeight },
    synthTop: frontHeight + depth * sin + height * cos,
  };
}
export type SynthStand = ReturnType<typeof createSynthStand>;
export const standBuildNotes = [
  "Stand the three cross braces on a level surface with their slots facing up. Align the support ribs, slots facing down, and lower them together until every foot is level. The joint shoulders have 0.2 mm total vertical clearance.",
  "The integral front stops locate the synth. All stand parts are flat GS cast acrylic of one thickness; no screws, glue, bending or separate hardware. Lift the instrument off before moving the stand: open half-lap joints are not captive.",
  "Automatic rib spacing is at most 220 mm, a layout heuristic only. Compact feet end beneath the front stops; an optional front extension adds a toe beyond them. The rear margin is 30 mm; no load capacity or stability rating is calculated. Check actual feet, underside vents, controls and cable clearance.",
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
  <desc>Prototype design. GS acrylic ${stand.config.thickness} mm; slot width ${number(stand.slotWidth)} mm. Front extension: ${number(stand.frontExtension.length)} mm beyond the front stops. Outer corners: ${stand.config.roundedEdges ? `up to ${number(stand.config.cornerRadius)} mm radius, locally limited on short edges` : "square"}. Cable holes: ${stand.cableHoles.totalCount}${stand.cableHoles.enabled ? ` at ${number(stand.cableHoles.diameter)} mm diameter, aligned across all three braces` : ""}. Finished-edge outlines; kerf compensation must be applied in CAM. No validated load rating. Test fit, strength and stability before use. Layout is not nested to a stock sheet size.</desc>
${layout.parts.map(({ part, x, y }) => `  <g id="${part.id}" transform="translate(${number(x)} ${number(y)})"><title>${part.label}</title><path d="${standPathData(part.polygons)}" /></g>`).join("\n")}
</svg>\n`;
}
export function standExport(stand: SynthStand) {
  return { product: "Acryl508", mode: "synth-stand", version: 4, units: "mm", status: "unvalidated-prototype",
    configuration: stand.config, material: "GS cast acrylic", dimensions: stand.dimensions,
    construction: { method: "Open half-lap slots", ribCount: stand.ribCount, braceCount: 3, totalParts: stand.parts.length, hardware: 0, adhesive: false, supportSpacing: stand.supportSpacing, slotWidth: stand.slotWidth, slotRootReliefRadius: stand.reliefRadius, kerfCompensated: false, loadRating: null },
    coordinates: "Part outlines: X right, Y up. Ribs: X is front-to-rear depth, position is width-axis centre. Braces: X is width, position is front-to-rear depth. All part bottoms sit at Y=0. Instrument front underside is at depth=0 and Y=frontHeight.",
    cableManagement: { ...stand.cableHoles, requestedDiameter: stand.config.cableHoleDiameter, method: "Round closed holes between ribs, aligned across all three braces", coordinates: "Brace-local X right and Y up, in millimetres" },
    edgeRounding: { enabled: stand.config.roundedEdges, requestedRadius: stand.config.cornerRadius, method: "Convex outer corners of flat cutting outlines; tangent circular fillets limited to 45% of each adjacent edge", preserves: "Joint slots, slot-root relief, concave synth-contact corners and cable holes", throughThicknessBevel: false, maximumArcStepDegrees: 5 },
    frontExtension: { ...stand.frontExtension, requestedLength: stand.config.frontExtensionLength, measurement: "Horizontal distance beyond the outside of the integral front stop; zero when disabled" },
    frontHeight: stand.frontHeight, parts: stand.parts, notes: [...standBuildNotes, ...(stand.cableHoles.enabled ? ["Cable holes retain at least two sheet thicknesses to brace edges and joint relief. Diameter is reduced automatically to preserve this web. Check the widest connector fits the resolved hole diameter; holes are closed and require threading the cable through. These geometry limits do not establish strength."] : [])],
  };
}
