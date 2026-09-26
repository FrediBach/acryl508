import { sheetThickness } from "./sheet-materials";
import { Euler, Quaternion, Vector3 } from "three";
import { myndBoardMounts, myndControlMounts } from "./mynd-mounts";
import type { Speaker, SpeakerConfiguration, SpeakerPart } from "./speaker";

export type HardwarePoint = [number, number, number];
export type SpeakerFastener = {
  id: string; kind: "rod" | "spacer" | "washer" | "screw" | "nut";
  position: HardwarePoint; length: number; radius: number; bore: number;
  direction: 1 | -1; parent: string; rotation?: HardwarePoint;
};
/** Millimetres, Z along the fastener axis. Attached items travel with their
 * panel during disassembly; a spacer never stretches to fill an exploded gap. */
export function speakerFasteners(speaker: Speaker, exploded = false): SpeakerFastener[] {
  const { config } = speaker, d = config.depth;
  const baffle = d / 2, rear = -d / 2, grille = baffle + config.grilleGap;
  const t = (id: string) => sheetThickness(config, id);
  const offset = (id: string) => exploded ? speaker.parts.find(p => p.id === id)!.explode[2] : 0;
  const items: SpeakerFastener[] = [];
  const add = (id: string, kind: SpeakerFastener["kind"], x: number, y: number, z: number, length: number, radius: number, bore: number, parent: string, direction: 1 | -1 = 1) => {
    items.push({ id, kind, position: [x, y, z + offset(parent)], length, radius, bore, direction, parent });
  };
  speaker.mounts.forEach(([x, y], i) => {
    const id = `corner-${i + 1}`;
    // Tie rod passes both panels, with rear nut engagement and a threaded
    // female spacer at the front. Grille screw enters the spacer from outside.
    const rodStart = rear - 3.6, rodEnd = baffle + 3;
    add(`${id}-tie`, "rod", x, y, (rodStart + rodEnd) / 2, rodEnd - rodStart, 1.5, 0, "baffle");
    add(`${id}-baffle-washer`, "washer", x, y, baffle + 0.25, 0.5, 3.5, 1.7, "baffle");
    add(`${id}-spacer`, "spacer", x, y, baffle + config.grilleGap / 2, config.grilleGap - 1, 3.5, 1.5, "baffle");
    add(`${id}-grille-inner-washer`, "washer", x, y, grille - 0.25, 0.5, 3.5, 1.7, "grille");
    add(`${id}-grille-outer-washer`, "washer", x, y, grille + t("grille") + 0.25, 0.5, 3.5, 1.7, "grille");
    add(`${id}-grille-screw`, "screw", x, y, grille + t("grille") + 0.5, t("grille") + 3.5, 2.75, 0, "grille");
    add(`${id}-rear-washer`, "washer", x, y, rear - 0.25, 0.5, 3.5, 1.7, "rear");
    add(`${id}-rear-nut`, "nut", x, y, rear - 1.7, 2.4, 3.2, 1.5, "rear", -1);
  });
  speaker.driverMounts.forEach(([x, y], i) => {
    add(`driver-${i}-washer`, "washer", x, y, baffle + 0.25, 0.5, 3.1, 1.7, "baffle");
    add(`driver-${i}-screw`, "screw", x, y, baffle + 0.5, t("baffle") + 5, 2.75, 0, "baffle");
  });
  for (const mount of speaker.panelMounts) {
    const panel = speaker.parts.find(p => p.id === mount.parent)!;
    const rotation: HardwarePoint = panel.id === "top" ? [-Math.PI / 2, 0, 0] : panel.id === "bottom" ? [Math.PI / 2, 0, 0] : panel.id === "rear" ? [0, Math.PI, 0] : [0, 0, 0];
    const normal = new Vector3(0, 0, 1).applyEuler(new Euler(...rotation));
    const centre = new Vector3(...mount.position, 0).applyEuler(new Euler(...panel.rotation)).add(new Vector3(...panel.position));
    if (exploded) centre.add(new Vector3(...panel.explode));
    const addMount = (suffix: string, kind: SpeakerFastener["kind"], distance: number, length: number, radius: number, bore: number, inward = false) => {
      const position = centre.clone().addScaledVector(normal, panel.thickness / 2 + distance).toArray() as HardwarePoint;
      items.push({ id: `${mount.id}-${suffix}`, kind, position, length, radius, bore, parent: panel.id, direction: 1,
        rotation: inward ? [Math.PI / 2, 0, 0] : rotation });
    };
    addMount("sheet-washer", "washer", 0.25, 0.5, 3.5, 1.7);
    addMount("sheet-screw", "screw", 0.5, panel.thickness + 3, 2.75, 0);
    if (mount.parent === "top") {
      // HMI cover upper seating face is 11.6 mm below the inner top face.
      addMount("support", "spacer", -panel.thickness - 5.8, 11.6, 2.5, 1.5);
      addMount("cover-washer", "washer", -panel.thickness - 14.35, 0.5, 3.5, 1.7);
      addMount("cover-screw", "screw", -panel.thickness - 14.6, 5, 2.75, 0, true);
    }
  }
  return items;
}

