import type { MultiPolygon } from "polygon-clipping";
import { polygonBounds, mapPolygons } from "./custom-cutouts";
import { casePathData, caseSheetLayout } from "./svg-export";
import { caseCanExport, type CasePanels } from "./case-panels";
import { panelTint, panelTransparency, rackRows, type CaseConfiguration } from "./configurator";
import type { SynthStand } from "./synth-stand";
import type { SynthProtector } from "./synth-protector";
import type { DesignedPanel } from "./panel-designer";
import { materialLabel } from "./acrylic-material";

export type FabricationPart = { id: string; label: string; polygons: MultiPolygon; engraving?: MultiPolygon; material: string };
export type Fabrication = { parts: FabricationPart[]; warnings: string[]; hardware: string[]; thickness: number; clearance: number; blocked: boolean };
const down = (polygons: MultiPolygon) => mapPolygons(polygons, (x, y) => [x, -y]);
export function caseFabrication(config: CaseConfiguration, panels: CasePanels): Fabrication {
  const warnings = panels.reports.flatMap(report => [
    ...(report.empty ? [`${report.side}: no acrylic remains.`] : []), ...(report.error ? [`${report.side}: ${report.error}`] : []),
    ...(report.removedParts ? [`${report.side}: ${report.removedParts} loose part(s) removed.`] : []),
    ...(report.clipped.length ? [`${report.side}: ${report.clipped.length} cutout(s) extend beyond the sheet.`] : []),
    ...(report.outside.length ? [`${report.side}: ${report.outside.length} cutout(s) do not intersect acrylic.`] : []),
  ]);
  if (config.busboard !== "none") {
    warnings.push("Power-board mounting coordinates are estimates. Verify against your physical board.");
    if (!panels.powerBoard?.fits) warnings.push("The power board does not fit; its mounting holes are omitted.");
    if (panels.mountingConflicts) warnings.push(`Custom cuts approach ${panels.mountingConflicts} power-board mounting point(s).`);
  }
  if (config.vents && panels.ventilation.omitted) warnings.push(`${panels.ventilation.omitted} vents omitted near cutouts or mounting points.`);
  if (config.vents && panels.ventilation.limited) warnings.push("Vent sizes or density were limited to preserve material between openings.");
  return { parts: caseSheetLayout(panels).parts.map(({ item }) => ({ id: item.id, label: item.label, polygons: item.polygons, material: materialLabel(panelTint(config, item.id), panelTransparency(config, item.id)) })),
    warnings, thickness: config.thickness, clearance: 0, blocked: !caseCanExport(panels),
    hardware: [`${rackRows(config).length * 2} rails cut to ${config.hp} HP`, `${rackRows(config).length * 4} rail-end screws and load-spreading washers; confirm thread and engagement`, ...(panels.mountingHoles.length ? [`${panels.mountingHoles.length} board mounting holes; verify standoffs and required fasteners with the board maker`] : [])],
  };
}
export function standFabrication(stand: SynthStand, error?: string, busy?: boolean): Fabrication {
  return { parts: stand.parts.map(part => ({ id: part.id, label: part.label, polygons: down(part.polygons), material: materialLabel(stand.config.tint, stand.config.transparency) })),
    warnings: ["Validate joint fit, grip, flex and loaded stability on a prototype.", ...(error ? [error] : []), ...(busy ? ["Model fitting is in progress."] : [])], hardware: ["No screws or adhesive; complementary slots join the parts."], thickness: stand.config.thickness, clearance: stand.config.clearance, blocked: !!error || !!busy };
}
export function protectorFabrication(protector: SynthProtector, error?: string, busy?: boolean): Fabrication {
  return { parts: protector.parts.map(part => ({ id: part.id, label: part.label, polygons: down(part.polygons), material: materialLabel(protector.config.tint, protector.config.transparency) })),
    warnings: ["Verify foot contacts, controls clearance, joint retention and cover flex on a prototype.", ...(error ? [error] : []), ...(busy ? ["Model fitting is in progress."] : [])], hardware: ["No screws or adhesive; feet slot into the cover."], thickness: protector.config.thickness, clearance: protector.config.clearance, blocked: !!error || !!busy };
}
export function panelFabrication(panel: DesignedPanel): Fabrication {
  return { parts: [{ id: "panel", label: "Panel", polygons: down(panel.polygons), engraving: down(panel.engravings.flatMap(item => item.polygons)), material: materialLabel(panel.config.tint, panel.config.transparency) }],
    warnings: panel.warnings, hardware: [`${panel.mounts.length} mounting screws; verify washers and thread engagement`], thickness: panel.config.thickness, clearance: 0, blocked: !panel.canExport };
}
export type PackedPart = FabricationPart & { x: number; y: number; width: number; height: number; rotated: boolean };
export type StockSheet = { material: string; parts: PackedPart[] };
export function packSheets(parts: FabricationPart[], width: number, height: number, gap: number, rotate: boolean) {
  if (![width, height, gap].every(Number.isFinite) || width < 50 || height < 50 || width > 3000 || height > 3000 || gap < 2 || gap > 50) throw new Error("Stock must be 50–3000 mm per side, with a 2–50 mm gap.");
  const sheets: StockSheet[] = [], unplaced: string[] = [];
  const states: { sheet: StockSheet; x: number; y: number; row: number }[] = [];
  const ordered = parts.map(part => ({ part, bounds: polygonBounds(part.polygons) })).sort((a, b) => b.bounds.height - a.bounds.height);
  for (const { part, bounds } of ordered) {
    if (!part.polygons.length) { unplaced.push(part.label); continue; }
    const orientations = [{ width: bounds.width, height: bounds.height, rotated: false }, ...(rotate ? [{ width: bounds.height, height: bounds.width, rotated: true }] : [])];
    const fits = orientations.filter(o => o.width <= width - 2 * gap + 1e-6 && o.height <= height - 2 * gap + 1e-6);
    if (!fits.length) { unplaced.push(part.label); continue; }
    let placement: { state: typeof states[number]; orientation: typeof orientations[number]; x: number; y: number; newRow: boolean } | undefined;
    for (const state of states.filter(state => state.sheet.material === part.material)) {
      for (const orientation of fits) {
        if (state.x + orientation.width <= width - gap + 1e-6 && state.y + orientation.height <= height - gap + 1e-6) { placement = { state, orientation, x: state.x, y: state.y, newRow: false }; break; }
        const y = state.y + state.row + gap;
        if (y + orientation.height <= height - gap + 1e-6) { placement = { state, orientation, x: gap, y, newRow: true }; break; }
      }
      if (placement) break;
    }
    if (!placement) {
      const sheet: StockSheet = { material: part.material, parts: [] }, state = { sheet, x: gap, y: gap, row: 0 };
      sheets.push(sheet); states.push(state); placement = { state, orientation: fits[0], x: gap, y: gap, newRow: false };
    }
    const { state, orientation, x, y, newRow } = placement;
    const transform = (polygons: MultiPolygon) => mapPolygons(polygons, (px, py) => orientation.rotated ? [x + bounds.height - (py - bounds.bottom), y + px - bounds.left] : [x + px - bounds.left, y + py - bounds.bottom]);
    state.sheet.parts.push({ ...part, polygons: transform(part.polygons), engraving: part.engraving ? transform(part.engraving) : undefined, ...orientation, x, y });
    state.x = x + orientation.width + gap; state.y = y; state.row = newRow ? orientation.height : Math.max(state.row, orientation.height);
  }
  return { sheets, unplaced };
}
const xml = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
export function stockSvg(sheet: StockSheet, width: number, height: number, warnings: string[] = []) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${width}mm" height="${height}mm" viewBox="0 0 ${width} ${height}"><title>Acryl508 stock sheet · ${xml(sheet.material)}</title><desc>Millimetres. Red: cut. Blue: engrave. Apply kerf once in CAM. ${xml(warnings.join(" "))}</desc><g id="cut" fill="none" stroke="#ef4444" stroke-width="0.2">${sheet.parts.map((part, index) => `<g id="part-${index + 1}" data-part="${xml(part.id)}"><title>${xml(part.label)}</title><path d="${casePathData(part.polygons)}" /></g>`).join("")}</g><g id="engrave" fill="#2563eb" fill-rule="evenodd">${sheet.parts.filter(part => part.engraving?.length).map(part => `<path d="${casePathData(part.engraving!)}" />`).join("")}</g></svg>`;
}
export function fitCoupon(thickness: number, clearance: number) {
  if (!Number.isFinite(thickness) || thickness < 1.5 || thickness > 10 || !Number.isFinite(clearance) || clearance < 0 || clearance > 0.4) throw new Error("Invalid coupon thickness or clearance.");
  const clearances = [...new Set([0, 0.1, 0.15, 0.2, 0.3, 0.4, clearance].map(value => Math.round(value * 100) / 100))].sort((a, b) => a - b);
  const pitch = thickness + 8, width = clearances.length * pitch + 16, height = 70;
  const points = [[5, 5]];
  clearances.forEach((gap, index) => { const x = 13 + index * pitch; points.push([x, 5], [x, 20], [x + thickness + gap, 20], [x + thickness + gap, 5]); });
  points.push([width - 5, 5], [width - 5, 35], [5, 35], [5, 5]);
  const outline = points.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join(" ") + "Z";
  return { clearances, width, height, svg: `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${width}mm" height="${height}mm" viewBox="0 0 ${width} ${height}"><title>Acryl508 ${thickness} mm fit coupon</title><desc>Cut from measured ${thickness} mm stock. Edge slots left to right: ${clearances.map(gap => `${(thickness + gap).toFixed(2)} mm (${gap.toFixed(2)} clearance)`).join(", ")}. Insert the separate tab edge-on. Apply the same CAM kerf compensation as the finished parts, once. Labels are engraving only.</desc><g id="cut" stroke="#ef4444" fill="none" stroke-width="0.2"><path d="${outline}"/><rect x="5" y="40" width="25" height="25"/></g><g id="engrave" fill="#2563eb" font-family="sans-serif" font-size="2.5">${clearances.map((gap, index) => `<text x="${13 + index * pitch}" y="29">${(thickness + gap).toFixed(2)}</text>`).join("")}</g></svg>` };
}
