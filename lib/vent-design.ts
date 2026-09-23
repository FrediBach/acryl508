export type VentWaveform = "sine" | "triangle" | "ripple" | "noise" | "taper";
export type VentTarget = "size" | "shift-x" | "shift-y";
export type VentLayer = { waveform: VentWaveform; target: VentTarget; amount: number; frequency: number; phase: number; angle: number };
export type VentDesign = { size: number; seed: number; layers: VentLayer[] };
export const maxVentLayers = 3;
export const defaultVentDesign: VentDesign = { size: 100, seed: 1, layers: [] };
export const ventWaveforms: { value: VentWaveform; label: string }[] = [
  { value: "sine", label: "Sine wave" }, { value: "triangle", label: "Triangle wave" },
  { value: "ripple", label: "Radial ripple" }, { value: "noise", label: "Organic noise" }, { value: "taper", label: "Taper" },
];
export const ventTargets: { value: VentTarget; label: string }[] = [
  { value: "size", label: "Length / size" }, { value: "shift-x", label: "Sideways position" }, { value: "shift-y", label: "Front / rear position" },
];
export const defaultVentLayer: VentLayer = { waveform: "sine", target: "size", amount: 70, frequency: 2, phase: 0, angle: 0 };
export const ventPresets: { id: string; label: string; design: VentDesign }[] = [
  { id: "regular", label: "Regular", design: defaultVentDesign },
  { id: "wave", label: "Wave", design: { size: 60, seed: 1, layers: [defaultVentLayer, { ...defaultVentLayer, target: "shift-y", amount: 80, phase: 90 }] } },
  { id: "ripple", label: "Ripple", design: { size: 55, seed: 1, layers: [{ ...defaultVentLayer, waveform: "ripple", frequency: 3, amount: 85 }] } },
  { id: "weave", label: "Weave", design: { size: 55, seed: 1, layers: [{ ...defaultVentLayer, angle: 35 }, { ...defaultVentLayer, target: "shift-y", angle: 145, phase: 90, amount: 90 }] } },
  { id: "organic", label: "Organic", design: { size: 60, seed: 7, layers: [{ ...defaultVentLayer, waveform: "noise", frequency: 3, amount: 90 }, { ...defaultVentLayer, waveform: "noise", target: "shift-y", frequency: 2, phase: 120, amount: 75 }] } },
];
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const bounded = (value: unknown, fallback: number, min: number, max: number) => typeof value === "number" && Number.isFinite(value) ? clamp(value, min, max) : fallback;

export function normalizeVentDesign(design?: Partial<VentDesign>): VentDesign {
  return {
    size: bounded(design?.size, 100, 0, 100), seed: Math.round(bounded(design?.seed, 1, 1, 9999)),
    layers: (Array.isArray(design?.layers) ? design.layers : []).slice(0, maxVentLayers).map(layer => ({
      waveform: ventWaveforms.some(wave => wave.value === layer?.waveform) ? layer.waveform : "sine",
      target: ventTargets.some(target => target.value === layer?.target) ? layer.target : "size",
      amount: bounded(layer?.amount, 0, -100, 100), frequency: bounded(layer?.frequency, 2, 0.25, 6),
      phase: bounded(layer?.phase, 0, 0, 360), angle: bounded(layer?.angle, 0, 0, 180),
    })),
  };
}

// Smooth deterministic noise; the exported seed reproduces the same pattern.
function noise(x: number, y: number, seed: number) {
  const hash = (a: number, b: number) => {
    const value = Math.sin(a * 127.1 + b * 311.7 + seed * 74.7) * 43758.5453;
    return (value - Math.floor(value)) * 2 - 1;
  };
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const bottom = hash(ix, iy) * (1 - sx) + hash(ix + 1, iy) * sx;
  const top = hash(ix, iy + 1) * (1 - sx) + hash(ix + 1, iy + 1) * sx;
  return bottom * (1 - sy) + top * sy;
}

export function sampleVentField(layer: VentLayer, x: number, y: number, seed: number) {
  const angle = layer.angle * Math.PI / 180;
  const u = x * Math.cos(angle) + y * Math.sin(angle), v = -x * Math.sin(angle) + y * Math.cos(angle);
  const phase = layer.phase / 360;
  const cycle = (layer.waveform === "ripple" ? Math.hypot(x, y) : u) * layer.frequency + phase;
  if (layer.waveform === "noise") return noise(u * layer.frequency + phase * 4, v * layer.frequency + phase * 4, seed);
  if (layer.waveform === "taper") return 1 - 2 * Math.abs(2 * (cycle - Math.floor(cycle)) - 1);
  const wave = Math.sin(cycle * Math.PI * 2);
  return layer.waveform === "triangle" ? Math.asin(wave) * 2 / Math.PI : wave;
}
