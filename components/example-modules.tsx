"use client";

import { useEffect, useMemo } from "react";
import { CanvasTexture, CatmullRomCurve3, SRGBColorSpace, Vector3 } from "three";
import { createExampleRackRow, type ExampleModuleDefinition, type ExampleModulePlacement, type ExamplePatchCable } from "@/lib/example-modules";

const hpPitch = 5.08;
import { PreviewHardware as Hardware, type HardwareInstance, type Point } from "@/components/preview-hardware";

function moduleCenter(placement: ExampleModulePlacement, hp: number) {
  return (placement.startHp + placement.definition.hp / 2 - hp / 2) * hpPitch;
}

function panelTexture(definition: ExampleModuleDefinition) {
  if (typeof document === "undefined") return null;
  const width = definition.hp * hpPitch - 0.35, height = definition.units === 3 ? 128.5 : 39.6;
  const canvas = document.createElement("canvas"), resolution = 8;
  canvas.width = Math.ceil(width * resolution);
  canvas.height = Math.ceil(height * resolution);
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.scale(canvas.width / width, canvas.height / height);
  context.translate(width / 2, height / 2);
  context.fillStyle = definition.panelColor;
  context.fillRect(-width / 2, -height / 2, width, height);
  const text = (label: string, x: number, z: number, size: number, color = definition.inkColor, maxWidth = width - 4) => {
    context.font = `600 ${size}px Arial, sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = color;
    context.fillText(label, x, z, maxWidth);
  };
  if (definition.blank) {
    if (definition.hp >= 3) text("508", 0, 0, 2.2, definition.inkColor);
  } else {
    const tall = definition.units === 3;
    text(definition.name, 0, tall ? -51 : -12.7, tall ? 4.2 : 2.8);
    if (tall) {
      text(definition.subtitle.toUpperCase(), 0, -43.8, 1.65);
      context.fillStyle = definition.accentColor;
      context.fillRect(-width / 2 + 3, -41.6, width - 6, 0.5);
      text(`${definition.hp} HP  /  508`, 0, 55.4, 1.8);
    }
    for (const knob of definition.knobs) {
      if (tall) {
        context.strokeStyle = definition.inkColor;
        context.lineWidth = 0.24;
        const radius = knob.radius + 1.7;
        context.beginPath();
        context.arc(knob.x, knob.z, radius, Math.PI * 0.75, Math.PI * 2.25);
        context.stroke();
        for (let tick = 0; tick <= 8; tick++) {
          const angle = Math.PI * (0.75 + tick * 1.5 / 8);
          context.beginPath();
          context.moveTo(knob.x + Math.cos(angle) * radius, knob.z + Math.sin(angle) * radius);
          context.lineTo(knob.x + Math.cos(angle) * (radius + 1), knob.z + Math.sin(angle) * (radius + 1));
          context.stroke();
        }
      }
      text(knob.label, knob.x, knob.z + knob.radius + (tall ? 4 : 3), 1.8);
    }
    for (const jack of definition.jacks) {
      const labelWidth = Math.min(9.4, width - 2 * Math.abs(jack.x) - 0.8);
      if (jack.direction === "output") {
        context.fillStyle = definition.inkColor;
        context.fillRect(jack.x - labelWidth / 2, jack.z + 4.5, labelWidth, 3.1);
      }
      text(jack.label, jack.x, jack.z + 6, 1.8, jack.direction === "output" ? definition.panelColor : definition.inkColor, labelWidth);
    }
    for (const toggle of definition.switches ?? []) text(toggle.label, toggle.x, toggle.z + 6.5, 1.8);
    if (definition.display) {
      const { x, z, width: w, height: h, text: label } = definition.display;
      context.fillStyle = "#111c20";
      context.fillRect(x - w / 2 - 1, z - h / 2 - 1, w + 2, h + 2);
      context.fillStyle = "#1a3338";
      context.fillRect(x - w / 2, z - h / 2, w, h);
      text(label, x, z, Math.min(4, h * 0.5), "#96dfd2", w - 2);
    }
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function Faceplate({ definition, x }: { definition: ExampleModuleDefinition; x: number }) {
  const texture = useMemo(() => panelTexture(definition), [definition]);
  useEffect(() => () => texture?.dispose(), [texture]);
  const width = definition.hp * hpPitch - 0.35, height = definition.units === 3 ? 128.5 : 39.6;
  return <group position={[x, 0, 0]}>
    <mesh castShadow receiveShadow><boxGeometry args={[width, 2, height]} /><meshStandardMaterial color={definition.panelColor} metalness={0.48} roughness={0.42} /></mesh>
    <mesh position={[0, 1.015, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[width, height]} />
      <meshStandardMaterial map={texture} color={texture ? "#ffffff" : definition.panelColor} roughness={0.52} metalness={0.28} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
    </mesh>
  </group>;
}

function cableEnds(cable: ExamplePatchCable, modules: ExampleModulePlacement[], hp: number): [Point, Point] {
  return [cable.from, cable.to].map(endpoint => {
    const placement = modules.find(placement => placement.id === endpoint.moduleId)!;
    const jack = placement.definition.jacks.find(jack => jack.id === endpoint.jackId)!;
    return [moduleCenter(placement, hp) + jack.x, 16.5, jack.z] as Point;
  }) as [Point, Point];
}

function PatchCable({ endpoints, color, index, units }: { endpoints: [Point, Point]; color: string; index: number; units: 1 | 3 }) {
  const curve = useMemo(() => {
    const [start, end] = endpoints;
    const distance = Math.hypot(end[0] - start[0], end[2] - start[2]);
    const lift = 27 + (index % 4) * 3;
    const loopZ = Math.min(units === 3 ? 57 : 20, Math.max(start[2], end[2]) + 9 + Math.min(20, distance * 0.12));
    // Vertical exits clear the plug boots; the slack hangs between raised shoulders.
    return new CatmullRomCurve3([
      new Vector3(...start), new Vector3(start[0], 23, start[2] + 0.8),
      new Vector3(start[0] + (end[0] - start[0]) * 0.2, lift, loopZ - 3),
      new Vector3((start[0] + end[0]) / 2, 19 + (index % 3) * 2, loopZ),
      new Vector3(start[0] + (end[0] - start[0]) * 0.8, lift - 1, loopZ - 2),
      new Vector3(end[0], 23, end[2] + 0.8), new Vector3(...end),
    ], false, "centripetal");
  }, [endpoints, index, units]);
  return <mesh castShadow><tubeGeometry args={[curve, 48, 1.35, 8, false]} /><meshStandardMaterial color={color} roughness={0.69} /></mesh>;
}

export function ExampleModules({ hp, units, rowIndex, y }: { hp: number; units: 1 | 3; rowIndex: number; y: number }) {
  const row = useMemo(() => createExampleRackRow(hp, units, rowIndex), [hp, units, rowIndex]);
  const cables = useMemo(() => row.cables.map(cable => ({ ...cable, endpoints: cableEnds(cable, row.modules, hp) })), [row, hp]);
  const hardware = useMemo(() => {
    const metal: HardwareInstance[] = [], rubber: HardwareInstance[] = [], nuts: HardwareInstance[] = [];
    const holes: HardwareInstance[] = [], markers: HardwareInstance[] = [], collars: HardwareInstance[] = [];
    for (const placement of row.modules) {
      const { definition } = placement, x = moduleCenter(placement, hp);
      const railZ = (units === 3 ? 128.5 : 39.6) / 2 - 3;
      const screwX = definition.hp >= 10 ? [-definition.hp * hpPitch / 2 + 7.5, definition.hp * hpPitch / 2 - 7.5] : [0];
      const screwRadius = definition.hp === 1 ? 2.15 : 2.65;
      for (const sx of screwX) for (const z of [-railZ, railZ]) {
        metal.push({ position: [x + sx, 1.8, z], scale: [screwRadius, 1.6, screwRadius], color: "#afb5b5" });
        markers.push({ position: [x + sx, 2.65, z], scale: [3.1, 0.15, 0.6], rotation: [0, 0.35, 0], color: "#333638" });
      }
      for (const knob of definition.knobs) {
        const angle = (knob.value - 0.5) * Math.PI * 1.5;
        metal.push({ position: [x + knob.x, 2, knob.z], scale: [knob.radius + 0.5, 1.5, knob.radius + 0.5], color: "#686e70" });
        rubber.push({ position: [x + knob.x, 6.5, knob.z], scale: [knob.radius, 8, knob.radius] });
        metal.push({ position: [x + knob.x, 10.55, knob.z], scale: [knob.radius * 0.78, 0.5, knob.radius * 0.78], color: "#393f41" });
        markers.push({ position: [x + knob.x + Math.sin(angle) * knob.radius * 0.52, 10.86, knob.z - Math.cos(angle) * knob.radius * 0.52], scale: [0.8, 0.25, knob.radius * 0.68], rotation: [0, -angle, 0], color: "#eee9d9" });
      }
      for (const jack of definition.jacks) {
        nuts.push({ position: [x + jack.x, 2.1, jack.z], scale: [3.6, 2.2, 3.6], color: "#b5b9b7" });
        collars.push({ position: [x + jack.x, 3.35, jack.z], scale: [1, 1, 1], rotation: [-Math.PI / 2, 0, 0], color: "#c7cecb" });
        holes.push({ position: [x + jack.x, 3.23, jack.z], scale: [1.8, 0.18, 1.8], color: "#101416" });
      }
      for (const toggle of definition.switches ?? []) {
        nuts.push({ position: [x + toggle.x, 2, toggle.z], scale: [2.5, 1.8, 2.5], color: "#afb5b5" });
        metal.push({ position: [x + toggle.x, 5, toggle.z - 0.7], scale: [0.95, 5, 0.95], rotation: [-0.24, 0, 0], color: "#d7dbd9" });
      }
    }
    for (const cable of cables) for (const [x, , z] of cable.endpoints) {
      metal.push({ position: [x, 4.1, z], scale: [2.15, 2, 2.15], color: "#bec5c3" });
      rubber.push({ position: [x, 8.6, z], scale: [3.1, 8, 3.1], color: cable.color });
      rubber.push({ position: [x, 14.25, z], scale: [1.85, 4.5, 1.85], color: cable.color });
      for (const height of [6, 8, 10]) collars.push({ position: [x, height, z], scale: [1.28, 1.28, 1.28], rotation: [-Math.PI / 2, 0, 0], color: cable.color });
    }
    return { metal, rubber, nuts, holes, markers, collars };
  }, [row, hp, units, cables]);
  return <group position={[0, y, 0]} scale={0.01}>
    {row.modules.map(placement => <Faceplate key={placement.id} definition={placement.definition} x={moduleCenter(placement, hp)} />)}
    <Hardware instances={hardware.metal} metalness={0.72}><cylinderGeometry args={[1, 1, 1, 16]} /></Hardware>
    <Hardware instances={hardware.rubber} metalness={0.03} roughness={0.67}><cylinderGeometry args={[0.92, 1, 1, 16]} /></Hardware>
    <Hardware instances={hardware.nuts} metalness={0.8}><cylinderGeometry args={[1, 1, 1, 6]} /></Hardware>
    <Hardware instances={hardware.holes} metalness={0.1}><cylinderGeometry args={[1, 1, 1, 12]} /></Hardware>
    <Hardware instances={hardware.markers} metalness={0.1}><boxGeometry args={[1, 1, 1]} /></Hardware>
    <Hardware instances={hardware.collars} metalness={0.4}><torusGeometry args={[2.12, 0.38, 6, 16]} /></Hardware>
    {cables.map((cable, index) => <PatchCable key={cable.id} endpoints={cable.endpoints} color={cable.color} index={index} units={units} />)}
  </group>;
}
