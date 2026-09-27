import type { Shape } from "three";
import type { CaseConfiguration } from "./configurator";
import { panelThickness } from "./sheet-thickness";
import { bendAllowance, type AccessoryBend } from "./accessory-bends";

export const backHookLimits = {
  count: { min: 1, max: 8 }, width: { min: 20, max: 840 },
  rise: { min: 10, max: 100 }, reach: { min: 10, max: 100 }, drop: { min: 10, max: 100 },
};
const bounded = (value: number | undefined, fallback: number, limits: { min: number; max: number }) =>
  Math.min(limits.max, Math.max(limits.min, Number.isFinite(value) ? value! : fallback));

// Millimetres. Both bends turn 90° outward: up, backward, then down.
// The hook and cable fingers are alternative treatments of the same top edge.
export function backHookLayout(config: CaseConfiguration) {
  const thickness = panelThickness(config, "rear");
  const inset = Math.max(8, 2 * thickness), gapMinimum = Math.max(8, 2 * thickness);
  const availableWidth = config.hp * 5.08 - 2 * inset;
  const mode = config.backHookMode === "segments" ? "segments" : "full";
  const maxCount = Math.min(backHookLimits.count.max, Math.floor((availableWidth + gapMinimum) / (backHookLimits.width.min + gapMinimum)));
  const count = mode === "full" ? 1 : Math.min(maxCount, Math.round(bounded(config.backHookCount, 2, backHookLimits.count)));
  const maxWidth = Math.floor((availableWidth - (count - 1) * gapMinimum) / count);
  const width = mode === "full" ? availableWidth : bounded(config.backHookWidth, 40, { min: backHookLimits.width.min, max: maxWidth });
  const gap = count > 1 ? (availableWidth - count * width) / (count - 1) : 0;
  const span = count * width + (count - 1) * gap;
  const centers = Array.from({ length: count }, (_, i) => -span / 2 + width / 2 + i * (width + gap));
  const rise = bounded(config.backHookRise, 20, backHookLimits.rise);
  const reach = bounded(config.backHookReach, 30, backHookLimits.reach);
  const drop = bounded(config.backHookDrop, 25, backHookLimits.drop);
  const shoulder = bendAllowance(90, thickness / 100);
  const turn = bendAllowance(90, thickness / 100, 0);
  const flatHeight = rise + reach + drop + (shoulder.extra + turn.extra) * 100;
  return { enabled: Boolean(config.backHook), mode, thickness, inset, availableWidth, count, maxCount, width, maxWidth, gap, centers,
    rise, reach, drop, shoulder, turn, flatHeight };
}

export function backHookBends(top: number, layout: ReturnType<typeof backHookLayout>): AccessoryBend[] {
  const first = top + layout.rise / 100 + layout.shoulder.clearance;
  return [
    { start: first, length: layout.shoulder.length, angle: layout.shoulder.angle, clearance: layout.shoulder.clearance },
    { start: first + layout.shoulder.length + layout.reach / 100, length: layout.turn.length, angle: layout.turn.angle, clearance: 0 },
  ];
}

// Extend the existing rear outline right-to-left; all segments remain attached
// to the sheet, with rounded roots and tips in the developed cutting pattern.
export function backHookTopEdge(shape: Shape, top: number, layout: ReturnType<typeof backHookLayout>) {
  const root = 0.03, tip = 0.03, end = top + layout.flatHeight / 100;
  for (const center of [...layout.centers].reverse()) {
    const right = (center + layout.width / 2) / 100, left = (center - layout.width / 2) / 100;
    shape.lineTo(right + root, top);
    shape.quadraticCurveTo(right, top, right, top + root);
    shape.lineTo(right, end - tip);
    shape.quadraticCurveTo(right, end, right - tip, end);
    shape.lineTo(left + tip, end);
    shape.quadraticCurveTo(left, end, left, end - tip);
    shape.lineTo(left, top + root);
    shape.quadraticCurveTo(left, top, left - root, top);
  }
}
