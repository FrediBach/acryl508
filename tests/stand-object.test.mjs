import assert from "node:assert/strict";
import test from "node:test";
import polygonClipping from "polygon-clipping";
import { BoxGeometry, SphereGeometry } from "three";
import { loadTypescript } from "./load-typescript.mjs";
const { createSynthStand, defaultStandConfiguration, standSvg, standExport } = await loadTypescript("../lib/synth-stand.ts");
const { positionStandObject, trimContactSpikes, objectContactCut } = await loadTypescript("../lib/stand-object.ts");
const { readStandObject } = await loadTypescript("../lib/stand-object-import.ts");
const near = (a, b, tolerance = 1e-6) => assert.ok(Math.abs(a - b) < tolerance, `${a} ≈ ${b}`);
function box(width = 550, depth = 280, height = 70, offset = [0, 0, 0]) {
  const geometry = new BoxGeometry(width, height, depth).toNonIndexed();
  const vertices = Array.from(geometry.attributes.position.array).map((v, i) => v + offset[i % 3]);
  geometry.dispose();
  return vertices;
}
const model = (vertices = box(), patch = {}) => ({ name: "synth.obj", vertices, units: "mm", up: "y", turn: 0, ...patch });
const config = (object, patch = {}) => ({ ...defaultStandConfiguration, object, ...patch });
const rectangle = (l, b, r, t) => [[[[l, b], [r, b], [r, t], [l, t], [l, b]]]];
function at(part, u) {
  const slice = polygonClipping.intersection(part.polygons, rectangle(u - 0.00001, 0, u + 0.00001, 2000));
  return Math.max(...slice.flat(2).map(p => p[1]));
}

test("uploaded mesh supplies dimensions, compact footprint, preview pose and export geometry", () => {
  for (const advancedMode of [false, true]) for (const angle of [0, 25, 45]) {
    const stand = createSynthStand(config(model(), { angle, advancedMode }));
    near(stand.config.width, 550); near(stand.config.depth, 280); near(stand.config.height, 70);
    const posed = positionStandObject(stand.config.object, angle, stand.frontHeight);
    near(Math.min(...posed.points.map(p => p[1])), stand.frontHeight);
    near(stand.rear - stand.front, posed.depth + 2 * stand.config.thickness);
    near(stand.synthTop, posed.top);
    for (const part of stand.parts) {
      assert.equal(part.polygons.length, 1, part.id);
      assert.ok(part.polygons.flat(2).every(p => p.every(Number.isFinite)));
      near(Math.min(...part.polygons.flat(2).map(p => p[1])), 0);
      for (const slot of part.slots) {
        const mate = stand.parts.find(p => p.id === slot.mate);
        near(Math.abs(slot.root - mate.slots.find(s => s.mate === part.id).root), 0.2);
      }
    }
    assert.equal(standExport(stand).objectFit.triangleCount, 12);
    assert.deepEqual(standExport(stand).parts, stand.parts);
    assert.match(standSvg(stand), /model contour/);
    assert.doesNotMatch(standSvg(stand), /NaN|Infinity/);
  }
});

test("rib follows a stepped underside and accounts for a narrow foot inside its thickness", () => {
  const base = createSynthStand(config(model(), { angle: 0 }));
  const rib = base.parts.find(p => p.kind === "rib");
  const footX = rib.position + 2; // misses centre plane, lies inside a 6 mm sheet
  const object = model([...box(), ...box(1, 20, 10, [footX, -40, 30])]);
  const stand = createSynthStand(config(object, { angle: 0 }));
  const fitted = stand.parts.find(p => p.id === rib.id);
  near(at(fitted, 110), 66);
  near(at(fitted, 180), 76);
  const other = stand.parts.filter(p => p.kind === "rib").find(p => p.id !== fitted.id);
  near(at(other, 110), 76);
  assert.notDeepEqual(fitted.polygons, other.polygons);
});

