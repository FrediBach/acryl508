import type { CustomCutout, CutoutReport, CutoutSide } from "./custom-cutouts";
import type { MultiPolygon } from "polygon-clipping";
import { defaultVentDesign, normalizeVentDesign, type VentDesign } from "./vent-design";

export type AcrylicTint = { id: string; label: string; color: string };
export type Busboard = "none" | "sinusoda" | "trolley";
export type FootShape = "wedge" | "arch" | "sled";
export type RackUnit = 1 | 3;
export type VentStyle = "long-slits" | "short-slits" | "round" | "hexagonal" | "mixed";
export type VentDensity = "low" | "medium" | "high";
export type VentLayout = "aligned" | "staggered";
export type VentCoverage = "bands" | "field";
export type VentMix = "checkerboard" | "rows" | "columns";
export type CaseConfiguration = {
  hp: number; rows: number; rowUnits: RackUnit[]; depth: number; thickness: number; sideMarginRatio: number;
  tint: AcrylicTint; angle: number; vents: boolean; busboard: Busboard;
  ventStyle: VentStyle; ventDensity: VentDensity;
  ventLayout: VentLayout; ventCoverage: VentCoverage; ventMix: VentMix;
  ventDesign: VentDesign;
  handle: boolean; handleMode?: "auto" | "single" | "pair"; footShape: FootShape;
  cutouts: CustomCutout[];
};
export const acrylicTints: AcrylicTint[] = [
  { id: "clear", label: "Crystal", color: "#cae5e1" },
  { id: "orange", label: "Signal orange", color: "#ff6a18" },
  { id: "smoke", label: "Smoke", color: "#686d70" },
  { id: "green", label: "Sea glass", color: "#57b7a6" },
  { id: "blue", label: "Cobalt", color: "#578fc8" },
];
export const maxRackUnits = 9;
export const rackUnitPitch = 44.45;
export const minSideMarginRatio = 1;
export const maxSideMarginRatio = 2;
export const busboards: Record<Busboard, string> = { none: "No busboard", sinusoda: "Sinusoda", trolley: "Trolley Bus" };
export const footShapes: { value: FootShape; label: string; description: string }[] = [
  { value: "wedge", label: "Wedge", description: "Solid side panels extend to the floor." },
  { value: "arch", label: "Arch", description: "An arch in each side panel leaves two contact points." },
  { value: "sled", label: "Sled", description: "Each side panel forms a continuous runner with a tapered opening." },
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
  handle: false, handleMode: "auto", footShape: "wedge", cutouts: [], ventStyle: "long-slits", ventDensity: "medium",
  ventDesign: defaultVentDesign,
  ventLayout: "aligned", ventCoverage: "bands", ventMix: "checkerboard",
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
export function panelCount() { return 5; }
// All dimensions are millimetres; the preview converts these to scene units.
export function caseDimensions(config: CaseConfiguration) {
  const rackLength = rackRows(config).reduce((total, units) => total + (units === 3 ? 133.35 : rackUnitPitch), 0);
  const margin = sidePanelMargin(config);
  return { width: config.hp * 5.08 + config.thickness * 2, length: rackLength + config.thickness * 2 + margin * 2, height: config.depth + config.thickness + margin };
}
export function configurationExport(config: CaseConfiguration, cutoutReports: CutoutReport[] = [], resolvedPanels: Partial<Record<CutoutSide, MultiPolygon>> = {}) {
  return {
    product: "Acryl508", version: 6, units: "mm", status: "design-concept",
    configuration: { ...config, ventLayout: config.ventLayout ?? "aligned", ventCoverage: config.ventCoverage ?? "bands", ventMix: config.ventMix ?? "checkerboard", ventDesign: normalizeVentDesign(config.ventDesign), material: "GS cast acrylic", fasteners: "Black socket-head screws", assembly: "Mechanical; no glue" },
    ventilation: {
      minimumWebMm: Math.max(3, config.thickness), borderMm: Math.max(8, 2 * config.thickness),
      coverage: "Two bands or a full field with a solid centre strip. Staggered rows are offset by half a column pitch and shortened at the borders. Mixed openings alternate round dots and short slits by opening, row or column.",
      effects: "Up to three deterministic fields, summed by target, then constrained to separate cells. Size is bounded and positions use the remaining room in each cell.",
      customCutouts: "Omit vents within one minimum web of each bottom custom-cutout polygon bounding box.",
      status: "Geometry guardrails only; strength, thermal performance and laser tolerances require prototype validation. Custom cuts can independently weaken the panel.",
    },
    outerDimensions: caseDimensions(config),
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
    stance: { method: "Integral side-panel profile", angle: config.angle, shape: config.footShape, additionalParts: 0 },
    handles: { method: "Integral side-panel grips", mode: config.handleMode ?? "auto", count: handleCount(config), sides: handleCount(config) === 2 ? ["left", "right"] : handleCount(config) === 1 ? ["left"] : [], additionalParts: 0 },
    footAttachment: null,
    notes: ["Configuration specification only; not a cutting template.", "Outer dimensions describe the enclosure, excluding the integral grip and stance extensions.", "The minimum side margin uses a 1.5× slot-width centre-to-edge guardrail adapted from acrylic hole guidance; rectangular slots and the complete loaded assembly still require fabrication validation.", "Joint clearances, fasteners, load capacity and rail profiles require fabrication validation.", ...(config.busboard !== "none" ? [busboards[config.busboard] + " is a requested board family. Board dimensions, mounting holes and electrical clearances must be verified against the exact model. The preview is illustrative."] : [])],
  };
}
