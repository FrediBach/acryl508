import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { loadTypescript } from "./load-typescript.mjs";
const { createSpeaker, defaultSpeakerConfiguration } = await loadTypescript("../lib/speaker.ts");
const { speakerFasteners, speakerBoardPlacements } = await loadTypescript("../lib/speaker-hardware.ts");
const manifest = JSON.parse(readFileSync(new URL("../public/models/mynd/manifest.json", import.meta.url)));
const close = (a,b) => assert.ok(Math.abs(a-b)<1e-8, `${a} ≈ ${b}`);

test("every corner spacer fills the physical gap between the two washers", () => {
  for (const grilleGap of [8,12,25]) for (const depth of [110,220]) for (const thickness of [3,8]) {
    const s=createSpeaker({...defaultSpeakerConfiguration,grilleGap,depth,thickness});
    const f=speakerFasteners(s);
    assert.equal(f.filter(p=>p.kind === "spacer").length,4);
    assert.equal(f.filter(p=>p.kind === "screw").length,24);
    for(let i=1;i<=4;i++) {
      const get=suffix=>f.find(p=>p.id === `corner-${i}-${suffix}`);
      const spacer=get("spacer"), back=get("baffle-washer"), front=get("grille-inner-washer");
      close(spacer.position[2]-spacer.length/2, back.position[2]+back.length/2);
      close(spacer.position[2]+spacer.length/2, front.position[2]-front.length/2);
      assert.deepEqual(spacer.position.slice(0,2),s.mounts[i-1]);
      const screw=get("grille-screw"), rod=get("tie");
      close(screw.position[2],depth/2+grilleGap+thickness+0.5);
      assert.ok(screw.position[2]-screw.length > rod.position[2]+rod.length/2, "Opposing threads do not overlap in the spacer");
      assert.ok(rod.position[2]-rod.length/2 < -depth/2-3, "Rod engages the rear nut");
    }
  }
});

test("mixed thickness fasteners register to cut holes and follow their panels during explosion", () => {
  const s=createSpeaker({...defaultSpeakerConfiguration,individualSheetMaterials:true,sheetThicknesses:{baffle:8,rear:3,grille:4}});
  const a=speakerFasteners(s), b=speakerFasteners(s,true);
  a.forEach((item,i)=>{
    const panel=s.parts.find(p=>p.id === item.parent);
    assert.equal(b[i].length,item.length,"Exploded view never stretches hardware");
    for(let axis=0;axis<3;axis++)close(b[i].position[axis]-item.position[axis],panel.explode[axis]);
  });
  const driverScrews=a.filter(p=>p.id.startsWith("driver-") && p.kind === "screw");
  assert.deepEqual(driverScrews.map(p=>p.position.slice(0,2)),s.driverMounts);
  assert.ok(driverScrews.every(p=>p.length === 13));
  assert.equal(a.find(p=>p.id === "corner-1-grille-screw").length,7.5);
});

test("source PCB assemblies have all referenced component models and real board outlines", () => {
  const pcb=Object.values(manifest.assets).filter(a=>a.kind === "source-pcb");
  assert.equal(pcb.length,9);
  assert.equal(pcb.reduce((sum,a)=>sum+a.components,0),788);
  for(const a of pcb) {
    assert.deepEqual(a.missingModels,[]);
    assert.ok(a.modelFiles.every(path=>manifest.sourceSha256[path]));
    assert.ok(a.thickness>1 && a.thickness<2);
    assert.ok(a.bounds[1][2]-a.bounds[0][2]>2, "Loaded assembly has components above or below the substrate");
  }
  assert.deepEqual(manifest.assets.Main.outlineSize.map(Math.round),[75,136]);
  assert.equal(manifest.assets.Main.mounts.length,6);
  assert.equal(manifest.assets.Amp.mounts.length,4);
});

test("all shipped GLBs are complete, finite, locally referenced and have valid indices", () => {
  for(const asset of Object.values(manifest.assets)) {
    const bytes=readFileSync(new URL(`../public/models/mynd/${asset.file}`,import.meta.url));
    assert.equal(bytes.subarray(0,4).toString(),"glTF");assert.equal(bytes.readUInt32LE(4),2);
    assert.equal(bytes.readUInt32LE(8),bytes.length);assert.equal(bytes.length,asset.bytes);
    const jsonLength=bytes.readUInt32LE(12), json=JSON.parse(bytes.subarray(20,20+jsonLength).toString());
    assert.ok(json.meshes.length>0);
    assert.ok(json.buffers.every(b=>!b.uri), "Assets are self-contained, with no runtime upstream fetch");
    for(const accessor of json.accessors) {
      assert.ok(accessor.count>0);
      if(accessor.min)assert.ok(accessor.min.every(Number.isFinite));
      if(accessor.max)assert.ok(accessor.max.every(Number.isFinite));
    }
    for(const mesh of json.meshes) for(const p of mesh.primitives) {
      const position=json.accessors[p.attributes.POSITION],indices=json.accessors[p.indices];
      assert.ok(p.attributes.NORMAL !== undefined, "Source models include lighting normals");
      assert.equal(json.accessors[p.attributes.NORMAL].count,position.count);
      assert.equal(indices.count%3,0);assert.ok(indices.max[0]<position.count);
    }
  }
});

test("all nine boards move with their mounting sheet, with fixed model scale", () => {
  const s=createSpeaker(defaultSpeakerConfiguration),a=speakerBoardPlacements(s),b=speakerBoardPlacements(s,true);
  assert.equal(a.length,9);
  for(const [i,board] of a.entries()) {
    assert.ok(manifest.assets[board.id]);assert.equal(manifest.assets[board.id].file,`${board.asset}.glb`);
    const parent=s.parts.find(p=>p.id === board.parent);
    board.position.forEach((p,axis)=>close(b[i].position[axis]-p,parent.explode[axis]));
    assert.deepEqual(board.rotation,b[i].rotation);
  }
  for(const depth of [110,220]) {
    const boards=speakerBoardPlacements(createSpeaker({...defaultSpeakerConfiguration,depth}));
    assert.equal(boards.find(p=>p.id === "Amp").position[2],-depth/2+5+8.8);
  }
});
