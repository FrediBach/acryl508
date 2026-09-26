import assert from "node:assert/strict";
import test from "node:test";
import clipping from "polygon-clipping";
import { Euler, Vector3 } from "three";
import { loadTypescript } from "./load-typescript.mjs";
const {createSpeaker,defaultSpeakerConfiguration:defaults,speakerExport,speakerSvg}=await loadTypescript("../lib/speaker.ts");
const {speakerFasteners,speakerBoardPlacements}=await loadTypescript("../lib/speaker-hardware.ts");
const {parseProject}=await loadTypescript("../lib/project.ts");
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} ≈ ${b}`);
const world=(part,[x,y])=>new Vector3(x,y,0).applyEuler(new Euler(...part.rotation)).add(new Vector3(...part.position));

test("integral speaker feet share a level floor, preserve mounts and fit the inset base",()=>{
  const outlines=new Set();
  for(const flatFootStyle of ["pads","arch","runners"])for(const flatFootHeight of [8,30]) {
    const config={...defaults,flatFeet:true,flatFootStyle,flatFootHeight,individualSheetMaterials:true,
      sheetThicknesses:{left:3,right:8,top:8,bottom:3,rear:8,baffle:3}};
    const s=createSpeaker(config),off=createSpeaker({...config,flatFeet:false});
    assert.equal(s.parts.length,10);assert.equal(s.grossVolumeLitres,off.grossVolumeLitres);
    assert.equal(s.totalHeight,defaults.height+flatFootHeight);
    assert.deepEqual(speakerBoardPlacements(s),speakerBoardPlacements(off));
    assert.deepEqual(s.carrierJoints,off.carrierJoints);
    const onHardware=speakerFasteners(s),offHardware=speakerFasteners(off);
    onHardware.forEach((item,i)=>item.position.forEach((v,axis)=>close(v,offHardware[i].position[axis])));
    for(const id of ["left","right"]) {
      const side=s.parts.find(p=>p.id===id),original=off.parts.find(p=>p.id===id);
      const outline=side.polygons[0][0].map(p=>world(side,p));
      close(Math.min(...outline.map(p=>p.y)),s.floorY);
      close(Math.max(...outline.map(p=>p.y)),defaults.height/2-8);
      assert.ok(outline.filter(p=>Math.abs(p.y-s.floorY)<1e-7).length>=2,"Level contacts at both ends");
      assert.equal(side.height,defaults.height-8+flatFootHeight);
      const [outer,...holes]=side.polygons[0];
      const resolved=clipping.difference([[outer]],...holes.map(r=>[[r]]));
      assert.equal(resolved.length,1);assert.equal(resolved[0].length,holes.length+1);
      holes.forEach((ring,i)=>ring.forEach((p,j)=>{
        const a=world(side,p),b=world(original,original.polygons[0][i+1][j]);
        close(a.x,b.x);close(a.y,b.y);close(a.z,b.z);
      }));
      if(flatFootHeight===8&&id==="left")outlines.add(JSON.stringify(outer));
    }
    const base=s.parts.find(p=>p.id==="bottom");
    const left=s.parts.find(p=>p.id==="left"),right=s.parts.find(p=>p.id==="right");
    close(base.position[0]-base.width/2,left.position[0]+left.thickness/2);
    close(base.position[0]+base.width/2,right.position[0]-right.thickness/2);
    assert.equal(base.polygons[0].length,1,"Base stays solid");
    for(const id of ["top","rear","baffle","grille","pcb-floor","pcb-rear"])assert.deepEqual(s.parts.find(p=>p.id===id),off.parts.find(p=>p.id===id));
    assert.deepEqual(createSpeaker({...s.config,flatFeet:false}),off,"Turning feet off restores the original cuts");
  }
  assert.equal(outlines.size,3,"Every case foot style has a distinct profile");
});

test("feet settings and cutting dimensions export, while old designs default to no feet",()=>{
  for(const flatFootStyle of ["pads","arch","runners"]) {
    const s=createSpeaker({...defaults,flatFeet:true,flatFootStyle,flatFootHeight:24});
    const data=speakerExport(s),restored=parseProject(JSON.stringify(data)).designs.speaker;
    assert.deepEqual(restored,s.config);
    assert.equal(data.feet.contactCount,flatFootStyle==="runners"?2:4);
    assert.equal(data.feet.additionalParts,0);assert.equal(data.dimensions.totalHeight,defaults.height+24);
    assert.match(speakerSvg(s),/10 sheets/);
    const legacy=structuredClone(data);
    for(const key of ["flatFeet","flatFootStyle","flatFootHeight"])delete legacy.configuration[key];
    assert.equal(parseProject(JSON.stringify(legacy)).designs.speaker.flatFeet,false);
    for(const patch of [{flatFeet:"yes"},{flatFootStyle:"unknown"},{flatFootHeight:null}]) {
      const bad=structuredClone(data);Object.assign(bad.configuration,patch);
      assert.throws(()=>parseProject(JSON.stringify(bad)));
    }
  }
});