test("diagonal supports clear the tilted box across their entire thickness", () => {
  for (const angle of [0, 25, 45]) {
    const stand = createSynthStand(config(model(), { angle, advancedMode: true, thickness: 10 }));
    const posed = positionStandObject(stand.config.object, angle, stand.frontHeight);
    const a = angle * Math.PI / 180, e = 0.0001;
    const depthOffset = 70 * Math.sin(a);
    const bodyPoint = (d, h) => [d * Math.cos(a) - h * Math.sin(a) + depthOffset, stand.frontHeight + d * Math.sin(a) + h * Math.cos(a)];
    const body = [[[bodyPoint(e,e),bodyPoint(280-e,e),bodyPoint(280-e,70-e),bodyPoint(e,70-e),bodyPoint(e,e)]]];
    assert.ok(posed.top > stand.frontHeight);
    for (const part of stand.parts) for (const v of [-5, -2.5, 0, 2.5, 5]) {
      const projected = part.polygons.map(poly => poly.map(ring => ring.map(([u,y]) => [part.placement.depth + u * Math.sin(part.placement.yaw) - v * Math.cos(part.placement.yaw),y])));
      const intersection = polygonClipping.intersection(projected, body);
      assert.deepEqual(intersection, [], `${part.id}, tilt ${angle}, thickness offset ${v}`);
    }
  }
});

test("units and orientation are explicit and invalid models never silently clamp", () => {
  const inches = model(box(20, 10, 3), { units: "in" });
  near(createSynthStand(config(inches)).config.width, 508);
  const rotated = createSynthStand(config(model(box(), { turn: 90 })));
  near(rotated.config.width, 280); near(rotated.config.depth, 550);
  assert.throws(() => createSynthStand(config(model([], {}))), /triangulated/);
  assert.throws(() => createSynthStand(config(model([NaN, ...box().slice(1)]))), /finite/);
  assert.throws(() => createSynthStand(config(model(box(5, 3, 1)))), /units/);
  assert.throws(() => createSynthStand(config(model(Array(30001 * 9).fill(1)))), /30,000/);
  assert.deepEqual(createSynthStand({ ...config(model()), object: undefined }).parts, createSynthStand(defaultStandConfiguration).parts);
});

test("OBJ and ASCII/binary STL import locally with format and file validation", async () => {
  const obj = new File(["v 0 0 0\nv 100 0 0\nv 0 100 0\nf 1 2 3\n"], "part.OBJ");
  const parsed = await readStandObject(obj);
  assert.equal(parsed.vertices.length, 9); assert.equal(parsed.up, "y");
  const stl = new File(["solid test\nfacet normal 0 0 1\nouter loop\nvertex 0 0 0\nvertex 100 0 0\nvertex 0 100 0\nendloop\nendfacet\nendsolid test"], "part.stl");
  assert.equal((await readStandObject(stl)).vertices.length, 9);
  const binary = new ArrayBuffer(134), view = new DataView(binary);
  view.setUint32(80, 1, true); view.setFloat32(108, 100, true); view.setFloat32(124, 100, true);
  assert.equal((await readStandObject(new File([binary], "binary.stl"))).vertices.length, 9);
  await assert.rejects(readStandObject(new File([""], "empty.obj")), /triangulated/);
  await assert.rejects(readStandObject(new File([""], "part.step")), /STL or OBJ/);
  await assert.rejects(readStandObject(new File([new Uint8Array(15 * 1024 * 1024 + 1)], "huge.stl")), /15 MB/);
});

test("model profiles preserve joint clearance and connected parts with rounding, holes and extensions", () => {
  for (const advancedMode of [false, true]) for (const width of [180, 550, 1400]) for (const thickness of [5, 10]) {
    const stand = createSynthStand(config(model(box(width, 280, 70)), { advancedMode, thickness, angle: 35, roundedEdges: true, cableHoles: true, frontExtension: true }));
    const ids = new Set(stand.parts.map(p => p.id));
    for (const part of stand.parts) {
      assert.equal(part.polygons.length, 1);
      near(Math.min(...part.polygons.flat(2).map(p => p[0])), part.minX);
      near(Math.max(...part.polygons.flat(2).map(p => p[0])) - part.minX, part.width);
      for (const joint of part.slots) {
        assert.ok(ids.has(joint.mate));
        const slice = polygonClipping.intersection(part.polygons, rectangle(joint.center - thickness / 2 + 1e-6, -1, joint.center + thickness / 2 - 1e-6, 2000));
        if (!slice.length) continue;
        if (joint.opens === "down") assert.ok(Math.min(...slice.flat(2).map(p => p[1])) >= joint.root - 1e-7);
        else assert.ok(Math.max(...slice.flat(2).map(p => p[1])) <= joint.root + 1e-7);
      }
    }
  }
});


