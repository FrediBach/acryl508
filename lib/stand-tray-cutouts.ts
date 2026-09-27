import clipping, { type MultiPolygon } from "polygon-clipping";
import { geometryArea, mapPolygons, placedCutout, subtractCutouts, type CustomCutout, type CutoutReport } from "./custom-cutouts";
import type { BentTray } from "./bent-stand";

export type StandCutoutPanels = {
  faces: { bottom: { original: MultiPolygon; polygons: MultiPolygon } };
  reports: CutoutReport[];
};
const rect = (left: number, bottom: number, right: number, top: number): MultiPolygon => [[[[left, bottom], [right, bottom], [right, top], [left, top], [left, bottom]]]];

// Artwork is centred on the flat deck, seen from above: +X right, +Y rear.
// Keep the stored outlines unchanged so resizing and mode changes are reversible.
export function cutStandTray(blank: MultiPolygon, tray: BentTray, width: number, thickness: number, cutouts: CustomCutout[]) {
  const center = tray.deckStart + tray.deckDepth / 2;
  const deck = rect(-width / 2, -tray.deckDepth / 2, width / 2, tray.deckDepth / 2);
  const toDeck = (polygons: MultiPolygon) => clipping.intersection(mapPolygons(polygons, (x, y) => [x, y - center]), deck);
  const original = toDeck(blank), web = 2 * thickness;
  const report: CutoutReport = { side: "bottom", removedParts: 0, removedArea: 0, empty: false, outside: [], clipped: [] };
  let polygons = blank;
  try {
    const editable = clipping.difference(rect(-width / 2 + web, -tray.deckDepth / 2 + web, width / 2 - web, tray.deckDepth / 2 - web),
      ...tray.holes.flatMap(h => [
        rect(h.x - h.size / 2 - web, h.y - center - h.size / 2 - web, h.x + h.size / 2 + web, h.y - center + h.size / 2 + web),
        // A collar alone can become an isolated island after a large cut.
        // Tie each collar to its nearest side edge with a two-thickness web.
        rect(h.x < 0 ? -width / 2 : h.x, h.y - center - web / 2, h.x < 0 ? h.x : width / 2, h.y - center + web / 2),
      ]));
    const limited = cutouts.map(cutout => {
      const placed = placedCutout(cutout), cut = clipping.intersection(placed, editable);
      if (geometryArea(cut) < 1e-7) report.outside.push(cutout.id);
      else if (geometryArea(clipping.difference(placed, editable)) > 1e-7) report.clipped.push(cutout.id);
      return { ...cutout, polygons: cut, width: 1, x: 0, y: center, rotation: 0 };
    });
    // Resolve islands on the whole blank, retaining the continuous outer frame
    // and both folds rather than choosing an arbitrary fragment of the deck.
    const result = subtractCutouts(blank, limited, "bottom");
    polygons = result.polygons;
    Object.assign(report, { removedParts: result.report.removedParts, removedArea: result.report.removedArea, empty: result.report.empty, error: result.report.error });
  } catch {
    report.error = "These upper-sheet cutouts could not be calculated. Simplify the outlines or reduce their number. The tray is shown without custom cuts.";
  }
  const panels: StandCutoutPanels = { faces: { bottom: { original, polygons: toDeck(polygons) } }, reports: [report] };
  return { polygons, panels, canExport: !report.error && !report.empty, minimumWeb: web };
}
