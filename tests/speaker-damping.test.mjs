import assert from "node:assert/strict";
import test from "node:test";
import clipping from "polygon-clipping";
import { JSDOM } from "jsdom";
import { loadTypescript } from "./load-typescript.mjs";

const { createSpeaker, defaultSpeakerConfiguration: defaults, speakerExport, speakerSvg, speakerSheetLayout, speakerRoundedRect } = await loadTypescript("../lib/speaker.ts");
const { speakerFasteners, speakerBoardPlacements } = await loadTypescript("../lib/speaker-hardware.ts");
const { speakerFabrication, packSheets } = await loadTypescript("../lib/fabrication.ts");
const { parseProject } = await loadTypescript("../lib/project.ts");
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} ≈ ${b}`);
const ringArea = ring => Math.abs(ring.reduce((sum, p, i) => { const q = ring[(i + 1) % ring.length]; return sum + p[0] * q[1] - q[0] * p[1]; }, 0) / 2);
const area = polygons => polygons.reduce((sum, [outer, ...holes]) => sum + ringArea(outer) - holes.reduce((a, h) => a + ringArea(h), 0), 0);

test("gaskets remain narrow connected frames with four bolt holes, clear of donor openings", () => {
  for (const [width, height] of [[280, 210], [420, 300]]) for (const thickness of [3, 8]) for (const mixed of [false, true]) {
    const s = createSpeaker({ ...defaults, width, height, thickness, damping: true, individualSheetMaterials: mixed,
      sheetThicknesses: { left: 3, right: 8, top: 7, bottom: 4, baffle: 6, rear: 3 } });
    assert.equal(s.parts.length, 10);
    assert.equal(s.dampingParts.length, 2);
    for (const gasket of s.dampingParts) {
      assert.equal(gasket.polygons.length, 1, "One connected, cuttable frame");
      assert.equal(gasket.polygons[0].length, 6, "Open centre plus four enclosed bolt holes");
      assert.ok(area(gasket.polygons) < width * height * 0.16, "Minimal material around the perimeter");
      for (const ring of gasket.polygons[0]) for (const [x, y] of ring) {
        assert.ok(Math.abs(x) <= width / 2 - 0.35 + 1e-7);
        assert.ok(Math.abs(y) <= height / 2 - 0.35 + 1e-7);
      }
      for (const [x, y] of s.mounts) {
        const clearance = [[speakerRoundedRect(x, y, 3.6, 3.6, 1.8)]];
        close(area(clipping.intersection(gasket.polygons, clearance)), 0);
        const surrounding = [[speakerRoundedRect(x, y, 7, 7, 3.5)]];
        assert.ok(area(clipping.intersection(gasket.polygons, surrounding)) > 20, "Locating hole retains a substantial tab");
      }
      const baffle = s.parts.find(p => p.id === "baffle");
      for (const hole of baffle.polygons[0].slice(1, 26)) {
        close(area(clipping.intersection(gasket.polygons, [[hole]])), 0);
      }
    }
    assert.deepEqual(s.dampingParts[0].polygons, s.dampingParts[1].polygons);
  }
});

test("gasket thickness fills each interface, updates tie rods and preserves the bonded shell", () => {
  for (const dampingThickness of [0.25, 1, 2]) for (const handle of [false, true]) for (const flatFeet of [false, true]) {
    const config = { ...defaults, damping: true, dampingThickness, handle, handleMode: "left", flatFeet, individualSheetMaterials: true,
      sheetThicknesses: { left: 3, right: 8, top: 7, bottom: 4, baffle: 6, rear: 3 } };
    const s = createSpeaker(config), off = createSpeaker({ ...config, damping: false });
    const parts = Object.fromEntries(s.parts.map(p => [p.id, p]));
    const front = s.dampingParts[0], rear = s.dampingParts[1], top = parts.top;
    close(front.position[2] - front.thickness / 2, top.position[2] + top.height / 2);
    close(front.position[2] + front.thickness / 2, parts.baffle.position[2] - parts.baffle.thickness / 2);
    close(rear.position[2] + rear.thickness / 2, top.position[2] - top.height / 2);
    close(rear.position[2] - rear.thickness / 2, parts.rear.position[2] + parts.rear.thickness / 2);
    close(s.bodyDepth, defaults.depth + 2 * dampingThickness);
    close(s.totalDepth, off.totalDepth + 2 * dampingThickness);
    close(s.innerDepth, off.innerDepth + 2 * dampingThickness);
    close(s.grossVolumeLitres, s.innerWidth * s.innerHeight * s.innerDepth / 1e6);
    close(parts.grille.position[2] - parts.grille.thickness / 2 - parts.baffle.position[2] - parts.baffle.thickness / 2, config.grilleGap);
    for (const part of off.parts.filter(p => !["baffle", "rear", "grille", "rear-cover"].includes(p.id))) assert.deepEqual(parts[part.id], part);
    assert.deepEqual(speakerBoardPlacements(s), speakerBoardPlacements(off));
    const fasteners = speakerFasteners(s), previous = speakerFasteners(off);
    for (const f of fasteners) {
      const old = previous.find(p => p.id === f.id);
      if (f.kind === "rod") { close(f.length, old.length + 2 * dampingThickness); close(f.position[2], old.position[2]); }
      else if (["baffle", "grille", "rear", "rear-cover"].includes(f.parent)) close(f.position[2], old.position[2] + (["rear", "rear-cover"].includes(f.parent) ? -1 : 1) * dampingThickness);
      else assert.deepEqual(f, old);
    }
    assert.ok(front.explode[2] > 0 && front.explode[2] < parts.baffle.explode[2]);
    assert.ok(rear.explode[2] < parts["pcb-rear"].explode[2] && rear.explode[2] > parts.rear.explode[2]);
    assert.deepEqual(createSpeaker({ ...s.config, damping: false }), off);
  }
});

test("damping settings persist and cutting exports separate the two soft sheets from acrylic", () => {
  const s = createSpeaker({ ...defaults, damping: true, dampingThickness: 0.75 });
  const exported = speakerExport(s);
  assert.deepEqual(parseProject(JSON.stringify(exported)).designs.speaker, s.config);
  assert.equal(exported.damping.parts.length, 2);
  const legacy = structuredClone(exported);
  delete legacy.configuration.damping; delete legacy.configuration.dampingThickness;
  assert.equal(parseProject(JSON.stringify(legacy)).designs.speaker.damping, false);
  assert.equal(createSpeaker(defaults).dampingParts.length, 0);
  for (const patch of [{ damping: "yes" }, { dampingThickness: null }]) {
    assert.throws(() => parseProject(JSON.stringify({ ...exported, configuration: { ...s.config, ...patch } })));
  }
  assert.equal(createSpeaker({ ...defaults, dampingThickness: -1 }).config.dampingThickness, 0.25);
  assert.equal(createSpeaker({ ...defaults, dampingThickness: 20 }).config.dampingThickness, 2);
  const f = speakerFabrication(s), packed = packSheets(f.parts, 1000, 600, 10, true);
  assert.equal(f.parts.length, 12); assert.deepEqual(packed.unplaced, []);
  const softSheets = packed.sheets.filter(sheet => sheet.material === "Dark damping sheet");
  assert.equal(softSheets.flatMap(sheet => sheet.parts).length, 2);
  for (const sheet of softSheets) { assert.equal(sheet.thickness, 0.75); assert.ok(sheet.parts.every(p => p.id.startsWith("damping-"))); }
  assert.equal(speakerSheetLayout(s).parts.length, 12);
  const dom = new JSDOM(speakerSvg(s), { contentType: "image/svg+xml" });
  assert.equal(dom.window.document.querySelectorAll('path[data-operation="cut"]').length, 12);
  for (const id of ["damping-baffle", "damping-rear"]) {
    const group = dom.window.document.getElementById(id);
    assert.equal(group.getAttribute("data-material"), "Dark damping sheet");
    assert.equal(group.getAttribute("data-thickness-mm"), "0.75");
  }
  dom.window.close();
});
