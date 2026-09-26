import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { loadTypescript } from "./load-typescript.mjs";
import { Box3, Euler, Quaternion, Vector3 } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import polygonClipping from "polygon-clipping";
const { myndBoardMounts } = await loadTypescript("../lib/mynd-mounts.ts");
const { createSpeaker, defaultSpeakerConfiguration } = await loadTypescript("../lib/speaker.ts");
const { speakerFasteners, speakerBoardPlacements, speakerPortPlacement, speakerControlPlacement } = await loadTypescript("../lib/speaker-hardware.ts");
const { myndButtons, myndControls } = await loadTypescript("../lib/mynd-controls.ts");
const { myndPort, myndPortOpening, myndPortMounts } = await loadTypescript("../lib/mynd-port.ts");
const manifest = JSON.parse(readFileSync(new URL("../public/models/mynd/manifest.json", import.meta.url)));
const close = (a,b) => assert.ok(Math.abs(a-b)<1e-8, `${a} ≈ ${b}`);

test("individual control cutouts align with the donor pad and leave its backing below the acrylic", async () => {
  const bytes=readFileSync(new URL("../public/models/mynd/hmi-pad.glb",import.meta.url));
  const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),"");
  gltf.scene.updateMatrixWorld(true);
  const exposed=[];
  gltf.scene.traverse(node=>{
    if(!node.isMesh)return;
    const points=node.geometry.attributes.position;
    for(let i=0;i<points.count;i++) {
      const point=new Vector3().fromBufferAttribute(points,i).applyMatrix4(node.matrixWorld);
      if(point.z>myndControls.sheetSourceZ)exposed.push(point);
    }
  });
  assert.ok(exposed.length>100,"Test actual protruding button meshes");
  const contains=(ring,x,y)=>{
    let inside=false;
    for(let i=0,j=ring.length-1;i<ring.length;j=i++) {
      const [ax,ay]=ring[i],[bx,by]=ring[j];
      if((ay>y)!==(by>y)&&x<(bx-ax)*(y-ay)/(by-ay)+ax)inside=!inside;
    }
    return inside;
  };
  for(const topThickness of [3,5,8]) {
    const s=createSpeaker({...defaultSpeakerConfiguration,controlWidth:160,controlDepth:35,
      individualSheetMaterials:true,sheetThicknesses:{top:topThickness,baffle:8,rear:3}});
    const top=s.parts.find(p=>p.id==="top"),cuts=top.polygons[0].slice(1,5);
    assert.equal(top.polygons[0].length,13,"Four separate control cutouts plus eight mounting holes");
    assert.equal(s.config.controlWidth,116);assert.equal(s.config.controlDepth,18);
    const inverse=new Quaternion().setFromEuler(new Euler(...top.rotation)).invert();
    const sourcePosition=new Vector3(...speakerControlPlacement(s.config));
    const toSheet=point=>point.clone().applyEuler(new Euler(-Math.PI/2,0,0)).add(sourcePosition).sub(new Vector3(...top.position)).applyQuaternion(inverse);
    for(const point of exposed) {
      const local=toSheet(point);
      assert.ok(cuts.some(r=>contains(r,local.x,local.y)),"Every rubber vertex above the seating face clears a button cutout");
    }
    myndButtons.forEach((button,i)=>{
      const centre=toSheet(new Vector3(button.x,myndControls.buttonSourceY,myndControls.sheetSourceZ));
      assert.ok(contains(cuts[i],centre.x,centre.y));
      const width=Math.max(...cuts[i].map(p=>p[0]))-Math.min(...cuts[i].map(p=>p[0]));
      close(width,button.width);
    });
    const support=speakerFasteners(s).find(f=>f.id==="hmi-0-support");
    close(support.length,7.1);
    close(support.position[1]-support.length/2,sourcePosition.y+myndControls.coverUpperZ);
    close(speakerBoardPlacements(s).find(b=>b.id==="UI").position[1],sourcePosition.y+myndControls.pcbCentreZ);
  }
});