test("curved, asymmetric models fit each rib separately without flattening the underside", () => {
  const geometry = new SphereGeometry(1, 64, 48).scale(275, 35, 140).toNonIndexed();
  const object = model(Array.from(geometry.attributes.position.array));
  geometry.dispose();
  const stand = createSynthStand(config(object, { angle: 0 }));
  const ribs = stand.parts.filter(p => p.kind === "rib");
  for (const rib of ribs) {
    const x = Math.max(0, Math.abs(rib.position) - stand.config.thickness / 2);
    const expected = stand.frontHeight + 35 * (1 - Math.sqrt(1 - (x / 275) ** 2));
    near(at(rib, 140), expected, 0.2);
    assert.ok(at(rib, 150) > at(rib, 140));
  }
  assert.ok(at(ribs[0], 140) > at(ribs[1], 140));
});


const area = polygons => polygons.reduce((sum, polygon) => sum + polygon.reduce((total, ring, index) => {
  const signed = ring.slice(1).reduce((value, point, i) => value + ring[i][0] * point[1] - point[0] * ring[i][1], 0) / 2;
  return total + (index ? -1 : 1) * Math.abs(signed);
}, 0), 0);

test("thin contact fins are trimmed into broad caps without filling any object clearance", () => {
  const floor = 20, width = 12;
  const profile = [[[[0,0], [100,0], [100,20], [92,20], [92,65], [90,65], [90,20],
    [65,20], [65,35], [35,35], [35,20], [20,20], [0,80], [0,0]]]];
  const trimmed = trimContactSpikes(profile, floor, width);
  assert.equal(trimmed.length, 1);
  assert.ok(area(polygonClipping.difference(trimmed, profile)) < 1e-7, "only removes material");
  near(at({ polygons: trimmed }, 0.01), 44); // 80 - 3 × 12, a 12 mm cap
  near(at({ polygons: trimmed }, 11), 44);
  near(at({ polygons: trimmed }, 91), 20); // delete the 2 mm wide upright fin
  near(at({ polygons: trimmed }, 50), 35); // retain the broad useful contact
  assert.deepEqual(polygonClipping.intersection(trimmed, rectangle(-1, -1, 101, floor)), polygonClipping.intersection(profile, rectangle(-1, -1, 101, floor)));
  assert.ok(area(polygonClipping.difference(trimmed, trimContactSpikes(trimmed, floor, width))) < 1e-7, "trimming is stable when reapplied");
});

test("tilted mesh end spikes get flat caps even with Rounded edges off", () => {
  for (const angle of [15, 25, 45]) for (const thickness of [5, 6, 10]) {
    const stand = createSynthStand(config(model(), { angle, thickness, roundedEdges: false }));
    const rib = stand.parts.find(part => part.kind === "rib");
    const a = angle * Math.PI / 180;
    const oldFrontTip = stand.frontHeight + 70 * Math.cos(a);
    assert.ok(at(rib, 0.001) < oldFrontTip - 10, "front tip is shortened substantially");
    near(at(rib, 0.001), at(rib, Math.min(2 * thickness, 70 * Math.sin(a)) - 0.001));
    const rear = 280 * Math.cos(a) + 70 * Math.sin(a);
    near(at(rib, rear - 0.001), at(rib, rear - 2 * thickness + 0.001));
    // The main playing-angle surface still contacts the object exactly.
    const middle = 70 * Math.sin(a) + 140 * Math.cos(a);
    near(at(rib, middle), stand.frontHeight + 140 * Math.sin(a), 1e-5);
    assert.equal(standExport(stand).objectFit.minimumTipWidth, 2 * thickness);
    assert.match(standSvg(stand), /thin tips trimmed/);
  }
});

test("optional rounding softens fitted caps, preserves joint fit and never grows into the mesh", () => {
  for (const advancedMode of [false, true]) {
    const input = config(model(), { angle: 25, advancedMode, thickness: 6 });
    const flat = createSynthStand(input), rounded = createSynthStand({ ...input, roundedEdges: true, cornerRadius: 3 });
    const posed = positionStandObject(input.object, input.angle, flat.frontHeight);
    for (const part of rounded.parts.filter(p => p.kind === "rib")) {
      const original = flat.parts.find(p => p.id === part.id);
      assert.ok(area(polygonClipping.difference(part.polygons, original.polygons)) < 1e-6);
      assert.ok(area(polygonClipping.difference(original.polygons, part.polygons)) > 0.01);
      const { cut } = objectContactCut(posed.points, part.placement, input.thickness, posed.top + 1);
      assert.ok(area(polygonClipping.intersection(part.polygons, cut)) < 1e-6);
      assert.deepEqual(part.slots, original.slots);
      assert.equal(part.polygons.length, 1);
    }
  }
});
