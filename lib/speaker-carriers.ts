import clipping, { type Pair } from "polygon-clipping";
import { Euler, Quaternion, Vector3 } from "three";
import { sheetThickness } from "./sheet-materials";
import type { SpeakerConfiguration, SpeakerPart } from "./speaker";

const rect = (x: number, y: number, w: number, h: number): Pair[] => [[x-w/2,y-h/2],[x+w/2,y-h/2],[x+w/2,y+h/2],[x-w/2,y+h/2],[x-w/2,y-h/2]];
export function speakerCarrierLayout(c: SpeakerConfiguration) {
  const t = (id: string) => sheetThickness(c,id);
  const left = -c.width/2+t("left"), right = c.width/2-t("right");
  const bottom = -c.height/2+t("bottom"), top = c.height/2-t("top");
  const rear = -c.depth/2+t("rear"), front = c.depth/2-t("baffle");
  // A washer + cap head occupies 3.5 mm. Keep 5 mm behind each carrier.
  const floorBottom = Math.max(bottom+5,-c.height/2+15), floorTop = floorBottom+t("pcb-floor");
  const rearBack = rear+5, rearFront = rearBack+t("pcb-rear");
  return { left,right,bottom,top,rear,front,floorBottom,floorTop,rearBack,rearFront,
    floorRear: rearFront+2, floorFront: front-2, floorZ: (rearFront+front)/2,
    rearBottom: floorTop+4, rearTop: top-12 };
}
export type SpeakerCarrierJoint = {
  carrier: string; target: string; centre: [number,number,number]; size: [number,number,number];
};
/** Nominal, flush through-tabs in closed rectangular slots, as on the case.
 * Bond and seal the side joints; apply kerf/fit compensation once in CAM. */
export function addSpeakerCarriers(c: SpeakerConfiguration, parts: SpeakerPart[]): SpeakerCarrierJoint[] {
  const l = speakerCarrierLayout(c), t = (id: string) => sheetThickness(c,id), joints: SpeakerCarrierJoint[] = [];
  function carrier(id: string, label: string, low: number, high: number, position: SpeakerPart["position"], rotation: SpeakerPart["rotation"], explode: SpeakerPart["explode"], holes: Pair[][]) {
    const height = high-low, bands = [-height/2+20,height/2-20];
    const body = rect((l.left+l.right)/2,0,l.right-l.left,height);
    const tabs = ["left","right"].flatMap(target => bands.map(y => {
      const x = target === "left" ? l.left-t(target)/2 : l.right+t(target)/2;
      const centre = new Vector3(x,y,0).applyEuler(new Euler(...rotation)).add(new Vector3(...position)).toArray() as SpeakerCarrierJoint["centre"];
      const size: SpeakerCarrierJoint["size"] = id === "pcb-floor" ? [t(target),t(id),14] : [t(target),14,t(id)];
      joints.push({ carrier:id,target,centre,size });
      return rect(x,y,t(target),14);
    }));
    const polygons = clipping.union([[body]],...tabs.map(ring=>[[ring]]));
    polygons[0].push(...holes.map(ring=>[...ring].reverse()));
    parts.push({id,label,width:c.width,height,thickness:t(id),polygons,position,rotation,explode});
  }
  // Leave the amplifier's right-hand mounting row and the main board's
  // front-left mount clear of the wiring windows.
  const floorHoles = [rect(l.left+25,0,18,10),rect(l.right-25,(l.floorFront-l.floorRear)/2-12,18,10)];
  carrier("pcb-floor","Internal PCB floor",l.floorRear,l.floorFront,[0,(l.floorBottom+l.floorTop)/2,l.floorZ],[Math.PI/2,0,0],[0,-18,0],floorHoles);
  const rearY = (l.rearBottom+l.rearTop)/2;
  carrier("pcb-rear","Internal PCB backplate",l.rearBottom,l.rearTop,[0,rearY,(l.rearBack+l.rearFront)/2],[0,0,0],[0,0,-18],[rect(0,l.floorTop+18-rearY,120,12)]);
  // Project each tab's cross-section into the receiving side sheet. This keeps
  // slot sizes tied to the carrier's own thickness, including mixed materials.
  for (const joint of joints) {
    const panel = parts.find(p=>p.id===joint.target)!;
    const inverse = new Quaternion().setFromEuler(new Euler(...panel.rotation)).invert();
    const local = new Vector3(...joint.centre).sub(new Vector3(...panel.position)).applyQuaternion(inverse);
    const span = new Vector3(...joint.size).applyQuaternion(inverse);
    panel.polygons[0].push(rect(local.x,local.y,Math.abs(span.x),Math.abs(span.y)).reverse());
  }
  return joints;
}
