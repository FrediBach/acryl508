// Befaco's product page specifies 423 × 80 mm; the setup drawing labels
// 435 mm with an arrow extending to the projecting connector. Treating the
// extra 12 mm as connector projection is an inference, not a mechanical drawing.
export const trolleyBus = {
  name: "Befaco Trolley Bus",
  source: "https://www.befaco.org/trolley-bus/",
  manual: "https://www.befaco.org/docs/Trolley_bus/Assembled_Trolley_Bus_User_Manual.pdf",
  photo: "https://www.befaco.org/wp-content/uploads/2023/05/troleybus_top_web.png",
  width: 423, length: 80, height: 25, lowProfileHeight: 15,
  installationWidth: 435, connectorProjection: 12,
  headerCount: 28, mountingHoleCount: 8,
  // Photo estimates and chosen screw-mount preview assumptions.
  pcbLength: 60, pcbThickness: 1.6, standoffHeight: 5,
  holeDiameter: 3.2,
  holeColumns: [-207.5, -119, 0, 207.5], holeRows: [-24, 24],
  geometryStatus: "photo-estimate",
  mounting: "User-selected screw-mount adaptation; Befaco specifies adhesive PCB fasteners. Verify support positions, screw size and insulation against hardware.",
  accuracy: "423 × 80 mm product-page dimensions; 435 mm installation width from setup manual. The extra 12 mm is modelled as a right-side connector projection (inferred). Eight PCB mounting centres are photo-derived estimates; Ø3.2 mm screw holes, 1.6 mm PCB and 5 mm standoffs are assumptions. Cover screws are not case mounts. Verify before drilling.",
} as const;

// PCB-local millimetres: X right, Y toward rear. Four unevenly spaced columns.
export const trolleyHoles = trolleyBus.holeRows.flatMap(y => trolleyBus.holeColumns.map(x => ({ x, y })));
export const trolleyHeaders = [-35, 35].flatMap(y => Array.from({ length: 14 }, (_, i) => ({ x: -193 + i * 29.7, y })));
export const trolleyCover = { x: 118, width: 134, length: 56, screwXs: [55, 181] } as const;

export function trolleyPlacement(innerWidth: number, innerLength: number, depth: number) {
  // Centre the complete installation envelope, including the inferred plug.
  return { x: -trolleyBus.connectorProjection / 2, y: 0, rotation: 0,
    fits: innerWidth >= trolleyBus.installationWidth && innerLength >= trolleyBus.length
      && depth >= trolleyBus.standoffHeight + trolleyBus.height,
    availableWidth: innerWidth, availableLength: innerLength,
    moduleClearance: depth - trolleyBus.standoffHeight - trolleyBus.height };
}

export function trolleyMountingHoles() {
  return trolleyHoles.map(({ x, y }) => ({ x: x - trolleyBus.connectorProjection / 2, y }));
}
