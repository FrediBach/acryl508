"use client";

import { useEffect, useMemo } from "react";
import { CanvasTexture, RepeatWrapping, Shape, SRGBColorSpace } from "three";
import { createExampleSynthLayout, type ExampleSynthLayout } from "@/lib/example-synth";
import { createExampleSynthControls } from "@/lib/example-synth-controls";
import { createExampleSynthPatchCurve } from "@/lib/example-synth-patch";
import { PreviewHardware, type HardwareInstance } from "@/components/preview-hardware";

type Controls = ReturnType<typeof createExampleSynthControls>;
const ink = "#f0e9d9";

function textureCanvas(width: number, depth: number, density = 5) {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  const scale = Math.min(density, 4096 / width, 2048 / depth);
  canvas.width = Math.ceil(width * scale); canvas.height = Math.ceil(depth * scale);
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.scale(canvas.width / width, canvas.height / depth);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace; texture.anisotropy = 4;
  return { context, texture };
}

function controlTexture(layout: ExampleSynthLayout, controls: Controls) {
  const { panel } = layout, result = textureCanvas(panel.width, panel.depth);
  if (!result) return null;
  const { context: c, texture } = result;
  c.translate(panel.width / 2 - panel.x, panel.depth / 2 - panel.z);
  const left = panel.x - panel.width / 2, rear = panel.z - panel.depth / 2;
  c.fillStyle = "#232b2c"; c.fillRect(left, rear, panel.width, panel.depth);
  const text = (label: string, x: number, z: number, size: number, maxWidth: number, color = ink) => {
    c.fillStyle = color; c.font = `600 ${size}px Arial, sans-serif`; c.textAlign = "center"; c.textBaseline = "middle";
    c.fillText(label, x, z, maxWidth);
  };
  text("ATELIER / 508", left + 32, rear + 6, 3.5, 58);
  text(layout.keyCount ? `${layout.keyCount} / ANALOG SYNTHESIZER` : "SEMI MODULAR", left + panel.width - 29, rear + 6, 2, 52, "#b6c1b9");
  for (const section of controls.sections) {
    const x = section.x - section.width / 2, z = section.z - section.depth / 2;
    c.fillStyle = layout.kind === "keyboard" ? section.color : "#2b3333";
    c.fillRect(x + 0.5, z, section.width - 1, section.depth);
    if (layout.kind === "desktop") { c.fillStyle = section.color; c.fillRect(x + 0.5, z, section.width - 1, 7.5); }
    text(section.name, section.x, z + 4, Math.min(2.8, section.width / 15), section.width - 4);
  }
  for (const knob of controls.knobs) {
    const radius = knob.radius + 2;
    c.strokeStyle = "#e5e3d1"; c.lineWidth = 0.3;
    c.beginPath(); c.arc(knob.x, knob.z, radius, Math.PI * 0.75, Math.PI * 2.25); c.stroke();
    for (let i = 0; i <= 8; i++) {
      const angle = Math.PI * (0.75 + i * 1.5 / 8);
      c.beginPath(); c.moveTo(knob.x + Math.cos(angle) * radius, knob.z + Math.sin(angle) * radius);
      c.lineTo(knob.x + Math.cos(angle) * (radius + 1.2), knob.z + Math.sin(angle) * (radius + 1.2)); c.stroke();
    }
    text(knob.label, knob.x, knob.z - knob.radius - 4.5, 2, 25);
  }
  for (const jack of controls.jacks) {
    if (jack.direction === "output") { c.fillStyle = "#d7dcd0"; c.fillRect(jack.x - 5.5, jack.z - 6.5, 11, 3); }
    text(jack.label, jack.x, jack.z - 5, 1.65, 10.5, jack.direction === "output" ? "#283131" : ink);
  }
  for (const button of controls.buttons) text(button.label, button.x, button.z - button.depth / 2 - 3, 1.8, button.width + 3);
  texture.needsUpdate = true;
  return texture;
}

function woodTexture() {
  const result = textureCanvas(128, 64, 4);
  if (!result) return null;
  const { context: c, texture } = result;
  c.fillStyle = "#825638"; c.fillRect(0, 0, 128, 64);
  for (let i = 0; i < 120; i++) {
    c.strokeStyle = i % 3 ? "rgba(42, 23, 15, 0.23)" : "rgba(210, 160, 99, 0.18)";
    c.lineWidth = 0.1 + (i % 5) * 0.08; c.beginPath();
    for (let x = 0; x <= 128; x += 2) {
      const y = i * 0.56 + Math.sin(x * 0.03 + i * 0.7) * 0.7 + Math.sin(x * 0.075 + i) * 0.2;
      if (!x) c.moveTo(x, y); else c.lineTo(x, y);
    }
    c.stroke();
  }
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.repeat.set(0.006, 0.022); texture.needsUpdate = true;
  return texture;
}

