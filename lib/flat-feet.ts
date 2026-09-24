import type { Shape } from "three";
import type { CaseConfiguration } from "./configurator";

export type FlatFootStyle = "pads" | "arch" | "runners";
export const flatFootStyles: { value: FlatFootStyle; label: string; description: string }[] = [
  { value: "pads", label: "Pads", description: "Four broad feet with rounded inside corners and an open centre." },
  { value: "arch", label: "Arch", description: "Four end feet joined by a smooth arch beneath each side panel." },
  { value: "runners", label: "Runners", description: "Two continuous straight runners along the side panels." },
];
export const flatFootHeightLimits = { min: 8, max: 30 };

export function flatFeetLayout(config: Pick<CaseConfiguration, "angle" | "flatFeet" | "flatFootStyle" | "flatFootHeight">) {
  const height = Math.min(flatFootHeightLimits.max, Math.max(flatFootHeightLimits.min, Number.isFinite(config.flatFootHeight) ? config.flatFootHeight! : 15));
  const style = flatFootStyles.find(style => style.value === config.flatFootStyle)?.value ?? "pads";
  return { enabled: config.angle === 0 && Boolean(config.flatFeet), height, style };
}

// Trace the bottom edge in scene units (1 = 100 mm). All new material stays
// below the original enclosure, preserving its slots, tabs and rail holes.
export function flatFeetBottomEdge(shape: Shape, length: number, thickness: number, feet: ReturnType<typeof flatFeetLayout>) {
  const half = length / 2, bottom = -feet.height / 100;
  shape.moveTo(-half, bottom);
  if (feet.style !== "runners") {
    const pad = Math.min(Math.max(0.22, thickness * 3), length / 4);
    const left = -half + pad, right = half - pad;
    if (feet.style === "arch") {
      shape.lineTo(left, bottom);
      shape.bezierCurveTo(left, 0, right, 0, right, bottom);
    } else {
      const radius = Math.min(0.04, -bottom / 3, (right - left) / 8);
      shape.lineTo(left - radius, bottom);
      shape.quadraticCurveTo(left, bottom, left, bottom + radius);
      shape.lineTo(left, -radius);
      shape.quadraticCurveTo(left, 0, left + radius, 0);
      shape.lineTo(right - radius, 0);
      shape.quadraticCurveTo(right, 0, right, -radius);
      shape.lineTo(right, bottom + radius);
      shape.quadraticCurveTo(right, bottom, right + radius, bottom);
    }
  }
  shape.lineTo(half, bottom);
}
