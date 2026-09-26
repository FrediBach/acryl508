// Teufel MYND HMI pad / cover, CC-BY-SA-4.0, pinned source revision in speaker.ts.
// Source XY button axes from the released STEP. Round collars reach ~R8.54;
// R9 cutouts give ~0.46 mm radial clearance. Keep the combined volume rocker.
export const myndControls = {
  depthOrigin: 57.17, buttonSourceY: 56.17,
  // Non-button rubber peaks at source Z=165.789; retain it below the acrylic.
  sheetSourceZ: 166, coverUpperZ: 158.9, coverLowerZ: 156.4,
  pcbCentreZ: 160.5, width: 116, depth: 18,
};
export const myndButtons = [
  { id: "power", x: -49, width: 18, height: 18, radius: 9 },
  { id: "bluetooth", x: -23, width: 18, height: 18, radius: 9 },
  { id: "play-pause", x: 3, width: 18, height: 18, radius: 9 },
  { id: "volume", x: 39, width: 38, height: 18, radius: 9 },
] as const;
