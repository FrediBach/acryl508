import { Color, type MeshPhysicalMaterialParameters } from "three";

export type AcrylicTint = { id: string; label: string; color: string; shopLabel?: string };
export type AcrylicTransparency = "see-through" | "opaque" | "opal" | "transparent";
export const defaultTransparency: AcrylicTransparency = "transparent";
export const acrylicTints: AcrylicTint[] = [
  { id: "clear", label: "Colorless", shopLabel: "Farblos", color: "#ffffff" },
  { id: "black", label: "Black", shopLabel: "Schwarz", color: "#151515" },
  { id: "white", label: "White", shopLabel: "Weiss", color: "#f5f5f2" },
  { id: "grey", label: "Grey", shopLabel: "Grau", color: "#a6a6a6" },
  { id: "orange", label: "Orange", shopLabel: "Orange", color: "#ff6a18" },
  { id: "red", label: "Red", shopLabel: "Rot", color: "#ff300c" },
  { id: "yellow", label: "Yellow", shopLabel: "Gelb", color: "#ffd21b" },
  { id: "blue", label: "Blue", shopLabel: "Blau", color: "#15a8dc" },
  { id: "green", label: "Green", shopLabel: "Grün", color: "#21cc64" },
  { id: "umbra", label: "Umber", shopLabel: "Umbra", color: "#929481" },
  { id: "brown", label: "Brown", shopLabel: "Braun", color: "#ad6222" },
];
export const defaultTint = acrylicTints.find(tint => tint.id === "orange")!;
export const acrylicTransparencies: { id: AcrylicTransparency; label: string; shopLabel: string; description: string }[] = [
  { id: "see-through", label: "See-through", shopLabel: "Blickdurchlässig", description: "Lets you see through the sheet, with reduced clarity." },
  { id: "opaque", label: "Opaque", shopLabel: "Opak (deckend)", description: "Solid color that hides what is behind the sheet." },
  { id: "opal", label: "Milky", shopLabel: "Opal (milchig)", description: "Diffuses light with a milky appearance and obscures detail." },
  { id: "transparent", label: "Fully transparent", shopLabel: "Volltransparent", description: "Clear, glass-like acrylic, with the selected color tint." },
];
export function transparencyOption(value: AcrylicTransparency = defaultTransparency) {
  return acrylicTransparencies.find(option => option.id === value) ?? acrylicTransparencies[3];
}
export function materialLabel(tint: AcrylicTint, transparency?: AcrylicTransparency) {
  return `${tint.label} · ${transparencyOption(transparency).label}`;
}
export function acrylicEdgeOpacity(transparency?: AcrylicTransparency) {
  // Opal sheets scatter at their cut edges instead of outlining every face
  // with a saturated, unlit line. Keep a faint edge to read the joinery.
  return transparency === "opal" ? 0.18 : 1;
}
// Appearance presets, not supplier measurements. Thickness is in scene units.
// Transmission preserves surface reflections; alpha opacity stays at one.
export function acrylicMaterial(tint: AcrylicTint, thickness: number, transparency: AcrylicTransparency = defaultTransparency): MeshPhysicalMaterialParameters {
  const finish = transparencyOption(transparency).id;
  const opal = finish === "opal";
  // Approximate bulk diffusion with rough transmission, separate from the
  // smoother acrylic surface. More material obscures more of the background.
  // Avoid a large linear-space white mix: it turns orange into pale salmon.
  const opticalDepth = Math.max(0, thickness) / 0.05;
  const opalTransmission = 0.68 * Math.exp(-0.38 * opticalDepth);
  return {
    color: new Color(tint.color).lerp(new Color("#ffffff"), opal ? 0.025 : 0),
    metalness: 0, roughness: opal ? Math.min(0.7, 0.48 + opticalDepth * 0.06) : finish === "see-through" ? 0.24 : 0.1,
    transmission: finish === "opaque" ? 0 : opal ? opalTransmission : finish === "see-through" ? 0.72 : 1,
    transparent: false, opacity: 1, thickness, ior: 1.49,
    clearcoat: opal ? 0.35 : 1, clearcoatRoughness: opal ? 0.18 : 0.07, envMapIntensity: 1.25,
    attenuationColor: tint.color,
    attenuationDistance: finish === "transparent" ? 1.2 : opal ? 0.22 : 0.45,
  };
}
