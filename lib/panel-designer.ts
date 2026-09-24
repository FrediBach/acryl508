import clipping, { type MultiPolygon } from "polygon-clipping";
import { defaultTint, defaultTransparency, type AcrylicTint, type AcrylicTransparency } from "./acrylic-material";
import { geometryArea, mapPolygons, outlinePath, placedCutout, polygonBounds, subtractCutouts, type CustomCutout } from "./custom-cutouts";
import { defaultVentDesign, normalizeVentDesign, sampleVentField, type VentDesign } from "./vent-design";

export const panelFormats = {
  "3u": { label: "Eurorack 3U", height: 128.5, insetY: 3, insetX: 7.5, diameter: 3.2, source: "https://www.doepfer.de/a100_man/a100m_e.htm" },
  "intellijel-1u": { label: "Intellijel 1U", height: 39.65, insetY: 3, insetX: 7.5, diameter: 3.2, source: "https://intellijel.com/support/1u-technical-specifications/" },
  "pulp-logic-1u": { label: "Pulp Logic 1U", height: 43.18, insetY: 2.9972, insetX: 5.08, diameter: 3.175, source: "https://pulplogic.com/1u_tiles/" },
} as const;
export type PanelFormat = keyof typeof panelFormats;
export type PanelComponent = {
  id: string; name: string; kind: "jack" | "pot" | "switch" | "display" | "custom";
  shape: "circle" | "rectangle" | "slot";
  x: number; y: number; width: number; height: number; radius: number; rotation: number;
  bodyWidth: number; bodyHeight: number; maxPanelThickness: number;
};
export type PanelArtwork = CustomCutout & { operation: "cut" | "engrave" };
export type PanelConfiguration = {
  format: PanelFormat; hp: number; widthClearance: number; thickness: number;
  tint: AcrylicTint; transparency: AcrylicTransparency;
  mounting: "holes" | "slots"; mountingCount: "auto" | "two" | "four"; slotTravel: number;
  components: PanelComponent[]; artwork: PanelArtwork[];
  vents: { enabled: boolean; shape: "circles" | "slots" | "hexagons"; staggered: boolean; pitch: number; size: number; margin: number; design: VentDesign };
};
export const maxPanelComponents = 64;
export const maxPanelArtwork = 20;
export const defaultPanelConfiguration: PanelConfiguration = {
  format: "3u", hp: 12, widthClearance: 0.3, thickness: 3, tint: defaultTint, transparency: defaultTransparency,
  mounting: "holes", mountingCount: "auto", slotTravel: 2,
  components: [], artwork: [],
  vents: { enabled: false, shape: "circles", staggered: true, pitch: 9, size: 4, margin: 8, design: defaultVentDesign },
};
const bounded = (value: number, fallback: number, min: number, max: number) => Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
export const panelRound = (value: number) => Math.round(value * 10000) / 10000;
export function normalizePanelConfiguration(input: PanelConfiguration): PanelConfiguration {
  const format = panelFormats[input.format] ? input.format : "3u";
  const hp = bounded(input.hp, 12, format === "pulp-logic-1u" ? 6 : 2, 84);
  return {
    ...input, format, hp: format === "pulp-logic-1u" ? Math.round(hp / 6) * 6 : Math.round(hp),
    thickness: bounded(input.thickness, 3, 1.5, 6), widthClearance: bounded(input.widthClearance, 0.3, 0.1, 0.5),
    slotTravel: bounded(input.slotTravel, 2, 0, 4),
    components: input.components.slice(0, maxPanelComponents).map(c => ({ ...c,
      x: bounded(c.x, 0, -500, 500), y: bounded(c.y, 0, -500, 500), rotation: bounded(c.rotation, 0, -180, 180),
      width: bounded(c.width, 6, 1, 150), height: bounded(c.height, 6, 1, 150), radius: bounded(c.radius, 1, 0, 30),
      bodyWidth: bounded(c.bodyWidth, 10, 1, 200), bodyHeight: bounded(c.bodyHeight, 10, 1, 200), maxPanelThickness: bounded(c.maxPanelThickness, 0, 0, 10),
    })),
    artwork: input.artwork.slice(0, maxPanelArtwork).map(a => ({ ...a, side: "front", width: bounded(a.width, 20, 0.5, 500), x: bounded(a.x, 0, -500, 500), y: bounded(a.y, 0, -500, 500), rotation: bounded(a.rotation, 0, -180, 180) })),
    vents: { ...input.vents, pitch: bounded(input.vents.pitch, 9, 4, 30), size: bounded(input.vents.size, 4, 1, 15), margin: bounded(input.vents.margin, 8, 4, 25), design: normalizeVentDesign(input.vents.design) },
  };
}
// All model coordinates are millimetres, centred on the panel, with Y up.
export function panelRectangle(width: number, height: number, radius = 0): MultiPolygon {
  const r = Math.min(radius, width / 2, height / 2), ring: [number, number][] = [];
  if (r === 0) return [[[[-width / 2, -height / 2], [width / 2, -height / 2], [width / 2, height / 2], [-width / 2, height / 2], [-width / 2, -height / 2]]]];
  for (const [cx, cy, start] of [[width / 2 - r, height / 2 - r, 0], [-width / 2 + r, height / 2 - r, 90], [-width / 2 + r, -height / 2 + r, 180], [width / 2 - r, -height / 2 + r, 270]]) {
    for (let i = 0; i <= 16; i++) { const a = (start + i * 90 / 16) * Math.PI / 180; ring.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
  }
  ring.push(ring[0]); return [[ring]];
}
function disc(diameter: number, sides = 96): MultiPolygon {
  const ring: [number, number][] = Array.from({ length: sides }, (_, i) => [diameter / 2 * Math.cos(i * 2 * Math.PI / sides), diameter / 2 * Math.sin(i * 2 * Math.PI / sides)]);
  ring.push(ring[0]); return [[ring]];
}
function transform(polygons: MultiPolygon, x: number, y: number, rotation = 0) {
  const a = rotation * Math.PI / 180;
  return mapPolygons(polygons, (px, py) => [panelRound(x + px * Math.cos(a) - py * Math.sin(a)), panelRound(y + px * Math.sin(a) + py * Math.cos(a))]);
}
export function componentOutline(c: PanelComponent, body = false) {
  const width = body ? Math.max(c.bodyWidth, c.width) : c.width;
  const height = body ? Math.max(c.bodyHeight, c.shape === "circle" ? c.width : c.height) : c.height;
  const outline = body ? panelRectangle(width, height) : c.shape === "circle" ? disc(width) : panelRectangle(width, height, c.shape === "slot" ? Math.min(width, height) / 2 : c.radius);
  return transform(outline, c.x, c.y, c.rotation);
}
export function newPanelComponent(kind: PanelComponent["kind"], id: string): PanelComponent {
  const presets = { jack: [6, 6, 10, 12], pot: [7, 7, 18, 18], switch: [6, 6, 10, 14], display: [24, 12, 30, 20], custom: [8, 8, 12, 12] };
  const [width, height, bodyWidth, bodyHeight] = presets[kind];
  return { id, name: { jack: "Jack", pot: "Pot", switch: "Switch", display: "Display", custom: "Custom opening" }[kind], kind, shape: kind === "display" ? "rectangle" : "circle", x: 0, y: 0, width, height, radius: 1, rotation: 0, bodyWidth, bodyHeight, maxPanelThickness: 0 };
}
type Bounds = ReturnType<typeof polygonBounds>;
const boundsOverlap = (a: Bounds, b: Bounds, gap = 0) => a.left < b.right + gap && a.right > b.left - gap && a.bottom < b.top + gap && a.top > b.bottom - gap;
const within = (b: Bounds, width: number, height: number, margin = 0) => b.left >= -width / 2 + margin - 1e-6 && b.right <= width / 2 - margin + 1e-6 && b.bottom >= -height / 2 + margin - 1e-6 && b.top <= height / 2 - margin + 1e-6;
function asCutout(id: string, polygons: MultiPolygon): CustomCutout {
  return { id, name: id, source: { kind: "svg", fileName: "generated" }, side: "front", polygons, x: 0, y: 0, width: 1, rotation: 0 };
}
export function createPanel(input: PanelConfiguration) {
  const config = normalizePanelConfiguration(input), format = panelFormats[config.format];
  const width = panelRound(config.hp * 5.08 - config.widthClearance), height = format.height;
  const original = panelRectangle(width, height), warnings: string[] = [];
  const pulp = config.format === "pulp-logic-1u";
  const leftX = -width / 2 + format.insetX;
  // Maintain an integer HP distance between columns, independently of width clearance.
  const rightX = leftX + (config.hp - (pulp ? 2 : 3)) * 5.08;
  const four = config.hp >= 4 && (config.mountingCount === "four" || (config.mountingCount === "auto" && (pulp || config.hp >= 12)));
  if (config.mountingCount === "four" && !four) warnings.push("This narrow panel only has room for one mounting column (two holes).");
  const mounts = (four ? [leftX, rightX] : [leftX]).flatMap(x => [-1, 1].map(sign => {
    const y = panelRound(sign * (height / 2 - format.insetY));
    // Limit slot extension at the panel edges, while retaining the hole centre.
    const travel = config.mounting === "slots" ? Math.max(0, Math.min(config.slotTravel, 2 * (width / 2 - Math.abs(x) - format.diameter / 2 - 0.5))) : 0;
    return { x: panelRound(x), y, diameter: format.diameter, travel: panelRound(travel), polygons: transform(panelRectangle(format.diameter + travel, format.diameter, format.diameter / 2), x, y) };
  }));
  if (config.mounting === "slots" && mounts.some(m => m.travel < config.slotTravel - 1e-4)) warnings.push("Mounting slots were shortened to keep at least 0.5 mm at the side edge. Check the narrow mounting web on a prototype.");
  const components = config.components.map(component => ({ ...component, polygons: componentOutline(component), body: componentOutline(component, true) }));
  const artworks = config.artwork.map(art => ({ ...art, placed: placedCutout(art) }));
  const web = Math.max(2, config.thickness);
  for (const c of components) {
    if (!within(polygonBounds(c.polygons), width, height, web)) warnings.push(`${c.name}: opening is outside the panel or leaves less than ${web} mm at an edge.`);
    const b = polygonBounds(c.body);
    if (!within(b, width, height, 0) || b.top > height / 2 - 8 || b.bottom < -height / 2 + 8) warnings.push(`${c.name}: body clearance reaches an edge or the 8 mm rail reserve. Verify the actual hardware and rail profile.`);
    if (c.maxPanelThickness > 0 && config.thickness > c.maxPanelThickness) warnings.push(`${c.name}: ${config.thickness} mm acrylic exceeds the specified ${c.maxPanelThickness} mm maximum panel thickness.`);
  }
  const reserved = [...components.map(c => polygonBounds(c.body)), ...artworks.map(a => polygonBounds(a.placed)), ...mounts.map(m => polygonBounds(m.polygons))];
  const vents: MultiPolygon[] = [];
  const margin = Math.max(config.vents.margin, 2 * config.thickness);
  let pitch = Math.max(config.vents.pitch, config.vents.size + web);
  if (config.vents.enabled) {
    const usableWidth = width - 2 * margin, usableHeight = height - 2 * Math.max(margin, 8);
    const count = (span: number) => Math.max(0, Math.floor((span - config.vents.size) / pitch) + 1);
    // Bound polygon work during dragging and slider edits on wide, dense panels.
    while (count(usableWidth) * count(usableHeight) > 600) pitch = panelRound(pitch + 0.25);
    const cols = Math.max(0, Math.floor((usableWidth - config.vents.size) / pitch) + 1), rows = Math.max(0, Math.floor((usableHeight - config.vents.size) / pitch) + 1);
    for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
      const x = (col - (cols - 1) / 2) * pitch + (config.vents.staggered && row % 2 ? pitch / 2 : 0), y = (row - (rows - 1) / 2) * pitch;
      let size = config.vents.design.size / 100, sx = 0, sy = 0;
      for (const layer of config.vents.design.layers) {
        const value = sampleVentField(layer, x / Math.max(1, usableWidth), y / Math.max(1, usableHeight), config.vents.design.seed) * layer.amount / 100;
        if (layer.target === "size") size += value * 0.5; else if (layer.target === "shift-x") sx += value; else sy += value;
      }
      const diameter = config.vents.size * Math.max(0.2, Math.min(1, size)), room = (pitch - web - diameter) / 2;
      const shape = config.vents.shape === "circles" ? disc(diameter) : config.vents.shape === "hexagons" ? disc(diameter, 6) : panelRectangle(diameter, Math.min(2, diameter), Math.min(1, diameter / 2));
      const polygons = transform(shape, x + Math.max(-1, Math.min(1, sx)) * room, y + Math.max(-1, Math.min(1, sy)) * room), b = polygonBounds(polygons);
      if (within(b, width, height, margin) && b.top <= height / 2 - 8 && b.bottom >= -height / 2 + 8 && !reserved.some(r => boundsOverlap(b, r, web))) vents.push(polygons);
    }
    if (!vents.length) warnings.push("No ventilation openings fit the available space. Reduce the margin or opening size, or widen the panel.");
  }
  const cuts = [...mounts.map((m, i) => asCutout(`mount-${i + 1}`, m.polygons)), ...components.map(c => asCutout(c.id, c.polygons)), ...vents.map((p, i) => asCutout(`vent-${i + 1}`, p)), ...config.artwork.filter(a => a.operation === "cut")];
  const result = subtractCutouts(original, cuts, "front");
  const { report, polygons } = result;
  if (report.removedParts) warnings.push(`${report.removedParts} loose part(s) removed, including enclosed letter centres. Use stencil artwork for cut-through lettering.`);
  if (report.outside.length) warnings.push(`${report.outside.length} cutout(s) lie outside the panel and do not cut any acrylic.`);
  if (report.clipped.length) warnings.push(`${report.clipped.length} cutout(s) extend beyond the panel edge.`);
  if (report.empty) warnings.push("No acrylic remains. Move or reduce the cutouts before exporting.");
  if (report.error) warnings.push(report.error);
  const userCuts = [...components.map(c => ({ name: c.name, polygons: c.polygons })), ...artworks.filter(a => a.operation === "cut").map(a => ({ name: a.name, polygons: a.placed }))];
  for (const cut of userCuts) {
    if (mounts.some(m => boundsOverlap(polygonBounds(cut.polygons), polygonBounds(m.polygons), web))) warnings.push(`${cut.name}: cut approaches a mounting hole. Leave material for the screw and washer.`);
  }
  for (let i = 0; i < components.length; i++) for (let j = i + 1; j < components.length; j++) {
    if (boundsOverlap(polygonBounds(components[i].body), polygonBounds(components[j].body))) warnings.push(`${components[i].name} and ${components[j].name}: body clearance boxes overlap.`);
  }
  let engravingError = false;
  const engravings = artworks.filter(a => a.operation === "engrave").map(a => {
    try {
      const engraved = clipping.intersection(polygons, a.placed);
      if (geometryArea(a.placed) - geometryArea(engraved) > 1e-5) warnings.push(`${a.name}: engraving outside retained acrylic is omitted.`);
      return { id: a.id, name: a.name, polygons: engraved };
    } catch { engravingError = true; warnings.push(`${a.name}: engraving could not be resolved. Simplify the artwork before exporting.`); return { id: a.id, name: a.name, polygons: [] as MultiPolygon }; }
  });
  return { config, width, height, original, polygons, mounts, components, engravings, vents, ventPitch: pitch, ventMargin: margin, warnings: [...new Set(warnings)], report, canExport: !report.empty && !report.error && !engravingError };
}
export type DesignedPanel = ReturnType<typeof createPanel>;
export type PanelAlignment = "column" | "row" | "distribute-x" | "distribute-y" | "center-x" | "center-y";
export function alignPanelItems(config: PanelConfiguration, ids: string[], alignment: PanelAlignment): PanelConfiguration {
  const items = [...config.components, ...config.artwork].filter(item => ids.includes(item.id));
  if (!items.length) return config;
  const axis = alignment === "column" || alignment.endsWith("x") ? "x" : "y";
  const sorted = [...items].sort((a, b) => a[axis] - b[axis]);
  const mean = items.reduce((sum, i) => sum + i[axis], 0) / items.length;
  const positions = new Map(items.map(item => [item.id, alignment.startsWith("center") ? item[axis] - mean : alignment.startsWith("distribute") && items.length > 2 ? sorted[0][axis] + sorted.indexOf(item) * (sorted.at(-1)![axis] - sorted[0][axis]) / (items.length - 1) : alignment.startsWith("distribute") ? item[axis] : items[0][axis]]));
  const move = <T extends { id: string; x: number; y: number }>(item: T): T => positions.has(item.id) ? { ...item, [axis]: panelRound(positions.get(item.id)!) } : item;
  return { ...config, components: config.components.map(move), artwork: config.artwork.map(move) };
}
const xml = (value: string) => value.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!);
export function panelSvg(panel: DesignedPanel) {
  if (!panel.canExport) throw new Error("Resolve the panel geometry before exporting.");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${panel.width}mm" height="${panel.height}mm" viewBox="0 0 ${panel.width} ${panel.height}" data-units="mm">
  <title>${xml(panelFormats[panel.config.format].label)} · ${panel.config.hp} HP · ${panel.config.thickness} mm acrylic</title>
  <desc>Full-size front view. Red outlines: through cut. Blue filled outlines: surface engraving. Assign operations in CAM and apply kerf once. Curves are sampled. Verify hardware fit and prototype before fabrication.${panel.warnings.length ? ` Warnings: ${xml(panel.warnings.join(" "))}` : ""}</desc>
  <g transform="translate(${panel.width / 2} ${panel.height / 2})">
    <g id="cut" data-operation="cut" fill="none" stroke="#ff0000" stroke-width="0.01"><path id="panel-cut" fill-rule="evenodd" d="${outlinePath(panel.polygons)}" /></g>
    <g id="engrave" data-operation="engrave" fill="#0000ff" stroke="none" fill-rule="evenodd">${panel.engravings.map((a, i) => `\n      <path id="engrave-${i + 1}" data-name="${xml(a.name)}" d="${outlinePath(a.polygons)}" />`).join("")}
    </g>
  </g>
</svg>`;
}
export function panelExport(panel: DesignedPanel) {
  return { version: 1, mode: "panel-designer", units: "mm", configuration: panel.config,
    dimensions: { width: panel.width, height: panel.height, thickness: panel.config.thickness },
    coordinates: "Panel centre; X right, Y up; front view. SVG uses Y down.", formatSource: panelFormats[panel.config.format].source,
    mounting: panel.mounts, components: panel.components, ventilation: { count: panel.vents.length, pitch: panel.ventPitch, margin: panel.ventMargin, polygons: panel.vents },
    layers: { cut: panel.polygons, engrave: panel.engravings }, warnings: panel.warnings, canExportSvg: panel.canExport,
    fabrication: "Sampled outline vectors. Apply kerf once in CAM. Component presets are editable examples, not manufacturer specifications. Verify rail, washer, body and thread fit on a prototype.",
  };
}
export const panelBuildNotes = [
  "Choose Eurorack 3U, Intellijel 1U or Pulp Logic 1U. The two 1U formats are not interchangeable. Width is HP × 5.08 mm minus the selected total clearance; Pulp Logic uses multiples of 6 HP. Mounting columns remain on the HP grid.",
  "Add editable jack, pot, switch and display openings. Enter dimensions from the actual component drawing. Dashed body boxes and the 8 mm rail reserve are planning guides; include nuts, knobs and connectors in the required clearance. Enter each component’s maximum panel thickness after allowing for washers and thread engagement.",
  "Import filled SVG artwork or create font outlines. Cut removes material and loose islands; Engrave keeps letter centres and only marks the retained surface. Imported fonts and artwork stay local to this browser session.",
  "Use Front editor to drag items, Shift-click to select several, and arrow keys to nudge. Millimetre fields also work without dragging. Alignment tools arrange the selected items; grid snapping applies to dragging and keyboard nudging.",
  "Export full-size SVG with separate cut (red outlines) and engrave (blue filled areas) groups. Map these to the correct operations in your laser software; colours alone do not set machine settings. JSON includes editable settings, source outlines and resolved geometry. Verify sampled curves, kerf, mounting webs and acrylic flex on a prototype.",
];
