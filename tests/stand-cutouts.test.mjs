import assert from "node:assert/strict";
import test from "node:test";
import clipping from "polygon-clipping";
import { loadTypescript } from "./load-typescript.mjs";

const { createSynthStand, defaultStandConfiguration, standExport, standSvg, standPathData } = await loadTypescript("../lib/synth-stand.ts");
const { geometryArea, mapPolygons } = await loadTypescript("../lib/custom-cutouts.ts");
const { readStand, parseProject, makeProject, initialDesigns } = await loadTypescript("../lib/project.ts");
const { standFabrication } = await loadTypescript("../lib/fabrication.ts");
const config = { ...defaultStandConfiguration, bentSheet: true };
const rect = (x1,y1,x2,y2) => [[[[x1,y1],[x2,y1],[x2,y2],[x1,y2],[x1,y1]]]];
const artwork = patch => ({ id: "mark", name: "Mark", side: "bottom", source: { kind: "svg", fileName: "mark.svg" }, polygons: rect(-0.5,-0.5,0.5,0.5), width: 30, x: 25, y: 10, rotation: 23, ...patch });
const near = (a,b) => assert.ok(Math.abs(a-b)<1e-6, `${a} ≈ ${b}`);

test("deck artwork uses centred top-view coordinates and shared preview, SVG and fabrication geometry", () => {
  const blank = createSynthStand(config), cut = createSynthStand({ ...config, cutouts: [artwork()] });
  const part = cut.parts.find(p=>p.tray), original = blank.parts.find(p=>p.tray);
  near(geometryArea(original.polygons)-geometryArea(part.polygons),900);
  assert.deepEqual(cut.parts.slice(0,2),blank.parts.slice(0,2));
  const center = part.tray.deckStart + part.tray.deckDepth/2;
  near(geometryArea(clipping.intersection(part.polygons,rect(24,center+9,26,center+11))),0);
  near(geometryArea(clipping.intersection(cut.cutoutPanels.faces.bottom.polygons,rect(24,9,26,11))),0);
  assert.ok(standSvg(cut).includes(standPathData(part.polygons)));
  assert.deepEqual(standFabrication(cut).parts.find(p=>p.id===part.id).polygons,mapPolygons(part.polygons,(x,y)=>[x,-y]));
  assert.equal(cut.canExport,true);
});

test("oversized and rotated cuts preserve both folds, the deck border, and complete locating-hole webs", () => {
  for (const angle of [0,25,45]) for (const width of [180,550,1400]) for (const depth of [120,600]) for (const thickness of [5,10]) {
    const options = {...config,angle,width,depth,thickness,roundedEdges:true,cornerRadius:10};
    const blank = createSynthStand(options), cut = createSynthStand({...options,cutouts:[artwork({width:1000,x:0,y:0,rotation:17})]});
    const p = cut.parts.find(p=>p.tray), b = blank.parts.find(p=>p.tray), tray = p.tray;
    assert.equal(p.polygons.length,1);
    const removed = clipping.difference(b.polygons,p.polygons), web = 2*p.thickness;
    const protectedAreas = [rect(-p.width/2,-1,p.width/2,tray.deckStart+web),rect(-p.width/2,tray.deckStart+tray.deckDepth-web,p.width/2,p.height+1),
      ...tray.holes.map(h=>rect(h.x-h.size/2-web,h.y-h.size/2-web,h.x+h.size/2+web,h.y+h.size/2+web))];
    for (const zone of protectedAreas) near(geometryArea(clipping.intersection(removed,zone)),0);
    assert.deepEqual(cut.cutoutPanels.reports[0].clipped,["mark"]);
    assert.equal(cut.canExport,true);
    assert.ok(standFabrication(cut).warnings.some(w=>/cutouts clipped/.test(w)));
  }
});

test("loose text centres are removed; off-deck cuts are reported; calculation errors block fabrication", () => {
  const ring = artwork({x:0,y:0,rotation:0,polygons:[[rect(-.5,-.5,.5,.5)[0][0],rect(-.25,-.25,.25,.25)[0][0]]]});
  const cut = createSynthStand({...config,cutouts:[ring]});
  assert.equal(cut.cutoutPanels.reports[0].removedParts,1);
  near(cut.cutoutPanels.reports[0].removedArea,225);
  const outside = createSynthStand({...config,cutouts:[artwork({y:1000})]});
  assert.deepEqual(outside.parts,createSynthStand(config).parts);
  assert.deepEqual(outside.cutoutPanels.reports[0].outside,["mark"]);
  const broken = createSynthStand({...config,cutouts:[artwork({polygons:null})]});
  assert.equal(broken.canExport,false);
  assert.equal(standFabrication(broken).blocked,true);
  assert.throws(()=>standSvg(broken),/cutout warnings/);
});

test("artwork survives mode switches, design and project reload; older designs default to no cuts", () => {
  const s = createSynthStand({...config,cutouts:[artwork()]});
  const parsed = parseProject(JSON.stringify(standExport(s))).designs.stand;
  assert.deepEqual(createSynthStand(parsed).parts,s.parts);
  const project = makeProject("Tray artwork","stand",{...initialDesigns,stand:s.config},[]);
  assert.deepEqual(parseProject(JSON.stringify(project)).designs.stand.cutouts,s.config.cutouts);
  for (const advancedMode of [false,true]) {
    const other = createSynthStand({...s.config,bentSheet:false,advancedMode});
    assert.deepEqual(other.parts,createSynthStand({...defaultStandConfiguration,advancedMode}).parts);
    assert.deepEqual(createSynthStand({...other.config,bentSheet:true}).parts,s.parts);
  }
  const legacy = {...config}; delete legacy.cutouts;
  assert.deepEqual(readStand(legacy).cutouts,[]);
  for (const cutouts of [null,[artwork({side:"rear"})],[artwork({width:NaN})],[artwork({polygons:[]})],Array(21).fill(artwork())]) assert.throws(()=>readStand({...config,cutouts}));
});
