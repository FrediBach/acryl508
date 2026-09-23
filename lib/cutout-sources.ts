import { ShapePath, type Shape } from "three";
import { Font, type FontData } from "three/addons/loaders/FontLoader.js";
import { SVGLoader } from "three/addons/loaders/SVGLoader.js";
import { mapPolygons, normalizeOutlines, shapesToPolygons } from "./custom-cutouts";

export const builtinFonts = [
  { id: "helvetiker", name: "Helvetiker · Sans", url: "/fonts/helvetiker-regular.json" },
  { id: "optimer", name: "Optimer · Serif", url: "/fonts/optimer-regular.json" },
];
export type CutoutFont = { name: string; shapes: (text: string) => Shape[] };
const fonts = new Map<string, Promise<CutoutFont>>();
export function loadBuiltinFont(id: string) {
  if (!fonts.has(id)) {
    const entry = builtinFonts.find(font => font.id === id);
    if (!entry) throw new Error("Choose a font first.");
    const pending = fetch(entry.url).then(async response => {
      if (!response.ok) throw new Error("The font could not be loaded. Try again.");
      return typefaceFont(await response.json(), entry.name);
    }).catch(error => { fonts.delete(id); throw error; });
    fonts.set(id, pending);
  }
  return fonts.get(id)!;
}
export function typefaceFont(data: FontData, name: string): CutoutFont {
  const font = new Font(data);
  return { name, shapes: text => {
    for (const char of text) if (!font.data.glyphs[char]) throw new Error(`This font has no outline for “${char}”. Choose another font or edit the text.`);
    return font.generateShapes(text, 100);
  } };
}
export async function importFont(buffer: ArrayBuffer, name: string): Promise<CutoutFont> {
  if (buffer.byteLength > 5_000_000) throw new Error("Choose a font smaller than 5 MB.");
  const fontModule = await import("opentype.js");
  const { parse } = fontModule.default ?? fontModule;
  let font;
  try { font = parse(buffer); } catch { throw new Error("This font could not be read. Choose a static TTF or OTF font."); }
  return { name, shapes: text => {
    for (const char of text) if (!font.charToGlyphIndex(char)) throw new Error(`This font has no outline for “${char}”. Choose another font or edit the text.`);
    const path = new ShapePath();
    for (const command of font.getPath(text, 0, 0, 100).commands) {
      switch (command.type) {
        case "M": path.moveTo(command.x, -command.y); break;
        case "L": path.lineTo(command.x, -command.y); break;
        case "Q": path.quadraticCurveTo(command.x1, -command.y1, command.x, -command.y); break;
        case "C": path.bezierCurveTo(command.x1, -command.y1, command.x2, -command.y2, command.x, -command.y); break;
        case "Z": path.currentPath?.closePath(); break;
      }
    }
    return path.toShapes();
  } };
}
export function textOutlines(font: CutoutFont, text: string) {
  if (!text.trim()) throw new Error("Enter some text for the cutout.");
  if (text.length > 60 || /[\r\n\t]/.test(text)) throw new Error("Use a single line of up to 60 characters.");
  return normalizeOutlines(shapesToPolygons(font.shapes(text)));
}

// Parse in a detached XML document. Imported markup is never mounted in the
// page. Reject unsupported SVG features instead of silently changing the cut.
export function importSvg(source: string) {
  if (source.length > 1_000_000) throw new Error("Choose an SVG smaller than 1 MB.");
  if (/<!DOCTYPE|<!ENTITY/i.test(source)) throw new Error("SVG document types and entities are not supported. Export plain SVG paths.");
  const doc = new DOMParser().parseFromString(source, "image/svg+xml");
  if (doc.getElementsByTagName("parsererror").length || doc.documentElement?.localName !== "svg") throw new Error("This is not a valid SVG file.");
  const allowed = new Set(["svg", "g", "path", "rect", "circle", "ellipse", "polygon", "polyline", "line", "title", "desc", "metadata", "defs"]);
  const styleProperties = new Set(["fill", "fill-rule", "fill-opacity", "stroke", "stroke-width", "stroke-opacity", "opacity", "display", "visibility"]);
  const nodes = Array.from(doc.getElementsByTagName("*"));
  if (nodes.length > 500 || (source.match(/[mlhvcsqtaz](?=[\s,\d.+-])/gi)?.length ?? 0) > 2000) throw new Error("This SVG is too complex. Simplify its paths before importing.");
  for (const node of nodes) {
    if (["metadata", "title", "desc", "defs"].includes(node.localName)) { node.parentNode?.removeChild(node); continue; }
    if (!doc.documentElement.contains(node)) continue;
    if (!allowed.has(node.localName) || (node.localName === "svg" && node !== doc.documentElement)) throw new Error("Use a flat SVG with filled shapes. Convert text and strokes to paths, and flatten images, symbols, masks and clipping paths first.");
    for (const attr of Array.from(node.attributes)) {
      if (/^on/i.test(attr.name) || /href$/i.test(attr.name) || /url\s*\(/i.test(attr.value) || ["clip-path", "mask", "filter"].includes(attr.name)) throw new Error("This SVG uses unsupported references or effects. Export plain filled paths.");
    }
    for (const declaration of (node.getAttribute("style") ?? "").split(";")) {
      if (!declaration.trim()) continue;
      const [property, value] = declaration.split(":").map(part => part.trim());
      if (!styleProperties.has(property) || !value) throw new Error("This SVG uses unsupported styles. Export plain filled paths with inline fill colours.");
      node.setAttribute(property, value);
    }
    node.removeAttribute("style");
    if (node.getAttribute("display") === "none" || ["hidden", "collapse"].includes(node.getAttribute("visibility") ?? "") || node.getAttribute("opacity") === "0") node.parentNode?.removeChild(node);
  }
  let shapes: Shape[];
  try {
    const { paths } = new SVGLoader().parse(new XMLSerializer().serializeToString(doc));
    shapes = paths.flatMap(path => {
      const style = path.userData?.style as { opacity?: number; visibility?: string; stroke?: string; strokeOpacity?: number; strokeWidth?: number; fill?: string; fillOpacity?: number } | undefined;
      if (!style) return [];
      if (style.opacity === 0 || style.visibility === "hidden") return [];
      if (style.stroke && style.stroke !== "none" && style.strokeOpacity !== 0 && style.strokeWidth !== 0) throw new Error("Convert SVG strokes to filled paths before importing.");
      return style.fill === "none" || style.fillOpacity === 0 ? [] : path.toShapes();
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Convert SVG")) throw error;
    throw new Error("The SVG paths could not be read. Export a simplified SVG with filled outlines.");
  }
  // SVG Y runs down; cutout coordinates run up.
  return normalizeOutlines(mapPolygons(shapesToPolygons(shapes), (x, y) => [x, -y]));
}
