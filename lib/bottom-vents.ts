import { Path } from "three";
import type { VentDensity, VentStyle } from "./configurator";

// Preview units: 1 = 100 mm. Two vent bands retain the centre strip and
// perimeter of the base. Density changes spacing, not the opening size.
export function createBottomVents(width: number, innerLength: number, style: VentStyle = "long-slits", density: VentDensity = "medium") {
  const paths: Path[] = [];
  const slits = style === "long-slits" || style === "short-slits";
  const pitch = (slits ? { low: 0.18, medium: 0.12, high: 0.085 } : { low: 0.24, medium: 0.18, high: 0.13 })[density];
  const openingWidth = slits ? 0.034 : style === "round" ? 0.05 : 0.06;
  const bandHeight = innerLength * 0.18 + 0.034;
  const openingHeight = style === "long-slits" ? bandHeight : style === "short-slits" ? Math.min(0.12, bandHeight) : openingWidth;
  const rowPitch = openingHeight + pitch - openingWidth;
  const columns = Math.max(1, Math.floor((width - 0.5) / pitch));
  const rows = Math.max(1, Math.floor((bandHeight - openingHeight + 1e-9) / rowPitch) + 1);
  for (const side of [-1, 1]) for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
    const x = (column - (columns - 1) / 2) * pitch;
    const y = side * innerLength * 0.28 + (row - (rows - 1) / 2) * rowPitch;
    const path = new Path();
    if (slits) {
      const radius = openingWidth / 2, halfStraight = openingHeight / 2 - radius;
      path.moveTo(x - radius, y - halfStraight);
      path.lineTo(x - radius, y + halfStraight);
      path.absarc(x, y + halfStraight, radius, Math.PI, 0, true);
      path.lineTo(x + radius, y - halfStraight);
      path.absarc(x, y - halfStraight, radius, 0, Math.PI, true);
    } else if (style === "round") {
      path.absarc(x, y, openingWidth / 2, 0, Math.PI * 2, true);
    } else {
      for (let vertex = 0; vertex < 6; vertex++) {
        const angle = -vertex * Math.PI / 3;
        const px = x + openingWidth / 2 * Math.cos(angle), py = y + openingWidth / 2 * Math.sin(angle);
        if (vertex === 0) path.moveTo(px, py); else path.lineTo(px, py);
      }
    }
    path.closePath();
    paths.push(path);
  }
  return paths;
}
