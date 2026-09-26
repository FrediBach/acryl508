"use client";
import { Suspense, useEffect, useRef } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Environment, Lightformer, OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { EngravingSurface, LedStripPreview } from "./engraving-preview";
import { PreviewBoundary, Sheet } from "@/components/stand-preview";
import type { DesignedPanel } from "@/lib/panel-designer";
function Engraving({ panel }: { panel: DesignedPanel }) {
  return <><EngravingSurface polygons={panel.engraving.polygons} thickness={panel.config.thickness} tint={panel.config.tint.color} transparency={panel.config.transparency} led={panel.led} /><LedStripPreview led={panel.led} thickness={panel.config.thickness} /></>;
}
function Camera({ panel }: { panel: DesignedPanel }) {
  const { camera, size, invalidate } = useThree(), controls = useRef<OrbitControlsImpl>(null);
  useEffect(() => {
    const span = Math.max(panel.width / 100 / Math.max(0.3, size.width / size.height), panel.height / 100);
    camera.position.set(span * 0.75, span * 0.4, span * 2.5); camera.lookAt(0, 0, 0); controls.current?.target.set(0, 0, 0); controls.current?.update(); invalidate();
  }, [camera, size.width, size.height, panel.width, panel.height, invalidate]);
  return <OrbitControls ref={controls} makeDefault enablePan={false} minDistance={0.2} maxDistance={30} />;
}
export function PanelPreview({ panel, dark }: { panel: DesignedPanel; dark: boolean }) {
  return <PreviewBoundary><Canvas camera={{ position: [1, 1, 4], fov: 34, near: 0.01, far: 100 }} dpr={[1, 1.75]} frameloop="demand" gl={{ alpha: true, antialias: true }} fallback={<div className="preview-fallback">WebGL is unavailable. Use Front editor or Cutting layout.</div>}><ambientLight intensity={dark ? 0.8 : 1.3} /><directionalLight position={[3, 4, 5]} intensity={2.5} /><Suspense fallback={null}><Environment resolution={128} frames={1}><Lightformer position={[0, 3, 4]} scale={[6, 4, 1]} intensity={3} /><Lightformer position={[-4, 1, 2]} rotation={[0, Math.PI / 2, 0]} scale={[4, 3, 1]} intensity={4} /></Environment><Sheet polygons={panel.polygons} thickness={panel.config.thickness} tint={panel.config.tint} transparency={panel.config.transparency} /><Engraving panel={panel} /></Suspense><Camera panel={panel} /></Canvas></PreviewBoundary>;
}
