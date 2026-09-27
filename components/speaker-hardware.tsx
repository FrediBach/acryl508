"use client";
import { Suspense, useMemo } from "react";
import { useGLTF, RoundedBox } from "@react-three/drei";
import { CatmullRomCurve3, DoubleSide, Path, Shape, Vector2, Vector3 } from "three";
import { myndDrivers, speakerRoundedRect, type Speaker } from "@/lib/speaker";
import { speakerBoardPlacements, speakerFasteners, speakerPortPlacement, speakerControlPlacement, type HardwarePoint, type SpeakerFastener } from "@/lib/speaker-hardware";
import manifest from "@/public/models/mynd/manifest.json";
import { speakerCarrierLayout } from "@/lib/speaker-carriers";
import { myndBoardMounts } from "@/lib/mynd-mounts";
import { myndReconstruction } from "@/lib/mynd-reconstruction";
import { ModelStatusReporter, SpeakerModelBoundary, type ModelStatusChange } from "./speaker-model-status";

const modelAssets = Object.values(manifest.assets);
const modelUrls = modelAssets.map(asset => `/models/mynd/${asset.file}?v=${asset.bytes}`);
// Cached source GLBs remain immutable. Each placed assembly gets its own scene
// graph while sharing geometry/materials, which useGLTF owns for the session.
function SourceModel({ asset }: { asset: string }) {
  // One shared array starts every request together rather than loading boards
  // serially as each suspended model becomes ready.
  const models = useGLTF(modelUrls);
  const { scene } = models[modelAssets.findIndex(model => model.file === `${asset}.glb`)];
  const object = useMemo(() => scene.clone(true), [scene]);
  return <primitive object={object} dispose={null} />;
}
function Annulus({ radius, bore, length, hex = false, color = "#a7adb3" }: { radius: number; bore: number; length: number; hex?: boolean; color?: string }) {
  const shape = useMemo(() => {
    const s = new Shape();
    if (hex) { for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; if (i) s.lineTo(radius * Math.cos(a), radius * Math.sin(a)); else s.moveTo(radius, 0); } s.closePath(); }
    else s.absarc(0, 0, radius, 0, Math.PI * 2, false);
    const hole = new Path(); hole.absarc(0, 0, bore, 0, Math.PI * 2, true); s.holes.push(hole); return s;
  }, [radius, bore, hex]);
  return <mesh position={[0, 0, -length / 2]}><extrudeGeometry args={[shape, { depth: length, bevelEnabled: false, curveSegments: 16 }]} /><meshStandardMaterial color={color} metalness={0.8} roughness={0.28} /></mesh>;
}
function Screw({ length, radius = 2.75, shaftRadius = 1.5 }: { length: number; radius?: number; shaftRadius?: number }) {
  return <group>
    <mesh position={[0, 0, -length / 2]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[shaftRadius, shaftRadius, length, 12]} /><meshStandardMaterial color="#83888d" metalness={0.8} roughness={0.3} /></mesh>
    <mesh position={[0, 0, 1.5]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[radius, radius, 3, 24]} /><meshStandardMaterial color="#4b5156" metalness={0.8} roughness={0.28} /></mesh>
    <mesh position={[0, 0, 3.01]}><circleGeometry args={[1.3, 6]} /><meshStandardMaterial color="#090c10" roughness={0.85} /></mesh>
  </group>;
}
function Fastener({ item }: { item: SpeakerFastener }) {
  return <group name={item.id} position={item.position} rotation={item.rotation ?? [0, item.direction < 0 ? Math.PI : 0, 0]}>
    {item.kind === "screw" ? <Screw length={item.length} radius={item.radius} shaftRadius={item.shaftRadius} /> : item.kind === "rod" ? <mesh rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[item.radius, item.radius, item.length, 12]} /><meshStandardMaterial color="#777d83" metalness={0.85} roughness={0.3} /></mesh> : <Annulus radius={item.radius} bore={item.bore} length={item.length} hex={item.kind === "nut" || item.kind === "spacer"} />}
  </group>;
}
function Profile({ points, color, metalness = 0 }: { points: number[][]; color: string; metalness?: number }) {
  const profile = useMemo(() => points.map(([radius, depth]) => new Vector2(radius, depth)), [points]);
  return <mesh rotation={[Math.PI / 2, 0, 0]}><latheGeometry args={[profile, 64]} /><meshStandardMaterial color={color} roughness={metalness ? 0.4 : 0.8} metalness={metalness} side={DoubleSide} /></mesh>;
}
function Driver({ kind }: { kind: "woofer" | "tweeter" }) {
  if (kind === "tweeter") return <group>
    <Annulus radius={21} bore={10.5} length={2.5} color="#24272a" />
    <mesh position={[0, 0, -6.5]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[myndReconstruction.tweeter.bodyRadius, 18, 11, 48]} /><meshStandardMaterial color="#aeb2b3" roughness={0.42} metalness={0.8} /></mesh>
    <group position={[0, 0, -11.5]}><Annulus radius={17} bore={14} length={1} color="#666b6c" /></group>
    <group name="Photo-derived tweeter retaining strap; donor adapter required" rotation={[0, 0, -0.55]}>
      <RoundedBox args={[myndReconstruction.tweeter.strapWidth, 45, 1.3]} radius={0.6} position={[0, 0, -13]}><meshStandardMaterial color="#b9bfc1" roughness={0.4} metalness={0.8} /></RoundedBox>
      {[-21, 21].map(y => <group key={y} position={[0, y, -14]} rotation={[0, Math.PI, 0]}><Screw length={3} radius={2.2} shaftRadius={1.1} /></group>)}
    </group>
    <mesh position={[0, 0, 0.8]} scale={[1, 1, 0.4]}><sphereGeometry args={[10, 40, 20]} /><meshStandardMaterial color="#303134" roughness={0.96} /></mesh>
    <mesh position={[0, 0, 1.5]}><torusGeometry args={[11, 1.6, 10, 48]} /><meshStandardMaterial color="#16191c" roughness={0.9} /></mesh>
  </group>;
  return <group>
    <Annulus radius={48.5} bore={43} length={3} color="#25282c" />
    {[-1, 1].flatMap(x => [-1, 1].map(y => <group key={`${x}-${y}`} position={[x * 38.5373, y * 38.5373, 0]}><Annulus radius={7} bore={1.7} length={3} color="#25282c" /></group>))}
    <Profile points={[[0, -7], [12, -7], [18, -9], [36, -1.5], [38, -0.5]]} color="#2e3033" />
    <mesh position={[0, 0, 0]}><torusGeometry args={[40, 3, 12, 64]} /><meshStandardMaterial color="#16191c" roughness={0.95} /></mesh>
    <mesh position={[0, 0, -7]} scale={[1, 1, 0.4]}><sphereGeometry args={[15, 32, 16]} /><meshStandardMaterial color="#242628" roughness={0.95} /></mesh>
    <group position={[0, 0, -24]}><Annulus radius={36} bore={25} length={4} color="#25292b" /></group>
    {Array.from({ length: 6 }, (_, i) => <group key={i} rotation={[0, 0, i * Math.PI / 3]}>
      <mesh position={[0, 38, -14]} rotation={[0.4, 0, 0]}><boxGeometry args={[9, 3, 26]} /><meshStandardMaterial color="#24282a" metalness={0.65} roughness={0.5} /></mesh>
    </group>)}
    <group name="Photo-derived ferrite magnet and vented steel back plate">
      <group position={[0, 0, -28]}><Annulus radius={myndReconstruction.woofer.magnetRadius} bore={myndReconstruction.woofer.ventRadius} length={4} color="#a3a9ac" /></group>
      <group position={[0, 0, -34]}><Annulus radius={39.5} bore={myndReconstruction.woofer.ventRadius} length={8} color="#3b3e40" /></group>
      <group position={[0, 0, -39]}><Annulus radius={myndReconstruction.woofer.magnetRadius} bore={myndReconstruction.woofer.ventRadius} length={2} color="#c2c8cb" /></group>
      <Profile points={[[40.5, -40], [27, -40], [25.5, -42], [24, -43], [5.5, -43], [5.5, -37]]} color="#b6bdc1" metalness={0.8} />
    </group>
    {[-1, 1].map(sign => <mesh key={sign} position={[sign * 7, -27, -22]}><boxGeometry args={[3, 8, 0.7]} /><meshStandardMaterial color="#bf9c5f" metalness={0.8} roughness={0.35} /></mesh>)}
  </group>;
}
function Radiator() {
  const shape = useMemo(() => {
    const s = new Shape(); speakerRoundedRect(0, 0, 45, 95, 19).forEach(([x, y], i) => i ? s.lineTo(x, y) : s.moveTo(x, y)); return s;
  }, []);
  const surround = useMemo(() => new CatmullRomCurve3(speakerRoundedRect(0, 0, 47, 97, 20).slice(0, -1).map(([x, y]) => new Vector3(x, y, -3)), true), []);
  return <group name="Photo-derived passive membrane and dotted rear plate">
    <mesh position={[0, 0, -5]}><extrudeGeometry args={[shape, { depth: 3, bevelEnabled: true, bevelSize: 1, bevelThickness: 0.7, bevelSegments: 3 }]} /><meshStandardMaterial color="#2d3033" roughness={0.9} /></mesh>
    <mesh><tubeGeometry args={[surround, 100, 2.6, 10, true]} /><meshStandardMaterial color="#111416" roughness={0.95} /></mesh>
    <RoundedBox args={[34, 77, 2]} radius={8} position={[0, 0, -7]}><meshStandardMaterial color="#333638" metalness={0.2} roughness={0.8} /></RoundedBox>
    {[-10, 0, 10].flatMap(x => Array.from({ length: 9 }, (_, i) => <mesh key={`${x}-${i}`} position={[x, (i - 4) * 7.5, -8.1]} rotation={[0, Math.PI, 0]}><circleGeometry args={[0.8, 8]} /><meshStandardMaterial color="#73797a" metalness={0.5} roughness={0.65} /></mesh>))}
    {[-34, 34].map(y => <RoundedBox key={y} name="Rear retaining rib" args={[49, 8, 3]} radius={1.3} position={[0, y, -11]}><meshStandardMaterial color="#191c1e" roughness={0.85} /></RoundedBox>)}
  </group>;
}
function Cable({ points, color, radius = 0.65 }: { points: HardwarePoint[]; color: string; radius?: number }) {
  const curve = useMemo(() => new CatmullRomCurve3(points.map(p => new Vector3(...p))), [points]);
  return <mesh><tubeGeometry args={[curve, 24, radius, 6, false]} /><meshStandardMaterial color={color} roughness={0.8} /></mesh>;
}
function SourceAssemblies({ speaker, exploded }: { speaker: Speaker; exploded: boolean }) {
  const c = speaker.config;
  const offset = (id: string): HardwarePoint => exploded ? speaker.parts.find(p => p.id === id)!.explode : [0, 0, 0];
  const baffle = speaker.parts.find(p => p.id === "baffle")!;
  const front = baffle.position[2] - baffle.thickness / 2;
  const boards = speakerBoardPlacements(speaker, exploded);
  return <>
    {boards.map(board => {
      const mounts = myndBoardMounts[board.id] ?? [];
      return <group key={board.id} name={`MYND ${board.id} PCB`} position={board.position} rotation={board.rotation}>
        <SourceModel asset={board.asset} />
        {board.standoff > 0 && mounts.map(([x, y, diameter], i) => <group key={i} position={[x, y, 0]}>
          <group position={[0, 0, -0.8 - board.standoff / 2]}><Annulus radius={2.5} bore={diameter / 2} length={board.standoff} hex color="#c3ad72" /></group>
          <group position={[0, 0, 1.05]}><Annulus radius={2.8} bore={1.6} length={0.5} /></group>
          <group position={[0, 0, 1.3]}><Screw length={5} radius={2.5} /></group>
        </group>)}
      </group>;
    })}
    <group position={offset("baffle")}><group rotation={[-Math.PI / 2, 0, 0]} position={[0, -90, front + 17.8]}><SourceModel asset="radiator-frames" /></group></group>
    <group position={offset("left")}><group rotation={[-Math.PI / 2, 0, 0]} position={speakerPortPlacement(c)}><SourceModel asset="port-housing" /></group></group>
    <group position={offset("top")}><group rotation={[-Math.PI / 2, 0, 0]} position={speakerControlPlacement(c)}><SourceModel asset="hmi-cover" /><SourceModel asset="hmi-pad" /></group></group>
  </>;
}
export function SpeakerHardware({ speaker, exploded, donorVisible, onStatusChange }: { speaker: Speaker; exploded: boolean; donorVisible: boolean; onStatusChange: ModelStatusChange }) {
  const c = speaker.config, baffle = speaker.parts.find(p => p.id === "baffle")!;
  const front = baffle.position[2] - baffle.thickness / 2;
  const rear = speakerCarrierLayout(c).rearFront;
  const battery = myndReconstruction.battery;
  const batteryZ = rear + battery.rearOffset;
  const baffleConnector = speakerBoardPlacements(speaker).find(board => board.id === "Conn_Baffle")!.position;
  return <group scale={0.01}>
    {speakerFasteners(speaker, exploded).map(item => <Fastener key={item.id} item={item} />)}
    {donorVisible && <>
      <SpeakerModelBoundary onStatusChange={onStatusChange}><Suspense fallback={<ModelStatusReporter status="loading" onStatusChange={onStatusChange} />}><ModelStatusReporter status="ready" onStatusChange={onStatusChange}><SourceAssemblies speaker={speaker} exploded={exploded} /></ModelStatusReporter></Suspense></SpeakerModelBoundary>
      <group position={exploded ? baffle.explode : [0, 0, 0]}>{myndDrivers.map(driver => <group key={driver.id} name={`${driver.label} reconstruction`} position={[driver.x, driver.y, front]}>{driver.kind === "radiator" ? <Radiator /> : <Driver kind={driver.kind} />}</group>)}</group>
      <group name="Photo-derived upright battery pack; restraint provisional" position={[battery.x, battery.y, batteryZ + (exploded ? speaker.parts.find(p => p.id === "pcb-rear")!.explode[2] : 0)]}>
        <RoundedBox args={[battery.width, battery.height, battery.depth]} radius={1.8} smoothness={4}><meshStandardMaterial color="#23272c" roughness={0.75} /></RoundedBox>
        <RoundedBox args={[battery.width - 3, battery.height - 3, 1]} radius={1.4} position={[0, 0, battery.depth / 2]}><meshStandardMaterial color="#292d32" roughness={0.75} /></RoundedBox>
        <RoundedBox args={[13, 20, 0.7]} radius={1} position={[0, battery.height / 2 - 9, battery.depth / 2 + 0.8]}><meshStandardMaterial color="#a53246" roughness={0.95} /></RoundedBox>
        {[-1, 1].flatMap(x => [-1, 1].map(y => <RoundedBox key={`${x}-${y}`} args={[7, 12, battery.depth + 2]} radius={1.5} position={[x * (battery.width / 2 + 1), y * (battery.height / 2 - 8), 0]}><meshStandardMaterial color="#111615" roughness={1} /></RoundedBox>))}
      </group>
      {!exploded && <group name="Illustrative foam-sleeved looms; no pin assignments">
        <Cable color="#151a19" radius={3.2} points={[[battery.x - 24, 25, batteryZ], [48, 25, rear + 19], [26, 17, rear + 20], [5, 18, rear + 18]]} />
        <Cable color="#151a19" radius={3} points={[[-40, -35, rear + 19], [-29, -25, rear + 22], [-10, -26, rear + 20], [5, -35, rear + 18]]} />
        <Cable color="#151a19" radius={3} points={[[7, -51, front - 22], [43, -62, front - 25], [baffleConnector[0], baffleConnector[1] - 24, baffleConnector[2] + 12], [baffleConnector[0], baffleConnector[1] - 10, baffleConnector[2] + 9]]} />
        {[-1, 1].map(sign => <Cable key={sign} color="#151a19" radius={2.7} points={[[sign * 93, 48, front - 12], [sign * 69, 43, front - 17], [sign * 52, 25, front - 20], [sign * 26, 14, front - 23]]} />)}
      </group>}
    </>}
  </group>;
}
