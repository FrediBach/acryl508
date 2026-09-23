export type AcrylicTint = { id: string; label: string; color: string };
export type Busboard = "none" | "sinusoda" | "trolley";
export type FootShape = "wedge" | "arch" | "sled";
export type CaseConfiguration = {
  hp: number; rows: number; depth: number; thickness: number;
  tint: AcrylicTint; angle: number; vents: boolean; busboard: Busboard;
  handle: boolean; footShape: FootShape;
};
export const acrylicTints: AcrylicTint[] = [
  { id: "clear", label: "Crystal", color: "#cae5e1" },
  { id: "orange", label: "Signal orange", color: "#ff6a18" },
  { id: "smoke", label: "Smoke", color: "#686d70" },
  { id: "green", label: "Sea glass", color: "#57b7a6" },
  { id: "blue", label: "Cobalt", color: "#578fc8" },
];
export const rowOptions = [{ label: "3U", value: 1 }, { label: "6U", value: 2 }, { label: "9U", value: 3 }];
export const busboards: Record<Busboard, string> = { none: "No busboard", sinusoda: "Sinusoda", trolley: "Trolley Bus" };
export const footShapes: { value: FootShape; label: string; description: string }[] = [
  { value: "wedge", label: "Wedge", description: "Solid side supports with a straight profile." },
  { value: "arch", label: "Arch", description: "An open arch with two contact points per side." },
  { value: "sled", label: "Sled", description: "A continuous runner with a tapered cutout." },
];
export const defaultConfiguration: CaseConfiguration = {
  hp: 84, rows: 1, depth: 75, thickness: 5, tint: acrylicTints[1], angle: 0, vents: true, busboard: "none",
  handle: false, footShape: "wedge",
};
export function panelCount(config: CaseConfiguration) {
  return 5 + (config.angle > 0 ? 2 : 0) + (config.handle ? 1 : 0);
}
// All dimensions are millimetres; the preview converts these to scene units.
export function caseDimensions(config: CaseConfiguration) {
  return { width: config.hp * 5.08 + config.thickness * 2, length: config.rows * 133.35 + config.thickness * 2, height: config.depth + config.thickness };
}
export function configurationExport(config: CaseConfiguration) {
  return {
    product: "Acryl508", version: 1, units: "mm", status: "design-concept",
    configuration: { ...config, material: "GS cast acrylic", fasteners: "Black socket-head screws", assembly: "Mechanical; no glue" },
    outerDimensions: caseDimensions(config),
    acrylicParts: { enclosurePanels: 5, footPanels: config.angle > 0 ? 2 : 0, handlePanels: config.handle ? 1 : 0, totalPanels: panelCount(config) },
    footAttachment: config.angle > 0 ? { method: "Overlapping side panels with removable through-bolts", boltsPerFoot: 2, boltCount: 4, washerCount: 8, spacerCount: 4, locknutCount: 4, adhesive: false, status: "Concept; hole clearances, tightening and loads require fabrication validation" } : null,
    notes: ["Configuration specification only; not a cutting template.", "Outer dimensions describe the enclosure, excluding the optional handle and feet.", "Joint clearances, fasteners, load capacity and rail profiles require fabrication validation.", ...(config.busboard !== "none" ? [busboards[config.busboard] + " is a requested board family. Board dimensions, mounting holes and electrical clearances must be verified against the exact model. The preview is illustrative."] : [])],
  };
}
