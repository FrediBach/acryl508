/** Illustrative, unbranded modules. Dimensions and control positions are millimetres. */
export type ExampleModuleDefinition = {
  id: string;
  name: string;
  subtitle: string;
  hp: number;
  units: 1 | 3;
  panelColor: string;
  inkColor: string;
  accentColor: string;
  knobs: { x: number; z: number; radius: number; label: string; value: number }[];
  jacks: {
    id: string;
    x: number;
    z: number;
    label: string;
    direction: "input" | "output";
    signal: "audio" | "cv" | "gate";
  }[];
  switches?: { x: number; z: number; label: string }[];
  display?: { x: number; z: number; width: number; height: number; text: string };
  blank?: boolean;
};

export type ExampleModulePlacement = {
  id: string;
  definition: ExampleModuleDefinition;
  startHp: number;
};

export type ExamplePatchCable = {
  id: string;
  from: { moduleId: string; jackId: string };
  to: { moduleId: string; jackId: string };
  color: string;
};

type Knob = ExampleModuleDefinition["knobs"][number];
type Jack = ExampleModuleDefinition["jacks"][number];

const silver = { panelColor: "#c9cbd0", inkColor: "#20262d", accentColor: "#d27639" };
const charcoal = { panelColor: "#252a30", inkColor: "#ece9de", accentColor: "#e4b857" };
const cream = { panelColor: "#d9d3bd", inkColor: "#303431", accentColor: "#7d9b7b" };
const blue = { panelColor: "#354d60", inkColor: "#e2e9eb", accentColor: "#e19e68" };
const knob = (x: number, z: number, label: string, radius = 5.5, value = 0.5): Knob => ({ x, z, label, radius, value });
const jack = (id: string, x: number, z: number, label: string, direction: Jack["direction"], signal: Jack["signal"]): Jack => ({ id, x, z, label, direction, signal });
const input = (id: string, x: number, z: number, label: string, signal: Jack["signal"] = "audio") => jack(id, x, z, label, "input", signal);
const output = (id: string, x: number, z: number, label: string, signal: Jack["signal"] = "audio") => jack(id, x, z, label, "output", signal);
const module3 = (id: string, name: string, subtitle: string, hp: number, style: typeof silver, knobs: Knob[], jacks: Jack[], extra: Partial<Pick<ExampleModuleDefinition, "switches" | "display">> = {}): ExampleModuleDefinition => ({ id, name, subtitle, hp, units: 3, ...style, knobs, jacks, ...extra });
const module1 = (id: string, name: string, subtitle: string, hp: number, style: typeof silver, knobs: Knob[], jacks: Jack[]): ExampleModuleDefinition => ({ id, name, subtitle, hp, units: 1, ...style, knobs, jacks });

