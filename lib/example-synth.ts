/** Illustrative analog instruments; all dimensions and positions are millimetres. */
export type ExampleSynthLayout = {
  width: number;
  depth: number;
  height: number;
  kind: "keyboard" | "desktop";
  keyCount: number;
  whiteKeyPitch: number;
  cheekWidth: number;
  controlHeight: number;
  panelTop: number;
  frontTop: number;
  panel: { x: number; z: number; width: number; depth: number };
  keys: {
    midi: number;
    black: boolean;
    x: number;
    y: number;
    z: number;
    width: number;
    height: number;
    depth: number;
  }[];
  /** Wheels rotate around X, so their radius extends along both Y and Z. */
  wheels: { x: number; y: number; z: number; radius: number; width: number }[];
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const dimension = (value: number, min: number, max: number, fallback: number) => clamp(Number.isFinite(value) ? value : fallback, min, max);
const blackPitchClasses = new Set([1, 3, 6, 8, 10]);
const isBlack = (midi: number) => blackPitchClasses.has(midi % 12);
const firstNote = (count: number) => count === 88 ? 21 : 48;
const whiteCount = (count: number) => Array.from({ length: count }, (_, index) => firstNote(count) + index).filter(midi => !isBlack(midi)).length;
const standardKeyCounts = [88, 73, 61, 49, 37, 32, 25];

/**
 * Infer a plausible instrument from its envelope, not a specific product.
 * Keep full-size keys at a fixed pitch; spare width becomes case margins.
 * Z=0 is the front edge, Y=0 is the underside, and X=0 is the centre.
 */
export function createExampleSynthLayout(inputWidth: number, inputDepth: number, inputHeight: number): ExampleSynthLayout {
  const width = dimension(inputWidth, 180, 1400, 550);
  const depth = dimension(inputDepth, 120, 600, 280);
  const height = dimension(inputHeight, 20, 200, 70);
  const cheekWidth = clamp(width * 0.022, 10, 18);
  const whiteKeyPitch = 23.5;
  const edgeGap = 6;
  const wheelBayWidth = 60;
  const insideWidth = width - 2 * (cheekWidth + edgeGap);
  const keyCount = depth >= 235
    ? standardKeyCounts.find(count => whiteCount(count) * whiteKeyPitch + wheelBayWidth <= insideWidth) ?? 0
    : 0;
  const kind = keyCount ? "keyboard" : "desktop";
  // Knob and socket relief is part of the user's height, even for thin devices.
  const controlHeight = Math.min(16, height * 0.24);
  const panelTop = height - controlHeight;
  const frontTop = keyCount ? height * 0.38 : panelTop;
  const frontGap = 8;
  const keyDepth = clamp(depth * 0.46, 120, 145);
  const panelFront = keyCount ? -(frontGap + keyDepth + 8) : -8;
  const panelRear = -depth + 8;
  const panel = { x: 0, z: (panelFront + panelRear) / 2, width: insideWidth, depth: panelFront - panelRear };
  const keys: ExampleSynthLayout["keys"] = [];
  const wheels: ExampleSynthLayout["wheels"] = [];

  if (keyCount) {
    const keyboardWidth = whiteCount(keyCount) * whiteKeyPitch;
    const spareWidth = insideWidth - keyboardWidth - wheelBayWidth;
    const wheelBayLeft = -width / 2 + cheekWidth + edgeGap + spareWidth / 2;
    const keyLeft = wheelBayLeft + wheelBayWidth;
    const whiteHeight = Math.min(8, height * 0.12);
    const blackHeight = Math.min(10, height * 0.16);
    const whiteTop = frontTop + whiteHeight;
    const blackDepth = keyDepth * 0.61;
    let whites = 0;
    for (let index = 0; index < keyCount; index += 1) {
      const midi = firstNote(keyCount) + index;
      const black = isBlack(midi);
      keys.push({
        midi,
        black,
        x: keyLeft + (black ? whites : whites + 0.5) * whiteKeyPitch,
        y: black ? whiteTop + blackHeight / 2 : frontTop + whiteHeight / 2,
        z: black ? -frontGap - keyDepth + blackDepth / 2 : -frontGap - keyDepth / 2,
        width: black ? 13.5 : whiteKeyPitch - 1,
        height: black ? blackHeight : whiteHeight,
        depth: black ? blackDepth : keyDepth,
      });
      if (!black) whites += 1;
    }
    const radius = Math.min(16, height * 0.22);
    for (const offset of [20, 40]) wheels.push({
      x: wheelBayLeft + offset,
      y: Math.max(radius, frontTop + whiteHeight / 2),
      z: -frontGap - keyDepth * 0.51,
      radius,
      width: 10,
    });
  }

  return { width, depth, height, kind, keyCount, whiteKeyPitch, cheekWidth, controlHeight, panelTop, frontTop, panel, keys, wheels };
}
