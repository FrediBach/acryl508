import assert from "node:assert/strict";
import test from "node:test";
import { Euler, Vector3 } from "three";
import { JSDOM } from "jsdom";
import { loadTypescript } from "./load-typescript.mjs";
const { createSpeaker, defaultSpeakerConfiguration: defaults, speakerSvg, speakerExport, speakerSheetLayout } = await loadTypescript("../lib/speaker.ts");
const { speakerPartGeometry } = await loadTypescript("../lib/speaker-bends.ts");
const { speakerBoardPlacements, speakerFasteners } = await loadTypescript("../lib/speaker-hardware.ts");
const { speakerFabrication, stockSvg, packSheets } = await loadTypescript("../lib/fabrication.ts");
const { parseProject, readSpeaker } = await loadTypescript("../lib/project.ts");
const close = (a, b, tolerance = 1e-7) => assert.ok(Math.abs(a - b) < tolerance, `${a} ≈ ${b}`);
const world = (part, x, y, z = 0) => new Vector3(x, y, z).applyEuler(new Euler(...part.rotation)).add(new Vector3(...part.position));

test("speaker handle bends share developed allowance and solid root geometry with Eurorack", () => {
  for (const handleMode of ["left", "right", "pair"]) for (const handleBendAngle of [1, 30, 60, 90]) for (const handleWidth of [100, 240]) for (const flatFeet of [false, true]) {
    const config = { ...defaults, handle: true, handleMode, handleBendAngle, handleWidth, flatFeet, damping: true,
      individualSheetMaterials: true, sheetThicknesses: { left: 3, right: 8, top: 6, bottom: 4 } };
    const s = createSpeaker(config), flat = createSpeaker({ ...config, handleBendAngle: 0 });
    assert.equal(s.grossVolumeLitres, flat.grossVolumeLitres);
    assert.deepEqual(speakerBoardPlacements(s), speakerBoardPlacements(flat));
    assert.deepEqual(s.carrierJoints, flat.carrierJoints);
    assert.deepEqual(s.dampingParts, flat.dampingParts);
    const priorFasteners = speakerFasteners(flat);
    speakerFasteners(s).forEach((f, i) => { f.position.forEach((v, axis) => close(v, priorFasteners[i].position[axis])); close(f.length, priorFasteners[i].length); });
    for (const part of s.parts) {
      const original = flat.parts.find(p => p.id === part.id);
      if (!part.bend) { assert.deepEqual(part, original); continue; }
      const b = part.bend, t = part.thickness;
      assert.ok(handleMode === "pair" || handleMode === part.id);
      close(b.innerRadiusMm, 2 * t);
      close(b.allowanceMm, 2.5 * t * handleBendAngle * Math.PI / 180);
      close(b.startMm + part.position[1], config.height / 2 + t);
      close(part.height - original.height, b.addedFlatLengthMm - b.rootReductionMm);
      const opening = part.polygons[0].slice(1).find(r => r.every(([, y]) => y + part.position[1] > config.height / 2));
      assert.ok(opening);
      close(Math.min(...opening.map(p => p[1])) - b.startMm - b.allowanceMm, 2 * t);
      close(part.height / 2 - Math.max(...opening.map(p => p[1])), 16);
      // Every service cut, carrier slot and mounting hole below the rim stays fixed.
      const bodyHoles = p => p.polygons[0].slice(1).filter(r => r.some(([, y]) => y + p.position[1] <= config.height / 2));
      const oldHoles = bodyHoles(original);
      bodyHoles(part).forEach((ring, i) => ring.forEach(([x, y], j) => {
        const before = world(original, ...oldHoles[i][j]), after = world(part, x, y);
        after.toArray().forEach((v, axis) => close(v, before.getComponent(axis)));
      }));
    }
    assert.ok(s.overallWidth > config.width);
    if (handleMode === "left") close(s.rightX, config.width / 2);
    if (handleMode === "right") close(s.leftX, -config.width / 2);
  }
});

