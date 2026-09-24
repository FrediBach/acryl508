"use client";
import { Component, Suspense, useEffect, useMemo, useRef, type ReactNode } from "react";
import { ContactShadows, Environment, Lightformer, Line, OrbitControls } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { Path, Shape, Vector3 } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { patchBoardLayout } from "@/lib/patch-board";
import { caseDimensions, handleDimensions, panelTint, panelTransparency, rackEnvelope, rackRowLayout, sidePanelMargin, type CaseConfiguration } from "@/lib/configurator";
import { acrylicMaterial, acrylicEdgeOpacity } from "@/lib/acrylic-material";
import { caseLift } from "@/lib/acrylic-profiles";
import { cableHolderLayout } from "@/lib/cable-holder";
import type { CasePanels } from "@/lib/case-panels";
import { panelEdgePoints } from "@/lib/panel-edges";
import { TrolleyPreview } from "@/components/trolley-preview";
import { SinusodaPreview } from "@/components/sinusoda-preview";
import { CompactPwrPreview } from "@/components/compactpwr-preview";

export type CameraView = "perspective" | "front" | "top";
type Props = { panels: CasePanels; config: CaseConfiguration; dark: boolean; view: CameraView; resetKey: number; exploded: boolean; modules: boolean };
const unit = 0.01;

