import { Path, type Shape } from "three";
import { caseDimensions, type CaseConfiguration } from "./configurator";
import { footHoleRadius, footMountLayout, handleLayout } from "./acrylic-profiles";
import { createPanelProfiles } from "./panel-joints";
import { cutoutSides, mapPolygons, polygonsToShapes, shapesToPolygons, subtractCutouts, type CutoutSide } from "./custom-cutouts";

function hole(shape: Shape, x: number, y: number, radius: number) {
  const path = new Path(); path.absarc(x, y, radius, 0, Math.PI * 2, true); shape.holes.push(path);
}

export function createCasePanels(config: CaseConfiguration) {
  const dimensions = caseDimensions(config);
  const w = dimensions.width / 100, l = dimensions.length / 100, h = dimensions.height / 100, t = config.thickness / 100;
  const panels = createPanelProfiles(w, l, h, t);
  const { innerLength } = panels.layout;
  const base = panels.base;
  if (config.vents) {
    const count = Math.max(3, Math.floor((w - 0.5) / 0.12));
    for (let i = 0; i < count; i++) {
      const x = (i - (count - 1) / 2) * 0.12;
      for (const side of [-1, 1]) {
        const path = new Path(), y = side * innerLength * 0.28;
        path.moveTo(x - 0.017, y - innerLength * 0.09); path.lineTo(x - 0.017, y + innerLength * 0.09);
        path.absarc(x, y + innerLength * 0.09, 0.017, Math.PI, 0, true);
        path.lineTo(x + 0.017, y - innerLength * 0.09); path.absarc(x, y - innerLength * 0.09, 0.017, 0, Math.PI, true);
        path.closePath(); base.holes.push(path);
      }
    }
  }
  const side = panels.side;
  for (let row = 0; row < config.rows; row++) for (const end of [-1, 1]) {
    hole(side, -innerLength / 2 + (row + 0.5) * 1.3335 + end * 0.6125, h - 0.07, 0.019);
  }
  if (config.angle > 0) for (const mount of footMountLayout(l, config.angle, t)) hole(side, -mount.caseZ, mount.caseY, footHoleRadius);
  const rear = panels.end.clone();
  const handle = handleLayout(w - 2 * t);
  if (config.handle) for (const direction of [-1, 1]) hole(rear, direction * handle.mountX, h + handle.mountY, 0.022);
  const originals = { front: panels.end, rear, left: side, right: side, bottom: base };
  const faces = Object.fromEntries(cutoutSides.map(({ value }) => {
    // Each editor face is viewed from outside, centred in millimetres, Y up.
    // Mirror the back/left/underside so lettering reads correctly on the case.
    const direction = ["rear", "left", "bottom"].includes(value) ? -1 : 1;
    const centerY = value === "bottom" ? 0 : h / 2;
    const original = mapPolygons(shapesToPolygons([originals[value]]), (x, y) => [direction * x * 100, (y - centerY) * 100]);
    const cuts = (config.cutouts ?? []).filter(cutout => cutout.side === value);
    const result = subtractCutouts(original, cuts, value);
    const shapes = cuts.length && !result.report.error
      ? polygonsToShapes(mapPolygons(result.polygons, (x, y) => [direction * x / 100, y / 100 + centerY]))
      : [originals[value]];
    return [value, { ...result, original, shapes }];
  })) as Record<CutoutSide, ReturnType<typeof subtractCutouts> & { original: ReturnType<typeof shapesToPolygons>; shapes: Shape[] }>;
  return { faces, layout: panels.layout, reports: cutoutSides.map(({ value }) => faces[value].report) };
}
export type CasePanels = ReturnType<typeof createCasePanels>;
