import assert from "node:assert/strict";
import test from "node:test";
import polygonClipping from "polygon-clipping";
import { loadTypescript } from "./load-typescript.mjs";
const { createSynthProtector, defaultProtectorConfiguration: defaults, protectorSvg, protectorExport, protectorSheetLayout } = await loadTypescript("../lib/synth-protector.ts");
const rect = (a, b, c, d) => [[[[a,b],[c,b],[c,d],[a,d],[a,b]]]];
const near = (a,b) => assert.ok(Math.abs(a-b) < 1e-7, `${a} ≈ ${b}`);

test("cover has four closed slots matching flush foot tabs across configuration limits", () => {
  for (const width of [180, 550, 1400]) for (const depth of [120, 600]) for (const thickness of [5, 10]) for (const headroom of [15, 120]) for (const edgeGap of [0, 2]) {
    const p = createSynthProtector({ ...defaults, width, depth, thickness, headroom, edgeGap, clearance: 0.4, footInset: 100 });
    assert.equal(p.parts.length, 5);
    assert.equal(p.parts[0].polygons.length, 1);
    assert.equal(p.parts[0].polygons[0].length, 5);
    near(p.dimensions.width, width + 2 * p.config.overhang);
    near(p.dimensions.depth, depth + 2 * p.config.overhang);
    near(p.coverUnderside - p.config.height, headroom);
    for (const foot of p.parts.slice(1)) {
      assert.equal(foot.polygons.length, 1);
      assert.equal(foot.polygons[0].length, 1);
      const points = foot.polygons.flat(2);
      assert.ok(points.every(point => point.every(Number.isFinite)));
      near(Math.max(...points.map(point => point[1])), headroom + thickness);
      // In local coordinates the synth is to the left, below the contact shoulder.
      assert.deepEqual(polygonClipping.intersection(foot.polygons, rect(-width, -20, -edgeGap, 0)), []);
      const center = foot.side * (width / 2 + edgeGap), z = foot.depthPosition;
      const tabFootprint = rect(center - p.tabWidth / 2, z - thickness / 2, center + p.tabWidth / 2, z + thickness / 2);
      assert.deepEqual(polygonClipping.intersection(p.parts[0].polygons, tabFootprint), [], "tab fits entirely inside its slot");
      assert.ok(Math.abs(z) + thickness / 2 < depth / 2, "foot remains on body edge");
      assert.ok(p.contactWidth >= 10);
    }
  }
});

test("edge clearance and body height preserve intended contact and sheet clearance", () => {
  const p = createSynthProtector({ ...defaults, edgeGap: 0, height: 150, headroom: 50 });
  near(p.coverUnderside, 200);
  near(p.overallHeight, 206);
  near(p.contactWidth, 12);
  const f = p.parts[1];
  assert.ok(f.polygons[0][0].some(([x,y]) => x === 0 && y === 0));
  const taller = createSynthProtector({ ...p.config, height: 200 });
  assert.deepEqual(taller.parts, p.parts, "body height moves the assembly but does not change cut pieces");
});

test("full-size exports and layouts retain every part and hole without overlap", () => {
  for (const config of [defaults, { ...defaults, width: 180, depth: 120, headroom: 120, overhang: 60 }]) {
    const p = createSynthProtector(config), layout = protectorSheetLayout(p), boxes = [];
    for (const {part,x,y} of layout.parts) {
      const box = { left: x + part.minX, right: x + part.minX + part.width, top: y - part.minY - part.height, bottom: y - part.minY };
      assert.ok(box.left >= 0 && box.top >= 0 && box.right <= layout.width && box.bottom <= layout.height);
      for (const other of boxes) assert.ok(box.right <= other.left || box.left >= other.right || box.bottom <= other.top || box.top >= other.bottom);
      boxes.push(box);
    }
    const svg = protectorSvg(p), data = protectorExport(p);
    assert.equal((svg.match(/<path /g) ?? []).length, 5);
    assert.equal((svg.match(/\bM/g) ?? []).length, 9);
    assert.match(svg, /width="[\d.]+mm"/);
    assert.doesNotMatch(svg, /NaN|undefined|Infinity|<text/);
    assert.deepEqual(data.parts, p.parts);
    assert.equal(data.mode, "synth-protector");
    assert.equal(data.construction.loadRating, null);
    assert.equal(data.construction.kerfCompensated, false);
  }
});

test("nonfinite and out-of-range input cannot corrupt cutting geometry", () => {
  const p = createSynthProtector({ ...defaults, width: NaN, depth: -4, height: Infinity, headroom: -1, thickness: 40, edgeGap: -4, footInset: 100 });
  assert.equal(p.config.width, defaults.width);
  assert.equal(p.config.depth, 120);
  assert.equal(p.config.height, defaults.height);
  assert.equal(p.config.headroom, 15);
  assert.equal(p.config.thickness, 10);
  assert.equal(p.config.edgeGap, 0);
  assert.equal(p.config.footInset, 40);
  assert.doesNotMatch(protectorSvg(p), /NaN|Infinity/);
});

