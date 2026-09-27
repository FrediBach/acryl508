"use client";

import type { PanelComponent } from "@/lib/panel-designer";

type HardwareProps = { component: PanelComponent; thickness: number };

// Illustrative hardware in panel-local millimetres: XY is the sheet, +Z is out.
// The editable body dimensions remain clearance guides, rather than vendor CAD.
function Cylinder({ radius, depth, z, color, sides = 24, metalness = 0.65 }: {
  radius: number; depth: number; z: number; color: string; sides?: number; metalness?: number;
}) {
  return <mesh position={[0, 0, z]} rotation={[Math.PI / 2, 0, 0]} castShadow>
    <cylinderGeometry args={[radius, radius, depth, sides]} />
    <meshStandardMaterial color={color} metalness={metalness} roughness={metalness ? 0.35 : 0.65} flatShading={metalness === 0} />
  </mesh>;
}

function RearBody({ component, thickness, depth, color = "#252c2e" }: HardwareProps & { depth: number; color?: string }) {
  const width = Math.max(component.bodyWidth, component.width);
  const height = Math.max(component.bodyHeight, component.shape === "circle" ? component.width : component.height);
  return <mesh position={[0, 0, -thickness - depth / 2]} castShadow>
    <boxGeometry args={[width, height, depth]} />
    <meshStandardMaterial color={color} metalness={0.15} roughness={0.65} />
  </mesh>;
}

function Bushing({ component, thickness }: HardwareProps) {
  return <>
    <Cylinder radius={component.width * 0.47} depth={thickness + 2} z={1 - thickness / 2} color="#929a99" />
    <Cylinder radius={component.width / 2 + 1} depth={0.6} z={0.3} color="#c8cecb" />
    <Cylinder radius={component.width / 2 + 0.8} depth={1.5} z={1.3} color="#b7c0bd" sides={6} />
  </>;
}

function Pot(props: HardwareProps) {
  const { component } = props;
  const radius = Math.max(component.width / 2 + 1.2, Math.min(component.bodyWidth, component.bodyHeight) * 0.44);
  return <>
    <RearBody {...props} depth={11} color="#59615e" />
    <Bushing {...props} />
    <Cylinder radius={component.width * 0.4} depth={4} z={3.5} color="#c5cac7" />
    <Cylinder radius={radius} depth={9} z={7.2} color="#202628" sides={32} metalness={0} />
    <Cylinder radius={radius * 0.83} depth={0.65} z={11.95} color="#41494b" />
    <mesh position={[0, radius * 0.53, 12.32]}><boxGeometry args={[0.85, radius * 0.68, 0.12]} /><meshStandardMaterial color="#e9e5d7" /></mesh>
  </>;
}

function Jack(props: HardwareProps) {
  const bore = props.component.width;
  const socketRadius = Math.min(1.75, bore * 0.3);
  return <>
    <RearBody {...props} depth={12} />
    <Bushing {...props} />
    <Cylinder radius={bore * 0.44} depth={1.4} z={2.6} color="#cbd0ce" />
    <Cylinder radius={socketRadius + 0.4} depth={0.15} z={3.35} color="#303738" metalness={0.2} />
    <Cylinder radius={socketRadius} depth={0.12} z={3.46} color="#070c0e" metalness={0} />
    <mesh position={[0, 0, 3.5]}><torusGeometry args={[socketRadius + 0.22, 0.2, 8, 24]} /><meshStandardMaterial color="#d1d6d2" metalness={0.8} roughness={0.25} /></mesh>
  </>;
}

function Toggle(props: HardwareProps) {
  const radius = Math.max(0.9, props.component.width * 0.18);
  return <>
    <RearBody {...props} depth={10} />
    <Bushing {...props} />
    <group position={[0, 0, 2]} rotation={[-0.3, 0, 0]}>
      <Cylinder radius={radius} depth={8} z={4} color="#cbd2ce" />
      <mesh position={[0, 0, 8]}><sphereGeometry args={[radius, 12, 8]} /><meshStandardMaterial color="#cbd2ce" metalness={0.75} roughness={0.3} /></mesh>
    </group>
  </>;
}

function Display(props: HardwareProps) {
  const { width } = props.component;
  const height = props.component.shape === "circle" ? width : props.component.height;
  const points = Array.from({ length: 25 }, (_, index) => ({ x: (index / 24 - 0.5) * width * 0.8, y: Math.sin(index / 24 * Math.PI * 4) * height * 0.24 }));
  const trace = new Float32Array(points.slice(1).flatMap((point, index) => [points[index].x, points[index].y, 0, point.x, point.y, 0]));
  return <>
    <RearBody {...props} depth={7} />
    <mesh position={[0, 0, 0.8]} castShadow><boxGeometry args={[width + 2, height + 2, 1.6]} /><meshStandardMaterial color="#20282b" roughness={0.5} /></mesh>
    <mesh position={[0, 0, 1.65]}><boxGeometry args={[width, height, 0.12]} /><meshStandardMaterial color="#102e35" metalness={0.3} roughness={0.22} /></mesh>
    <lineSegments position={[0, 0, 1.74]}><bufferGeometry><bufferAttribute attach="attributes-position" args={[trace, 3]} /></bufferGeometry><lineBasicMaterial color="#a6ddd4" toneMapped={false} /></lineSegments>
  </>;
}

export function PanelComponentHardware({ components, thickness, visible }: {
  components: readonly PanelComponent[]; thickness: number; visible: boolean;
}) {
  const fitted = components.filter(component => component.kind !== "custom");
  if (!visible || !fitted.length) return null;
  return <group scale={0.01}>{fitted.map(component => <group key={component.id} name={`panel-component-${component.id}`}
    userData={{ componentId: component.id, componentKind: component.kind }} position={[component.x, component.y, thickness]} rotation={[0, 0, component.rotation * Math.PI / 180]}>
    {component.kind === "pot" ? <Pot component={component} thickness={thickness} />
      : component.kind === "jack" ? <Jack component={component} thickness={thickness} />
        : component.kind === "switch" ? <Toggle component={component} thickness={thickness} />
          : <Display component={component} thickness={thickness} />}
  </group>)}</group>;
}
