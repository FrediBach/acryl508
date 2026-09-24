import assert from "node:assert/strict";
import test from "node:test";
import polygonClipping from "polygon-clipping";
import { BoxGeometry, SphereGeometry } from "three";
import { loadTypescript } from "./load-typescript.mjs";
const { createSynthProtector, defaultProtectorConfiguration, protectorSvg, protectorExport, protectorSheetLayout } = await loadTypescript("../lib/synth-protector.ts");
const { positionStandObject, objectContactCut } = await loadTypescript("../lib/stand-object.ts");
const near = (a,b,tolerance = 1e-6) => assert.ok(Math.abs(a-b) < tolerance, `${a} ≈ ${b}`);
function box(width=550, depth=280, height=70, offset=[0,0,0]) {
  const geometry = new BoxGeometry(width,height,depth).toNonIndexed();
  const vertices = Array.from(geometry.attributes.position.array).map((v,i) => v+offset[i%3]);
  geometry.dispose(); return vertices;
}
const model = (vertices=box(), patch={}) => ({ name:"synth.obj", vertices, units:"mm", up:"y", turn:0, ...patch });
const fit = (object=model(), patch={}) => createSynthProtector({...defaultProtectorConfiguration,object,...patch});
const rect = (l,b,r,t) => [[[[l,b],[r,b],[r,t],[l,t],[l,b]]]];
const area = polygons => polygons.reduce((sum,poly) => sum+poly.reduce((s,ring,i) => s+(i?-1:1)*Math.abs(ring.slice(1).reduce((a,p,j)=>a+ring[j][0]*p[1]-p[0]*ring[j][1],0)/2),0),0);
function checkAssembly(protector) {
  const {config}=protector;
  const posed=positionStandObject(config.object,config.angle,0);
  near(protector.coverUnderside,posed.top+config.headroom);
  near(protector.dimensions.width,posed.dimensions.width+2*config.overhang);
  near(protector.dimensions.depth,posed.depth+2*config.overhang);
  const reflected=posed.points.map(([x,y,z])=>[x,posed.top-y,z-posed.depth/2]);
  for (const part of protector.parts) {
    assert.equal(part.polygons.length,1,part.id);
    assert.ok(part.polygons.flat(2).every(p=>p.every(Number.isFinite)));
    if(part.kind!=="foot") continue;
    const cut=objectContactCut(reflected,{width:part.center[0],depth:part.center[1],yaw:part.rotationY},config.thickness,posed.top+13).cut;
    const occupied=cut.map(poly=>poly.map(ring=>ring.map(([x,y])=>[x,-y]).reverse()));
    near(area(polygonClipping.intersection(part.polygons,occupied)),0);
    const contact=protector.objectFit.feet.find(c=>c.partId===part.id);
    assert.ok(contact.collarWidth>=2*config.thickness-1e-6);
    assert.ok(part.minY>=-posed.top-1e-6,"Foot does not extend through the desk");
    const lip=polygonClipping.intersection(part.polygons,rect(contact.contactEnd+config.edgeGap,contact.collarBottom,part.minX+part.width,0));
    assert.ok(area(lip)>1,"Broad outside lip remains");
    const tab=polygonClipping.intersection(part.polygons,rect(-8,config.headroom,8,config.headroom+config.thickness));
    near(area(tab),16*config.thickness);
    if(config.lockingStrips) {
      assert.equal(part.polygons[0].length,2,"Closed retaining-strip hole");
      const hole=rect(-protector.retention.holeWidth/2,protector.retention.holeBottom,protector.retention.holeWidth/2,protector.retention.holeBottom+protector.retention.holeHeight);
      near(area(polygonClipping.intersection(part.polygons,hole)),0);
    }
  }
}
test("model protectors fit flat and tilted meshes with broad lips and aligned retaining strips",()=>{
  for(const angle of [0,15,25,45]) for(const allSides of [false,true]) for(const lockingStrips of [false,true]) for(const thickness of [5,10]) {
    checkAssembly(fit(model(),{angle,allSides,lockingStrips,thickness,sideExtraFeet:2,endExtraFeet:2,footInset:55}));
  }
});
test("cover clears modeled controls while feet follow their own body height",()=>{
  const protector=fit(model([...box(),...box(20,20,25,[0,47.5,0])]));
  checkAssembly(protector);
  near(protector.config.height,95);
  for(const contact of protector.objectFit.feet) near(contact.collarBottom,-37);
  const tilted=fit(model(),{angle:25});
  const left=tilted.parts.filter(p=>p.edge==="left");
  assert.ok(Math.abs(left[0].minY-left[1].minY)>50);
});
test("full sheet thickness clears a narrow raised feature off the foot center plane",()=>{
  const protector=fit(model([...box(),...box(20,1,10,[-270,40,108])]));
  checkAssembly(protector);
  const feet=protector.parts.filter(p=>p.edge==="left");
  assert.notDeepEqual(feet[0].polygons,feet[1].polygons);
});
test("curved models retain broad collars and export the fitted outlines",()=>{
  const geometry=new SphereGeometry(100,24,16).toNonIndexed();
  const object=model(Array.from(geometry.attributes.position.array)); geometry.dispose();
  const protector=fit(object,{footInset:45});
  checkAssembly(protector);
  assert.deepEqual(protectorExport(protector).parts,protector.parts);
  assert.equal(protectorExport(protector).objectFit.name,"synth.obj");
  assert.match(protectorSvg(protector),/Model contour fit/);
  assert.doesNotMatch(protectorSvg(protector),/NaN|Infinity/);
  for(const {part,x,y} of protectorSheetLayout(protector).parts) {
    assert.ok(x+part.minX>=10-1e-6); assert.ok(y-part.minY-part.height>=10-1e-6);
  }
});
test("thin models keep locating lips without extending below the object",()=>{
  checkAssembly(fit(model(box(100,80,2)),{thickness:10}));
});
test("units, orientation, manual dimensions and oversized source errors remain explicit",()=>{
  near(fit(model(box(20,10,3),{units:"in"})).config.width,508);
  near(fit(model(box(),{turn:90})).config.width,280);
  assert.throws(()=>fit(model(box(5,3,1))),/units/);
  assert.throws(()=>fit(model([])),/triangulated/);
  const manual=createSynthProtector({...defaultProtectorConfiguration,object:undefined});
  assert.equal(manual.objectFit,null);
  assert.deepEqual(manual.parts,createSynthProtector(defaultProtectorConfiguration).parts);
});