export const exampleModuleCatalog: ExampleModuleDefinition[] = [
  module3("vco-6", "VCO", "ANALOG", 6, silver,
    [knob(0, -29, "TUNE", 8, 0.42), knob(0, -5, "FINE", 5, 0.52)],
    [input("pitch", -7, 22, "1V/O", "cv"), input("fm", 7, 22, "FM", "cv"), output("saw", -7, 43, "SAW"), output("pulse", 7, 43, "PULSE")]),
  module3("vco-8", "VCO", "ANALOG OSC", 8, silver,
    [knob(0, -29, "TUNE", 9, 0.42), knob(-10, -4, "FINE", 5, 0.54), knob(10, -4, "PW", 5, 0.6)],
    [input("pitch", -10, 22, "1V/O", "cv"), input("fm", 10, 22, "FM", "cv"), output("saw", -10, 43, "SAW"), output("pulse", 10, 43, "PULSE")]),
  module3("vco-12", "VCO", "PRECISION OSCILLATOR", 12, silver,
    [knob(-12, -28, "COARSE", 10, 0.38), knob(14, -28, "FINE", 6, 0.52), knob(-13, -1, "FM", 6, 0.25), knob(13, -1, "WIDTH", 6, 0.57)],
    [input("pitch", -19, 23, "1V/O", "cv"), input("fm", 0, 23, "FM", "cv"), input("sync", 19, 23, "SYNC", "gate"), output("saw", -19, 44, "SAW"), output("pulse", 0, 44, "PULSE"), output("sine", 19, 44, "SINE")]),
  module3("vcf-6", "VCF", "LOW PASS", 6, charcoal,
    [knob(0, -28, "CUTOFF", 8, 0.62), knob(0, -3, "RES", 5, 0.35)],
    [input("in", -7, 22, "IN"), input("fm", 7, 22, "FM", "cv"), output("out", 0, 43, "LP")]),
  module3("vcf-8", "VCF", "MULTIMODE", 8, charcoal,
    [knob(0, -29, "CUTOFF", 9, 0.61), knob(-10, -3, "RES", 5, 0.32), knob(10, -3, "FM", 5, 0.4)],
    [input("in", -10, 22, "IN"), input("fm", 10, 22, "FM", "cv"), output("out", -10, 43, "LP"), output("bp", 10, 43, "BP")]),
  module3("vcf-10", "VCF", "STATE VARIABLE", 10, charcoal,
    [knob(-10, -27, "CUTOFF", 10, 0.6), knob(13, -27, "RES", 6, 0.31), knob(-12, 0, "DRIVE", 5.5, 0.23), knob(12, 0, "FM", 5.5, 0.38)],
    [input("in", -15, 23, "IN"), input("fm", 0, 23, "FM", "cv"), input("pitch", 15, 23, "1V/O", "cv"), output("out", -15, 44, "LP"), output("bp", 0, 44, "BP"), output("hp", 15, 44, "HP")]),
  module3("vca-4", "VCA", "LIN", 4, cream,
    [knob(0, -25, "GAIN", 6, 0.73)],
    [input("in", 0, 4, "IN"), input("cv", 0, 25, "CV", "cv"), output("out", 0, 45, "OUT")]),
  module3("vca-6", "VCA", "VOLTAGE AMP", 6, cream,
    [knob(0, -27, "GAIN", 8, 0.65), knob(0, -3, "BIAS", 5, 0.18)],
    [input("in", -7, 22, "IN"), input("cv", 7, 22, "CV", "cv"), output("out", 0, 43, "OUT")]),
  module3("vca-8", "VCA", "DUAL AMPLIFIER", 8, cream,
    [knob(-10, -27, "LEVEL 1", 6, 0.71), knob(10, -27, "LEVEL 2", 6, 0.53)],
    [input("in", -10, 0, "IN 1"), input("in2", 10, 0, "IN 2"), input("cv", -10, 22, "CV 1", "cv"), input("cv2", 10, 22, "CV 2", "cv"), output("out", -10, 44, "OUT 1"), output("out2", 10, 44, "OUT 2")]),
  module3("lfo-4", "LFO", "CYCLE", 4, blue,
    [knob(0, -25, "RATE", 6, 0.3)],
    [input("reset", 0, 3, "RST", "gate"), output("out", 0, 24, "SINE", "cv"), output("square", 0, 45, "SQR", "gate")]),
  module3("lfo-6", "LFO", "MODULATION", 6, blue,
    [knob(0, -27, "RATE", 8, 0.3), knob(0, -3, "SHAPE", 5, 0.42)],
    [input("reset", -7, 22, "RST", "gate"), input("rate", 7, 22, "RATE", "cv"), output("out", -7, 43, "SINE", "cv"), output("square", 7, 43, "SQR", "gate")]),
  module3("lfo-8", "LFO", "DUAL MODULATOR", 8, blue,
    [knob(-10, -25, "RATE A", 7, 0.31), knob(10, -25, "RATE B", 7, 0.2)],
    [input("reset", -10, 4, "RESET", "gate"), input("rate", 10, 4, "RATE", "cv"), output("out", -10, 24, "SIN A", "cv"), output("out2", 10, 24, "SIN B", "cv"), output("square", -10, 44, "CLK A", "gate"), output("square2", 10, 44, "CLK B", "gate")]),
  module3("env-6", "ENV", "AD ENVELOPE", 6, silver,
    [knob(0, -28, "ATTACK", 7, 0.19), knob(0, -3, "DECAY", 7, 0.48)],
    [input("gate", -7, 22, "GATE", "gate"), input("cv", 7, 22, "TIME", "cv"), output("out", 0, 43, "ENV", "cv")]),
  module3("env-8", "ADSR", "ENVELOPE", 8, silver,
    [knob(-10, -28, "ATTACK", 6, 0.15), knob(10, -28, "DECAY", 6, 0.43), knob(-10, -3, "SUSTAIN", 6, 0.63), knob(10, -3, "RELEASE", 6, 0.36)],
    [input("gate", -10, 23, "GATE", "gate"), input("retrigger", 10, 23, "TRIG", "gate"), output("out", 0, 44, "ENV", "cv")]),
  module3("env-10", "ADSR", "VOLTAGE ENVELOPE", 10, silver,
    [knob(-13, -28, "ATTACK", 6, 0.19), knob(13, -28, "DECAY", 6, 0.43), knob(-13, -3, "SUSTAIN", 6, 0.62), knob(13, -3, "RELEASE", 6, 0.35)],
    [input("gate", -15, 23, "GATE", "gate"), input("retrigger", 0, 23, "TRIG", "gate"), input("cv", 15, 23, "TIME", "cv"), output("out", -15, 44, "ENV", "cv"), output("inverse", 0, 44, "INV", "cv"), output("end", 15, 44, "END", "gate")]),
  module3("seq-12", "SEQ", "6 STEP SEQUENCER", 12, charcoal,
    [knob(-18, -8, "1", 4.5, 0.33), knob(0, -8, "2", 4.5, 0.5), knob(18, -8, "3", 4.5, 0.65), knob(-18, 11, "4", 4.5, 0.43), knob(0, 11, "5", 4.5, 0.72), knob(18, 11, "6", 4.5, 0.55)],
    [input("clock", -18, 43, "CLK", "gate"), output("pitch", 0, 43, "CV", "cv"), output("gate", 18, 43, "GATE", "gate")],
    { display: { x: 0, z: -32, width: 34, height: 11, text: "03 / 06" } }),
  module3("seq-16", "SEQUENCER", "8 STEP ANALOG", 16, charcoal,
    [knob(-27, -8, "1", 5, 0.3), knob(-9, -8, "2", 5, 0.47), knob(9, -8, "3", 5, 0.68), knob(27, -8, "4", 5, 0.5), knob(-27, 14, "5", 5, 0.39), knob(-9, 14, "6", 5, 0.73), knob(9, 14, "7", 5, 0.57), knob(27, 14, "8", 5, 0.42)],
    [input("clock", -27, 44, "CLOCK", "gate"), input("reset", -9, 44, "RESET", "gate"), output("pitch", 9, 44, "CV", "cv"), output("gate", 27, 44, "GATE", "gate")],
    { display: { x: 0, z: -33, width: 40, height: 11, text: "03  •  120" } }),
  module3("mixer-6", "MIX", "3 CHANNEL", 6, cream,
    [knob(0, -29, "LEVEL 1", 6, 0.72), knob(0, -8, "LEVEL 2", 6, 0.51), knob(0, 12, "LEVEL 3", 5, 0.3)],
    [input("in", -7, 29, "1"), input("in2", 7, 29, "2"), input("in3", -7, 46, "3"), output("out", 7, 46, "MIX")]),
  module3("mixer-8", "MIXER", "AUDIO MIXER", 8, cream,
    [knob(-10, -26, "CH 1", 6, 0.7), knob(10, -26, "CH 2", 6, 0.48), knob(-10, -2, "CH 3", 6, 0.3), knob(10, -2, "MASTER", 6, 0.67)],
    [input("in", -10, 23, "1"), input("in2", 10, 23, "2"), input("in3", -10, 44, "3"), output("out", 10, 44, "MIX")]),
  module3("output-4", "OUT", "MONO", 4, charcoal,
    [knob(0, -24, "LEVEL", 6, 0.65)],
    [input("in", 0, 4, "IN"), output("out", 0, 25, "LINE"), output("phones", 0, 45, "PHONES")]),
  module3("output-6", "OUTPUT", "MONITOR", 6, charcoal,
    [knob(0, -26, "LEVEL", 8, 0.65), knob(0, -2, "PHONES", 5.5, 0.43)],
    [input("in", -7, 22, "L / M"), input("right", 7, 22, "R"), output("out", -7, 43, "LINE"), output("phones", 7, 43, "PHONES")]),
  module3("delay-14", "DELAY", "TAPE ECHO", 14, blue,
    [knob(-17, -27, "TIME", 9, 0.43), knob(17, -27, "FEEDBACK", 9, 0.35), knob(-21, 0, "TONE", 5.5, 0.6), knob(0, 0, "WOW", 5.5, 0.25), knob(21, 0, "MIX", 5.5, 0.32)],
    [input("in", -23, 25, "IN"), input("time", 0, 25, "TIME", "cv"), input("mix", 23, 25, "MIX", "cv"), output("out", -12, 45, "LEFT"), output("right", 12, 45, "RIGHT")]),
  module3("noise-4", "NOISE", "SOURCE", 4, silver, [],
    [output("white", 0, -24, "WHITE"), output("pink", 0, 0, "PINK"), input("clock", 0, 23, "TRIG", "gate"), output("out", 0, 45, "S&H", "cv")]),
  module3("slew-8", "SLEW", "FUNCTION", 8, cream,
    [knob(-10, -26, "RISE", 7, 0.3), knob(10, -26, "FALL", 7, 0.53)],
    [input("in", -10, 0, "IN", "cv"), input("gate", 10, 0, "TRIG", "gate"), input("rise", -10, 23, "RISE", "cv"), input("fall", 10, 23, "FALL", "cv"), output("out", -10, 44, "OUT", "cv"), output("end", 10, 44, "END", "gate")]),
  module3("random-10", "RANDOM", "STEPPED VOLTAGES", 10, blue,
    [knob(-13, -27, "RATE", 7, 0.27), knob(13, -27, "SPREAD", 7, 0.58), knob(0, 0, "BIAS", 6, 0.5)],
    [input("clock", -15, 24, "CLOCK", "gate"), input("reset", 0, 24, "RESET", "gate"), input("spread", 15, 24, "CV", "cv"), output("out", -15, 44, "STEP", "cv"), output("smooth", 0, 44, "SMOOTH", "cv"), output("gate", 15, 44, "GATE", "gate")]),
  module3("clock-8", "CLOCK", "TEMPO & DIVIDER", 8, charcoal,
    [knob(0, -26, "TEMPO", 9, 0.51)],
    [input("reset", -10, 1, "RESET", "gate"), input("run", 10, 1, "RUN", "gate"), output("out", -10, 23, "CLK", "gate"), output("half", 10, 23, "/2", "gate"), output("quarter", -10, 44, "/4", "gate"), output("eighth", 10, 44, "/8", "gate")]),
  module3("quantizer-10", "QUANT", "PITCH QUANTIZER", 10, silver,
    [knob(-13, -5, "ROOT", 6, 0.44), knob(13, -5, "SCALE", 6, 0.25)],
    [input("in", -13, 23, "CV IN", "cv"), input("trigger", 13, 23, "TRIG", "gate"), output("out", -13, 44, "PITCH", "cv"), output("gate", 13, 44, "GATE", "gate")],
    { display: { x: 0, z: -32, width: 30, height: 11, text: "C MIN" } }),
  module1("line-1u", "LINE OUT", "STEREO", 10, charcoal,
    [knob(0, 2, "LEVEL", 6, 0.67)],
    [input("in", -17, 2, "L"), input("right", 17, 2, "R")]),
  module1("atten-1u", "ATTENUATOR", "CV PROCESSOR", 10, silver,
    [knob(-8, 2, "LEVEL", 5, 0.65), knob(8, 2, "OFFSET", 5, 0.4)],
    [input("in", -21, 2, "IN", "cv"), output("out", 21, 2, "OUT", "cv")]),
  module1("mixer-1u", "MIXER", "3 CHANNEL", 18, cream,
    [knob(-36, 2, "1", 5.5, 0.7), knob(-12, 2, "2", 5.5, 0.5), knob(12, 2, "3", 5.5, 0.35)],
    [input("in", -24, 2, "1"), input("in2", 0, 2, "2"), input("in3", 24, 2, "3"), output("out", 36, 2, "MIX")]),
  module1("noise-1u", "NOISE", "ANALOG", 8, silver, [],
    [output("white", -12, 2, "WHITE"), output("pink", 0, 2, "PINK"), output("out", 12, 2, "S&H", "cv")]),
  module1("lfo-1u", "LFO", "MODULATION", 14, blue,
    [knob(-16, 2, "RATE", 6, 0.3), knob(0, 2, "SHAPE", 5.5, 0.57)],
    [output("out", 17, 2, "CV", "cv"), output("square", 29, 2, "GATE", "gate")]),
  module1("slew-1u", "SLEW", "RISE / FALL", 14, cream,
    [knob(-8, 2, "RISE", 5.5, 0.3), knob(8, 2, "FALL", 5.5, 0.56)],
    [input("in", -26, 2, "IN", "cv"), output("out", 26, 2, "OUT", "cv")]),
  module1("clock-1u", "CLOCK", "DIVIDER", 16, charcoal,
    [knob(-22, 2, "RATE", 6, 0.45)],
    [output("out", -4, 2, "CLK", "gate"), output("half", 10, 2, "/2", "gate"), output("quarter", 24, 2, "/4", "gate")]),
  module1("vca-1u", "VCA", "AMPLIFIER", 16, cream,
    [knob(0, 2, "GAIN", 6, 0.7)],
    [input("in", -28, 2, "IN"), input("cv", -14, 2, "CV", "cv"), output("out", 24, 2, "OUT")]),
  { ...module1("scope-1u", "SCOPE", "SIGNAL MONITOR", 18, blue,
    [knob(-35, 2, "SCALE", 5.5, 0.58), knob(35, 2, "TIME", 5.5, 0.34)],
    [input("in", -19, 2, "X", "cv"), input("in2", 19, 2, "Y", "cv")]),
    display: { x: 0, z: 2, width: 22, height: 12, text: "~ / ~" } },
  module1("mult-1u", "MULT", "BUFFERED", 12, silver, [],
    [input("in", -21, 2, "IN", "cv"), output("out", -7, 2, "1", "cv"), output("out2", 7, 2, "2", "cv"), output("out3", 21, 2, "3", "cv")]),
];

