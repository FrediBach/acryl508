import polygonClipping, { type MultiPolygon, type Pair } from "polygon-clipping";
import { defaultTint, defaultTransparency, type AcrylicTint, type AcrylicTransparency } from "./acrylic-material";

export type StandConfiguration = {
  width: number; depth: number; height: number; angle: number;
  advancedMode: boolean; diagonalAngle: number;
  thickness: number; clearance: number; tint: AcrylicTint; transparency?: AcrylicTransparency;
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
  diagonalAngle: { min: 5, max: 40 },
};
export const defaultStandConfiguration: StandConfiguration = {
  width: 550, depth: 280, height: 70, angle: 25, thickness: 6, clearance: 0.15, tint: defaultTint, transparency: defaultTransparency,
  advancedMode: false, diagonalAngle: 25,
  cableHoles: false, cableHoleDiameter: 20,
  roundedEdges: false, cornerRadius: 3,
  frontExtension: false, frontExtensionLength: 15,
};
export type StandPart = {
  id: string; label: string; kind: "rib" | "brace"; position: number;
  polygons: MultiPolygon; width: number; height: number; minX: number;
  // Centre-plane origin in assembled width/depth coordinates; yaw about Y.
  placement: { width: number; depth: number; yaw: number };
};
export function normalizeStandConfiguration(input: StandConfiguration): StandConfiguration {
  const config = { ...input, advancedMode: input.advancedMode === true, transparency: input.transparency ?? defaultTransparency, cableHoles: input.cableHoles === true, roundedEdges: input.roundedEdges === true, frontExtension: input.frontExtension === true };
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
  const availableSpan = width - 2 * inset;
  const middleDepth = (front + rear) / 2;
  // Reserve at least 55% of the width (and eight thicknesses) between outer
  // ribs. The entire swept profile, including optional toes, fits the inset.
  const minimumSpan = Math.min(availableSpan, Math.max(availableSpan * 0.55, 8 * t));
  const maximumDiagonal = Math.atan((availableSpan - minimumSpan) / (rear - front));
  const diagonal = config.advancedMode ? Math.min(config.diagonalAngle * Math.PI / 180, maximumDiagonal) : 0;
  const diagonalCos = Math.cos(diagonal), diagonalSin = Math.sin(diagonal), diagonalTan = Math.tan(diagonal);
  const sweep = (rear - front) * diagonalTan;
  const supportSpan = availableSpan - sweep;
  // A layout heuristic, not an acrylic load or deflection calculation.
  const ribCount = Math.max(2, Math.ceil(supportSpan / 220) + 1);
  const ribPositions = Array.from({ length: ribCount }, (_, i) => -supportSpan / 2 + i * supportSpan / (ribCount - 1));
  const bracePositions = [0.18, 0.5, 0.82].map(fraction => depth * cos * fraction);
  const braceWidth = supportSpan + 6 * t;
  // Square laser cuts must clear the full overlap through BOTH sheet
  // thicknesses, not just the other sheet at the centre plane.
  const slotWidth = t * (1 + diagonalSin) / diagonalCos + clearance;
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
  // Account for the depth occupied by the skew sheet's thickness. Intersect
  // the two limiting profiles before stretching into rib-local coordinates;
  // this keeps the contact edge and front stop outside the synth envelope.
  const depthHalfThickness = t * diagonalSin / 2;
  const shiftedProfile = (offset: number): MultiPolygon => [[profile.map(([x, y]): Pair => [x + offset, y])]];
  const ribBase = diagonal ? polygonClipping.intersection(shiftedProfile(-depthHalfThickness), shiftedProfile(depthHalfThickness)) : [[profile]];
  // The concave front-stop corner also needs the continuous swept envelope,
  // not just its two endpoint positions. This hexagon is the instrument
  // rectangle's Minkowski sum with the sheet's horizontal depth interval.
  const h = depthHalfThickness, backX = depth * cos, backY = frontHeight + depth * sin;
  const sweptInstrument: MultiPolygon = [[[
    [-h, frontHeight], [h, frontHeight], [backX + h, backY],
    [backX - height * sin + h, backY + height * cos],
    [backX - height * sin - h, backY + height * cos],
    [-height * sin - h, frontHeight + height * cos], [-h, frontHeight],
  ]]];
  const ribOutline = diagonal ? polygonClipping.difference(ribBase, sweptInstrument)[0][0] : profile;
  const localProfile = ribOutline.map(([x, y]): Pair => [x / diagonalCos, y]);
  const ribPolygons = polygonClipping.difference(roundedOutline(localProfile, cornerRadius), ...bracePositions.map(center => slot(center / diagonalCos, slotWidth, jointCenter + 0.1, -1, reliefRadius)));
  const bracePolygons = polygonClipping.difference(roundedOutline(rectangle(-braceWidth / 2, 0, braceWidth / 2, braceHeight)[0][0], cornerRadius),
    ...ribPositions.map(center => slot(center, slotWidth, jointCenter - 0.1, braceHeight + 1, reliefRadius)),
    ...cableHoleCenters.map(({ x, y }) => circle(x, y, cableHoleDiameter / 2, 64)));
  const ribHeight = Math.max(...ribPolygons.flat(2).map(point => point[1]));
  const ribMinX = Math.min(...ribPolygons.flat(2).map(point => point[0]));
  const ribWidth = Math.max(...ribPolygons.flat(2).map(point => point[0])) - ribMinX;
  const parts: StandPart[] = [
    ...ribPositions.map((position, i): StandPart => ({ id: `rib-${i + 1}`, label: `Support rib ${i + 1}`, kind: "rib", position, polygons: ribPolygons, width: ribWidth, height: ribHeight, minX: ribMinX, placement: { width: position - middleDepth * diagonalTan, depth: 0, yaw: Math.PI / 2 - diagonal } })),
    ...bracePositions.map((position, i): StandPart => ({ id: `brace-${i + 1}`, label: `${["Front", "Middle", "Rear"][i]} cross brace`, kind: "brace", position, polygons: bracePolygons, width: braceWidth, height: braceHeight, minX: -braceWidth / 2, placement: { width: (position - middleDepth) * diagonalTan, depth: position, yaw: 0 } })),
  ];
  const footprint = parts.flatMap(part => part.polygons.flat(2).flatMap(([x]) => [-t / 2, t / 2].map(z => ({
    width: part.placement.width + x * Math.cos(part.placement.yaw) + z * Math.sin(part.placement.yaw),
    depth: part.placement.depth + x * Math.sin(part.placement.yaw) - z * Math.cos(part.placement.yaw),
  }))));
  const bounds = { left: Math.min(...footprint.map(p => p.width)), right: Math.max(...footprint.map(p => p.width)),
    front: Math.min(...footprint.map(p => p.depth)), rear: Math.max(...footprint.map(p => p.depth)) };
  return { config, parts, ribCount, ribPositions, bracePositions, braceWidth, braceHeight, frontHeight, stopHeight, front, rear,
    slotWidth, reliefRadius, jointCenter, supportSpacing,
    diagonal: { enabled: config.advancedMode, requestedAngle: config.diagonalAngle, angle: diagonal * 180 / Math.PI,
      limited: config.advancedMode && diagonal < config.diagonalAngle * Math.PI / 180 - 1e-8,
      intersectionAngle: 90 - diagonal * 180 / Math.PI, sweep, depthHalfThickness },
    frontExtension: { enabled: config.frontExtension, length: frontExtensionLength, stopOuterX, floorFrontX: front },
    cableHoles: { enabled: config.cableHoles, diameter: cableHoleDiameter, minimumWeb: cableHoleWeb, centers: cableHoleCenters, centersByBrace: parts.filter(part => part.kind === "brace").map(part => ({ partId: part.id, centers: cableHoleCenters, widthOffset: part.placement.width, depth: part.placement.depth })), aligned: diagonal === 0, countPerBrace: cableHoleCenters.length, totalCount: cableHoleCenters.length * bracePositions.length },
    dimensions: { width: diagonal ? bounds.right - bounds.left : braceWidth, depth: rear - front, height: ribHeight },
    synthTop: frontHeight + depth * sin + height * cos,
  };
}
export type SynthStand = ReturnType<typeof createSynthStand>;
export const standBuildNotes = [
  "Stand the three cross braces on a level surface with their slots facing up. Align the support ribs, slots facing down, and lower them together until every foot is level. The joint shoulders have 0.2 mm total vertical clearance.",
  "The integral front stops locate the synth. All stand parts are flat GS cast acrylic of one thickness; no screws, glue, bending or separate hardware. Lift the instrument off before moving the stand: open half-lap joints are not captive.",
  "Automatic rib spacing is at most 220 mm, a layout heuristic only. Compact feet end beneath the front stops; an optional front extension adds a toe beyond them. The rear margin is 30 mm; no load capacity or stability rating is calculated. Check actual feet, underside vents, controls and cable clearance.",
  "Standard slot width is measured sheet thickness plus fit clearance. Advanced diagonal ribs use wider slots that clear the full oblique overlap of both sheets; brace positions follow the sweep. Match the front, middle and rear placements in the preview. Cut a fit sample first; never force an interference fit in acrylic. SVG outlines describe finished edges: apply kerf compensation once in the laser software. Rounded slot-root relief is included.",
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
  <title>Acryl508 synth stand / ${stand.config.angle} degrees / ${stand.diagonal.enabled ? "diagonal" : "standard"} / ${stand.parts.length} parts</title>
  <desc>Prototype design. GS acrylic ${stand.config.thickness} mm; slot width ${number(stand.slotWidth)} mm. Diagonal sweep: ${number(stand.diagonal.angle)} degrees; crossing angle ${number(stand.diagonal.intersectionAngle)} degrees. Front extension: ${number(stand.frontExtension.length)} mm beyond the front stops. Outer corners: ${stand.config.roundedEdges ? `up to ${number(stand.config.cornerRadius)} mm radius, locally limited on short edges` : "square"}. Cable holes: ${stand.cableHoles.totalCount}${stand.cableHoles.enabled ? ` at ${number(stand.cableHoles.diameter)} mm diameter, ${stand.cableHoles.aligned ? "aligned across all three braces" : "following diagonal bays; not straight through"}` : ""}. Finished-edge outlines; kerf compensation must be applied in CAM. No validated load rating. Test fit, strength and stability before use. Layout is not nested to a stock sheet size.</desc>
${layout.parts.map(({ part, x, y }) => `  <g id="${part.id}" transform="translate(${number(x)} ${number(y)})"><title>${part.label}</title><path d="${standPathData(part.polygons)}" /></g>`).join("\n")}
</svg>\n`;
}
export function standExport(stand: SynthStand) {
  return { product: "Acryl508", mode: "synth-stand", version: 5, units: "mm", status: "unvalidated-prototype",
    configuration: stand.config, material: "GS cast acrylic", dimensions: stand.dimensions,
    construction: { method: "Open half-lap slots", ribCount: stand.ribCount, braceCount: 3, totalParts: stand.parts.length, hardware: 0, adhesive: false, supportSpacing: stand.supportSpacing, slotWidth: stand.slotWidth, slotRootReliefRadius: stand.reliefRadius, kerfCompensated: false, loadRating: null },
    diagonal: stand.diagonal,
    coordinates: "Part outlines: X right, Y up. placement gives each sheet centre-plane origin in assembled width/depth millimetres and yaw in radians. With local outline coordinate u and thickness coordinate v in [-t/2,t/2], assembled width = placement.width + u*cos(yaw) + v*sin(yaw); depth = placement.depth + u*sin(yaw) - v*cos(yaw). Ribs: X runs along the diagonal, position is width at footprint mid-depth. Braces: X is width relative to their shifted origin, position is front-to-rear depth. All part bottoms sit at Y=0. Instrument front underside is at depth=0 and Y=frontHeight.",
    cableManagement: { ...stand.cableHoles, requestedDiameter: stand.config.cableHoleDiameter, method: stand.cableHoles.aligned ? "Round closed holes between ribs, aligned across all three braces" : "Round closed holes following diagonal rib bays; route cables sideways between braces", coordinates: "Brace-local X right and Y up, in millimetres" },
    edgeRounding: { enabled: stand.config.roundedEdges, requestedRadius: stand.config.cornerRadius, method: "Convex outer corners of flat cutting outlines; tangent circular fillets limited to 45% of each adjacent edge", preserves: "Joint slots, slot-root relief, concave synth-contact corners and cable holes", throughThicknessBevel: false, maximumArcStepDegrees: 5 },
    frontExtension: { ...stand.frontExtension, requestedLength: stand.config.frontExtensionLength, measurement: "Horizontal distance beyond the outside of the integral front stop; zero when disabled" },
    frontHeight: stand.frontHeight, parts: stand.parts, notes: [...standBuildNotes, ...(stand.cableHoles.enabled ? ["Cable holes retain at least two sheet thicknesses to brace edges and joint relief. Diameter is reduced automatically to preserve this web. Check the widest connector fits the resolved hole diameter; holes are closed and require threading the cable through. These geometry limits do not establish strength."] : [])],
  };
}