function PanelEdges({ args, color, opacity = 1, threshold = 15 }: { args: readonly [Shape | Shape[], { depth: number; curveSegments?: number }]; color: string; opacity?: number; threshold?: number }) {
  const [shapes, { depth, curveSegments = 12 }] = args;
  const points = useMemo(() => panelEdgePoints(shapes, depth, curveSegments, threshold), [shapes, depth, curveSegments, threshold]);
  return points.length ? <Line segments points={points} color={color} transparent={opacity < 1} opacity={opacity} depthWrite={opacity === 1} raycast={() => null} /> : null;
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
function Rail({ width, y, z }: { width: number; y: number; z: number }) {
  const positions = useMemo(() => Array.from({ length: Math.max(1, Math.floor(width / 0.0508)) }, (_, index) => -width / 2 + 0.0254 + index * 0.0508), [width]);
  return <group position={[0, y, z]}>
    <mesh castShadow><boxGeometry args={[width, 0.095, 0.095]} /><meshStandardMaterial color="#bcc0bf" metalness={0.9} roughness={0.3} /></mesh>
    <mesh position={[0, 0.05, 0]}><boxGeometry args={[width, 0.006, 0.031]} /><meshStandardMaterial color="#45494a" metalness={0.65} roughness={0.4} /></mesh>
    {positions.map((x, index) => <mesh key={index} position={[x, 0.054, 0]}><cylinderGeometry args={[0.008, 0.008, 0.002, 6]} /><meshStandardMaterial color="#111415" /></mesh>)}
    {[-1, 1].map(side => <mesh key={side} position={[0, -0.005, side * 0.05]}><boxGeometry args={[width, 0.02, 0.006]} /><meshStandardMaterial color="#666c6d" metalness={0.8} roughness={0.24} /></mesh>)}
  </group>;
}
function RailFastener({ side, width, thickness, y, z, explode }: { side: number; width: number; thickness: number; y: number; z: number; explode: number }) {
  const face = width / 2 + explode * 1.5;
  const shaftLength = thickness + 0.06;
  return <group position={[0, y, z]}>
    <Washer x={side * (width / 2 + 0.005 + explode * 1.25)} />
    <mesh position={[side * (face + 0.01 - shaftLength / 2), 0, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.015, 0.015, shaftLength, 16]} /><meshStandardMaterial color="#36383a" metalness={0.8} roughness={0.3} /></mesh>
    <Screw side position={[side * (face + 0.024), 0, 0]} />
  </group>;
}
function ExampleModules({ width, y, z, units, length }: { width: number; y: number; z: number; units: 1 | 3; length: number }) {
  const count = Math.max(2, Math.floor(width / 0.43));
  const panelWidth = width / count;
  const panelLength = length - 0.0485;
  const controls = units === 1 ? [0] : [-0.35, 0, 0.35];
  return <group position={[0, y, z]}>{Array.from({ length: count }, (_, i) => <group key={i} position={[-width / 2 + (i + 0.5) * panelWidth, 0, 0]}>
    <mesh castShadow><boxGeometry args={[panelWidth - 0.007, 0.02, panelLength]} /><meshStandardMaterial color={i % 4 === 2 ? "#242729" : "#c7c9c4"} metalness={0.5} roughness={0.45} /></mesh>
    {controls.map((controlZ, j) => <group key={j} position={[0, 0.055, controlZ]}><mesh castShadow><cylinderGeometry args={[0.048, 0.058, 0.075, 24]} /><meshStandardMaterial color="#171a1a" roughness={0.62} /></mesh><mesh position={[0, 0.039, -0.023]}><boxGeometry args={[0.005, 0.002, 0.024]} /><meshStandardMaterial color="#dedbd2" /></mesh></group>)}
    {[-1, 1].map(side => <Screw key={side} position={[0, 0.022, side * (panelLength / 2 - 0.0525)]} />)}
  </group>)}</group>;
}
function AcrylicCase({ config, panels, exploded, modules }: Pick<Props, "config" | "panels" | "exploded" | "modules">) {
  const { width, length } = caseDimensions(config);
  const w = width * unit, l = length * unit, h = (config.depth + config.thickness + sidePanelMargin(config)) * unit, t = config.thickness * unit;
  const a = config.angle * Math.PI / 180;
  const lift = caseLift(l, config.angle, rackEnvelope(config).angled);
  const explode = exploded ? 0.4 : 0;
  const { baseBottom, baseTop, endOuter } = panels.layout;
  const tints = { bottom: panelTint(config, "bottom"), left: panelTint(config, "left"), right: panelTint(config, "right"), rear: panelTint(config, "rear"), front: panelTint(config, "front") };
  const baseArgs = useMemo(() => [panels.faces.bottom.shapes, { depth: t, bevelEnabled: false, curveSegments: 8 }] as const, [panels, t]);
  const leftArgs = useMemo(() => [panels.faces.left.shapes, { depth: t, bevelEnabled: false, curveSegments: 12 }] as const, [panels, t]);
  const rightArgs = useMemo(() => [panels.faces.right.shapes, { depth: t, bevelEnabled: false, curveSegments: 12 }] as const, [panels, t]);
  const rearArgs = useMemo(() => [panels.faces.rear.shapes, { depth: t, bevelEnabled: false, curveSegments: 12 }] as const, [panels, t]);
  const frontArgs = useMemo(() => [panels.faces.front.shapes, { depth: t, bevelEnabled: false }] as const, [panels, t]);
  return <group>
    <group rotation={[a, 0, 0]} position={[0, lift, 0]}>
      <mesh position={[0, baseBottom - explode, 0]} rotation={[-Math.PI / 2, 0, 0]}><extrudeGeometry args={baseArgs} /><meshPhysicalMaterial {...acrylicMaterial(tints.bottom, t, panelTransparency(config, "bottom"))} /><PanelEdges args={baseArgs} color={tints.bottom.color} opacity={acrylicEdgeOpacity(panelTransparency(config, "bottom"))} threshold={35} /></mesh>
      {[-1, 1].map(side => <group key={side}>
        <mesh position={[side * (w / 2 - t / 2 + explode) - t / 2, 0, 0]} rotation={[0, Math.PI / 2, 0]}><extrudeGeometry args={side === -1 ? leftArgs : rightArgs} /><meshPhysicalMaterial {...acrylicMaterial(side === -1 ? tints.left : tints.right, t, panelTransparency(config, side === -1 ? "left" : "right"))} /><PanelEdges args={side === -1 ? leftArgs : rightArgs} color={side === -1 ? tints.left.color : tints.right.color} opacity={acrylicEdgeOpacity(panelTransparency(config, side === -1 ? "left" : "right"))} threshold={35} /></mesh>
        <mesh position={[0, 0, side * (endOuter - t / 2 + explode) - t / 2]}><extrudeGeometry args={side === -1 ? rearArgs : frontArgs} /><meshPhysicalMaterial {...acrylicMaterial(side === -1 ? tints.rear : tints.front, t, panelTransparency(config, side === -1 ? "rear" : "front"))} /><PanelEdges args={side === -1 ? rearArgs : frontArgs} color={side === -1 ? tints.rear.color : tints.front.color} opacity={acrylicEdgeOpacity(panelTransparency(config, side === -1 ? "rear" : "front"))} /></mesh>
      </group>)}
      {rackRowLayout(config).map(row => {
        const z = row.center * unit, railOffset = row.railOffset * unit, length = row.length * unit;
        return <group key={row.index} position={[0, h + row.rise * unit, z]} rotation={[row.angle * Math.PI / 180, 0, 0]}>{[-1, 1].map(end => <group key={end}><Rail width={w - 2 * t} y={-0.07 + explode} z={end * railOffset} />{[-1, 1].map(side => <RailFastener key={side} side={side} width={w} thickness={t} y={-0.07} z={end * railOffset} explode={explode} />)}</group>)}{modules && <ExampleModules width={w - 2 * t - 0.02} y={explode * 2} z={0} units={row.units} length={length} />}</group>;
      })}
      {config.busboard === "sinusoda" && panels.powerBoard?.fits && <SinusodaPreview baseTop={baseTop - explode} />}
      {config.busboard === "trolley" && panels.powerBoard?.fits && <TrolleyPreview baseTop={baseTop - explode} offsetX={panels.powerBoard.x} />}
      {config.busboard === "compactpwr" && panels.powerBoard?.fits && <CompactPwrPreview baseTop={baseTop - explode} />}
    </group>
  </group>;
}
function CameraRig({ config, view, resetKey, exploded }: Pick<Props, "config" | "view" | "resetKey" | "exploded">) {
  const controls = useRef<OrbitControlsImpl>(null);
  const { camera, size, invalidate } = useThree();
  const dimensions = caseDimensions(config);
  const width = dimensions.width * unit, length = dimensions.length * unit, height = dimensions.height * unit;
  const handleSize = handleDimensions(config);
  const automaticFeet = rackEnvelope(config).angled;
  const board = patchBoardLayout(config);
  const gripWidth = Math.max(config.handle ? handleSize.width * unit : 0, config.patchBoard ? board.width * unit : 0);
  const gripRise = Math.max((config.handle ? handleSize.height * unit : 0) + (config.patchBoard ? board.height * unit : 0), config.cableHolder ? cableHolderLayout(config).height * unit : 0);
  useEffect(() => {
    const aspect = size.width / size.height;
    const radians = config.angle * Math.PI / 180;
    const totalHeight = caseLift(length, config.angle, automaticFeet) + Math.sin(radians) * Math.max(length, gripWidth) / 2 + Math.cos(radians) * (height + gripRise);
    const fit = Math.max(width / aspect, Math.max(length, gripWidth) * 0.85, totalHeight * 1.3, 1.85) * (exploded ? 2.8 : 2.35);
    const target = new Vector3(0, totalHeight / 2, 0);
    const direction = view === "top" ? new Vector3(0, 1, 0.001) : view === "front" ? new Vector3(0, 0.1, 1) : new Vector3(0.65, 0.72, 1).normalize();
    camera.position.copy(target).addScaledVector(direction, fit);
    camera.lookAt(target);
    if (controls.current) { controls.current.target.copy(target); controls.current.update(); }
    invalidate();
  }, [camera, size.width, size.height, width, length, height, config.angle, automaticFeet, gripWidth, gripRise, view, resetKey, exploded, invalidate]);
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
