"use client";
import { useMemo } from "react";
import { Path, Shape } from "three";
import { trolleyBus as board, trolleyCover as cover, trolleyHeaders, trolleyHoles } from "@/lib/trolley";

function hole(shape: Shape, x: number, y: number, radius: number) {
  const path = new Path(); path.absarc(x, y, radius, 0, Math.PI * 2, true); shape.holes.push(path);
}
function rectangle(width: number, length: number) {
  const shape = new Shape();
  shape.moveTo(-width / 2, -length / 2); shape.lineTo(width / 2, -length / 2);
  shape.lineTo(width / 2, length / 2); shape.lineTo(-width / 2, length / 2); shape.closePath();
  return shape;
}

// Component placement and mounting stack are photo estimates, in millimetres.
// The 12 mm connector projection reconciles the two published lengths by inference.
export function TrolleyPreview({ baseTop, offsetX }: { baseTop: number; offsetX: number }) {
  const profiles = useMemo(() => {
    const pcb = rectangle(board.width, board.pcbLength);
    for (const { x, y } of trolleyHoles) hole(pcb, x, y, board.holeDiameter / 2);
    const grill = rectangle(cover.width, cover.length);
    for (const x of cover.screwXs) hole(grill, x - cover.x, 0, 1.6);
    // Four banks of diagonal slots, as on the red regulator cover.
    for (let bank = 0; bank < 4; bank++) for (let row = 0; row < 9; row++) {
      const x = -47 + bank * 31.5, y = -19 + row * 4.5;
      const slot = new Path();
      slot.moveTo(x - 10, y + 2); slot.lineTo(x - 10, y + 3.6);
      slot.lineTo(x + 10, y - 2); slot.lineTo(x + 10, y - 3.6); slot.closePath(); grill.holes.push(slot);
    }
    const socket = rectangle(27, 9);
    const opening = new Path(); opening.moveTo(-11.5, -3); opening.lineTo(-11.5, 3); opening.lineTo(11.5, 3); opening.lineTo(11.5, -3); opening.closePath(); socket.holes.push(opening);
    const washer = new Shape(); washer.absarc(0, 0, 3, 0, Math.PI * 2, false); hole(washer, 0, 0, 1.6);
    return { pcb, grill, socket, washer };
  }, []);
  return <group position={[offsetX / 100, baseTop, 0]} scale={0.01}>
    <group position={[0, board.standoffHeight, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}><extrudeGeometry args={[profiles.pcb, { depth: board.pcbThickness, bevelEnabled: false, curveSegments: 16 }]} /><meshStandardMaterial color="#b92921" roughness={0.6} /></mesh>
      {trolleyHoles.map(({ x, y }, i) => <group key={i} position={[x, 0, -y]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -board.standoffHeight, 0]}><extrudeGeometry args={[profiles.washer, { depth: board.standoffHeight, bevelEnabled: false, curveSegments: 12 }]} /><meshStandardMaterial color="#e1ddce" roughness={0.75} /></mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, board.pcbThickness, 0]}><extrudeGeometry args={[profiles.washer, { depth: 0.5, bevelEnabled: false, curveSegments: 12 }]} /><meshStandardMaterial color="#f0ecdd" /></mesh>
        <mesh position={[0, board.pcbThickness + 1.4, 0]}><cylinderGeometry args={[2.5, 2.5, 1.8, 16]} /><meshStandardMaterial color="#373a3b" metalness={0.7} roughness={0.3} /></mesh>
      </group>)}
      {trolleyHeaders.map(({ x, y }, i) => <group key={i} position={[x, 5, -Math.sign(y) * 30]} rotation={[0, y > 0 ? Math.PI : 0, 0]}>
        <mesh><extrudeGeometry args={[profiles.socket, { depth: 10, bevelEnabled: false }]} /><meshStandardMaterial color="#1a1c1d" roughness={0.7} /></mesh>
        <mesh><boxGeometry args={[27, 9, 1]} /><meshStandardMaterial color="#131515" /></mesh>
        {[-1, 1].map(side => <group key={side}>{Array.from({ length: 8 }, (_, pin) => <mesh key={pin} position={[(pin - 3.5) * 2.54, side * 1.27, 4]}><boxGeometry args={[0.64, 0.64, 6]} /><meshStandardMaterial color="#bcae81" metalness={0.8} roughness={0.35} /></mesh>)}</group>)}
      </group>)}
      {Array.from({ length: 4 }, (_, i) => <mesh key={i} position={[cover.x - 47 + i * 31.5, 10, 0]}><boxGeometry args={[28, 16, 45]} /><meshStandardMaterial color="#232525" roughness={0.75} /></mesh>)}
      <mesh position={[cover.x, board.height - board.pcbThickness, 0]} rotation={[-Math.PI / 2, 0, 0]}><extrudeGeometry args={[profiles.grill, { depth: board.pcbThickness, bevelEnabled: false, curveSegments: 12 }]} /><meshStandardMaterial color="#b52b23" roughness={0.6} /></mesh>
      {cover.screwXs.map(x => <group key={x} position={[x, 0, 0]}>
        <mesh position={[0, 12, 0]}><cylinderGeometry args={[2.5, 2.5, 21, 6]} /><meshStandardMaterial color="#b5a882" metalness={0.7} roughness={0.4} /></mesh>
        <mesh position={[0, board.height - 0.5, 0]}><cylinderGeometry args={[2.8, 2.8, 1, 16]} /><meshStandardMaterial color="#212526" /></mesh>
      </group>)}
      <mesh position={[board.width / 2 + board.connectorProjection / 2, 6, 0]}><boxGeometry args={[board.connectorProjection, 10, 14]} /><meshStandardMaterial color="#23282a" /></mesh>
      <mesh position={[202, 6, -17]}><boxGeometry args={[8, 9, 10]} /><meshStandardMaterial color="#2383ab" /></mesh>
      {[-10, -3, 4, 11].map(z => <mesh key={z} position={[-199, 3, z]}><sphereGeometry args={[1.5, 10, 8]} /><meshStandardMaterial color="#a32620" roughness={0.4} /></mesh>)}
    </group>
  </group>;
}