test("formed meshes bend outward, preserve the shell, and fit reported assembled bounds", () => {
  for (const angle of [30, 60, 90]) {
    const s = createSpeaker({ ...defaults, handle: true, handleBendAngle: angle, flatFeet: true, individualSheetMaterials: true, sheetThicknesses: { left: 3, right: 8 } });
    for (const part of s.parts.filter(p => p.bend)) {
      const snapshot = JSON.stringify(part.polygons), geometry = speakerPartGeometry(part);
      try {
        const points = geometry.attributes.position, normals = geometry.attributes.normal;
        assert.ok(points.array.every(Number.isFinite)); assert.ok(normals.array.every(Number.isFinite));
        let outmost = 0, uppermost = -Infinity, bendSamples = 0;
        for (let i = 0; i < points.count; i++) {
          const x = points.getX(i) * 100, y = points.getY(i) * 100, z = points.getZ(i) * 100;
          const p = world(part, x, y, z);
          assert.ok(p.x >= s.leftX - 2e-5 && p.x <= s.rightX + 2e-5);
          assert.ok(p.y >= s.floorY - 2e-5 && p.y <= s.topY + 2e-5);
          assert.ok(p.z >= s.rearZ - 2e-5 && p.z <= s.frontZ + 2e-5);
          outmost = Math.max(outmost, (part.id === "left" ? -1 : 1) * p.x);
          uppermost = Math.max(uppermost, p.y);
          if (p.y < s.config.height / 2) close(Math.abs(z), part.thickness / 2, 2e-5);
          if (p.y > s.config.height / 2 && Math.abs(normals.getZ(i)) > 0.1 && Math.abs(normals.getZ(i)) < 0.9) bendSamples++;
        }
        assert.ok(outmost > s.config.width / 2 + 10);
        assert.ok(bendSamples > 10, "Bend is tessellated, with intermediate rotated surface normals");
        if (angle === 90) close(uppermost, s.config.height / 2 + 4 * part.thickness, 2e-5);
        assert.equal(JSON.stringify(part.polygons), snapshot, "Preview leaves flat cuts intact");
      } finally { geometry.dispose(); }
    }
  }
});

test("angle settings, flat cut patterns and forming instructions survive export and legacy imports", () => {
  const config = { ...defaults, handle: true, handleBendAngle: 45 }, s = createSpeaker(config), data = speakerExport(s);
  assert.deepEqual(parseProject(JSON.stringify(data)).designs.speaker, s.config);
  assert.equal(data.handles.bends.length, 2);
  assert.equal(data.dimensions.overallWidth, s.overallWidth);
  assert.ok(data.handles.formingNotes.every(n => n.includes("45° outward")));
  const legacy = { ...config }; delete legacy.handleBendAngle;
  assert.deepEqual(createSpeaker(legacy).parts, createSpeaker({ ...config, handleBendAngle: 0 }).parts);
  assert.equal(readSpeaker(legacy).handleBendAngle, 0);
  for (const handleBendAngle of [-1, 91, NaN, Infinity, "45"]) assert.throws(() => readSpeaker({ ...config, handleBendAngle }));
  const off = createSpeaker({ ...config, handle: false });
  assert.ok(off.parts.every(p => !p.bend)); close(off.overallWidth, config.width);
  const f = speakerFabrication(s), layout = speakerSheetLayout(s);
  for (const p of s.parts) {
    assert.deepEqual(f.parts.find(cut => cut.id === p.id).polygons, p.polygons.map(poly => poly.map(r => r.map(([x, y]) => [x, -y]))));
    const placed = layout.parts.find(item => item.part.id === p.id);
    for (const ring of p.polygons[0]) for (const [x, y] of ring) {
      assert.ok(placed.x + x >= 0 && placed.x + x <= layout.width);
      assert.ok(placed.y - y >= 0 && placed.y - y <= layout.height);
    }
  }
  assert.ok(f.warnings.some(n => n.includes("45° outward")));
  const dom = new JSDOM(speakerSvg(s), { contentType: "image/svg+xml" });
  assert.equal(dom.window.document.querySelectorAll('[data-operation="cut"]').length, 9);
  assert.equal(dom.window.document.querySelectorAll('[data-operation="bend-guide"]').length, 2);
  dom.window.close();
  const packed = packSheets(f.parts, 1000, 600, 10, true);
  assert.deepEqual(packed.unplaced, []);
  for (const sheet of packed.sheets) assert.doesNotMatch(stockSvg(sheet, 1000, 600), /bend-guide/);
});
