import type { Shape } from "three";
import type { CaseConfiguration } from "./configurator";

export const cableHolderLimits = { height: { min: 20, max: 70 }, slitWidth: { min: 3, max: 8 } };

export function cableHolderLayout(config: Pick<CaseConfiguration, "hp" | "thickness" | "cableHolderHeight" | "cableHolderSlitWidth">) {
  const bounded = (value: number | undefined, fallback: number, limits: { min: number; max: number }) =>
    Math.min(limits.max, Math.max(limits.min, Number.isFinite(value) ? value! : fallback));
  const height = bounded(config.cableHolderHeight, 35, cableHolderLimits.height);
  const slitWidth = bounded(config.cableHolderSlitWidth, 5, cableHolderLimits.slitWidth);
  const inset = Math.max(8, 2 * config.thickness);
  const width = config.hp * 5.08 - 2 * inset;
  const fingerCount = Math.max(2, Math.floor((width + slitWidth) / (Math.max(14, 2 * config.thickness) + slitWidth)));
  const fingerWidth = (width - (fingerCount - 1) * slitWidth) / fingerCount;
  const pitch = fingerWidth + slitWidth;
  const rootHeight = Math.max(6, config.thickness);
  return { height, slitWidth, width, fingerCount, fingerWidth, pitch, rootHeight,
    slitCount: fingerCount - 1,
    slitCenters: Array.from({ length: fingerCount - 1 }, (_, index) => -width / 2 + fingerWidth + slitWidth / 2 + index * pitch),
  };
}

// Walk the rear panel's top edge from right to left. Dimensions above are mm;
// the shared panel profiles use 1 scene unit = 100 mm.
export function cableHolderTopEdge(shape: Shape, top: number, layout: ReturnType<typeof cableHolderLayout>) {
  const half = layout.width / 200, rise = layout.height / 100;
  const finger = layout.fingerWidth / 100, gap = layout.slitWidth / 100;
  const tipRadius = 0.02, rootRadius = 0.03;
  const slotY = top + layout.rootHeight / 100 + gap / 2;
  shape.lineTo(half + rootRadius, top);
  shape.quadraticCurveTo(half, top, half, top + rootRadius);
  for (let index = 0; index < layout.fingerCount; index++) {
    const right = half - index * (finger + gap), left = right - finger;
    shape.lineTo(right, top + rise - tipRadius);
    shape.quadraticCurveTo(right, top + rise, right - tipRadius, top + rise);
    shape.lineTo(left + tipRadius, top + rise);
    shape.quadraticCurveTo(left, top + rise, left, top + rise - tipRadius);
    if (index < layout.fingerCount - 1) {
      shape.lineTo(left, slotY);
      shape.absarc(left - gap / 2, slotY, gap / 2, 0, -Math.PI, true);
    } else {
      shape.lineTo(left, top + rootRadius);
      shape.quadraticCurveTo(left, top, left - rootRadius, top);
    }
  }
}
