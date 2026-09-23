"use client";
import { useMemo } from "react";
import { Path, Shape } from "three";
import { sinusodaHeaders, sinusodaHoles, sinusodaJuice as board } from "@/lib/sinusoda";

function circularHole(shape: Shape, x: number, y: number, radius: number) {
  const path = new Path(); path.absarc(x, y, radius, 0, Math.PI * 2, true); shape.holes.push(path);
}

// Millimetres inside this group; exterior dimensions come from the data sheet.
// Notches, component envelopes, PCB thickness and mounting stack are estimates.
export function SinusodaPreview({ baseTop }: { baseTop: number }) {
  const profiles = useMemo(() => {
    const pcb = new Shape();
    const outline = [[-113, -43], [113, -43], [113, -16], [109, -13], [109, 13], [113, 16], [113, 43], [-113, 43], [-113, 16], [-108, 13], [-108, -13], [-113, -16]];
    outline.forEach(([x, y], i) => { if (i === 0) pcb.moveTo(x, y); else pcb.lineTo(x, y); }); pcb.closePath();
    for (const { x, y } of sinusodaHoles) circularHole(pcb, x, y, board.holeDiameter / 2);
    const header = new Shape();
    header.moveTo(-4.5, -13); header.lineTo(4.5, -13); header.lineTo(4.5, 13); header.lineTo(-4.5, 13); header.closePath();
    const socket = new Path();
    socket.moveTo(-3.2, -11.5); socket.lineTo(-3.2, 11.5); socket.lineTo(3.2, 11.5); socket.lineTo(3.2, -11.5); socket.closePath(); header.holes.push(socket);
    const shield = new Shape();
    shield.moveTo(-49, -14); shield.lineTo(49, -14); shield.lineTo(49, 14); shield.lineTo(-49, 14); shield.closePath();
    for (let i = 0; i < 14; i++) {
      const x = -43 + i * 6.6, slot = new Path();
      slot.moveTo(x - 0.8, -10); slot.lineTo(x - 0.8, 10); slot.absarc(x, 10, 0.8, Math.PI, 0, true);
      slot.lineTo(x + 0.8, -10); slot.absarc(x, -10, 0.8, 0, Math.PI, true); slot.closePath(); shield.holes.push(slot);
    }
    const washer = new Shape(); washer.absarc(0, 0, 3, 0, Math.PI * 2, false); circularHole(washer, 0, 0, 1.6);
    return { pcb, header, shield, washer };
  }, []);
  return <group position={[0, baseTop, 0]} scale={0.01}>
    <group position={[0, board.standoffHeight, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}><extrudeGeometry args={[profiles.pcb, { depth: board.pcbThickness, bevelEnabled: false, curveSegments: 16 }]} /><meshStandardMaterial color="#202322" roughness={0.65} /></mesh>
      {sinusodaHoles.map(({ x, y }, i) => <group key={i} position={[x, 0, -y]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -board.standoffHeight, 0]}><extrudeGeometry args={[profiles.washer, { depth: board.standoffHeight, bevelEnabled: false, curveSegments: 12 }]} /><meshStandardMaterial color="#dad7c8" roughness={0.75} /></mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, board.pcbThickness, 0]}><extrudeGeometry args={[profiles.washer, { depth: 0.5, bevelEnabled: false, curveSegments: 12 }]} /><meshStandardMaterial color="#f4f0df" roughness={0.8} /></mesh>
        <mesh position={[0, board.pcbThickness + 1.4, 0]}><cylinderGeometry args={[2.5, 2.5, 1.8, 16]} /><meshStandardMaterial color="#3d4142" metalness={0.75} roughness={0.3} /></mesh>
      </group>)}
      {sinusodaHeaders.map(({ x, y }, i) => <group key={i} position={[x, board.pcbThickness, -y]}>
        <mesh position={[0, 0.75, 0]}><boxGeometry args={[9, 1.5, 26]} /><meshStandardMaterial color="#111313" /></mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]}><extrudeGeometry args={[profiles.header, { depth: 9, bevelEnabled: false }]} /><meshStandardMaterial color="#1a1c1d" roughness={0.7} /></mesh>
        {[-1, 1].map(side => <group key={side}>{Array.from({ length: 8 }, (_, pin) => <mesh key={pin} position={[side * board.pinPitch / 2, 4.3, (pin - 3.5) * board.pinPitch]}><boxGeometry args={[0.64, 5.6, 0.64]} /><meshStandardMaterial color="#b6aa80" metalness={0.8} roughness={0.35} /></mesh>)}</group>)}
      </group>)}
      <group position={[47, board.pcbThickness, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, board.height - board.pcbThickness - 0.6, 0]}><extrudeGeometry args={[profiles.shield, { depth: 0.6, bevelEnabled: false, curveSegments: 6 }]} /><meshStandardMaterial color="#b7b7b2" metalness={0.85} roughness={0.4} /></mesh>
        {[-1, 1].map(side => <group key={side}>
          <mesh position={[side * 48.7, 8.4, 0]}><boxGeometry args={[0.6, 16.8, 28]} /><meshStandardMaterial color="#a9adaa" metalness={0.8} roughness={0.4} /></mesh>
          <mesh position={[0, 8.4, side * 13.7]}><boxGeometry args={[98, 16.8, 0.6]} /><meshStandardMaterial color="#a9adaa" metalness={0.8} roughness={0.4} /></mesh>
        </group>)}
      </group>
      {[-7, 7].map(z => <mesh key={z} position={[-10, 6, z]}><boxGeometry args={[12, 9, 12]} /><meshStandardMaterial color="#303332" /></mesh>)}
      <mesh position={[-83, 6, 0]}><boxGeometry args={[12, 9, 23]} /><meshStandardMaterial color="#303332" /></mesh>
    </group>
  </group>;
}
