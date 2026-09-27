export interface ExampleSynthControlLayout {
  kind: "keyboard" | "desktop";
  panel: { x: number; z: number; width: number; depth: number };
}

export interface ExampleSynthControls {
  sections: { id: string; name: string; x: number; z: number; width: number; depth: number; color: string }[];
  knobs: { id: string; x: number; z: number; radius: number; label: string; value: number }[];
  jacks: { id: string; x: number; z: number; label: string; direction: "input" | "output" }[];
  buttons: { id: string; x: number; z: number; width: number; depth: number; label: string; lit: boolean }[];
  patches: { from: string; to: string; color: string }[];
}

const sections = [
  { id: "osc", name: "OSCILLATORS", color: "#b59b54", labels: ["FREQUENCY", "WAVE", "OCTAVE", "PULSE", "DETUNE", "LEVEL"] },
  { id: "mod", name: "MODULATION", color: "#658b9c", labels: ["RATE", "WAVE", "AMOUNT", "GLIDE", "CLOCK", "DIVISION"] },
  { id: "filter", name: "FILTER", color: "#54887e", labels: ["CUTOFF", "RESONANCE", "DRIVE", "ENV AMT", "KEY TRACK", "MIX"] },
  { id: "env", name: "ENVELOPES", color: "#b77867", labels: ["ATTACK", "DECAY", "SUSTAIN", "RELEASE", "AMOUNT", "VELOCITY"] },
  { id: "output", name: "OUTPUT / DELAY", color: "#777e82", labels: ["VOLUME", "TIME", "FEEDBACK", "MIX", "SPREAD", "LEVEL"] },
] as const;

const patchSockets: { id: string; label: string; direction: "input" | "output" }[] = [
  { id: "vco-out", label: "VCO OUT", direction: "output" },
  { id: "vcf-in", label: "VCF IN", direction: "input" },
  { id: "vcf-out", label: "VCF OUT", direction: "output" },
  { id: "lfo-out", label: "LFO", direction: "output" },
  { id: "cutoff-cv", label: "CUTOFF CV", direction: "input" },
  { id: "vca-in", label: "VCA IN", direction: "input" },
  { id: "env-out", label: "ENV", direction: "output" },
  { id: "vca-cv", label: "VCA CV", direction: "input" },
  { id: "audio-out", label: "AUDIO OUT", direction: "output" },
  { id: "gate-in", label: "GATE", direction: "input" },
  { id: "pitch-in", label: "PITCH CV", direction: "input" },
  { id: "clock-in", label: "CLOCK", direction: "input" },
];

