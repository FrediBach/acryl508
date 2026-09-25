"use client";
import { Suspense, useEffect, useRef } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, OrbitControls } from "@react-three/drei";
import { Vector3 } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { UploadedObject } from "@/components/uploaded-object";
import { Sheet, PreviewBoundary, type StandView } from "./stand-preview";
import { sheetMaterial } from "@/lib/sheet-materials";
import type { SynthProtector } from "@/lib/synth-protector";
const unit = 0.01;
type Props = { protector: SynthProtector; dark: boolean; exploded: boolean; instrument: boolean; view: StandView; resetKey: number };
function ProtectorModel({ protector, exploded, instrument }: Props) {
  const { config } = protector;
  return <group>
    {protector.parts.map(part => {
      const angle = part.rotationY, t = part.thickness * unit;
      const position: [number, number, number] = part.kind === "cover" ? [0, protector.coverUnderside * unit + (exploded ? 0.7 : 0), 0]
        : part.kind === "strip" ? [part.center[0] * unit, (config.height + protector.retention.stripBottom) * unit + (exploded ? 1.3 : 0), -part.center[1] * unit]
        : [part.center[0] * unit - Math.sin(angle) * t / 2, config.height * unit, -part.center[1] * unit - Math.cos(angle) * t / 2];
      return <group key={part.id} position={position} rotation={[0, angle, 0]}>
        <group rotation={part.kind === "foot" ? [0, 0, 0] : [-Math.PI / 2, 0, 0]}>
          <Sheet polygons={part.polygons} {...sheetMaterial(config, part.id)} />
        </group>
      </group>;
    })}
    {instrument && config.object ? <UploadedObject object={config.object} angle={config.angle} centeredDepth /> : instrument && <group>
      <mesh position={[0, config.height * unit / 2, 0]}><boxGeometry args={[config.width * unit, config.height * unit, config.depth * unit]} /><meshStandardMaterial color="#383c39" roughness={0.8} /></mesh>
      <mesh position={[0, config.height * unit + 0.006, config.depth * unit * 0.2]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[(config.width - 45) * unit, config.depth * unit * 0.35]} /><meshStandardMaterial color="#73796e" /></mesh>
      {[-0.3, -0.1, 0.1, 0.3].map(x => <mesh key={x} position={[config.width * x * unit, (config.height + 6) * unit, -config.depth * 0.2 * unit]}><cylinderGeometry args={[0.045, 0.045, 0.12, 16]} /><meshStandardMaterial color="#91978b" roughness={0.6} /></mesh>)}
    </group>}
  </group>;
}
function CameraRig({ protector, view, resetKey, exploded }: Props) {
  const controls = useRef<OrbitControlsImpl>(null);
  const { camera, size, invalidate } = useThree();
  const width = protector.dimensions.width * unit, depth = protector.dimensions.depth * unit;
  const height = protector.overallHeight * unit + (exploded ? 1.3 : 0);
  useEffect(() => {
    const aspect = size.width / Math.max(1, size.height);
    const span = view === "side" ? depth : view === "top" ? width : Math.hypot(width, depth);
    const distance = Math.max(span / aspect, view === "top" ? depth : height, 1.5) * 2.25;
    const target = new Vector3(0, height / 2, 0);
    const direction = view === "side" ? new Vector3(1, 0, 0) : view === "top" ? new Vector3(0, 1, 0.001) : new Vector3(0.8, 0.65, 1).normalize();
    camera.position.copy(target).addScaledVector(direction, distance); camera.lookAt(target);
    if (controls.current) { controls.current.target.copy(target); controls.current.update(); }
    invalidate();
  }, [camera, size.width, size.height, width, depth, height, view, resetKey, invalidate]);
  return <OrbitControls ref={controls} makeDefault enablePan={false} minDistance={1} maxDistance={80} maxPolarAngle={Math.PI / 2} />;
}
export function ProtectorPreview(props: Props) {
  return <PreviewBoundary><Canvas camera={{ position: [5, 4, 6], fov: 34, near: 0.01, far: 150 }} dpr={[1, 1.75]} frameloop="demand" gl={{ alpha: true, antialias: true }} fallback={<div className="preview-fallback">WebGL is unavailable. Select Cutting layout to inspect your parts.</div>}>
    <ambientLight intensity={props.dark ? 0.8 : 1.3} /><directionalLight position={[3, 7, 5]} intensity={2.5} /><directionalLight position={[-5, 3, -2]} intensity={1.5} color="#e6efff" />
    <Suspense fallback={null}><Environment resolution={128} frames={1}><Lightformer position={[0, 5, -3]} rotation={[Math.PI / 2, 0, 0]} scale={[10, 8, 1]} intensity={3} /><Lightformer position={[-5, 2, 1]} rotation={[0, Math.PI / 2, 0]} scale={[6, 3, 1]} intensity={4} /></Environment><ProtectorModel {...props} /><ContactShadows key={JSON.stringify([{ ...props.protector.config, object: props.protector.config.object ? { name: props.protector.config.object.name, units: props.protector.config.object.units, up: props.protector.config.object.up, turn: props.protector.config.object.turn } : null }, props.exploded, props.instrument])} position={[0, -0.02, 0]} opacity={props.dark ? 0.45 : 0.25} scale={35} blur={2.4} far={10} resolution={512} frames={1} color="#24231e" /></Suspense>
    <CameraRig {...props} />
  </Canvas></PreviewBoundary>;
}
