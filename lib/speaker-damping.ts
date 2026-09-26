import clipping from "polygon-clipping";
import { sheetThickness } from "./sheet-materials";
import type { SpeakerConfiguration, SpeakerPart } from "./speaker";
import { speakerRoundedRect } from "./speaker-shapes";

export const speakerDampingMaterial = "Dark damping sheet";
export const speakerDampingNote = "Optional front and rear damping frames sit between the shell edges and end panels, retained by the four corner tie rods. Keep the side, top, base and carrier joints bonded. Cut the gaskets from suitable damping sheet separately from the acrylic; the preview uses nominal sheet thickness without simulating compression. Verify the compressed fit, seal and tie-rod engagement on assembly. These are joint gaskets, not internal acoustic lining; no acoustic attenuation is predicted.";
export const speakerDampingThickness = (c: SpeakerConfiguration) => c.damping ? c.dampingThickness : 0;

export function speakerDampingParts(c: SpeakerConfiguration): SpeakerPart[] {
  if (!c.damping) return [];
  const t = (id: string) => sheetThickness(c, id), inset = 0.35;
  const outer = [[speakerRoundedRect(0, 0, c.width - 2 * inset, c.height - 2 * inset, 1)]];
  const opening = [[speakerRoundedRect((t("left") - t("right")) / 2, (t("bottom") - t("top")) / 2,
    c.width - t("left") - t("right") + 2 * inset, c.height - t("top") - t("bottom") + 2 * inset, 2)]];
  const corners = [-1, 1].flatMap(x => [-1, 1].map(y => ({ x: x * (c.width / 2 - 12), y: y * (c.height / 2 - 12), sx: x, sy: y })));
  const tabs = corners.map(({ x, y, sx, sy }) => [[speakerRoundedRect(x + sx * 4, y + sy * 4, 18, 18, 5)]]);
  const frame = clipping.intersection(outer, clipping.union(clipping.difference(outer, opening), ...tabs));
  const polygons = clipping.difference(frame, ...corners.map(({ x, y }) => [[speakerRoundedRect(x, y, 3.6, 3.6, 1.8)]]));
  return (["baffle", "rear"] as const).map(parent => ({
    id: `damping-${parent}`, label: parent === "baffle" ? "Front damping gasket" : "Rear damping gasket",
    width: c.width - 2 * inset, height: c.height - 2 * inset, thickness: c.dampingThickness, polygons,
    position: [0, 0, parent === "baffle" ? c.depth / 2 - t("baffle") + c.dampingThickness / 2 : -c.depth / 2 + t("rear") - c.dampingThickness / 2],
    rotation: [0, 0, 0], explode: [0, 0, parent === "baffle" ? 16 : -28],
  }));
}