/** Control coordinates are absolute synth-local millimetres; negative z is the rear. */
export function createExampleSynthControls(layout: ExampleSynthControlLayout): ExampleSynthControls {
  const result: ExampleSynthControls = { sections: [], knobs: [], jacks: [], buttons: [], patches: [] };
  const { x, z, width, depth } = layout.panel;
  if (![x, z, width, depth].every(Number.isFinite) || width < 100 || depth < 70) return result;

  const left = x - width / 2 + 6;
  const rear = z - depth / 2;
  const front = z + depth / 2;
  const sectionRear = rear + 15;
  const innerWidth = width - 12;

  function addKnobs(section: ExampleSynthControls["sections"][number], labels: readonly string[], frontLimit: number) {
    const columns = section.width >= 44 ? 2 : 1;
    const radius = section.width >= 70 ? 7 : section.width >= 44 ? 6 : 5;
    const firstZ = sectionRear + 17 + radius;
    const rowPitch = radius * 2 + 14;
    const rowCount = Math.min(3, Math.max(0, Math.floor((frontLimit - radius - firstZ) / rowPitch) + 1));
    for (let row = 0; row < rowCount; row += 1) for (let col = 0; col < columns; col += 1) {
      const index = row * columns + col;
      if (index >= labels.length) continue;
      result.knobs.push({
        id: `${section.id}-${index}`,
        x: section.x + (col - (columns - 1) / 2) * Math.min(34, section.width / columns),
        z: firstZ + row * rowPitch,
        radius,
        label: labels[index],
        value: [0.43, 0.62, 0.28, 0.76, 0.36, 0.55][index],
      });
    }
  }

  if (layout.kind === "keyboard") {
    const gap = 4;
    const sectionWidth = (innerWidth - gap * 4) / 5;
    const sectionFront = Math.min(front - 6, sectionRear + 175);
    const jackZ = sectionFront - 7;
    sections.forEach((definition, index) => {
      const section = { id: definition.id, name: definition.name, color: definition.color,
        x: left + sectionWidth / 2 + index * (sectionWidth + gap), z: (sectionRear + sectionFront) / 2,
        width: sectionWidth, depth: sectionFront - sectionRear };
      result.sections.push(section);
      addKnobs(section, definition.labels, jackZ - 13);
      const ids = [
        ["vco-out", "pitch-in"], ["lfo-out", "clock-in"], ["vcf-in", "cutoff-cv", "vcf-out"],
        ["env-out", "gate-in"], ["vca-in", "vca-cv", "audio-out"],
      ][index];
      ids.forEach((id, socketIndex) => {
        const socket = patchSockets.find(candidate => candidate.id === id)!;
        result.jacks.push({ ...socket, x: section.x + (socketIndex - (ids.length - 1) / 2) * Math.min(20, (sectionWidth - 12) / (ids.length - 1)), z: jackZ });
      });
    });
  } else {
    const bayWidth = Math.min(66, Math.max(50, innerWidth * 0.24));
    const controlsWidth = innerWidth - bayWidth - 5;
    const sectionFront = Math.min(front - 22, sectionRear + 128);
    const definitions = controlsWidth >= 130 ? [sections[0], sections[2], sections[3], sections[1]] : [sections[0], sections[2], sections[3]];
    const gap = 3;
    const sectionWidth = (controlsWidth - gap * (definitions.length - 1)) / definitions.length;
    definitions.forEach((definition, index) => {
      const section = { id: definition.id, name: sectionWidth < 38 ? ({ osc: "VCO", filter: "VCF", env: "ENV", mod: "LFO" } as Record<string, string>)[definition.id] : definition.name,
        color: definition.color, x: left + sectionWidth / 2 + index * (sectionWidth + gap),
        z: (sectionRear + sectionFront) / 2, width: sectionWidth, depth: sectionFront - sectionRear };
      result.sections.push(section);
      addKnobs(section, definition.labels, sectionFront - 3);
    });
    const bayX = left + innerWidth - bayWidth / 2;
    result.sections.push({ id: "patch", name: "PATCH BAY", color: "#777e82", x: bayX,
      z: (sectionRear + sectionFront) / 2, width: bayWidth, depth: sectionFront - sectionRear });
    const firstJackZ = sectionRear + 17;
    const jackPitch = Math.min(17, (sectionFront - 5 - firstJackZ) / 3);
    if (jackPitch >= 11.5) patchSockets.forEach((socket, index) => {
      result.jacks.push({ ...socket, x: bayX + (index % 3 - 1) * (bayWidth - 16) / 2, z: firstJackZ + Math.floor(index / 3) * jackPitch });
    });
    const buttonCount = width >= 240 ? 13 : 8;
    const buttonPitch = Math.min(18, innerWidth / buttonCount);
    const buttonZ = Math.min(front - 9, sectionFront + 13);
    for (let index = 0; index < buttonCount; index += 1) result.buttons.push({
      id: `step-${index + 1}`, x: x + (index - (buttonCount - 1) / 2) * buttonPitch, z: buttonZ,
      width: Math.min(10, buttonPitch - 4), depth: 7, label: `${index + 1}`,
      lit: index === 0 || index === 4 || index === 7,
    });
  }

  const sockets = new Set(result.jacks.map(jack => jack.id));
  for (const patch of [
    { from: "vco-out", to: "vcf-in", color: "#ca854d" },
    { from: "lfo-out", to: "cutoff-cv", color: "#628f9f" },
    { from: "env-out", to: "vca-cv", color: "#d4bd6c" },
    { from: "vcf-out", to: "vca-in", color: "#b9655c" },
  ]) if (sockets.has(patch.from) && sockets.has(patch.to)) result.patches.push(patch);

  return result;
}