test("every corner spacer fills the physical gap between the two washers", () => {
  for (const grilleGap of [8,12,25]) for (const depth of [110,220]) for (const thickness of [3,8]) {
    const s=createSpeaker({...defaultSpeakerConfiguration,grilleGap,depth,thickness});
    const f=speakerFasteners(s);
    assert.equal(f.filter(p=>p.kind === "spacer" && p.id.startsWith("corner-")).length,4);
    assert.equal(f.filter(p=>p.kind === "screw").length,63);
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

test("source mounts, sheet cuts and screw axes coincide across sizes and mixed thicknesses", () => {
  for (const [id,mounts] of Object.entries(myndBoardMounts)) assert.deepEqual(mounts,manifest.assets[id].mounts);
  for (const depth of [110,220]) for (const height of [210,300]) for (const thickness of [3,8]) {
    const s=createSpeaker({...defaultSpeakerConfiguration,depth,height,thickness,controlDepth:35,
      individualSheetMaterials:true,sheetThicknesses:{baffle:3,rear:8,top:8,bottom:3}});
    const fasteners=speakerFasteners(s);
    assert.deepEqual(Object.fromEntries(["top","bottom","rear","baffle","left","pcb-floor","pcb-rear"].map(id=>[id,s.panelMounts.filter(m=>m.parent===id).length])),{top:8,bottom:0,rear:0,baffle:0,left:4,"pcb-floor":10,"pcb-rear":9});
    for (const mount of s.panelMounts) {
      const panel=s.parts.find(p=>p.id===mount.parent);
      const inverse=new Quaternion().setFromEuler(new Euler(...panel.rotation)).invert();
      const screw=fasteners.find(f=>f.id===`${mount.id}-sheet-screw`);
      const local=new Vector3(...screw.position).sub(new Vector3(...panel.position)).applyQuaternion(inverse);
      close(local.x,mount.position[0]);close(local.y,mount.position[1]);
      close(Math.abs(local.z),panel.thickness/2+0.5);
      const axis=new Vector3(0,0,1).applyEuler(new Euler(...screw.rotation));
      assert.ok(new Vector3(...screw.position).sub(new Vector3(...panel.position)).dot(axis)>0,"Screw head faces outside");
      const ring=panel.polygons[0].find(r=>Math.abs(Math.min(...r.map(p=>p[0]))-(mount.position[0]-mount.diameter/2))<1e-7 && Math.abs(Math.min(...r.map(p=>p[1]))-(mount.position[1]-mount.diameter/2))<1e-7);
      assert.ok(ring,`${mount.id} is an actual cut`);
    }
    for(const board of speakerBoardPlacements(s).filter(b=>b.standoff)) {
      const panel=s.parts.find(p=>p.id===board.parent);
      const inverse=new Quaternion().setFromEuler(new Euler(...panel.rotation)).invert();
      myndBoardMounts[board.id].forEach(([x,y],i)=>{
        const foot=new Vector3(x,y,-0.8-board.standoff).applyEuler(new Euler(...board.rotation)).add(new Vector3(...board.position)).sub(new Vector3(...panel.position)).applyQuaternion(inverse);
        const mount=s.panelMounts.find(m=>m.id===`pcb-${board.id}-${i}`);
        close(foot.x,mount.position[0]);close(foot.y,mount.position[1]);close(Math.abs(foot.z),panel.thickness/2);
      });
    }
    for (const panel of s.parts.filter(p=>p.id!=="grille")) {
      const [outer,...holes]=panel.polygons[0];
      const cut=polygonClipping.difference([[outer]],...holes.map(r=>[[r]]));
      assert.equal(cut.length,1);assert.equal(cut[0].length,holes.length+1,`${panel.id}: all holes are enclosed and separate`);
    }
    for (const mount of s.panelMounts.filter(m=>m.parent==="top")) {
      const get=suffix=>fasteners.find(f=>f.id===`${mount.id}-${suffix}`);
      const support=get("support"),outer=get("sheet-screw"),inner=get("cover-screw");
      close(support.position[1]+support.length/2,height/2-8);
      close(support.position[1]-support.length/2,height/2-8-7.1);
      assert.ok(outer.position[1]-outer.length>inner.position[1]+inner.length,"Opposing top screw tips stay apart");
    }
  }
});

test("port sheet uses the source access wire and all four housing axes, including legacy projects", () => {
  assert.deepEqual(myndPortMounts.map(m=>[m.y,m.z]),[[31.36,51.28],[80.86,51.28],[54.36,37.03],[54.36,66.03]]);
  assert.ok(myndPortOpening.length>50,"Curved and notched source wire is retained");
  close(myndPort.width,40.99132);close(myndPort.openingHeight,20.08888);
  for(const width of [280,420]) for(const height of [210,300]) for(const thickness of [3,8]) {
    const s=createSpeaker({...defaultSpeakerConfiguration,width,height,portWidth:65,portHeight:45,
      individualSheetMaterials:true,sheetThicknesses:{left:thickness,baffle:8,rear:3,top:3,bottom:8}});
    const panel=s.parts.find(p=>p.id==="left"),fasteners=speakerFasteners(s);
    assert.equal(panel.polygons[0].length,10,"Access wire, four screw holes and four carrier slots");
    assert.equal(s.config.portWidth,myndPort.width);assert.equal(s.config.portHeight,myndPort.openingHeight);
    const sourceToWorld=p=>new Vector3(...p).applyEuler(new Euler(-Math.PI/2,0,0)).add(new Vector3(...speakerPortPlacement(s.config)));
    const toWorld=p=>new Vector3(...p,0).applyEuler(new Euler(...panel.rotation)).add(new Vector3(...panel.position));
    for(const [i,point] of [...panel.polygons[0][1]].reverse().entries()) {
      const actual=toWorld(point),[u,v]=myndPortOpening[i];
      const expected=sourceToWorld([myndPort.sourceFace,u+myndPort.depthOrigin,v+myndPort.height]);
      close(actual.y,expected.y);close(actual.z,expected.z);
      close(expected.x-actual.x,thickness/2,"Housing flange meets inner sheet");
    }
    myndPortMounts.forEach((mount,i)=>{
      const axis=sourceToWorld([myndPort.sourceFace,mount.y,mount.z]);
      const screw=fasteners.find(f=>f.id===`port-${i}-sheet-screw`),nut=fasteners.find(f=>f.id===`port-${i}-housing-nut`);
      close(screw.position[1],axis.y);close(screw.position[2],axis.z);
      close(screw.position[0],-width/2-0.5);close(screw.shaftRadius,mount.shaftRadius);
      close(nut.position[0],axis.x+mount.clampDepth+1.7);
      assert.ok(screw.position[0]+screw.length>nut.position[0]+nut.length/2,"Screw engages backing nut");
      if(mount.seatDepth) {
        const sleeve=fasteners.find(f=>f.id===`port-${i}-support`);
        close(sleeve.position[0]-sleeve.length/2,axis.x);
        close(sleeve.position[0]+sleeve.length/2,axis.x+7);
      }
    });
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
    if(asset.kind === "source-pcb") {
      const mask=json.materials.find(material=>material.name === "pcb");
      assert.deepEqual(mask.pbrMetallicRoughness.baseColorFactor,[181/255,35/255,43/255,1],"Donor PCBs have red solder mask");
    }
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

test("PCB faces and pads keep planar normals separate from their edge walls", async () => {
  for (const asset of Object.values(manifest.assets).filter(a => a.kind === "source-pcb")) {
    const bytes = readFileSync(new URL(`../public/models/mynd/${asset.file}`, import.meta.url));
    const { scene } = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "");
    let caps = 0, walls = 0;
    scene.traverse(node => {
      if (!node.isMesh || !["pcb", "pads"].includes(node.material.name)) return;
      const { position, normal } = node.geometry.attributes, indices = node.geometry.index;
      for (let i = 0; i < indices.count; i += 3) {
        const ids = [0, 1, 2].map(corner => indices.getX(i + corner));
        const [a, b, c] = ids.map(id => new Vector3().fromBufferAttribute(position, id));
        const face = b.sub(a).cross(c.sub(a));
        if (face.lengthSq() < 1e-16) continue;
        face.normalize();
        const cap = Math.abs(face.z) > 0.99999;
        if (cap) caps++; else walls++;
        for (const id of ids) {
          const n = new Vector3().fromBufferAttribute(normal, id);
          assert.ok(Math.abs(n.length() - 1) < 1e-5, `${asset.file}: unit normal`);
          if (cap) assert.ok(n.distanceTo(face) < 1e-5, `${asset.file}: flat ${node.material.name} face must not inherit edge lighting`);
          else assert.ok(Math.abs(n.z) < 1e-5, `${asset.file}: edge normals must stay in the board plane`);
        }
      }
    });
    assert.ok(caps > 0 && walls > 0, `${asset.file}: checks both faces and walls`);
  }
});

test("the bridge header enters the amplifier socket and its upper contact meets the baffle board", async () => {
  const scenes={};
  for(const id of ["Amp","Conn_Amp","Conn_Baffle"]) {
    const bytes=readFileSync(new URL(`../public/models/mynd/${manifest.assets[id].file}`,import.meta.url));
    scenes[id]=(await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),"")).scene;
  }
  const bounds=(id,placement,name,filter=()=>true)=>{
    const points=[];
    scenes[id].updateMatrixWorld(true);
    scenes[id].traverse(node=>{
      if(!node.isMesh || node.name!==name)return;
      const positions=node.geometry.attributes.position;
      for(let i=0;i<positions.count;i++) {
        const v=new Vector3().fromBufferAttribute(positions,i).applyMatrix4(node.matrixWorld);
        if(filter(v))points.push(v.applyEuler(new Euler(...placement.rotation)).add(new Vector3(...placement.position)));
      }
    });
    assert.ok(points.length>0);
    return new Box3().setFromPoints(points);
  };
  for(const width of [280,420]) for(const depth of [110,220]) for(const height of [210,300]) for(const thickness of [3,8]) {
    const speaker=createSpeaker({...defaultSpeakerConfiguration,width,depth,height,thickness});
    const placements=Object.fromEntries(speakerBoardPlacements(speaker).map(b=>[b.id,b]));
    const amp=placements.Amp,bridge=placements.Conn_Amp,baffle=placements.Conn_Baffle;
    const socket=bounds("Amp",amp,"plastic",v=>v.x>-10);
    const pins=bounds("Conn_Amp",bridge,"body",v=>v.y<-28);
    assert.ok(socket.containsBox(pins),"Actual free header pins fit inside the actual amplifier socket envelope");
    assert.ok(pins.min.y>amp.position[1]+0.8,"Pin tips do not penetrate the amplifier substrate");
    const upperSocket=bounds("Conn_Amp",bridge,"body",v=>v.y>15);
    const contact=bounds("Conn_Baffle",baffle,"body");
    assert.ok(upperSocket.intersectsBox(contact),"The source spring contact and socket engage");
    const pcbBoxes=Object.entries({Amp:amp,Conn_Amp:bridge,Conn_Baffle:baffle}).map(([id,b])=>bounds(id,b,"pcb"));
    for(let i=0;i<pcbBoxes.length;i++)for(let j=i+1;j<pcbBoxes.length;j++)assert.equal(pcbBoxes[i].intersectsBox(pcbBoxes[j]),false,"Substrates never overlap");
    assert.equal(amp.parent,"pcb-floor");assert.equal(bridge.parent,amp.parent);assert.equal(bridge.standoff,0);
    const exploded=Object.fromEntries(speakerBoardPlacements(speaker,true).map(b=>[b.id,b]));
    for(let axis=0;axis<3;axis++)close(exploded.Conn_Amp.position[axis]-exploded.Amp.position[axis],bridge.position[axis]-amp.position[axis]);
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
    assert.equal(boards.find(p=>p.id === "Amp").position[2],-depth/2+5+5+5+32);
  }
});
