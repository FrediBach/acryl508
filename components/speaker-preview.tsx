"use client";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, OrbitControls } from "@react-three/drei";
import { ExtrudeGeometry, Path, Shape, Vector3 } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { acrylicMaterial } from "@/lib/acrylic-material";
import { sheetMaterial } from "@/lib/sheet-materials";
import { type Speaker, type SpeakerPart } from "@/lib/speaker";
import { PreviewBoundary } from "./stand-preview";
import { SpeakerHardware } from "./speaker-hardware";
import { SpeakerModelMessage, type SpeakerModelStatus } from "./speaker-model-status";
export type SpeakerView = "perspective" | "front" | "rear";
type Props = { speaker: Speaker; dark: boolean; exploded: boolean; hardware: boolean; view: SpeakerView; resetKey: number };
function Sheet({ part, speaker, exploded }: { part: SpeakerPart; speaker: Speaker; exploded: boolean }) {
  const geometry = useMemo(() => {
    const shapes=part.polygons.map(polygon=>{
      const shape=new Shape();
      polygon.forEach((ring,index)=>{
        const path=index ? new Path() : shape;
        ring.forEach(([x,y],i)=>i ? path.lineTo(x/100,y/100) : path.moveTo(x/100,y/100));
        path.closePath();if(index)shape.holes.push(path);
      });return shape;
    });
    const geometry=new ExtrudeGeometry(shapes,{depth:part.thickness/100,bevelEnabled:false,steps:1,curveSegments:8});
    geometry.translate(0,0,-part.thickness/200);return geometry;
  },[part]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  const material=sheetMaterial(speaker.config,part.id);
  return <mesh geometry={geometry} position={part.position.map((v,i)=>(v+(exploded ? part.explode[i] : 0))/100) as [number,number,number]} rotation={part.rotation}><meshPhysicalMaterial {...acrylicMaterial(material.tint,part.thickness/100,material.transparency)} /></mesh>;
}
function Camera({ speaker,view,resetKey,exploded }: Omit<Props,"dark"|"hardware">) {
  const controls=useRef<OrbitControlsImpl>(null),{camera,size,invalidate}=useThree();
  const {width,height,depth}=speaker.config;
  const totalHeight=speaker.totalHeight, footHeight=totalHeight-height;
  useEffect(()=>{
    const aspect=size.width/Math.max(1,size.height);
    const distance=Math.max((width+(exploded ? 100 : 0))/100/aspect,(totalHeight+(exploded ? 100 : 0))/100,(depth+100)/100)*2.25;
    const direction=view === "front" ? new Vector3(0,0,1) : view === "rear" ? new Vector3(0,0,-1) : new Vector3(0.85,0.5,1.3).normalize();
    const target=new Vector3(0,-footHeight/200,0);
    camera.position.copy(direction.multiplyScalar(distance).add(target));camera.lookAt(target);
    if(controls.current){controls.current.target.copy(target);controls.current.update();}invalidate();
  },[camera,size.width,size.height,width,totalHeight,footHeight,depth,exploded,view,resetKey,invalidate]);
  return <OrbitControls ref={controls} makeDefault enablePan={false} minDistance={1} maxDistance={30} />;
}
export function SpeakerPreview(props: Props) {
  const {speaker,dark,exploded,hardware}=props;
  const [modelStatus, setModelStatus] = useState<SpeakerModelStatus | null>(null);
  return <PreviewBoundary><Canvas camera={{position:[5,3,6],fov:34,near:0.01,far:100}} dpr={[1,1.75]} frameloop="demand" gl={{alpha:true,antialias:true}} fallback={<div className="preview-fallback">WebGL is unavailable. Select Cutting layout to inspect your sheets.</div>}>
    <ambientLight intensity={dark ? 0.8 : 1.3} /><directionalLight position={[3,7,5]} intensity={2.5} /><directionalLight position={[-5,3,-2]} intensity={1.5} color="#e6efff" />
    <Suspense fallback={null}><Environment resolution={128} frames={1}><Lightformer position={[0,5,-3]} rotation={[Math.PI/2,0,0]} scale={[10,8,1]} intensity={3} /><Lightformer position={[-5,2,1]} rotation={[0,Math.PI/2,0]} scale={[6,3,1]} intensity={4} /></Environment>
      {speaker.parts.map(part=><Sheet key={part.id} part={part} speaker={speaker} exploded={exploded} />)}
      <SpeakerHardware speaker={speaker} exploded={exploded} donorVisible={hardware} onStatusChange={setModelStatus} />
      <ContactShadows key={JSON.stringify([speaker.config,exploded,hardware])} position={[0,Math.min(speaker.floorY,-speaker.config.height/2-(exploded ? 35 : 0))/100-0.03,0]} opacity={dark ? 0.45 : 0.25} scale={15} blur={2.4} far={5} resolution={512} frames={1} color="#24231e" />
    </Suspense><Camera {...props} />
  </Canvas><SpeakerModelMessage status={hardware ? modelStatus : null} /></PreviewBoundary>;
}
