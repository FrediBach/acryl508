// MYND-derived geometry: Teufel, CC-BY-SA-4.0. Adaptation notes: docs/mynd-speaker.md.
import { speakerRoundedRect } from "./speaker-shapes";
export { speakerRoundedRect } from "./speaker-shapes";
import type { MultiPolygon, Pair } from "polygon-clipping";
import { defaultTint } from "./acrylic-material";
import { defaultSheetMaterials, normalizeSheetThicknesses, sheetThickness, sheetMaterialExport, sheetMaterialAttributes, type SheetMaterialConfiguration } from "./sheet-materials";
import { speakerFasteners, speakerBoardPlacements, speakerPanelMounts } from "./speaker-hardware";
import { standPathData } from "./synth-stand";
import { myndPort, myndPortOpening } from "./mynd-port";
import { myndButtons, myndControls } from "./mynd-controls";
import { addSpeakerCarriers } from "./speaker-carriers";
import { addSpeakerSideProfiles, speakerHandleSides } from "./speaker-side-profiles";
import { handleSizeLimits } from "./configurator";
import { flatFeetLayout, flatFootHeightLimits, type FlatFootStyle } from "./flat-feet";
import { speakerDampingParts, speakerDampingThickness, speakerDampingMaterial, speakerDampingNote } from "./speaker-damping";
import { speakerAcousticChamber, speakerAcousticComparison, speakerAcousticSources } from "./speaker-acoustics";

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
  flatFeet: boolean; flatFootStyle: FlatFootStyle; flatFootHeight: number;
  handle: boolean; handleMode: "left" | "right" | "pair"; handleWidth: number; handleHeight: number;
  damping: boolean; dampingThickness: number;
  acousticDisplacementLitres: number;
};
export const speakerLimits = {
  width: { min: 280, max: 420 }, height: { min: 210, max: 300 }, depth: { min: 110, max: 220 },
  thickness: { min: 3, max: 8 }, grilleGap: { min: 8, max: 25 },
  dotDiameter: { min: 2, max: 6 }, dotPitch: { min: 4, max: 12 }, grilleBorder: { min: 16, max: 28 },
  portWidth: { min: myndPort.width, max: myndPort.width }, portHeight: { min: myndPort.openingHeight, max: myndPort.openingHeight },
  controlWidth: { min: myndControls.width, max: myndControls.width }, controlDepth: { min: myndControls.depth, max: myndControls.depth },
  flatFootHeight: flatFootHeightLimits, handleWidth: { ...handleSizeLimits.width, min: 100 }, handleHeight: handleSizeLimits.height,
  dampingThickness: { min: 0.25, max: 2 },
  acousticDisplacementLitres: { min: 0, max: 4 },
};
export const defaultSpeakerConfiguration: SpeakerConfiguration = {
  ...defaultSheetMaterials, width: 280, height: 210, depth: 120, thickness: 5,
  tint: defaultTint, transparency: "transparent", grilleGap: 12,
  dotDiameter: 3, dotPitch: 5, grilleBorder: 18, staggered: true,
  portWidth: myndPort.width, portHeight: myndPort.openingHeight, controlWidth: myndControls.width, controlDepth: myndControls.depth,
  flatFeet: false, flatFootStyle: "pads", flatFootHeight: 15,
  handle: false, handleMode: "pair", handleWidth: 160, handleHeight: 70,
  damping: false, dampingThickness: 1,
  acousticDisplacementLitres: 0,
};
export function normalizeSpeakerConfiguration(input: SpeakerConfiguration): SpeakerConfiguration {
  const config = normalizeSheetThicknesses({ ...defaultSpeakerConfiguration, ...input }, 3, 8);
  for (const key of Object.keys(speakerLimits) as (keyof typeof speakerLimits)[]) {
    const value = Number.isFinite(config[key]) ? config[key] : defaultSpeakerConfiguration[key];
    config[key] = Math.max(speakerLimits[key].min, Math.min(speakerLimits[key].max, value));
  }
  config.dotPitch = Math.max(config.dotPitch, config.dotDiameter + 2);
  config.flatFootStyle = flatFeetLayout({ ...config, angle: 0 }).style;
  if (!["left","right","pair"].includes(config.handleMode)) config.handleMode = "pair";
  return config;
}
const circle = (x: number, y: number, r: number) => speakerRoundedRect(x,y,r*2,r*2,r);
export type SpeakerPart = { id: string; label: string; width: number; height: number; thickness: number; polygons: MultiPolygon; position: [number,number,number]; rotation: [number,number,number]; explode: [number,number,number] };
export function createSpeaker(input: SpeakerConfiguration) {
  const config = normalizeSpeakerConfiguration(input);
  const { width: w, height: h, depth: d } = config;
  const gasket = speakerDampingThickness(config);
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
  const buttonDepth = myndControls.depthOrigin-myndControls.buttonSourceY+(t("baffle")-t("rear"))/2;
  const handleSides = speakerHandleSides(config);
  const leftInset = handleSides.includes("left") ? t("left") : 0, rightInset = handleSides.includes("right") ? t("right") : 0;
  const topX = (leftInset-rightInset)/2;
  part("top","Control panel",w-leftInset-rightInset,innerDepth,myndButtons.map(button=>speakerRoundedRect(button.x-topX,buttonDepth,button.width,button.height,button.radius)),[topX,h/2-t("top")/2,(t("rear")-t("baffle"))/2],[Math.PI/2,0,0],[0,35,0]);
  part("bottom","Base",config.flatFeet ? innerWidth : w,innerDepth,[],[config.flatFeet ? (t("left")-t("right"))/2 : 0,-h/2+t("bottom")/2,(t("rear")-t("baffle"))/2],[Math.PI/2,0,0],[0,-35,0]);
  // Retain the flange behind the sheet; cut its access wire, not its envelope.
  // Local side X maps to -world Z, including mixed front/rear thickness offsets.
  const portOpening = myndPortOpening.map(([x,y]) => [x+(t("rear")-t("baffle"))/2,y-h/2+myndPort.height-(t("bottom")-t("top"))/2] as Pair);
  part("left","USB-C / AUX side",innerDepth,innerHeight,[portOpening],[-w/2+t("left")/2,(t("bottom")-t("top"))/2,(t("rear")-t("baffle"))/2],[0,Math.PI/2,0],[-35,0,0]);
  part("right","Right side",innerDepth,innerHeight,[],[w/2-t("right")/2,(t("bottom")-t("top"))/2,(t("rear")-t("baffle"))/2],[0,Math.PI/2,0],[35,0,0]);
  part("grille","Dot grille",w,h,[...dots.map(([x,y])=>circle(x,y,config.dotDiameter/2)),...bolts],[0,0,d/2+config.grilleGap+t("grille")/2],[0,0,0],[0,0,80]);
  const feet = addSpeakerSideProfiles(config,parts), footHeight = feet.enabled ? feet.height : 0;
  const carrierJoints = addSpeakerCarriers(config,parts);
  const panelMounts = speakerPanelMounts({ config, parts });
  for (const mount of panelMounts) {
    parts.find(p => p.id === mount.parent)!.polygons[0].push(circle(...mount.position, mount.diameter / 2).reverse());
  }
  // Extend the clamped end panels outward; all bonded shell joints and donor
  // electronics stay registered to the original shell dimensions.
  for (const panel of parts) {
    if (panel.id === "baffle" || panel.id === "grille") panel.position[2] += gasket;
    if (panel.id === "rear") panel.position[2] -= gasket;
  }
  const dampingParts = speakerDampingParts(config);
  const grossVolumeLitres = innerWidth*innerHeight*(innerDepth+2*gasket)/1e6;
  const topY = h/2+(config.handle ? config.handleHeight : 0), floorY = -h/2-footHeight;
  const handleCentreZ = (t("rear")-t("baffle"))/2;
  const rearZ = Math.min(-d/2-gasket,config.handle ? handleCentreZ-config.handleWidth/2 : -d/2-gasket);
  const frontZ = Math.max(d/2+gasket+config.grilleGap+t("grille"),config.handle ? handleCentreZ+config.handleWidth/2 : d/2+gasket);
  const handles = {enabled:config.handle,mode:config.handleMode,sides:handleSides,widthMm:config.handleWidth,riseMm:config.handleHeight,additionalParts:0};
  return { config, parts, dampingParts, mounts, driverMounts, panelMounts, carrierJoints, feet, handles, totalHeight:topY-floorY, floorY, topY, rearZ, frontZ, overallDepth:frontZ-rearZ, dots, innerWidth, innerHeight, innerDepth:innerDepth+2*gasket, grossVolumeLitres,
    bodyDepth: d+2*gasket, totalDepth: d+2*gasket+config.grilleGap+t("grille"), openArea: dots.length*Math.PI*(config.dotDiameter/2)**2/((w-2*config.grilleBorder)*(h-2*config.grilleBorder))*100 };
}
export type Speaker = ReturnType<typeof createSpeaker>;
export const speakerBuildNotes = [
  speakerDampingNote,
  "The amplifier sits beside the main board on the PCB floor. Its right-angle connector board plugs into the amplifier and mates with the baffle connector supported from the backplate; it has no separate screw mounts. Connector axes follow the source models, but the 10 mm contact-board spacing and approximately 48.84 mm backplate supports require a donor measurement before fabrication.",
  "Reuse the MYND woofer, both tweeters, both passive radiators, original amplifier, main and Bluetooth boards, battery, UI, USB-C/AUX assemblies and wiring. The preview uses nine original PCB layouts with 788 referenced component models, plus the released radiator frames, port housing and HMI parts. Driver diaphragms, baskets, battery pack and cable routes are reconstructions; assembly placements in this new shell are provisional.",
  "Bond the top, base and side sheets into a sealed shell. Without optional damping, bond the baffle too; with damping, clamp it against the front gasket using the four M3 corner tie rods. The rods also retain the removable rear with nuts and load-spreading washers. The preview includes these fasteners, driver screws and board standoffs. Mount the grille on separate spacers at those same centres. Seal penetrations and retain service access.",
  "Baffle centres and woofer/radiator screw centres come from Teufel’s STEP files. The 86 mm woofer and 39.4 mm tweeter openings reference CAD seating circles. Radiator windows are simplified 50 × 100 mm profiles. Verify seating, screw sizes, gaskets and adapter/clamp rings on the donor hardware; the original moulded recesses and tweeter clips are not reproduced in flat sheet.",
  "Two internal acrylic carriers hold all 19 PCB standoff mounts: 10 in the raised PCB floor and 9 in the PCB backplate. Flush tabs fit eight rectangular side-wall slots; bond and seal the joints. At least 5 mm behind each carrier encloses the 3.5 mm screw-head/washer stack. The raised floor and backplate edges clear the corner tie rods. The minimum body height is 210 mm to accommodate the raised electronics; the main board is turned to keep its taller components away from the woofer. The outer bottom is unperforated and flat; the outer rear and baffle have no PCB screw holes. The top retains 8 control-cover mounting holes. Verify standoff lengths and screw engagement on the donor.",
  "The side opening follows the source port-housing access wire, with two Ø2.8 mm side screw holes and two Ø3.4 mm recessed-mount screw holes. Retain the flange behind the acrylic, use the illustrated M2.5/M3 through fasteners and two 7 mm counterbore sleeves, and seal the contact face. Verify screw lengths and the donor’s mounting method. The top has three Ø18 mm button cutouts and one 38 × 18 mm capsule for the combined volume rocker. The HMI assembly sits on 7.1 mm supports, with its rubber backing beneath the sheet. Verify button travel, finger access with thicker acrylic, clearances and sealing. Battery restraint, tweeter retainers and sealing gaskets require donor measurements and are not included in the acrylic cutting patterns.",
  "Optional feet extend the side-sheet profiles using pads, arches or runners. With feet enabled, the base fits between the extended sides to avoid overlapping acrylic; the enclosure and PCB joints stay at the same height. All feet share a level contact plane. Prototype stability and protect the acrylic contact edges as needed.",
  "Optional handles extend one or both side sheets, using the Eurorack case’s rounded roots and grip opening. The top nests between the extended sides without moving the controls. Handle width and rise affect the cutting envelope, not the chamber volume. Prototype carrying strength and bonded joints before lifting the assembled speaker.",
  "The dot grille sits outside the acoustic chamber. Keep both passive radiators free to move. Gross internal volume excludes drivers, boards, battery and bracing; it is not the stock acoustic volume. Prototype sealing, panel resonance, radiator travel and DSP tuning. The replacement enclosure has no validated acoustic or IP rating.",
];
export const speakerHardware = ["MYND donor: 1 woofer, 2 tweeters, 2 passive radiators; retain original gaskets and frames", "Original MYND electronics, protected battery pack, controls, USB-C/AUX pods and wiring", "4 M3 corner tie rods, 4 rear nuts, 4 threaded grille spacers, 4 grille screws and 16 corner washers; size to the chosen depth", "20 illustrative M3 driver/radiator screws and washers; verify thread and engagement against the donor", "Front and rear damping frames when enabled; otherwise a donor-measured rear seal. Acrylic-compatible bonding system and port/control sealing gaskets", "19 PCB standoffs with board-side and sheet-side screws / washers; 8 HMI-cover supports with screws / washers on both sides", "Port housing: 2 M2.5 and 2 M3 through screws, 4 nuts, 8 washers and 2 counterbore sleeves (7 mm); verify donor fit", "Battery restraint and driver mounting adapters / retainers"];
export function speakerSheetLayout(speaker: Speaker) {
  let x=10,y=10,rowHeight=0,right=0;
  const parts=[...speaker.parts,...speaker.dampingParts].map(part=>{
    if(x>10 && x+part.width>950){x=10;y+=rowHeight+15;rowHeight=0;}
    const placement={part,x:x+part.width/2,y:y+part.height/2};
    right=Math.max(right,x+part.width);rowHeight=Math.max(rowHeight,part.height);x+=part.width+15;return placement;
  });
  return {parts,width:right+10,height:y+rowHeight+10};
}
export function speakerExport(speaker: Speaker) {
  return { product:"Acryl508",mode:"speaker",version:1,units:"mm",status:"unvalidated-prototype",configuration:speaker.config,
    source:{repository:myndSource,revision:myndRevision,license:"CC-BY-SA-4.0",changes:"Flat acrylic enclosure, simplified seating apertures, service openings and perforated grille; not a Teufel product or validated replacement."},
    dimensions:{width:speaker.config.width,height:speaker.config.height,totalHeight:speaker.totalHeight,bodyDepth:speaker.bodyDepth,totalDepth:speaker.totalDepth,overallDepth:speaker.overallDepth,grossVolumeLitres:speaker.grossVolumeLitres},
    damping:{enabled:speaker.config.damping,thickness:speaker.config.dampingThickness,material:speakerDampingMaterial,parts:speaker.dampingParts,notes:speakerDampingNote},
    acoustics:{model:"Air-spring-only relative trend and empty rigid-box first axial modes; not a frequency response or bass-cutoff prediction",reference:"Default acrylic case, not the original MYND enclosure",displacementLitres:speaker.config.acousticDisplacementLitres,
      ...speakerAcousticComparison(speakerAcousticChamber(speaker.config),speakerAcousticChamber(defaultSpeakerConfiguration),speaker.config.acousticDisplacementLitres),sources:speakerAcousticSources},
    feet:{...speaker.feet,method:"Integral side-panel profiles",additionalParts:0,contactCount:speaker.feet.enabled ? speaker.feet.style === "runners" ? 2 : 4 : 0},
    handles:{...speaker.handles,method:"Integral side-panel grips",roundedRoots:true},
    previewHardware:{modelManifest:"/models/mynd/manifest.json",fasteners:speakerFasteners(speaker),boardPlacements:speakerBoardPlacements(speaker),status:"Source PCB/component/mechanical meshes; reconstructed drivers and battery; provisional placement and cable routing"},
    grille:{holes:speaker.dots.length,openAreaPercent:speaker.openArea},drivers:myndDrivers,panelMounts:speaker.panelMounts,carrierJoints:speaker.carrierJoints,parts:speaker.parts,sheetMaterials:sheetMaterialExport(speaker.config,speaker.parts),hardware:speakerHardware,notes:speakerBuildNotes,
    coordinates:"Millimetres. Sheet X right, Y up, thickness centred on local Z. Apply XYZ Euler rotation (radians) then position for assembly. Scene Z points forward. Explode vectors are preview-only offsets.",
  };
}
export function speakerSvg(speaker: Speaker) {
  const layout=speakerSheetLayout(speaker);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}mm" height="${layout.height}mm" viewBox="0 0 ${layout.width} ${layout.height}"><title>Acryl508 MYND acrylic speaker / ${speaker.parts.length} sheets${speaker.dampingParts.length ? ` + ${speaker.dampingParts.length} damping gaskets` : ""}</title><desc>Prototype. Verify donor fit, adapters and acoustic tuning before fabrication. Red: finished cut edges; apply kerf once in CAM. Adapted from Teufel MYND hardware ${myndSource} revision ${myndRevision}, CC-BY-SA-4.0. Changes: flat sheet enclosure, simplified apertures and dot grille. ${speakerBuildNotes.join(" ")}</desc>${layout.parts.map(({part,x,y})=>`<g id="${part.id}" ${part.id.startsWith("damping-") ? `data-material="${speakerDampingMaterial}" data-thickness-mm="${part.thickness}"` : sheetMaterialAttributes(speaker.config,part.id)} transform="translate(${x} ${y})"><title>${part.label}</title><path data-operation="cut" d="${standPathData(part.polygons)}" fill="none" stroke="#ef4444" stroke-width="0.2"/></g>`).join("")}</svg>`;
}
