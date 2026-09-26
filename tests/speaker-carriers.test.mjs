import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import clipping from "polygon-clipping";
import { Box3, Euler, Matrix4, Quaternion, Vector3 } from "three";
import { loadTypescript } from "./load-typescript.mjs";
const {createSpeaker,defaultSpeakerConfiguration:defaults,speakerExport}=await loadTypescript("../lib/speaker.ts");
const {speakerBoardPlacements,speakerFasteners}=await loadTypescript("../lib/speaker-hardware.ts");
const {parseProject}=await loadTypescript("../lib/project.ts");
const manifest=JSON.parse(readFileSync(new URL("../public/models/mynd/manifest.json",import.meta.url)));
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} ≈ ${b}`);
const ringArea=r=>Math.abs(r.reduce((s,p,i)=>{const q=r[(i+1)%r.length];return s+p[0]*q[1]-q[0]*p[1];},0)/2);
const area=polygons=>polygons.reduce((s,p)=>s+ringArea(p[0])-p.slice(1).reduce((n,r)=>n+ringArea(r),0),0);

test("internal carriers leave exterior PCB faces clean and every cap head inside the shell",()=>{
  for(const depth of [110,220]) for(const height of [210,300]) for(const thickness of [3,8]) {
    const s=createSpeaker({...defaults,depth,height,thickness,individualSheetMaterials:true,
      sheetThicknesses:{left:3,right:8,bottom:8,rear:3,"pcb-floor":8,"pcb-rear":3}});
    const parts=Object.fromEntries(s.parts.map(p=>[p.id,p]));
    assert.equal(parts.bottom.polygons[0].length,1,"Outer bottom is solid and flat");
    assert.equal(parts.rear.polygons[0].length,5,"Only the four enclosure tie holes remain in the rear");
    assert.equal(parts.baffle.polygons[0].length,30,"Baffle retains only donor apertures and enclosure/driver mounts");
    const floorBottom=parts["pcb-floor"].position[1]-parts["pcb-floor"].thickness/2;
    assert.ok(floorBottom>-height/2+12+1.5+1,"Floor clears lower corner tie rods");
    const backplateTop=parts["pcb-rear"].position[1]+parts["pcb-rear"].height/2;
    assert.ok(backplateTop<height/2-12-1.5-1,"Backplate clears upper corner tie rods");
    const boards=speakerBoardPlacements(s).filter(b=>b.standoff);
    assert.equal(boards.length,5);
    assert.ok(boards.every(b=>["pcb-floor","pcb-rear"].includes(b.parent)));
    assert.equal(s.panelMounts.filter(m=>m.id.startsWith("pcb-")).length,19);
    for(const screw of speakerFasteners(s).filter(f=>f.id.startsWith("pcb-")&&f.kind==="screw")) {
      const direction=new Vector3(0,0,1).applyEuler(new Euler(...screw.rotation));
      const head=new Vector3(...screw.position).addScaledVector(direction,3);
      assert.ok(head.y>-height/2+8+1,"All base cap heads clear the inner bottom");
      assert.ok(head.z>-depth/2+3+1,"All backplate cap heads clear the inner rear");
    }
    const main=speakerBoardPlacements(s).find(b=>b.id==="Main");
    const rearFront=parts["pcb-rear"].position[2]+parts["pcb-rear"].thickness/2;
    assert.ok(main.position[2]-37.5>=rearFront+3-1e-8,"PCB clears the backplate at minimum depth");
    assert.ok(main.position[2]+37.5<=depth/2-parts.baffle.thickness-3+1e-8);
    const boxes=speakerBoardPlacements(s).filter(b=>b.parent.startsWith("pcb-")).map(board=>{
      const [min,max]=manifest.assets[board.id].bounds;
      const transform=new Matrix4().compose(new Vector3(...board.position),new Quaternion().setFromEuler(new Euler(...board.rotation)),new Vector3(1,1,1));
      return {id:board.id,box:new Box3(new Vector3(...min),new Vector3(...max)).applyMatrix4(transform)};
    });
    for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++) {
      // Mated connectors intentionally share an envelope. Their substrate
      // clearance and actual header insertion are checked separately.
      if ([boxes[i].id,boxes[j].id].includes("Conn_Amp") && [boxes[i].id,boxes[j].id].some(id=>["Amp","Conn_Baffle"].includes(id))) continue;
      assert.equal(boxes[i].box.intersectsBox(boxes[j].box),false,`${boxes[i].id} clears ${boxes[j].id}`);
    }
    const connector=boxes.find(b=>b.id==="Conn_Baffle").box;
    assert.ok(connector.min.x>36,"Relocated connector clears the battery width");
    assert.ok(connector.max.y<height/2-parts.top.thickness-22.4-2,"Relocated connector remains below the HMI cover");
  }
});

test("eight rectangular joints exactly match carrier tabs and remain flush at both side faces",()=>{
  for(const thickness of [3,8]) {
    const s=createSpeaker({...defaults,depth:110,height:210,thickness,individualSheetMaterials:true,
      sheetThicknesses:{left:8,right:3,top:8,bottom:3,rear:8,baffle:3,"pcb-floor":3,"pcb-rear":8}});
    assert.equal(s.carrierJoints.length,8);
    for(const joint of s.carrierJoints) {
      const carrier=s.parts.find(p=>p.id===joint.carrier),side=s.parts.find(p=>p.id===joint.target);
      const inverse=p=>new Quaternion().setFromEuler(new Euler(...p.rotation)).invert();
      const local=(p,v)=>new Vector3(...v).sub(new Vector3(...p.position)).applyQuaternion(inverse(p));
      const centre=local(side,joint.centre),span=new Vector3(...joint.size).applyQuaternion(inverse(side));
      const w=Math.abs(span.x),h=Math.abs(span.y);
      close(Math.abs(joint.centre[0])+joint.size[0]/2,s.config.width/2);
      close(joint.size[0],side.thickness);
      close(joint.size[joint.carrier==="pcb-floor"?1:2],carrier.thickness);
      const slot=side.polygons[0].slice(1).find(r=>Math.abs(Math.min(...r.map(v=>v[0]))-(centre.x-w/2))<1e-7&&Math.abs(Math.min(...r.map(v=>v[1]))-(centre.y-h/2))<1e-7);
      assert.ok(slot,"Matching receiving slot exists");close(ringArea(slot),w*h);
      const tabCentre=local(carrier,joint.centre),tabSpan=new Vector3(...joint.size).applyQuaternion(inverse(carrier));
      const tx=Math.abs(tabSpan.x)/2,ty=Math.abs(tabSpan.y)/2;
      const tab=[[tabCentre.x-tx,tabCentre.y-ty],[tabCentre.x+tx,tabCentre.y-ty],[tabCentre.x+tx,tabCentre.y+ty],[tabCentre.x-tx,tabCentre.y+ty],[tabCentre.x-tx,tabCentre.y-ty]];
      close(area(clipping.intersection(carrier.polygons,[[tab]])),4*tx*ty);
    }
    for(const part of s.parts.filter(p=>p.id!=="grille")) {
      const [outer,...holes]=part.polygons[0];
      const resolved=clipping.difference([[outer]],...holes.map(r=>[[r]]));
      assert.equal(resolved.length,1);assert.equal(resolved[0].length,holes.length+1,`${part.id}: joints and mounts stay separate`);
      const x=outer.map(p=>p[0]),y=outer.map(p=>p[1]);
      close(Math.max(...x)-Math.min(...x),part.width);close(Math.max(...y)-Math.min(...y),part.height);
    }
  }
});

test("carrier material overrides, joint metadata and all nine parts survive project export",()=>{
  const s=createSpeaker({...defaults,individualSheetMaterials:true,sheetThicknesses:{"pcb-floor":3,"pcb-rear":8}});
  const data=speakerExport(s),project=parseProject(JSON.stringify(data));
  assert.deepEqual(project.designs.speaker,s.config);
  assert.equal(data.parts.length,9);assert.equal(data.carrierJoints.length,8);
  assert.equal(data.sheetMaterials.find(p=>p.id==="pcb-floor").thickness,3);
  assert.equal(data.sheetMaterials.find(p=>p.id==="pcb-rear").thickness,8);
});
