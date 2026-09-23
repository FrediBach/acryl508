import type { CustomCutout, CutoutReport, CutoutSide } from "./custom-cutouts";
import type { MultiPolygon } from "polygon-clipping";

export type AcrylicTint = { id: string; label: string; color: string };
export type Busboard = "none" | "sinusoda" | "trolley";
export type FootShape = "wedge" | "arch" | "sled";
export type RackUnit = 1 | 3;
export type CaseConfiguration = {
  hp: number; rows: number; rowUnits: RackUnit[]; depth: number; thickness: number;
  tint: AcrylicTint; angle: number; vents: boolean; busboard: Busboard;
  handle: boolean; footShape: FootShape;
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
export const busboards: Record<Busboard, string> = { none: "No busboard", sinusoda: "Sinusoda", trolley: "Trolley Bus" };
export const footShapes: { value: FootShape; label: string; description: string }[] = [
  { value: "wedge", label: "Wedge", description: "Solid side supports with a straight profile." },
  { value: "arch", label: "Arch", description: "An open arch with two contact points per side." },
  { value: "sled", label: "Sled", description: "A continuous runner with a tapered cutout." },
];
export const defaultConfiguration: CaseConfiguration = {
  hp: 84, rows: 1, rowUnits: [3], depth: 75, thickness: 5, tint: acrylicTints[1], angle: 0, vents: true, busboard: "none",
  handle: false, footShape: "wedge", cutouts: [],
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
export function panelCount(config: CaseConfiguration) {
  return 5 + (config.angle > 0 ? 2 : 0) + (config.handle ? 1 : 0);
}
// All dimensions are millimetres; the preview converts these to scene units.
export function caseDimensions(config: CaseConfiguration) {
  const rackLength = rackRows(config).reduce((total, units) => total + (units === 3 ? 133.35 : rackUnitPitch), 0);
  return { width: config.hp * 5.08 + config.thickness * 2, length: rackLength + config.thickness * 6, height: config.depth + config.thickness * 3 };
}
export function configurationExport(config: CaseConfiguration, cutoutReports: CutoutReport[] = [], resolvedPanels: Partial<Record<CutoutSide, MultiPolygon>> = {}) {
  return {
    product: "Acryl508", version: 3, units: "mm", status: "design-concept",
    configuration: { ...config, material: "GS cast acrylic", fasteners: "Black socket-head screws", assembly: "Mechanical; no glue" },
    outerDimensions: caseDimensions(config),
    customCutouts: {
      placement: "Viewed from outside each panel; x/y in mm from panel centre, x right, y up; rotation in degrees counterclockwise; width uniformly scales the normalized outlines. Bottom is viewed from below with rear at the top.",
      loosePartPolicy: "After all cutouts and existing holes are subtracted, retain only the largest connected acrylic region sharing an edge with the original panel perimeter. Remove all other regions, including enclosed letter centres even when larger than the remaining frame.",
      reports: cutoutReports,
      resolvedPanelOutlinesMm: resolvedPanels,
      outlineStatus: "Sampled outlines for the concept preview; not fabrication-ready cutting paths.",
    },
    acrylicParts: { enclosurePanels: 5, footPanels: config.angle > 0 ? 2 : 0, handlePanels: config.handle ? 1 : 0, totalPanels: panelCount(config) },
    panelAssembly: {
      method: "Base and end-panel tabs captured in closed side-panel slots; rail-end screws retain the side panels",
      railCount: rackRows(config).length * 2, railEndScrewCount: rackRows(config).length * 4,
      additionalPanelFasteners: 0, adhesive: false,
      baseUndersideHeight: config.thickness * 2, endRetainingMargin: config.thickness * 2,
      disassembly: "Support the case, remove the rail-end screws on one side, withdraw that side panel, then slide the base and end-panel tabs out of the remaining side panel. Feet and handle can stay on their panels.",
      status: "Concept; kerf, sheet tolerances, corner relief, rail threads, screw engagement and loaded retention require fabrication validation",
    },
    footAttachment: config.angle > 0 ? { method: "Overlapping side panels with removable through-bolts", boltsPerFoot: 2, boltCount: 4, washerCount: 8, spacerCount: 4, locknutCount: 4, adhesive: false, status: "Concept; hole clearances, tightening and loads require fabrication validation" } : null,
    notes: ["Configuration specification only; not a cutting template.", "Outer dimensions describe the enclosure, excluding the optional handle and feet.", "Joint clearances, fasteners, load capacity and rail profiles require fabrication validation.", ...(config.busboard !== "none" ? [busboards[config.busboard] + " is a requested board family. Board dimensions, mounting holes and electrical clearances must be verified against the exact model. The preview is illustrative."] : [])],
  };
}