const definitions = new Map(exampleModuleCatalog.map(definition => [definition.id, definition]));
const cableColors = ["#d9ab42", "#da6955", "#65a99a", "#748dcc", "#c886b6", "#bdc8c9"];

/** Fit a playable voice first, then add modulation, sequencing and a second voice. */
function selection3(hp: number, rowIndex: number): string[] {
  let ids: string[];
  if (hp < 32) {
    ids = ["vco-6", "vcf-6", "vca-4", "output-4"];
    if (hp >= 26) ids.splice(2, 0, "env-6");
    if (hp >= 30) ids.splice(1, 0, "lfo-4");
  } else if (hp < 48) {
    ids = ["vco-8", "vcf-8", "env-6", "vca-4", "output-4"];
    if (hp >= 36) ids.splice(1, 0, "lfo-6");
    if (hp >= 42) ids.splice(2, 0, "mixer-6");
    if (hp >= 46) ids.splice(0, 0, "noise-4");
  } else if (hp < 72) {
    ids = ["seq-12", "vco-8", "lfo-6", "vcf-8", "env-6", "vca-4", "output-4"];
    if (hp >= 52) ids[4] = "env-10";
    if (hp >= 56) ids[1] = "vco-12";
    if (hp >= 60) ids[5] = "vca-8";
    if (hp >= 68) ids.splice(2, 0, "mixer-8");
  } else {
    ids = ["seq-16", "vco-12", "mixer-6", "vcf-10", "lfo-8", "env-8", "vca-6", "output-6"];
    const extras = rowIndex % 2 === 0
      ? ["vco-8", "delay-14", "random-10", "slew-8", "noise-4", "clock-8", "quantizer-10", "env-6", "vcf-8", "mixer-8", "vco-6"]
      : ["vco-8", "random-10", "delay-14", "clock-8", "noise-4", "slew-8", "quantizer-10", "vcf-8", "env-6", "mixer-8", "vco-6"];
    let remaining = hp - 72;
    for (const id of extras) {
      const width = definitions.get(id)!.hp;
      if (width <= remaining) {
        ids.splice(ids.length - 1, 0, id);
        remaining -= width;
      }
    }
  }
  // Keep the output at the right edge while varying adjacent rows visibly.
  if (rowIndex % 2 !== 0 && ids.length > 4) {
    const outputId = ids.pop()!;
    ids = [...ids.slice(2), ...ids.slice(0, 2), outputId];
  }
  return ids;
}

