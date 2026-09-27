import { CubicBezierCurve3, Vector3 } from "three";
import type { ExampleSynthLayout } from "./example-synth";
import type { ExampleSynthControls } from "./example-synth-controls";

/** A bounded, gently arched cord; coordinates and tube radius are millimetres. */
export function createExampleSynthPatchCurve(
  layout: ExampleSynthLayout,
  controls: ExampleSynthControls,
  patch: ExampleSynthControls["patches"][number],
  index: number,
): CubicBezierCurve3 {
  const from = controls.jacks.find(jack => jack.id === patch.from);
  const to = controls.jacks.find(jack => jack.id === patch.to);
  if (!from || !to) throw new Error("An example synth patch must connect existing sockets.");

  const relief = layout.controlHeight;
  const radius = Math.min(1.15, relief * 0.09);
  const startY = layout.panelTop + relief * 0.56;
  const patchIndex = Number.isFinite(index) ? Math.max(0, index) : 0;
  const crest = Math.min(layout.height - radius, layout.panelTop + relief * (0.77 + patchIndex * 0.025));
  const bow = Math.min(8, Math.abs(to.x - from.x) * 0.1, -radius - Math.max(from.z, to.z));

  // A Bézier curve stays inside its control-point hull. Unlike an interpolating
  // spline, a short plug stem followed by a long cable cannot overshoot height.
  return new CubicBezierCurve3(
    new Vector3(from.x, startY, from.z),
    new Vector3(from.x, crest, from.z + bow),
    new Vector3(to.x, crest, to.z + bow),
    new Vector3(to.x, startY, to.z),
  );
}
