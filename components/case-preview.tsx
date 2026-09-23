"use client";
import { Component, Suspense, useEffect, useMemo, useRef, type ReactNode } from "react";
import { ContactShadows, Edges, Environment, Lightformer, OrbitControls } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { Path, Shape, Vector3, type MeshPhysicalMaterialParameters } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { caseDimensions, type CaseConfiguration } from "@/lib/configurator";
import { caseLift, createFootProfile, createHandleProfile, footFloor, footHoleRadius, footMountLayout, footPanelGap, handleLayout, handleRise } from "@/lib/acrylic-profiles";

export type CameraView = "perspective" | "front" | "top";
type Props = { config: CaseConfiguration; dark: boolean; view: CameraView; resetKey: number; exploded: boolean; modules: boolean };
const unit = 0.01;

function rectangularShape(width: number, height: number) {
  const shape = new Shape();
  shape.moveTo(-width / 2, -height / 2); shape.lineTo(width / 2, -height / 2);
  shape.lineTo(width / 2, height / 2); shape.lineTo(-width / 2, height / 2); shape.closePath();
  return shape;
}
function hole(shape: Shape, x: number, y: number, radius: number) {
  const path = new Path(); path.absarc(x, y, radius, 0, Math.PI * 2, true); shape.holes.push(path);
}
function Screw({ position, side = false, rear = false }: { position: [number, number, number]; side?: boolean; rear?: boolean }) {
  return <group position={position} rotation={rear ? [-Math.PI / 2, 0, 0] : side ? [0, 0, -Math.sign(position[0]) * Math.PI / 2] : [0, 0, 0]}>
    <mesh><cylinderGeometry args={[0.035, 0.035, 0.027, 20]} /><meshStandardMaterial color="#252628" metalness={0.72} roughness={0.3} /></mesh>
    <mesh position={[0, 0.014, 0]}><cylinderGeometry args={[0.014, 0.014, 0.002, 6]} /><meshStandardMaterial color="#050606" roughness={0.85} /></mesh>
  </group>;
}
function Washer({ x, radius = 0.055, thickness = 0.01 }: { x: number; radius?: number; thickness?: number }) {
  const shape = useMemo(() => {
    const profile = new Shape();
    profile.absarc(0, 0, radius, 0, Math.PI * 2, false);
    hole(profile, 0, 0, 0.017);
    return profile;
  }, [radius]);
  const args = useMemo(() => [shape, { depth: thickness, bevelEnabled: false, curveSegments: 16 }] as const, [shape, thickness]);
  return <mesh position={[x - thickness / 2, 0, 0]} rotation={[0, Math.PI / 2, 0]}><extrudeGeometry args={args} /><meshStandardMaterial color="#484b47" roughness={0.85} /></mesh>;
}
function FootFastener({ side, width, thickness, y, z, explode }: { side: number; width: number; thickness: number; y: number; z: number; explode: number }) {
  const footInner = width / 2 + footPanelGap + explode * 2;
  const footOuter = footInner + thickness;
  const boltStart = width / 2 - thickness - 0.05 + explode * 3;
  const boltEnd = width / 2 + footPanelGap + thickness + 0.01 + explode * 3;
  return <group position={[0, y, z]}>
    <mesh position={[side * (boltStart + boltEnd) / 2, 0, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.015, 0.015, boltEnd - boltStart, 16]} /><meshStandardMaterial color="#36383a" metalness={0.8} roughness={0.3} /></mesh>
    <Screw side position={[side * (boltEnd + 0.014), 0, 0]} />
    <Washer x={side * (footOuter + 0.005 + explode * 0.5)} />
    <Washer x={side * (width / 2 - thickness - 0.005 + explode * 0.5)} />
    <Washer x={side * (width / 2 + footPanelGap / 2 + explode * 1.5)} radius={0.047} thickness={footPanelGap} />
    <mesh position={[side * (width / 2 - thickness - 0.028 + explode * 0.25), 0, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.032, 0.032, 0.036, 6]} /><meshStandardMaterial color="#252628" metalness={0.72} roughness={0.35} /></mesh>
  </group>;
}
function Rail({ width, y, z }: { width: number; y: number; z: number }) {
  const positions = useMemo(() => Array.from({ length: Math.max(1, Math.floor(width / 0.0508)) }, (_, index) => -width / 2 + 0.0254 + index * 0.0508), [width]);
  return <group position={[0, y, z]}>
    <mesh castShadow><boxGeometry args={[width, 0.095, 0.095]} /><meshStandardMaterial color="#bcc0bf" metalness={0.9} roughness={0.3} /></mesh>
    <mesh position={[0, 0.05, 0]}><boxGeometry args={[width, 0.006, 0.031]} /><meshStandardMaterial color="#45494a" metalness={0.65} roughness={0.4} /></mesh>
    {positions.map((x, index) => <mesh key={index} position={[x, 0.054, 0]}><cylinderGeometry args={[0.008, 0.008, 0.002, 6]} /><meshStandardMaterial color="#111415" /></mesh>)}
    {[-1, 1].map(side => <mesh key={side} position={[0, -0.005, side * 0.05]}><boxGeometry args={[width, 0.02, 0.006]} /><meshStandardMaterial color="#666c6d" metalness={0.8} roughness={0.24} /></mesh>)}
  </group>;
}
function ExampleModules({ width, y, z }: { width: number; y: number; z: number }) {
  const count = Math.max(2, Math.floor(width / 0.43));
  const panelWidth = width / count;
  return <group position={[0, y, z]}>{Array.from({ length: count }, (_, i) => <group key={i} position={[-width / 2 + (i + 0.5) * panelWidth, 0, 0]}>
    <mesh castShadow><boxGeometry args={[panelWidth - 0.007, 0.02, 1.285]} /><meshStandardMaterial color={i % 4 === 2 ? "#242729" : "#c7c9c4"} metalness={0.5} roughness={0.45} /></mesh>
    {[-0.35, 0, 0.35].map((z, j) => <group key={j} position={[0, 0.055, z]}><mesh castShadow><cylinderGeometry args={[0.048, 0.058, 0.075, 24]} /><meshStandardMaterial color="#171a1a" roughness={0.62} /></mesh><mesh position={[0, 0.039, -0.023]}><boxGeometry args={[0.005, 0.002, 0.024]} /><meshStandardMaterial color="#dedbd2" /></mesh></group>)}
    {[-1, 1].map(side => <Screw key={side} position={[0, 0.022, side * 0.59]} />)}
  </group>)}</group>;
}
function AcrylicCase({ config, exploded, modules }: Pick<Props, "config" | "exploded" | "modules">) {
  const { width, length, height } = caseDimensions(config);
  const w = width * unit, l = length * unit, h = height * unit, t = config.thickness * unit;
  const a = config.angle * Math.PI / 180;
  const lift = caseLift(l, config.angle);
  const explode = exploded ? 0.4 : 0;
  const footMounts = useMemo(() => footMountLayout(l, config.angle, t), [l, config.angle, t]);
  const acrylic = useMemo<MeshPhysicalMaterialParameters>(() => ({ color: config.tint.color, metalness: 0, roughness: 0.13, transmission: 0.88, thickness: t * 2, ior: 1.49, clearcoat: 1, clearcoatRoughness: 0.07, envMapIntensity: 1.25, attenuationColor: config.tint.color, attenuationDistance: 0.7 }), [config.tint.color, t]);
  const base = useMemo(() => {
    const shape = rectangularShape(w, l);
    if (config.vents) {
      const count = Math.max(3, Math.floor((w - 0.5) / 0.12));
      for (let i = 0; i < count; i++) {
        const x = (i - (count - 1) / 2) * 0.12;
        for (const side of [-1, 1]) {
          const path = new Path(); const y = side * l * 0.28;
          path.moveTo(x - 0.017, y - l * 0.09); path.lineTo(x - 0.017, y + l * 0.09);
          path.absarc(x, y + l * 0.09, 0.017, Math.PI, 0, true);
          path.lineTo(x + 0.017, y - l * 0.09); path.absarc(x, y - l * 0.09, 0.017, 0, Math.PI, true); path.closePath(); shape.holes.push(path);
        }
      }
    }
    for (const x of [-1, 1]) for (const y of [-1, 1]) hole(shape, x * (w / 2 - 0.12), y * (l / 2 - 0.12), 0.022);
    return shape;
  }, [w, l, config.vents]);
  const sideShape = useMemo(() => {
    const shape = rectangularShape(l, h - t);
    for (let row = 0; row < config.rows; row++) for (const end of [-1, 1]) {
      hole(shape, -l / 2 + t + (row + 0.5) * 1.3335 + end * 0.6125, (h - t) / 2 - 0.07, 0.019);
    }
    if (config.angle > 0) for (const mount of footMounts) hole(shape, -mount.caseZ, mount.caseY - t - (h - t) / 2, footHoleRadius);
    return shape;
  }, [l, h, t, config.rows, config.angle, footMounts]);
  const footShape = useMemo(() => createFootProfile(l, config.angle, t, config.footShape), [l, config.angle, t, config.footShape]);
  const handleShape = useMemo(() => createHandleProfile(w - 2 * t), [w, t]);
  const handle = handleLayout(w - 2 * t);
  const rearShape = useMemo(() => {
    const shape = rectangularShape(w - 2 * t, h - t);
    if (config.handle) for (const side of [-1, 1]) hole(shape, side * handle.mountX, (h - t) / 2 + handle.mountY, 0.022);
    return shape;
  }, [w, h, t, config.handle, handle.mountX, handle.mountY]);
  const baseArgs = useMemo(() => [base, { depth: t, bevelEnabled: false, curveSegments: 8 }] as const, [base, t]);
  const sideArgs = useMemo(() => [sideShape, { depth: t, bevelEnabled: false, curveSegments: 12 }] as const, [sideShape, t]);
  const footArgs = useMemo(() => [footShape, { depth: t, bevelEnabled: false, curveSegments: 24 }] as const, [footShape, t]);
  const handleArgs = useMemo(() => [handleShape, { depth: t, bevelEnabled: false, curveSegments: 16 }] as const, [handleShape, t]);
  const rearArgs = useMemo(() => [rearShape, { depth: t, bevelEnabled: false, curveSegments: 12 }] as const, [rearShape, t]);
  return <group>
    {config.angle > 0 && [-1, 1].map(side => <group key={side}>
      <mesh castShadow position={[side * (w / 2 + t / 2 + footPanelGap + explode * 2) - t / 2, footFloor, 0]} rotation={[0, Math.PI / 2, 0]}><extrudeGeometry args={footArgs} /><meshPhysicalMaterial {...acrylic} /><Edges color={config.tint.color} threshold={30} /></mesh>
      {footMounts.map((mount, index) => <FootFastener key={index} side={side} width={w} thickness={t} y={footFloor + mount.y} z={-mount.x} explode={explode} />)}
    </group>)}
    <group rotation={[a, 0, 0]} position={[0, lift, 0]}>
      <mesh position={[0, -explode, 0]} rotation={[-Math.PI / 2, 0, 0]}><extrudeGeometry args={baseArgs} /><meshPhysicalMaterial {...acrylic} /><Edges color={config.tint.color} threshold={35} /></mesh>
      {[-1, 1].map(side => <group key={side}>
        <mesh position={[side * (w / 2 - t / 2 + explode) - t / 2, t + (h - t) / 2, 0]} rotation={[0, Math.PI / 2, 0]}><extrudeGeometry args={sideArgs} /><meshPhysicalMaterial {...acrylic} /><Edges color={config.tint.color} threshold={35} /></mesh>
        {side === -1 ? <mesh position={[0, t + (h - t) / 2, -l / 2 - explode]}><extrudeGeometry args={rearArgs} /><meshPhysicalMaterial {...acrylic} /><Edges color={config.tint.color} /></mesh> : <mesh position={[0, t + (h - t) / 2, l / 2 - t / 2 + explode]}><boxGeometry args={[w - 2 * t, h - t, t]} /><meshPhysicalMaterial {...acrylic} /><Edges color={config.tint.color} /></mesh>}
      </group>)}
      {config.handle && <group position={[0, h, -l / 2 - t - explode * 2]}>
        <mesh castShadow><extrudeGeometry args={handleArgs} /><meshPhysicalMaterial {...acrylic} /><Edges color={config.tint.color} threshold={35} /></mesh>
        {[-1, 1].map(side => <Screw key={side} rear position={[side * handle.mountX, handle.mountY, -0.014 - explode * 0.5]} />)}
      </group>}
      {Array.from({ length: config.rows }, (_, row) => {
        const z = -l / 2 + t + (row + 0.5) * 1.3335;
        return <group key={row}>{[-1, 1].map(end => <group key={end}><Rail width={w - 2 * t} y={h - 0.07 + explode} z={z + end * 0.6125} />{[-1, 1].map(side => <Screw key={side} side position={[side * (w / 2 + 0.012 + explode * 1.4), h - 0.07, z + end * 0.6125]} />)}</group>)}{modules && <ExampleModules width={w - 2 * t - 0.02} y={h + explode * 2} z={z} />}</group>;
      })}
      {config.busboard !== "none" && <group position={[0, t + 0.08, 0]}>
        <mesh><boxGeometry args={[Math.min(w - 0.3, 2.8), 0.018, 0.31]} /><meshStandardMaterial color={config.busboard === "sinusoda" ? "#222e2a" : "#174b35"} roughness={0.65} /></mesh>
        {Array.from({ length: Math.max(2, Math.floor(Math.min(w - 0.3, 2.8) / 0.25)) }, (_, i) => <mesh key={i} position={[-Math.min(w - 0.3, 2.8) / 2 + 0.14 + i * 0.25, 0.044, 0]}><boxGeometry args={[0.15, 0.075, 0.13]} /><meshStandardMaterial color="#181c1c" roughness={0.75} /></mesh>)}
        {[-1, 1].map(side => <Screw key={side} position={[side * (Math.min(w - 0.3, 2.8) / 2 - 0.045), 0.03, 0.105]} />)}
      </group>}
    </group>
  </group>;
}
function CameraRig({ config, view, resetKey, exploded }: Pick<Props, "config" | "view" | "resetKey" | "exploded">) {
  const controls = useRef<OrbitControlsImpl>(null);
  const { camera, size, invalidate } = useThree();
  const dimensions = caseDimensions(config);
  const width = dimensions.width * unit, length = dimensions.length * unit, height = dimensions.height * unit;
  useEffect(() => {
    const aspect = size.width / size.height;
    const radians = config.angle * Math.PI / 180;
    const totalHeight = caseLift(length, config.angle) + Math.sin(radians) * length / 2 + Math.cos(radians) * (height + (config.handle ? handleRise : 0));
    const fit = Math.max(width / aspect, length * 0.85, totalHeight * 1.3, 1.85) * (exploded ? 2.8 : 2.35);
    const target = new Vector3(0, totalHeight / 2, 0);
    const direction = view === "top" ? new Vector3(0, 1, 0.001) : view === "front" ? new Vector3(0, 0.1, 1) : new Vector3(0.65, 0.72, 1).normalize();
    camera.position.copy(target).addScaledVector(direction, fit);
    camera.lookAt(target);
    if (controls.current) { controls.current.target.copy(target); controls.current.update(); }
    invalidate();
  }, [camera, size.width, size.height, width, length, height, config.angle, config.handle, view, resetKey, exploded, invalidate]);
  return <OrbitControls ref={controls} makeDefault enablePan={false} enableDamping minDistance={1.3} maxDistance={28} maxPolarAngle={Math.PI / 2 - 0.03} />;
}
class PreviewBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <div className="preview-fallback"><strong>3D preview unavailable</strong><p>Enable WebGL in your browser to explore the case.<br />Your controls and configuration export still work.</p></div> : this.props.children; }
}
export function CasePreview(props: Props) {
  return <PreviewBoundary><Canvas camera={{ position: [5, 4, 6], fov: 34, near: 0.01, far: 100 }} dpr={[1, 1.75]} frameloop="demand" gl={{ alpha: true, antialias: true }} fallback={<div className="preview-fallback">WebGL is required for the 3D preview. Configuration export is still available.</div>}>
    <ambientLight intensity={props.dark ? 0.8 : 1.3} /><directionalLight position={[3, 7, 5]} intensity={2.5} color="#fff9ed" /><directionalLight position={[-5, 3, -2]} intensity={1.5} color="#e6efff" />
    <Suspense fallback={null}><Environment resolution={128} frames={1}><Lightformer position={[0, 5, -3]} rotation={[Math.PI / 2, 0, 0]} scale={[10, 8, 1]} intensity={3} /><Lightformer position={[-5, 2, 1]} rotation={[0, Math.PI / 2, 0]} scale={[6, 3, 1]} intensity={4} /><Lightformer position={[5, 3, 1]} rotation={[0, -Math.PI / 2, 0]} scale={[3, 5, 1]} intensity={2} /></Environment><AcrylicCase {...props} /><ContactShadows key={JSON.stringify([props.config, props.exploded, props.modules])} position={[0, -0.02, 0]} opacity={props.dark ? 0.48 : 0.3} scale={20} blur={2.4} far={7} resolution={512} frames={1} color="#24231e" /></Suspense><CameraRig {...props} />
  </Canvas></PreviewBoundary>;
}
