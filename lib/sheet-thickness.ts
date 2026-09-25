import type { CaseConfiguration, PanelSide } from "./configurator";
import { cutoutSides as panelSides } from "./custom-cutouts";

export type SheetThicknessConfiguration = Pick<CaseConfiguration, "thickness" | "individualPanelTints" | "panelThicknesses">;
export function panelThickness(config: SheetThicknessConfiguration, side: PanelSide) {
  return (config.individualPanelTints ? config.panelThicknesses?.[side] : undefined) ?? config.thickness;
}
export function panelThicknessesFrom(thickness: number): Record<PanelSide, number> {
  return Object.fromEntries(panelSides.map(({ value }) => [value, thickness])) as Record<PanelSide, number>;
}
export function caseThicknesses(config: SheetThicknessConfiguration) {
  return Object.fromEntries(panelSides.map(({ value }) => [value, panelThickness(config, value)])) as Record<PanelSide, number>;
}
export function caseThicknessLabel(config: SheetThicknessConfiguration) {
  const values = Object.values(caseThicknesses(config));
  const min = Math.min(...values), max = Math.max(...values);
  return min === max ? `${min}` : `${min}–${max}`;
}
// Common retaining margin sized for the widest slot in either side sheet.
export function jointThickness(config: SheetThicknessConfiguration) {
  return Math.max(panelThickness(config, "bottom"), panelThickness(config, "front"), panelThickness(config, "rear"));
}