function Chassis({ layout }: { layout: ExampleSynthLayout }) {
  const wood = useMemo(() => woodTexture(), []);
  useEffect(() => () => wood?.dispose(), [wood]);
  const profile = useMemo(() => {
    const shape = new Shape(), front = layout.panel.z + layout.panel.depth / 2;
    // Extruded across X; the underside remains at the original support plane.
    shape.moveTo(0, 0); shape.lineTo(-layout.depth, 0); shape.lineTo(-layout.depth, layout.panelTop);
    shape.lineTo(front, layout.panelTop);
    if (layout.kind === "keyboard") shape.lineTo(front + 8, layout.frontTop);
    shape.lineTo(0, layout.frontTop); shape.closePath();
    return shape;
  }, [layout]);
  const { width, cheekWidth } = layout;
  return <>
    <mesh position={[width / 2 - cheekWidth, 0, 0]} rotation={[0, -Math.PI / 2, 0]} castShadow receiveShadow>
      <extrudeGeometry args={[profile, { depth: width - 2 * cheekWidth, bevelEnabled: false }]} />
      <meshStandardMaterial color="#202728" roughness={0.5} metalness={0.35} />
    </mesh>
    {[width / 2, -width / 2 + cheekWidth].map(x => <mesh key={x} position={[x, 0, 0]} rotation={[0, -Math.PI / 2, 0]} castShadow>
      <extrudeGeometry args={[profile, { depth: cheekWidth, bevelEnabled: false }]} />
      <meshStandardMaterial map={wood} color={wood ? "#ffffff" : "#825638"} roughness={0.48} />
    </mesh>)}
    <mesh position={[0, layout.frontTop * 0.55, -0.35]}><boxGeometry args={[width - cheekWidth * 2, Math.min(6, layout.frontTop * 0.25), 0.5]} /><meshStandardMaterial color="#303838" metalness={0.5} roughness={0.4} /></mesh>
  </>;
}

