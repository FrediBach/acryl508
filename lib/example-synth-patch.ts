import { CubicBezierCurve3, CurvePath, Vector3 } from "three";
import type { ExampleSynthLayout } from "./example-synth";
import type { ExampleSynthControls } from "./example-synth-controls";

/** Gently draped cords with upright plug exits; dimensions are millimetres. */
export function createExampleSynthPatchCurve(
  layout: ExampleSynthLayout,
  controls: ExampleSynthControls,
  patch: ExampleSynthControls["patches"][number],
  index: number,
): CurvePath<Vector3> {
  const from = controls.jacks.find(jack => jack.id === patch.from);
  const to = controls.jacks.find(jack => jack.id === patch.to);
  if (!from || !to) throw new Error("An example synth patch must connect existing sockets.");

  const relief = layout.controlHeight;
  const radius = Math.min(1.15, relief * 0.09);
  const startY = layout.panelTop + relief * 0.56;
  const variation = Number.isFinite(index) ? Math.max(0, Math.floor(index)) % 4 : 0;
  const { panel } = layout;
  const left = panel.x - panel.width / 2 + radius;
  const right = panel.x + panel.width / 2 - radius;
  const rear = panel.z - panel.depth / 2 + radius;
  const front = panel.z + panel.depth / 2 - radius;
  const distance = Math.hypot(to.x - from.x, to.z - from.z);
  // Spread spare cable across the panel instead of squeezing all its slack into
  // the small vertical clearance. Expander cords curl left from their patch bay.
  const offset = layout.kind === "keyboard"
    ? new Vector3(0, 0, -Math.min(8 + distance * (0.12 + variation * 0.012), 45, (Math.min(from.z, to.z) - rear) * 0.55))
    : new Vector3(-Math.min(9 + distance * 0.25 + variation * 2, (Math.min(from.x, to.x) - left) * 0.5), 0, 0);
  if (layout.kind === "desktop") {
    // Same-row sockets also need depth: a sideways-only return would double
    // back along itself. Alternate loops into the available front/rear space.
    const rearRoom = Math.min(from.z, to.z) - rear;
    const frontRoom = front - Math.max(from.z, to.z);
    const towardRear = variation % 2 ? rearRoom > 20 || rearRoom > frontRoom : frontRoom < 20 && rearRoom > frontRoom;
    offset.z = (towardRear ? -1 : 1) * Math.min(9 + distance * 0.18 + variation * 1.5, (towardRear ? rearRoom : frontRoom) * 0.5);
  }
  const point = (t: number, spread: number, elevation: number) => new Vector3(
    from.x + (to.x - from.x) * t + offset.x * spread,
    layout.panelTop + relief * elevation,
    from.z + (to.z - from.z) * t + offset.z * spread,
  );
  const points = [
    new Vector3(from.x, startY, from.z),
    point(0.12 + variation * 0.015, 0.85, 0.83),
    point(0.48 + variation * 0.02, 1, 0.73 + variation * 0.014),
    point(0.88 - variation * 0.01, 0.82 - variation * 0.035, 0.82),
    new Vector3(to.x, startY, to.z),
  ];
  const tangents = points.map((_, i) => {
    if (i === 0) return new Vector3(0, relief * 0.22, 0);
    if (i === points.length - 1) return new Vector3(0, -relief * 0.22, 0);
    const tangent = points[i + 1].clone().sub(points[i - 1]).multiplyScalar(0.15);
    tangent.y = 0;
    return tangent;
  });
  const bounded = (point: Vector3) => point.set(
    Math.max(left, Math.min(right, point.x)), point.y, Math.max(rear, Math.min(front, point.z)),
  );

  // Joined Béziers give the loops raised shoulders and a hanging middle without
  // spline overshoot into the cover, keys, or the protector's contact edges.
  const curve = new CurvePath<Vector3>();
  for (let i = 0; i < points.length - 1; i += 1) curve.add(new CubicBezierCurve3(
    points[i], bounded(points[i].clone().add(tangents[i])),
    bounded(points[i + 1].clone().sub(tangents[i + 1])), points[i + 1],
  ));
  return curve;
}
