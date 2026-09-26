"use client";
import { useMemo } from "react";
import { compactPwrInlet as inlet } from "@/lib/compactpwr";
import { compactPwrInletPlate, compactPwrInletTransform } from "@/lib/compactpwr-inlet";
import type { CasePanels } from "@/lib/case-panels";

export function CompactPwrInletPreview({ panels, explode }: { panels: CasePanels; explode: number }) {
  const plate = useMemo(() => compactPwrInletPlate(), []);
  const placement = panels.inlet;
  if (!placement?.fits) return null;
  const transform = compactPwrInletTransform(placement, panels.layout, explode);
  const thickness = panels.layout.thicknesses[placement.side] * 100;
  return <group {...transform} scale={0.01}>
    <mesh castShadow><extrudeGeometry args={[plate, { depth: inlet.plateThickness, bevelEnabled: false, curveSegments: 12 }]} /><meshStandardMaterial color="#171c20" metalness={0.65} roughness={0.45} /></mesh>
    {/* The component depths and fastener profiles are illustrative. */}
    <group position={[inlet.switchX, 0, 0]}>
      <mesh position={[0, 0, -8]}><boxGeometry args={[inlet.switchWidth, inlet.switchHeight, 16]} /><meshStandardMaterial color="#202326" roughness={0.7} /></mesh>
      <mesh position={[0, 0, 2]}><boxGeometry args={[15, 21, 2]} /><meshStandardMaterial color="#0c1012" roughness={0.5} /></mesh>
      <group position={[0, 0, 3.4]} rotation={[0.12, 0, 0]}>
        <mesh><boxGeometry args={[11, 17, 2.5]} /><meshStandardMaterial color="#343b3f" roughness={0.55} /></mesh>
        <mesh position={[0, 4.5, 1.28]}><boxGeometry args={[0.65, 3, 0.08]} /><meshStandardMaterial color="#ecece4" /></mesh>
        <mesh position={[0, -4.5, 1.3]}><torusGeometry args={[1.4, 0.3, 6, 20]} /><meshStandardMaterial color="#ecece4" /></mesh>
      </group>
      {[-4, 4].map(x => <mesh key={x} position={[x, 0, -18]}><boxGeometry args={[2.5, 0.7, 5]} /><meshStandardMaterial color="#b0aba0" metalness={0.8} roughness={0.35} /></mesh>)}
    </group>
    <group position={[inlet.jackX, 0, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -6]}><cylinderGeometry args={[6, 6, 12, 24]} /><meshStandardMaterial color="#202326" /></mesh>
      <mesh position={[0, 0, 2.1]}><ringGeometry args={[2.75, 5.5, 6]} /><meshStandardMaterial color="#a0a6a8" metalness={0.85} roughness={0.3} /></mesh>
      <mesh position={[0, 0, 2.6]}><torusGeometry args={[3.5, 0.75, 10, 32]} /><meshStandardMaterial color="#b9bec0" metalness={0.9} roughness={0.25} /></mesh>
      <mesh position={[0, 0, 1.8]}><circleGeometry args={[2.75, 24]} /><meshStandardMaterial color="#030506" roughness={0.9} /></mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 1.8]}><cylinderGeometry args={[1.05, 1.05, 1.4, 16]} /><meshStandardMaterial color="#bdb8a0" metalness={0.85} roughness={0.3} /></mesh>
    </group>
    {[-inlet.holePitch / 2, inlet.holePitch / 2].map(x => <group key={x} position={[x, 0, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, (inlet.plateThickness - thickness - 2) / 2]}><cylinderGeometry args={[1.5, 1.5, thickness + 2 + inlet.plateThickness, 16]} /><meshStandardMaterial color="#62686c" metalness={0.8} roughness={0.35} /></mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 2.5]}><cylinderGeometry args={[3, 3, 2, 24]} /><meshStandardMaterial color="#34393c" metalness={0.75} roughness={0.3} /></mesh>
      <mesh position={[0, 0, 3.51]}><circleGeometry args={[1.3, 6]} /><meshStandardMaterial color="#080b0d" /></mesh>
    </group>)}
  </group>;
}
