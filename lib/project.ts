import { defaultConfiguration, type CaseConfiguration } from "./configurator";
import { defaultStandConfiguration, normalizeStandConfiguration, type StandConfiguration } from "./synth-stand";
import { defaultProtectorConfiguration, type ProtectorConfiguration } from "./synth-protector";
import { defaultPanelConfiguration, normalizePanelConfiguration, type PanelConfiguration } from "./panel-designer";
import { type CustomCutout } from "./custom-cutouts";
import { validateObjectVertices, type StandObject } from "./stand-object";
import { normalizeVentDesign } from "./vent-design";
import { type FontAsset } from "./project-fonts";

export type DesignerMode = "case" | "stand" | "protector" | "panel";
export type Designs = { case: CaseConfiguration; stand: StandConfiguration; protector: ProtectorConfiguration; panel: PanelConfiguration };
export const initialDesigns: Designs = { case: defaultConfiguration, stand: defaultStandConfiguration, protector: defaultProtectorConfiguration, panel: defaultPanelConfiguration };
export type Project = { format: "acryl508-project"; version: 1; name: string; mode: DesignerMode; designs: Designs; fonts: FontAsset[] };
export const maxProjectBytes = 80 * 1024 * 1024;
type RecordValue = Record<string, unknown>;
function record(value: unknown, label: string): RecordValue {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  return value as RecordValue;
}
function text(value: unknown, label: string, max = 200): string {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new Error(`Invalid ${label}.`);
  return value;
}
function number(value: unknown, label: string, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) throw new Error(`${label} must be between ${min} and ${max}.`);
  return value;
}
function choice<const T extends string>(value: unknown, choices: readonly T[], label: string): T {
  if (!choices.includes(value as T)) throw new Error(`Invalid ${label}.`);
  return value as T;
}
function list(value: unknown, label: string, max: number): unknown[] {
  if (!Array.isArray(value) || value.length > max) throw new Error(`Invalid ${label} (maximum ${max}).`);
  return value;
}
// Copy known fields only; untrusted exported metadata never enters live state.
function base<T extends object>(input: unknown, defaults: T): T {
  const data = record(input, "Configuration"), output = { ...defaults };
  for (const key of Object.keys(defaults) as (keyof T)[]) {
    const value = data[String(key)];
    if (value === undefined) continue;
    if (typeof defaults[key] === "number") number(value, String(key), -1e6, 1e6);
    if (typeof defaults[key] === "boolean" && typeof value !== "boolean") throw new Error(`Invalid ${String(key)}.`);
    output[key] = value as T[keyof T];
  }
  return output;
}
function material<T extends { tint: CaseConfiguration["tint"]; transparency?: CaseConfiguration["transparency"] }>(config: T): T {
  const tint = record(config.tint, "Color");
  if (typeof tint.color !== "string" || !/^#[0-9a-f]{6}$/i.test(tint.color)) throw new Error("Invalid acrylic color.");
  return { ...config, tint: { id: text(tint.id, "color ID"), label: text(tint.label, "color name"), color: tint.color, ...(typeof tint.shopLabel === "string" ? { shopLabel: tint.shopLabel.slice(0, 200) } : {}) }, transparency: choice(config.transparency ?? "transparent", ["transparent", "see-through", "opaque", "opal"], "transparency") };
}
function cutouts(input: unknown): CustomCutout[] {
  return list(input, "artwork", 20).map(value => {
    const c = record(value, "Artwork"), source = record(c.source, "Artwork source");
    let pointCount = 0;
    const polygons = list(c.polygons, "polygons", 2000).map(polygon => list(polygon, "rings", 2000).map(ring => {
      const points = list(ring, "outline points", 20000);
      pointCount += points.length;
      if (points.length < 4 || pointCount > 30000) throw new Error("Artwork outlines must have 4–30,000 points.");
      return points.map(point => {
        const pair = list(point, "coordinate", 2);
        if (pair.length !== 2) throw new Error("Invalid artwork coordinate.");
        return [number(pair[0], "X", -10000, 10000), number(pair[1], "Y", -10000, 10000)] as [number, number];
      });
    }));
    if (!polygons.length || polygons.some(polygon => !polygon.length)) throw new Error("Artwork has no outlines.");
    return { id: text(c.id, "artwork ID"), name: text(c.name, "artwork name"),
      source: source.kind === "text" ? { kind: "text", text: text(source.text, "artwork text", 60), fontId: text(source.fontId, "font ID"), fontName: text(source.fontName, "font name") }
        : { kind: choice(source.kind, ["svg"], "artwork source"), fileName: text(source.fileName, "SVG filename") },
      side: choice(c.side, ["front", "rear", "left", "right", "bottom"], "artwork side"), polygons,
      width: number(c.width, "Artwork width", 0.5, 1000), x: number(c.x, "Artwork X", -1000, 1000), y: number(c.y, "Artwork Y", -1000, 1000), rotation: number(c.rotation, "Artwork rotation", -180, 180),
    };
  });
}
function object(input: unknown): StandObject | undefined {
  if (input === undefined || input === null) return undefined;
  const data = record(input, "Model");
  const vertices = list(data.vertices, "model vertices", 270000) as number[];
  validateObjectVertices(vertices);
  return { name: text(data.name, "model filename"), vertices,
    units: choice(data.units, ["mm", "cm", "m", "in"], "model units"), up: choice(data.up, ["x", "-x", "y", "-y", "z", "-z"], "model up axis"), turn: number(data.turn, "Model rotation", 0, 270) };
}
export function readCase(input: unknown): CaseConfiguration {
  const data = record(input, "Case"), config = material(base(input, defaultConfiguration));
  config.hp = number(config.hp, "Case HP", 20, 168);
  config.depth = number(config.depth, "Case depth", 50, 180);
  config.thickness = number(config.thickness, "Case thickness", 3, 6);
  config.rows = number(config.rows, "Row count", 1, 9);
  if (!Number.isInteger(config.rows) || !Number.isInteger(config.hp)) throw new Error("Row count and HP must be whole numbers.");
  config.rowUnits = data.rowUnits === undefined ? Array(config.rows).fill(3) : list(data.rowUnits, "rows", 9).map(value => {
    if (value !== 1 && value !== 3) throw new Error("Rows must be 1U or 3U."); return value;
  });
  if (config.rowUnits.length !== config.rows || config.rowUnits.reduce<number>((a, b) => a + b, 0) > 9) throw new Error("The row layout must match the row count and fit within 9U.");
  config.rowAngles = data.rowAngles === undefined ? [] : list(data.rowAngles, "row angles", 9).map(value => number(value, "Row angle", 0, 60));
  config.angle = number(config.angle, "Stance angle", 0, 30);
  config.sideMarginRatio = number(config.sideMarginRatio, "Side margin", 1, 2);
  config.busboard = choice(config.busboard, ["none", "sinusoda", "trolley", "compactpwr"], "busboard");
  config.footShape = choice(config.footShape, ["wedge", "arch", "sled"], "foot shape");
  config.patchBoardSide = choice(config.patchBoardSide, ["left", "right", "both"], "patch cable board side");
  config.handleMode = choice(config.handleMode, ["auto", "single", "left", "right", "pair"], "handle layout");
  config.ventStyle = choice(config.ventStyle, ["long-slits", "short-slits", "round", "hexagonal", "mixed"], "vent shape");
  config.ventDensity = choice(config.ventDensity, ["low", "medium", "high"], "vent density");
  config.ventLayout = choice(config.ventLayout, ["aligned", "staggered"], "vent layout");
  config.ventCoverage = choice(config.ventCoverage, ["bands", "field"], "vent coverage");
  config.ventMix = choice(config.ventMix, ["checkerboard", "rows", "columns"], "vent alternation");
  config.ventDesign = normalizeVentDesign(record(config.ventDesign, "Vent design"));
  config.cutouts = cutouts(config.cutouts);
  config.individualPanelTints = data.individualPanelTints === true;
  config.panelTints = {}; config.panelTransparencies = {};
  for (const side of ["front", "rear", "left", "right", "bottom"] as const) {
    const tint = data.panelTints && record(data.panelTints, "Sheet colors")[side];
    const transparency = data.panelTransparencies && record(data.panelTransparencies, "Sheet transparency")[side];
    if (tint) config.panelTints[side] = material({ tint: tint as CaseConfiguration["tint"] }).tint;
    if (transparency) config.panelTransparencies[side] = choice(transparency, ["transparent", "see-through", "opaque", "opal"], "sheet transparency");
  }
  return config;
}
export function readStand(input: unknown): StandConfiguration {
  return normalizeStandConfiguration({ ...material(base(input, defaultStandConfiguration)), object: object(record(input, "Stand").object) });
}
export function readProtector(input: unknown): ProtectorConfiguration {
  return { ...material(base(input, defaultProtectorConfiguration)), object: object(record(input, "Protector").object) };
}
export function readPanel(input: unknown): PanelConfiguration {
  const config = material(base(input, defaultPanelConfiguration));
  config.format = choice(config.format, ["3u", "intellijel-1u", "pulp-logic-1u"], "panel format");
  config.mounting = choice(config.mounting, ["holes", "slots"], "mounting");
  config.mountingCount = choice(config.mountingCount, ["auto", "two", "four"], "mounting count");
  config.components = list(config.components, "components", 64).map(value => {
    const c = record(value, "Component");
    const numeric = Object.fromEntries(["x", "y", "width", "height", "radius", "rotation", "bodyWidth", "bodyHeight", "maxPanelThickness"].map(key => [key, number(c[key], key, -1000, 1000)]));
    return { ...numeric, id: text(c.id, "component ID"), name: text(c.name, "component name"), kind: choice(c.kind, ["jack", "pot", "switch", "display", "custom"], "component kind"), shape: choice(c.shape, ["circle", "rectangle", "slot"], "component shape") } as PanelConfiguration["components"][number];
  });
  const artworks = list(config.artwork, "artwork", 20);
  config.artwork = cutouts(artworks).map((a, index) => ({ ...a, operation: choice(record(artworks[index], "Artwork").operation, ["cut", "engrave"], "artwork operation") }));
  const vents = base(config.vents, defaultPanelConfiguration.vents);
  config.vents = { ...vents, shape: choice(vents.shape, ["circles", "slots", "hexagons"], "panel vents"), design: normalizeVentDesign(record(vents.design, "Vent design")) };
  return normalizePanelConfiguration(config);
}
const readers = { case: readCase, stand: readStand, protector: readProtector, panel: readPanel };
export function makeProject(name: string, mode: DesignerMode, designs: Designs, fonts: FontAsset[]): Project {
  return { format: "acryl508-project", version: 1, name: name.trim().slice(0, 100) || "Untitled project", mode, designs, fonts };
}
export function parseProject(source: string, current: Designs = initialDesigns, currentFonts: FontAsset[] = []): Project {
  if (source.length > maxProjectBytes) throw new Error("Choose a project smaller than 80 MB.");
  const data = record(JSON.parse(source), "Project");
  if (data.format === "acryl508-project") {
    if (data.version !== 1) throw new Error("This project version is not supported. Open it with the version of Acryl508 that saved it.");
    const configs = record(data.designs, "Designs");
    const designs: Designs = { case: readCase(configs.case), stand: readStand(configs.stand), protector: readProtector(configs.protector), panel: readPanel(configs.panel) };
    const fonts = list(data.fonts, "imported fonts", 10).map(value => {
      const font = record(value, "Font");
      return { id: text(font.id, "font ID"), name: text(font.name, "font name"), data: text(font.data, "font data", 6_666_668) };
    });
    if (fonts.some(font => ["helvetiker", "optimer"].includes(font.id)) || new Set(fonts.map(font => font.id)).size !== fonts.length) throw new Error("Duplicate font IDs in project.");
    return makeProject(text(data.name, "project name", 100), choice(data.mode, ["case", "stand", "protector", "panel"], "designer mode"), designs, fonts);
  }
  // Existing single-designer JSON exports remain useful: import only that mode.
  const mode = data.mode === "synth-stand" ? "stand" : data.mode === "synth-protector" ? "protector" : data.mode === "panel-designer" ? "panel" : data.product === "Acryl508" && !data.mode ? "case" : undefined;
  if (!mode || data.units !== "mm") throw new Error("Choose an Acryl508 project or configuration JSON file.");
  number(data.version, "Export version", 1, { case: 10, stand: 6, protector: 2, panel: 1 }[mode]);
  return makeProject("Imported design", mode, { ...current, [mode]: readers[mode](data.configuration) }, currentFonts);
}
