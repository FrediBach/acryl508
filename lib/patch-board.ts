import type { CaseConfiguration } from "./configurator";

export const patchBoardLimits = { width: { min: 100, max: 240 }, height: { min: 40, max: 140 }, spacing: { min: 12, max: 24 } };

export function patchBoardSides(config: Pick<CaseConfiguration, "patchBoard" | "patchBoardSide">): ("left" | "right")[] {
  if (!config.patchBoard) return [];
  return config.patchBoardSide === "both" ? ["left", "right"] : [config.patchBoardSide === "right" ? "right" : "left"];
}

// Millimetres, relative to the centre of the extension's bottom edge.
export function patchBoardLayout(config: Pick<CaseConfiguration, "patchBoardWidth" | "patchBoardHeight" | "patchBoardSpacing">) {
  const bounded = (value: number | undefined, fallback: number, limits: { min: number; max: number }) =>
    Math.min(limits.max, Math.max(limits.min, Number.isFinite(value) ? value! : fallback));
  const width = bounded(config.patchBoardWidth, 160, patchBoardLimits.width);
  const height = bounded(config.patchBoardHeight, 70, patchBoardLimits.height);
  const spacing = bounded(config.patchBoardSpacing, 15, patchBoardLimits.spacing);
  const holeDiameter = 4, margin = 16;
  const columns = Math.floor((width - 2 * margin - holeDiameter) / spacing) + 1;
  const rows = Math.floor((height - 2 * margin - holeDiameter) / spacing) + 1;
  const centers = Array.from({ length: columns * rows }, (_, index) => ({
    x: (index % columns - (columns - 1) / 2) * spacing,
    y: height / 2 + (Math.floor(index / columns) - (rows - 1) / 2) * spacing,
  }));
  return { width, height, spacing, holeDiameter, columns, rows, centers, holeCount: centers.length };
}
