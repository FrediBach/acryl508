"use client";
import { usePresentationCamera } from "@/components/use-presentation-camera";
import { Component, Suspense, useEffect, useMemo, useRef, type ReactNode } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, Line, OrbitControls } from "@react-three/drei";
import { Path, Shape, Vector3 } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { MultiPolygon } from "polygon-clipping";
import { acrylicMaterial, acrylicEdgeOpacity, type AcrylicTint, type AcrylicTransparency } from "@/lib/acrylic-material";
import { UploadedObject } from "@/components/uploaded-object";
import { ExampleSynth } from "@/components/example-synth";
import { sheetMaterial } from "@/lib/sheet-materials";
import type { SynthStand, StandPart } from "@/lib/synth-stand";
import { bentPanelGeometry, bentPanelEdges } from "@/lib/bent-panel-geometry";
import { panelEdgePoints } from "@/lib/panel-edges";

export type StandView = "perspective" | "side" | "top";
type Props = { presentation: boolean; stand: SynthStand; dark: boolean; exploded: boolean; instrument: boolean; view: StandView; resetKey: number };
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
export function Sheet({ polygons, thickness, tint, transparency }: { polygons: MultiPolygon; thickness: number; tint: AcrylicTint; transparency?: AcrylicTransparency }) {
  const shapes = useMemo(() => shapesFrom(polygons), [polygons]);
  const args = useMemo(() => [shapes, { depth: thickness * unit, bevelEnabled: false }] as const, [shapes, thickness]);
  const edges = useMemo(() => panelEdgePoints(shapes, thickness * unit, 12, 15), [shapes, thickness]);
  const edgeOpacity = acrylicEdgeOpacity(transparency);
  return <mesh><extrudeGeometry args={args} /><meshPhysicalMaterial {...acrylicMaterial(tint, thickness * unit, transparency)} />{edges.length > 0 && <Line points={edges} segments color={tint.color} transparent={edgeOpacity < 1} opacity={edgeOpacity} depthWrite={edgeOpacity === 1} raycast={() => null} />}</mesh>;
}
function StandModel({ stand, exploded, instrument }: Pick<Props, "stand" | "exploded" | "instrument">) {
  const { config, frontHeight } = stand;
  const center = (stand.front + stand.rear) / 2 * unit;
  const lift = exploded ? (config.advancedMode || config.bentSheet ? stand.dimensions.height : stand.braceHeight) * unit + 0.4 : 0;
  const angle = config.angle * Math.PI / 180;
  return <group position={[0, 0, center]}>
    {stand.parts.map(part => part.tray ? <group key={part.id} position={[0, lift * 1.5, 0]}><TraySheet part={part} stand={stand} /></group> : <group key={part.id}
      position={[part.placement.width * unit - Math.sin(part.placement.yaw) * part.thickness * unit / 2, part.family === "a" ? lift : 0, -part.placement.depth * unit - Math.cos(part.placement.yaw) * part.thickness * unit / 2]}
      rotation={[0, part.placement.yaw, 0]}>
      <Sheet polygons={part.polygons} {...sheetMaterial(config, part.id)} />
    </group>)}
    {instrument && config.object ? (config.bentSheet ? <group position={[0, frontHeight * unit + lift * 1.5 + (exploded ? 0.7 : 0), 0]} rotation={[angle, 0, 0]}><UploadedObject object={config.object} angle={0} /></group> : <UploadedObject object={config.object} angle={config.angle} floor={frontHeight} lift={lift + (exploded ? 0.7 : 0)} />) : instrument && <group position={[0, frontHeight * unit + lift * (config.bentSheet ? 1.5 : 1) + (exploded ? 0.7 : 0), 0]} rotation={[angle, 0, 0]}>
      <ExampleSynth width={config.width} depth={config.depth} height={config.height} />
    </group>}
  </group>;
}
function TraySheet({ part, stand }: { part: StandPart; stand: SynthStand }) {
  const { thickness, tint, transparency } = sheetMaterial(stand.config, part.id);
  const { geometry, edges } = useMemo(() => {
    const tray = part.tray!, shapes = shapesFrom(part.polygons);
    const bends = tray.bends.map(b => ({ ...b, start: b.start * unit, length: b.length * unit }));
    const geometry = bentPanelGeometry(shapes, thickness * unit, bends, 1);
    // The bend generator starts along the front lip. Rotate its formed output
    // into the playing plane; map edges with the same transformation.
    const a = stand.config.angle * Math.PI / 180;
    const world = (x: number, y: number, z: number): [number, number, number] => {
      const d = -tray.neutralRadius * unit + z - thickness * unit / 2;
      const n = (tray.neutralRadius + tray.frontLip - thickness / 2) * unit - y;
      return [x, stand.frontHeight * unit + d * Math.sin(a) + n * Math.cos(a), -d * Math.cos(a) + n * Math.sin(a)];
    };
    const positions = geometry.getAttribute("position"), normals = geometry.getAttribute("normal");
    for (let i = 0; i < positions.count; i++) {
      positions.setXYZ(i, ...world(positions.getX(i), positions.getY(i), positions.getZ(i)));
      const ny = normals.getY(i), nz = normals.getZ(i);
      normals.setXYZ(i, normals.getX(i), -ny * Math.cos(a) + nz * Math.sin(a), -ny * Math.sin(a) - nz * Math.cos(a));
    }
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    const edges = bentPanelEdges(panelEdgePoints(shapes, thickness * unit, 12, 15), thickness * unit, bends, 1).map(p => world(...p));
    return { geometry, edges };
  }, [part, thickness, stand.config.angle, stand.frontHeight]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const opacity = acrylicEdgeOpacity(transparency);
  return <mesh geometry={geometry}><meshPhysicalMaterial {...acrylicMaterial(tint, thickness * unit, transparency)} /><Line points={edges} segments color={tint.color} transparent={opacity < 1} opacity={opacity} depthWrite={opacity === 1} raycast={() => null} /></mesh>;
}
function CameraRig({ presentation, stand, view, resetKey, exploded, instrument }: Omit<Props, "dark">) {
  const controls = useRef<OrbitControlsImpl>(null);
  const { camera, size, invalidate } = useThree();
  const width = Math.max(stand.config.width, stand.dimensions.width) * unit;
  const depth = stand.dimensions.depth * unit;
  const height = Math.max(instrument ? stand.synthTop : 0, stand.dimensions.height) * unit + (exploded ? ((stand.config.advancedMode || stand.config.bentSheet ? stand.dimensions.height : stand.braceHeight) * unit + 0.4) * (stand.config.bentSheet ? 1.5 : 1) + 0.7 : 0);
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
  usePresentationCamera(controls, presentation);
  return <OrbitControls ref={controls} enabled={!presentation} enableDamping={!presentation} makeDefault enablePan={false} minDistance={1} maxDistance={80} maxPolarAngle={Math.PI / 2} />;
}
export class PreviewBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <div className="preview-fallback">3D preview unavailable. The cutting layout and exports are still available.</div> : this.props.children; }
}
export function StandPreview(props: Props) {
  return <PreviewBoundary><Canvas camera={{ position: [5, 4, 6], fov: 34, near: 0.01, far: 150 }} dpr={[1, 1.75]} frameloop="demand" gl={{ alpha: true, antialias: true }} fallback={<div className="preview-fallback">WebGL is unavailable. Select Cutting layout to inspect your parts.</div>}>
    <ambientLight intensity={props.dark ? 0.8 : 1.3} /><directionalLight position={[3, 7, 5]} intensity={2.5} /><directionalLight position={[-5, 3, -2]} intensity={1.5} color="#e6efff" />
    <Suspense fallback={null}><Environment resolution={128} frames={1}><Lightformer position={[0, 5, -3]} rotation={[Math.PI / 2, 0, 0]} scale={[10, 8, 1]} intensity={3} /><Lightformer position={[-5, 2, 1]} rotation={[0, Math.PI / 2, 0]} scale={[6, 3, 1]} intensity={4} /></Environment><StandModel {...props} /><ContactShadows key={JSON.stringify([{ ...props.stand.config, object: props.stand.config.object ? { name: props.stand.config.object.name, units: props.stand.config.object.units, up: props.stand.config.object.up, turn: props.stand.config.object.turn } : null }, props.exploded, props.instrument])} position={[0, -0.02, 0]} opacity={props.dark ? 0.45 : 0.25} scale={35} blur={2.4} far={10} resolution={512} frames={1} color="#24231e" /></Suspense>
    <CameraRig {...props} />
  </Canvas></PreviewBoundary>;
}
