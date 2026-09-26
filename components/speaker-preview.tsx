"use client";
import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, OrbitControls } from "@react-three/drei";
import { ExtrudeGeometry, Path, Shape, Vector3 } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { acrylicMaterial } from "@/lib/acrylic-material";
import { sheetMaterial } from "@/lib/sheet-materials";
import { myndDrivers, type Speaker, type SpeakerPart } from "@/lib/speaker";
import { PreviewBoundary } from "./stand-preview";
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
function Hardware({ speaker }: { speaker: Speaker }) {
  const front=speaker.config.depth/200-sheetMaterial(speaker.config,"baffle").thickness/100;
  return <group>
    {myndDrivers.map(driver=><group key={driver.id} position={[driver.x/100,driver.y/100,front]}>
      {driver.kind === "radiator" ? <mesh position={[0,0,-0.03]}><boxGeometry args={[0.46,0.94,0.05]} /><meshStandardMaterial color="#202227" roughness={0.9} /></mesh> : <>
        <mesh rotation={[Math.PI/2,0,0]} position={[0,0,-0.04]}><cylinderGeometry args={[driver.width/200,driver.width/200,0.08,48]} /><meshStandardMaterial color="#16181c" roughness={0.8} /></mesh>
        <mesh position={[0,0,0.005]} scale={[1,1,0.3]}><sphereGeometry args={[driver.kind === "woofer" ? 0.18 : 0.1,32,16,0,Math.PI*2,0,Math.PI]} /><meshStandardMaterial color="#303238" roughness={0.95} /></mesh>
        {driver.kind === "woofer" && <mesh position={[0,0,-0.23]} rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[0.28,0.24,0.3,32]} /><meshStandardMaterial color="#55585e" metalness={0.5} roughness={0.4} /></mesh>}
      </>}
    </group>)}
    {/* PCB envelopes from KiCad Edge.Cuts; components and placements illustrative. */}
    <mesh position={[0,-speaker.config.height/200+0.22,-0.02]}><boxGeometry args={[1.36,0.016,0.75]} /><meshStandardMaterial color="#20694b" roughness={0.65} /></mesh>
    <mesh position={[0.45,0.1,-speaker.config.depth/200+0.2]}><boxGeometry args={[0.905,0.575,0.016]} /><meshStandardMaterial color="#20694b" roughness={0.65} /></mesh>
    <mesh position={[-0.55,0.35,-speaker.config.depth/200+0.2]}><boxGeometry args={[0.55,0.41,0.016]} /><meshStandardMaterial color="#20694b" roughness={0.65} /></mesh>
    <mesh position={[0,speaker.config.height/200-0.15,0]}><boxGeometry args={[1.16,0.016,0.26]} /><meshStandardMaterial color="#20694b" roughness={0.65} /></mesh>
    <mesh position={[-0.99,-0.37,-0.12]}><boxGeometry args={[0.3,0.42,0.65]} /><meshStandardMaterial color="#282a30" roughness={0.85} /></mesh>
    {speaker.mounts.map(([x,y],i)=><mesh key={i} position={[x/100,y/100,0]} rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[0.015,0.015,speaker.innerDepth/100,12]} /><meshStandardMaterial color="#92969e" metalness={0.85} roughness={0.25} /></mesh>)}
  </group>;
}
function Camera({ speaker,view,resetKey,exploded }: Omit<Props,"dark"|"hardware">) {
  const controls=useRef<OrbitControlsImpl>(null),{camera,size,invalidate}=useThree();
  const {width,height,depth}=speaker.config;
  useEffect(()=>{
    const aspect=size.width/Math.max(1,size.height);
    const distance=Math.max((width+(exploded ? 100 : 0))/100/aspect,(height+(exploded ? 100 : 0))/100,(depth+100)/100)*2.25;
    const direction=view === "front" ? new Vector3(0,0,1) : view === "rear" ? new Vector3(0,0,-1) : new Vector3(0.85,0.5,1.3).normalize();
    camera.position.copy(direction.multiplyScalar(distance));camera.lookAt(0,0,0);
    if(controls.current){controls.current.target.set(0,0,0);controls.current.update();}invalidate();
  },[camera,size.width,size.height,width,height,depth,exploded,view,resetKey,invalidate]);
  return <OrbitControls ref={controls} makeDefault enablePan={false} minDistance={1} maxDistance={30} />;
}
export function SpeakerPreview(props: Props) {
  const {speaker,dark,exploded,hardware}=props;
  return <PreviewBoundary><Canvas camera={{position:[5,3,6],fov:34,near:0.01,far:100}} dpr={[1,1.75]} frameloop="demand" gl={{alpha:true,antialias:true}} fallback={<div className="preview-fallback">WebGL is unavailable. Select Cutting layout to inspect your sheets.</div>}>
    <ambientLight intensity={dark ? 0.8 : 1.3} /><directionalLight position={[3,7,5]} intensity={2.5} /><directionalLight position={[-5,3,-2]} intensity={1.5} color="#e6efff" />
    <Suspense fallback={null}><Environment resolution={128} frames={1}><Lightformer position={[0,5,-3]} rotation={[Math.PI/2,0,0]} scale={[10,8,1]} intensity={3} /><Lightformer position={[-5,2,1]} rotation={[0,Math.PI/2,0]} scale={[6,3,1]} intensity={4} /></Environment>
      {speaker.parts.map(part=><Sheet key={part.id} part={part} speaker={speaker} exploded={exploded} />)}
      {hardware && <Hardware speaker={speaker} />}
      <ContactShadows key={JSON.stringify([speaker.config,exploded,hardware])} position={[0,-speaker.config.height/200-(exploded ? 0.4 : 0.03),0]} opacity={dark ? 0.45 : 0.25} scale={15} blur={2.4} far={5} resolution={512} frames={1} color="#24231e" />
    </Suspense><Camera {...props} />
  </Canvas></PreviewBoundary>;
}