function ControlsAndKeys({ layout, controls }: { layout: ExampleSynthLayout; controls: Controls }) {
  const hardware = useMemo(() => {
    const boxes: HardwareInstance[] = [], rubber: HardwareInstance[] = [], metal: HardwareInstance[] = [], holes: HardwareInstance[] = [], nuts: HardwareInstance[] = [], rings: HardwareInstance[] = [];
    const relief = layout.controlHeight;
    // Leave the upper part of the envelope for gently arched patch cords.
    const knobHeight = relief * 0.56, plugHeight = relief * 0.56, socketHeight = Math.min(2.8, relief * 0.22);
    for (const key of layout.keys) boxes.push({ position: [key.x, key.y, key.z], scale: [key.width, key.height, key.depth], color: key.black ? "#171d1f" : "#e9e6dc" });
    for (const wheel of layout.wheels) {
      rubber.push({ position: [wheel.x, wheel.y, wheel.z], scale: [wheel.radius, wheel.width, wheel.radius], rotation: [0, 0, Math.PI / 2], color: "#272f30" });
      boxes.push({ position: [wheel.x, wheel.y + wheel.radius * 0.98, wheel.z], scale: [wheel.width * 0.6, 0.3, 1.5], color: "#d4d7c9" });
    }
    for (const knob of controls.knobs) {
      const angle = (knob.value - 0.5) * Math.PI * 1.5;
      metal.push({ position: [knob.x, layout.panelTop + 0.25, knob.z], scale: [knob.radius + 0.7, 0.5, knob.radius + 0.7], color: "#8f9994" });
      rubber.push({ position: [knob.x, layout.panelTop + knobHeight / 2, knob.z], scale: [knob.radius, knobHeight, knob.radius], color: "#20282a" });
      metal.push({ position: [knob.x, layout.panelTop + knobHeight, knob.z], scale: [knob.radius * 0.73, 0.4, knob.radius * 0.73], color: "#7e8a86" });
      boxes.push({ position: [knob.x + Math.sin(angle) * knob.radius * 0.48, layout.panelTop + knobHeight + 0.23, knob.z - Math.cos(angle) * knob.radius * 0.48], scale: [0.7, 0.12, knob.radius * 0.8], rotation: [0, -angle, 0], color: ink });
    }
    for (const jack of controls.jacks) {
      nuts.push({ position: [jack.x, layout.panelTop + socketHeight / 2, jack.z], scale: [3.35, socketHeight, 3.35], color: "#aab6af" });
      holes.push({ position: [jack.x, layout.panelTop + socketHeight + 0.03, jack.z], scale: [1.8, 0.12, 1.8], color: "#0e171a" });
      rings.push({ position: [jack.x, layout.panelTop + socketHeight, jack.z], scale: [1, 1, 1], rotation: [-Math.PI / 2, 0, 0], color: "#c3cdc4" });
    }
    for (const button of controls.buttons) {
      const h = Math.min(2, relief * 0.2);
      boxes.push({ position: [button.x, layout.panelTop + h / 2, button.z], scale: [button.width, h, button.depth], color: button.lit ? "#d89a64" : "#bec8be" });
    }
    for (const patch of controls.patches) for (const id of [patch.from, patch.to]) {
      const jack = controls.jacks.find(jack => jack.id === id)!;
      rubber.push({ position: [jack.x, layout.panelTop + plugHeight / 2, jack.z], scale: [2.6, plugHeight, 2.6], color: patch.color });
    }
    // Recessed fasteners sit in the narrow frame outside the printed panel.
    for (const x of [-layout.width / 2 + layout.cheekWidth + 2.5, layout.width / 2 - layout.cheekWidth - 2.5]) {
      for (const z of [-layout.depth + 4, layout.panel.z + layout.panel.depth / 2 - 4]) {
        metal.push({ position: [x, layout.panelTop + 0.25, z], scale: [1.8, 0.5, 1.8], color: "#a1a99f" });
        boxes.push({ position: [x, layout.panelTop + 0.55, z], scale: [2.2, 0.1, 0.5], color: "#293333" });
      }
    }
    return { boxes, rubber, metal, holes, nuts, rings };
  }, [layout, controls]);
  return <>
    <PreviewHardware instances={hardware.boxes} metalness={0.07}><boxGeometry args={[1, 1, 1]} /></PreviewHardware>
    <PreviewHardware instances={hardware.rubber} metalness={0.06} roughness={0.65}><cylinderGeometry args={[1, 1, 1, 24]} /></PreviewHardware>
    <PreviewHardware instances={hardware.metal} metalness={0.7}><cylinderGeometry args={[1, 1, 1, 24]} /></PreviewHardware>
    <PreviewHardware instances={hardware.holes} metalness={0}><cylinderGeometry args={[1, 1, 1, 16]} /></PreviewHardware>
    <PreviewHardware instances={hardware.nuts} metalness={0.72}><cylinderGeometry args={[1, 1, 1, 6]} /></PreviewHardware>
    <PreviewHardware instances={hardware.rings} metalness={0.75}><torusGeometry args={[2.1, 0.3, 6, 20]} /></PreviewHardware>
  </>;
}

function SynthPatch({ layout, controls, patch, index }: { layout: ExampleSynthLayout; controls: Controls; patch: Controls["patches"][number]; index: number }) {
  const curve = useMemo(() => createExampleSynthPatchCurve(layout, controls, patch, index), [layout, controls, patch, index]);
  return <mesh><tubeGeometry args={[curve, 40, Math.min(1.15, layout.controlHeight * 0.09), 8, false]} /><meshStandardMaterial color={patch.color} roughness={0.7} /></mesh>;
}

export function ExampleSynth({ width, depth, height }: { width: number; depth: number; height: number }) {
  const layout = useMemo(() => createExampleSynthLayout(width, depth, height), [width, depth, height]);
  const controls = useMemo(() => createExampleSynthControls(layout), [layout]);
  const texture = useMemo(() => controlTexture(layout, controls), [layout, controls]);
  useEffect(() => () => texture?.dispose(), [texture]);
  return <group scale={0.01} name={`example-synth-${layout.keyCount || "desktop"}`}>
    <Chassis layout={layout} />
    <mesh position={[layout.panel.x, layout.panelTop + 0.025, layout.panel.z]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[layout.panel.width, layout.panel.depth]} /><meshStandardMaterial map={texture} color={texture ? "#ffffff" : "#293333"} metalness={0.2} roughness={0.57} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
    </mesh>
    <ControlsAndKeys layout={layout} controls={controls} />
    {controls.patches.map((patch, index) => <SynthPatch key={`${patch.from}-${patch.to}`} layout={layout} controls={controls} patch={patch} index={index} />)}
  </group>;
}
