export type PresentationPose = { radius: number; phi: number; theta: number };

// Irrational frequency ratios keep elevation and distance out of sync with
// the orbit, so successive revolutions reveal different viewing angles.
export function presentationPose(start: PresentationPose, seconds: number): PresentationPose {
  const t = Math.max(0, seconds);
  const phase = (Math.PI * 2 / 36) * (t - 1.5 * (1 - Math.exp(-t / 1.5)));
  const progress = Math.min(1, t / 3);
  const blend = progress * progress * (3 - 2 * progress);
  const elevation = 0.58 + 0.27 * Math.sin(phase * Math.SQRT2) + 0.1 * Math.sin(phase * Math.sqrt(3));
  return {
    theta: start.theta + phase,
    phi: start.phi + (Math.PI / 2 - elevation - start.phi) * blend,
    radius: start.radius * (1 + blend * 0.06 * (1 - Math.cos(phase / Math.sqrt(5)))),
  };
}
