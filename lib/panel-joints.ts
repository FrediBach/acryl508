import { Path, Shape } from "three";

type Band = { start: number; end: number };

function bands(start: number, end: number, thickness: number, pitch: number): Band[] {
  const span = end - start;
  const count = Math.max(2, Math.ceil(span / pitch));
  const tabWidth = Math.min(Math.max(3 * thickness, 0.16), span / (2 * count + 1));
  return Array.from({ length: count }, (_, index) => {
    const center = start + span * (index + 1) / (count + 1);
    return { start: center - tabWidth / 2, end: center + tabWidth / 2 };
  });
}

// Nominal geometry in preview units (1 = 100 mm), not compensated cutting paths.
// The configured edge margin remains outside each closed slot as retaining material.
export function panelJointLayout(width: number, length: number, height: number, thickness: number, edgeMargin = 2 * thickness) {
  const innerWidth = width - 2 * thickness;
  const innerLength = length - 2 * thickness - 2 * edgeMargin;
  return {
    innerWidth, innerLength,
    baseBottom: edgeMargin,
    baseTop: edgeMargin + thickness,
    endCenter: innerLength / 2 + thickness / 2,
    endOuter: innerLength / 2 + thickness,
    baseTabs: bands(-innerLength / 2, innerLength / 2, thickness, 0.6),
    endTabs: bands(2 * thickness, height - 2 * thickness, thickness, 0.55),
  };
}

function tabbedProfile(width: number, bottom: number, top: number, tabs: Band[], thickness: number, topEdge?: (shape: Shape) => void) {
  const shape = new Shape();
  const half = width / 2;
  shape.moveTo(-half, bottom);
  shape.lineTo(half, bottom);
  for (const tab of tabs) {
    shape.lineTo(half, tab.start);
    shape.lineTo(half + thickness, tab.start);
    shape.lineTo(half + thickness, tab.end);
    shape.lineTo(half, tab.end);
  }
  shape.lineTo(half, top);
  topEdge?.(shape);
  shape.lineTo(-half, top);
  for (const tab of [...tabs].reverse()) {
    shape.lineTo(-half, tab.end);
    shape.lineTo(-half - thickness, tab.end);
    shape.lineTo(-half - thickness, tab.start);
    shape.lineTo(-half, tab.start);
  }
  shape.closePath();
  return shape;
}

function slot(shape: Shape, left: number, bottom: number, right: number, top: number) {
  const path = new Path();
  path.moveTo(left, bottom);
  path.lineTo(left, top);
  path.lineTo(right, top);
  path.lineTo(right, bottom);
  path.closePath();
  shape.holes.push(path);
}

export function createPanelProfiles(width: number, length: number, height: number, thickness: number, edgeMargin = 2 * thickness, rearTopEdge?: (shape: Shape) => void, rearHeight = height) {
  const layout = { ...panelJointLayout(width, length, height, thickness, edgeMargin), rearTabs: bands(2 * thickness, rearHeight - 2 * thickness, thickness, 0.55) };
  const base = tabbedProfile(layout.innerWidth, -layout.innerLength / 2, layout.innerLength / 2, layout.baseTabs, thickness);
  const end = tabbedProfile(layout.innerWidth, 0, height, layout.endTabs, thickness);
  const rear = tabbedProfile(layout.innerWidth, 0, rearHeight, layout.rearTabs, thickness, rearTopEdge);
  const side = new Shape();
  side.moveTo(-length / 2, 0);
  side.lineTo(length / 2, 0);
  side.lineTo(length / 2, rearHeight);
  side.lineTo(-length / 2, height);
  side.closePath();
  // Side profile X becomes world -Z; base profile Y also becomes world -Z.
  for (const tab of layout.baseTabs) slot(side, tab.start, layout.baseBottom, tab.end, layout.baseTop);
  for (const direction of [-1, 1]) for (const tab of direction === 1 ? layout.rearTabs : layout.endTabs) {
    slot(side, direction * layout.endCenter - thickness / 2, tab.start, direction * layout.endCenter + thickness / 2, tab.end);
  }
  return { base, side, end, rear, layout };
}
