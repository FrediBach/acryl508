"use client";
import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, Line, OrbitControls } from "@react-three/drei";
import { Path, Shape, Vector3 } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { acrylicMaterial, acrylicEdgeOpacity } from "@/lib/acrylic-material";
import { bentPanelGeometry, bentPanelEdges } from "@/lib/bent-panel-geometry";
import { panelEdgePoints } from "@/lib/panel-edges";
import type { Art, ArtPart } from "@/lib/art";
import { PreviewBoundary } from "./stand-preview";
export type ArtView = "perspective" | "side" | "top";
type Props = { art: Art; dark: boolean; exploded: boolean; view: ArtView; resetKey: number };
function ArtSheet({ part, art }: { part: ArtPart; art: Art }) {
  const { thickness, tint, transparency } = art.config;
  const { geometry, edges } = useMemo(() => {
    const shapes = part.polygons.map(polygon => {
      const shape = new Shape();
      polygon.forEach((ring, index) => {
        const path = index ? new Path() : shape;
        ring.forEach(([x,y], i) => i ? path.lineTo(x / 100,y / 100) : path.moveTo(x / 100,y / 100));
        path.closePath(); if (index) shape.holes.push(path);
      });
      return shape;
    });
    const bends = part.bend ? [part.bend] : [], depth = thickness / 100;
    return { geometry: bentPanelGeometry(shapes, depth, bends, part.direction), edges: bentPanelEdges(panelEdgePoints(shapes, depth, 12, 15), depth, bends, part.direction) };
  }, [part, thickness]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const opacity = acrylicEdgeOpacity(transparency);
  return <mesh geometry={geometry}><meshPhysicalMaterial {...acrylicMaterial(tint, thickness / 100, transparency)} />{edges.length > 0 && <Line points={edges} segments color={tint.color} transparent={opacity < 1} opacity={opacity} depthWrite={opacity === 1} raycast={() => null} />}</mesh>;
}
function CameraRig({ art, view, exploded, resetKey }: Omit<Props, "dark">) {
  const controls = useRef<OrbitControlsImpl>(null), { camera, size, invalidate } = useThree();
  const width = art.dimensions.width / 100, depth = art.dimensions.depth / 100;
  const height = art.dimensions.height / 100 + (exploded ? art.baseHeight / 100 + 0.5 : 0);
  useEffect(() => {
    const aspect = size.width / Math.max(1,size.height);
    const span = view === "side" ? depth : view === "top" ? width : Math.hypot(width,depth);
    const distance = Math.max(span / aspect, view === "top" ? depth : height, 1.5) * 2.2;
    const target = new Vector3(0,height / 2,0);
    const direction = view === "side" ? new Vector3(1,0,0) : view === "top" ? new Vector3(0,1,0.001) : new Vector3(0.8,0.5,1).normalize();
    camera.position.copy(target).addScaledVector(direction,distance); camera.lookAt(target);
    if (controls.current) { controls.current.target.copy(target); controls.current.update(); }
    invalidate();
  }, [camera, size.width, size.height, width, depth, height, view, resetKey, invalidate]);
  return <OrbitControls ref={controls} makeDefault enablePan={false} minDistance={1} maxDistance={80} maxPolarAngle={Math.PI / 2} />;
}
export function ArtPreview(props: Props) {
  const { art, exploded, dark } = props, t = art.config.thickness / 100;
  return <PreviewBoundary><Canvas camera={{ position: [5,4,6], fov: 34, near: 0.01, far: 150 }} dpr={[1,1.75]} frameloop="demand" gl={{ alpha: true, antialias: true }} fallback={<div className="preview-fallback">WebGL is unavailable. Select Cutting layout to inspect your sheets.</div>}>
    <ambientLight intensity={dark ? 0.8 : 1.3} /><directionalLight position={[3,7,5]} intensity={2.5} /><directionalLight position={[-5,3,-2]} intensity={1.5} color="#e6efff" />
    <Suspense fallback={null}><Environment resolution={128} frames={1}><Lightformer position={[0,5,-3]} rotation={[Math.PI/2,0,0]} scale={[10,8,1]} intensity={3} /><Lightformer position={[-5,2,1]} rotation={[0,Math.PI/2,0]} scale={[6,3,1]} intensity={4} /></Environment>
      {art.parts.map(part => <group key={part.id} position={part.family === "a" ? [0, exploded ? art.baseHeight / 100 + 0.5 : 0, part.position / 100 - t / 2] : [part.position / 100 - t / 2,0,0]} rotation={[0,part.family === "a" ? 0 : Math.PI / 2,0]}><ArtSheet part={part} art={art} /></group>)}
      <ContactShadows key={JSON.stringify([art.config,exploded])} position={[0,-0.02,0]} opacity={dark ? 0.45 : 0.25} scale={35} blur={2.4} far={10} resolution={512} frames={1} color="#24231e" />
    </Suspense><CameraRig {...props} />
  </Canvas></PreviewBoundary>;
}
