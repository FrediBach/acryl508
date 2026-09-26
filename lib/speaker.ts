// MYND-derived geometry: Teufel, CC-BY-SA-4.0. Adaptation notes: docs/mynd-speaker.md.
import type { MultiPolygon, Pair } from "polygon-clipping";
import { defaultTint } from "./acrylic-material";
import { defaultSheetMaterials, normalizeSheetThicknesses, sheetThickness, sheetMaterialExport, sheetMaterialAttributes, type SheetMaterialConfiguration } from "./sheet-materials";
import { speakerFasteners, speakerBoardPlacements, speakerPanelMounts } from "./speaker-hardware";
import { standPathData } from "./synth-stand";

export const myndSource = "https://github.com/teufelaudio/mynd-hardware";
export const myndRevision = "149d002334b0725fba03499079bdaf2e61c8ff36";
// Dimensions extracted from the released STEP baffle, in mm. Source Z becomes
// local Y, centred on Z=90. Nominal diaphragm sizes are NOT mounting diameters.
export const myndDrivers = [
  { id: "woofer", label: "90 mm woofer", x: 0, y: -24, width: 86, height: 86, radius: 43, kind: "woofer" },
  { id: "tweeter-left", label: "20 mm tweeter · L", x: -93, y: 53.3, width: 39.4, height: 39.4, radius: 19.7, kind: "tweeter" },
  { id: "tweeter-right", label: "20 mm tweeter · R", x: 93, y: 53.3, width: 39.4, height: 39.4, radius: 19.7, kind: "tweeter" },
  { id: "radiator-left", label: "Passive radiator · L", x: -82, y: -18, width: 50, height: 100, radius: 21, kind: "radiator" },
  { id: "radiator-right", label: "Passive radiator · R", x: 82, y: -18, width: 50, height: 100, radius: 21, kind: "radiator" },
] as const;
export type SpeakerConfiguration = SheetMaterialConfiguration & {
  width: number; height: number; depth: number; grilleGap: number;
  dotDiameter: number; dotPitch: number; grilleBorder: number; staggered: boolean;
  portWidth: number; portHeight: number; controlWidth: number; controlDepth: number;
};
export const speakerLimits = {
  width: { min: 280, max: 420 }, height: { min: 190, max: 300 }, depth: { min: 110, max: 220 },
  thickness: { min: 3, max: 8 }, grilleGap: { min: 8, max: 25 },
  dotDiameter: { min: 2, max: 6 }, dotPitch: { min: 4, max: 12 }, grilleBorder: { min: 16, max: 28 },
  portWidth: { min: 50, max: 65 }, portHeight: { min: 30, max: 45 },
  controlWidth: { min: 140, max: 160 }, controlDepth: { min: 20, max: 35 },
};
export const defaultSpeakerConfiguration: SpeakerConfiguration = {
  ...defaultSheetMaterials, width: 280, height: 200, depth: 120, thickness: 5,
  tint: defaultTint, transparency: "transparent", grilleGap: 12,
  dotDiameter: 3, dotPitch: 5, grilleBorder: 18, staggered: true,
  portWidth: 56, portHeight: 37, controlWidth: 148, controlDepth: 24,
};
export function normalizeSpeakerConfiguration(input: SpeakerConfiguration): SpeakerConfiguration {
  const config = normalizeSheetThicknesses({ ...defaultSpeakerConfiguration, ...input }, 3, 8);
  for (const key of Object.keys(speakerLimits) as (keyof typeof speakerLimits)[]) {
    const value = Number.isFinite(config[key]) ? config[key] : defaultSpeakerConfiguration[key];
    config[key] = Math.max(speakerLimits[key].min, Math.min(speakerLimits[key].max, value));
  }
  config.dotPitch = Math.max(config.dotPitch, config.dotDiameter + 2);
  return config;
}
export function speakerRoundedRect(x: number, y: number, width: number, height: number, radius = 0): Pair[] {
  if (!radius) return [[x-width/2,y-height/2],[x+width/2,y-height/2],[x+width/2,y+height/2],[x-width/2,y+height/2],[x-width/2,y-height/2]];
  const ring: Pair[] = [];
  for (let corner = 0; corner < 4; corner++) {
    const angle = corner * Math.PI / 2;
    const cx = x + (corner === 0 || corner === 3 ? 1 : -1) * (width/2-radius);
    const cy = y + (corner < 2 ? 1 : -1) * (height/2-radius);
    for (let i=0;i<=12;i++) ring.push([cx+radius*Math.cos(angle+i*Math.PI/24),cy+radius*Math.sin(angle+i*Math.PI/24)]);
  }
  ring.push([...ring[0]]); return ring;
}
const circle = (x: number, y: number, r: number) => speakerRoundedRect(x,y,r*2,r*2,r);
export type SpeakerPart = { id: string; label: string; width: number; height: number; thickness: number; polygons: MultiPolygon; position: [number,number,number]; rotation: [number,number,number]; explode: [number,number,number] };
export function createSpeaker(input: SpeakerConfiguration) {
  const config = normalizeSpeakerConfiguration(input);
  const { width: w, height: h, depth: d } = config;
  const t = (id: string) => sheetThickness(config,id);
  const innerWidth = w-t("left")-t("right"), innerHeight = h-t("top")-t("bottom"), innerDepth = d-t("baffle")-t("rear");
  const mounts: Pair[] = [-1,1].flatMap(x => [-1,1].map(y => [x*(w/2-12),y*(h/2-12)] as Pair));
  const bolts = mounts.map(([x,y]) => circle(x,y,1.7));
  const driverMounts: Pair[] = [-1,1].flatMap(x => [-1,1].map(y => [x*38.5373,-24+y*38.5373] as Pair));
  for (const sign of [-1,1]) for (const [x,y] of [[63,22.5],[101,22.5],[63,121.5],[101,121.5],[52.95,55],[52.95,89],[111.05,55],[111.05,89]]) driverMounts.push([sign*x,y-90]);
  const dots: Pair[] = [], pitch = config.dotPitch, rowPitch = pitch*(config.staggered ? Math.sqrt(3)/2 : 1);
  const halfW = w/2-config.grilleBorder-config.dotDiameter/2, halfH = h/2-config.grilleBorder-config.dotDiameter/2;
  const rows = Math.floor(2*halfH/rowPitch);
  for (let row=0;row<=rows;row++) {
    const y = (row-rows/2)*rowPitch, offset = config.staggered && row%2 ? pitch/2 : 0;
    for (let col=-Math.ceil(halfW/pitch);col<=Math.ceil(halfW/pitch);col++) {
      const x=col*pitch+offset;
      if (Math.abs(x)<=halfW && mounts.every(([mx,my]) => Math.hypot(x-mx,y-my)>config.dotDiameter/2+5)) dots.push([x,y]);
    }
  }
  const parts: SpeakerPart[] = [];
  function part(id: string, label: string, width: number, height: number, holes: Pair[][], position: SpeakerPart["position"], rotation: SpeakerPart["rotation"], explode: SpeakerPart["explode"]) {
    parts.push({ id,label,width,height,thickness:t(id),polygons:[[speakerRoundedRect(0,0,width,height),...holes.map(ring => [...ring].reverse())]],position,rotation,explode });
  }
  part("baffle","Driver baffle",w,h,[...myndDrivers.map(driver=>speakerRoundedRect(driver.x,driver.y,driver.width,driver.height,driver.radius)),...driverMounts.map(([x,y])=>circle(x,y,1.7)),...bolts],[0,0,d/2-t("baffle")/2],[0,0,0],[0,0,32]);
  part("rear","Removable rear",w,h,bolts,[0,0,-d/2+t("rear")/2],[0,0,0],[0,0,-40]);
  part("top","Control panel",w,innerDepth,[speakerRoundedRect(0,(t("baffle")-t("rear"))/2,config.controlWidth,config.controlDepth,3)],[0,h/2-t("top")/2,(t("rear")-t("baffle"))/2],[Math.PI/2,0,0],[0,35,0]);
  part("bottom","Base",w,innerDepth,[],[0,-h/2+t("bottom")/2,(t("rear")-t("baffle"))/2],[Math.PI/2,0,0],[0,-35,0]);
  part("left","USB-C / AUX side",innerDepth,innerHeight,[speakerRoundedRect(0,-h/2+51.28-(t("bottom")-t("top"))/2,config.portWidth,config.portHeight,8) ],[-w/2+t("left")/2,(t("bottom")-t("top"))/2,(t("rear")-t("baffle"))/2],[0,Math.PI/2,0],[-35,0,0]);
  part("right","Right side",innerDepth,innerHeight,[],[w/2-t("right")/2,(t("bottom")-t("top"))/2,(t("rear")-t("baffle"))/2],[0,Math.PI/2,0],[35,0,0]);
  part("grille","Dot grille",w,h,[...dots.map(([x,y])=>circle(x,y,config.dotDiameter/2)),...bolts],[0,0,d/2+config.grilleGap+t("grille")/2],[0,0,0],[0,0,80]);
  const panelMounts = speakerPanelMounts({ config, parts });
  for (const mount of panelMounts) {
    parts.find(p => p.id === mount.parent)!.polygons[0].push(circle(...mount.position, mount.diameter / 2).reverse());
  }
  const grossVolumeLitres = innerWidth*innerHeight*innerDepth/1e6;
  return { config, parts, mounts, driverMounts, panelMounts, dots, innerWidth, innerHeight, innerDepth, grossVolumeLitres,
    totalDepth: d+config.grilleGap+t("grille"), openArea: dots.length*Math.PI*(config.dotDiameter/2)**2/((w-2*config.grilleBorder)*(h-2*config.grilleBorder))*100 };
}
export type Speaker = ReturnType<typeof createSpeaker>;
export const speakerBuildNotes = [
  "Reuse the MYND woofer, both tweeters, both passive radiators, original amplifier, main and Bluetooth boards, battery, UI, USB-C/AUX assemblies and wiring. The preview uses nine original PCB layouts with 788 referenced component models, plus the released radiator frames, port housing and HMI parts. Driver diaphragms, baskets, battery pack and cable routes are reconstructions; assembly placements in this new shell are provisional.",
  "Bond the baffle, top, base and side sheets into a sealed shell. Four M3 corner tie rods retain a gasketed removable rear with nuts and load-spreading washers. The preview includes these fasteners, driver screws and board standoffs. Mount the grille on separate spacers at those same centres. Seal penetrations and retain service access.",
  "Baffle centres and woofer/radiator screw centres come from Teufel’s STEP files. The 86 mm woofer and 39.4 mm tweeter openings reference CAD seating circles. Radiator windows are simplified 50 × 100 mm profiles. Verify seating, screw sizes, gaskets and adapter/clamp rings on the donor hardware; the original moulded recesses and tweeter clips are not reproduced in flat sheet.",
  "The sheets include 6 main-board mounting holes in the base, 10 PCB mounting holes in the rear, 3 connector-board holes in the baffle and 8 control-cover holes in the top, aligned to the source hardware and rendered supports. PCB sheet holes are Ø3.4 mm; control-cover holes are Ø3.5 mm. Verify the proposed standoff lengths and screw engagement on the donor.",
  "The side opening is based on the port-housing envelope; the top control opening is a proposed adapter opening. Fit and seal the original pods with custom adapters. Battery restraint, tweeter retainers and sealed pod adapters require donor measurements and are not included in the acrylic cutting patterns.",
  "The dot grille sits outside the acoustic chamber. Keep both passive radiators free to move. Gross internal volume excludes drivers, boards, battery and bracing; it is not the stock acoustic volume. Prototype sealing, panel resonance, radiator travel and DSP tuning. The replacement enclosure has no validated acoustic or IP rating.",
];
export const speakerHardware = ["MYND donor: 1 woofer, 2 tweeters, 2 passive radiators; retain original gaskets and frames", "Original MYND electronics, protected battery pack, controls, USB-C/AUX pods and wiring", "4 M3 corner tie rods, 4 rear nuts, 4 threaded grille spacers, 4 grille screws and 16 corner washers; size to the chosen depth", "20 illustrative M3 driver/radiator screws and washers; verify thread and engagement against the donor", "Rear perimeter gasket, acrylic-compatible bonding system and sealed pod adapters", "19 PCB standoffs with board-side and sheet-side screws / washers; 8 HMI-cover supports with screws / washers on both sides", "Battery restraint and driver mounting adapters / retainers"];
export function speakerSheetLayout(speaker: Speaker) {
  let x=10,y=10,rowHeight=0,right=0;
  const parts=speaker.parts.map(part=>{
    if(x>10 && x+part.width>950){x=10;y+=rowHeight+15;rowHeight=0;}
    const placement={part,x:x+part.width/2,y:y+part.height/2};
    right=Math.max(right,x+part.width);rowHeight=Math.max(rowHeight,part.height);x+=part.width+15;return placement;
  });
  return {parts,width:right+10,height:y+rowHeight+10};
}
export function speakerExport(speaker: Speaker) {
  return { product:"Acryl508",mode:"speaker",version:1,units:"mm",status:"unvalidated-prototype",configuration:speaker.config,
    source:{repository:myndSource,revision:myndRevision,license:"CC-BY-SA-4.0",changes:"Flat acrylic enclosure, simplified seating apertures, service openings and perforated grille; not a Teufel product or validated replacement."},
    dimensions:{width:speaker.config.width,height:speaker.config.height,bodyDepth:speaker.config.depth,totalDepth:speaker.totalDepth,grossVolumeLitres:speaker.grossVolumeLitres},
    previewHardware:{modelManifest:"/models/mynd/manifest.json",fasteners:speakerFasteners(speaker),boardPlacements:speakerBoardPlacements(speaker),status:"Source PCB/component/mechanical meshes; reconstructed drivers and battery; provisional placement and cable routing"},
    grille:{holes:speaker.dots.length,openAreaPercent:speaker.openArea},drivers:myndDrivers,panelMounts:speaker.panelMounts,parts:speaker.parts,sheetMaterials:sheetMaterialExport(speaker.config,speaker.parts),hardware:speakerHardware,notes:speakerBuildNotes,
    coordinates:"Millimetres. Sheet X right, Y up, thickness centred on local Z. Apply XYZ Euler rotation (radians) then position for assembly. Scene Z points forward. Explode vectors are preview-only offsets.",
  };
}
export function speakerSvg(speaker: Speaker) {
  const layout=speakerSheetLayout(speaker);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}mm" height="${layout.height}mm" viewBox="0 0 ${layout.width} ${layout.height}"><title>Acryl508 MYND acrylic speaker / 7 sheets</title><desc>Prototype. Verify donor fit, adapters and acoustic tuning before fabrication. Red: finished cut edges; apply kerf once in CAM. Adapted from Teufel MYND hardware ${myndSource} revision ${myndRevision}, CC-BY-SA-4.0. Changes: flat sheet enclosure, simplified apertures and dot grille. ${speakerBuildNotes.join(" ")}</desc>${layout.parts.map(({part,x,y})=>`<g id="${part.id}" ${sheetMaterialAttributes(speaker.config,part.id)} transform="translate(${x} ${y})"><title>${part.label}</title><path data-operation="cut" d="${standPathData(part.polygons)}" fill="none" stroke="#ef4444" stroke-width="0.2"/></g>`).join("")}</svg>`;
}
