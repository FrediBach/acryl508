// All lengths here use preview units (100 mm). The neutral axis is modelled
// halfway through the sheet; flat patterns include its developed arc length.
export type AccessoryBend = { start: number; length: number; angle: number };
export function bendAngle(value: number | undefined) {
  return Number.isFinite(value) ? Math.min(90, Math.max(0, value!)) : 0;
}
export function bendAllowance(angle: number, thickness: number, clearance = 0.14) {
  const radians = bendAngle(angle) * Math.PI / 180;
  const innerRadius = thickness * 2;
  const length = (innerRadius + thickness / 2) * radians;
  return { angle: radians, innerRadius, length, clearance: radians ? clearance : 0, extra: radians ? clearance + length : 0 };
}

export function bendPoint(x: number, y: number, z: number, depth: number, bends: AccessoryBend[], direction: number) {
  if (!bends.length || y <= bends[0].start) return { x, y, z, angle: 0 };
  let flat = bends[0].start, py = flat, pz = depth / 2, angle = 0;
  for (const bend of bends) {
    const straight = Math.max(0, Math.min(y, bend.start) - flat);
    py += straight * Math.cos(angle); pz += direction * straight * Math.sin(angle);
    if (y <= bend.start) break;
    const arc = Math.min(y - bend.start, bend.length);
    const next = angle + arc / bend.length * bend.angle, radius = bend.length / bend.angle;
    py += radius * (Math.sin(next) - Math.sin(angle));
    pz += direction * radius * (Math.cos(angle) - Math.cos(next));
    angle = next; flat = bend.start + arc;
    if (y <= bend.start + bend.length) break;
  }
  const tail = Math.max(0, y - flat);
  // A gap before a later bend has already been integrated above.
  if (y > bends[bends.length - 1].start + bends[bends.length - 1].length) {
    py += tail * Math.cos(angle); pz += direction * tail * Math.sin(angle);
  }
  const offset = z - depth / 2;
  return { x, y: py - direction * offset * Math.sin(angle), z: pz + offset * Math.cos(angle), angle: direction * angle };
}

export function bendSlices(bends: AccessoryBend[]) {
  return bends.flatMap(bend => {
    const count = Math.max(1, Math.ceil(bend.angle / (Math.PI / 60)));
    return Array.from({ length: count + 1 }, (_, i) => bend.start + bend.length * i / count);
  });
}
