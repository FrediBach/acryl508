import { defaultTransparency, materialLabel, type AcrylicTint, type AcrylicTransparency } from "./acrylic-material";

export type SheetMaterialConfiguration = {
  thickness: number; tint: AcrylicTint; transparency?: AcrylicTransparency;
  individualSheetMaterials?: boolean;
  sheetTints?: Record<string, AcrylicTint>;
  sheetTransparencies?: Record<string, AcrylicTransparency>;
  sheetThicknesses?: Record<string, number>;
};
export const defaultSheetMaterials = { individualSheetMaterials: false, sheetTints: {}, sheetTransparencies: {}, sheetThicknesses: {} };
export function sheetThickness(config: SheetMaterialConfiguration, id: string) {
  return (config.individualSheetMaterials ? config.sheetThicknesses?.[id] : undefined) ?? config.thickness;
}
// Art shelves share their parent leaf's appearance, including old projects
// containing independent shelf colors. Thickness remains independently editable.
export function sheetAppearanceSource(id: string) {
  return /^shelf-[ab]-([1-9]|10)$/.test(id) ? id.slice(6) : id;
}
export function sheetMaterial(config: SheetMaterialConfiguration, id: string) {
  const appearanceId = sheetAppearanceSource(id);
  return {
    thickness: sheetThickness(config, id),
    tint: (config.individualSheetMaterials ? config.sheetTints?.[appearanceId] : undefined) ?? config.tint,
    transparency: (config.individualSheetMaterials ? config.sheetTransparencies?.[appearanceId] : undefined) ?? config.transparency ?? defaultTransparency,
  };
}
export function maxSheetThickness(config: SheetMaterialConfiguration) {
  return Math.max(config.thickness, ...Object.values(config.individualSheetMaterials ? config.sheetThicknesses ?? {} : {}));
}
export function normalizeSheetThicknesses<T extends SheetMaterialConfiguration>(config: T, min: number, max: number): T {
  return { ...config, sheetThicknesses: Object.fromEntries(Object.entries(config.sheetThicknesses ?? {}).filter(([, value]) => Number.isFinite(value)).map(([id, value]) => [id, Math.max(min, Math.min(max, value))])) };
}
// Clear only the selected property's overrides. Other choices, including those
// for temporarily hidden parts, survive apply-to-all and on/off switches.
export function allSheetMaterials(config: SheetMaterialConfiguration, patch: Partial<Pick<SheetMaterialConfiguration, "tint" | "transparency" | "thickness">>): Partial<SheetMaterialConfiguration> {
  return { ...patch, ...(config.individualSheetMaterials ? {
    ...(patch.tint ? { sheetTints: {} } : {}),
    ...(patch.transparency ? { sheetTransparencies: {} } : {}),
    ...(patch.thickness !== undefined ? { sheetThicknesses: {} } : {}),
  } : {}) };
}
export function sheetThicknessLabel(config: SheetMaterialConfiguration, parts: { id: string }[]) {
  const values = parts.map(part => sheetThickness(config, part.id));
  const min = Math.min(...values), max = Math.max(...values);
  return min === max ? String(min) : `${min}–${max}`;
}
export function sheetMaterialSummary(config: SheetMaterialConfiguration) {
  return config.individualSheetMaterials ? "Individual materials" : materialLabel(config.tint, config.transparency);
}
export function sheetMaterialExport(config: SheetMaterialConfiguration, parts: { id: string; label: string }[]) {
  return parts.map(part => ({ id: part.id, label: part.label, ...sheetMaterial(config, part.id) }));
}
const xml = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
export function sheetMaterialAttributes(config: SheetMaterialConfiguration, id: string) {
  const material = sheetMaterial(config, id);
  return `data-thickness-mm="${material.thickness}" data-color="${xml(material.tint.color)}" data-transparency="${material.transparency}"`;
}