test("all-edge supports remain separate at corners and intermediate slots retain material", () => {
  for (const width of [180, 550, 1400]) for (const depth of [120, 600]) for (const thickness of [5, 10]) for (const lockingStrips of [false, true]) for (const footInset of [15, 100]) {
    const p = createSynthProtector({ ...defaults, width, depth, thickness, footInset, allSides: true, lockingStrips, sideExtraFeet: 6, endExtraFeet: 8, clearance: 0.4 });
    const feet = p.parts.filter(part => part.kind === "foot");
    assert.equal(p.footCount, 4 + 2 * p.config.sideExtraFeet + 4 + 2 * p.config.endExtraFeet);
    assert.equal(p.parts[0].polygons[0].length, p.footCount + 1, "all cover slots remain closed and separate");
    assert.equal(p.parts[0].polygons.length, 1);
    const footprints = [];
    for (const foot of feet) {
      const nx = Math.round(Math.cos(foot.rotationY)), nd = Math.round(Math.sin(foot.rotationY));
      const transform = polygons => polygons.map(polygon => polygon.map(ring => ring.map(([x,y]) => [foot.center[0] + nx*x - nd*y, foot.center[1] + nd*x + nx*y])));
      const footprint = transform(rect(foot.minX, -thickness/2, foot.minX + foot.width, thickness/2));
      for (const other of footprints) assert.deepEqual(polygonClipping.intersection(footprint, other), [], "perpendicular feet must not collide at corners");
      footprints.push(footprint);
      const tab = transform(rect(-p.tabWidth/2, -thickness/2, p.tabWidth/2, thickness/2));
      assert.deepEqual(polygonClipping.intersection(tab, p.parts[0].polygons), [], "every rotated tab fits its cover slot");
      assert.equal(foot.polygons[0].length, lockingStrips ? 2 : 1);
    }
    const strips = p.parts.filter(part => part.kind === "strip"), stripPlans = [];
    assert.equal(strips.length, lockingStrips ? 4 : 0);
    for (const strip of strips) {
      const nx = Math.round(Math.cos(strip.rotationY)), nd = Math.round(Math.sin(strip.rotationY));
      const plan = strip.polygons.map(polygon => polygon.map(ring => ring.map(([x,y]) => [strip.center[0]+nx*x-nd*y, strip.center[1]+nd*x+nx*y])));
      for (const other of stripPlans) assert.deepEqual(polygonClipping.intersection(plan, other), [], "retaining strips and their heads cannot overlap at corners");
      stripPlans.push(plan);
    }
  }
});

test("retaining strips fit raised tab holes and stop heads block insertion", () => {
  for (const thickness of [5, 6, 10]) for (const clearance of [0, 0.4]) {
    const p = createSynthProtector({ ...defaults, lockingStrips: true, sideExtraFeet: 3, allSides: true, endExtraFeet: 4, thickness, clearance });
    const r = p.retention;
    assert.ok(r.protrusion > thickness);
    assert.ok(r.stopHeadWidth > r.holeWidth);
    assert.ok(r.stripBottom > p.config.headroom + thickness);
    for (const foot of p.parts.filter(part => part.kind === "foot")) {
      const stripCrossSection = rect(-r.stripWidth / 2, r.stripBottom, r.stripWidth / 2, r.stripBottom + thickness);
      assert.deepEqual(polygonClipping.intersection(foot.polygons, stripCrossSection), [], "strip clears the foot material through its hole");
      const strip = p.parts.find(part => part.kind === "strip" && part.edge === foot.edge);
      assert.ok(strip);
      near(r.tabTop - (r.holeBottom + r.holeHeight), 6);
    }
    const data = protectorExport(p), svg = protectorSvg(p), layout = protectorSheetLayout(p);
    assert.equal(data.construction.totalParts, p.parts.length);
    assert.equal(data.retention.captiveStrips, false);
    assert.equal((svg.match(/<path /g) ?? []).length, p.parts.length);
    assert.match(svg, /raised tabs with closed holes/);
    for (const { part, x, y } of layout.parts) {
      for (const [px,py] of part.polygons.flat(2)) assert.ok(x+px >= 0 && x+px <= layout.width && y-py >= 0 && y-py <= layout.height);
    }
    const unlocked = createSynthProtector({ ...p.config, lockingStrips: false });
    assert.equal(unlocked.stripCount, 0);
    assert.equal(unlocked.retention.protrusion, 0);
    assert.ok(unlocked.parts.filter(part => part.kind === "foot").every(part => part.polygons[0].length === 1));
  }
});

test("legacy configurations and invalid intermediate counts retain valid geometry", () => {
  const { allSides, lockingStrips, sideExtraFeet, endExtraFeet, ...legacy } = defaults;
  assert.equal(allSides, false); assert.equal(lockingStrips, false);
  assert.equal(sideExtraFeet, 0); assert.equal(endExtraFeet, 0);
  assert.deepEqual(createSynthProtector(legacy).parts, createSynthProtector(defaults).parts);
  const p = createSynthProtector({ ...defaults, allSides: true, lockingStrips: true, width: 180, depth: 120, thickness: 10, footInset: 100, sideExtraFeet: 6, endExtraFeet: 8 });
  assert.ok(p.config.sideExtraFeet < 6);
  assert.ok(p.config.endExtraFeet < 8);
  assert.equal(p.config.sideExtraFeet % 1, 0);
  assert.doesNotMatch(protectorSvg(p), /NaN|Infinity|undefined/);
});
