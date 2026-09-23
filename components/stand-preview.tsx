"use client";
import { Component, Suspense, useEffect, useMemo, useRef, type ReactNode } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, Line, OrbitControls } from "@react-three/drei";
import { Path, Shape, Vector3 } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { MultiPolygon } from "polygon-clipping";
import type { SynthStand } from "@/lib/synth-stand";
import { panelEdgePoints } from "@/lib/panel-edges";

export type StandView = "perspective" | "side" | "top";
type Props = { stand: SynthStand; dark: boolean; exploded: boolean; instrument: boolean; view: StandView; resetKey: number };
const unit = 0.01;
function shapesFrom(polygons: MultiPolygon) {
  return polygons.map(polygon => {
    const shape = new Shape();
    polygon.forEach((ring, i) => {
      const path = i ? new Path() : shape;
      ring.forEach(([x, y], j) => { if (j) path.lineTo(x * unit, y * unit); else path.moveTo(x * unit, y * unit); });
      path.closePath();
      if (i) shape.holes.push(path);
    });
    return shape;
  });
}
function Sheet({ polygons, thickness, color }: { polygons: MultiPolygon; thickness: number; color: string }) {
  const shapes = useMemo(() => shapesFrom(polygons), [polygons]);
  const args = useMemo(() => [shapes, { depth: thickness * unit, bevelEnabled: false }] as const, [shapes, thickness]);
  const edges = useMemo(() => panelEdgePoints(shapes, thickness * unit, 12, 15), [shapes, thickness]);
  return <mesh><extrudeGeometry args={args} /><meshPhysicalMaterial color={color} roughness={0.16} transmission={0.78} thickness={thickness * unit * 2} ior={1.49} clearcoat={1} attenuationColor={color} attenuationDistance={1.2} />{edges.length > 0 && <Line points={edges} segments color={color} raycast={() => null} />}</mesh>;
}
function StandModel({ stand, exploded, instrument }: Pick<Props, "stand" | "exploded" | "instrument">) {
  const { config, frontHeight } = stand;
  const t = config.thickness * unit;
  const center = (stand.front + stand.rear) / 2 * unit;
  const lift = exploded ? stand.braceHeight * unit + 0.4 : 0;
  const angle = config.angle * Math.PI / 180;
  return <group position={[0, 0, center]}>
    {stand.parts.map(part => <group key={part.id}
      position={part.kind === "rib" ? [part.position * unit - t / 2, lift, 0] : [0, 0, -part.position * unit - t / 2]}
      rotation={part.kind === "rib" ? [0, Math.PI / 2, 0] : [0, 0, 0]}>
      <Sheet polygons={part.polygons} thickness={config.thickness} color={config.tint.color} />
    </group>)}
    {instrument && <group position={[0, frontHeight * unit + lift + (exploded ? 0.7 : 0), 0]} rotation={[angle, 0, 0]}>
      <mesh position={[0, config.height * unit / 2, -config.depth * unit / 2]}>
        <boxGeometry args={[config.width * unit, config.height * unit, config.depth * unit]} /><meshStandardMaterial color="#383c39" roughness={0.7} transparent opacity={0.72} />
      </mesh>
      <mesh position={[0, config.height * unit + 0.005, -config.depth * unit * 0.6]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[config.width * unit * 0.7, config.depth * unit * 0.2]} /><meshStandardMaterial color="#676e64" roughness={0.8} />
      </mesh>
    </group>}
  </group>;
}
function CameraRig({ stand, view, resetKey, exploded, instrument }: Omit<Props, "dark">) {
  const controls = useRef<OrbitControlsImpl>(null);
  const { camera, size, invalidate } = useThree();
  const width = Math.max(stand.config.width, stand.dimensions.width) * unit;
  const depth = stand.dimensions.depth * unit;
  const height = (instrument ? stand.synthTop : stand.dimensions.height) * unit + (exploded ? stand.braceHeight * unit + 1.1 : 0);
  useEffect(() => {
    const aspect = size.width / Math.max(1, size.height);
    const span = view === "side" ? depth : view === "top" ? width : Math.hypot(width, depth);
    const vertical = view === "top" ? depth : height;
    const distance = Math.max(span / aspect, vertical, 1.5) * 2.25;
    const target = new Vector3(0, height / 2, 0);
    const direction = view === "side" ? new Vector3(1, 0, 0) : view === "top" ? new Vector3(0, 1, 0.001) : new Vector3(0.8, 0.65, 1).normalize();
    camera.position.copy(target).addScaledVector(direction, distance); camera.lookAt(target);
    if (controls.current) { controls.current.target.copy(target); controls.current.update(); }
    invalidate();
  }, [camera, size.width, size.height, width, depth, height, view, resetKey, invalidate]);
  return <OrbitControls ref={controls} makeDefault enablePan={false} minDistance={1} maxDistance={80} maxPolarAngle={Math.PI / 2} />;
}
class PreviewBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <div className="preview-fallback">3D preview unavailable. The cutting layout and exports are still available.</div> : this.props.children; }
}
export function StandPreview(props: Props) {
  return <PreviewBoundary><Canvas camera={{ position: [5, 4, 6], fov: 34, near: 0.01, far: 150 }} dpr={[1, 1.75]} frameloop="demand" gl={{ alpha: true, antialias: true }} fallback={<div className="preview-fallback">WebGL is unavailable. Select Cutting layout to inspect your parts.</div>}>
    <ambientLight intensity={props.dark ? 0.8 : 1.3} /><directionalLight position={[3, 7, 5]} intensity={2.5} /><directionalLight position={[-5, 3, -2]} intensity={1.5} color="#e6efff" />
    <Suspense fallback={null}><Environment resolution={128} frames={1}><Lightformer position={[0, 5, -3]} rotation={[Math.PI / 2, 0, 0]} scale={[10, 8, 1]} intensity={3} /><Lightformer position={[-5, 2, 1]} rotation={[0, Math.PI / 2, 0]} scale={[6, 3, 1]} intensity={4} /></Environment><StandModel {...props} /><ContactShadows key={JSON.stringify([props.stand.config, props.exploded, props.instrument])} position={[0, -0.02, 0]} opacity={props.dark ? 0.45 : 0.25} scale={35} blur={2.4} far={10} resolution={512} frames={1} color="#24231e" /></Suspense>
    <CameraRig {...props} />
  </Canvas></PreviewBoundary>;
}
