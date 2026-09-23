// Manufacturer SIZE specification and manual: 174 × 79 mm, 20 mm high,
// 20 IDC headers. The generic 18 × 8 × 2 cm shop field is rounded.
// The inlet drawing describes the separate inlet, not the board's mounts.
export const compactPwr = {
  name: "Konstant Lab CompactPWR",
  source: "https://konstantlab.audio/shop/compactpwr-35w-eurorack-power-supply/",
  manual: "https://konstantlab.audio/shop/compactpwr-35w-eurorack-power-supply/?attachment_id=2571&download_file=5c8534d9f9f22",
  photo: "https://konstantlab.audio/wp-content/uploads/2025/03/CompactPWR2.jpg",
  width: 174, length: 79, height: 20,
  headerCount: 20, mountingHoleCount: 4,
  pcbThickness: 1.6, standoffHeight: 5, holeDiameter: 3.2,
  holeColumns: [-83, 83], holeRows: [-34.5, 34.5],
  geometryStatus: "photo-estimate",
  accuracy: "174 × 79 × 20 mm from the manufacturer SIZE specification. Four corner mounting centres are estimated from the top photo, approximately 4 mm from the short edges and 5 mm from the long edges. Ø3.2 mm screw holes, 1.6 mm PCB thickness, 5 mm standoffs and component dimensions are assumptions; verify against hardware before drilling.",
  mounting: "Manufacturer supplies screws and spacers but does not dimension their positions, diameter or height. Preview uses four insulating standoffs and washers; verify the mounting stack and electrical clearances.",
} as const;

// PCB/base-local millimetres: X right, Y rear, origin at the board centre.
export const compactPwrHoles = compactPwr.holeRows.flatMap(y => compactPwr.holeColumns.map(x => ({ x, y })));
export const compactPwrHeaders = [-24.5, 24.5].flatMap(y => Array.from({ length: 10 }, (_, i) => ({ x: -75 + i * 13, y })));

export function compactPwrPlacement(innerWidth: number, innerLength: number, depth: number) {
  return { x: 0, y: 0, rotation: 0,
    fits: innerWidth >= compactPwr.width && innerLength >= compactPwr.length
      && depth >= compactPwr.standoffHeight + compactPwr.height,
    availableWidth: innerWidth, availableLength: innerLength,
    moduleClearance: depth - compactPwr.standoffHeight - compactPwr.height };
}
