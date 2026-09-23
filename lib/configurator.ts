import { cutoutSides, type CustomCutout, type CutoutReport, type CutoutSide } from "./custom-cutouts";
import type { MultiPolygon } from "polygon-clipping";
import { defaultVentDesign, normalizeVentDesign, type VentDesign } from "./vent-design";
import { cableHolderLayout } from "./cable-holder";
import { sinusodaHoles, sinusodaJuice, sinusodaPlacement } from "./sinusoda";
import { trolleyBus, trolleyHoles, trolleyMountingHoles, trolleyPlacement } from "./trolley";
import { compactPwr, compactPwrHoles, compactPwrPlacement } from "./compactpwr";

export type AcrylicTint = { id: string; label: string; color: string };
export type PanelSide = CutoutSide;
export const panelSides = cutoutSides;
export type Busboard = "none" | "sinusoda" | "trolley" | "compactpwr";
export type FootShape = "wedge" | "arch" | "sled";
export type RackUnit = 1 | 3;
export type VentStyle = "long-slits" | "short-slits" | "round" | "hexagonal" | "mixed";
export type VentDensity = "low" | "medium" | "high";
export type VentLayout = "aligned" | "staggered";
export type VentCoverage = "bands" | "field";
export type VentMix = "checkerboard" | "rows" | "columns";
export type CaseConfiguration = {
  hp: number; rows: number; rowUnits: RackUnit[]; depth: number; thickness: number; sideMarginRatio: number;
  tint: AcrylicTint; individualPanelTints?: boolean; panelTints?: Partial<Record<PanelSide, AcrylicTint>>;
  angle: number; vents: boolean; busboard: Busboard;
  ventStyle: VentStyle; ventDensity: VentDensity;
  ventLayout: VentLayout; ventCoverage: VentCoverage; ventMix: VentMix;
  ventDesign: VentDesign;
  handle: boolean; handleMode?: "auto" | "single" | "pair"; handleWidth?: number; handleHeight?: number; footShape: FootShape;
  cableHolder?: boolean; cableHolderHeight?: number; cableHolderSlitWidth?: number;
  cutouts: CustomCutout[];
};
export const acrylicTints: AcrylicTint[] = [
  { id: "clear", label: "Crystal", color: "#cae5e1" },
  { id: "orange", label: "Signal orange", color: "#ff6a18" },
  { id: "smoke", label: "Smoke", color: "#686d70" },
  { id: "green", label: "Sea glass", color: "#57b7a6" },
  { id: "blue", label: "Cobalt", color: "#578fc8" },
];
export function panelTintsFrom(tint: AcrylicTint): Record<PanelSide, AcrylicTint> {
  return Object.fromEntries(panelSides.map(({ value }) => [value, tint])) as Record<PanelSide, AcrylicTint>;
}
export function panelTint(config: Pick<CaseConfiguration, "tint" | "individualPanelTints" | "panelTints">, side: PanelSide) {
  return config.individualPanelTints ? config.panelTints?.[side] ?? config.tint : config.tint;
}
export const maxRackUnits = 9;
export const rackUnitPitch = 44.45;
export const minSideMarginRatio = 1;
export const maxSideMarginRatio = 2;
export const busboards: Record<Busboard, string> = { none: "No busboard", sinusoda: "Sinusoda Juice", trolley: "Trolley Bus", compactpwr: "CompactPWR" };
export const footShapes: { value: FootShape; label: string; description: string }[] = [
  { value: "wedge", label: "Wedge", description: "Solid side panels extend to the floor." },
  { value: "arch", label: "Arch", description: "An arch in each side panel leaves two contact points." },
  { value: "sled", label: "Sled", description: "Thicker runners surround a tapered opening with rounded inner corners." },
];
export const ventStyles: { value: VentStyle; label: string }[] = [
  { value: "long-slits", label: "Long slits" },
  { value: "short-slits", label: "Short slits" },
  { value: "round", label: "Round holes" },
  { value: "hexagonal", label: "Hexagonal holes" },
  { value: "mixed", label: "Dots & slits" },
];
export const ventLayouts: { value: VentLayout; label: string }[] = [
  { value: "aligned", label: "Aligned" }, { value: "staggered", label: "Staggered" },
];
export const ventCoverages: { value: VentCoverage; label: string }[] = [
  { value: "bands", label: "Two bands" }, { value: "field", label: "Full field" },
];
export const ventMixes: { value: VentMix; label: string }[] = [
  { value: "checkerboard", label: "Every opening" }, { value: "rows", label: "By row" }, { value: "columns", label: "By column" },
];
export const ventDensities: { value: VentDensity; label: string }[] = [
  { value: "low", label: "Low" }, { value: "medium", label: "Medium" }, { value: "high", label: "High" },
];
export const defaultConfiguration: CaseConfiguration = {
  hp: 84, rows: 1, rowUnits: [3], depth: 75, thickness: 5, sideMarginRatio: 2, tint: acrylicTints[1], angle: 0, vents: true, busboard: "none",
  handle: false, handleMode: "auto", handleWidth: 160, handleHeight: 70, footShape: "wedge", cutouts: [], ventStyle: "long-slits", ventDensity: "medium",
  ventDesign: defaultVentDesign,
  ventLayout: "aligned", ventCoverage: "bands", ventMix: "checkerboard",
  cableHolder: false, cableHolderHeight: 35, cableHolderSlitWidth: 5,
};
// `rows` remains in the exported format for backwards compatibility. A mismatched
// legacy `rows` value is interpreted as that many 3U rows.
export function rackRows(config: Pick<CaseConfiguration, "rows" | "rowUnits">): RackUnit[] {
  return Array.isArray(config.rowUnits) && config.rowUnits.length === config.rows
    ? config.rowUnits
    : Array.from({ length: config.rows }, () => 3 as const);
}
export function totalRackUnits(config: Pick<CaseConfiguration, "rows" | "rowUnits">) {
  return rackRows(config).reduce((total, units) => total + units, 0);
}
export function rackFormatLabel(config: Pick<CaseConfiguration, "rows" | "rowUnits">) {
  return rackRows(config).map(units => `${units}U`).join(" + ");
}
export function rackRowLayout(config: Pick<CaseConfiguration, "rows" | "rowUnits">) {
  const lengths = rackRows(config).map(units => units === 3 ? 133.35 : rackUnitPitch);
  const totalLength = lengths.reduce((total, length) => total + length, 0);
  let offset = -totalLength / 2;
  return rackRows(config).map((units, index) => {
    const length = lengths[index];
    const row = { index, units, length, center: offset + length / 2, railOffset: length / 2 - 5.425 };
    offset += length;
    return row;
  });
}
export function sidePanelMargin(config: Pick<CaseConfiguration, "thickness" | "sideMarginRatio">) {
  const ratio = Number.isFinite(config.sideMarginRatio) ? config.sideMarginRatio : maxSideMarginRatio;
  return config.thickness * Math.min(maxSideMarginRatio, Math.max(minSideMarginRatio, ratio));
}
export function handleCount(config: CaseConfiguration): 0 | 1 | 2 {
  if (!config.handle) return 0;
  if (config.handleMode === "single") return 1;
  if (config.handleMode === "pair") return 2;
  return config.hp > 84 || totalRackUnits(config) >= 6 ? 2 : 1;
}
export const handleSizeLimits = { width: { min: 130, max: 240 }, height: { min: 50, max: 110 } };
export function handleDimensions(config: Pick<CaseConfiguration, "handleWidth" | "handleHeight">) {
  const bounded = (value: number | undefined, fallback: number, limits: { min: number; max: number }) => Math.min(limits.max, Math.max(limits.min, Number.isFinite(value) ? value! : fallback));
  return { width: bounded(config.handleWidth, 160, handleSizeLimits.width), height: bounded(config.handleHeight, 70, handleSizeLimits.height) };
}
export function sledWebThickness(thickness: number) { return Math.max(12, thickness * 2.5); }
export function panelCount() { return 5; }
// All dimensions are millimetres; the preview converts these to scene units.
export function caseDimensions(config: CaseConfiguration) {
  const rackLength = rackRows(config).reduce((total, units) => total + (units === 3 ? 133.35 : rackUnitPitch), 0);
  const margin = sidePanelMargin(config);
  return { width: config.hp * 5.08 + config.thickness * 2, length: rackLength + config.thickness * 2 + margin * 2, height: config.depth + config.thickness + margin };
}
export function configurationExport(config: CaseConfiguration, cutoutReports: CutoutReport[] = [], resolvedPanels: Partial<Record<CutoutSide, MultiPolygon>> = {}) {
  const holder = cableHolderLayout(config);
  return {
    product: "Acryl508", version: 8, units: "mm", status: "design-concept",
    configuration: { ...config, handleWidth: handleDimensions(config).width, handleHeight: handleDimensions(config).height, ventLayout: config.ventLayout ?? "aligned", ventCoverage: config.ventCoverage ?? "bands", ventMix: config.ventMix ?? "checkerboard", ventDesign: normalizeVentDesign(config.ventDesign), material: "GS cast acrylic", fasteners: "Black socket-head screws", assembly: "Mechanical; no glue" },
    ventilation: {
      minimumWebMm: Math.max(3, config.thickness), borderMm: Math.max(8, 2 * config.thickness),
      coverage: "Two bands or a full field with a solid centre strip. Staggered rows are offset by half a column pitch and shortened at the borders. Mixed openings alternate round dots and short slits by opening, row or column.",
      effects: "Up to three deterministic fields, summed by target, then constrained to separate cells. Size is bounded and positions use the remaining room in each cell.",
      customCutouts: "Omit vents within one minimum web of each bottom custom-cutout polygon bounding box.",
      status: "Geometry guardrails only; strength, thermal performance and laser tolerances require prototype validation. Custom cuts can independently weaken the panel.",
    },
    outerDimensions: caseDimensions(config),
    powerBoard: config.busboard === "sinusoda" ? {
      ...sinusodaJuice,
      placement: sinusodaPlacement(config.hp * 5.08, rackRowLayout(config).reduce((sum, row) => sum + row.length, 0), config.depth),
      mountingHoleCentersMm: sinusodaHoles,
      coordinates: "Centred on base, viewed from above; X right, Y toward rear. Underside editor mirrors X. No automatic rotation or scaling.",
      bottomHolePolicy: "All 28 approximate holes when the board fits. Omit vents within one sheet thickness of each hole. Review custom-cutout conflicts.",
      accuracy: "226 × 86 × 19 mm envelope from data sheet. Hole centres, 3.2 mm diameter, notches and component positions estimated from Figure 1; verify against hardware before drilling. PCB thickness 1.6 mm and standoffs 5 mm are preview assumptions.",
      mounting: "Use at least 14 evenly distributed screws with nylon washers, per data sheet. Fastener size and standoff height need verification.",
    } : config.busboard === "trolley" ? {
      ...trolleyBus,
      placement: trolleyPlacement(config.hp * 5.08, rackRowLayout(config).reduce((sum, row) => sum + row.length, 0), config.depth),
      pcbHoleCentersMm: trolleyHoles,
      mountingHoleCentersMm: trolleyMountingHoles(),
      coordinates: "Base-centred millimetres viewed from above; X right, Y rear. PCB is shifted 6 mm left to centre the inferred connector-inclusive 435 mm envelope. Underside editor mirrors X.",
      bottomHolePolicy: "Eight approximate screw holes when the installation envelope fits; cover screws excluded. Vents retain one sheet thickness around holes. Review custom-cutout conflicts.",
      inputModule: "Separate 4HP/3U ON/OFF module and cabling not modelled or reserved.",
    } : config.busboard === "compactpwr" ? {
      ...compactPwr,
      placement: compactPwrPlacement(config.hp * 5.08, rackRowLayout(config).reduce((sum, row) => sum + row.length, 0), config.depth),
      mountingHoleCentersMm: compactPwrHoles,
      coordinates: "Centred on base, viewed from above; X right, Y rear. Underside editor mirrors X. No automatic rotation or scaling.",
      bottomHolePolicy: "Four approximate corner screw holes when the board fits. Vents retain one sheet thickness around each hole. Review custom-cutout conflicts.",
      inputModule: "Separate barrel/switch or USB-C inlet and cabling not modelled or reserved; no inlet cutout added.",
    } : null,
    customCutouts: {
      placement: "Viewed from outside each panel; x/y in mm from panel centre, x right, y up; rotation in degrees counterclockwise; width uniformly scales the normalized outlines. Bottom is viewed from below with rear at the top.",
      loosePartPolicy: "After all cutouts and existing holes are subtracted, retain only the largest connected acrylic region sharing an edge with the original panel perimeter. Remove all other regions, including enclosed letter centres even when larger than the remaining frame.",
      reports: cutoutReports,
      resolvedPanelOutlinesMm: resolvedPanels,
      outlineStatus: "Sampled outlines for the concept preview; not fabrication-ready cutting paths.",
    },
    acrylicParts: { enclosurePanels: 5, footPanels: 0, handlePanels: 0, totalPanels: panelCount() },
    panelAssembly: {
      method: "Base and end-panel tabs captured in closed side-panel slots; rail-end screws retain the side panels",
      railCount: rackRows(config).length * 2, railEndScrewCount: rackRows(config).length * 4,
      additionalPanelFasteners: 0, adhesive: false,
      baseUndersideHeight: sidePanelMargin(config), endRetainingMargin: sidePanelMargin(config),
      slotCenterToEdge: sidePanelMargin(config) + config.thickness / 2,
      minimumSlotCenterToEdge: config.thickness * 1.5,
      disassembly: "Support the case, remove the rail-end screws on one side, withdraw that side panel, then slide the base and end-panel tabs out of the remaining side panel. Stance and handles are integral to the side panels.",
      status: "Concept; kerf, sheet tolerances, corner relief, rail threads, screw engagement and loaded retention require fabrication validation",
    },
    stance: { method: "Integral side-panel profile", angle: config.angle, shape: config.footShape, minimumWebMm: config.footShape === "sled" && config.angle > 0 ? sledWebThickness(config.thickness) : null, innerCorners: config.footShape === "sled" ? "Rounded" : null, additionalParts: 0 },
    handles: { method: "Integral side-panel grips", mode: config.handleMode ?? "auto", count: handleCount(config), widthMm: handleDimensions(config).width, riseMm: handleDimensions(config).height, roundedRoots: true, sides: handleCount(config) === 2 ? ["left", "right"] : handleCount(config) === 1 ? ["left"] : [], additionalParts: 0 },
    footAttachment: null,
    cableHolder: { enabled: Boolean(config.cableHolder), method: "Integral fingers along the rear panel top edge", heightMm: holder.height, slitWidthMm: holder.slitWidth, slitCount: config.cableHolder ? holder.slitCount : 0, fingerWidthMm: holder.fingerWidth, pitchMm: holder.pitch, slitCentersMm: config.cableHolder ? holder.slitCenters : [], roundedTips: true, roundedSlitRoots: true, additionalParts: 0 },
    notes: ["Configuration specification only; not a cutting template.", "Outer dimensions describe the enclosure, excluding the integral grip, cable holder and stance extensions.", "The minimum side margin uses a 1.5× slot-width centre-to-edge guardrail adapted from acrylic hole guidance; rectangular slots and the complete loaded assembly still require fabrication validation.", "Joint clearances, fasteners, load capacity and rail profiles require fabrication validation.", ...(config.busboard === "sinusoda" ? ["Sinusoda Juice envelope follows the supplied data sheet; the 28-hole pattern is photo-derived and approximate. Verify centres, diameters, mounting stack, module and electrical clearances against the physical board before fabrication."] : config.busboard === "trolley" ? ["Trolley Bus uses a 423 mm board and a conservative 435 mm installation envelope inferred from the setup drawing. Eight photo-estimated screw mounts adapt the manufacturer's adhesive mounting method; positions, diameters, insulation and clearances must be verified against hardware."] : config.busboard === "compactpwr" ? ["CompactPWR uses the manufacturer’s 174 × 79 × 20 mm envelope. Its four corner screw mounts are photo-derived estimates; verify centres, diameters, mounting stack and clearances against hardware before drilling."] : [])],
  };
}
