import assert from "node:assert/strict";
import test from "node:test";
import { Euler, Vector3 } from "three";
import { JSDOM } from "jsdom";
import { loadTypescript } from "./load-typescript.mjs";

const { createSpeaker, defaultSpeakerConfiguration: defaults, speakerExport, speakerSvg } = await loadTypescript("../lib/speaker.ts");
const { speakerFasteners, speakerBoardPlacements } = await loadTypescript("../lib/speaker-hardware.ts");
const { geometryArea, placedCutout } = await loadTypescript("../lib/custom-cutouts.ts");
const { speakerFabrication } = await loadTypescript("../lib/fabrication.ts");
const { readSpeaker, parseProject, makeProject, initialDesigns } = await loadTypescript("../lib/project.ts");
const close = (a,b) => assert.ok(Math.abs(a-b)<1e-7, `${a} ≈ ${b}`);
const cutout = (patch = {}) => ({ id: "logo", name: "Logo", side: "rear", source: { kind: "svg", fileName: "logo.svg" },
  polygons: [[[[-0.5,-0.5],[0.5,-0.5],[0.5,0.5],[-0.5,0.5],[-0.5,-0.5]]]], width: 30, x: 35, y: 20, rotation: 0, ...patch });

test("rear cover matches the front standoff, with washers, threads and explosion aligned", () => {
  for (const grilleGap of [8,12,25]) for (const damping of [false,true]) for (const thickness of [3,8]) {
    const s = createSpeaker({ ...defaults, grilleGap, damping, dampingThickness: 2, thickness,
      individualSheetMaterials: true, sheetThicknesses: { baffle: 3, rear: 8, grille: 3, "rear-cover": 8 } });
    const p = Object.fromEntries(s.parts.map(part => [part.id,part]));
    const rear = p.rear.position[2]-p.rear.thickness/2;
    const coverInner = p["rear-cover"].position[2]+p["rear-cover"].thickness/2;
    close(rear-coverInner,grilleGap);
    close(p.grille.position[2]-p.grille.thickness/2-p.baffle.position[2]-p.baffle.thickness/2,grilleGap);
    close(s.rearZ,coverInner-8); close(s.totalDepth,s.frontZ-s.rearZ);
    const f = speakerFasteners(s), exploded = speakerFasteners(s,true);
    for (let i=1;i<=4;i++) {
      const get = suffix => f.find(item => item.id === `corner-${i}-${suffix}`);
      const spacer=get("rear-spacer"), inner=get("rear-cover-inner-washer"), body=get("rear-washer"), outer=get("rear-cover-outer-washer"), screw=get("rear-cover-screw"), rod=get("tie");
      close(spacer.position[2]-spacer.length/2,inner.position[2]+inner.length/2);
      close(spacer.position[2]+spacer.length/2,body.position[2]-body.length/2);
      close(outer.position[2]+outer.length/2,s.rearZ);
      close(screw.position[2],s.rearZ-0.5); assert.equal(screw.direction,-1);
      assert.ok(screw.position[2]+screw.length < rod.position[2]-rod.length/2,"Opposing screw and tie-rod tips remain separate");
      for (const item of [spacer,inner,body,outer,screw]) {
        const moved=exploded.find(f=>f.id===item.id);
        close(moved.position[2]-item.position[2],p[item.parent].explode[2]); close(moved.length,item.length);
      }
    }
    const uniform=createSpeaker({...defaults,grilleGap,damping,thickness});
    close(uniform.frontZ,-uniform.rearZ);
  }
});

test("rear artwork faces outside and affects only the external sheet, including cutting exports", () => {
  const artwork = cutout({ rotation: 27 });
  const s=createSpeaker({...defaults,cutouts:[artwork]}), original=createSpeaker(defaults);
  const rear=s.parts.find(p=>p.id==="rear-cover"), blank=original.parts.find(p=>p.id==="rear-cover");
  close(geometryArea(blank.polygons)-geometryArea(rear.polygons),900);
  for (const part of s.parts.filter(p=>p.id!=="rear-cover")) assert.deepEqual(part,original.parts.find(p=>p.id===part.id));
  assert.deepEqual(speakerBoardPlacements(s),speakerBoardPlacements(original));
  close(s.grossVolumeLitres,original.grossVolumeLitres);
  const world=new Vector3(artwork.x,artwork.y,0).applyEuler(new Euler(...rear.rotation)).add(new Vector3(...rear.position));
  close(world.x,-artwork.x); close(world.y,artwork.y);
  assert.ok(new Vector3(0,0,1).applyEuler(new Euler(...rear.rotation)).z<0,"Artwork normal faces the rear observer");
  const cutBounds=placedCutout(artwork).flat(2);
  assert.ok(cutBounds.every(([x])=>x>0));
  const f=speakerFabrication(s).parts.find(p=>p.id==="rear-cover");
  assert.deepEqual(f.polygons,rear.polygons.map(p=>p.map(r=>r.map(([x,y])=>[x,-y]))));
  const dom=new JSDOM(speakerSvg(s),{contentType:"image/svg+xml"});
  assert.equal(dom.window.document.querySelectorAll('#rear-cover path[data-operation="cut"]').length,1);
  assert.equal(dom.window.document.querySelectorAll('path[data-operation="cut"]').length,10);
  dom.window.close();
});

test("rear cuts report clipping, outside artwork and loose islands, and block an empty panel", () => {
  const ring=cutout({polygons:[[
    [[-0.5,-0.5],[0.5,-0.5],[0.5,0.5],[-0.5,0.5],[-0.5,-0.5]],
    [[-0.25,-0.25],[-0.25,0.25],[0.25,0.25],[0.25,-0.25],[-0.25,-0.25]],
  ]]});
  const s=createSpeaker({...defaults,cutouts:[ring]});
  assert.equal(s.cutoutPanels.reports[0].removedParts,1);
  close(s.cutoutPanels.reports[0].removedArea,225);
  assert.equal(s.canExport,true);
  const outside=createSpeaker({...defaults,cutouts:[cutout({x:500})]});
  assert.deepEqual(outside.cutoutPanels.reports[0].outside,["logo"]);
  const clipped=createSpeaker({...defaults,cutouts:[cutout({x:140,y:0})]});
  assert.deepEqual(clipped.cutoutPanels.reports[0].clipped,["logo"]);
  const empty=createSpeaker({...defaults,cutouts:[cutout({width:1000,x:0,y:0})]});
  assert.equal(empty.canExport,false); assert.equal(speakerFabrication(empty).blocked,true);
  assert.equal(empty.cutoutPanels.reports[0].empty,true);
  assert.throws(()=>speakerSvg(empty),/cutout warnings/);
});

test("rear artwork and material round trip, legacy designs default to no cuts, and malformed cuts fail", () => {
  const s=createSpeaker({...defaults,cutouts:[cutout()],individualSheetMaterials:true,sheetThicknesses:{"rear-cover":3}});
  assert.deepEqual(parseProject(JSON.stringify(speakerExport(s))).designs.speaker,s.config);
  const project=makeProject("Rear artwork","speaker",{...initialDesigns,speaker:s.config},[]);
  assert.deepEqual(parseProject(JSON.stringify(project)).designs.speaker,s.config);
  const legacy={...s.config}; delete legacy.cutouts;
  assert.deepEqual(readSpeaker(legacy).cutouts,[]);
  for (const cuts of [null,[cutout({side:"front"})],[cutout({width:NaN})],[cutout({polygons:[]})],Array(21).fill(cutout())]) {
    assert.throws(()=>readSpeaker({...defaults,cutouts:cuts}));
  }
});