test("invalid contact layouts fail with adjustment advice and recover after moving feet",()=>{
  const object=model(Array.from(new SphereGeometry(100,24,16).toNonIndexed().attributes.position.array));
  assert.throws(()=>fit(object,{allSides:true,footInset:30}),/feet overlap.*inward/);
  checkAssembly(fit(object,{allSides:true,footInset:45}));
  const separated=model([...box(),...box(5,280,70,[350,0,0])]);
  assert.throws(()=>fit(separated),/misses a broad contact surface/);
});

test("fitted support counts use model dimensions rather than hidden manual sizes",()=>{
  const protector=fit(model(),{width:180,depth:120,height:20,sideExtraFeet:6,footInset:50});
  assert.equal(protector.config.sideExtraFeet,6);
  checkAssembly(protector);
  const narrow=fit(model(box(100,40,20)),{footInset:7});
  near(narrow.config.footInset,7);
  checkAssembly(narrow);
});

test("tilted side contact heights agree with an independent box cross-section",()=>{
  for (const angle of [15,25,45]) {
    const protector=fit(model(),{angle});
    const a=angle*Math.PI/180, s=Math.sin(a), c=Math.cos(a);
    const top=280*s+70*c, depth=280*c+70*s;
    for(const part of protector.parts.filter(p=>p.kind==="foot")) {
      const contact=protector.objectFit.feet.find(f=>f.partId===part.id);
      const u=contact.contactEnd-6;
      const slice=polygonClipping.intersection(part.polygons,rect(u-0.00001,-1000,u+0.00001,1000));
      const actual=Math.min(...slice.flat(2).map(p=>p[1]))+top;
      const upper=z=>Math.min((z-70*s)*s/c+70/c,280*s+(280*c+70*s-z)*c/s);
      const z=part.center[1]+depth/2;
      const half=protector.config.thickness/2;
      const expected=280*c>=z-half && 280*c<=z+half ? top : Math.max(upper(z-half),upper(z+half));
      near(actual,expected,1e-5);
    }
  }
});
