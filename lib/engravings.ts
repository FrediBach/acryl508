import clipping, { type MultiPolygon } from "polygon-clipping";
import { geometryArea, placedCutout, polygonBounds, type CustomCutout } from "./custom-cutouts";

export type LedStrip = { enabled: boolean; length: number; slotHeight: number; inset: number; color: string; intensity: number };
export const defaultLedStrip: LedStrip = { enabled: false, length: 80, slotHeight: 2, inset: 25, color: "#80dfff", intensity: 1 };
export type EngravingResult = ReturnType<typeof resolveEngravings>;
export function resolveEngravings(panel: MultiPolygon, artwork: CustomCutout[]) {
  const outside: string[] = [], clipped: string[] = [];
  try {
    const pieces = artwork.map(item => {
      const placed = placedCutout(item), polygons = clipping.intersection(panel, placed);
      if (geometryArea(polygons) < 1e-7) outside.push(item.id);
      else if (geometryArea(clipping.difference(placed, panel)) > 1e-7) clipped.push(item.id);
      return polygons;
    }).filter(polygons => polygons.length);
    // Union overlapping marks so they are engraved once and never cancel under even-odd fill.
    return { polygons: pieces.length ? clipping.union(pieces[0], ...pieces.slice(1)) : [], outside, clipped, error: "" };
  } catch {
    return { polygons: [] as MultiPolygon, outside, clipped, error: "Engravings could not be calculated. Simplify or remove the artwork before exporting." };
  }
}
export function ledSlot(panel: MultiPolygon, strip: LedStrip | undefined, thickness: number, side: CustomCutout["side"] = "front") {
  if (!strip?.enabled) return null;
  const bounds = polygonBounds(panel);
  const y = bounds.bottom + strip.inset;
  const left = -strip.length / 2, right = strip.length / 2, bottom = y - strip.slotHeight / 2, top = y + strip.slotHeight / 2;
  const rectangle = (pad: number): MultiPolygon => [[[[left - pad, bottom - pad], [right + pad, bottom - pad], [right + pad, top + pad], [left - pad, top + pad], [left - pad, bottom - pad]]]];
  const polygons = rectangle(0);
  let error = "";
  try {
    // Keep a full sheet thickness of material around the slot, including joints and other cuts.
    if (geometryArea(clipping.difference(rectangle(thickness), panel)) > 1e-7) error = "LED slot needs one sheet thickness of clear acrylic around it. Shorten the strip, adjust its bottom offset, or move nearby cutouts.";
  } catch { error = "LED slot clearance could not be calculated."; }
  const cutout: CustomCutout = { id: `led-slot-${side}`, name: "LED strip slot", side, source: { kind: "svg", fileName: "led-slot.svg" }, polygons, width: 1, x: 0, y: 0, rotation: 0 };
  return { polygons, cutout, x: 0, y, strip, error };
}