function selection1(hp: number, rowIndex: number): string[] {
  const ids = ["atten-1u", "line-1u"];
  let remaining = hp - 20;
  const extras = rowIndex % 2 === 0
    ? ["lfo-1u", "mixer-1u", "noise-1u", "vca-1u", "clock-1u", "slew-1u", "mult-1u", "scope-1u"]
    : ["mixer-1u", "lfo-1u", "vca-1u", "noise-1u", "slew-1u", "clock-1u", "scope-1u", "mult-1u"];
  for (const id of extras) {
    const width = definitions.get(id)!.hp;
    if (width <= remaining) {
      ids.splice(ids.length - 1, 0, id);
      remaining -= width;
    }
  }
  return ids;
}

function patch(modules: ExampleModulePlacement[], rowIndex: number): ExamplePatchCable[] {
  const cables: ExamplePatchCable[] = [];
  const occupied = new Set<string>();
  const find = (prefix: string) => modules.find(module => module.definition.id.startsWith(prefix));
  const connect = (from: ExampleModulePlacement | undefined, fromId: string, to: ExampleModulePlacement | undefined, toId: string) => {
    if (!from || !to || from.id === to.id) return;
    const source = from.definition.jacks.find(socket => socket.id === fromId);
    const target = to.definition.jacks.find(socket => socket.id === toId);
    const sourceKey = `${from.id}:${fromId}`, targetKey = `${to.id}:${toId}`;
    if (!source || !target || source.direction !== "output" || target.direction !== "input" || source.signal !== target.signal || occupied.has(sourceKey) || occupied.has(targetKey)) return;
    occupied.add(sourceKey);
    occupied.add(targetKey);
    cables.push({ id: `patch-${rowIndex}-${cables.length}`, from: { moduleId: from.id, jackId: fromId }, to: { moduleId: to.id, jackId: toId }, color: cableColors[(cables.length + rowIndex) % cableColors.length] });
  };
  const oscillator = find("vco-"), filter = find("vcf-"), amplifier = find("vca-"), envelope = find("env-");
  const lfo = find("lfo-"), sequencer = find("seq-"), mixer = find("mixer-"), delay = find("delay-"), noise = find("noise-");
  const destination = find("output-") ?? find("line-");
  if (oscillator) {
    const secondOscillator = modules.find(module => module.definition.id.startsWith("vco-") && module.id !== oscillator.id);
    if (mixer) {
      connect(oscillator, "saw", mixer, "in");
      connect(secondOscillator, "saw", mixer, "in2");
      connect(mixer, "out", filter, "in");
    } else {
      connect(oscillator, "saw", filter, "in");
    }
    connect(filter, "out", amplifier, "in");
    if (delay) {
      connect(amplifier, "out", delay, "in");
      connect(delay, "out", destination, "in");
      connect(delay, "right", destination, "right");
    } else connect(amplifier, "out", destination, "in");
    connect(lfo, "out", filter, "fm");
    if (sequencer || lfo) connect(envelope, "out", amplifier, "cv");
    connect(sequencer, "pitch", oscillator, "pitch");
    connect(sequencer, "gate", envelope, "gate");
    connect(find("clock-"), "out", sequencer, "clock");
    connect(lfo, "square", sequencer ?? envelope, sequencer ? "clock" : "gate");
    connect(find("random-"), "smooth", delay ?? oscillator, delay ? "time" : "fm");
    connect(noise, "pink", mixer, "in3");
  } else {
    // A 1U strip demonstrates utility patching without inventing a full synth voice.
    const attenuator = find("atten-"), slew = find("slew-"), mult = find("mult-");
    connect(lfo ?? noise, "out", attenuator, "in");
    const modulationTarget = slew ?? amplifier ?? mult ?? find("scope-");
    connect(attenuator, "out", modulationTarget, modulationTarget === amplifier ? "cv" : "in");
    connect(slew, "out", amplifier ?? mult ?? find("scope-"), amplifier ? "cv" : "in");
    connect(noise, "white", mixer ?? amplifier ?? destination, "in");
    connect(mixer, "out", amplifier ?? destination, "in");
    connect(amplifier, "out", destination, "in");
    connect(mult, "out", find("scope-"), "in");
  }
  return cables;
}

export function createExampleRackRow(hp: number, units: 1 | 3, rowIndex = 0): { modules: ExampleModulePlacement[]; cables: ExamplePatchCable[] } {
  const width = Number.isFinite(hp) ? Math.max(0, Math.floor(hp)) : 0;
  const index = Number.isFinite(rowIndex) ? Math.max(0, Math.floor(rowIndex)) : 0;
  const ids = width < 20 ? [] : units === 1 ? selection1(width, index) : selection3(width, index);
  let startHp = 0;
  const modules: ExampleModulePlacement[] = ids.map((id, moduleIndex) => {
    const definition = definitions.get(id)!;
    const placement = { id: `row-${index}-${moduleIndex}-${id}`, definition, startHp };
    startHp += definition.hp;
    return placement;
  });
  if (startHp < width) {
    const remaining = width - startHp;
    modules.push({ id: `row-${index}-blank`, startHp, definition: { id: `blank-${units}u-${remaining}`, name: "", subtitle: "", hp: remaining, units, ...charcoal, knobs: [], jacks: [], blank: true } });
  }
  return { modules, cables: patch(modules, index) };
}
