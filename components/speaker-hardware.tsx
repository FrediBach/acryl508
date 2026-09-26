"use client";
import { Component, Suspense, useMemo, type ReactNode } from "react";
import { useGLTF, RoundedBox, Line, Html } from "@react-three/drei";
import { CatmullRomCurve3, DoubleSide, Path, Shape, Vector2, Vector3 } from "three";
import { myndDrivers, speakerRoundedRect, type Speaker } from "@/lib/speaker";
import { sheetThickness } from "@/lib/sheet-materials";
import { speakerBoardPlacements, speakerFasteners, type HardwarePoint, type SpeakerFastener } from "@/lib/speaker-hardware";
import manifest from "@/public/models/mynd/manifest.json";

const modelUrls = Object.values(manifest.assets).map(asset => `/models/mynd/${asset.file}`);
// Cached source GLBs remain immutable. Each placed assembly gets its own scene
// graph while sharing geometry/materials, which useGLTF owns for the session.
function SourceModel({ asset }: { asset: string }) {
  // One shared array starts every request together rather than loading boards
  // serially as each suspended model becomes ready.
  const models = useGLTF(modelUrls);
  const { scene } = models[modelUrls.indexOf(`/models/mynd/${asset}.glb`)];
  const object = useMemo(() => scene.clone(true), [scene]);
  return <primitive object={object} dispose={null} />;
}
class AssetBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <Html center><div className="preview-fallback" role="status">The detailed MYND models could not load. Reload to try again.</div></Html> : this.props.children; }
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
function Screw({ length, radius = 2.75 }: { length: number; radius?: number }) {
  return <group>
    <mesh position={[0, 0, -length / 2]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[1.5, 1.5, length, 12]} /><meshStandardMaterial color="#83888d" metalness={0.8} roughness={0.3} /></mesh>
    <mesh position={[0, 0, 1.5]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[radius, radius, 3, 24]} /><meshStandardMaterial color="#4b5156" metalness={0.8} roughness={0.28} /></mesh>
    <mesh position={[0, 0, 3.01]}><circleGeometry args={[1.3, 6]} /><meshStandardMaterial color="#090c10" roughness={0.85} /></mesh>
  </group>;
}
function Fastener({ item }: { item: SpeakerFastener }) {
  return <group name={item.id} position={item.position} rotation={[0, item.direction < 0 ? Math.PI : 0, 0]}>
    {item.kind === "screw" ? <Screw length={item.length} radius={item.radius} /> : item.kind === "rod" ? <mesh rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[item.radius, item.radius, item.length, 12]} /><meshStandardMaterial color="#777d83" metalness={0.85} roughness={0.3} /></mesh> : <Annulus radius={item.radius} bore={item.bore} length={item.length} hex={item.kind === "nut" || item.kind === "spacer"} />}
  </group>;
}
function Profile({ points, color, metalness = 0 }: { points: number[][]; color: string; metalness?: number }) {
  const profile = useMemo(() => points.map(([radius, depth]) => new Vector2(radius, depth)), [points]);
  return <mesh rotation={[Math.PI / 2, 0, 0]}><latheGeometry args={[profile, 64]} /><meshStandardMaterial color={color} roughness={metalness ? 0.4 : 0.8} metalness={metalness} side={DoubleSide} /></mesh>;
}
function Driver({ kind }: { kind: "woofer" | "tweeter" }) {
  if (kind === "tweeter") return <group>
    <Annulus radius={21} bore={10.5} length={2.5} color="#24272a" />
    <mesh position={[0, 0, -5]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[19, 18, 9, 40]} /><meshStandardMaterial color="#4b4e52" roughness={0.55} metalness={0.5} /></mesh>
    <mesh position={[0, 0, 0.8]} scale={[1, 1, 0.4]}><sphereGeometry args={[10, 40, 20]} /><meshStandardMaterial color="#303134" roughness={0.96} /></mesh>
    <mesh position={[0, 0, 1.5]}><torusGeometry args={[11, 1.6, 10, 48]} /><meshStandardMaterial color="#16191c" roughness={0.9} /></mesh>
  </group>;
  return <group>
    <Annulus radius={48.5} bore={43} length={3} color="#25282c" />
    {[-1, 1].flatMap(x => [-1, 1].map(y => <group key={`${x}-${y}`} position={[x * 38.5373, y * 38.5373, 0]}><Annulus radius={7} bore={1.7} length={3} color="#25282c" /></group>))}
    <Profile points={[[0, -7], [12, -7], [18, -9], [36, -1.5], [38, -0.5]]} color="#2e3033" />
    <mesh position={[0, 0, 0]}><torusGeometry args={[40, 3, 12, 64]} /><meshStandardMaterial color="#16191c" roughness={0.95} /></mesh>
    <mesh position={[0, 0, -7]} scale={[1, 1, 0.4]}><sphereGeometry args={[15, 32, 16]} /><meshStandardMaterial color="#242628" roughness={0.95} /></mesh>
    <group position={[0, 0, -23]}><Annulus radius={27} bore={21} length={4} color="#45494e" /></group>
    {Array.from({ length: 6 }, (_, i) => <group key={i} rotation={[0, 0, i * Math.PI / 3]}>
      <mesh position={[0, 34, -14]} rotation={[0.62, 0, 0]}><boxGeometry args={[6, 3, 31]} /><meshStandardMaterial color="#41464b" metalness={0.75} roughness={0.4} /></mesh>
    </group>)}
    <mesh position={[0, 0, -31]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[26, 26, 16, 48]} /><meshStandardMaterial color="#505358" metalness={0.4} roughness={0.65} /></mesh>
    <mesh position={[0, 0, -40]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[24, 24, 2, 48]} /><meshStandardMaterial color="#a4aaad" metalness={0.8} roughness={0.4} /></mesh>
    {[-1, 1].map(sign => <mesh key={sign} position={[sign * 7, -27, -22]}><boxGeometry args={[3, 8, 0.7]} /><meshStandardMaterial color="#bf9c5f" metalness={0.8} roughness={0.35} /></mesh>)}
  </group>;
}
function Radiator() {
  const shape = useMemo(() => {
    const s = new Shape(); speakerRoundedRect(0, 0, 45, 95, 19).forEach(([x, y], i) => i ? s.lineTo(x, y) : s.moveTo(x, y)); return s;
  }, []);
  const surround = useMemo(() => speakerRoundedRect(0, 0, 47, 97, 20).map(([x, y]) => [x, y, 0] as HardwarePoint), []);
  return <group><mesh position={[0, 0, -2]}><extrudeGeometry args={[shape, { depth: 2, bevelEnabled: true, bevelSize: 1, bevelThickness: 0.7, bevelSegments: 3 }]} /><meshStandardMaterial color="#2d3033" roughness={0.9} /></mesh><Line points={surround} color="#101316" lineWidth={4} /><RoundedBox args={[22, 49, 5]} radius={5} position={[0, 0, -5]}><meshStandardMaterial color="#666a6c" metalness={0.5} roughness={0.6} /></RoundedBox></group>;
}
function Cable({ points, color, radius = 0.65 }: { points: HardwarePoint[]; color: string; radius?: number }) {
  const curve = useMemo(() => new CatmullRomCurve3(points.map(p => new Vector3(...p))), [points]);
  return <mesh><tubeGeometry args={[curve, 24, radius, 6, false]} /><meshStandardMaterial color={color} roughness={0.8} /></mesh>;
}
function SourceAssemblies({ speaker, exploded }: { speaker: Speaker; exploded: boolean }) {
  const c = speaker.config, t = (id: string) => sheetThickness(c, id);
  const offset = (id: string): HardwarePoint => exploded ? speaker.parts.find(p => p.id === id)!.explode : [0, 0, 0];
  const front = c.depth / 2 - t("baffle"), top = c.height / 2 - t("top"), left = -c.width / 2 + t("left");
  const boards = speakerBoardPlacements(speaker, exploded);
  return <>
    {boards.map(board => {
      const data = manifest.assets[board.id as keyof typeof manifest.assets];
      const mounts = "mounts" in data ? data.mounts : [];
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
    <group position={offset("left")}><group rotation={[-Math.PI / 2, 0, 0]} position={[left + 114.5, -c.height / 2, 55.86]}><SourceModel asset="port-housing" /></group></group>
    <group position={offset("top")}><group rotation={[-Math.PI / 2, 0, 0]} position={[0, top - 170.5, 57.17]}><SourceModel asset="hmi-cover" /><SourceModel asset="hmi-pad" /></group></group>
  </>;
}
export function SpeakerHardware({ speaker, exploded, donorVisible }: { speaker: Speaker; exploded: boolean; donorVisible: boolean }) {
  const c = speaker.config, baffle = speaker.parts.find(p => p.id === "baffle")!;
  const front = c.depth / 2 - baffle.thickness;
  const rear = -c.depth / 2 + sheetThickness(c, "rear");
  return <group scale={0.01}>
    {speakerFasteners(speaker, exploded).map(item => <Fastener key={item.id} item={item} />)}
    {donorVisible && <>
      <AssetBoundary><Suspense fallback={<Html center><span className="micro-label" role="status">Loading MYND hardware…</span></Html>}><SourceAssemblies speaker={speaker} exploded={exploded} /></Suspense></AssetBoundary>
      <group position={exploded ? baffle.explode : [0, 0, 0]}>{myndDrivers.map(driver => <group key={driver.id} name={`${driver.label} reconstruction`} position={[driver.x, driver.y, front]}>{driver.kind === "radiator" ? <Radiator /> : <Driver kind={driver.kind} />}</group>)}</group>
      <group name="Battery pack reconstruction" position={[0, 40, rear + 28 + (exploded ? -40 : 0)]}>
        <RoundedBox args={[72, 34, 36]} radius={7} smoothness={4}><meshStandardMaterial color="#23272c" roughness={0.65} /></RoundedBox>
        {[-24, 24].map(x => <RoundedBox key={x} args={[7, 35, 37]} radius={2} position={[x, 0, 0]}><meshStandardMaterial color="#0e1116" roughness={0.9} /></RoundedBox>)}
        <mesh position={[0, 0, 18.1]}><planeGeometry args={[34, 18]} /><meshStandardMaterial color="#b9b9ad" roughness={0.9} /></mesh>
      </group>
      {!exploded && <group name="Illustrative cable routes">
        <Cable color="#ac3431" points={[[-30, 36, rear + 28], [-43, 34, rear + 32], [-60, 18, rear + 25], [-77, -5, rear + 20]]} />
        <Cable color="#1b2026" points={[[-28, 35, rear + 28], [-40, 32, rear + 34], [-56, 17, rear + 27], [-73, -5, rear + 20]]} />
        <Cable color="#bc8850" points={[[0, 55, front - 9], [26, 44, 0], [33, 14, rear + 28], [37, 10, rear + 18]]} />
        <Cable color="#263035" points={[[7, -51, front - 22], [30, -56, 5], [63, -50, rear + 28], [68, -26, rear + 19]]} />
      </group>}
    </>}
  </group>;
}
