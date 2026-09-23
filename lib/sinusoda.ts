// Source: docs/sinusoda_data_sheet_juice_v23_2.pdf, pp. 1–2.
// The document identifies the hardware as v22.4 (despite its filename).
// Only the overall envelope, counts and pin pitch are dimensioned. Everything
// digitized from Figure 1 is explicitly approximate, never a measured drawing.
export const sinusodaJuice = {
  name: "Sinusoda Juice",
  source: "docs/sinusoda_data_sheet_juice_v23_2.pdf",
  hardwareRevision: "v22.4",
  width: 226, length: 86, height: 19,
  headerCount: 23, mountingHoleCount: 28, minimumScrews: 14,
  pinPitch: 2.54,
  // Preview assumptions; neither PCB thickness nor mounting stack is specified.
  pcbThickness: 1.6, standoffHeight: 5,
  holeDiameter: 3.2,
  holeColumns: [-103, -68.7, -34.3, 0, 34.3, 68.7, 103],
  holeRows: [-39, -20, 20, 39],
  geometryStatus: "photo-estimate",
} as const;

// Board-local millimetres: X right, Y toward the rear; origin at PCB centre.
export const sinusodaHoles = sinusodaJuice.holeRows.flatMap(y => sinusodaJuice.holeColumns.map(x => ({ x, y })));
export const sinusodaHeaders = [-29, 29].flatMap(y =>
  [-95, -78, -61, -44, -27, 7, 24, 41, 58, 75, 92].map(x => ({ x, y }))).concat([{ x: 105, y: 0 }]);

export function sinusodaPlacement(innerWidth: number, innerLength: number, depth: number) {
  const fits = innerWidth >= sinusodaJuice.width && innerLength >= sinusodaJuice.length
    && depth >= sinusodaJuice.standoffHeight + sinusodaJuice.height;
  return { x: 0, y: 0, rotation: 0, fits,
    availableWidth: innerWidth, availableLength: innerLength,
    moduleClearance: depth - sinusodaJuice.standoffHeight - sinusodaJuice.height };
}
