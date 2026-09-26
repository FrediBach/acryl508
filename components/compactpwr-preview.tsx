"use client";
import { useMemo } from "react";
import { Path, Shape } from "three";
import { compactPwr as board, compactPwrHeaders, compactPwrHoles } from "@/lib/compactpwr";

function hole(shape: Shape, x: number, y: number, radius: number) {
  const path = new Path(); path.absarc(x, y, radius, 0, Math.PI * 2, true); shape.holes.push(path);
}

// Millimetres within the group. Component envelopes and mounting hardware
// are visual estimates from CompactPWR2.jpg, not manufacturer CAD.
export function CompactPwrPreview({ baseTop, rotation }: { baseTop: number; rotation: number }) {
  const profiles = useMemo(() => {
    const pcb = new Shape();
    pcb.moveTo(-87, -39.5); pcb.lineTo(87, -39.5); pcb.lineTo(87, 39.5); pcb.lineTo(-87, 39.5); pcb.closePath();
    for (const { x, y } of compactPwrHoles) hole(pcb, x, y, board.holeDiameter / 2);
    const header = new Shape();
    header.moveTo(-5.5, -14); header.lineTo(5.5, -14); header.lineTo(5.5, 14); header.lineTo(-5.5, 14); header.closePath();
    const socket = new Path(); socket.moveTo(-3.5, -12); socket.lineTo(-3.5, 12); socket.lineTo(3.5, 12); socket.lineTo(3.5, -12); socket.closePath(); header.holes.push(socket);
    const washer = new Shape(); washer.absarc(0, 0, 3, 0, Math.PI * 2, false); hole(washer, 0, 0, 1.6);
    return { pcb, header, washer };
  }, []);
  return <group position={[0, baseTop, 0]} rotation={[0, rotation * Math.PI / 180, 0]} scale={0.01}>
    <group position={[0, board.standoffHeight, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}><extrudeGeometry args={[profiles.pcb, { depth: board.pcbThickness, bevelEnabled: false, curveSegments: 16 }]} /><meshStandardMaterial color="#20282a" roughness={0.6} /></mesh>
      {compactPwrHoles.map(({ x, y }, i) => <group key={i} position={[x, 0, -y]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -board.standoffHeight, 0]}><extrudeGeometry args={[profiles.washer, { depth: board.standoffHeight, bevelEnabled: false, curveSegments: 12 }]} /><meshStandardMaterial color="#dedbcc" roughness={0.75} /></mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, board.pcbThickness, 0]}><extrudeGeometry args={[profiles.washer, { depth: 0.5, bevelEnabled: false, curveSegments: 12 }]} /><meshStandardMaterial color="#f0ecdc" /></mesh>
        <mesh position={[0, board.pcbThickness + 1.4, 0]}><cylinderGeometry args={[2.5, 2.5, 1.8, 16]} /><meshStandardMaterial color="#35393a" metalness={0.75} roughness={0.3} /></mesh>
      </group>)}
      {compactPwrHeaders.map(({ x, y }, i) => <group key={i} position={[x, board.pcbThickness, -y]}>
        <mesh position={[0, 0.75, 0]}><boxGeometry args={[11, 1.5, 28]} /><meshStandardMaterial color="#101414" /></mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]}><extrudeGeometry args={[profiles.header, { depth: 9, bevelEnabled: false }]} /><meshStandardMaterial color="#181e20" roughness={0.7} /></mesh>
        {[-1, 1].map(side => <group key={side}>{Array.from({ length: 8 }, (_, pin) => <mesh key={pin} position={[side * 1.27, 4.3, (pin - 3.5) * 2.54]}><boxGeometry args={[0.64, 5.6, 0.64]} /><meshStandardMaterial color="#b8ae83" metalness={0.8} roughness={0.35} /></mesh>)}</group>)}
      </group>)}
      {/* Two tall converter blocks and a smaller converter between the rows. */}
      {[-25, 25].map(z => <mesh key={z} position={[64, (board.height + board.pcbThickness) / 2, z]}><boxGeometry args={[26, board.height - board.pcbThickness, 27]} /><meshStandardMaterial color="#252b2f" roughness={0.6} /></mesh>)}
      <mesh position={[15, 6.1, 0]}><boxGeometry args={[14, 9, 13]} /><meshStandardMaterial color="#202728" /></mesh>
      <mesh position={[55, 8.6, 0]}><cylinderGeometry args={[11.5, 11.5, 14, 40]} /><meshStandardMaterial color="#c2584a" roughness={0.7} /></mesh>
      {/* Push-to-connect input terminal, with two orange release tabs. */}
      <mesh position={[80, 6.6, 0]}><boxGeometry args={[12, 10, 13]} /><meshStandardMaterial color="#b3cbca" /></mesh>
      {[-3.3, 3.3].map(z => <mesh key={z} position={[82, 12, z]}><boxGeometry args={[5, 1, 5]} /><meshStandardMaterial color="#f18d26" /></mesh>)}
      {[{ x: 29, z: -7 }, { x: 29, z: 7 }, { x: 82, z: -13 }, { x: 82, z: 13 }].map(({ x, z }, i) => <group key={i} position={[x, board.pcbThickness, z]}>
        <mesh position={[0, 5, 0]}><cylinderGeometry args={[3, 3, 10, 20]} /><meshStandardMaterial color="#293336" /></mesh>
        <mesh position={[0, 10.1, 0]}><cylinderGeometry args={[2.5, 2.5, 0.2, 20]} /><meshStandardMaterial color="#bfcac7" metalness={0.7} roughness={0.3} /></mesh>
      </group>)}
      {[-10, 3].map(x => <group key={x} position={[x, board.pcbThickness, 0]}>
        <mesh position={[0, 2.5, 0]}><cylinderGeometry args={[4.5, 4.5, 5, 20]} /><meshStandardMaterial color="#1d2427" /></mesh>
        <mesh position={[0, 5.1, 0]}><boxGeometry args={[1, 0.3, 3]} /><meshStandardMaterial color="#d4ddda" /></mesh>
      </group>)}
      {[-4, 0, 4].map(z => <mesh key={z} position={[-73, 2, z]}><boxGeometry args={[2, 0.8, 1.5]} /><meshStandardMaterial color="#d7deb1" /></mesh>)}
    </group>
  </group>;
}