export type BoardPlacement = { id: string; asset: string; parent: string; position: HardwarePoint; rotation: HardwarePoint; standoff: number };
export function speakerBoardPlacements(speaker: { config: SpeakerConfiguration; parts: SpeakerPart[] }, exploded = false): BoardPlacement[] {
  const c = speaker.config, t = (id: string) => sheetThickness(c, id);
  const rear = -c.depth / 2 + t("rear"), bottom = -c.height / 2 + t("bottom"), top = c.height / 2 - t("top");
  const front = c.depth / 2 - t("baffle"), left = -c.width / 2 + t("left");
  const boards: BoardPlacement[] = [
    { id: "Main", asset: "pcb-main", parent: "bottom", position: [0, bottom + 12.8, -3], rotation: [-Math.PI / 2, 0, Math.PI / 2], standoff: 12 },
    { id: "Amp", asset: "pcb-amp", parent: "rear", position: [43, -9, rear + 8.8], rotation: [0, 0, 0], standoff: 8 },
    { id: "Bluetooth", asset: "pcb-bluetooth", parent: "rear", position: [-66, 42, rear + 8.8], rotation: [0, 0, 0], standoff: 8 },
    { id: "UI", asset: "pcb-ui", parent: "top", position: [0, top - 10, 15], rotation: [-Math.PI / 2, 0, 0], standoff: 0 },
    { id: "Conn_Bat", asset: "pcb-conn-bat", parent: "rear", position: [-83, -9, rear + 10.8], rotation: [0, 0, 0], standoff: 10 },
    { id: "Conn_Amp", asset: "pcb-conn-amp", parent: "rear", position: [109, -14, rear + 8.8], rotation: [0, 0, 0], standoff: 0 },
    { id: "Conn_Baffle", asset: "pcb-conn-baffle", parent: "baffle", position: [0, 58, front - 6.8], rotation: [0, Math.PI, 0], standoff: 6 },
    { id: "Jack_USB", asset: "pcb-jack-usb", parent: "left", position: [left + 15, -c.height / 2 + 59, 1], rotation: [0, -Math.PI / 2, 0], standoff: 0 },
    { id: "Jack_Line_In", asset: "pcb-jack-line-in", parent: "left", position: [left + 15, -c.height / 2 + 39, 1], rotation: [0, -Math.PI / 2, 0], standoff: 0 },
  ];
  return boards.map(board => ({ ...board, position: board.position.map((value, i) => value + (exploded ? speaker.parts.find(p => p.id === board.parent)!.explode[i] : 0)) as HardwarePoint }));
}

export type SpeakerPanelMount = { id: string; parent: string; position: [number, number]; diameter: number };
/** Project source mounting axes into each sheet's own cutting coordinates. */
export function speakerPanelMounts(speaker: { config: SpeakerConfiguration; parts: SpeakerPart[] }): SpeakerPanelMount[] {
  const mounts: SpeakerPanelMount[] = [];
  for (const board of speakerBoardPlacements(speaker)) {
    if (!board.standoff) continue;
    const panel = speaker.parts.find(p => p.id === board.parent)!;
    const inverse = new Quaternion().setFromEuler(new Euler(...panel.rotation)).invert();
    (myndBoardMounts[board.id] ?? []).forEach(([x, y], i) => {
      const local = new Vector3(x, y, 0).applyEuler(new Euler(...board.rotation)).add(new Vector3(...board.position)).sub(new Vector3(...panel.position)).applyQuaternion(inverse);
      mounts.push({ id: `pcb-${board.id}-${i}`, parent: panel.id, position: [local.x, local.y], diameter: 3.4 });
    });
  }
  const top = speaker.parts.find(p => p.id === "top")!;
  myndControlMounts.forEach(([x, z], i) => mounts.push({ id: `hmi-${i}`, parent: "top", position: [x, z - top.position[2]], diameter: 3.5 }));
  return mounts;
}
