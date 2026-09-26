import assert from "node:assert/strict";
import test from "node:test";
import clipping from "polygon-clipping";
import { Euler, Vector3 } from "three";
import { loadTypescript } from "./load-typescript.mjs";
const {createSpeaker,defaultSpeakerConfiguration:defaults,speakerExport,speakerSvg,speakerSheetLayout}=await loadTypescript("../lib/speaker.ts");
const {speakerFasteners,speakerBoardPlacements}=await loadTypescript("../lib/speaker-hardware.ts");
const {parseProject}=await loadTypescript("../lib/project.ts");
const {speakerFabrication}=await loadTypescript("../lib/fabrication.ts");
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} ≈ ${b}`);
const world=(part,[x,y])=>new Vector3(x,y,0).applyEuler(new Euler(...part.rotation)).add(new Vector3(...part.position));
const area=ring=>Math.abs(ring.reduce((sum,p,i)=>{const q=ring[(i+1)%ring.length];return sum+p[0]*q[1]-q[0]*p[1];},0)/2);

test("integral handles stay connected, preserve donor alignment and meet the inset top on either side",()=>{
  for(const handleMode of ["left","right","pair"])for(const depth of [110,220])for(const [handleWidth,handleHeight] of [[100,50],[240,110]])for(const style of [null,"pads","arch","runners"]) {
    const config={...defaults,handle:true,handleMode,handleWidth,handleHeight,depth,flatFeet:!!style,flatFootStyle:style??"pads",flatFootHeight:30,
      individualSheetMaterials:true,sheetThicknesses:{left:3,right:8,top:8,bottom:3,rear:8,baffle:3}};
    const s=createSpeaker(config),off=createSpeaker({...config,handle:false}),top=s.parts.find(p=>p.id==="top");
    assert.equal(s.config.handleWidth,handleWidth);
    assert.equal(s.parts.length,10);assert.equal(s.grossVolumeLitres,off.grossVolumeLitres);
    assert.equal(s.totalHeight,defaults.height+handleHeight+(style?30:0));
    assert.deepEqual(speakerBoardPlacements(s),speakerBoardPlacements(off));
    assert.deepEqual(s.carrierJoints,off.carrierJoints);
    const offHardware=speakerFasteners(off);
    speakerFasteners(s).forEach((item,i)=>item.position.forEach((v,axis)=>close(v,offHardware[i].position[axis])));
    for(const id of ["left","right"]) {
      const side=s.parts.find(p=>p.id===id),original=off.parts.find(p=>p.id===id),active=handleMode===id||handleMode==="pair";
      const outline=side.polygons[0][0].map(p=>world(side,p));
      close(Math.max(...outline.map(p=>p.y)),defaults.height/2+(active?handleHeight:-8));
      close(Math.min(...outline.map(p=>p.y)),style?s.floorY:-defaults.height/2+3);
      const [outer,...holes]=side.polygons[0];
      const resolved=clipping.difference([[outer]],...holes.map(r=>[[r]]));
      assert.equal(resolved.length,1,"One connected sheet");assert.equal(resolved[0].length,holes.length+1,"All openings enclosed and separate");
      close(area(outer)-holes.reduce((sum,r)=>sum+area(r),0),area(resolved[0][0])-resolved[0].slice(1).reduce((sum,r)=>sum+area(r),0));
      assert.equal(side.polygons[0].length,original.polygons[0].length+(active?1:0));
      if(!active)assert.deepEqual(side,original);
      else {
        const grip=holes.find(r=>r.every(p=>world(side,p).y>defaults.height/2));
        assert.ok(grip,"Grip opening above enclosure");
        close(Math.min(...grip.map(p=>world(side,p).y)),defaults.height/2+20);
        close(Math.max(...grip.map(p=>world(side,p).y)),s.topY-16);
      }
      const sheetEdge=top.position[0]+(id==="left"?-1:1)*top.width/2;
      const contact=side.position[0]+(id==="left"?1:-1)*side.thickness/2*(active?1:-1);
      close(sheetEdge,contact);
    }
    // Every original aperture remains fixed, even with the top offset for one handle.
    for(const id of ["left","right","top"]) {
      const part=s.parts.find(p=>p.id===id),old=off.parts.find(p=>p.id===id);
      const originalHoles=old.polygons[0].slice(1).map(r=>r.map(p=>world(old,p)));
      const holes=part.polygons[0].slice(1).filter(r=>!r.every(p=>world(part,p).y>defaults.height/2));
      holes.forEach((ring,i)=>ring.forEach((p,j)=>world(part,p).toArray().forEach((v,axis)=>close(v,originalHoles[i][j].toArray()[axis]))));
    }
    for(const id of ["bottom","rear","baffle","grille","pcb-floor","pcb-rear"])assert.deepEqual(s.parts.find(p=>p.id===id),off.parts.find(p=>p.id===id));
    assert.deepEqual(createSpeaker({...s.config,handle:false}),off,"Disabling handles restores all cuts");
  }
});

test("full handle envelope feeds cutting, fabrication, saved settings and legacy defaults",()=>{
  const s=createSpeaker({...defaults,handle:true,handleMode:"pair",handleWidth:240,handleHeight:110,flatFeet:true});
  close(s.overallDepth,240);close(s.totalHeight,335);
  const fabrication=speakerFabrication(s),layout=speakerSheetLayout(s);
  for(const {part,x,y} of layout.parts) {
    for(const polygon of part.polygons)for(const ring of polygon)for(const [px,py] of ring) {
      assert.ok(Math.abs(px)<=part.width/2+1e-7);assert.ok(Math.abs(py)<=part.height/2+1e-7);
      assert.ok(x+px>=0&&x+px<=layout.width);assert.ok(y-py>=0&&y-py<=layout.height);
    }
    const cut=fabrication.parts.find(p=>p.id===part.id);
    close(Math.max(...cut.polygons[0][0].map(p=>p[0]))-Math.min(...cut.polygons[0][0].map(p=>p[0])),part.width);
  }
  const data=speakerExport(s);
  assert.deepEqual(parseProject(JSON.stringify(data)).designs.speaker,s.config);
  assert.deepEqual(data.handles.sides,["left","right"]);assert.equal(data.handles.additionalParts,0);
  assert.equal(data.dimensions.overallDepth,240);assert.match(speakerSvg(s),/10 sheets/);
  const legacy=structuredClone(data);
  for(const key of ["handle","handleMode","handleWidth","handleHeight"])delete legacy.configuration[key];
  assert.equal(parseProject(JSON.stringify(legacy)).designs.speaker.handle,false);
  for(const patch of [{handle:"yes"},{handleMode:"auto"},{handleWidth:null},{handleHeight:null}]) {
    const bad=structuredClone(data);Object.assign(bad.configuration,patch);
    assert.throws(()=>parseProject(JSON.stringify(bad)));
  }
  const bounded=createSpeaker({...defaults,handle:true,handleWidth:1000,handleHeight:1});
  assert.equal(bounded.config.handleWidth,240);assert.equal(bounded.config.handleHeight,50);
});
