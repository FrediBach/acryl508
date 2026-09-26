import { sheetThickness } from "./sheet-materials";
import type { SpeakerConfiguration } from "./speaker";

export const speakerAcousticSources = {
  compliance: "https://doc.comsol.com/6.3/doc/com.comsol.help.aco/aco_ug_pressure.05.031.html",
  modes: "https://doc.comsol.com/6.4/doc/com.comsol.help.models.mph.eigenmodes_of_room/eigenmodes_of_room.html",
};
export type AcousticChamber = { width: number; height: number; depth: number; grossLitres: number };
/** Empty rectangular chamber, mm. Deliberately cheap enough for live sliders;
 * do not regenerate grille holes or donor meshes for acoustic feedback. */
export function speakerAcousticChamber(c: SpeakerConfiguration): AcousticChamber {
  const width = c.width - sheetThickness(c, "left") - sheetThickness(c, "right");
  const height = c.height - sheetThickness(c, "top") - sheetThickness(c, "bottom");
  const depth = c.depth - sheetThickness(c, "baffle") - sheetThickness(c, "rear") + (c.damping ? 2 * c.dampingThickness : 0);
  return { width, height, depth, grossLitres: width * height * depth / 1e6 };
}
export function speakerAcousticComparison(current: AcousticChamber, reference: AcousticChamber, displacementLitres = 0) {
  const currentLitres = current.grossLitres - displacementLitres, referenceLitres = reference.grossLitres - displacementLitres;
  if (!Number.isFinite(displacementLitres) || displacementLitres < 0 || ![currentLitres, referenceLitres].every(v => Number.isFinite(v) && v > 0)) {
    throw new Error("Hardware displacement must leave positive air volume in both enclosures.");
  }
  // C_air = V/(rho*c²). For unchanged moving mass, ignoring radiator suspension,
  // f/f_ref = sqrt(V_ref/V). This is an air-spring-only tendency, not PR-system
  // tuning, F3, SPL, or an EQ/driver frequency response.
  const volumeRatio = currentLitres / referenceLitres;
  const modes = (["width", "height", "depth"] as const).map(axis => ({
    axis, currentHz: 343000 / (2 * current[axis]), referenceHz: 343000 / (2 * reference[axis]),
  }));
  return { currentLitres, referenceLitres, volumeRatio, stiffnessRatio: 1 / volumeRatio, tuningRatio: 1 / Math.sqrt(volumeRatio), modes };
}
