import type { Shape } from "three";
import { caseCanExport, type CasePanels } from "./case-panels";
import { rackFormatLabel, type CaseConfiguration, type PanelSide } from "./configurator";
import { mapPolygons, polygonBounds, shapesToPolygons } from "./custom-cutouts";
import type { MultiPolygon } from "polygon-clipping";
import { trolleyBus } from "./trolley";
import { compactPwr } from "./compactpwr";

type SvgPart = {
  id: PanelSide;
  label: string;
  polygons: MultiPolygon;
  bounds: ReturnType<typeof polygonBounds>;
};

const margin = 10;
const gap = 15;

function number(value: number) {
  const rounded = Number(value.toFixed(3));
  return Object.is(rounded, -0) ? "0" : String(rounded);
}

function escapeXml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function svgPolygons(shapes: Shape[], fallback?: MultiPolygon) {
  const polygons = mapPolygons(shapesToPolygons(shapes, 32), (x, y) => [x * 100, -y * 100]);
  if (polygons.length || !fallback) return polygons;
  return mapPolygons(fallback, (x, y) => [x, -y]);
}

export function casePathData(polygons: MultiPolygon) {
  return polygons.map(polygon => polygon.map(ring => ring.map(([x, y], index) => `${index ? "L" : "M"}${number(x)} ${number(y)}`).join(" ") + " Z").join(" ")).join(" ");
}

function part(id: PanelSide, label: string, shapes: Shape[], fallback?: MultiPolygon): SvgPart {
  const polygons = svgPolygons(shapes, fallback);
  return { id, label, polygons: shapes.length ? polygons : [], bounds: polygonBounds(polygons) };
}

function caseParts(panels: CasePanels) {
  const parts: SvgPart[] = [
    part("bottom", "Bottom", panels.faces.bottom.shapes, panels.faces.bottom.original),
    part("front", "Front", panels.faces.front.shapes, panels.faces.front.original),
    part("rear", "Rear", panels.faces.rear.shapes, panels.faces.rear.original),
    part("left", "Left side", panels.faces.left.shapes, panels.faces.left.original),
    part("right", "Right side", panels.faces.right.shapes, panels.faces.right.original),
  ];
  return parts;
}

export function caseSheetLayout(panels: CasePanels) {
  const parts = caseParts(panels);
  const largestWidth = Math.max(...parts.map(item => item.bounds.width));
  const totalArea = parts.reduce((area, item) => area + item.bounds.width * item.bounds.height, 0);
  const shelfWidth = Math.max(largestWidth, Math.min(1600, Math.sqrt(totalArea) * 1.55));
  let x = margin, y = margin, rowHeight = 0, right = 0;
  const placed = parts.map(item => {
    if (x > margin && x + item.bounds.width > margin + shelfWidth) {
      x = margin;
      y += rowHeight + gap;
      rowHeight = 0;
    }
    const placement = { item, x: x - item.bounds.left, y: y - item.bounds.bottom };
    right = Math.max(right, x + item.bounds.width);
    rowHeight = Math.max(rowHeight, item.bounds.height);
    x += item.bounds.width + gap;
    return placement;
  });
  const width = right + margin;
  const height = y + rowHeight + margin;
  return { parts: placed, width, height };
}

export function configurationSvg(config: CaseConfiguration, panels: CasePanels) {
  if (!caseCanExport(panels)) throw new Error("Resolve empty panels and cutout calculation errors before exporting SVG.");
  const boardNote = config.busboard === "trolley" ? ` ${trolleyBus.name}: ${trolleyBus.accuracy} ${trolleyBus.mounting}`
    : config.busboard === "compactpwr" ? ` ${compactPwr.name}: ${compactPwr.accuracy} ${compactPwr.mounting}`
    : config.busboard === "sinusoda" ? " Sinusoda Juice: 226 x 86 x 19 mm envelope from data sheet. All 28 mounting centres are photo-derived estimates; diameter 3.2 mm assumed. Verify on hardware before drilling." : "";
  const mountingNote = config.busboard === "none" ? "" : `${panels.powerBoard?.fits ? "" : " Board does not fit; no mounting holes exported."}${panels.mountingConflicts ? ` WARNING: custom cutouts approach or overlap ${panels.mountingConflicts} mounting points.` : ""}`;
  const { parts: placed, width, height } = caseSheetLayout(panels);
  const groups = placed.map(({ item, x: translateX, y: translateY }) => {
    const path = casePathData(item.polygons);
    return `  <g id="panel-${item.id}" data-part="${item.id}"${path ? "" : ' data-empty="true"'} transform="translate(${number(translateX)} ${number(translateY)})">\n    <title>${escapeXml(item.label)}</title>${path ? `\n    <path d="${path}" />` : ""}\n  </g>`;
  }).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${number(width)}mm" height="${number(height)}mm" viewBox="0 0 ${number(width)} ${number(height)}" fill="none" stroke="#000000" stroke-width="0.2" stroke-linecap="round" stroke-linejoin="round" data-units="mm">
  <title>Acryl508 ${escapeXml(rackFormatLabel(config))} / ${config.hp}HP panel layout</title>
  <desc>Full-size concept vectors in millimetres. Verify kerf, tolerances, corner relief, rail fit and hardware clearances before fabrication.${escapeXml(boardNote + mountingNote)}</desc>
${groups}
</svg>
`;
}
