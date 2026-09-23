"use client";

import { OrbitControls, RoundedBox } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Group } from "three";

type CasePreviewProps = {
  depth: number;
  hp: number;
  rows: number;
  tint: string;
};

const modules = [
  { id: "utility", width: 0.34, color: "#d7d8d4" },
  { id: "oscillator", width: 0.52, color: "#292a2d" },
  { id: "filter", width: 0.27, color: "#b8bab7" },
  { id: "mixer", width: 0.44, color: "#e94f37" },
  { id: "sequencer", width: 0.62, color: "#202124" },
  { id: "envelope", width: 0.3, color: "#cccec9" },
  { id: "output", width: 0.48, color: "#767975" },
];
const rowIds = ["lower", "middle", "upper"];

function Knob({ x, y }: { x: number; y: number }) {
  return (
    <mesh position={[x, y, 0.066]} rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[0.035, 0.035, 0.035, 14]} />
      <meshStandardMaterial color="#0c0d0e" roughness={0.56} />
    </mesh>
  );
}

function ModuleRow({ row, width }: { row: number; width: number }) {
  const total = modules.reduce((sum, module) => sum + module.width, 0);
  const scale = (width - 0.25) / total;

  return (
    <group position={[0, row * 1.04, 0]}>
      {modules.map((module, index) => {
        const scaledWidth = module.width * scale;
        const previousWidth = modules
          .slice(0, index)
          .reduce((sum, previous) => sum + previous.width * scale, 0);
        const x = -width / 2 + 0.125 + previousWidth + scaledWidth / 2;

        return (
          <group key={`${row}-${module.id}`} position={[x, 0, 0]}>
            <RoundedBox
              args={[scaledWidth - 0.014, 0.94, 0.09]}
              radius={0.02}
              smoothness={2}
            >
              <meshStandardMaterial
                color={
                  modules[(index + Math.round(row + 3)) % modules.length].color
                }
                metalness={0.28}
                roughness={0.45}
              />
            </RoundedBox>
            <Knob x={-scaledWidth * 0.18} y={0.2} />
            <Knob x={scaledWidth * 0.18} y={0.2} />
            <mesh position={[0, -0.25, 0.064]}>
              <boxGeometry args={[Math.max(0.06, scaledWidth * 0.38), 0.025, 0.012]} />
              <meshStandardMaterial color={index % 3 === 0 ? "#ff5b42" : "#17181a"} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function AcrylicCase({ depth, hp, rows, tint }: CasePreviewProps) {
  const model = useRef<Group>(null);
  const width = Math.min(5.2, 2.8 + ((hp - 42) / 84) * 2.2);
  const height = rows * 1.04 + 0.34;
  const modelDepth = 1.15 + ((depth - 80) / 170) * 1.15;

  useFrame((state, delta) => {
    if (!model.current) return;
    model.current.rotation.y += delta * 0.055;
    model.current.position.y = Math.sin(state.clock.elapsedTime * 0.55) * 0.035;
  });

  const acrylic = {
    color: tint,
    transparent: true,
    opacity: tint === "#dbe9ef" ? 0.24 : 0.42,
    roughness: 0.16,
    metalness: 0.02,
    transmission: 0.56,
    thickness: 0.35,
  };

  return (
    <group ref={model} rotation={[-0.16, -0.42, 0]}>
      <mesh position={[-width / 2 - 0.055, 0, -modelDepth / 2]}>
        <boxGeometry args={[0.11, height, modelDepth]} />
        <meshPhysicalMaterial {...acrylic} />
      </mesh>
      <mesh position={[width / 2 + 0.055, 0, -modelDepth / 2]}>
        <boxGeometry args={[0.11, height, modelDepth]} />
        <meshPhysicalMaterial {...acrylic} />
      </mesh>
      <mesh position={[0, height / 2 + 0.055, -modelDepth / 2]}>
        <boxGeometry args={[width, 0.11, modelDepth]} />
        <meshPhysicalMaterial {...acrylic} />
      </mesh>
      <mesh position={[0, -height / 2 - 0.055, -modelDepth / 2]}>
        <boxGeometry args={[width, 0.11, modelDepth]} />
        <meshPhysicalMaterial {...acrylic} />
      </mesh>
      <mesh position={[0, 0, -modelDepth]}>
        <boxGeometry args={[width, height, 0.08]} />
        <meshPhysicalMaterial {...acrylic} opacity={0.18} />
      </mesh>

      {rowIds.slice(0, rows).map((rowId, index) => {
        const y = (index - (rows - 1) / 2) * 1.04;
        return (
          <group key={rowId}>
            <ModuleRow row={index - (rows - 1) / 2} width={width} />
            <mesh position={[0, y + 0.505, 0.018]}>
              <boxGeometry args={[width + 0.08, 0.045, 0.07]} />
              <meshStandardMaterial color="#121315" metalness={0.75} roughness={0.24} />
            </mesh>
            <mesh position={[0, y - 0.505, 0.018]}>
              <boxGeometry args={[width + 0.08, 0.045, 0.07]} />
              <meshStandardMaterial color="#121315" metalness={0.75} roughness={0.24} />
            </mesh>
          </group>
        );
      })}

      {[-1, 1].flatMap((side) =>
        [-1, 1].map((vertical) => (
          <mesh
            key={`${side}-${vertical}`}
            position={[side * (width / 2 + 0.061), vertical * (height / 2 - 0.14), 0.02]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <cylinderGeometry args={[0.045, 0.045, 0.018, 16]} />
            <meshStandardMaterial color="#d4d5d0" metalness={0.92} roughness={0.2} />
          </mesh>
        )),
      )}
    </group>
  );
}

export function CasePreview(props: CasePreviewProps) {
  return (
    <Canvas
      camera={{ position: [5.6, 3.1, 6.6], fov: 34 }}
      dpr={[1, 1.75]}
      gl={{ alpha: true, antialias: true }}
    >
      <ambientLight intensity={1.55} />
      <directionalLight position={[4, 7, 5]} intensity={3.6} color="#fff7ef" />
      <directionalLight position={[-5, 3, 2]} intensity={2.2} color="#83a9ff" />
      <pointLight position={[0, -2, 4]} intensity={18} color="#ff4d36" distance={8} />
      <AcrylicCase {...props} />
      <mesh position={[0, -2.25, -0.5]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[4.4, 64]} />
        <meshStandardMaterial color="#101113" transparent opacity={0.62} roughness={1} />
      </mesh>
      <OrbitControls
        enablePan={false}
        minDistance={5.2}
        maxDistance={10}
        minPolarAngle={0.75}
        maxPolarAngle={2.05}
        target={[0, 0, -0.5]}
      />
    </Canvas>
  );
}
