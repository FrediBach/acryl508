import assert from "node:assert/strict";
import test from "node:test";
import polygonClipping from "polygon-clipping";
import { JSDOM } from "jsdom";
import { loadTypescript } from "./load-typescript.mjs";
const { createSpeaker, defaultSpeakerConfiguration: defaults, myndDrivers, normalizeSpeakerConfiguration, speakerExport, speakerSvg } = await loadTypescript("../lib/speaker.ts");
const { parseProject, makeProject, initialDesigns } = await loadTypescript("../lib/project.ts");
const { speakerFabrication, packSheets, stockSvg } = await loadTypescript("../lib/fabrication.ts");
const area = ring => Math.abs(ring.reduce((sum,p,i) => { const q=ring[(i+1)%ring.length];return sum+p[0]*q[1]-q[0]*p[1]; },0)/2);

test("MYND baffle keeps source driver centres, two radiators and mounting holes", () => {
  const speaker=createSpeaker(defaults), baffle=speaker.parts[0];
  assert.equal(speaker.parts.length,9);
  assert.equal(myndDrivers.filter(d=>d.kind === "radiator").length,2);
  assert.deepEqual(myndDrivers.map(d=>[d.x,d.y]),[[0,-24],[-93,53.3],[93,53.3],[-82,-18],[82,-18]]);
  assert.equal(speaker.driverMounts.length,20);
  assert.equal(baffle.polygons[0].length,1+5+20+4);
  assert.deepEqual(createSpeaker({...defaults,width:400,height:260}).parts[0].polygons[0].slice(1,6),baffle.polygons[0].slice(1,6));
  // Resolve rings independently: overlapping holes or cuts outside a panel
  // would change the count or area and invalidate the direct polygon geometry.
  for(const part of speaker.parts.filter(p=>p.id !== "grille")) {
    const [outer,...holes]=part.polygons[0];
    const resolved=polygonClipping.difference([[outer]],...holes.map(ring=>[[ring]]));
    assert.equal(resolved.length,1,`${part.id} remains one sheet`);
    assert.equal(resolved[0].length,holes.length+1,`${part.id} has separate, enclosed holes`);
    const expected=area(outer)-holes.reduce((sum,ring)=>sum+area(ring),0);
    const actual=area(resolved[0][0])-resolved[0].slice(1).reduce((sum,ring)=>sum+area(ring),0);
    assert.ok(Math.abs(expected-actual)<0.001);
  }
});

test("dot pattern retains borders, fasteners and a minimum two millimetre web", () => {
  for(const staggered of [false,true]) for(const dotDiameter of [2,6]) {
    const s=createSpeaker({...defaults,staggered,dotDiameter,dotPitch:4});
    assert.ok(s.config.dotPitch-s.config.dotDiameter>=2);
    assert.ok(s.dots.length>500);
    for(const [x,y] of s.dots) {
      assert.ok(Math.abs(x)+dotDiameter/2<=s.config.width/2-s.config.grilleBorder+1e-8);
      assert.ok(Math.abs(y)+dotDiameter/2<=s.config.height/2-s.config.grilleBorder+1e-8);
      assert.ok(s.mounts.every(([mx,my])=>Math.hypot(x-mx,y-my)>dotDiameter/2+5));
    }
    assert.equal(s.parts.find(p=>p.id === "grille").polygons[0].length,1+s.dots.length+4);
    assert.ok(s.openArea>0 && s.openArea<100);
    assert.ok(s.parts.find(p=>p.id === "grille").position[2]-defaults.thickness/2 === defaults.depth/2+defaults.grilleGap);
  }
});

test("mixed sheet thicknesses meet at butt joints without changing the body envelope", () => {
  const s=createSpeaker({...defaults,individualSheetMaterials:true,sheetThicknesses:{left:3,right:8,top:7,bottom:4,baffle:6,rear:3,grille:3}});
  const p=Object.fromEntries(s.parts.map(p=>[p.id,p]));
  assert.equal(p.top.height,defaults.depth-9);
  assert.equal(p.left.height,defaults.height-11);
  assert.equal(p.left.width,p.top.height);
  assert.equal(p.top.position[1]-p.top.thickness/2,p.left.position[1]+p.left.height/2);
  assert.equal(p.bottom.position[1]+p.bottom.thickness/2,p.left.position[1]-p.left.height/2);
  assert.equal(p.baffle.position[2]-p.baffle.thickness/2,p.top.position[2]+p.top.height/2);
  assert.equal(p.rear.position[2]+p.rear.thickness/2,p.top.position[2]-p.top.height/2);
  assert.equal(s.grossVolumeLitres,(280-11)*(210-11)*(120-9)/1e6);
  assert.equal(s.totalDepth,135);
});

test("speaker JSON round trips, older projects acquire defaults and malformed imports fail", () => {
  const s=createSpeaker({...defaults,width:310,dotDiameter:4,individualSheetMaterials:true,sheetThicknesses:{grille:3}});
  const single=parseProject(JSON.stringify(speakerExport(s)));
  assert.equal(single.mode,"speaker"); assert.deepEqual(single.designs.speaker,s.config);
  assert.equal(single.designs.case,initialDesigns.case);
  const project=makeProject("MYND","speaker",{...initialDesigns,speaker:s.config},[]);
  assert.deepEqual(parseProject(JSON.stringify(project)).designs.speaker,s.config);
  const old=structuredClone(project);delete old.designs.speaker;old.mode="case";
  assert.deepEqual(parseProject(JSON.stringify(old)).designs.speaker,defaults);
  for(const patch of [{staggered:"yes"},{width:null},{sheetThicknesses:{unknown:5}},{sheetThicknesses:{grille:100}},{tint:{color:"javascript:bad"}}]) {
    const bad=structuredClone(project);Object.assign(bad.designs.speaker,patch);
    assert.throws(()=>parseProject(JSON.stringify(bad)));
  }
  assert.equal(normalizeSpeakerConfiguration({...defaults,width:NaN}).width,defaults.width);
});

test("SVG and fabrication preserve all sheets, apertures, units and source attribution", () => {
  const s=createSpeaker(defaults),svg=speakerSvg(s);
  const dom=new JSDOM(svg,{contentType:"image/svg+xml"});
  assert.match(dom.window.document.documentElement.getAttribute("width"),/mm$/);
  assert.equal(dom.window.document.querySelectorAll('path[data-operation="cut"]').length,9);
  assert.match(svg,/CC-BY-SA-4.0/);assert.match(svg,/unvalidated|Prototype/);
  const f=speakerFabrication(s),stock=packSheets(f.parts,1000,600,10,true);
  assert.deepEqual(stock.unplaced,[]);
  assert.equal(stock.sheets.flatMap(s=>s.parts).length,9);
  assert.ok(f.warnings.some(w=>w.includes("not included")));
  assert.match(stockSvg(stock.sheets[0],1000,600,f.warnings),/CC-BY-SA-4.0/);
  assert.equal(f.parts.find(p=>p.id === "grille").polygons[0].length,1+s.dots.length+4);
  dom.window.close();
});
